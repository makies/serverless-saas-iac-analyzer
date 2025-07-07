/**
 * List Frameworks Query Resolver
 * Retrieves available frameworks with filtering and pagination
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
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface ListFrameworksArgs {
  type?: string;
  status?: string;
  limit?: number;
  nextToken?: string;
}

interface Framework {
  frameworkId: string;
  type: string;
  name: string;
  description: string;
  version: string;
  status: string;
  categories: string[];
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface FrameworkConnection {
  items: Framework[];
  nextToken?: string;
}

const listFrameworks: AppSyncResolverHandler<ListFrameworksArgs, FrameworkConnection> = async (event) => {
  const { arguments: args, identity } = event;
  const { type, status, limit = 50, nextToken } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  logger.info('ListFrameworks query started', {
    userId,
    userTenantId,
    userRole,
    filters: { type, status },
    limit,
  });

  try {
    // Build the query
    let keyConditionExpression = 'pk = :pk';
    const expressionAttributeValues: any = {
      ':pk': 'FRAMEWORK',
    };

    // Add filter expression for optional filters
    let filterExpression = '';
    const filterConditions: string[] = [];

    if (type) {
      filterConditions.push('#type = :type');
      expressionAttributeValues[':type'] = type;
    }

    if (status) {
      filterConditions.push('#status = :status');
      expressionAttributeValues[':status'] = status;
    }

    if (filterConditions.length > 0) {
      filterExpression = filterConditions.join(' AND ');
    }

    const queryParams: any = {
      TableName: process.env.FRAMEWORK_REGISTRY_TABLE!,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Math.min(limit, 100), // Cap at 100 items per page
      ScanIndexForward: false, // Most recent frameworks first
    };

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
      queryParams.ExpressionAttributeNames = {
        '#type': 'type',
        '#status': 'status',
      };
    }

    if (nextToken) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
      } catch (error) {
        throw new Error('Invalid pagination token');
      }
    }

    const result = await ddbDocClient.send(new QueryCommand(queryParams));

    const frameworks: Framework[] = (result.Items || []).map(item => ({
      frameworkId: item.frameworkId,
      type: item.type,
      name: item.name,
      description: item.description,
      version: item.version,
      status: item.status,
      categories: item.categories || [],
      metadata: item.metadata || {},
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const response: FrameworkConnection = {
      items: frameworks,
    };

    if (result.LastEvaluatedKey) {
      response.nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    logger.info('ListFrameworks query completed', {
      frameworksCount: frameworks.length,
      hasMore: !!response.nextToken,
      filters: { type, status },
    });

    return response;
  } catch (error: any) {
    logger.error('Error listing frameworks', {
      error: error instanceof Error ? error.message : String(error),
      filters: { type, status },
    });
    throw new Error('Failed to list frameworks');
  }
};

// Export the handler with middleware
export const handler = middy(listFrameworks)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));