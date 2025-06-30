/**
 * Update Framework Set Mutation Resolver
 * Updates an existing framework configuration set for a tenant
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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

interface UpdateFrameworkSetArgs {
  tenantId: string;
  setName: string;
  description?: string;
  frameworks?: {
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

const updateFrameworkSet: AppSyncResolverHandler<UpdateFrameworkSetArgs, TenantFrameworkConfigItem> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, setName, description, frameworks, isDefault } = args;

  // Verify tenant access (basic tenant isolation)
  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  if (userTenantId && userTenantId !== tenantId) {
    throw new Error('Access denied: Cannot modify other tenant data');
  }

  logger.info('UpdateFrameworkSet mutation started', {
    userId: (identity as any)?.sub,
    tenantId,
    setName,
    hasFrameworks: !!frameworks,
    isDefault,
  });

  try {
    // First, get the existing item to verify it exists
    const getCommand = new GetCommand({
      TableName: process.env.TENANT_FRAMEWORK_CONFIG_TABLE!,
      Key: {
        pk: `TENANT#${tenantId}`,
        sk: `FRAMEWORK_SET#${setName}`,
      },
    });

    const existingResult = await ddbDocClient.send(getCommand);
    if (!existingResult.Item) {
      throw new Error(`Framework set '${setName}' not found`);
    }

    const existingItem = existingResult.Item as TenantFrameworkConfigItem;

    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    // Update description if provided
    if (description !== undefined) {
      updateExpressions.push('#description = :description');
      expressionAttributeNames['#description'] = 'description';
      expressionAttributeValues[':description'] = description;
    }

    // Update frameworks if provided
    if (frameworks !== undefined) {
      updateExpressions.push('#frameworks = :frameworks');
      expressionAttributeNames['#frameworks'] = 'frameworks';
      expressionAttributeValues[':frameworks'] = frameworks;
    }

    // Update isDefault if provided
    if (isDefault !== undefined) {
      updateExpressions.push('#isDefault = :isDefault');
      expressionAttributeNames['#isDefault'] = 'isDefault';
      expressionAttributeValues[':isDefault'] = isDefault;

      // Update GSI keys for default queries
      updateExpressions.push('#GSI1PK = :gsi1pk', '#GSI1SK = :gsi1sk');
      expressionAttributeNames['#GSI1PK'] = 'GSI1PK';
      expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
      expressionAttributeValues[':gsi1pk'] = isDefault ? `TENANT#${tenantId}#DEFAULT` : `TENANT#${tenantId}#CUSTOM`;
      expressionAttributeValues[':gsi1sk'] = `#${isDefault ? 'true' : 'false'}`;
    }

    const updateCommand = new UpdateCommand({
      TableName: process.env.TENANT_FRAMEWORK_CONFIG_TABLE!,
      Key: {
        pk: `TENANT#${tenantId}`,
        sk: `FRAMEWORK_SET#${setName}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(pk)',
    });

    const result = await ddbDocClient.send(updateCommand);
    const updatedItem = result.Attributes as TenantFrameworkConfigItem;

    logger.info('UpdateFrameworkSet mutation completed', {
      tenantId,
      setName,
      configId: updatedItem.configId,
    });

    return updatedItem;

  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Framework set not found', { tenantId, setName });
      throw new Error(`Framework set '${setName}' not found`);
    }

    logger.error('Error updating framework set', { 
      error: error instanceof Error ? error.message : String(error), 
      tenantId, 
      setName 
    });
    throw new Error('Failed to update framework set');
  }
};

// Export the handler with middleware
export const handler = middy(updateFrameworkSet)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));