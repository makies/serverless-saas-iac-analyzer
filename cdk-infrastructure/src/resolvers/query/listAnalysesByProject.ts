/**
 * List Analyses By Project Query Resolver
 * Lists analyses for a specific project with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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

interface ListAnalysesByProjectArgs {
  projectId: string;
  limit?: number;
  nextToken?: string;
}

interface Analysis {
  analysisId: string;
  projectId: string;
  tenantId: string;
  name: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface ListAnalysesResponse {
  analyses: Analysis[];
  nextToken?: string;
}

const listAnalysesByProject: AppSyncResolverHandler<
  ListAnalysesByProjectArgs,
  ListAnalysesResponse
> = async (event) => {
  const { arguments: args, identity } = event;
  const { projectId, limit = 20, nextToken } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];

  logger.info('ListAnalysesByProject query started', {
    userId: (identity as any)?.sub,
    projectId,
    userTenantId,
    userRole,
    limit,
    hasNextToken: !!nextToken,
  });

  try {
    // First verify that the project exists and user has access to it
    const projectCommand = new GetCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: '#METADATA',
      },
    });

    const projectResult = await ddbDocClient.send(projectCommand);

    if (!projectResult.Item) {
      logger.warn('Project not found', { projectId });
      throw new Error('Project not found');
    }

    const project = projectResult.Item;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && project.tenantId !== userTenantId) {
      logger.warn('Access denied to project from different tenant', {
        projectId,
        projectTenantId: project.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot access project from different tenant');
    }

    // Query analyses for the project
    const command = new QueryCommand({
      TableName: process.env.ANALYSES_TABLE!,
      IndexName: 'ByProject',
      KeyConditionExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId,
      },
      ScanIndexForward: false, // Sort by createdAt descending
      Limit: limit,
      ExclusiveStartKey: nextToken
        ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
        : undefined,
    });

    const result = await ddbDocClient.send(command);

    const analyses = (result.Items || []) as Analysis[];

    const response: ListAnalysesResponse = {
      analyses,
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
    };

    logger.info('ListAnalysesByProject query completed', {
      projectId,
      analysisCount: analyses.length,
      hasNextToken: !!response.nextToken,
    });

    return response;
  } catch (error: any) {
    logger.error('Error listing analyses by project', {
      error: error instanceof Error ? error.message : String(error),
      projectId,
      limit,
    });
    throw new Error('Failed to list analyses by project');
  }
};

// Export the handler with middleware
export const handler = middy(listAnalysesByProject)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
