/**
 * Cognito Integration Lambda Function
 * Handles user management, tenant assignment, and role-based access control
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  ListUsersInGroupCommand,
  AdminListGroupsForUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cognito-integration' });
const tracer = new Tracer({ serviceName: 'cognito-integration' });
const metrics = new Metrics({ serviceName: 'cognito-integration', namespace: 'CloudBPA/Auth' });

// AWS Clients
const cognitoClient = new CognitoIdentityProviderClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});

// Environment variables
const USER_POOL_ID = process.env.USER_POOL_ID!;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;
const TENANTS_TABLE = process.env.SBT_TENANTS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface CreateUserRequest {
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  projectIds?: string[];
  temporaryPassword?: string;
  sendInvitation?: boolean;
}

interface UserResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  role: string;
  projectIds: string[];
  status: string;
  groups: string[];
  createdAt: string;
  lastLoginAt?: string;
}

interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: string;
  projectIds?: string[];
  status?: 'ACTIVE' | 'INACTIVE';
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('cognito-integration');

  try {
    logger.appendKeys({
      requestId: event.requestContext.requestId,
      stage: event.requestContext.stage,
    });

    const { httpMethod, resource, pathParameters, queryStringParameters } = event;
    const userRole = (event.requestContext.identity as any)?.claims?.['custom:role'];
    const userTenantId = (event.requestContext.identity as any)?.claims?.['custom:tenantId'];

    // Authorization check
    if (!['SystemAdmin', 'ClientAdmin'].includes(userRole)) {
      return createErrorResponse(403, 'Insufficient permissions for user management');
    }

    let result: APIGatewayProxyResult;

    switch (`${httpMethod} ${resource}`) {
      case 'POST /users':
        result = await createUser(event, userTenantId, userRole);
        break;
      case 'GET /users':
        result = await listUsers(queryStringParameters, userTenantId, userRole);
        break;
      case 'GET /users/{userId}':
        result = await getUser(pathParameters!.userId!, userTenantId, userRole);
        break;
      case 'PUT /users/{userId}':
        result = await updateUser(pathParameters!.userId!, event, userTenantId, userRole);
        break;
      case 'DELETE /users/{userId}':
        result = await deleteUser(pathParameters!.userId!, userTenantId, userRole);
        break;
      case 'POST /users/{userId}/reset-password':
        result = await resetUserPassword(pathParameters!.userId!, userTenantId, userRole);
        break;
      case 'POST /users/{userId}/change-role':
        result = await changeUserRole(pathParameters!.userId!, event, userTenantId, userRole);
        break;
      case 'GET /groups':
        result = await listGroups();
        break;
      case 'GET /groups/{groupName}/users':
        result = await listUsersInGroup(pathParameters!.groupName!, userTenantId, userRole);
        break;
      default:
        result = createErrorResponse(404, `Route not found: ${httpMethod} ${resource}`);
    }

    metrics.addMetric('CognitoRequestSuccess', MetricUnit.Count, 1);
    return result;
  } catch (error) {
    logger.error('Cognito integration request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    metrics.addMetric('CognitoRequestError', MetricUnit.Count, 1);
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function createUser(
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  const body: CreateUserRequest = JSON.parse(event.body || '{}');
  const { tenantId, email, firstName, lastName, role, projectIds = [], temporaryPassword, sendInvitation = true } = body;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    return createErrorResponse(403, 'Cannot create users for different tenant');
  }

  // Validate tenant exists
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return createErrorResponse(404, 'Tenant not found');
  }

  // Validate role
  if (!isValidRole(role)) {
    return createErrorResponse(400, 'Invalid role specified');
  }

  try {
    // Generate temporary password if not provided
    const tempPassword = temporaryPassword || generateTemporaryPassword();

    // Create user in Cognito
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
        { Name: 'custom:tenantId', Value: tenantId },
        { Name: 'custom:role', Value: role },
        { Name: 'custom:projectIds', Value: JSON.stringify(projectIds) },
      ],
      MessageAction: sendInvitation ? 'RESEND' : 'SUPPRESS',
      TemporaryPassword: tempPassword,
    });

    const result = await cognitoClient.send(createCommand);

    // Add user to appropriate group
    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: getRoleGroupName(role),
      })
    );

    // Store user metadata in DynamoDB
    await storeUserMetadata({
      userId: result.User!.Username!,
      email,
      firstName,
      lastName,
      tenantId,
      role,
      projectIds,
      createdAt: new Date().toISOString(),
      createdBy: (event.requestContext.identity as any)?.claims?.sub || 'system',
    });

    // Publish user creation event
    await publishUserEvent('User Created', {
      userId: result.User!.Username!,
      email,
      tenantId,
      role,
      createdBy: (event.requestContext.identity as any)?.claims?.sub || 'system',
    });

    metrics.addMetric('UserCreated', MetricUnit.Count, 1);

    const userResponse: UserResponse = {
      userId: result.User!.Username!,
      email,
      firstName,
      lastName,
      tenantId,
      role,
      projectIds,
      status: result.User!.UserStatus!,
      groups: [getRoleGroupName(role)],
      createdAt: result.User!.UserCreateDate!.toISOString(),
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'User created successfully',
        user: userResponse,
        temporaryPassword: !sendInvitation ? tempPassword : undefined,
      }),
    };
  } catch (error: any) {
    if (error.name === 'UsernameExistsException') {
      return createErrorResponse(409, 'User with this email already exists');
    }
    throw error;
  }
}

async function listUsers(
  queryParams: any,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  const tenantId = queryParams?.tenantId || userTenantId;
  const role = queryParams?.role;
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 50;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    return createErrorResponse(403, 'Cannot list users from different tenant');
  }

  try {
    let filter = '';
    if (role) {
      filter = `custom:role = "${role}"`;
    }

    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: limit,
      Filter: filter,
    });

    const result = await cognitoClient.send(command);
    const users = result.Users || [];

    // Filter by tenant
    const filteredUsers = users.filter(user => {
      const userTenant = user.Attributes?.find(attr => attr.Name === 'custom:tenantId')?.Value;
      return userTenant === tenantId;
    });

    const userResponses: UserResponse[] = await Promise.all(
      filteredUsers.map(async (user) => {
        const groups = await getUserGroups(user.Username!);
        return mapCognitoUserToResponse(user, groups);
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        users: userResponses,
        count: userResponses.length,
        hasMore: !!result.PaginationToken,
      }),
    };
  } catch (error) {
    throw error;
  }
}

async function getUser(
  userId: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId,
    });

    const result = await cognitoClient.send(command);
    const userTenant = result.UserAttributes?.find(attr => attr.Name === 'custom:tenantId')?.Value;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && userTenantId !== userTenant) {
      return createErrorResponse(403, 'Cannot access user from different tenant');
    }

    const groups = await getUserGroups(userId);
    const userResponse = mapCognitoUserToResponse(
      {
        Username: result.Username,
        Attributes: result.UserAttributes,
        UserStatus: result.UserStatus,
        UserCreateDate: result.UserCreateDate,
        UserLastModifiedDate: result.UserLastModifiedDate,
      },
      groups
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(userResponse),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return createErrorResponse(404, 'User not found');
    }
    throw error;
  }
}

async function updateUser(
  userId: string,
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  const body: UpdateUserRequest = JSON.parse(event.body || '{}');
  const { firstName, lastName, role, projectIds, status } = body;

  try {
    // Get current user to check tenant
    const currentUser = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      })
    );

    const userTenant = currentUser.UserAttributes?.find(attr => attr.Name === 'custom:tenantId')?.Value;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && userTenantId !== userTenant) {
      return createErrorResponse(403, 'Cannot update user from different tenant');
    }

    const attributes = [];

    if (firstName) attributes.push({ Name: 'given_name', Value: firstName });
    if (lastName) attributes.push({ Name: 'family_name', Value: lastName });
    if (role) {
      if (!isValidRole(role)) {
        return createErrorResponse(400, 'Invalid role specified');
      }
      attributes.push({ Name: 'custom:role', Value: role });
    }
    if (projectIds) attributes.push({ Name: 'custom:projectIds', Value: JSON.stringify(projectIds) });

    if (attributes.length > 0) {
      await cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: userId,
          UserAttributes: attributes,
        })
      );
    }

    // Update role group membership
    if (role) {
      const currentRole = currentUser.UserAttributes?.find(attr => attr.Name === 'custom:role')?.Value;
      if (currentRole && currentRole !== role) {
        // Remove from old group
        try {
          await cognitoClient.send(
            new AdminRemoveUserFromGroupCommand({
              UserPoolId: USER_POOL_ID,
              Username: userId,
              GroupName: getRoleGroupName(currentRole),
            })
          );
        } catch (error) {
          logger.warn('Failed to remove user from old group', { userId, oldRole: currentRole });
        }

        // Add to new group
        await cognitoClient.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: userId,
            GroupName: getRoleGroupName(role),
          })
        );
      }
    }

    // Handle status change
    if (status) {
      if (status === 'ACTIVE') {
        await cognitoClient.send(
          new AdminEnableUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: userId,
          })
        );
      } else if (status === 'INACTIVE') {
        await cognitoClient.send(
          new AdminDisableUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: userId,
          })
        );
      }
    }

    // Update user metadata in DynamoDB
    await updateUserMetadata(userId, body);

    // Publish user update event
    await publishUserEvent('User Updated', {
      userId,
      tenantId: userTenant!,
      updatedFields: Object.keys(body),
      updatedBy: (event.requestContext.identity as any)?.claims?.sub || 'system',
    });

    metrics.addMetric('UserUpdated', MetricUnit.Count, 1);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'User updated successfully',
        userId,
      }),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return createErrorResponse(404, 'User not found');
    }
    throw error;
  }
}

async function deleteUser(
  userId: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    // Get current user to check tenant
    const currentUser = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      })
    );

    const userTenant = currentUser.UserAttributes?.find(attr => attr.Name === 'custom:tenantId')?.Value;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && userTenantId !== userTenant) {
      return createErrorResponse(403, 'Cannot delete user from different tenant');
    }

    // Delete user from Cognito
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      })
    );

    // Remove user metadata from DynamoDB
    await removeUserMetadata(userId);

    // Publish user deletion event
    await publishUserEvent('User Deleted', {
      userId,
      tenantId: userTenant!,
      deletedBy: (event.requestContext.identity as any)?.claims?.sub || 'system',
    });

    metrics.addMetric('UserDeleted', MetricUnit.Count, 1);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'User deleted successfully',
        userId,
      }),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return createErrorResponse(404, 'User not found');
    }
    throw error;
  }
}

async function resetUserPassword(
  userId: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    // Get current user to check tenant
    const currentUser = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      })
    );

    const userTenant = currentUser.UserAttributes?.find(attr => attr.Name === 'custom:tenantId')?.Value;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && userTenantId !== userTenant) {
      return createErrorResponse(403, 'Cannot reset password for user from different tenant');
    }

    const temporaryPassword = generateTemporaryPassword();

    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
        Password: temporaryPassword,
        Permanent: false,
      })
    );

    // Publish password reset event
    await publishUserEvent('Password Reset', {
      userId,
      tenantId: userTenant!,
      resetBy: (event.requestContext.identity as any)?.claims?.sub || 'system',
    });

    metrics.addMetric('PasswordReset', MetricUnit.Count, 1);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Password reset successfully',
        temporaryPassword,
      }),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return createErrorResponse(404, 'User not found');
    }
    throw error;
  }
}

async function changeUserRole(
  userId: string,
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { role: newRole, projectIds } = body;

  if (!isValidRole(newRole)) {
    return createErrorResponse(400, 'Invalid role specified');
  }

  try {
    // Get current user to check tenant and current role
    const currentUser = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      })
    );

    const userTenant = currentUser.UserAttributes?.find(attr => attr.Name === 'custom:tenantId')?.Value;
    const currentRole = currentUser.UserAttributes?.find(attr => attr.Name === 'custom:role')?.Value;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && userTenantId !== userTenant) {
      return createErrorResponse(403, 'Cannot change role for user from different tenant');
    }

    // Update role attribute
    await cognitoClient.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
        UserAttributes: [
          { Name: 'custom:role', Value: newRole },
          { Name: 'custom:projectIds', Value: JSON.stringify(projectIds || []) },
        ],
      })
    );

    // Update group membership
    if (currentRole) {
      try {
        await cognitoClient.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: userId,
            GroupName: getRoleGroupName(currentRole),
          })
        );
      } catch (error) {
        logger.warn('Failed to remove user from old group', { userId, oldRole: currentRole });
      }
    }

    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
        GroupName: getRoleGroupName(newRole),
      })
    );

    // Update user metadata
    await updateUserMetadata(userId, { role: newRole, projectIds });

    // Publish role change event
    await publishUserEvent('Role Changed', {
      userId,
      tenantId: userTenant!,
      oldRole: currentRole,
      newRole,
      changedBy: (event.requestContext.identity as any)?.claims?.sub || 'system',
    });

    metrics.addMetric('RoleChanged', MetricUnit.Count, 1);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'User role changed successfully',
        userId,
        newRole,
        projectIds,
      }),
    };
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return createErrorResponse(404, 'User not found');
    }
    throw error;
  }
}

async function listGroups(): Promise<APIGatewayProxyResult> {
  const groups = [
    'SystemAdmins',
    'FrameworkAdmins', 
    'ClientAdmins',
    'ProjectManagers',
    'Analysts',
    'Viewers',
    'ClientEngineers',
  ];

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      groups: groups.map(name => ({
        name,
        description: `${name} group`,
      })),
    }),
  };
}

async function listUsersInGroup(
  groupName: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    const command = new ListUsersInGroupCommand({
      UserPoolId: USER_POOL_ID,
      GroupName: groupName,
    });

    const result = await cognitoClient.send(command);
    const users = result.Users || [];

    // Filter by tenant
    const filteredUsers = users.filter(user => {
      const userTenant = user.Attributes?.find(attr => attr.Name === 'custom:tenantId')?.Value;
      return userRole === 'SystemAdmin' || userTenant === userTenantId;
    });

    const userResponses: UserResponse[] = filteredUsers.map(user => 
      mapCognitoUserToResponse(user, [groupName])
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        group: groupName,
        users: userResponses,
        count: userResponses.length,
      }),
    };
  } catch (error) {
    throw error;
  }
}

// Helper functions
function createErrorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: getErrorType(statusCode),
      message,
    }),
  };
}

function getErrorType(statusCode: number): string {
  const errorTypes = {
    400: 'Bad Request',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    500: 'Internal Server Error',
  };
  return errorTypes[statusCode as keyof typeof errorTypes] || 'Error';
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

function isValidRole(role: string): boolean {
  const validRoles = [
    'SystemAdmin',
    'FrameworkAdmin',
    'ClientAdmin',
    'ProjectManager',
    'Analyst',
    'Viewer',
    'ClientEngineer',
  ];
  return validRoles.includes(role);
}

function getRoleGroupName(role: string): string {
  const groupMap = {
    'SystemAdmin': 'SystemAdmins',
    'FrameworkAdmin': 'FrameworkAdmins',
    'ClientAdmin': 'ClientAdmins',
    'ProjectManager': 'ProjectManagers',
    'Analyst': 'Analysts',
    'Viewer': 'Viewers',
    'ClientEngineer': 'ClientEngineers',
  };
  return groupMap[role as keyof typeof groupMap] || 'Viewers';
}

async function getUserGroups(username: string): Promise<string[]> {
  try {
    const command = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    const result = await cognitoClient.send(command);
    return result.Groups?.map(group => group.GroupName!) || [];
  } catch (error) {
    logger.warn('Failed to get user groups', { username, error });
    return [];
  }
}

function mapCognitoUserToResponse(user: any, groups: string[]): UserResponse {
  const getAttribute = (name: string) => 
    user.Attributes?.find((attr: any) => attr.Name === name)?.Value || '';

  return {
    userId: user.Username!,
    email: getAttribute('email'),
    firstName: getAttribute('given_name'),
    lastName: getAttribute('family_name'),
    tenantId: getAttribute('custom:tenantId'),
    role: getAttribute('custom:role'),
    projectIds: JSON.parse(getAttribute('custom:projectIds') || '[]'),
    status: user.UserStatus!,
    groups,
    createdAt: user.UserCreateDate?.toISOString() || new Date().toISOString(),
    lastLoginAt: user.UserLastModifiedDate?.toISOString(),
  };
}

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

async function storeUserMetadata(userData: any): Promise<void> {
  try {
    await dynamoClient.send(
      new PutCommand({
        TableName: `CloudBPA-UserMetadata-${ENVIRONMENT}`,
        Item: {
          pk: `USER#${userData.userId}`,
          sk: '#METADATA',
          ...userData,
        },
      })
    );
  } catch (error) {
    logger.error('Failed to store user metadata', { userData, error });
  }
}

async function updateUserMetadata(userId: string, updateData: any): Promise<void> {
  try {
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

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await dynamoClient.send(
      new UpdateCommand({
        TableName: `CloudBPA-UserMetadata-${ENVIRONMENT}`,
        Key: { pk: `USER#${userId}`, sk: '#METADATA' },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  } catch (error) {
    logger.error('Failed to update user metadata', { userId, updateData, error });
  }
}

async function removeUserMetadata(userId: string): Promise<void> {
  try {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: `CloudBPA-UserMetadata-${ENVIRONMENT}`,
        Key: { pk: `USER#${userId}`, sk: '#METADATA' },
        UpdateExpression: 'SET #deleted = :deleted, #deletedAt = :deletedAt',
        ExpressionAttributeNames: {
          '#deleted': 'deleted',
          '#deletedAt': 'deletedAt',
        },
        ExpressionAttributeValues: {
          ':deleted': true,
          ':deletedAt': new Date().toISOString(),
        },
      })
    );
  } catch (error) {
    logger.error('Failed to remove user metadata', { userId, error });
  }
}

async function publishUserEvent(eventType: string, eventData: any): Promise<void> {
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
    logger.error('Failed to publish user event', { eventType, eventData, error });
  }
}