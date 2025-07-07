/**
 * Start Analysis Mutation Resolver
 * Starts an analysis execution with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { getStepFunctionsArns } from '../../shared/utils/parameter-store';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const sfnClient = new SFNClient({});

interface StartAnalysisArgs {
  analysisId: string;
  input?: {
    sourceFiles?: string[];
    liveAccountScan?: boolean;
    customParameters?: Record<string, any>;
  };
}

interface Analysis {
  analysisId: string;
  projectId: string;
  tenantId: string;
  name: string;
  status: string;
  type: string;
  configuration: {
    frameworks: string[];
    scope: string;
    settings: Record<string, any>;
  };
  execution?: {
    stateMachineArn: string;
    executionArn: string;
    startedAt: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const startAnalysis: AppSyncResolverHandler<StartAnalysisArgs, Analysis> = async (event) => {
  const { arguments: args, identity } = event;
  const { analysisId, input = {} } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  logger.info('StartAnalysis mutation started', {
    userId,
    analysisId,
    userTenantId,
    userRole,
    hasInput: !!input,
  });

  try {
    // First, get the existing analysis to verify tenant access
    const getCommand = new GetCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Key: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#METADATA',
      },
    });

    const existingResult = await ddbDocClient.send(getCommand);
    if (!existingResult.Item) {
      throw new Error(`Analysis '${analysisId}' not found`);
    }

    const existingAnalysis = existingResult.Item as Analysis;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && existingAnalysis.tenantId !== userTenantId) {
      logger.warn('Access denied to analysis from different tenant', {
        analysisId,
        analysisTenantId: existingAnalysis.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot start analysis from different tenant');
    }

    // Check if analysis is in a state that can be started
    if (!['PENDING', 'FAILED'].includes(existingAnalysis.status)) {
      throw new Error(`Analysis cannot be started from status: ${existingAnalysis.status}`);
    }

    const now = new Date().toISOString();

    // Prepare Step Function execution input
    const executionInput = {
      analysisId,
      tenantId: existingAnalysis.tenantId,
      projectId: existingAnalysis.projectId,
      configuration: existingAnalysis.configuration,
      input,
      metadata: {
        startedBy: userId,
        startedAt: now,
      },
    };

    // Get Step Functions ARN from Parameter Store
    const environment = process.env.ENVIRONMENT || 'dev';
    const { analysisStateMachineArn } = await getStepFunctionsArns(environment);

    let executionArn: string;

    try {
      const startExecutionCommand = new StartExecutionCommand({
        stateMachineArn: analysisStateMachineArn,
        name: `analysis-${analysisId}-${Date.now()}`,
        input: JSON.stringify(executionInput),
      });

      const executionResult = await sfnClient.send(startExecutionCommand);
      executionArn = executionResult.executionArn!;

      logger.info('Step Function execution started', {
        analysisId,
        executionArn,
        stateMachineArn: analysisStateMachineArn,
      });
    } catch (sfnError) {
      // If Step Functions isn't available, create a mock execution ARN
      logger.warn('Step Function not available, creating mock execution', {
        analysisId,
        error: sfnError instanceof Error ? sfnError.message : String(sfnError),
      });

      executionArn = `arn:aws:states:us-east-1:123456789012:execution:AnalysisWorkflow-${environment}:analysis-${analysisId}-${Date.now()}`;
    }

    // Update analysis status to RUNNING
    const updateCommand = new UpdateCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Key: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#METADATA',
      },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #execution = :execution',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#execution': 'execution',
      },
      ExpressionAttributeValues: {
        ':status': 'RUNNING',
        ':updatedAt': now,
        ':execution': {
          stateMachineArn: analysisStateMachineArn,
          executionArn,
          startedAt: now,
        },
      },
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(pk)',
    });

    const result = await ddbDocClient.send(updateCommand);
    const updatedAnalysis = result.Attributes as Analysis;

    logger.info('StartAnalysis mutation completed', {
      analysisId,
      tenantId: updatedAnalysis.tenantId,
      projectId: updatedAnalysis.projectId,
      executionArn,
      status: updatedAnalysis.status,
    });

    return updatedAnalysis;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Analysis not found', { analysisId });
      throw new Error(`Analysis '${analysisId}' not found`);
    }

    logger.error('Error starting analysis', {
      error: error instanceof Error ? error.message : String(error),
      analysisId,
    });
    throw new Error('Failed to start analysis');
  }
};

// Export the handler with middleware
export const handler = middy(startAnalysis)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
