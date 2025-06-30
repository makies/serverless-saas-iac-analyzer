/**
 * Create Framework Set Mutation Resolver
 * Creates a new framework configuration set for a tenant
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';
import { TenantFrameworkConfigItem } from '../../../../lib/config/multi-framework-types';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface CreateFrameworkSetArgs {
  tenantId: string;
  setName: string;
  description?: string;
  frameworks: {
    frameworkId: string;
    version?: string;
    pillars?: string[];
    weight: number;
    enabled: boolean;
    customConfig?: {
      severityWeights?: Record<string, number>;
      excludedRules?: string[];
      customThresholds?: Record<string, number>;
    };
  }[];
  isDefault?: boolean;
}

const createFrameworkSet: AppSyncResolverHandler<CreateFrameworkSetArgs, TenantFrameworkConfigItem> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, setName, description, frameworks, isDefault = false } = args;

  // Verify tenant access (basic tenant isolation)
  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  if (userTenantId && userTenantId !== tenantId) {
    throw new Error('Access denied: Cannot modify other tenant data');
  }

  logger.info('CreateFrameworkSet mutation started', {
    userId: (identity as any)?.sub,
    tenantId,
    setName,
    frameworkCount: frameworks.length,
    isDefault,
  });

  try {
    const now = new Date().toISOString();
    const configId = uuidv4();

    const frameworkSetItem: TenantFrameworkConfigItem = {
      pk: `TENANT#${tenantId}`,
      sk: `FRAMEWORK_SET#${setName}`,
      configId,
      tenantId,
      setName,
      description: description || '',
      frameworks,
      isDefault,
      createdAt: now,
      updatedAt: now,
      createdBy: (identity as any)?.sub || 'system',
      GSI1PK: isDefault ? `TENANT#${tenantId}#DEFAULT` : `TENANT#${tenantId}#CUSTOM`,
      GSI1SK: `#${isDefault ? 'true' : 'false'}`,
    };

    const transactionItems = [];

    // Add the new framework set
    transactionItems.push({
      Put: {
        TableName: process.env.TENANT_FRAMEWORK_CONFIG_TABLE!,
        Item: frameworkSetItem,
        ConditionExpression: 'attribute_not_exists(pk)',
      },
    });

    // If this is set as default, unset other defaults for this tenant
    if (isDefault) {
      // Note: In a real implementation, you would need to query existing defaults first
      // and add update operations to unset them. This is simplified for now.
      logger.info('Setting as default framework set', { tenantId, setName });
    }

    // Execute transaction
    const transactCommand = new TransactWriteCommand({
      TransactItems: transactionItems,
    });

    await ddbDocClient.send(transactCommand);

    logger.info('CreateFrameworkSet mutation completed', {
      tenantId,
      setName,
      configId,
    });

    return frameworkSetItem;

  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Framework set already exists', { tenantId, setName });
      throw new Error(`Framework set '${setName}' already exists for this tenant`);
    }

    logger.error('Error creating framework set', { 
      error: error instanceof Error ? error.message : String(error), 
      tenantId, 
      setName 
    });
    throw new Error('Failed to create framework set');
  }
};

// Export the handler with middleware
export const handler = middy(createFrameworkSet)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));