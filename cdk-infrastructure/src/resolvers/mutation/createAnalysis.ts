/**
 * Create Analysis Mutation Resolver
 * Creates a new analysis with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface CreateAnalysisArgs {
  projectId: string;
  name: string;
  type: string;
  configuration: {
    frameworks: string[];
    scope: string;
    settings?: Record<string, any>;
  };
}

interface Analysis {
  analysisId: string;
  projectId: string;
  tenantId: string;
  name: string;
  status: string;
  type: string;
  configuration: {
    frameworks: string[];
    scope: string;
    settings: Record<string, any>;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const createAnalysis: AppSyncResolverHandler<CreateAnalysisArgs, Analysis> = async (event) => {
  const { arguments: args, identity } = event;
  const { projectId, name, type, configuration } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  const analysisId = uuidv4();
  const now = new Date().toISOString();

  logger.info('CreateAnalysis mutation started', {
    userId,
    projectId,
    analysisId,
    analysisName: name,
    type,
    userRole,
  });

  try {
    // First, verify that the project exists and user has access to it
    const projectCommand = new GetCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: {
        pk: `PROJECT#${projectId}`,
        sk: '#METADATA',
      },
    });

    const projectResult = await ddbDocClient.send(projectCommand);

    if (!projectResult.Item) {
      logger.warn('Project not found', { projectId });
      throw new Error('Project not found');
    }

    const project = projectResult.Item;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && project.tenantId !== userTenantId) {
      logger.warn('Access denied to project from different tenant', {
        projectId,
        projectTenantId: project.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot create analysis for project from different tenant');
    }

    const analysis: Analysis = {
      analysisId,
      projectId,
      tenantId: project.tenantId,
      name,
      status: 'PENDING',
      type,
      configuration: {
        frameworks: configuration.frameworks,
        scope: configuration.scope,
        settings: configuration.settings || {},
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    const command = new PutCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Item: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#METADATA',
        ...analysis,
        // GSI keys for queries
        projectId,
        tenantId: project.tenantId,
        status: analysis.status,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    });

    await ddbDocClient.send(command);

    logger.info('CreateAnalysis mutation completed', {
      analysisId,
      projectId,
      tenantId: project.tenantId,
      analysisName: name,
      createdBy: userId,
    });

    return analysis;

  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Analysis already exists', { analysisId, projectId });
      throw new Error('Analysis already exists');
    }

    logger.error('Error creating analysis', { 
      error: error instanceof Error ? error.message : String(error),
      projectId,
      analysisName: name,
    });
    throw new Error('Failed to create analysis');
  }
};

// Export the handler with middleware
export const handler = middy(createAnalysis)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));