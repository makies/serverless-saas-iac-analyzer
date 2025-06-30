import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminDeleteUserCommand, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'tenant-management' });
const tracer = new Tracer({ serviceName: 'tenant-management' });
const metrics = new Metrics({ serviceName: 'tenant-management', namespace: 'CloudBPA/SBT' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});
const cognitoClient = new CognitoIdentityProviderClient({});

// Environment variables
const TENANTS_TABLE = process.env.SBT_TENANTS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const USER_POOL_ID = process.env.USER_POOL_ID!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface TenantRecord {
  tenantId: string;
  tenantName: string;
  adminEmail: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  subscription: {
    monthlyAnalysesLimit: number;
    maxFileSizeMB: number;
    retentionDays: number;
    maxConcurrentAnalyses: number;
  };
  settings: {
    allowClientAccess: boolean;
    defaultAnalysisType: string;
    notificationSettings: {
      analysisComplete: boolean;
      quotaWarning: boolean;
      systemAlerts: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('tenant-management');

  try {
    logger.appendKeys({
      requestId: event.requestContext.requestId,
      stage: event.requestContext.stage,
    });
    logger.info('Processing tenant management request', {
      httpMethod: event.httpMethod,
      resourcePath: event.resource,
      pathParameters: event.pathParameters,
    });

    const { httpMethod, resource } = event;
    const pathParameters = event.pathParameters || {};

    let result: APIGatewayProxyResult;

    switch (`${httpMethod} ${resource}`) {
      case 'GET /tenants':
        result = await listTenants(event);
        break;
      case 'POST /tenants':
        result = await createTenant(event);
        break;
      case 'GET /tenants/{tenantId}':
        result = await getTenant(pathParameters.tenantId!);
        break;
      case 'PUT /tenants/{tenantId}':
        result = await updateTenant(pathParameters.tenantId!, event);
        break;
      case 'DELETE /tenants/{tenantId}':
        result = await deleteTenant(pathParameters.tenantId!);
        break;
      default:
        result = {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Not Found',
            message: `Route not found: ${httpMethod} ${resource}`,
          }),
        };
    }

    metrics.addMetric('RequestSuccess', MetricUnit.Count, 1);
    return result;

  } catch (error) {
    logger.error('Tenant management request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    metrics.addMetric('RequestError', MetricUnit.Count, 1);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };

  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function listTenants(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
  const lastEvaluatedKey = queryParams.nextToken ? JSON.parse(decodeURIComponent(queryParams.nextToken)) : undefined;
  const status = queryParams.status;

  let queryCommand;

  if (status) {
    // Query by status using GSI
    queryCommand = new QueryCommand({
      TableName: TENANTS_TABLE,
      IndexName: 'ByStatus',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });
  } else {
    // Scan all tenants
    queryCommand = new QueryCommand({
      TableName: TENANTS_TABLE,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    });
  }

  const result = await dynamoClient.send(queryCommand);

  const response = {
    tenants: result.Items || [],
    nextToken: result.LastEvaluatedKey 
      ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
      : null,
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(response),
  };
}

async function createTenant(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { tenantName, adminEmail, tier = 'BASIC' } = body;

  if (!tenantName || !adminEmail) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'tenantName and adminEmail are required',
      }),
    };
  }

  const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  // Define tier-based limits (SBT Basic Tier constraints)
  const tierLimits = {
    BASIC: {
      monthlyAnalysesLimit: 100,
      maxFileSizeMB: 10,
      retentionDays: 90,
      maxConcurrentAnalyses: 5,
    },
    PREMIUM: {
      monthlyAnalysesLimit: 500,
      maxFileSizeMB: 50,
      retentionDays: 365,
      maxConcurrentAnalyses: 10,
    },
    ENTERPRISE: {
      monthlyAnalysesLimit: -1, // unlimited
      maxFileSizeMB: 100,
      retentionDays: 2555, // 7 years
      maxConcurrentAnalyses: 20,
    },
  };

  const tenantRecord: TenantRecord = {
    tenantId,
    tenantName,
    adminEmail,
    status: 'ACTIVE',
    tier,
    subscription: tierLimits[tier as keyof typeof tierLimits],
    settings: {
      allowClientAccess: false,
      defaultAnalysisType: 'CDK',
      notificationSettings: {
        analysisComplete: true,
        quotaWarning: true,
        systemAlerts: true,
      },
    },
    createdAt: now,
    updatedAt: now,
    createdBy: event.requestContext.identity?.cognitoIdentityId || 'system',
  };

  // Save to DynamoDB
  await dynamoClient.send(new PutCommand({
    TableName: TENANTS_TABLE,
    Item: tenantRecord,
    ConditionExpression: 'attribute_not_exists(tenantId)',
  }));

  // Create Cognito user for tenant admin
  try {
    await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: adminEmail,
      UserAttributes: [
        { Name: 'email', Value: adminEmail },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:tenantId', Value: tenantId },
        { Name: 'custom:role', Value: 'ClientAdmin' },
        { Name: 'custom:projectIds', Value: '[]' },
      ],
      MessageAction: 'SUPPRESS', // We'll send custom invitation
      TemporaryPassword: generateTemporaryPassword(),
    }));

    // Add user to ClientAdmins group
    await cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: adminEmail,
      GroupName: 'ClientAdmins',
    }));

  } catch (cognitoError) {
    logger.warn('Failed to create Cognito user', {
      tenantId,
      adminEmail,
      error: cognitoError instanceof Error ? cognitoError.message : 'Unknown Cognito error',
    });
    // Continue with tenant creation even if Cognito user creation fails
  }

  // Publish tenant creation event
  await publishTenantEvent('Tenant Created', tenantRecord);

  logger.info('Tenant created successfully', {
    tenantId,
    tenantName,
    adminEmail,
    tier,
  });

  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      tenantId,
      message: 'Tenant created successfully',
      tenant: tenantRecord,
    }),
  };
}

