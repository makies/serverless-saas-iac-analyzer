/**
 * Get Framework Query Resolver
 * Retrieves a specific framework by ID with rules and metadata
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface GetFrameworkArgs {
  frameworkId: string;
}

interface Rule {
  id: string;
  frameworkId: string;
  ruleId: string;
  name: string;
  description: string;
  severity: string;
  pillar?: string;
  category: string;
  tags: string[];
  implementation: {
    checkType: string;
    conditions: any;
    parameters?: any;
    remediation: string;
  };
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface Framework {
  id: string;
  type: string;
  name: string;
  description: string;
  version: string;
  status: string;
  rules: Rule[];
  categories: string[];
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

const getFramework: AppSyncResolverHandler<GetFrameworkArgs, Framework | null> = async (event) => {
  const { arguments: args, identity } = event;
  const { frameworkId } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  logger.info('GetFramework query started', {
    userId,
    frameworkId,
    userTenantId,
    userRole,
  });

  try {
    // Get framework metadata
    const frameworkCommand = new GetCommand({
      TableName: process.env.FRAMEWORK_REGISTRY_TABLE!,
      Key: {
        pk: `FRAMEWORK#${frameworkId}`,
        sk: '#METADATA',
      },
    });

    const frameworkResult = await ddbDocClient.send(frameworkCommand);

    if (!frameworkResult.Item) {
      logger.warn('Framework not found', { frameworkId });
      return null;
    }

    const frameworkData = frameworkResult.Item;

    // Get framework rules
    const rulesQuery = new QueryCommand({
      TableName: process.env.FRAMEWORK_REGISTRY_TABLE!,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `FRAMEWORK#${frameworkId}`,
        ':skPrefix': 'RULE#',
      },
    });

    const rulesResult = await ddbDocClient.send(rulesQuery);

    const rules: Rule[] = (rulesResult.Items || []).map(item => ({
      id: item.ruleId,
      frameworkId: item.frameworkId,
      ruleId: item.ruleId,
      name: item.name,
      description: item.description,
      severity: item.severity,
      pillar: item.pillar,
      category: item.category,
      tags: item.tags || [],
      implementation: item.implementation,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Extract unique categories from rules
    const categories = [...new Set(rules.map(rule => rule.category))];

    const framework: Framework = {
      id: frameworkData.frameworkId,
      type: frameworkData.type,
      name: frameworkData.name,
      description: frameworkData.description,
      version: frameworkData.version,
      status: frameworkData.status,
      rules,
      categories,
      metadata: frameworkData.metadata,
      createdAt: frameworkData.createdAt,
      updatedAt: frameworkData.updatedAt,
    };

    logger.info('GetFramework query completed', {
      frameworkId,
      name: framework.name,
      rulesCount: rules.length,
      categoriesCount: categories.length,
      status: framework.status,
    });

    return framework;
  } catch (error: any) {
    logger.error('Error getting framework', {
      error: error instanceof Error ? error.message : String(error),
      frameworkId,
    });
    throw new Error('Failed to get framework');
  }
};

// Export the handler with middleware
export const handler = middy(getFramework)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));