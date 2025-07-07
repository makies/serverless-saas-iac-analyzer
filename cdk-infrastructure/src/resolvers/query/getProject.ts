/**
 * Get Project Query Resolver
 * Retrieves a specific project with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Project, GetProjectArgs } from '../../shared/types/project';
import { getAuthContext, canAccessTenant } from '../../shared/utils/auth';
import { getItem } from '../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, NotFoundError, AuthorizationError, ValidationError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ProjectService' });
const tracer = new Tracer({ serviceName: 'ProjectService' });



const getProject: AppSyncResolverHandler<GetProjectArgs, Project | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { projectId } = args;

  try {
    // Validate input
    validateRequired({ projectId }, ['projectId']);
    if (!validateUUID(projectId)) {
      throw new ValidationError('Invalid project ID format');
    }

    // Get authentication context
    const authContext = getAuthContext(identity);

    logger.info('GetProject query started', {
      userId: authContext.userId,
      projectId,
      userTenantId: authContext.tenantId,
      userRole: authContext.role,
    });

    // Get project from DynamoDB
    const project = await getItem<Project>(
      process.env.PROJECTS_TABLE!,
      { id: projectId }
    );

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // Tenant isolation check
    if (!canAccessTenant(authContext, project.tenantId)) {
      throw new AuthorizationError('Cannot access project from different tenant');
    }

    logger.info('GetProject query completed', {
      projectId,
      tenantId: project.tenantId,
      projectName: project.name,
    });

    return project;
  } catch (error: any) {
    handleError(error, logger, { projectId, operation: 'getProject' });
  }
};

// Export the handler with middleware
export const handler = middy(getProject)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
