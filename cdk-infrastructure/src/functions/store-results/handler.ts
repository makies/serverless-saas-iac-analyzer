/**
 * Store Results Lambda Function
 * Stores analysis results from Step Functions workflow into DynamoDB
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const logger = new Logger({
  serviceName: 'store-results',
  logLevel: (process.env.LOG_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') || 'INFO',
});

interface StoreResultsInput {
  analysisId: string;
  status: string;
  overallScore: number;
  totalFindings: number;
  frameworks: any[];
  aggregatedSummary: any;
  completedAt: string;
  execution: {
    executionArn: string;
    stateMachineArn: string;
  };
}

interface StoreResultsOutput {
  success: boolean;
  message: string;
  analysisId: string;
  recordsStored: number;
  error?: string;
}

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (input: StoreResultsInput): Promise<StoreResultsOutput> => {
  logger.info('Store results started', { 
    analysisId: input.analysisId,
    status: input.status,
    frameworkCount: input.frameworks?.length || 0,
    totalFindings: input.totalFindings
  });

  try {
    let recordsStored = 0;

    // Update analysis metadata with final results
    await updateAnalysisMetadata(input);
    recordsStored++;

    // Store aggregated summary
    await storeAggregatedSummary(input);
    recordsStored++;

    // Store framework summaries
    if (input.frameworks && input.frameworks.length > 0) {
      for (const framework of input.frameworks) {
        await storeFrameworkSummary(input.analysisId, framework);
        recordsStored++;
      }
    }

    // Store execution metadata
    await storeExecutionMetadata(input);
    recordsStored++;

    logger.info('Store results completed successfully', {
      analysisId: input.analysisId,
      recordsStored,
      totalFindings: input.totalFindings,
    });

    return {
      success: true,
      message: `Successfully stored ${recordsStored} records for analysis ${input.analysisId}`,
      analysisId: input.analysisId,
      recordsStored,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Store results failed', { 
      analysisId: input.analysisId,
      error: errorMessage 
    });

    return {
      success: false,
      message: `Failed to store results for analysis ${input.analysisId}`,
      analysisId: input.analysisId,
      recordsStored: 0,
      error: errorMessage,
    };
  }
};

async function updateAnalysisMetadata(input: StoreResultsInput): Promise<void> {
  try {
    const updateExpression = [
      'SET #status = :status',
      '#completedAt = :completedAt',
      '#totalFindings = :totalFindings',
      '#overallScore = :overallScore',
      '#updatedAt = :updatedAt'
    ];

    const expressionAttributeNames = {
      '#status': 'status',
      '#completedAt': 'completedAt',
      '#totalFindings': 'totalFindings',
      '#overallScore': 'overallScore',
      '#updatedAt': 'updatedAt',
    };

    const expressionAttributeValues = {
      ':status': input.status,
      ':completedAt': input.completedAt,
      ':totalFindings': input.totalFindings,
      ':overallScore': input.overallScore,
      ':updatedAt': new Date().toISOString(),
    };

    await dynamodb.send(new UpdateCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Key: {
        pk: `ANALYSIS#${input.analysisId}`,
        sk: '#METADATA',
      },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    logger.debug('Analysis metadata updated', { 
      analysisId: input.analysisId,
      status: input.status 
    });
  } catch (error) {
    logger.error('Failed to update analysis metadata', { 
      analysisId: input.analysisId,
      error 
    });
    throw error;
  }
}

async function storeAggregatedSummary(input: StoreResultsInput): Promise<void> {
  try {
    await dynamodb.send(new PutCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Item: {
        pk: `ANALYSIS#${input.analysisId}`,
        sk: '#SUMMARY',
        analysisId: input.analysisId,
        type: 'AGGREGATED_SUMMARY',
        summary: input.aggregatedSummary,
        completedAt: input.completedAt,
        overallScore: input.overallScore,
        totalFindings: input.totalFindings,
        createdAt: new Date().toISOString(),
      },
    }));

    logger.debug('Aggregated summary stored', { analysisId: input.analysisId });
  } catch (error) {
    logger.error('Failed to store aggregated summary', { 
      analysisId: input.analysisId,
      error 
    });
    throw error;
  }
}

async function storeFrameworkSummary(analysisId: string, framework: any): Promise<void> {
  try {
    await dynamodb.send(new PutCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Item: {
        pk: `ANALYSIS#${analysisId}`,
        sk: `FRAMEWORK_SUMMARY#${framework.frameworkId}`,
        analysisId,
        frameworkId: framework.frameworkId,
        frameworkName: framework.frameworkName,
        frameworkType: framework.frameworkType,
        type: 'FRAMEWORK_SUMMARY',
        status: framework.status,
        startTime: framework.startTime,
        endTime: framework.endTime,
        duration: framework.duration,
        summary: framework.summary,
        findingsCount: framework.findings?.length || 0,
        error: framework.error,
        createdAt: new Date().toISOString(),
      },
    }));

    logger.debug('Framework summary stored', { 
      analysisId,
      frameworkId: framework.frameworkId 
    });
  } catch (error) {
    logger.error('Failed to store framework summary', { 
      analysisId,
      frameworkId: framework.frameworkId,
      error 
    });
    throw error;
  }
}

async function storeExecutionMetadata(input: StoreResultsInput): Promise<void> {
  try {
    await dynamodb.send(new PutCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Item: {
        pk: `ANALYSIS#${input.analysisId}`,
        sk: '#EXECUTION',
        analysisId: input.analysisId,
        type: 'EXECUTION_METADATA',
        executionArn: input.execution.executionArn,
        stateMachineArn: input.execution.stateMachineArn,
        completedAt: input.completedAt,
        storedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    }));

    logger.debug('Execution metadata stored', { analysisId: input.analysisId });
  } catch (error) {
    logger.error('Failed to store execution metadata', { 
      analysisId: input.analysisId,
      error 
    });
    throw error;
  }
}