/**
 * Get Framework Query Resolver
 * Returns a specific framework by ID and type
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { FrameworkRegistryItem } from '../../../../lib/config/multi-framework-types';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface GetFrameworkArgs {
  frameworkType: string;
  frameworkId: string;
}

const getFramework: AppSyncResolverHandler<GetFrameworkArgs, FrameworkRegistryItem | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { frameworkType, frameworkId } = args;

  logger.info('GetFramework query started', {
    userId: (identity as any)?.sub,
    frameworkType,
    frameworkId,
  });

  try {
    const command = new GetCommand({
      TableName: process.env.FRAMEWORK_REGISTRY_TABLE!,
      Key: {
        pk: `FRAMEWORK#${frameworkType}`,
        sk: `#${frameworkId}`,
      },
    });

    const result = await ddbDocClient.send(command);

    if (!result.Item) {
      logger.info('Framework not found', { frameworkType, frameworkId });
      return null;
    }

    const framework = result.Item as FrameworkRegistryItem;

    logger.info('GetFramework query completed', {
      frameworkId: framework.frameworkId,
      name: framework.name,
      status: framework.status,
    });

    return framework;

  } catch (error) {
    logger.error('Error getting framework', { error, frameworkType, frameworkId });
    throw new Error('Failed to get framework');
  }
};

// Export the handler with middleware
export const handler = middy(getFramework)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));