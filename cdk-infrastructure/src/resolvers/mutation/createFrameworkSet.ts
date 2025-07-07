/**
 * Create Framework Set Mutation Resolver
 * Creates a tenant-specific framework configuration set
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { v4 as uuidv4 } from 'uuid';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface CreateFrameworkSetArgs {
  tenantId: string;
  frameworkId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  enabledRules: string[];
  customRules?: CustomRule[];
  ruleOverrides?: any;
  settings?: FrameworkSettings;
}

interface CustomRule {
  id?: string;
  name: string;
  description: string;
  severity: string;
  category: string;
  implementation: {
    checkType: string;
    conditions: any;
    parameters?: any;
    remediation: string;
  };
}

interface FrameworkSettings {
  strictMode?: boolean;
  includeInformational?: boolean;
  customSeverityLevels?: any;
  notificationSettings?: any;
}

interface TenantFrameworkConfig {
  tenantId: string;
  frameworkId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  enabledRules: string[];
  customRules: CustomRule[];
  ruleOverrides?: any;
  settings?: FrameworkSettings;
  createdAt: string;
  updatedAt: string;
}

const createFrameworkSet: AppSyncResolverHandler<CreateFrameworkSetArgs, TenantFrameworkConfig> = async (event) => {
  const { arguments: args, identity } = event;
  const {
    tenantId,
    frameworkId,
    name,
    description,
    isDefault,
    enabledRules,
    customRules = [],
    ruleOverrides,
    settings,
  } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    logger.warn('Access denied to different tenant', {
      requestedTenantId: tenantId,
      userTenantId,
    });
    throw new Error('Access denied: Cannot create framework set for different tenant');
  }

  // Role authorization check
  if (!['SystemAdmin', 'FrameworkAdmin', 'ClientAdmin'].includes(userRole)) {
    throw new Error('Access denied: Insufficient permissions to create framework set');
  }

  logger.info('CreateFrameworkSet mutation started', {
    userId,
    tenantId,
    frameworkId,
    name,
    isDefault,
    enabledRulesCount: enabledRules.length,
    customRulesCount: customRules.length,
  });

  try {
    // Validate that the framework exists
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

    const framework = frameworkResult.Items[0];

    // If this is being set as default, check if there's already a default framework set
    if (isDefault) {
      const existingDefaultQuery = new QueryCommand({
        TableName: process.env.TENANT_FRAMEWORK_CONFIGS_TABLE!,
        IndexName: 'TenantDefaultIndex',
        KeyConditionExpression: 'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk',
        ExpressionAttributeValues: {
          ':gsi1pk': `TENANT#${tenantId}`,
          ':gsi1sk': 'DEFAULT#TRUE',
        },
      });

      const existingDefaultResult = await ddbDocClient.send(existingDefaultQuery);
      if (existingDefaultResult.Items && existingDefaultResult.Items.length > 0) {
        logger.warn('Another default framework set exists', {
          tenantId,
          existingFrameworkId: existingDefaultResult.Items[0].frameworkId,
        });
        // Note: In a real implementation, you might want to update the existing default to false
      }
    }

    // Generate IDs for custom rules if not provided
    const processedCustomRules = customRules.map(rule => ({
      ...rule,
      id: rule.id || uuidv4(),
    }));

    const now = new Date().toISOString();

    const frameworkConfig: TenantFrameworkConfig = {
      tenantId,
      frameworkId,
      name,
      description,
      isDefault,
      enabledRules,
      customRules: processedCustomRules,
      ruleOverrides,
      settings: settings || {
        strictMode: false,
        includeInformational: true,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Store framework configuration in DynamoDB
    const putCommand = new PutCommand({
      TableName: process.env.TENANT_FRAMEWORK_CONFIGS_TABLE!,
      Item: {
        pk: `TENANT#${tenantId}`,
        sk: `FRAMEWORK#${frameworkId}`,
        gsi1pk: `TENANT#${tenantId}`,
        gsi1sk: isDefault ? 'DEFAULT#TRUE' : `FRAMEWORK#${frameworkId}#${now}`,
        gsi2pk: `FRAMEWORK#${frameworkId}`,
        gsi2sk: `TENANT#${tenantId}#${now}`,
        ...frameworkConfig,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    });

    await ddbDocClient.send(putCommand);

    logger.info('CreateFrameworkSet mutation completed', {
      tenantId,
      frameworkId,
      name,
      isDefault,
      enabledRulesCount: enabledRules.length,
      customRulesCount: processedCustomRules.length,
    });

    return frameworkConfig;
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.error('Framework set already exists', {
        tenantId,
        frameworkId,
      });
      throw new Error('Framework set already exists for this tenant');
    }

    logger.error('Error creating framework set', {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      frameworkId,
    });
    throw new Error('Failed to create framework set');
  }
};

// Export the handler with middleware
export const handler = middy(createFrameworkSet)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));