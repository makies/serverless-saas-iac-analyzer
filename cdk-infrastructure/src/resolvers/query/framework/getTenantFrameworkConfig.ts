/**
 * Get Tenant Framework Config Query Resolver
 * Returns framework configuration for a specific tenant
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { TenantFrameworkConfigItem } from '../../../../lib/config/multi-framework-types';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface GetTenantFrameworkConfigArgs {
  tenantId: string;
  setName?: string;
}

interface GetTenantFrameworkConfigResult {
  items: TenantFrameworkConfigItem[];
  defaultSet?: TenantFrameworkConfigItem;
}

const getTenantFrameworkConfig: AppSyncResolverHandler<GetTenantFrameworkConfigArgs, GetTenantFrameworkConfigResult> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, setName } = args;

  // Verify tenant access (basic tenant isolation)
  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  if (userTenantId && userTenantId !== tenantId) {
    throw new Error('Access denied: Cannot access other tenant data');
  }

  logger.info('GetTenantFrameworkConfig query started', {
    userId: (identity as any)?.sub,
    tenantId,
    setName,
  });

  try {
    if (setName) {
      // Get specific framework set
      const command = new GetCommand({
        TableName: process.env.TENANT_FRAMEWORK_CONFIG_TABLE!,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `FRAMEWORK_SET#${setName}`,
        },
      });

      const result = await ddbDocClient.send(command);
      const item = result.Item as TenantFrameworkConfigItem;

      if (!item) {
        logger.info('Framework set not found', { tenantId, setName });
        return { items: [] };
      }

      return { items: [item] };

    } else {
      // Get all framework sets for tenant
      const queryCommand = new QueryCommand({
        TableName: process.env.TENANT_FRAMEWORK_CONFIG_TABLE!,
        KeyConditionExpression: 'pk = :tenantPK',
        ExpressionAttributeValues: {
          ':tenantPK': `TENANT#${tenantId}`,
        },
        ScanIndexForward: true,
      });

      const result = await ddbDocClient.send(queryCommand);
      const items = (result.Items || []) as TenantFrameworkConfigItem[];

      // Find default set
      const defaultSet = items.find(item => item.isDefault);

      logger.info('GetTenantFrameworkConfig query completed', {
        tenantId,
        itemCount: items.length,
        hasDefault: !!defaultSet,
      });

      return {
        items,
        defaultSet,
      };
    }

  } catch (error) {
    logger.error('Error getting tenant framework config', { 
      error: error instanceof Error ? error.message : String(error), 
      tenantId, 
      setName 
    });
    throw new Error('Failed to get tenant framework configuration');
  }
};

// Export the handler with middleware
export const handler = middy(getTenantFrameworkConfig)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));