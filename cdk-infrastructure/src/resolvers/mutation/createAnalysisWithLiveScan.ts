/**
 * Create Analysis with Live AWS Account Scan Mutation Resolver
 * Creates analysis with live AWS account scanning capability
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const stsClient = new STSClient({});

interface CreateAnalysisWithLiveScanArgs {
  tenantId: string;
  projectId: string;
  name: string;
  awsConfig: {
    region: string;
    accountId: string;
    roleArn: string;
  };
  scanScope: {
    services: string[];
    regions: string[];
    resourceTypes?: string[];
  };
  frameworks: string[];
}

interface Analysis {
  analysisId: string;
  tenantId: string;
  projectId: string;
  name: string;
  type: 'LIVE_SCAN';
  status: string;
  configuration: {
    frameworks: string[];
    scanScope: any;
    awsConfig: any;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const createAnalysisWithLiveScan: AppSyncResolverHandler<CreateAnalysisWithLiveScanArgs, Analysis> = async (event) => {
  const { arguments: args, identity } = event;
  const { tenantId, projectId, name, awsConfig, scanScope, frameworks } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    logger.warn('Access denied to different tenant', {
      requestedTenantId: tenantId,
      userTenantId,
    });
    throw new Error('Access denied: Cannot create analysis for different tenant');
  }

  logger.info('CreateAnalysisWithLiveScan mutation started', {
    userId,
    tenantId,
    projectId,
    name,
    accountId: awsConfig.accountId,
    services: scanScope.services,
    frameworks,
  });

  try {
    // Validate project exists and user has access
    const projectQuery = new QueryCommand({
      TableName: process.env.PROJECTS_TABLE!,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `PROJECT#${projectId}`,
        ':sk': '#METADATA',
      },
    });

    const projectResult = await ddbDocClient.send(projectQuery);
    if (!projectResult.Items || projectResult.Items.length === 0) {
      throw new Error(`Project '${projectId}' not found`);
    }

    const project = projectResult.Items[0];
    if (project.tenantId !== tenantId) {
      throw new Error('Access denied: Project belongs to different tenant');
    }

    // Validate AWS role access by attempting to assume the role
    try {
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: awsConfig.roleArn,
        RoleSessionName: `CloudBPA-Analysis-${Date.now()}`,
        DurationSeconds: 900, // 15 minutes minimum for validation
        ExternalId: process.env.EXTERNAL_ID, // Use if configured
      });

      const roleResult = await stsClient.send(assumeRoleCommand);
      logger.info('AWS role validation successful', {
        roleArn: awsConfig.roleArn,
        accountId: awsConfig.accountId,
        assumedRoleId: roleResult.AssumedRoleUser?.AssumedRoleId,
      });
    } catch (roleError) {
      logger.error('AWS role assumption failed', {
        roleArn: awsConfig.roleArn,
        error: roleError instanceof Error ? roleError.message : String(roleError),
      });
      throw new Error('Failed to validate AWS role access. Please check role ARN and permissions.');
    }

    // Validate frameworks exist
    for (const frameworkId of frameworks) {
      const frameworkQuery = new QueryCommand({
        TableName: process.env.FRAMEWORK_REGISTRY_TABLE!,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `FRAMEWORK#${frameworkId}`,
        },
      });

      const frameworkResult = await ddbDocClient.send(frameworkQuery);
      if (!frameworkResult.Items || frameworkResult.Items.length === 0) {
        throw new Error(`Framework '${frameworkId}' not found`);
      }
    }

    const analysisId = uuidv4();
    const now = new Date().toISOString();

    const analysis: Analysis = {
      analysisId,
      tenantId,
      projectId,
      name,
      type: 'LIVE_SCAN',
      status: 'PENDING',
      configuration: {
        frameworks,
        scanScope,
        awsConfig,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    // Store analysis in DynamoDB
    const putCommand = new PutCommand({
      TableName: process.env.ANALYSES_TABLE!,
      Item: {
        pk: `ANALYSIS#${analysisId}`,
        sk: '#METADATA',
        gsi1pk: `TENANT#${tenantId}`,
        gsi1sk: `PROJECT#${projectId}#${now}`,
        gsi2pk: `PROJECT#${projectId}`,
        gsi2sk: now,
        ...analysis,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    });

    await ddbDocClient.send(putCommand);

    // Create initial tenant analytics record
    const analyticsCommand = new PutCommand({
      TableName: process.env.TENANT_ANALYTICS_TABLE!,
      Item: {
        pk: `TENANT#${tenantId}`,
        sk: `ANALYSIS#${analysisId}`,
        type: 'LIVE_SCAN',
        status: 'PENDING',
        frameworks,
        createdAt: now,
        month: now.substring(0, 7), // YYYY-MM format for monthly aggregation
      },
    });

    await ddbDocClient.send(analyticsCommand);

    logger.info('CreateAnalysisWithLiveScan mutation completed', {
      analysisId,
      tenantId,
      projectId,
      type: 'LIVE_SCAN',
      frameworks: frameworks.length,
      status: analysis.status,
    });

    return analysis;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Analysis ID conflict', { analysisId: args.name });
      throw new Error('Analysis with this ID already exists');
    }

    logger.error('Error creating live scan analysis', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      projectId,
    });
    throw new Error('Failed to create live scan analysis');
  }
};

// Export the handler with middleware
export const handler = middy(createAnalysisWithLiveScan)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));