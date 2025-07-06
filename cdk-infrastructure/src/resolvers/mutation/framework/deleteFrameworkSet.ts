/**
 * Delete Framework Set Mutation Resolver
 * Deletes a framework configuration set for a tenant
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface DeleteFrameworkSetArgs {
  tenantId: string;
  setName: string;
}

interface DeleteFrameworkSetResult {
  success: boolean;
  message: string;
}

const deleteFrameworkSet: AppSyncResolverHandler<
  DeleteFrameworkSetArgs,
  DeleteFrameworkSetResult
> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, setName } = args;

  // Verify tenant access (basic tenant isolation)
  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  if (userTenantId && userTenantId !== tenantId) {
    throw new Error('Access denied: Cannot modify other tenant data');
  }

  logger.info('DeleteFrameworkSet mutation started', {
    userId: (identity as any)?.sub,
    tenantId,
    setName,
  });

  try {
    // First, get the existing item to verify it exists and check if it's default
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

    const existingItem = existingResult.Item;

    // Prevent deletion of default framework set without replacement
    if (existingItem.isDefault) {
      logger.warn('Attempt to delete default framework set', { tenantId, setName });
      throw new Error(
        'Cannot delete the default framework set. Please set another framework set as default first.'
      );
    }

    // Delete the framework set
    const deleteCommand = new DeleteCommand({
      TableName: process.env.TENANT_FRAMEWORK_CONFIG_TABLE!,
      Key: {
        pk: `TENANT#${tenantId}`,
        sk: `FRAMEWORK_SET#${setName}`,
      },
      ConditionExpression: 'attribute_exists(pk)',
    });

    await ddbDocClient.send(deleteCommand);

    logger.info('DeleteFrameworkSet mutation completed', {
      tenantId,
      setName,
    });

    return {
      success: true,
      message: `Framework set '${setName}' has been deleted successfully`,
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Framework set not found for deletion', { tenantId, setName });
      throw new Error(`Framework set '${setName}' not found`);
    }

    logger.error('Error deleting framework set', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      setName,
    });

    // Re-throw custom errors
    if (
      error instanceof Error &&
      error.message.includes('Cannot delete the default framework set')
    ) {
      throw error;
    }

    throw new Error('Failed to delete framework set');
  }
};

// Export the handler with middleware
export const handler = middy(deleteFrameworkSet)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
