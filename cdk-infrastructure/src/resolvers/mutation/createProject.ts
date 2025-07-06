/**
 * Create Project Mutation Resolver
 * Creates a new project with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';
import { AppSyncIdentity, Project, ProjectSettings } from '../../shared/types/appsync';
import { ddbDocClient } from '../../shared/utils/aws-clients';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ProjectService' });
const tracer = new Tracer({ serviceName: 'ProjectService' });

interface CreateProjectArgs {
  tenantId: string;
  name: string;
  description: string;
  settings?: Partial<ProjectSettings>;
}



const createProject: AppSyncResolverHandler<CreateProjectArgs, Project> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, name, description, settings = {} } = args;

  const appSyncIdentity = identity as AppSyncIdentity;
  const userTenantId = appSyncIdentity?.claims?.['custom:tenantId'];
  const userRole = appSyncIdentity?.claims?.['custom:role'];
  const userId = appSyncIdentity?.sub;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    throw new Error('Access denied: Cannot create project for different tenant');
  }

  const projectId = uuidv4();
  const now = new Date().toISOString();

  logger.info('CreateProject mutation started', {
    userId,
    tenantId,
    projectId,
    projectName: name,
    userRole,
  });

  try {
    const project: Project = {
      projectId,
      tenantId,
      name,
      description,
      status: 'ACTIVE' as const,
      settings: {
        frameworks: settings.frameworks || ['wa-framework'],
        analysisConfig: settings.analysisConfig || {},
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    const command = new PutCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Item: {
        pk: `PROJECT#${projectId}`,
        sk: '#METADATA',
        ...project,
        // GSI keys for queries
        tenantId,
        status: project.status,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    });

    await ddbDocClient.send(command);

    logger.info('CreateProject mutation completed', {
      projectId,
      tenantId,
      projectName: name,
      createdBy: userId,
    });

    return project;
  } catch (error: unknown) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Project already exists', { projectId, tenantId });
      throw new Error('Project already exists');
    }

    logger.error('Error creating project', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      projectName: name,
    });
    throw new Error('Failed to create project');
  }
};

// Export the handler with middleware
export const handler = middy(createProject)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
