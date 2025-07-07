/**
 * List Frameworks Query Resolver
 * Retrieves available frameworks with filtering and pagination
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Framework, ListFrameworksArgs } from '../../../shared/types/framework';
import { getAuthContext } from '../../../shared/utils/auth';
import { queryItems } from '../../../shared/utils/dynamodb';
import { handleError, validateRequired } from '../../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

interface FrameworkConnection {
  items: Framework[];
  nextToken?: string;
  count: number;
}

const listFrameworks: AppSyncResolverHandler<ListFrameworksArgs, FrameworkConnection> = async (event) => {
  const { arguments: args, identity } = event;
  const { type, status, category, limit = 50, nextToken } = args;

  try {
    // Get authentication context (frameworks are readable by all authenticated users)
    const authContext = getAuthContext(identity);

    logger.info('ListFrameworks query started', {
      userId: authContext.userId,
      userTenantId: authContext.tenantId,
      userRole: authContext.role,
      filters: { type, status, category },
      limit,
    });

    let result;
    const maxLimit = Math.min(limit || 50, 100); // Cap at 100 items per page

    if (type || status || category) {
      // Use filter expression for flexible filtering
      const filterConditions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      if (type) {
        filterConditions.push('#type = :type');
        expressionAttributeNames['#type'] = 'type';
        expressionAttributeValues[':type'] = type;
      }

      if (status) {
        filterConditions.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = status;
      }

      if (category) {
        filterConditions.push('contains(categories, :category)');
        expressionAttributeValues[':category'] = category;
      }

      // Query all frameworks and filter
      result = await queryItems<Framework>(
        process.env.FRAMEWORK_REGISTRY_TABLE!,
        'pk = :pk',
        {
          expressionAttributeValues: {
            ':pk': 'FRAMEWORK',
            ...expressionAttributeValues,
          },
          filterExpression: filterConditions.join(' AND '),
          expressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
          pagination: { limit: maxLimit, nextToken },
          scanIndexForward: false, // Most recent frameworks first
        }
      );
    } else {
      // Query all frameworks without filters
      result = await queryItems<Framework>(
        process.env.FRAMEWORK_REGISTRY_TABLE!,
        'pk = :pk',
        {
          expressionAttributeValues: {
            ':pk': 'FRAMEWORK',
          },
          pagination: { limit: maxLimit, nextToken },
          scanIndexForward: false, // Most recent frameworks first
        }
      );
    }

    logger.info('ListFrameworks query completed', {
      frameworksCount: result.count,
      hasMore: !!result.nextToken,
      filters: { type, status, category },
    });

    return {
      items: result.items,
      nextToken: result.nextToken,
      count: result.count,
    };
  } catch (error: any) {
    handleError(error, logger, { type, status, category, limit, operation: 'listFrameworks' });
  }
};

// Export the handler with middleware
export const handler = middy(listFrameworks)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));