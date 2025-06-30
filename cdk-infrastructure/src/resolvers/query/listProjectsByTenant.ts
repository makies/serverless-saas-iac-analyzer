/**
 * List Projects By Tenant Query Resolver
 * Lists projects for a specific tenant with proper authorization
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ProjectService' });
const tracer = new Tracer({ serviceName: 'ProjectService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface ListProjectsByTenantArgs {
  tenantId: string;
  limit?: number;
  nextToken?: string;
}

interface Project {
  projectId: string;
  tenantId: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ListProjectsResponse {
  projects: Project[];
  nextToken?: string;
}

const listProjectsByTenant: AppSyncResolverHandler<ListProjectsByTenantArgs, ListProjectsResponse> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, limit = 20, nextToken } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    throw new Error('Access denied: Cannot access projects from different tenant');
  }

  logger.info('ListProjectsByTenant query started', {
    userId: (identity as any)?.sub,
    tenantId,
    userTenantId,
    userRole,
    limit,
    hasNextToken: !!nextToken,
  });

  try {
    const command = new QueryCommand({
      TableName: process.env.PROJECTS_TABLE!,
      IndexName: 'ByTenant',
      KeyConditionExpression: 'tenantId = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
      },
      ScanIndexForward: false, // Sort by createdAt descending
      Limit: limit,
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
    });

    const result = await ddbDocClient.send(command);
    
    const projects = (result.Items || []) as Project[];

    const response: ListProjectsResponse = {
      projects,
      nextToken: result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
    };

    logger.info('ListProjectsByTenant query completed', {
      tenantId,
      projectCount: projects.length,
      hasNextToken: !!response.nextToken,
    });

    return response;

  } catch (error: any) {
    logger.error('Error listing projects by tenant', { 
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      limit,
    });
    throw new Error('Failed to list projects by tenant');
  }
};

// Export the handler with middleware
export const handler = middy(listProjectsByTenant)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));