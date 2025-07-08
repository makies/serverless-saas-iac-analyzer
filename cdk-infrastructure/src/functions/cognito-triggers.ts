/**
 * Cognito Lambda Triggers
 * Handles pre/post authentication, token generation, and user migration
 */

import { 
  PreAuthenticationTriggerHandler,
  PostAuthenticationTriggerHandler,
  PreTokenGenerationTriggerHandler,
  PostConfirmationTriggerHandler,
  CreateAuthChallengeTriggerHandler,
  DefineAuthChallengeTriggerHandler,
  VerifyAuthChallengeResponseTriggerHandler,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cloud-bpa' });
const tracer = new Tracer({ serviceName: 'cloud-bpa' });
const metrics = new Metrics({ serviceName: 'cloud-bpa', namespace: 'CloudBPA/Auth' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});

// Environment variables
const TENANTS_TABLE = process.env.SBT_TENANTS_TABLE!;
const USER_ANALYTICS_TABLE = process.env.USER_ANALYTICS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

/**
 * Pre Authentication Trigger
 * Validates user status and tenant before allowing authentication
 */
export const preAuthentication: PreAuthenticationTriggerHandler = async (event) => {
  logger.info('Pre-authentication trigger started', {
    username: event.userName,
    userPoolId: event.userPoolId,
  });

  try {
    const { userAttributes } = event.request;
    const tenantId = userAttributes['custom:tenantId'];
    const userRole = userAttributes['custom:role'];

    // Validate tenant exists and is active
    if (tenantId) {
      const tenant = await getTenant(tenantId);
      
      if (!tenant) {
        logger.warn('Authentication denied - tenant not found', {
          username: event.userName,
          tenantId,
        });
        throw new Error('Tenant not found');
      }

      if (tenant.status !== 'ACTIVE') {
        logger.warn('Authentication denied - tenant not active', {
          username: event.userName,
          tenantId,
          tenantStatus: tenant.status,
        });
        throw new Error('Tenant account is not active');
      }

      // Check tenant subscription limits
      const usageValidation = await validateTenantUsage(tenantId);
      if (!usageValidation.allowed) {
        logger.warn('Authentication denied - tenant usage limits exceeded', {
          username: event.userName,
          tenantId,
          violations: usageValidation.violations,
        });
        throw new Error('Tenant usage limits exceeded');
      }
    }

    // Log authentication attempt
    await recordAuthenticationAttempt(event.userName, tenantId, 'PRE_AUTH_SUCCESS');

    metrics.addMetric('PreAuthSuccess', MetricUnit.Count, 1);
    
    logger.info('Pre-authentication validation passed', {
      username: event.userName,
      tenantId,
      userRole,
    });

    return event;
  } catch (error) {
    logger.error('Pre-authentication failed', {
      username: event.userName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    metrics.addMetric('PreAuthFailure', MetricUnit.Count, 1);

    // Record failed attempt
    await recordAuthenticationAttempt(
      event.userName, 
      event.request.userAttributes['custom:tenantId'], 
      'PRE_AUTH_FAILURE',
      error instanceof Error ? error.message : 'Unknown error'
    );

    throw error;
  }
};

/**
 * Post Authentication Trigger
 * Records successful login and updates user analytics
 */
export const postAuthentication: PostAuthenticationTriggerHandler = async (event) => {
  logger.info('Post-authentication trigger started', {
    username: event.userName,
    userPoolId: event.userPoolId,
  });

  try {
    const { userAttributes } = event.request;
    const tenantId = userAttributes['custom:tenantId'];
    const userRole = userAttributes['custom:role'];
    const email = userAttributes['email'];

    // Update last login timestamp
    await updateUserLastLogin(event.userName, tenantId);

    // Record login analytics
    await recordLoginAnalytics(event.userName, tenantId, userRole);

    // Publish login event
    await publishAuthEvent('User Login', {
      username: event.userName,
      email,
      tenantId,
      userRole,
      loginTime: new Date().toISOString(),
      clientId: event.callerContext.clientId,
      source: event.request.newDeviceUsed ? 'new_device' : 'known_device',
    });

    metrics.addMetric('PostAuthSuccess', MetricUnit.Count, 1);
    metrics.addMetric(`${userRole}Login`, MetricUnit.Count, 1);

    logger.info('Post-authentication completed', {
      username: event.userName,
      tenantId,
      userRole,
    });

    return event;
  } catch (error) {
    logger.error('Post-authentication failed', {
      username: event.userName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    metrics.addMetric('PostAuthFailure', MetricUnit.Count, 1);
    throw error;
  }
};

/**
 * Pre Token Generation Trigger
 * Adds custom claims to JWT tokens
 */
export const preTokenGeneration: PreTokenGenerationTriggerHandler = async (event) => {
  logger.info('Pre-token generation trigger started', {
    username: event.userName,
    tokenUse: event.request.tokenUse,
  });

  try {
    const { userAttributes } = event.request;
    const tenantId = userAttributes['custom:tenantId'];
    const userRole = userAttributes['custom:role'];
    const projectIds = userAttributes['custom:projectIds'];

    // Add custom claims to tokens
    event.response.claimsOverrideDetails = {
      claimsToAddOrOverride: {
        'custom:tenantId': tenantId || '',
        'custom:role': userRole || 'Viewer',
        'custom:projectIds': projectIds || '[]',
        'custom:environment': ENVIRONMENT,
        'custom:permissions': JSON.stringify(await getUserPermissions(userRole, tenantId)),
      },
      claimsToSuppress: [],
    };

    // Set token validity based on role
    if (event.request.tokenUse === 'access') {
      const tokenValidityMinutes = getTokenValidityByRole(userRole);
      event.response.claimsOverrideDetails.claimsToAddOrOverride['token_validity'] = tokenValidityMinutes.toString();
    }

    metrics.addMetric('TokenGenerated', MetricUnit.Count, 1);

    logger.info('Pre-token generation completed', {
      username: event.userName,
      tenantId,
      userRole,
      tokenUse: event.request.tokenUse,
    });

    return event;
  } catch (error) {
    logger.error('Pre-token generation failed', {
      username: event.userName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    metrics.addMetric('TokenGenerationFailure', MetricUnit.Count, 1);
    throw error;
  }
};

/**
 * Post Confirmation Trigger
 * Handles user confirmation and initial setup
 */
export const postConfirmation: PostConfirmationTriggerHandler = async (event) => {
  logger.info('Post-confirmation trigger started', {
    username: event.userName,
    triggerSource: event.triggerSource,
  });

  try {
    const { userAttributes } = event.request;
    const tenantId = userAttributes['custom:tenantId'];
    const userRole = userAttributes['custom:role'];
    const email = userAttributes['email'];

    // Initialize user analytics record
    await initializeUserAnalytics(event.userName, tenantId, userRole);

    // Publish user confirmation event
    await publishAuthEvent('User Confirmed', {
      username: event.userName,
      email,
      tenantId,
      userRole,
      confirmationTime: new Date().toISOString(),
      triggerSource: event.triggerSource,
    });

    metrics.addMetric('UserConfirmed', MetricUnit.Count, 1);

    logger.info('Post-confirmation completed', {
      username: event.userName,
      tenantId,
      userRole,
    });

    return event;
  } catch (error) {
    logger.error('Post-confirmation failed', {
      username: event.userName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    metrics.addMetric('ConfirmationFailure', MetricUnit.Count, 1);
    throw error;
  }
};

/**
 * Define Auth Challenge Trigger
 * Determines which challenge to present to the user
 */
export const defineAuthChallenge: DefineAuthChallengeTriggerHandler = async (event) => {
  logger.info('Define auth challenge trigger started', {
    username: event.userName,
    session: event.request.session.length,
  });

  try {
    const { userAttributes } = event.request;
    const mfaEnabled = userAttributes['phone_number_verified'] === 'true' || 
                      userAttributes['software_token_mfa_enabled'] === 'true';

    if (event.request.session.length === 0) {
      // First challenge - always password
      event.response.challengeName = 'SRP_A';
      event.response.issueTokens = false;
    } else if (event.request.session.length === 1 && 
               event.request.session[0].challengeName === 'SRP_A' && 
               event.request.session[0].challengeResult === true) {
      
      if (mfaEnabled) {
        // Second challenge - MFA if enabled
        event.response.challengeName = 'SOFTWARE_TOKEN_MFA';
        event.response.issueTokens = false;
      } else {
        // No MFA required - issue tokens
        event.response.challengeName = '';
        event.response.issueTokens = true;
      }
    } else if (event.request.session.length === 2 && 
               event.request.session[1].challengeName === 'SOFTWARE_TOKEN_MFA' && 
               event.request.session[1].challengeResult === true) {
      // MFA passed - issue tokens
      event.response.challengeName = '';
      event.response.issueTokens = true;
    } else {
      // Authentication failed
      event.response.challengeName = '';
      event.response.issueTokens = false;
    }

    logger.info('Define auth challenge completed', {
      username: event.userName,
      challengeName: event.response.challengeName,
      issueTokens: event.response.issueTokens,
    });

    return event;
  } catch (error) {
    logger.error('Define auth challenge failed', {
      username: event.userName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

/**
 * Create Auth Challenge Trigger
 * Creates the challenge to be presented to the user
 */
export const createAuthChallenge: CreateAuthChallengeTriggerHandler = async (event) => {
  logger.info('Create auth challenge trigger started', {
    username: event.userName,
    challengeName: event.request.challengeName,
  });

  try {
    if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
      // Custom challenge logic can be implemented here
      event.response.publicChallengeParameters = {
        trigger: 'true',
      };
      event.response.privateChallengeParameters = {
        answer: 'challenge-answer',
      };
    }

    logger.info('Create auth challenge completed', {
      username: event.userName,
      challengeName: event.request.challengeName,
    });

    return event;
  } catch (error) {
    logger.error('Create auth challenge failed', {
      username: event.userName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

/**
 * Verify Auth Challenge Response Trigger
 * Verifies the user's response to a challenge
 */
export const verifyAuthChallengeResponse: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  logger.info('Verify auth challenge response trigger started', {
    username: event.userName,
    challengeName: event.request.challengeName,
  });

  try {
    if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
      // Verify custom challenge response
      const expectedAnswer = event.request.privateChallengeParameters.answer;
      const providedAnswer = event.request.challengeAnswer;
      
      event.response.answerCorrect = expectedAnswer === providedAnswer;
    }

    logger.info('Verify auth challenge response completed', {
      username: event.userName,
      challengeName: event.request.challengeName,
      answerCorrect: event.response.answerCorrect,
    });

    return event;
  } catch (error) {
    logger.error('Verify auth challenge response failed', {
      username: event.userName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

// Helper functions
async function getTenant(tenantId: string): Promise<any> {
  try {
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: TENANTS_TABLE,
        Key: { tenantId },
      })
    );
    return result.Item;
  } catch (error) {
    logger.error('Failed to get tenant', { tenantId, error });
    return null;
  }
}

async function validateTenantUsage(tenantId: string): Promise<{ allowed: boolean; violations: string[] }> {
  try {
    // Placeholder for usage validation logic
    // This would check against SBT Basic Tier limits
    return { allowed: true, violations: [] };
  } catch (error) {
    logger.error('Failed to validate tenant usage', { tenantId, error });
    return { allowed: false, violations: ['Usage validation failed'] };
  }
}

async function recordAuthenticationAttempt(
  username: string,
  tenantId: string,
  type: string,
  error?: string
): Promise<void> {
  try {
    await dynamoClient.send(
      new PutCommand({
        TableName: USER_ANALYTICS_TABLE,
        Item: {
          pk: `USER#${username}`,
          sk: `AUTH#${Date.now()}`,
          tenantId,
          type,
          error,
          timestamp: new Date().toISOString(),
        },
      })
    );
  } catch (err) {
    logger.error('Failed to record authentication attempt', { username, tenantId, type, error: err });
  }
}

async function updateUserLastLogin(username: string, tenantId: string): Promise<void> {
  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: `CloudBPA-UserMetadata-${ENVIRONMENT}`,
        Key: { pk: `USER#${username}`, sk: '#METADATA' },
        UpdateExpression: 'SET lastLoginAt = :timestamp, loginCount = if_not_exists(loginCount, :zero) + :inc',
        ExpressionAttributeValues: {
          ':timestamp': new Date().toISOString(),
          ':zero': 0,
          ':inc': 1,
        },
      })
    );
  } catch (error) {
    logger.error('Failed to update user last login', { username, tenantId, error });
  }
}

async function recordLoginAnalytics(username: string, tenantId: string, userRole: string): Promise<void> {
  try {
    const now = new Date();
    const monthKey = now.toISOString().substring(0, 7); // YYYY-MM format

    await dynamoClient.send(
      new PutCommand({
        TableName: USER_ANALYTICS_TABLE,
        Item: {
          pk: `TENANT#${tenantId}`,
          sk: `LOGIN#${now.toISOString()}`,
          username,
          userRole,
          loginTime: now.toISOString(),
          month: monthKey,
          year: now.getFullYear(),
        },
      })
    );
  } catch (error) {
    logger.error('Failed to record login analytics', { username, tenantId, userRole, error });
  }
}

async function initializeUserAnalytics(username: string, tenantId: string, userRole: string): Promise<void> {
  try {
    await dynamoClient.send(
      new PutCommand({
        TableName: USER_ANALYTICS_TABLE,
        Item: {
          pk: `USER#${username}`,
          sk: '#PROFILE',
          tenantId,
          userRole,
          createdAt: new Date().toISOString(),
          lastLoginAt: null,
          loginCount: 0,
          analysisCount: 0,
        },
      })
    );
  } catch (error) {
    logger.error('Failed to initialize user analytics', { username, tenantId, userRole, error });
  }
}

async function getUserPermissions(userRole: string, tenantId: string): Promise<string[]> {
  const rolePermissions = {
    'SystemAdmin': [
      'admin:*',
      'tenant:*',
      'user:*',
      'framework:*',
      'analysis:*',
      'report:*',
    ],
    'FrameworkAdmin': [
      'framework:read',
      'framework:write',
      'framework:admin',
      'tenant:read',
      'analysis:read',
      'report:read',
    ],
    'ClientAdmin': [
      'tenant:read',
      'tenant:update',
      'user:read',
      'user:write',
      'project:*',
      'analysis:*',
      'report:*',
    ],
    'ProjectManager': [
      'project:read',
      'project:write',
      'project:admin',
      'analysis:*',
      'report:*',
      'user:read',
    ],
    'Analyst': [
      'project:read',
      'analysis:read',
      'analysis:write',
      'report:read',
      'report:write',
    ],
    'Viewer': [
      'project:read',
      'analysis:read',
      'report:read',
    ],
    'ClientEngineer': [
      'project:read',
      'analysis:read',
      'report:read',
    ],
  };

  return rolePermissions[userRole as keyof typeof rolePermissions] || rolePermissions['Viewer'];
}

function getTokenValidityByRole(userRole: string): number {
  const validityMinutes = {
    'SystemAdmin': 480, // 8 hours
    'FrameworkAdmin': 480, // 8 hours
    'ClientAdmin': 240, // 4 hours
    'ProjectManager': 180, // 3 hours
    'Analyst': 120, // 2 hours
    'Viewer': 60, // 1 hour
    'ClientEngineer': 60, // 1 hour
  };

  return validityMinutes[userRole as keyof typeof validityMinutes] || 60;
}

async function publishAuthEvent(eventType: string, eventData: any): Promise<void> {
  try {
    const event = {
      Source: 'cloudbpa.auth',
      DetailType: eventType,
      Detail: JSON.stringify({
        ...eventData,
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
  } catch (error) {
    logger.error('Failed to publish auth event', { eventType, eventData, error });
  }
}