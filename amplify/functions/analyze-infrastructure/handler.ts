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

import type { AnalyzeInfrastructureArgs, AnalyzeInfrastructureResult } from './resource';
import { TenantContext } from '../../shared/utils/tenant-context';
import { InfrastructureAnalyzer } from '../../shared/services/infrastructure-analyzer';
import { WellArchitectedAnalyzer } from '../../shared/services/well-architected-analyzer';
import { AdvancedAnalysisEngine, type AnalysisFramework } from '../../shared/services/advanced-analysis-engine';
import { FindingsProcessor } from '../../shared/services/findings-processor';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'analyze-infrastructure' });
const metrics = new Metrics({ namespace: 'CloudBestPracticeAnalyzer/Analysis' });
const tracer = new Tracer({ serviceName: 'analyze-infrastructure' });

// Initialize AWS clients
const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const s3Client = tracer.captureAWSv3Client(new S3Client({}));
const bedrockClient = tracer.captureAWSv3Client(new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
}));

/**
 * Lambda handler for infrastructure analysis
 */
const lambdaHandler: Handler<AnalyzeInfrastructureArgs, AnalyzeInfrastructureResult> = async (
  event,
  context
) => {
  const { analysisId, projectId, tenantId, infrastructureFiles, analysisType, awsConfig } = event;
  
  // Add custom metrics
  metrics.addDimension('TenantId', tenantId);
  metrics.addDimension('AnalysisType', analysisType);
  
  logger.info('Starting infrastructure analysis', {
    analysisId,
    projectId,
    tenantId,
    analysisType,
    fileCount: infrastructureFiles.length,
  });

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

    // Update analysis status to RUNNING
    await tenantContext.updateAnalysisStatus(analysisId, 'RUNNING', {
      startedAt: new Date().toISOString(),
      executionId: context.awsRequestId,
    });

    // Initialize analyzers
    const infrastructureAnalyzer = new InfrastructureAnalyzer({
      s3Client,
      bucketName: process.env.INFRASTRUCTURE_BUCKET!,
      tenantId,
    });

    const wellArchitectedAnalyzer = new WellArchitectedAnalyzer({
      bedrockClient,
      modelId: process.env.BEDROCK_MODEL_ID!,
      logger: logger as any,
    });

    // Initialize advanced analysis engine with multiple frameworks
    const analysisFrameworks: AnalysisFramework[] = JSON.parse(
      process.env.ANALYSIS_FRAMEWORKS || '["WELL_ARCHITECTED"]'
    );
    
    const advancedAnalysisEngine = new AdvancedAnalysisEngine({
      bedrockClient,
      modelId: process.env.BEDROCK_MODEL_ID!,
      logger: logger as any,
      frameworks: analysisFrameworks,
    });

    const findingsProcessor = new FindingsProcessor({
      dynamoClient,
      tableName: process.env.FINDING_TABLE_NAME!,
      tenantId,
    });

    // Process infrastructure files
    const analysisResults = [];
    let totalResources = 0;
    let totalFindings = 0;

    for (const fileKey of infrastructureFiles) {
      logger.info('Processing infrastructure file', { fileKey });
      
      // Download and parse infrastructure file
      const infraData = await infrastructureAnalyzer.processFile(fileKey, analysisType);
      totalResources += infraData.resources.length;

      // Perform advanced multi-framework analysis
      const advancedFindings = await advancedAnalysisEngine.analyzeInfrastructure(infraData, analysisType);
      
      // Also perform basic Well-Architected analysis for comparison
      const basicFindings = await wellArchitectedAnalyzer.analyze(infraData, analysisType);
      
      // Combine all findings
      const allFindings = [...advancedFindings, ...basicFindings];
      
      // Process and store findings
      await findingsProcessor.storeFindings(analysisId, allFindings);
      totalFindings += allFindings.length;

      analysisResults.push({
        file: fileKey,
        resourceCount: infraData.resources.length,
        findingCount: allFindings.length,
      });

      // Add metrics
      metrics.addMetric('ResourcesProcessed', MetricUnit.Count, infraData.resources.length);
      metrics.addMetric('FindingsGenerated', MetricUnit.Count, allFindings.length);
    }

    // Generate summary statistics
    const findingsSummary = await findingsProcessor.generateSummary(analysisId);
    
    const resultSummary = {
      totalResources,
      totalFindings,
      findingsBySeverity: findingsSummary.bySeverity,
      findingsByPillar: findingsSummary.byPillar,
    };

    // Update analysis status to COMPLETED
    await tenantContext.updateAnalysisStatus(analysisId, 'COMPLETED', {
      completedAt: new Date().toISOString(),
      resultSummary,
    });

    // Send success metrics
    metrics.addMetric('AnalysisCompleted', MetricUnit.Count, 1);
    metrics.addMetric('AnalysisDuration', MetricUnit.Milliseconds, Date.now() - parseInt(context.getRemainingTimeInMillis().toString()));

    logger.info('Infrastructure analysis completed successfully', {
      analysisId,
      totalResources,
      totalFindings,
      duration: Date.now() - parseInt(context.getRemainingTimeInMillis().toString()),
    });

    return {
      success: true,
      analysisId,
      executionId: context.awsRequestId,
      status: 'COMPLETED',
      message: 'Infrastructure analysis completed successfully',
      resultSummary,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logger.error('Infrastructure analysis failed', {
      analysisId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update analysis status to FAILED
    try {
      const tenantContext = new TenantContext(dynamoClient, {
        tenantTableName: process.env.TENANT_TABLE_NAME!,
        projectTableName: process.env.PROJECT_TABLE_NAME!,
      });
      
      await tenantContext.updateAnalysisStatus(analysisId, 'FAILED', {
        failedAt: new Date().toISOString(),
        error: errorMessage,
      });
    } catch (updateError) {
      logger.error('Failed to update analysis status', { updateError });
    }

    // Add error metrics
    metrics.addMetric('AnalysisFailed', MetricUnit.Count, 1);

    return {
      success: false,
      analysisId,
      executionId: context.awsRequestId,
      status: 'FAILED',
      error: errorMessage,
    };
  }
};

// Apply PowerTools middleware
export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics, { captureColdStartMetric: true }))
  .use(injectLambdaContext(logger, { clearState: true }));