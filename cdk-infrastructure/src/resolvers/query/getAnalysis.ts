/**
 * Get Analysis Query Resolver
 * Retrieves a specific analysis with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Analysis, GetAnalysisArgs } from '../../shared/types/analysis';
import { getAuthContext, canAccessTenant } from '../../shared/utils/auth';
import { getItem } from '../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, NotFoundError, AuthorizationError, ValidationError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

const getAnalysis: AppSyncResolverHandler<GetAnalysisArgs, Analysis | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { analysisId } = args;

  try {
    // Validate input
    validateRequired({ analysisId }, ['analysisId']);
    if (!validateUUID(analysisId)) {
      throw new ValidationError('Invalid analysis ID format');
    }

    // Get authentication context
    const authContext = getAuthContext(identity);

    logger.info('GetAnalysis query started', {
      userId: authContext.userId,
      analysisId,
      userTenantId: authContext.tenantId,
      userRole: authContext.role,
    });

    // Get analysis from DynamoDB
    const analysis = await getItem<Analysis>(
      process.env.ANALYSES_TABLE!,
      { id: analysisId }
    );

    if (!analysis) {
      throw new NotFoundError('Analysis', analysisId);
    }

    // Tenant isolation check
    if (!canAccessTenant(authContext, analysis.tenantId)) {
      throw new AuthorizationError('Cannot access analysis from different tenant');
    }

    // Permission check for analysis read access
    if (!authContext.permissions.includes('analysis:read') && authContext.role !== 'SystemAdmin') {
      throw new AuthorizationError('Insufficient permissions to view analysis');
    }

    logger.info('GetAnalysis query completed', {
      analysisId,
      tenantId: analysis.tenantId,
      projectId: analysis.projectId,
      status: analysis.status,
      type: analysis.type,
      frameworkCount: analysis.configuration.frameworks.length,
    });

    return analysis;
  } catch (error: any) {
    handleError(error, logger, { analysisId, operation: 'getAnalysis' });
  }
};

// Export the handler with middleware
export const handler = middy(getAnalysis)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
