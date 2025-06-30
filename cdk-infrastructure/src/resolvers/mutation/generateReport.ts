/**
 * Generate Report Mutation Resolver
 * Generates a report from an analysis with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ReportService' });
const tracer = new Tracer({ serviceName: 'ReportService' });

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

interface GenerateReportArgs {
  analysisId: string;
  format: string; // 'PDF', 'EXCEL', 'JSON'
  options?: {
    includeDetails?: boolean;
    includeRecommendations?: boolean;
    customTemplate?: string;
  };
}

interface Report {
  reportId: string;
  analysisId: string;
  projectId: string;
  tenantId: string;
  name: string;
  format: string;
  status: string;
  options: {
    includeDetails: boolean;
    includeRecommendations: boolean;
    customTemplate?: string;
  };
  s3Location?: {
    bucket: string;
    key: string;
  };
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  createdBy: string;
}

const generateReport: AppSyncResolverHandler<GenerateReportArgs, Report> = async (event) => {
  const { arguments: args, identity } = event;
  const { analysisId, format, options = {} } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  const reportId = uuidv4();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

  logger.info('GenerateReport mutation started', {
    userId,
    analysisId,
    reportId,
    format,
    userTenantId,
    userRole,
  });

  try {
    // First, get the analysis to verify tenant access
    const analysisCommand = new GetCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Key: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#METADATA',
      },
    });

    const analysisResult = await ddbDocClient.send(analysisCommand);

    if (!analysisResult.Item) {
      logger.warn('Analysis not found', { analysisId });
      throw new Error('Analysis not found');
    }

    const analysis = analysisResult.Item;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && analysis.tenantId !== userTenantId) {
      logger.warn('Access denied to analysis from different tenant', {
        analysisId,
        analysisTenantId: analysis.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot generate report for analysis from different tenant');
    }

    // Check if analysis is completed
    if (analysis.status !== 'COMPLETED') {
      throw new Error(`Cannot generate report: Analysis status is ${analysis.status}`);
    }

    const report: Report = {
      reportId,
      analysisId,
      projectId: analysis.projectId,
      tenantId: analysis.tenantId,
      name: `${analysis.name}-Report-${format}-${new Date().toISOString().split('T')[0]}`,
      format,
      status: 'GENERATING',
      options: {
        includeDetails: options.includeDetails || true,
        includeRecommendations: options.includeRecommendations || true,
        customTemplate: options.customTemplate,
      },
      createdAt: now,
      updatedAt: now,
      expiresAt,
      createdBy: userId,
    };

    // Save report metadata
    const putCommand = new PutCommand({
      TableName: process.env.REPORTS_TABLE!,
      Item: {
        pk: `REPORT#${reportId}`,
        sk: '#METADATA',
        ...report,
        // GSI keys for queries
        analysisId,
        projectId: analysis.projectId,
        tenantId: analysis.tenantId,
        status: report.status,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    });

    await ddbDocClient.send(putCommand);

    // Start report generation process (simplified for now)
    try {
      await generateReportContent(report, analysis);
    } catch (generationError) {
      logger.error('Report generation failed', {
        reportId,
        error: generationError instanceof Error ? generationError.message : String(generationError),
      });
      
      // Update status to failed
      report.status = 'FAILED';
      report.updatedAt = new Date().toISOString();
    }

    logger.info('GenerateReport mutation completed', {
      reportId,
      analysisId,
      tenantId: analysis.tenantId,
      format,
      status: report.status,
    });

    return report;

  } catch (error: any) {
    logger.error('Error generating report', { 
      error: error instanceof Error ? error.message : String(error),
      analysisId,
      format,
    });
    throw new Error('Failed to generate report');
  }
};

// Helper function to generate report content
async function generateReportContent(report: Report, analysis: any): Promise<void> {
  const { reportId, format, tenantId } = report;
  
  // Generate mock report content based on format
  let content: string | Buffer;
  let contentType: string;
  
  switch (format.toLowerCase()) {
    case 'pdf':
      content = `Mock PDF Report for Analysis ${analysis.analysisId}`;
      contentType = 'application/pdf';
      break;
    case 'excel':
      content = `Mock Excel Report for Analysis ${analysis.analysisId}`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
    case 'json':
      content = JSON.stringify({
        reportId,
        analysisId: analysis.analysisId,
        summary: analysis.results?.summary || {},
        findings: analysis.results?.findings || [],
        recommendations: analysis.results?.recommendations || [],
        generatedAt: new Date().toISOString(),
      }, null, 2);
      contentType = 'application/json';
      break;
    default:
      throw new Error(`Unsupported report format: ${format}`);
  }

  // Upload to S3
  const s3Key = `reports/${tenantId}/${reportId}/${reportId}.${format.toLowerCase()}`;
  
  const s3Command = new PutObjectCommand({
    Bucket: process.env.APPLICATION_DATA_BUCKET!,
    Key: s3Key,
    Body: content,
    ContentType: contentType,
    Metadata: {
      reportId,
      analysisId: analysis.analysisId,
      tenantId,
      generatedBy: report.createdBy,
    },
  });

  await s3Client.send(s3Command);

  // Update report with S3 location
  report.s3Location = {
    bucket: process.env.APPLICATION_DATA_BUCKET!,
    key: s3Key,
  };
  report.status = 'COMPLETED';
  report.updatedAt = new Date().toISOString();

  // Generate download URL (simplified - in production you'd use presigned URLs)
  report.downloadUrl = `https://${process.env.APPLICATION_DATA_BUCKET}.s3.amazonaws.com/${s3Key}`;
}

// Export the handler with middleware
export const handler = middy(generateReport)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));