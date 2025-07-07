/**
 * Get Tenant Query Resolver
 * Retrieves a specific tenant by ID with proper authorization
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Tenant, GetTenantArgs } from '../../shared/types/tenant';
import { getAuthContext, canAccessTenant } from '../../shared/utils/auth';
import { getItem } from '../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, NotFoundError, AuthorizationError, ValidationError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'TenantService' });
const tracer = new Tracer({ serviceName: 'TenantService' });

const getTenant: AppSyncResolverHandler<GetTenantArgs, Tenant | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId } = args;

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
      throw new AuthorizationError('Cannot access other tenant data');
    }

    logger.info('GetTenant query started', {
      userId: authContext.userId,
      tenantId,
      userTenantId: authContext.tenantId,
      userRole: authContext.role,
    });

    // Get tenant from DynamoDB
    const tenant = await getItem<Tenant>(
      process.env.TENANTS_TABLE!,
      { id: tenantId }
    );

    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    logger.info('GetTenant query completed', {
      tenantId,
      tenantName: tenant.name,
      status: tenant.status,
    });

    return tenant;
  } catch (error: any) {
    handleError(error, logger, { tenantId, operation: 'getTenant' });
  }
};

// Export the handler with middleware
export const handler = middy(getTenant)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
