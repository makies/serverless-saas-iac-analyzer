/**
 * Tenant Onboarding Automation Lambda Function
 * Automates the complete tenant onboarding process including:
 * - Framework setup
 * - User creation
 * - Initial project setup
 * - Permission configuration
 */

import { EventBridgeHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { v4 as uuidv4 } from 'uuid';

// PowerTools setup
const logger = new Logger({ serviceName: 'tenant-onboarding-automation' });
const tracer = new Tracer({ serviceName: 'tenant-onboarding-automation' });
const metrics = new Metrics({ serviceName: 'tenant-onboarding-automation', namespace: 'CloudBPA/Control' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognitoClient = new CognitoIdentityProviderClient({});
const sesClient = new SESClient({});
const eventBridgeClient = new EventBridgeClient({});

// Environment variables
const TENANTS_TABLE = process.env.SBT_TENANTS_TABLE!;
const PROJECTS_TABLE = process.env.PROJECTS_TABLE!;
const FRAMEWORK_REGISTRY_TABLE = process.env.FRAMEWORK_REGISTRY_TABLE!;
const USER_POOL_ID = process.env.USER_POOL_ID!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;
const EMAIL_TEMPLATE_NAME = process.env.EMAIL_TEMPLATE_NAME!;

interface TenantOnboardingEvent {
  tenantId: string;
  tenantName: string;
  adminEmail: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  onboardingConfig?: {
    autoCreateDefaultProject?: boolean;
    enableDefaultFrameworks?: boolean;
    sendWelcomeEmail?: boolean;
    inviteAdditionalUsers?: string[];
  };
}

interface OnboardingStep {
  step: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startTime?: string;
  endTime?: string;
  error?: string;
}

interface OnboardingResult {
  tenantId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  steps: OnboardingStep[];
  createdResources: {
    projectId?: string;
    userIds?: string[];
    frameworkIds?: string[];
  };
  errors: string[];
}

export const handler: EventBridgeHandler<string, TenantOnboardingEvent, void> = async (event) => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('tenant-onboarding-automation');

  try {
    logger.appendKeys({
      eventId: event.id,
      source: event.source,
      detailType: event['detail-type'],
    });

    logger.info('Processing tenant onboarding automation', {
      tenantId: event.detail.tenantId,
      tenantName: event.detail.tenantName,
      tier: event.detail.tier,
    });

    // Only process events for our environment
    if (event.detail.tenantId.includes(ENVIRONMENT) === false) {
      logger.info('Skipping event for different environment');
      return;
    }

    const result = await processOnboarding(event.detail);

    // Publish onboarding completion event
    await publishOnboardingEvent('Tenant Onboarding Completed', event.detail, result);

    metrics.addMetric('OnboardingProcessed', MetricUnit.Count, 1);
    metrics.addMetric(`Onboarding${result.status}`, MetricUnit.Count, 1);

    logger.info('Tenant onboarding automation completed', {
      tenantId: event.detail.tenantId,
      status: result.status,
      completedSteps: result.steps.filter(s => s.status === 'COMPLETED').length,
      totalSteps: result.steps.length,
    });
  } catch (error) {
    logger.error('Failed to process tenant onboarding', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: event.detail.tenantId,
    });

    metrics.addMetric('OnboardingError', MetricUnit.Count, 1);
    throw error;
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function processOnboarding(tenantData: TenantOnboardingEvent): Promise<OnboardingResult> {
  const result: OnboardingResult = {
    tenantId: tenantData.tenantId,
    status: 'SUCCESS',
    steps: [],
    createdResources: {},
    errors: [],
  };

  const config = tenantData.onboardingConfig || {
    autoCreateDefaultProject: true,
    enableDefaultFrameworks: true,
    sendWelcomeEmail: true,
    inviteAdditionalUsers: [],
  };

  // Step 1: Validate tenant exists
  await executeStep(result, 'validate-tenant', async () => {
    const tenant = await getTenant(tenantData.tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantData.tenantId} not found`);
    }
    logger.info('Tenant validation completed', { tenantId: tenantData.tenantId });
  });

  // Step 2: Setup default frameworks
  if (config.enableDefaultFrameworks) {
    await executeStep(result, 'setup-frameworks', async () => {
      const frameworkIds = await setupDefaultFrameworks(tenantData);
      result.createdResources.frameworkIds = frameworkIds;
      logger.info('Default frameworks setup completed', { 
        tenantId: tenantData.tenantId, 
        frameworkCount: frameworkIds.length 
      });
    });
  }

  // Step 3: Create default project
  if (config.autoCreateDefaultProject) {
    await executeStep(result, 'create-default-project', async () => {
      const projectId = await createDefaultProject(tenantData);
      result.createdResources.projectId = projectId;
      logger.info('Default project created', { tenantId: tenantData.tenantId, projectId });
    });
  }

  // Step 4: Setup additional users
  if (config.inviteAdditionalUsers && config.inviteAdditionalUsers.length > 0) {
    await executeStep(result, 'invite-additional-users', async () => {
      const userIds = await inviteAdditionalUsers(tenantData, config.inviteAdditionalUsers!);
      result.createdResources.userIds = userIds;
      logger.info('Additional users invited', { 
        tenantId: tenantData.tenantId, 
        userCount: userIds.length 
      });
    });
  }

  // Step 5: Send welcome email
  if (config.sendWelcomeEmail) {
    await executeStep(result, 'send-welcome-email', async () => {
      await sendWelcomeEmail(tenantData, result.createdResources);
      logger.info('Welcome email sent', { 
        tenantId: tenantData.tenantId, 
        adminEmail: tenantData.adminEmail 
      });
    });
  }

  // Step 6: Update tenant status
  await executeStep(result, 'finalize-onboarding', async () => {
    await updateTenantOnboardingStatus(tenantData.tenantId, 'COMPLETED', result);
    logger.info('Tenant onboarding finalized', { tenantId: tenantData.tenantId });
  });

  // Determine overall status
  const failedSteps = result.steps.filter(s => s.status === 'FAILED');
  if (failedSteps.length > 0) {
    result.status = failedSteps.length === result.steps.length ? 'FAILED' : 'PARTIAL';
  }

  return result;
}

async function executeStep(
  result: OnboardingResult,
  stepName: string,
  operation: () => Promise<void>
): Promise<void> {
  const step: OnboardingStep = {
    step: stepName,
    status: 'IN_PROGRESS',
    startTime: new Date().toISOString(),
  };

  result.steps.push(step);

  try {
    await operation();
    step.status = 'COMPLETED';
    step.endTime = new Date().toISOString();
  } catch (error) {
    step.status = 'FAILED';
    step.endTime = new Date().toISOString();
    step.error = error instanceof Error ? error.message : String(error);
    result.errors.push(`${stepName}: ${step.error}`);
    
    logger.error(`Onboarding step failed: ${stepName}`, {
      error: step.error,
      step: stepName,
    });
  }
}

async function getTenant(tenantId: string): Promise<any> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: TENANTS_TABLE,
      Key: { tenantId },
    })
  );
  return result.Item;
}

async function setupDefaultFrameworks(tenantData: TenantOnboardingEvent): Promise<string[]> {
  // Get available frameworks based on tier
  const frameworkIds = getDefaultFrameworksForTier(tenantData.tier);
  
  // Create tenant-specific framework configurations
  for (const frameworkId of frameworkIds) {
    await dynamoClient.send(
      new PutCommand({
        TableName: FRAMEWORK_REGISTRY_TABLE,
        Item: {
          pk: `TENANT#${tenantData.tenantId}`,
          sk: `FRAMEWORK#${frameworkId}`,
          tenantId: tenantData.tenantId,
          frameworkId,
          enabled: true,
          configuration: getDefaultFrameworkConfig(frameworkId, tenantData.tier),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );
  }

  return frameworkIds;
}

async function createDefaultProject(tenantData: TenantOnboardingEvent): Promise<string> {
  const projectId = `project-default-${Date.now()}`;
  const now = new Date().toISOString();

  const defaultProject = {
    pk: `PROJECT#${projectId}`,
    sk: '#METADATA',
    gsi1pk: `TENANT#${tenantData.tenantId}`,
    gsi1sk: now,
    projectId,
    tenantId: tenantData.tenantId,
    name: `${tenantData.tenantName} - Default Project`,
    description: 'Automatically created default project for tenant onboarding',
    status: 'ACTIVE',
    settings: {
      analysisFrameworks: getDefaultFrameworksForTier(tenantData.tier),
      autoScanSchedule: 'MANUAL',
      retentionPolicyDays: getTierRetentionDays(tenantData.tier),
    },
    members: [
      {
        email: tenantData.adminEmail,
        role: 'ProjectManager',
        addedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: 'system-onboarding',
  };

  await dynamoClient.send(
    new PutCommand({
      TableName: PROJECTS_TABLE,
      Item: defaultProject,
      ConditionExpression: 'attribute_not_exists(pk)',
    })
  );

  return projectId;
}

async function inviteAdditionalUsers(
  tenantData: TenantOnboardingEvent,
  userEmails: string[]
): Promise<string[]> {
  const userIds: string[] = [];

  for (const email of userEmails) {
    try {
      const tempPassword = generateTemporaryPassword();
      
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:tenantId', Value: tenantData.tenantId },
            { Name: 'custom:role', Value: 'Analyst' },
            { Name: 'custom:projectIds', Value: '[]' },
          ],
          MessageAction: 'SUPPRESS',
          TemporaryPassword: tempPassword,
        })
      );

      await cognitoClient.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          GroupName: 'Analysts',
        })
      );

      userIds.push(email);
    } catch (error) {
      logger.warn('Failed to create additional user', {
        email,
        tenantId: tenantData.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return userIds;
}

async function sendWelcomeEmail(
  tenantData: TenantOnboardingEvent,
  createdResources: any
): Promise<void> {
  const templateData = {
    tenantName: tenantData.tenantName,
    adminEmail: tenantData.adminEmail,
    tier: tenantData.tier,
    projectId: createdResources.projectId,
    frameworkCount: createdResources.frameworkIds?.length || 0,
    dashboardUrl: `https://${process.env.DOMAIN_NAME}/dashboard`,
    supportEmail: process.env.SUPPORT_EMAIL || 'support@cloudbpa.com',
  };

  await sesClient.send(
    new SendTemplatedEmailCommand({
      Source: process.env.FROM_EMAIL || 'noreply@cloudbpa.com',
      Destination: {
        ToAddresses: [tenantData.adminEmail],
      },
      Template: EMAIL_TEMPLATE_NAME,
      TemplateData: JSON.stringify(templateData),
    })
  );
}

async function updateTenantOnboardingStatus(
  tenantId: string,
  status: string,
  result: OnboardingResult
): Promise<void> {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: TENANTS_TABLE,
      Key: { tenantId },
      UpdateExpression: 'SET onboardingStatus = :status, onboardingResult = :result, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':status': status,
        ':result': result,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );
}

async function publishOnboardingEvent(
  eventType: string,
  tenantData: TenantOnboardingEvent,
  result: OnboardingResult
): Promise<void> {
  const event = {
    Source: 'cloudbpa.controlplane',
    DetailType: eventType,
    Detail: JSON.stringify({
      tenantId: tenantData.tenantId,
      tenantName: tenantData.tenantName,
      status: result.status,
      createdResources: result.createdResources,
      stepCount: result.steps.length,
      completedSteps: result.steps.filter(s => s.status === 'COMPLETED').length,
      errors: result.errors,
      timestamp: new Date().toISOString(),
      environment: ENVIRONMENT,
    }),
    EventBusName: EVENT_BUS_NAME,
  };

  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [event],
    })
  );
}

function getDefaultFrameworksForTier(tier: string): string[] {
  const frameworks = {
    BASIC: ['well-architected', 'security-hub'],
    PREMIUM: ['well-architected', 'security-hub', 'serverless-lens', 'saas-lens'],
    ENTERPRISE: [
      'well-architected',
      'security-hub', 
      'serverless-lens',
      'saas-lens',
      'iot-lens',
      'ml-lens',
      'aws-competency',
      'service-delivery',
    ],
  };
  return frameworks[tier as keyof typeof frameworks] || frameworks.BASIC;
}

function getDefaultFrameworkConfig(frameworkId: string, tier: string): any {
  return {
    enabled: true,
    severity: tier === 'BASIC' ? 'HIGH' : 'MEDIUM',
    autoFix: false,
    notifications: tier !== 'BASIC',
  };
}

function getTierRetentionDays(tier: string): number {
  const retention = {
    BASIC: 90,
    PREMIUM: 365,
    ENTERPRISE: 2555, // 7 years
  };
  return retention[tier as keyof typeof retention] || 90;
}

function generateTemporaryPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each required character type
  password += 'A'; // uppercase
  password += 'a'; // lowercase  
  password += '1'; // number
  password += '!'; // symbol

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
}