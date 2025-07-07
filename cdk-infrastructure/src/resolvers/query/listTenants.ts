/**
 * List Tenants Query Resolver
 * Retrieves a list of tenants with pagination and filtering
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Tenant, ListTenantsArgs } from '../../shared/types/tenant';
import { getAuthContext } from '../../shared/utils/auth';
import { queryItems, scanItems } from '../../shared/utils/dynamodb';
import { handleError, AuthorizationError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'TenantService' });
const tracer = new Tracer({ serviceName: 'TenantService' });

interface ListTenantsResponse {
  tenants: Tenant[];
  nextToken?: string;
  count: number;
}

const listTenants: AppSyncResolverHandler<ListTenantsArgs, ListTenantsResponse> = async (event) => {
  const { arguments: args, identity } = event;
  const { status, limit = 25, nextToken } = args;

  try {
    // Get authentication context
    const authContext = getAuthContext(identity);

    // Authorization check - only SystemAdmin can list all tenants
    if (authContext.role !== 'SystemAdmin') {
      throw new AuthorizationError('Only SystemAdmin can list tenants');
    }

    logger.info('ListTenants query started', {
      userId: authContext.userId,
      status,
      limit,
      userRole: authContext.role,
    });

    let result;

    if (status) {
      // Query by status using GSI
      result = await queryItems<Tenant>(
        process.env.TENANTS_TABLE!,
        '#status = :status',
        {
          indexName: 'ByStatus',
          expressionAttributeNames: {
            '#status': 'status',
          },
          expressionAttributeValues: {
            ':status': status,
          },
          pagination: { limit, nextToken },
          scanIndexForward: false, // Get newest first
        }
      );
    } else {
      // Scan all tenants (use sparingly)
      result = await scanItems<Tenant>(
        process.env.TENANTS_TABLE!,
        {
          pagination: { limit, nextToken },
        }
      );
    }

    logger.info('ListTenants query completed', {
      tenantCount: result.count,
      hasNextToken: !!result.nextToken,
      status,
    });

    return {
      tenants: result.items,
      nextToken: result.nextToken,
      count: result.count,
    };
  } catch (error: any) {
    handleError(error, logger, { status, limit, operation: 'listTenants' });
  }
};

// Export the handler with middleware
export const handler = middy(listTenants)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
