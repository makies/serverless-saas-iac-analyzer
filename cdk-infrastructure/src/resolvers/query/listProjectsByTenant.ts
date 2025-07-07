/**
 * List Projects By Tenant Query Resolver
 * Lists projects for a specific tenant with proper authorization
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Project, ListProjectsByTenantArgs } from '../../shared/types/project';
import { getAuthContext, canAccessTenant } from '../../shared/utils/auth';
import { queryItems } from '../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, AuthorizationError, ValidationError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ProjectService' });
const tracer = new Tracer({ serviceName: 'ProjectService' });

interface ListProjectsResponse {
  projects: Project[];
  nextToken?: string;
  count: number;
}

const listProjectsByTenant: AppSyncResolverHandler<
  ListProjectsByTenantArgs,
  ListProjectsResponse
> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, status, limit = 25, nextToken } = args;

  try {
    // Validate input
    validateRequired({ tenantId }, ['tenantId']);
    if (!validateUUID(tenantId)) {
      throw new ValidationError('Invalid tenant ID format');
    }

    // Get authentication context
    const authContext = getAuthContext(identity);

    // Authorization check
    if (!canAccessTenant(authContext, tenantId)) {
      throw new AuthorizationError('Cannot access projects from different tenant');
    }

    logger.info('ListProjectsByTenant query started', {
      userId: authContext.userId,
      tenantId,
      userTenantId: authContext.tenantId,
      userRole: authContext.role,
      status,
      limit,
      hasNextToken: !!nextToken,
    });

    let result;

    if (status) {
      // Query by tenant and status using composite GSI
      result = await queryItems<Project>(
        process.env.PROJECTS_TABLE!,
        'tenantId = :tenantId AND #status = :status',
        {
          indexName: 'ByTenantAndStatus',
          expressionAttributeNames: {
            '#status': 'status',
          },
          expressionAttributeValues: {
            ':tenantId': tenantId,
            ':status': status,
          },
          pagination: { limit, nextToken },
          scanIndexForward: false, // Get newest first
        }
      );
    } else {
      // Query by tenant only
      result = await queryItems<Project>(
        process.env.PROJECTS_TABLE!,
        'tenantId = :tenantId',
        {
          indexName: 'ByTenant',
          expressionAttributeValues: {
            ':tenantId': tenantId,
          },
          pagination: { limit, nextToken },
          scanIndexForward: false, // Get newest first
        }
      );
    }

    logger.info('ListProjectsByTenant query completed', {
      tenantId,
      projectCount: result.count,
      hasNextToken: !!result.nextToken,
      status,
    });

    return {
      projects: result.items,
      nextToken: result.nextToken,
      count: result.count,
    };
  } catch (error: any) {
    handleError(error, logger, { tenantId, status, limit, operation: 'listProjectsByTenant' });
  }
};

// Export the handler with middleware
export const handler = middy(listProjectsByTenant)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
