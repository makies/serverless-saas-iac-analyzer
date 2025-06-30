/**
 * Get Project Query Resolver
 * Retrieves a specific project with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'ProjectService' });
const tracer = new Tracer({ serviceName: 'ProjectService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface GetProjectArgs {
  projectId: string;
}

interface Project {
  projectId: string;
  tenantId: string;
  name: string;
  description: string;
  status: string;
  settings: {
    frameworks: string[];
    analysisConfig: Record<string, any>;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const getProject: AppSyncResolverHandler<GetProjectArgs, Project | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { projectId } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];

  logger.info('GetProject query started', {
    userId: (identity as any)?.sub,
    projectId,
    userTenantId,
    userRole,
  });

  try {
    const command = new GetCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: '#METADATA',
      },
    });

    const result = await ddbDocClient.send(command);

    if (!result.Item) {
      logger.warn('Project not found', { projectId });
      return null;
    }

    const project = result.Item as Project;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && project.tenantId !== userTenantId) {
      logger.warn('Access denied to project from different tenant', {
        projectId,
        projectTenantId: project.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot access project from different tenant');
    }

    logger.info('GetProject query completed', {
      projectId,
      tenantId: project.tenantId,
      projectName: project.name,
    });

    return project;

  } catch (error: any) {
    logger.error('Error getting project', { 
      error: error instanceof Error ? error.message : String(error), 
      projectId 
    });
    throw new Error('Failed to get project');
  }
};

// Export the handler with middleware
export const handler = middy(getProject)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));