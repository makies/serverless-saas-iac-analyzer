/**
 * Framework Analysis Lambda Function
 * Executes multi-framework analysis as part of the Step Functions workflow
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { FrameworkExecutionEngine, FrameworkRegistry, MultiFrameworkAnalysisResult } from '../../shared/framework-engine';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const logger = new Logger({
  serviceName: 'framework-analysis',
  logLevel: (process.env.LOG_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') || 'INFO',
});

interface AnalysisInput {
  analysisId: string;
  tenantId: string;
  projectId: string;
  frameworks: string[];
  resourcesS3Key?: string;
  resources?: any[];
  settings?: {
    parallelExecution?: boolean;
    timeout?: number;
    strictMode?: boolean;
  };
}

interface AnalysisOutput {
  analysisId: string;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  result: MultiFrameworkAnalysisResult;
  error?: string;
}

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

export const handler = async (input: AnalysisInput): Promise<AnalysisOutput> => {
  logger.info('Framework analysis started', { 
    analysisId: input.analysisId,
    tenantId: input.tenantId,
    frameworks: input.frameworks 
  });

  try {
    // Update analysis status to RUNNING
    await updateAnalysisStatus(input.analysisId, 'RUNNING', {
      startTime: new Date().toISOString(),
      frameworks: input.frameworks,
    });

    // Load resources
    const resources = await loadResources(input);
    logger.info('Resources loaded', { 
      analysisId: input.analysisId,
      resourceCount: resources.length 
    });

    // Validate frameworks are available for tenant
    await validateFrameworks(input.tenantId, input.frameworks);

    // Execute multi-framework analysis
    const executionEngine = new FrameworkExecutionEngine(logger);
    const result = await executionEngine.executeMultiFrameworkAnalysis(
      input.tenantId,
      input.projectId,
      input.analysisId,
      input.frameworks,
      resources
    );

    // Save analysis results
    await saveAnalysisResults(input.analysisId, result);

    // Update analysis status
    await updateAnalysisStatus(input.analysisId, result.status, {
      endTime: result.endTime,
      duration: result.duration,
      totalFindings: result.aggregatedSummary.totalFindings,
      overallScore: result.aggregatedSummary.overallScore,
    });

    logger.info('Framework analysis completed', {
      analysisId: input.analysisId,
      status: result.status,
      frameworks: result.frameworks.length,
      totalFindings: result.aggregatedSummary.totalFindings,
    });

    return {
      analysisId: input.analysisId,
      status: result.status as 'COMPLETED' | 'FAILED' | 'PARTIAL',
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Framework analysis failed', { 
      analysisId: input.analysisId,
      error: errorMessage 
    });

    // Update analysis status to FAILED
    await updateAnalysisStatus(input.analysisId, 'FAILED', {
      endTime: new Date().toISOString(),
      error: errorMessage,
    });

    return {
      analysisId: input.analysisId,
      status: 'FAILED',
      result: {
        analysisId: input.analysisId,
        tenantId: input.tenantId,
        projectId: input.projectId,
        status: 'FAILED',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 0,
        frameworks: [],
        aggregatedSummary: {
          totalFrameworks: 0,
          completedFrameworks: 0,
          failedFrameworks: 0,
          totalFindings: 0,
          findingsBySeverity: {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
            INFORMATIONAL: 0,
          },
          findingsByCategory: {},
          findingsByPillar: {
            OPERATIONAL_EXCELLENCE: 0,
            SECURITY: 0,
            RELIABILITY: 0,
            PERFORMANCE_EFFICIENCY: 0,
            COST_OPTIMIZATION: 0,
            SUSTAINABILITY: 0,
          },
          overallScore: 0,
          frameworkScores: {},
          recommendations: [],
        },
        metadata: { error: errorMessage },
      },
      error: errorMessage,
    };
  }
};

async function loadResources(input: AnalysisInput): Promise<any[]> {
  // If resources are provided directly, use them
  if (input.resources && input.resources.length > 0) {
    return input.resources;
  }

  // If S3 key is provided, load from S3
  if (input.resourcesS3Key) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.APPLICATION_DATA_BUCKET!,
        Key: input.resourcesS3Key,
      });

      const response = await s3Client.send(command);
      const resourcesData = await response.Body?.transformToString();
      
      if (!resourcesData) {
        throw new Error('Failed to read resources from S3');
      }

      return JSON.parse(resourcesData);
    } catch (error) {
      logger.error('Failed to load resources from S3', { 
        s3Key: input.resourcesS3Key,
        error 
      });
      throw new Error(`Failed to load resources from S3: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // No resources provided
  throw new Error('No resources provided for analysis');
}

async function validateFrameworks(tenantId: string, frameworkIds: string[]): Promise<void> {
  const registry = new FrameworkRegistry(logger);

  for (const frameworkId of frameworkIds) {
    // Check if framework exists
    const framework = await registry.getFramework(frameworkId);
    if (!framework) {
      throw new Error(`Framework not found: ${frameworkId}`);
    }

    // Check if tenant has configuration for this framework
    const tenantConfig = await registry.getTenantFrameworkConfig(tenantId, frameworkId);
    if (!tenantConfig) {
      throw new Error(`Tenant configuration not found for framework: ${frameworkId}`);
    }

    logger.debug('Framework validated', { 
      frameworkId,
      frameworkName: framework.name,
      enabledRules: tenantConfig.enabledRules.length 
    });
  }
}

async function saveAnalysisResults(
  analysisId: string,
  result: MultiFrameworkAnalysisResult
): Promise<void> {
  try {
    // Save aggregated results
    await dynamodb.send(new PutCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Item: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#RESULTS',
        analysisId,
        tenantId: result.tenantId,
        projectId: result.projectId,
        status: result.status,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.duration,
        aggregatedSummary: result.aggregatedSummary,
        metadata: result.metadata,
        createdAt: new Date().toISOString(),
      },
    }));

    // Save individual framework results
    for (const frameworkResult of result.frameworks) {
      await dynamodb.send(new PutCommand({
        TableName: process.env.ANALYSES_TABLE!,
        Item: {
          pk: `ANALYSIS#${analysisId}`,
          sk: `FRAMEWORK#${frameworkResult.frameworkId}`,
          analysisId,
          frameworkId: frameworkResult.frameworkId,
          frameworkName: frameworkResult.frameworkName,
          frameworkType: frameworkResult.frameworkType,
          status: frameworkResult.status,
          startTime: frameworkResult.startTime,
          endTime: frameworkResult.endTime,
          duration: frameworkResult.duration,
          summary: frameworkResult.summary,
          error: frameworkResult.error,
          createdAt: new Date().toISOString(),
        },
      }));
    }

    // Save individual findings
    for (const frameworkResult of result.frameworks) {
      for (const finding of frameworkResult.findings) {
        await dynamodb.send(new PutCommand({
          TableName: process.env.FINDINGS_TABLE!,
          Item: {
            pk: `ANALYSIS#${analysisId}`,
            sk: `FINDING#${finding.id}`,
            analysisId,
            findingId: finding.id,
            frameworkId: frameworkResult.frameworkId,
            ruleId: finding.ruleId,
            ruleName: finding.ruleName,
            severity: finding.severity,
            category: finding.category,
            pillar: finding.pillar,
            title: finding.title,
            description: finding.description,
            resource: finding.resource,
            remediation: finding.remediation,
            references: finding.references,
            metadata: finding.metadata,
            createdAt: new Date().toISOString(),
          },
        }));
      }
    }

    logger.info('Analysis results saved', {
      analysisId,
      frameworkResults: result.frameworks.length,
      totalFindings: result.aggregatedSummary.totalFindings,
    });
  } catch (error) {
    logger.error('Failed to save analysis results', { analysisId, error });
    throw new Error(`Failed to save analysis results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function updateAnalysisStatus(
  analysisId: string,
  status: string,
  additionalData: Record<string, any> = {}
): Promise<void> {
  try {
    const updateExpression = ['SET #status = :status, #updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    };

    // Add additional data to update
    Object.entries(additionalData).forEach(([key, value]) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = value;
    });

    await dynamodb.send(new UpdateCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Key: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#METADATA',
      },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    logger.debug('Analysis status updated', { analysisId, status, additionalData });
  } catch (error) {
    logger.error('Failed to update analysis status', { analysisId, status, error });
    // Don't throw here as it's not critical to the main analysis flow
  }
}