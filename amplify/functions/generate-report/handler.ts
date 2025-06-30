import type { Handler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import middy from '@middy/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

import type { GenerateReportArgs, GenerateReportResult, ReportTemplateData } from './resource';
import { TenantContext } from '../../shared/utils/tenant-context';
import { ReportGenerator } from '../../shared/services/report-generator';
import { TemplateEngine } from '../../shared/services/template-engine';
import { ReportStorage } from '../../shared/services/report-storage';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'generate-report' });
const metrics = new Metrics({ namespace: 'CloudBestPracticeAnalyzer/Reports' });
const tracer = new Tracer({ serviceName: 'generate-report' });

// Initialize AWS clients
const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const s3Client = tracer.captureAWSv3Client(new S3Client({}));
const bedrockClient = tracer.captureAWSv3Client(new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
}));

/**
 * Lambda handler for report generation
 */
const lambdaHandler: Handler<GenerateReportArgs, GenerateReportResult> = async (
  event,
  context
) => {
  const {
    analysisId,
    projectId,
    tenantId,
    reportType,
    format,
    name,
    includeCharts = true,
    includeRecommendations = true,
    severityFilter,
    pillarFilter,
    customTemplate,
    branding,
  } = event;
  
  // Add custom metrics
  metrics.addDimension('TenantId', tenantId);
  metrics.addDimension('ReportType', reportType);
  metrics.addDimension('Format', format);
  
  logger.info('Starting report generation', {
    analysisId,
    projectId,
    tenantId,
    reportType,
    format,
    name,
  });

  const reportId = `${analysisId}-${reportType.toLowerCase()}-${Date.now()}`;

  try {
    // Initialize tenant context for multi-tenancy
    const tenantContext = new TenantContext(dynamoClient, {
      tenantTableName: process.env.TENANT_TABLE_NAME!,
      projectTableName: process.env.PROJECT_TABLE_NAME!,
    });

    // Validate tenant access
    const isAuthorized = await tenantContext.validateTenantAccess(tenantId, projectId);
    if (!isAuthorized) {
      throw new Error('Unauthorized: Invalid tenant or project access');
    }

    // Create report record with GENERATING status
    await tenantContext.createReport({
      id: reportId,
      tenantId,
      projectId,
      analysisId,
      name,
      type: reportType,
      format,
      status: 'GENERATING',
      generatedBy: context.invokedFunctionArn,
      createdAt: new Date().toISOString(),
    });

    // Initialize report services
    const reportStorage = new ReportStorage({
      s3Client,
      bucketName: process.env.REPORTS_BUCKET!,
      tenantId,
    });

    const templateEngine = new TemplateEngine({
      s3Client,
      templatesBucket: process.env.TEMPLATES_BUCKET!,
      customTemplate,
    });

    const reportGenerator = new ReportGenerator({
      s3Client,
      bedrockClient,
      enableAIInsights: process.env.ENABLE_AI_INSIGHTS === 'true',
      logger,
    });

    // Fetch analysis data
    const analysisData = await tenantContext.getAnalysisWithFindings(
      analysisId,
      {
        severityFilter,
        pillarFilter,
        maxFindings: parseInt(process.env.MAX_FINDINGS_PER_REPORT || '1000'),
      }
    );

    if (!analysisData) {
      throw new Error(`Analysis not found: ${analysisId}`);
    }

    // Prepare template data
    const templateData: ReportTemplateData = {
      reportInfo: {
        title: name,
        type: reportType,
        format,
        generatedAt: new Date().toISOString(),
        generatedBy: 'Cloud Best Practice Analyzer',
        version: '1.0',
      },
      tenant: {
        id: tenantId,
        name: analysisData.tenant.name,
      },
      project: {
        id: projectId,
        name: analysisData.project.name,
        description: analysisData.project.description,
      },
      analysis: {
        id: analysisId,
        name: analysisData.name,
        type: analysisData.type,
        status: analysisData.status,
        createdAt: analysisData.createdAt,
        completedAt: analysisData.completedAt,
        duration: analysisData.completedAt 
          ? new Date(analysisData.completedAt).getTime() - new Date(analysisData.createdAt).getTime()
          : undefined,
      },
      summary: {
        totalResources: analysisData.resultSummary?.totalResources || 0,
        totalFindings: analysisData.findings.length,
        findingsBySeverity: {
          CRITICAL: analysisData.resultSummary?.findingsBySeverity?.CRITICAL || 0,
          HIGH: analysisData.resultSummary?.findingsBySeverity?.HIGH || 0,
          MEDIUM: analysisData.resultSummary?.findingsBySeverity?.MEDIUM || 0,
          LOW: analysisData.resultSummary?.findingsBySeverity?.LOW || 0,
          INFO: analysisData.resultSummary?.findingsBySeverity?.INFO || 0,
        },
        findingsByPillar: {
          OPERATIONAL_EXCELLENCE: analysisData.resultSummary?.findingsByPillar?.OPERATIONAL_EXCELLENCE || 0,
          SECURITY: analysisData.resultSummary?.findingsByPillar?.SECURITY || 0,
          RELIABILITY: analysisData.resultSummary?.findingsByPillar?.RELIABILITY || 0,
          PERFORMANCE_EFFICIENCY: analysisData.resultSummary?.findingsByPillar?.PERFORMANCE_EFFICIENCY || 0,
          COST_OPTIMIZATION: analysisData.resultSummary?.findingsByPillar?.COST_OPTIMIZATION || 0,
          SUSTAINABILITY: analysisData.resultSummary?.findingsByPillar?.SUSTAINABILITY || 0,
        },
        complianceScore: calculateComplianceScore(analysisData.findings),
        riskLevel: calculateRiskLevel(analysisData.findings),
      },
      findings: analysisData.findings.map(finding => ({
        id: finding.id,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        pillar: finding.pillar,
        resource: finding.resource || '',
        recommendation: finding.recommendation,
        category: finding.category,
        ruleId: finding.ruleId,
        line: finding.line,
      })),
      branding: branding ? {
        logo: branding.logo,
        companyName: branding.companyName,
        colors: branding.colors ? {
          primary: branding.colors.primary || '#0066cc',
          secondary: branding.colors.secondary || '#6c757d',
        } : undefined,
      } : undefined,
    };

    // Add charts data if requested
    if (includeCharts) {
      templateData.charts = {
        severityDistribution: Object.entries(templateData.summary.findingsBySeverity)
          .map(([label, value]) => ({
            label,
            value,
            color: getSeverityColor(label),
          })),
        pillarDistribution: Object.entries(templateData.summary.findingsByPillar)
          .map(([label, value]) => ({
            label: formatPillarName(label),
            value,
            color: getPillarColor(label),
          })),
      };
    }

    // Generate report based on format
    let reportBuffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'PDF':
        reportBuffer = await reportGenerator.generatePDF(templateData, reportType, templateEngine);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;
      case 'EXCEL':
        reportBuffer = await reportGenerator.generateExcel(templateData, reportType);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        break;
      case 'HTML':
        const htmlContent = await templateEngine.renderTemplate(reportType, templateData);
        reportBuffer = Buffer.from(htmlContent, 'utf8');
        contentType = 'text/html';
        fileExtension = 'html';
        break;
      case 'JSON':
        reportBuffer = Buffer.from(JSON.stringify(templateData, null, 2), 'utf8');
        contentType = 'application/json';
        fileExtension = 'json';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Store report in S3
    const s3Key = `reports/${reportId}.${fileExtension}`;
    const s3Location = await reportStorage.storeReport(s3Key, reportBuffer, {
      contentType,
      metadata: {
        reportId,
        tenantId,
        projectId,
        analysisId,
        reportType,
        format,
        generatedAt: new Date().toISOString(),
      },
    });

    // Generate signed URL for download
    const signedUrl = await reportStorage.generateSignedUrl(s3Key, {
      expiresIn: parseInt(process.env.SIGNED_URL_EXPIRATION || '3600'),
    });

    // Update report status to COMPLETED
    await tenantContext.updateReport(reportId, {
      status: 'COMPLETED',
      s3Location: {
        bucket: s3Location.bucket,
        key: s3Location.key,
        region: s3Location.region,
      },
      updatedAt: new Date().toISOString(),
    });

    // Add success metrics
    metrics.addMetric('ReportGenerated', MetricUnit.Count, 1);
    metrics.addMetric('ReportSize', MetricUnit.Bytes, reportBuffer.length);
    metrics.addMetric('FindingsProcessed', MetricUnit.Count, templateData.findings.length);

    logger.info('Report generation completed successfully', {
      reportId,
      format,
      fileSize: reportBuffer.length,
      findingsCount: templateData.findings.length,
    });

    return {
      success: true,
      reportId,
      status: 'COMPLETED',
      message: 'Report generated successfully',
      s3Location: {
        bucket: s3Location.bucket,
        key: s3Location.key,
        region: s3Location.region,
        signedUrl,
        expiresAt: new Date(Date.now() + parseInt(process.env.SIGNED_URL_EXPIRATION || '3600') * 1000).toISOString(),
      },
      metadata: {
        fileSize: reportBuffer.length,
        format,
        generatedAt: new Date().toISOString(),
        findingsCount: templateData.findings.length,
        reportType,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logger.error('Report generation failed', {
      reportId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update report status to FAILED
    try {
      const tenantContext = new TenantContext(dynamoClient, {
        tenantTableName: process.env.TENANT_TABLE_NAME!,
        projectTableName: process.env.PROJECT_TABLE_NAME!,
      });
      
      await tenantContext.updateReport(reportId, {
        status: 'FAILED',
        error: errorMessage,
        updatedAt: new Date().toISOString(),
      });
    } catch (updateError) {
      logger.error('Failed to update report status', { updateError });
    }

    // Add error metrics
    metrics.addMetric('ReportFailed', MetricUnit.Count, 1);

    return {
      success: false,
      reportId,
      status: 'FAILED',
      error: errorMessage,
    };
  }
};

// Helper functions
function calculateComplianceScore(findings: any[]): number {
  if (findings.length === 0) return 100;
  
  const weights = { CRITICAL: 10, HIGH: 5, MEDIUM: 2, LOW: 1, INFO: 0 };
  const totalWeight = findings.reduce((sum, finding) => sum + (weights[finding.severity as keyof typeof weights] || 0), 0);
  const maxPossibleWeight = findings.length * weights.CRITICAL;
  
  return Math.max(0, Math.round(((maxPossibleWeight - totalWeight) / maxPossibleWeight) * 100));
}

function calculateRiskLevel(findings: any[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  
  if (criticalCount > 0) return 'CRITICAL';
  if (highCount >= 5) return 'HIGH';
  if (highCount > 0 || findings.filter(f => f.severity === 'MEDIUM').length >= 10) return 'MEDIUM';
  return 'LOW';
}

function getSeverityColor(severity: string): string {
  const colors = {
    CRITICAL: '#dc2626',
    HIGH: '#ea580c',
    MEDIUM: '#d97706',
    LOW: '#65a30d',
    INFO: '#0891b2',
  };
  return colors[severity as keyof typeof colors] || '#6b7280';
}

function getPillarColor(pillar: string): string {
  const colors = {
    OPERATIONAL_EXCELLENCE: '#3b82f6',
    SECURITY: '#dc2626',
    RELIABILITY: '#059669',
    PERFORMANCE_EFFICIENCY: '#7c3aed',
    COST_OPTIMIZATION: '#ea580c',
    SUSTAINABILITY: '#10b981',
  };
  return colors[pillar as keyof typeof colors] || '#6b7280';
}

function formatPillarName(pillar: string): string {
  return pillar.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

// Apply PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics, { captureColdStartMetric: true }))
  .use(injectLambdaContext(logger, { clearState: true }));