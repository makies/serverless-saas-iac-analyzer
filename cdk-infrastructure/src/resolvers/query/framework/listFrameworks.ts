/**
 * List Frameworks Query Resolver
 * Returns available frameworks based on status filter
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { FRAMEWORK_STATUS } from '../../../../lib/config/constants';
import { FrameworkRegistryItem } from '../../../../lib/config/multi-framework-types';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface ListFrameworksArgs {
  status?: string;
  frameworkType?: string;
  limit?: number;
  nextToken?: string;
}

interface ListFrameworksResult {
  items: FrameworkRegistryItem[];
  nextToken?: string;
}

const listFrameworks: AppSyncResolverHandler<ListFrameworksArgs, ListFrameworksResult> = async (event) => {
  const { arguments: args, identity } = event;
  const { status = FRAMEWORK_STATUS.ACTIVE, frameworkType, limit = 20, nextToken } = args;

  logger.info('ListFrameworks query started', {
    userId: (identity as any)?.sub,
    arguments: args,
  });

  try {
    let queryParams: any;

    if (status) {
      // Query by status using GSI
      queryParams = {
        TableName: process.env.FRAMEWORK_REGISTRY_TABLE!,
        IndexName: 'ByStatus',
        KeyConditionExpression: 'GSI1PK = :statusPK',
        ExpressionAttributeValues: {
          ':statusPK': `STATUS#${status}`,
        },
        Limit: limit,
        ScanIndexForward: true,
      };

      // Add framework type filter if specified
      if (frameworkType) {
        queryParams.FilterExpression = 'frameworkType = :frameworkType';
        queryParams.ExpressionAttributeValues[':frameworkType'] = frameworkType;
      }
    } else {
      // Scan all frameworks
      queryParams = {
        TableName: process.env.FRAMEWORK_REGISTRY_TABLE!,
        FilterExpression: frameworkType ? 'frameworkType = :frameworkType' : undefined,
        ExpressionAttributeValues: frameworkType ? { ':frameworkType': frameworkType } : undefined,
        Limit: limit,
      };
    }

    // Add pagination
    if (nextToken) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const command = new QueryCommand(queryParams);
    const result = await ddbDocClient.send(command);

    const items = (result.Items || []) as FrameworkRegistryItem[];

    // Create next token if there are more items
    const responseNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    logger.info('ListFrameworks query completed', {
      itemCount: items.length,
      hasNextToken: !!responseNextToken,
    });

    return {
      items,
      nextToken: responseNextToken,
    };

  } catch (error) {
    logger.error('Error listing frameworks', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to list frameworks');
  }
};

// Export the handler with middleware
export const handler = middy(listFrameworks)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));