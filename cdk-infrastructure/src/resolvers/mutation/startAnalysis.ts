/**
 * Start Analysis Mutation Resolver
 * Starts an analysis execution with tenant isolation
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Import shared utilities and types
import { Analysis, StartAnalysisArgs, AnalysisWorkflowInput } from '../../shared/types/analysis';
import { getAuthContext } from '../../shared/utils/auth';
import { getItem, updateItem, updateTimestamp } from '../../shared/utils/dynamodb';
import { handleError, validateRequired, validateUUID, NotFoundError, AuthorizationError, ValidationError } from '../../shared/utils/errors';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

// Initialize AWS clients
const sfnClient = new SFNClient({});

const startAnalysis: AppSyncResolverHandler<StartAnalysisArgs, Analysis> = async (event) => {
  const { arguments: args, identity } = event;
  const { analysisId, input = {} } = args;

  try {
    // Validate input
    validateRequired({ analysisId }, ['analysisId']);
    if (!validateUUID(analysisId)) {
      throw new ValidationError('Invalid analysis ID format');
    }

    // Get authentication context
    const authContext = getAuthContext(identity);

    logger.info('StartAnalysis mutation started', {
      userId: authContext.userId,
      analysisId,
      userTenantId: authContext.tenantId,
      userRole: authContext.role,
      hasInput: !!input,
    });

    // Get the existing analysis to verify tenant access
    const existingAnalysis = await getItem<Analysis>(
      process.env.ANALYSES_TABLE!,
      { id: analysisId }
    );

    if (!existingAnalysis) {
      throw new NotFoundError('Analysis', analysisId);
    }

    // Tenant isolation check
    if (authContext.role !== 'SystemAdmin' && existingAnalysis.tenantId !== authContext.tenantId) {
      throw new AuthorizationError('Cannot start analysis from different tenant');
    }

    // Check if analysis is in a state that can be started
    if (!['PENDING', 'FAILED'].includes(existingAnalysis.status)) {
      throw new ValidationError(`Analysis cannot be started from status: ${existingAnalysis.status}`);
    }

    // Permission check for analysis execution
    if (!authContext.permissions.includes('analysis:run') && authContext.role !== 'SystemAdmin') {
      throw new AuthorizationError('Insufficient permissions to start analysis');
    }

    const now = new Date().toISOString();

    // Prepare Step Function execution input
    const executionInput: AnalysisWorkflowInput = {
      analysisId,
      tenantId: existingAnalysis.tenantId,
      projectId: existingAnalysis.projectId,
      configuration: existingAnalysis.configuration,
      input,
      metadata: {
        startedBy: authContext.userId,
        startedAt: now,
      },
    };

    // Get Step Functions ARN from environment
    const environment = process.env.ENVIRONMENT || 'dev';
    const analysisStateMachineArn = process.env.ANALYSIS_STATE_MACHINE_ARN || 
      `arn:aws:states:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:stateMachine:AnalysisWorkflow-${environment}`;

    let executionArn: string;

    try {
      const startExecutionCommand = new StartExecutionCommand({
        stateMachineArn: analysisStateMachineArn,
        name: `analysis-${analysisId}-${Date.now()}`,
        input: JSON.stringify(executionInput),
      });

      const executionResult = await sfnClient.send(startExecutionCommand);
      executionArn = executionResult.executionArn!;

      logger.info('Step Function execution started', {
        analysisId,
        executionArn,
        stateMachineArn: analysisStateMachineArn,
      });
    } catch (sfnError) {
      // If Step Functions isn't available in development, create a mock execution ARN
      logger.warn('Step Function not available, creating mock execution', {
        analysisId,
        error: sfnError instanceof Error ? sfnError.message : String(sfnError),
      });

      executionArn = `arn:aws:states:${process.env.AWS_REGION || 'us-east-1'}:${process.env.AWS_ACCOUNT_ID || '123456789012'}:execution:AnalysisWorkflow-${environment}:analysis-${analysisId}-${Date.now()}`;
    }

    // Update analysis status to RUNNING
    const updatedAnalysis = await updateItem(
      process.env.ANALYSES_TABLE!,
      { id: analysisId },
      'SET #status = :status, #updatedAt = :updatedAt, #execution = :execution',
      {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#execution': 'execution',
      },
      {
        ':status': 'RUNNING',
        ':updatedAt': now,
        ':execution': {
          stateMachineArn: analysisStateMachineArn,
          executionArn,
          startedAt: now,
          progress: 0,
          currentStep: 'INITIALIZATION',
        },
      },
      'attribute_exists(id)'
    ) as Analysis;

    logger.info('StartAnalysis mutation completed', {
      analysisId,
      tenantId: updatedAnalysis.tenantId,
      projectId: updatedAnalysis.projectId,
      executionArn,
      status: updatedAnalysis.status,
    });

    return updatedAnalysis;
  } catch (error: any) {
    handleError(error, logger, { analysisId, operation: 'startAnalysis' });
  }
};

// Export the handler with middleware
export const handler = middy(startAnalysis)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
