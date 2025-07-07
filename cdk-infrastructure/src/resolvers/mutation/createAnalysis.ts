/**
 * Create Analysis Mutation Resolver
 * Creates a new analysis with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';

// Import shared utilities and types
import { Analysis, CreateAnalysisArgs } from '../../shared/types/analysis';
import { Project } from '../../shared/types/project';
import { getAuthContext } from '../../shared/utils/auth';
import { getItem, putItem, generateTimestamps } from '../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

const createAnalysis: AppSyncResolverHandler<CreateAnalysisArgs, Analysis> = async (event) => {
  const { arguments: args, identity } = event;
  const { projectId, name, type, configuration } = args;

  try {
    // Validate input
    validateRequired({ projectId, name, type }, ['projectId', 'name', 'type']);
    if (!validateUUID(projectId)) {
      throw new ValidationError('Invalid project ID format');
    }

    // Get authentication context
    const authContext = getAuthContext(identity);

    const analysisId = uuidv4();
    const timestamps = generateTimestamps();

    logger.info('CreateAnalysis mutation started', {
      userId: authContext.userId,
      projectId,
      analysisId,
      analysisName: name,
      type,
      userRole: authContext.role,
    });

    // Verify that the project exists and user has access to it
    const project = await getItem<Project>(
      process.env.PROJECTS_TABLE!,
      { id: projectId }
    );

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // Tenant isolation check
    if (authContext.role !== 'SystemAdmin' && project.tenantId !== authContext.tenantId) {
      throw new AuthorizationError('Cannot create analysis for project from different tenant');
    }

    // Permission check for analysis creation
    if (!authContext.permissions.includes('analysis:create') && authContext.role !== 'SystemAdmin') {
      throw new AuthorizationError('Insufficient permissions to create analysis');
    }

    // Validate frameworks exist (basic validation)
    if (!configuration.frameworks || configuration.frameworks.length === 0) {
      throw new ValidationError('At least one framework must be specified');
    }

    // Build default analysis settings if not provided
    const defaultSettings = {
      includeInactiveResources: false,
      maxResourcesPerAnalysis: 10000,
      parallelAnalysisLimit: 5,
      detailedReporting: true,
      generateRecommendations: true,
      autoRemediationEnabled: false,
      reportFormat: ['JSON', 'PDF'] as ('PDF' | 'EXCEL' | 'JSON' | 'CSV')[],
      notificationSettings: {
        emailOnCompletion: true,
        emailOnError: true,
      },
    };

    const analysis: Analysis = {
      id: analysisId,
      projectId,
      tenantId: project.tenantId,
      name,
      status: 'PENDING',
      type,
      configuration: {
        frameworks: configuration.frameworks,
        scope: configuration.scope,
        settings: { ...defaultSettings, ...configuration.settings },
      },
      metadata: {
        analysisVersion: '1.0.0',
        engineVersion: '2.0.0',
        resourceTypesAnalyzed: [],
        executionEnvironment: {
          region: process.env.AWS_REGION || 'us-east-1',
          accountId: process.env.AWS_ACCOUNT_ID || '',
          runtime: 'nodejs22.x',
        },
        quotaUsage: {
          analysisCount: 1,
          monthlyLimit: 100,
          fileSize: 0,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB
        },
        performance: {
          totalExecutionTime: 0,
          frameworkExecutionTimes: {},
        },
      },
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
      createdBy: authContext.userId,
    };

    // Create analysis with condition to prevent duplicates
    await putItem<Analysis>(
      process.env.ANALYSES_TABLE!,
      analysis,
      'attribute_not_exists(id)'
    );

    logger.info('CreateAnalysis mutation completed', {
      analysisId,
      projectId,
      tenantId: project.tenantId,
      analysisName: name,
      frameworkCount: configuration.frameworks.length,
      createdBy: authContext.userId,
    });

    return analysis;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new ConflictError('Analysis already exists');
    }
    handleError(error, logger, { projectId, name, type, operation: 'createAnalysis' });
  }
};

// Export the handler with middleware
export const handler = middy(createAnalysis)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