async function getTenant(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await dynamoClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenantId },
  }));

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Not Found',
        message: `Tenant with ID ${tenantId} not found`,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(result.Item),
  };
}

async function updateTenant(tenantId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { tenantName, status, settings } = body;

  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  if (tenantName) {
    updateExpression.push('#tenantName = :tenantName');
    expressionAttributeNames['#tenantName'] = 'tenantName';
    expressionAttributeValues[':tenantName'] = tenantName;
  }

  if (status) {
    updateExpression.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;
  }

  if (settings) {
    updateExpression.push('#settings = :settings');
    expressionAttributeNames['#settings'] = 'settings';
    expressionAttributeValues[':settings'] = settings;
  }

  updateExpression.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  if (updateExpression.length === 1) { // Only updatedAt
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Bad Request',
        message: 'No valid fields to update',
      }),
    };
  }

  const result = await dynamoClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenantId },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
    ConditionExpression: 'attribute_exists(tenantId)',
  }));

  // Publish tenant update event
  await publishTenantEvent('Tenant Updated', result.Attributes as TenantRecord);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Tenant updated successfully',
      tenant: result.Attributes,
    }),
  };
}

async function deleteTenant(tenantId: string): Promise<APIGatewayProxyResult> {
  // Get tenant before deletion for event publishing
  const getResult = await dynamoClient.send(new GetCommand({
    TableName: TENANTS_TABLE,
    Key: { tenantId },
  }));

  if (!getResult.Item) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Not Found',
        message: `Tenant with ID ${tenantId} not found`,
      }),
    };
  }

  // Soft delete by updating status
  await dynamoClient.send(new UpdateCommand({
    TableName: TENANTS_TABLE,
    Key: { tenantId },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':status': 'ARCHIVED',
      ':updatedAt': new Date().toISOString(),
    },
  }));

  // Delete associated Cognito user
  try {
    const tenant = getResult.Item as TenantRecord;
    await cognitoClient.send(new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: tenant.adminEmail,
    }));
  } catch (cognitoError) {
    logger.warn('Failed to delete Cognito user', {
      tenantId,
      error: cognitoError instanceof Error ? cognitoError.message : 'Unknown Cognito error',
    });
  }

  // Publish tenant deletion event
  await publishTenantEvent('Tenant Deleted', getResult.Item as TenantRecord);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Tenant deleted successfully',
      tenantId,
    }),
  };
}

async function publishTenantEvent(eventType: string, tenant: TenantRecord): Promise<void> {
  const event = {
    Source: 'sbt.controlplane',
    DetailType: eventType,
    Detail: JSON.stringify({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      adminEmail: tenant.adminEmail,
      status: tenant.status,
      tier: tenant.tier,
      timestamp: new Date().toISOString(),
      environment: ENVIRONMENT,
    }),
    EventBusName: EVENT_BUS_NAME,
  };

  await eventBridgeClient.send(new PutEventsCommand({
    Entries: [event],
  }));

  logger.info('Published tenant event', {
    eventType,
    tenantId: tenant.tenantId,
    eventBusName: EVENT_BUS_NAME,
  });
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
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}