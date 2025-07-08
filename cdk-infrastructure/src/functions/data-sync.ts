import { EventBridgeHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { AppSyncClient, GetGraphqlApiCommand } from '@aws-sdk/client-appsync';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cloud-bpa' });
const tracer = new Tracer({ serviceName: 'cloud-bpa' });
const metrics = new Metrics({ serviceName: 'cloud-bpa', namespace: 'CloudBPA/SBT' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const appSyncClient = new AppSyncClient({});

// Environment variables
const TENANTS_TABLE = process.env.SBT_TENANTS_TABLE!;
const AMPLIFY_API_ID = process.env.AMPLIFY_API_ID!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface TenantEvent {
  tenantId: string;
  tenantName: string;
  adminEmail: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  timestamp: string;
  environment: string;
}

interface AmplifyTenant {
  id: string;
  name: string;
  domain?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  settings: {
    allowClientAccess: boolean;
    maxUsersPerTenant: number;
    retentionPolicyDays: number;
    allowExternalIntegrations: boolean;
  };
  subscription: {
    planName: string;
    monthlyAnalysesLimit: number;
    maxFileSizeMB: number;
    retentionDays: number;
    features: string[];
  };
  metadata: {
    region: string;
    environment: string;
    sbtTenantId: string;
    syncedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const handler: EventBridgeHandler<string, TenantEvent, void> = async (event) => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('sbt-data-sync');

  try {
    logger.appendKeys({
      eventId: event.id,
      source: event.source,
      detailType: event['detail-type'],
    });
    logger.info('Processing SBT tenant event', {
      eventType: event['detail-type'],
      tenantId: event.detail.tenantId,
      environment: event.detail.environment,
    });

    // Only process events for our environment
    if (event.detail.environment !== ENVIRONMENT) {
      logger.info('Skipping event for different environment', {
        eventEnvironment: event.detail.environment,
        currentEnvironment: ENVIRONMENT,
      });
      return;
    }

    const eventType = event['detail-type'];
    const tenantData = event.detail;

    switch (eventType) {
      case 'Tenant Created':
        await handleTenantCreated(tenantData);
        break;
      case 'Tenant Updated':
        await handleTenantUpdated(tenantData);
        break;
      case 'Tenant Deleted':
      case 'Tenant Suspended':
        await handleTenantDeleted(tenantData);
        break;
      default:
        logger.warn('Unhandled event type', { eventType });
    }

    metrics.addMetric('EventProcessed', MetricUnit.Count, 1);
    metrics.addMetric(`${eventType.replace(' ', '')}Events`, MetricUnit.Count, 1);

    logger.info('SBT tenant event processed successfully', {
      eventType,
      tenantId: tenantData.tenantId,
    });
  } catch (error) {
    logger.error('Failed to process SBT tenant event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      eventType: event['detail-type'],
      tenantId: event.detail.tenantId,
    });

    metrics.addMetric('EventProcessingError', MetricUnit.Count, 1);
    
    // Re-throw to trigger retry mechanism
    throw error;
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function handleTenantCreated(tenantData: TenantEvent): Promise<void> {
  logger.info('Creating tenant in Amplify data store', {
    tenantId: tenantData.tenantId,
    tenantName: tenantData.tenantName,
  });

  // Get full tenant data from SBT table
  const sbtTenant = await getSBTTenant(tenantData.tenantId);
  
  if (!sbtTenant) {
    throw new Error(`SBT tenant ${tenantData.tenantId} not found`);
  }

  // Create corresponding Amplify tenant record
  const amplifyTenant: AmplifyTenant = {
    id: tenantData.tenantId,
    name: tenantData.tenantName,
    status: tenantData.status,
    tier: tenantData.tier,
    settings: {
      allowClientAccess: sbtTenant.settings?.allowClientAccess || false,
      maxUsersPerTenant: getMaxUsersForTier(tenantData.tier),
      retentionPolicyDays: sbtTenant.subscription?.retentionDays || 90,
      allowExternalIntegrations: tenantData.tier !== 'BASIC',
    },
    subscription: {
      planName: `${tenantData.tier.toLowerCase()}-plan`,
      monthlyAnalysesLimit: sbtTenant.subscription?.monthlyAnalysesLimit || 100,
      maxFileSizeMB: sbtTenant.subscription?.maxFileSizeMB || 10,
      retentionDays: sbtTenant.subscription?.retentionDays || 90,
      features: getFeaturesForTier(tenantData.tier),
    },
    metadata: {
      region: process.env.AWS_REGION || 'ap-northeast-1',
      environment: ENVIRONMENT,
      sbtTenantId: tenantData.tenantId,
      syncedAt: new Date().toISOString(),
    },
    createdAt: sbtTenant.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store in Amplify DynamoDB table (using the same table structure as Amplify Gen 2)
  await storeAmplifyTenant(amplifyTenant);

  logger.info('Tenant created in Amplify data store', {
    tenantId: tenantData.tenantId,
    amplifyTenantId: amplifyTenant.id,
  });
}

async function handleTenantUpdated(tenantData: TenantEvent): Promise<void> {
  logger.info('Updating tenant in Amplify data store', {
    tenantId: tenantData.tenantId,
    status: tenantData.status,
  });

  // Get full tenant data from SBT table
  const sbtTenant = await getSBTTenant(tenantData.tenantId);
  
  if (!sbtTenant) {
    logger.warn('SBT tenant not found during update', {
      tenantId: tenantData.tenantId,
    });
    return;
  }

  // Update Amplify tenant record
  const updateData = {
    status: tenantData.status,
    settings: {
      allowClientAccess: sbtTenant.settings?.allowClientAccess || false,
      maxUsersPerTenant: getMaxUsersForTier(tenantData.tier),
      retentionPolicyDays: sbtTenant.subscription?.retentionDays || 90,
      allowExternalIntegrations: tenantData.tier !== 'BASIC',
    },
    subscription: {
      planName: `${tenantData.tier.toLowerCase()}-plan`,
      monthlyAnalysesLimit: sbtTenant.subscription?.monthlyAnalysesLimit || 100,
      maxFileSizeMB: sbtTenant.subscription?.maxFileSizeMB || 10,
      retentionDays: sbtTenant.subscription?.retentionDays || 90,
      features: getFeaturesForTier(tenantData.tier),
    },
    metadata: {
      region: process.env.AWS_REGION || 'ap-northeast-1',
      environment: ENVIRONMENT,
      sbtTenantId: tenantData.tenantId,
      syncedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  await updateAmplifyTenant(tenantData.tenantId, updateData);

  logger.info('Tenant updated in Amplify data store', {
    tenantId: tenantData.tenantId,
  });
}

async function handleTenantDeleted(tenantData: TenantEvent): Promise<void> {
  logger.info('Handling tenant deletion/suspension', {
    tenantId: tenantData.tenantId,
    status: tenantData.status,
  });

  if (tenantData.status === 'ARCHIVED') {
    // Soft delete: update status only
    await updateAmplifyTenant(tenantData.tenantId, {
      status: 'INACTIVE',
      updatedAt: new Date().toISOString(),
      metadata: {
        region: process.env.AWS_REGION || 'ap-northeast-1',
        environment: ENVIRONMENT,
        sbtTenantId: tenantData.tenantId,
        syncedAt: new Date().toISOString(),
      },
    });
  } else {
    // Hard delete for suspended tenants
    await deleteAmplifyTenant(tenantData.tenantId);
  }

  logger.info('Tenant deletion handled in Amplify data store', {
    tenantId: tenantData.tenantId,
    action: tenantData.status === 'ARCHIVED' ? 'soft-delete' : 'hard-delete',
  });
}

async function getSBTTenant(tenantId: string): Promise<any> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenantId },
    })
  );

  return result.Item;
}

async function storeAmplifyTenant(tenant: AmplifyTenant): Promise<void> {
  // This would typically use the same DynamoDB table that Amplify Gen 2 uses
  // For now, we'll use a dedicated table name pattern
  const amplifyTableName = `CloudBPA-Tenant-${ENVIRONMENT}`;
  
  await dynamoClient.send(
    new PutCommand({
      TableName: amplifyTableName,
      Item: {
        ...tenant,
        __typename: 'Tenant',
        // Add Amplify-specific fields
        _version: 1,
        _lastChangedAt: Date.now(),
        _deleted: null,
      },
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );
}

async function updateAmplifyTenant(tenantId: string, updateData: any): Promise<void> {
  const amplifyTableName = `CloudBPA-Tenant-${ENVIRONMENT}`;
  
  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updateData).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    
    updateExpression.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updateData[key];
  });

  // Add Amplify-specific update fields
  updateExpression.push('#lastChanged = :lastChanged', '#version = #version + :inc');
  expressionAttributeNames['#lastChanged'] = '_lastChangedAt';
  expressionAttributeNames['#version'] = '_version';
  expressionAttributeValues[':lastChanged'] = Date.now();
  expressionAttributeValues[':inc'] = 1;

  await dynamoClient.send(
    new UpdateCommand({
      TableName: amplifyTableName,
      Key: { id: tenantId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(id)',
    })
  );
}

async function deleteAmplifyTenant(tenantId: string): Promise<void> {
  const amplifyTableName = `CloudBPA-Tenant-${ENVIRONMENT}`;
  
  // Amplify uses soft deletes
  await dynamoClient.send(
    new UpdateCommand({
      TableName: amplifyTableName,
      Key: { id: tenantId },
      UpdateExpression: 'SET #deleted = :deleted, #lastChanged = :lastChanged, #version = #version + :inc',
      ExpressionAttributeNames: {
        '#deleted': '_deleted',
        '#lastChanged': '_lastChangedAt',
        '#version': '_version',
      },
      ExpressionAttributeValues: {
        ':deleted': Date.now(),
        ':lastChanged': Date.now(),
        ':inc': 1,
      },
      ConditionExpression: 'attribute_exists(id)',
    })
  );
}

function getMaxUsersForTier(tier: string): number {
  const limits = {
    BASIC: 5,
    PREMIUM: 25,
    ENTERPRISE: 100,
  };
  return limits[tier as keyof typeof limits] || 5;
}

function getFeaturesForTier(tier: string): string[] {
  const features = {
    BASIC: [
      'basic-analysis',
      'cloudformation-support',
      'terraform-support',
      'cdk-support',
      'well-architected-framework',
    ],
    PREMIUM: [
      'basic-analysis',
      'cloudformation-support',
      'terraform-support',
      'cdk-support',
      'well-architected-framework',
      'well-architected-lenses',
      'live-aws-scanning',
      'advanced-reporting',
      'api-access',
    ],
    ENTERPRISE: [
      'basic-analysis',
      'cloudformation-support',
      'terraform-support',
      'cdk-support',
      'well-architected-framework',
      'well-architected-lenses',
      'live-aws-scanning',
      'advanced-reporting',
      'api-access',
      'custom-frameworks',
      'plugin-system',
      'sso-integration',
      'advanced-analytics',
      'dedicated-support',
    ],
  };
  
  return features[tier as keyof typeof features] || features.BASIC;
}