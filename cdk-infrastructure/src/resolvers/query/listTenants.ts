/**
 * List Tenants Query Resolver
 * Lists all tenants - restricted to SystemAdmin only
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'TenantService' });
const tracer = new Tracer({ serviceName: 'TenantService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface ListTenantsArgs {
  limit?: number;
  nextToken?: string;
}

interface Tenant {
  tenantId: string;
  companyName: string;
  status: string;
  subscription: {
    tier: string;
    maxProjects: number;
    maxUsers: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface ListTenantsResponse {
  tenants: Tenant[];
  nextToken?: string;
}

const listTenants: AppSyncResolverHandler<ListTenantsArgs, ListTenantsResponse> = async (event) => {
  const { arguments: args, identity } = event;
  const { limit = 20, nextToken } = args;

  // Authorization check - only SystemAdmin can list all tenants
  const userRole = (identity as any)?.claims?.['custom:role'];
  
  if (userRole !== 'SystemAdmin') {
    throw new Error('Access denied: Only SystemAdmin can list all tenants');
  }

  logger.info('ListTenants query started', {
    userId: (identity as any)?.sub,
    userRole,
    limit,
    hasNextToken: !!nextToken,
  });

  try {
    const command = new ScanCommand({
      TableName: process.env.TENANTS_TABLE!,
      FilterExpression: 'sk = :skValue',
      ExpressionAttributeValues: {
        ':skValue': '#METADATA',
      },
      Limit: limit,
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
    });

    const result = await ddbDocClient.send(command);
    
    const tenants = (result.Items || []) as Tenant[];

    const response: ListTenantsResponse = {
      tenants,
      nextToken: result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
    };

    logger.info('ListTenants query completed', {
      tenantCount: tenants.length,
      hasNextToken: !!response.nextToken,
    });

    return response;

  } catch (error: any) {
    logger.error('Error listing tenants', { 
      error: error instanceof Error ? error.message : String(error),
      limit,
    });
    throw new Error('Failed to list tenants');
  }
};

// Export the handler with middleware
export const handler = middy(listTenants)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));