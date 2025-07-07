/**
 * Update User Profile Mutation Resolver
 * Updates the current user's profile information
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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

interface UpdateUserProfileArgs {
  firstName?: string;
  lastName?: string;
  preferences?: {
    language?: string;
    timezone?: string;
    emailNotifications?: boolean;
    theme?: string;
  };
}

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

const updateUserProfile: AppSyncResolverHandler<UpdateUserProfileArgs, UserProfile> = async (event) => {
  const { arguments: args, identity } = event;
  const { firstName, lastName, preferences } = args;

  const userId = (identity as any)?.sub;
  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userEmail = (identity as any)?.claims?.email;

  if (!userId) {
    throw new Error('User not authenticated');
  }

  logger.info('UpdateUserProfile mutation started', {
    userId,
    userTenantId,
    hasFirstName: !!firstName,
    hasLastName: !!lastName,
    hasPreferences: !!preferences,
  });

  try {
    // First, get the existing user profile
    const getCommand = new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: {
        pk: `USER#${userId}`,
        sk: '#METADATA',
      },
    });

    const existingResult = await ddbDocClient.send(getCommand);
    let existingUser = existingResult.Item;

    // If user doesn't exist, create a new profile
    if (!existingUser) {
      existingUser = {
        userId,
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
        createdAt: new Date().toISOString(),
      };
    }

    const now = new Date().toISOString();

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (firstName !== undefined) {
      updateExpressions.push('#firstName = :firstName');
      expressionAttributeNames['#firstName'] = 'firstName';
      expressionAttributeValues[':firstName'] = firstName;
    }

    if (lastName !== undefined) {
      updateExpressions.push('#lastName = :lastName');
      expressionAttributeNames['#lastName'] = 'lastName';
      expressionAttributeValues[':lastName'] = lastName;
    }

    if (preferences) {
      const currentPreferences = existingUser.preferences || {};
      const updatedPreferences = {
        ...currentPreferences,
        ...preferences,
      };

      updateExpressions.push('#preferences = :preferences');
      expressionAttributeNames['#preferences'] = 'preferences';
      expressionAttributeValues[':preferences'] = updatedPreferences;
    }

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    if (updateExpressions.length === 1) {
      // Only updatedAt was updated, no actual changes
      logger.info('No profile changes to apply', { userId });
      return {
        id: existingUser.userId,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        role: existingUser.role,
        tenantId: existingUser.tenantId,
        projectIds: existingUser.projectIds || [],
        preferences: existingUser.preferences,
        lastLoginAt: existingUser.lastLoginAt,
      };
    }

    const updateCommand = new UpdateCommand({
      TableName: process.env.USERS_TABLE!,
      Key: {
        pk: `USER#${userId}`,
        sk: '#METADATA',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await ddbDocClient.send(updateCommand);
    const updatedUser = result.Attributes;

    const profile: UserProfile = {
      id: updatedUser!.userId,
      email: updatedUser!.email,
      firstName: updatedUser!.firstName,
      lastName: updatedUser!.lastName,
      role: updatedUser!.role,
      tenantId: updatedUser!.tenantId,
      projectIds: updatedUser!.projectIds || [],
      preferences: updatedUser!.preferences,
      lastLoginAt: updatedUser!.lastLoginAt,
    };

    logger.info('UpdateUserProfile mutation completed', {
      userId,
      tenantId: profile.tenantId,
      updatedFields: Object.keys(args).filter(key => args[key as keyof UpdateUserProfileArgs] !== undefined),
    });

    return profile;
  } catch (error: any) {
    logger.error('Error updating user profile', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw new Error('Failed to update user profile');
  }
};

// Export the handler with middleware
export const handler = middy(updateUserProfile)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));