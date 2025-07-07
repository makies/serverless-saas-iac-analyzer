/**
 * Get User Profile Query Resolver
 * Retrieves the current user's profile information
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'UserService' });
const tracer = new Tracer({ serviceName: 'UserService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  projectIds: string[];
  preferences?: {
    language: string;
    timezone: string;
    emailNotifications: boolean;
    theme: string;
  };
  lastLoginAt?: string;
}

const getUserProfile: AppSyncResolverHandler<{}, UserProfile> = async (event) => {
  const { identity } = event;

  const userId = (identity as any)?.sub;
  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userEmail = (identity as any)?.claims?.email;

  if (!userId) {
    throw new Error('User not authenticated');
  }

  logger.info('GetUserProfile query started', {
    userId,
    userTenantId,
    userRole,
  });

  try {
    const command = new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: {
        pk: `USER#${userId}`,
        sk: '#METADATA',
      },
    });

    const result = await ddbDocClient.send(command);

    if (!result.Item) {
      // If user doesn't exist in our database, create a minimal profile from JWT claims
      logger.info('User not found in database, creating profile from JWT claims', {
        userId,
        userEmail,
        userTenantId,
      });

      const profile: UserProfile = {
        id: userId,
        email: userEmail || '',
        firstName: (identity as any)?.claims?.given_name || '',
        lastName: (identity as any)?.claims?.family_name || '',
        role: userRole || 'VIEWER',
        tenantId: userTenantId || '',
        projectIds: [],
        preferences: {
          language: 'en',
          timezone: 'UTC',
          emailNotifications: true,
          theme: 'light',
        },
      };

      return profile;
    }

    const user = result.Item;

    const profile: UserProfile = {
      id: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      projectIds: user.projectIds || [],
      preferences: user.preferences,
      lastLoginAt: user.lastLoginAt,
    };

    // Update last login time
    const updateCommand = new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: {
        pk: `USER#${userId}`,
        sk: '#METADATA',
      },
    });

    try {
      await ddbDocClient.send(updateCommand);
    } catch (updateError) {
      logger.warn('Failed to update last login time', {
        userId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }

    logger.info('GetUserProfile query completed', {
      userId,
      tenantId: profile.tenantId,
      role: profile.role,
      projectCount: profile.projectIds.length,
    });

    return profile;
  } catch (error: any) {
    logger.error('Error getting user profile', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw new Error('Failed to get user profile');
  }
};

// Export the handler with middleware
export const handler = middy(getUserProfile)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));