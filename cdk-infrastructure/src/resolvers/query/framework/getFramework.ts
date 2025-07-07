/**
 * Get Framework Query Resolver
 * Retrieves a specific framework by ID with rules and metadata
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Framework, GetFrameworkArgs } from '../../../shared/types/framework';
import { getAuthContext } from '../../../shared/utils/auth';
import { getItem, queryItems } from '../../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, NotFoundError, ValidationError } from '../../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

const getFramework: AppSyncResolverHandler<GetFrameworkArgs, Framework | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { frameworkId } = args;

  try {
    // Validate input
    validateRequired({ frameworkId }, ['frameworkId']);
    if (!validateUUID(frameworkId)) {
      throw new ValidationError('Invalid framework ID format');
    }

    // Get authentication context (frameworks are readable by all authenticated users)
    const authContext = getAuthContext(identity);

    logger.info('GetFramework query started', {
      userId: authContext.userId,
      frameworkId,
      userTenantId: authContext.tenantId,
      userRole: authContext.role,
    });

    // Get framework from DynamoDB
    const framework = await getItem<Framework>(
      process.env.FRAMEWORK_REGISTRY_TABLE!,
      { id: frameworkId }
    );

    if (!framework) {
      throw new NotFoundError('Framework', frameworkId);
    }

    logger.info('GetFramework query completed', {
      frameworkId,
      name: framework.name,
      type: framework.type,
      version: framework.version,
      rulesCount: framework.rules.length,
      pillarsCount: framework.pillars.length,
      status: framework.status,
    });

    return framework;
  } catch (error: any) {
    handleError(error, logger, { frameworkId, operation: 'getFramework' });
  }
};

// Export the handler with middleware
export const handler = middy(getFramework)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));