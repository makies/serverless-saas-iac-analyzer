/**
 * Get Analysis Query Resolver
 * Retrieves a specific analysis with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface GetAnalysisArgs {
  analysisId: string;
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
  results?: {
    summary: Record<string, any>;
    findings: any[];
    recommendations: any[];
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  createdBy: string;
}

const getAnalysis: AppSyncResolverHandler<GetAnalysisArgs, Analysis | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { analysisId } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];

  logger.info('GetAnalysis query started', {
    userId: (identity as any)?.sub,
    analysisId,
    userTenantId,
    userRole,
  });

  try {
    const command = new GetCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Key: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#METADATA',
      },
    });

    const result = await ddbDocClient.send(command);

    if (!result.Item) {
      logger.warn('Analysis not found', { analysisId });
      return null;
    }

    const analysis = result.Item as Analysis;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && analysis.tenantId !== userTenantId) {
      logger.warn('Access denied to analysis from different tenant', {
        analysisId,
        analysisTenantId: analysis.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot access analysis from different tenant');
    }

    logger.info('GetAnalysis query completed', {
      analysisId,
      tenantId: analysis.tenantId,
      projectId: analysis.projectId,
      status: analysis.status,
    });

    return analysis;

  } catch (error: any) {
    logger.error('Error getting analysis', { 
      error: error instanceof Error ? error.message : String(error), 
      analysisId 
    });
    throw new Error('Failed to get analysis');
  }
};

// Export the handler with middleware
export const handler = middy(getAnalysis)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));