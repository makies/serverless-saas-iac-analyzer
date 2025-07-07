/**
 * Generate Report Enhanced Mutation Resolver
 * Generates comprehensive reports with multi-format support
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';
import { getStepFunctionsArns } from '../../shared/utils/parameter-store';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ReportService' });
const tracer = new Tracer({ serviceName: 'ReportService' });

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const sfnClient = new SFNClient({});

interface GenerateReportArgs {
  tenantId: string;
  projectId: string;
  analysisId?: string;
  name: string;
  type: string; // ANALYSIS_SUMMARY, DETAILED_FINDINGS, EXECUTIVE_SUMMARY, COMPLIANCE_REPORT
  format: string; // PDF, EXCEL, JSON, HTML
  customOptions?: {
    includeCharts: boolean;
    includeCostEstimates: boolean;
    complianceFrameworks: string[];
    executiveSummaryLevel: string; // BRIEF, DETAILED, COMPREHENSIVE
  };
}

interface Report {
  reportId: string;
  tenantId: string;
  projectId: string;
  analysisId?: string;
  name: string;
  type: string;
  format: string;
  status: string;
  customOptions?: any;
  s3Location?: {
    bucket: string;
    key: string;
    size: number;
    contentType: string;
  };
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

const generateReportEnhanced: AppSyncResolverHandler<GenerateReportArgs, Report> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, projectId, analysisId, name, type, format, customOptions } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    logger.warn('Access denied to different tenant', {
      requestedTenantId: tenantId,
      userTenantId,
    });
    throw new Error('Access denied: Cannot generate report for different tenant');
  }

  logger.info('GenerateReportEnhanced mutation started', {
    userId,
    tenantId,
    projectId,
    analysisId,
    name,
    type,
    format,
    hasCustomOptions: !!customOptions,
  });

  try {
    // Validate project exists and user has access
    const projectQuery = new GetCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: '#METADATA',
      },
    });

    const projectResult = await ddbDocClient.send(projectQuery);
    if (!projectResult.Item) {
      throw new Error(`Project '${projectId}' not found`);
    }

    const project = projectResult.Item;
    if (project.tenantId !== tenantId) {
      throw new Error('Access denied: Project belongs to different tenant');
    }

    // Validate analysis if specified
    let analysis = null;
    if (analysisId) {
      const analysisQuery = new GetCommand({
        TableName: process.env.ANALYSES_TABLE!,
        Key: {
          pk: `ANALYSIS#${analysisId}`,
          sk: '#METADATA',
        },
      });

      const analysisResult = await ddbDocClient.send(analysisQuery);
      if (!analysisResult.Item) {
        throw new Error(`Analysis '${analysisId}' not found`);
      }

      analysis = analysisResult.Item;
      if (analysis.tenantId !== tenantId || analysis.projectId !== projectId) {
        throw new Error('Access denied: Analysis belongs to different tenant or project');
      }
    }

    // Validate report type and format combination
    const validFormats = {
      ANALYSIS_SUMMARY: ['PDF', 'HTML', 'JSON'],
      DETAILED_FINDINGS: ['PDF', 'EXCEL', 'JSON'],
      EXECUTIVE_SUMMARY: ['PDF', 'HTML'],
      COMPLIANCE_REPORT: ['PDF', 'EXCEL', 'JSON'],
    };

    if (!validFormats[type as keyof typeof validFormats]?.includes(format)) {
      throw new Error(`Invalid format '${format}' for report type '${type}'`);
    }

    const reportId = uuidv4();
    const now = new Date().toISOString();

    const report: Report = {
      reportId,
      tenantId,
      projectId,
      analysisId,
      name,
      type,
      format,
      status: 'GENERATING',
      customOptions,
      generatedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    // Store report record in DynamoDB
    const putCommand = new PutCommand({
      TableName: process.env.REPORTS_TABLE!,
      Item: {
        pk: `REPORT#${reportId}`,
        sk: '#METADATA',
        gsi1pk: `TENANT#${tenantId}`,
        gsi1sk: `PROJECT#${projectId}#${now}`,
        gsi2pk: `PROJECT#${projectId}`,
        gsi2sk: now,
        gsi3pk: analysisId ? `ANALYSIS#${analysisId}` : `PROJECT#${projectId}`,
        gsi3sk: now,
        ...report,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    });

    await ddbDocClient.send(putCommand);

    // Prepare Step Function execution input for report generation
    const executionInput = {
      reportId,
      tenantId,
      projectId,
      analysisId,
      reportType: type,
      format,
      customOptions: customOptions || {},
      metadata: {
        generatedBy: userId,
        projectName: project.name,
        analysisName: analysis?.name,
        requestedAt: now,
      },
    };

    // Get Step Functions ARN from Parameter Store
    const environment = process.env.ENVIRONMENT || 'dev';
    const { reportGenerationStateMachineArn } = await getStepFunctionsArns(environment);

    try {
      const startExecutionCommand = new StartExecutionCommand({
        stateMachineArn: reportGenerationStateMachineArn,
        name: `report-${reportId}-${Date.now()}`,
        input: JSON.stringify(executionInput),
      });

      const executionResult = await sfnClient.send(startExecutionCommand);

      logger.info('Report generation workflow started', {
        reportId,
        executionArn: executionResult.executionArn,
        stateMachineArn: reportGenerationStateMachineArn,
      });
    } catch (sfnError) {
      // If Step Functions isn't available, log warning
      logger.warn('Step Function not available for report generation', {
        reportId,
        error: sfnError instanceof Error ? sfnError.message : String(sfnError),
      });
    }

    // Update tenant analytics
    const analyticsCommand = new PutCommand({
      TableName: process.env.TENANT_ANALYTICS_TABLE!,
      Item: {
        pk: `TENANT#${tenantId}`,
        sk: `REPORT#${reportId}`,
        type,
        format,
        status: 'GENERATING',
        projectId,
        analysisId,
        createdAt: now,
        month: now.substring(0, 7), // YYYY-MM format for monthly aggregation
      },
    });

    await ddbDocClient.send(analyticsCommand);

    logger.info('GenerateReportEnhanced mutation completed', {
      reportId,
      tenantId,
      projectId,
      analysisId,
      type,
      format,
      status: report.status,
    });

    return report;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Report ID conflict', { reportId: name });
      throw new Error('Report with this ID already exists');
    }

    logger.error('Error generating report', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      projectId,
      analysisId,
    });
    throw new Error('Failed to generate report');
  }
};

// Export the handler with middleware
export const handler = middy(generateReportEnhanced)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));