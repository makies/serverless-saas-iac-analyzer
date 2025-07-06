/**
 * Update Project Mutation Resolver
 * Updates an existing project with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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

interface UpdateProjectArgs {
  projectId: string;
  name?: string;
  description?: string;
  status?: string;
  settings?: {
    frameworks?: string[];
    analysisConfig?: Record<string, any>;
  };
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

const updateProject: AppSyncResolverHandler<UpdateProjectArgs, Project> = async (event) => {
  const { arguments: args, identity } = event;
  const { projectId, name, description, status, settings } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  logger.info('UpdateProject mutation started', {
    userId,
    projectId,
    userTenantId,
    userRole,
    hasName: !!name,
    hasDescription: !!description,
    hasStatus: !!status,
    hasSettings: !!settings,
  });

  try {
    // First, get the existing project to verify tenant access
    const getCommand = new GetCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: '#METADATA',
      },
    });

    const existingResult = await ddbDocClient.send(getCommand);
    if (!existingResult.Item) {
      throw new Error(`Project '${projectId}' not found`);
    }

    const existingProject = existingResult.Item as Project;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && existingProject.tenantId !== userTenantId) {
      logger.warn('Access denied to project from different tenant', {
        projectId,
        projectTenantId: existingProject.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot update project from different tenant');
    }

    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    // Update name if provided
    if (name !== undefined) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = name;
    }

    // Update description if provided
    if (description !== undefined) {
      updateExpressions.push('#description = :description');
      expressionAttributeNames['#description'] = 'description';
      expressionAttributeValues[':description'] = description;
    }

    // Update status if provided
    if (status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = status;
    }

    // Update settings if provided
    if (settings !== undefined) {
      updateExpressions.push('#settings = :settings');
      expressionAttributeNames['#settings'] = 'settings';
      expressionAttributeValues[':settings'] = {
        ...existingProject.settings,
        ...settings,
      };
    }

    const updateCommand = new UpdateCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: '#METADATA',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
      ConditionExpression: 'attribute_exists(pk)',
    });

    const result = await ddbDocClient.send(updateCommand);
    const updatedProject = result.Attributes as Project;

    logger.info('UpdateProject mutation completed', {
      projectId,
      tenantId: updatedProject.tenantId,
      projectName: updatedProject.name,
      status: updatedProject.status,
    });

    return updatedProject;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Project not found', { projectId });
      throw new Error(`Project '${projectId}' not found`);
    }

    logger.error('Error updating project', {
      error: error instanceof Error ? error.message : String(error),
      projectId,
    });
    throw new Error('Failed to update project');
  }
};

// Export the handler with middleware
export const handler = middy(updateProject)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
