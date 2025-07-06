/**
 * Get Tenant Query Resolver
 * Retrieves a specific tenant by ID with proper authorization
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
const logger = new Logger({ serviceName: 'TenantService' });
const tracer = new Tracer({ serviceName: 'TenantService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface GetTenantArgs {
  tenantId: string;
}

interface Tenant {
  tenantId: string;
  companyName: string;
  status: string;
  subscription: {
    tier: string;
    maxProjects: number;
    maxUsers: number;
    features: string[];
  };
  contact: {
    name: string;
    email: string;
    phone?: string;
  };
  settings: {
    defaultTimeZone: string;
    defaultLanguage: string;
  };
  createdAt: string;
  updatedAt: string;
}

const getTenant: AppSyncResolverHandler<GetTenantArgs, Tenant | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId } = args;

  // Authorization check - users can only access their own tenant data
  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];

  // SystemAdmin can access any tenant, others can only access their own
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    throw new Error('Access denied: Cannot access other tenant data');
  }

  logger.info('GetTenant query started', {
    userId: (identity as any)?.sub,
    tenantId,
    userTenantId,
    userRole,
  });

  try {
    const command = new GetCommand({
      TableName: process.env.TENANTS_TABLE!,
      Key: {
        pk: `TENANT#${tenantId}`,
        sk: '#METADATA',
      },
    });

    const result = await ddbDocClient.send(command);

    if (!result.Item) {
      logger.warn('Tenant not found', { tenantId });
      return null;
    }

    const tenant = result.Item as Tenant;

    logger.info('GetTenant query completed', {
      tenantId,
      companyName: tenant.companyName,
    });

    return tenant;
  } catch (error: any) {
    logger.error('Error getting tenant', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
    });
    throw new Error('Failed to get tenant');
  }
};

// Export the handler with middleware
export const handler = middy(getTenant)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
