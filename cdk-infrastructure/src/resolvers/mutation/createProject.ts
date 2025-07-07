/**
 * Create Project Mutation Resolver
 * Creates a new project with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';

// Import shared utilities and types
import { Project, CreateProjectArgs } from '../../shared/types/project';
import { getAuthContext, canAccessTenant } from '../../shared/utils/auth';
import { putItem, generateTimestamps } from '../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, AuthorizationError, ValidationError, ConflictError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ProjectService' });
const tracer = new Tracer({ serviceName: 'ProjectService' });



const createProject: AppSyncResolverHandler<CreateProjectArgs, Project> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, name, description, awsAccountIds = [], members = [], settings, tags } = args;

  try {
    // Validate input
    validateRequired({ tenantId, name }, ['tenantId', 'name']);
    if (!validateUUID(tenantId)) {
      throw new ValidationError('Invalid tenant ID format');
    }

    // Get authentication context
    const authContext = getAuthContext(identity);

    // Authorization check - can only create projects for your own tenant
    if (!canAccessTenant(authContext, tenantId)) {
      throw new AuthorizationError('Cannot create project for different tenant');
    }

    // Additional permission check for project creation
    if (!authContext.permissions.includes('project:create') && authContext.role !== 'SystemAdmin') {
      throw new AuthorizationError('Insufficient permissions to create projects');
    }

    const projectId = uuidv4();
    const timestamps = generateTimestamps();

    logger.info('CreateProject mutation started', {
      userId: authContext.userId,
      tenantId,
      projectId,
      projectName: name,
      userRole: authContext.role,
    });

    // Build project members array with creator as admin
    const projectMembers = [
      {
        userId: authContext.userId,
        role: 'ADMIN' as const,
        addedAt: timestamps.createdAt,
        addedBy: authContext.userId,
        permissions: ['project:read', 'project:write', 'project:delete', 'analysis:run'],
      },
      ...members.map(member => ({
        ...member,
        addedAt: timestamps.createdAt,
        addedBy: authContext.userId,
      })),
    ];

    const project: Project = {
      id: projectId,
      tenantId,
      name,
      description,
      status: 'ACTIVE',
      awsAccountIds,
      members: projectMembers,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
      createdBy: authContext.userId,
      settings: settings || {
        defaultFrameworks: ['wa-framework'],
        autoScanEnabled: false,
        notificationSettings: {
          emailOnCompletion: true,
          emailOnError: true,
        },
        analysisSettings: {
          maxFileSize: 10,
          includedFileTypes: ['.yaml', '.yml', '.json', '.tf'],
          excludedPaths: ['.git/', 'node_modules/', '.terraform/'],
        },
      },
      tags,
    };

    // Create project with condition to prevent duplicates
    await putItem<Project>(
      process.env.PROJECTS_TABLE!,
      project,
      'attribute_not_exists(id)'
    );

    logger.info('CreateProject mutation completed', {
      projectId,
      tenantId,
      projectName: name,
      createdBy: authContext.userId,
      memberCount: projectMembers.length,
    });

    return project;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new ConflictError('Project already exists');
    }
    handleError(error, logger, { tenantId, name, operation: 'createProject' });
  }
};

// Export the handler with middleware
export const handler = middy(createProject)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
