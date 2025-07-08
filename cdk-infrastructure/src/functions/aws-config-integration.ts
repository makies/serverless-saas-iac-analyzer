/**
 * AWS Config Integration Lambda Function
 * Handles configuration monitoring, compliance evaluation, and resource discovery
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  ConfigServiceClient,
  DescribeConfigurationRecordersCommand,
  DescribeConfigRulesCommand,
  GetComplianceDetailsByConfigRuleCommand,
  GetResourceConfigHistoryCommand,
  ListDiscoveredResourcesCommand,
  PutConfigRuleCommand,
  DeleteConfigRuleCommand,
  StartConfigurationRecorderCommand,
  StopConfigurationRecorderCommand,
  DescribeComplianceByConfigRuleCommand,
  GetDiscoveredResourceCountsCommand,
  BatchGetResourceConfigCommand,
  ResourceType,
  ResourceKey,
} from '@aws-sdk/client-config-service';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cloud-bpa' });
const tracer = new Tracer({ serviceName: 'cloud-bpa' });
const metrics = new Metrics({ serviceName: 'cloud-bpa', namespace: 'CloudBPA/Config' });

// AWS Clients
const configClient = new ConfigServiceClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});
const stsClient = new STSClient({});

// Environment variables
const RESOURCE_INVENTORY_TABLE = process.env.RESOURCE_INVENTORY_TABLE!;
const COMPLIANCE_RESULTS_TABLE = process.env.COMPLIANCE_RESULTS_TABLE!;
const CONFIG_RULES_TABLE = process.env.CONFIG_RULES_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface ConfigDiscoveryRequest {
  tenantId: string;
  projectId: string;
  awsAccountId: string;
  awsRegions: string[];
  resourceTypes?: string[];
  roleArn?: string;
  discoveryMode: 'full' | 'incremental' | 'targeted';
}

interface ComplianceEvaluationRequest {
  tenantId: string;
  projectId: string;
  awsAccountId: string;
  frameworks: string[];
  resourceFilters?: {
    resourceTypes?: string[];
    tags?: Record<string, string>;
  };
}

interface ResourceInventoryResult {
  tenantId: string;
  projectId: string;
  accountId: string;
  region: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  resourceArn: string;
  configuration: any;
  tags: Record<string, string>;
  compliance: {
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
    evaluationCount: number;
    lastEvaluatedTime: string;
  };
  discoveredAt: string;
  lastUpdated: string;
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('aws-config-integration');

  try {
    logger.appendKeys({
      requestId: event.requestContext.requestId,
      stage: event.requestContext.stage,
    });

    const { httpMethod, resource, pathParameters, queryStringParameters } = event;
    const userRole = (event.requestContext.identity as any)?.claims?.['custom:role'];
    const userTenantId = (event.requestContext.identity as any)?.claims?.['custom:tenantId'];

    // Authorization check
    if (!['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst'].includes(userRole)) {
      return createErrorResponse(403, 'Insufficient permissions for Config operations');
    }

    let result: APIGatewayProxyResult;

    switch (`${httpMethod} ${resource}`) {
      case 'POST /config/discovery':
        result = await startResourceDiscovery(event, userTenantId, userRole);
        break;
      case 'GET /config/resources':
        result = await getResourceInventory(queryStringParameters, userTenantId, userRole);
        break;
      case 'GET /config/resources/{resourceId}':
        result = await getResourceDetails(pathParameters!.resourceId!, queryStringParameters, userTenantId, userRole);
        break;
      case 'POST /config/compliance/evaluate':
        result = await evaluateCompliance(event, userTenantId, userRole);
        break;
      case 'GET /config/compliance':
        result = await getComplianceResults(queryStringParameters, userTenantId, userRole);
        break;
      case 'POST /config/rules':
        result = await createConfigRule(event, userTenantId, userRole);
        break;
      case 'GET /config/rules':
        result = await listConfigRules(queryStringParameters, userTenantId, userRole);
        break;
      case 'DELETE /config/rules/{ruleName}':
        result = await deleteConfigRule(pathParameters!.ruleName!, userTenantId, userRole);
        break;
      case 'GET /config/statistics':
        result = await getDiscoveryStatistics(queryStringParameters, userTenantId, userRole);
        break;
      default:
        result = createErrorResponse(404, `Route not found: ${httpMethod} ${resource}`);
    }

    metrics.addMetric('ConfigRequestSuccess', MetricUnit.Count, 1);
    return result;
  } catch (error) {
    logger.error('Config integration request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    metrics.addMetric('ConfigRequestError', MetricUnit.Count, 1);
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function startResourceDiscovery(
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  const body: ConfigDiscoveryRequest = JSON.parse(event.body || '{}');
  const { tenantId, projectId, awsAccountId, awsRegions, resourceTypes, roleArn, discoveryMode } = body;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    return createErrorResponse(403, 'Cannot perform discovery for different tenant');
  }

  try {
    const discoveryId = `discovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting AWS Config resource discovery', {
      discoveryId,
      tenantId,
      projectId,
      awsAccountId,
      awsRegions,
      discoveryMode,
    });

    // Initialize discovery session
    await initializeDiscoverySession(discoveryId, body);

    const discoveryResults = [];

    for (const region of awsRegions) {
      try {
        const regionResults = await performRegionalDiscovery(
          discoveryId,
          tenantId,
          projectId,
          awsAccountId,
          region,
          resourceTypes,
          roleArn,
          discoveryMode
        );
        discoveryResults.push(regionResults);
      } catch (error) {
        logger.error('Regional discovery failed', {
          discoveryId,
          region,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other regions
      }
    }

    // Aggregate results
    const totalResources = discoveryResults.reduce((sum, result) => sum + result.resourceCount, 0);
    const totalErrors = discoveryResults.reduce((sum, result) => sum + result.errors.length, 0);

    // Update discovery session with final results
    await updateDiscoverySession(discoveryId, {
      status: totalErrors > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
      totalResources,
      totalErrors,
      completedAt: new Date().toISOString(),
    });

    // Publish discovery completion event
    await publishConfigEvent('Resource Discovery Completed', {
      discoveryId,
      tenantId,
      projectId,
      awsAccountId,
      regionsScanned: awsRegions.length,
      resourcesDiscovered: totalResources,
      errors: totalErrors,
    });

    metrics.addMetric('ResourceDiscoveryCompleted', MetricUnit.Count, 1);
    metrics.addMetric('ResourcesDiscovered', MetricUnit.Count, totalResources);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Resource discovery completed',
        discoveryId,
        summary: {
          totalResources,
          totalErrors,
          regionsScanned: awsRegions.length,
          results: discoveryResults,
        },
      }),
    };
  } catch (error) {
    logger.error('Resource discovery failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function performRegionalDiscovery(
  discoveryId: string,
  tenantId: string,
  projectId: string,
  awsAccountId: string,
  region: string,
  resourceTypes?: string[],
  roleArn?: string,
  discoveryMode: string = 'full'
): Promise<any> {
  let configClient = new ConfigServiceClient({ region });

  // Assume role if provided for cross-account access
  if (roleArn) {
    const credentials = await assumeTargetRole(roleArn, region);
    configClient = new ConfigServiceClient({ region, credentials });
  }

  const result = {
    region,
    resourceCount: 0,
    errors: [] as string[],
    resources: [] as any[],
  };

  try {
    const resourceTypesToDiscover = resourceTypes || [
      'AWS::EC2::Instance',
      'AWS::EC2::SecurityGroup',
      'AWS::EC2::VPC',
      'AWS::S3::Bucket',
      'AWS::RDS::DBInstance',
      'AWS::Lambda::Function',
      'AWS::IAM::Role',
      'AWS::IAM::Policy',
      'AWS::CloudFormation::Stack',
      'AWS::ECS::Cluster',
      'AWS::EKS::Cluster',
      'AWS::ElasticLoadBalancing::LoadBalancer',
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      'AWS::DynamoDB::Table',
      'AWS::KMS::Key',
      'AWS::CloudTrail::Trail',
      'AWS::Config::ConfigurationRecorder',
    ];

    for (const resourceType of resourceTypesToDiscover) {
      try {
        const discoveredResources = await discoverResourceType(
          configClient,
          resourceType,
          discoveryMode
        );

        for (const resource of discoveredResources) {
          const inventoryItem = await createResourceInventoryItem(
            tenantId,
            projectId,
            awsAccountId,
            region,
            resource,
            discoveryId
          );

          await storeResourceInventory(inventoryItem);
          result.resources.push(inventoryItem);
          result.resourceCount++;
        }

        logger.info('Resource type discovery completed', {
          discoveryId,
          region,
          resourceType,
          count: discoveredResources.length,
        });
      } catch (error) {
        const errorMessage = `Failed to discover ${resourceType}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMessage);
        logger.error('Resource type discovery failed', {
          discoveryId,
          region,
          resourceType,
          error: errorMessage,
        });
      }
    }

    return result;
  } catch (error) {
    const errorMessage = `Regional discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMessage);
    logger.error('Regional discovery failed', {
      discoveryId,
      region,
      error: errorMessage,
    });
    return result;
  }
}

async function discoverResourceType(
  configClient: ConfigServiceClient,
  resourceType: string,
  discoveryMode: string
): Promise<any[]> {
  const resources = [];
  let nextToken: string | undefined;

  do {
    const command = new ListDiscoveredResourcesCommand({
      resourceType: resourceType as ResourceType,
      nextToken,
      limit: 100,
    });

    const response = await configClient.send(command);
    
    if (response.resourceIdentifiers) {
      // Get detailed configuration for each resource
      const detailedResources = await getResourceConfigurations(
        configClient,
        response.resourceIdentifiers.map(r => ({
          resourceType: r.resourceType!,
          resourceId: r.resourceId!,
        }))
      );

      resources.push(...detailedResources);
    }

    nextToken = response.nextToken;
  } while (nextToken && discoveryMode === 'full');

  return resources;
}

async function getResourceConfigurations(
  configClient: ConfigServiceClient,
  resourceIdentifiers: Array<{ resourceType: string; resourceId: string }>
): Promise<any[]> {
  if (resourceIdentifiers.length === 0) return [];

  try {
    const command = new BatchGetResourceConfigCommand({
      resourceKeys: resourceIdentifiers.map(r => ({
        resourceType: r.resourceType as ResourceType,
        resourceId: r.resourceId,
      })) as ResourceKey[],
    });

    const response = await configClient.send(command);
    return response.baseConfigurationItems || [];
  } catch (error) {
    logger.warn('Failed to get resource configurations', {
      resourceCount: resourceIdentifiers.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

async function createResourceInventoryItem(
  tenantId: string,
  projectId: string,
  awsAccountId: string,
  region: string,
  resource: any,
  discoveryId: string
): Promise<ResourceInventoryResult> {
  const now = new Date().toISOString();

  return {
    tenantId,
    projectId,
    accountId: awsAccountId,
    region,
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    resourceName: resource.resourceName || resource.resourceId,
    resourceArn: resource.arn || generateResourceArn(awsAccountId, region, resource),
    configuration: resource.configuration || {},
    tags: resource.tags || {},
    compliance: {
      status: 'NOT_APPLICABLE',
      evaluationCount: 0,
      lastEvaluatedTime: now,
    },
    discoveredAt: now,
    lastUpdated: now,
  };
}

async function getResourceInventory(
  queryParams: any,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  const tenantId = queryParams?.tenantId || userTenantId;
  const projectId = queryParams?.projectId;
  const resourceType = queryParams?.resourceType;
  const accountId = queryParams?.accountId;
  const region = queryParams?.region;
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 100;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    return createErrorResponse(403, 'Cannot access inventory from different tenant');
  }

  try {
    // Build query parameters
    const expressionAttributeValues: Record<string, any> = {
      ':tenantId': tenantId,
    };
    const expressionAttributeNames: Record<string, string> = {};
    const filterExpressions = [];

    if (projectId) {
      filterExpressions.push('projectId = :projectId');
      expressionAttributeValues[':projectId'] = projectId;
    }
    if (resourceType) {
      filterExpressions.push('resourceType = :resourceType');
      expressionAttributeValues[':resourceType'] = resourceType;
    }
    if (accountId) {
      filterExpressions.push('accountId = :accountId');
      expressionAttributeValues[':accountId'] = accountId;
    }
    if (region) {
      filterExpressions.push('#region = :region');
      expressionAttributeNames['#region'] = 'region';
      expressionAttributeValues[':region'] = region;
    }

    const queryParams: any = {
      TableName: RESOURCE_INVENTORY_TABLE,
      IndexName: 'TenantProjectIndex',
      KeyConditionExpression: 'tenantId = :tenantId',
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      queryParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
    }

    const queryCommand = new QueryCommand(queryParams);

    const result = await dynamoClient.send(queryCommand);

    // Get summary statistics
    const statistics = await getInventoryStatistics(tenantId, projectId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        resources: result.Items || [],
        count: result.Items?.length || 0,
        hasMore: !!result.LastEvaluatedKey,
        statistics,
      }),
    };
  } catch (error) {
    throw error;
  }
}

async function evaluateCompliance(
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  const body: ComplianceEvaluationRequest = JSON.parse(event.body || '{}');
  const { tenantId, projectId, awsAccountId, frameworks, resourceFilters } = body;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    return createErrorResponse(403, 'Cannot evaluate compliance for different tenant');
  }

  try {
    const evaluationId = `evaluation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting compliance evaluation', {
      evaluationId,
      tenantId,
      projectId,
      awsAccountId,
      frameworks,
    });

    // Initialize evaluation session
    await initializeComplianceEvaluation(evaluationId, body);

    const evaluationResults = [];

    for (const framework of frameworks) {
      try {
        const frameworkResult = await evaluateFrameworkCompliance(
          evaluationId,
          tenantId,
          projectId,
          awsAccountId,
          framework,
          resourceFilters
        );
        evaluationResults.push(frameworkResult);
      } catch (error) {
        logger.error('Framework evaluation failed', {
          evaluationId,
          framework,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Aggregate results
    const totalChecks = evaluationResults.reduce((sum, result) => sum + result.totalChecks, 0);
    const complianceScore = evaluationResults.reduce((sum, result) => sum + result.complianceScore, 0) / evaluationResults.length;

    // Update evaluation session
    await updateComplianceEvaluation(evaluationId, {
      status: 'COMPLETED',
      totalChecks,
      complianceScore,
      completedAt: new Date().toISOString(),
    });

    // Publish compliance evaluation event
    await publishConfigEvent('Compliance Evaluation Completed', {
      evaluationId,
      tenantId,
      projectId,
      awsAccountId,
      frameworks,
      complianceScore,
      totalChecks,
    });

    metrics.addMetric('ComplianceEvaluationCompleted', MetricUnit.Count, 1);
    metrics.addMetric('ComplianceScore', MetricUnit.Percent, complianceScore);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Compliance evaluation completed',
        evaluationId,
        summary: {
          complianceScore,
          totalChecks,
          frameworkResults: evaluationResults,
        },
      }),
    };
  } catch (error) {
    throw error;
  }
}

// Helper functions
async function assumeTargetRole(roleArn: string, region: string): Promise<any> {
  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `CloudBPA-Config-${Date.now()}`,
    DurationSeconds: 3600,
  });

  const response = await stsClient.send(command);
  
  return {
    accessKeyId: response.Credentials!.AccessKeyId!,
    secretAccessKey: response.Credentials!.SecretAccessKey!,
    sessionToken: response.Credentials!.SessionToken!,
  };
}

function generateResourceArn(accountId: string, region: string, resource: any): string {
  const service = resource.resourceType.split('::')[1].toLowerCase();
  return `arn:aws:${service}:${region}:${accountId}:${resource.resourceType.split('::')[2].toLowerCase()}/${resource.resourceId}`;
}

async function storeResourceInventory(inventoryItem: ResourceInventoryResult): Promise<void> {
  try {
    await dynamoClient.send(
      new PutCommand({
        TableName: RESOURCE_INVENTORY_TABLE,
        Item: {
          pk: `TENANT#${inventoryItem.tenantId}`,
          sk: `RESOURCE#${inventoryItem.resourceType}#${inventoryItem.resourceId}`,
          ...inventoryItem,
        },
      })
    );
  } catch (error) {
    logger.error('Failed to store resource inventory', { inventoryItem, error });
  }
}

async function getInventoryStatistics(tenantId: string, projectId?: string): Promise<any> {
  // Implementation for getting summary statistics
  return {
    totalResources: 0,
    resourceTypes: [],
    compliance: {
      compliant: 0,
      nonCompliant: 0,
      notApplicable: 0,
    },
  };
}

async function initializeDiscoverySession(discoveryId: string, request: ConfigDiscoveryRequest): Promise<void> {
  // Implementation for initializing discovery session
}

async function updateDiscoverySession(discoveryId: string, updates: any): Promise<void> {
  // Implementation for updating discovery session
}

async function initializeComplianceEvaluation(evaluationId: string, request: ComplianceEvaluationRequest): Promise<void> {
  // Implementation for initializing compliance evaluation
}

async function updateComplianceEvaluation(evaluationId: string, updates: any): Promise<void> {
  // Implementation for updating compliance evaluation
}

async function evaluateFrameworkCompliance(
  evaluationId: string,
  tenantId: string,
  projectId: string,
  awsAccountId: string,
  framework: string,
  resourceFilters?: any
): Promise<any> {
  // Implementation for framework-specific compliance evaluation
  return {
    framework,
    totalChecks: 0,
    complianceScore: 0,
    details: [],
  };
}

async function publishConfigEvent(eventType: string, eventData: any): Promise<void> {
  try {
    const event = {
      Source: 'cloudbpa.config',
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
    logger.error('Failed to publish config event', { eventType, eventData, error });
  }
}

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
    500: 'Internal Server Error',
  };
  return errorTypes[statusCode as keyof typeof errorTypes] || 'Error';
}

// Placeholder implementations for additional functions
async function getResourceDetails(resourceId: string, queryParams: any, userTenantId: string, userRole: string): Promise<APIGatewayProxyResult> {
  // Implementation for getting detailed resource information
  return createErrorResponse(501, 'Not implemented');
}

async function getComplianceResults(queryParams: any, userTenantId: string, userRole: string): Promise<APIGatewayProxyResult> {
  // Implementation for getting compliance results
  return createErrorResponse(501, 'Not implemented');
}

async function createConfigRule(event: APIGatewayProxyEvent, userTenantId: string, userRole: string): Promise<APIGatewayProxyResult> {
  // Implementation for creating Config rules
  return createErrorResponse(501, 'Not implemented');
}

async function listConfigRules(queryParams: any, userTenantId: string, userRole: string): Promise<APIGatewayProxyResult> {
  // Implementation for listing Config rules
  return createErrorResponse(501, 'Not implemented');
}

async function deleteConfigRule(ruleName: string, userTenantId: string, userRole: string): Promise<APIGatewayProxyResult> {
  // Implementation for deleting Config rules
  return createErrorResponse(501, 'Not implemented');
}

async function getDiscoveryStatistics(queryParams: any, userTenantId: string, userRole: string): Promise<APIGatewayProxyResult> {
  // Implementation for getting discovery statistics
  return createErrorResponse(501, 'Not implemented');
}