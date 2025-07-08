/**
 * Multi-Account Live Scanner Lambda Function
 * Orchestrates live scanning across multiple AWS accounts for a single project
 * Supports parallel execution and aggregated results
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cloud-bpa' });
const tracer = new Tracer({ serviceName: 'cloud-bpa' });
const metrics = new Metrics({ serviceName: 'cloud-bpa', namespace: 'CloudBPA/MultiAccountScan' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});
const sfnClient = new SFNClient({});

// Environment variables
const ANALYSES_TABLE = process.env.ANALYSES_TABLE!;
const AWS_ACCOUNTS_TABLE = process.env.AWS_ACCOUNTS_TABLE!;
const MULTI_ACCOUNT_SCANS_TABLE = process.env.MULTI_ACCOUNT_SCANS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const LIVE_SCAN_STATE_MACHINE_ARN = process.env.LIVE_SCAN_STATE_MACHINE_ARN!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface MultiAccountScanRequest {
  tenantId: string;
  projectId: string;
  accountIds?: string[]; // Optional - if not provided, all project accounts will be scanned
  scanScope: {
    services: string[];
    regions: string[];
    resourceTypes?: string[];
  };
  frameworks: string[];
  scanOptions: {
    parallelExecution: boolean;
    maxConcurrentScans: number;
    failOnAccountError: boolean;
    aggregateResults: boolean;
  };
  scheduledScan?: {
    isScheduled: boolean;
    scheduleId?: string;
    nextExecution?: string;
  };
}

interface MultiAccountScanStatus {
  scanId: string;
  tenantId: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  totalAccounts: number;
  completedAccounts: number;
  failedAccounts: number;
  progress: number;
  startTime: string;
  endTime?: string;
  accountResults: AccountScanResult[];
  aggregatedSummary?: AggregatedScanSummary;
  error?: string;
}

interface AccountScanResult {
  accountId: string;
  accountName: string;
  environment: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  analysisId?: string;
  startTime?: string;
  endTime?: string;
  totalResources?: number;
  scannedServices?: number;
  scannedRegions?: number;
  errors?: string[];
  supportPlan?: string;
}

interface AggregatedScanSummary {
  totalResources: number;
  totalServices: number;
  totalRegions: number;
  resourcesByAccount: Record<string, number>;
  resourcesByService: Record<string, number>;
  resourcesByRegion: Record<string, number>;
  resourcesByEnvironment: Record<string, number>;
  supportPlanDistribution: Record<string, number>;
  errors: string[];
  recommendations: string[];
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('multi-account-scanner');

  try {
    logger.appendKeys({
      requestId: event.requestContext.requestId,
      stage: event.requestContext.stage,
    });

    const { httpMethod, resource, pathParameters, queryStringParameters } = event;
    const userRole = (event.requestContext.identity as any)?.claims?.['custom:role'];
    const userTenantId = (event.requestContext.identity as any)?.claims?.['custom:tenantId'];
    const userProjectIds = JSON.parse((event.requestContext.identity as any)?.claims?.['custom:projectIds'] || '[]');

    // Authorization check
    if (!['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst'].includes(userRole)) {
      return createErrorResponse(403, 'Insufficient permissions for multi-account scanning');
    }

    let result: APIGatewayProxyResult;

    switch (`${httpMethod} ${resource}`) {
      case 'POST /multi-account-scan/start':
        result = await startMultiAccountScan(event, userTenantId, userRole, userProjectIds);
        break;
      case 'GET /multi-account-scan/status/{scanId}':
        result = await getMultiAccountScanStatus(pathParameters!.scanId!, userTenantId, userRole);
        break;
      case 'GET /multi-account-scan/accounts/{projectId}':
        result = await getProjectAccounts(pathParameters!.projectId!, userTenantId, userRole);
        break;
      case 'POST /multi-account-scan/schedule':
        result = await scheduleMultiAccountScan(event, userTenantId, userRole, userProjectIds);
        break;
      case 'GET /multi-account-scan/history/{projectId}':
        result = await getScanHistory(pathParameters!.projectId!, queryStringParameters, userTenantId, userRole);
        break;
      default:
        result = createErrorResponse(404, `Route not found: ${httpMethod} ${resource}`);
    }

    metrics.addMetric('MultiAccountScanRequestSuccess', MetricUnit.Count, 1);
    return result;
  } catch (error) {
    logger.error('Multi-account scan request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    metrics.addMetric('MultiAccountScanRequestError', MetricUnit.Count, 1);
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function startMultiAccountScan(
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string,
  userProjectIds: string[]
): Promise<APIGatewayProxyResult> {
  const body: MultiAccountScanRequest = JSON.parse(event.body || '{}');
  const { tenantId, projectId, accountIds, scanScope, frameworks, scanOptions } = body;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    return createErrorResponse(403, 'Cannot scan accounts for different tenant');
  }

  // Project access check
  if (userRole !== 'SystemAdmin' && userRole !== 'ClientAdmin' && !userProjectIds.includes(projectId)) {
    return createErrorResponse(403, 'No access to this project');
  }

  try {
    // Get project accounts
    const accounts = await getAccountsForProject(tenantId, projectId, accountIds);
    
    if (accounts.length === 0) {
      return createErrorResponse(400, 'No AWS accounts found for this project');
    }

    // Validate scan options
    if (scanOptions.maxConcurrentScans > 10) {
      return createErrorResponse(400, 'Maximum concurrent scans cannot exceed 10');
    }

    // Create multi-account scan record
    const scanId = `multi-scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const generatedBy = (event.requestContext.identity as any)?.claims?.sub || 'system';

    const scanStatus: MultiAccountScanStatus = {
      scanId,
      tenantId,
      projectId,
      status: 'PENDING',
      totalAccounts: accounts.length,
      completedAccounts: 0,
      failedAccounts: 0,
      progress: 0,
      startTime: new Date().toISOString(),
      accountResults: accounts.map(account => ({
        accountId: account.accountId,
        accountName: account.accountName,
        environment: account.environment,
        status: 'PENDING',
        supportPlan: account.supportPlan,
      })),
    };

    // Store scan metadata
    await storeScanMetadata(scanStatus, generatedBy);

    // Start individual account scans
    await orchestrateAccountScans(scanStatus, accounts, scanScope, frameworks, scanOptions);

    metrics.addMetric('MultiAccountScanStarted', MetricUnit.Count, 1);
    metrics.addMetric('AccountsInScan', MetricUnit.Count, accounts.length);

    logger.info('Multi-account scan started', {
      scanId,
      tenantId,
      projectId,
      totalAccounts: accounts.length,
      services: scanScope.services,
      regions: scanScope.regions,
    });

    return {
      statusCode: 202,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Multi-account scan started',
        scanId,
        status: 'PENDING',
        totalAccounts: accounts.length,
        estimatedCompletionTime: new Date(Date.now() + (accounts.length * 300000)).toISOString(), // 5 minutes per account
      }),
    };
  } catch (error) {
    throw error;
  }
}

async function getAccountsForProject(
  tenantId: string,
  projectId: string,
  specificAccountIds?: string[]
): Promise<any[]> {
  const queryParams: any = {
    TableName: AWS_ACCOUNTS_TABLE,
    KeyConditionExpression: 'tenantId = :tenantId',
    FilterExpression: 'projectId = :projectId AND isActive = :isActive',
    ExpressionAttributeValues: {
      ':tenantId': tenantId,
      ':projectId': projectId,
      ':isActive': true,
    },
  };

  // Add specific account filter if provided
  if (specificAccountIds && specificAccountIds.length > 0) {
    const accountFilter = specificAccountIds.map((_, index) => `:accountId${index}`).join(', ');
    queryParams.FilterExpression += ` AND accountId IN (${accountFilter})`;
    specificAccountIds.forEach((id, index) => {
      queryParams.ExpressionAttributeValues[`:accountId${index}`] = id;
    });
  }

  const result = await dynamoClient.send(new QueryCommand(queryParams));
  return result.Items || [];
}

async function orchestrateAccountScans(
  scanStatus: MultiAccountScanStatus,
  accounts: any[],
  scanScope: any,
  frameworks: string[],
  scanOptions: any
): Promise<void> {
  const { maxConcurrentScans, parallelExecution } = scanOptions;

  if (parallelExecution) {
    // Execute scans in parallel with concurrency limit
    const chunks = chunkArray(accounts, maxConcurrentScans);
    
    for (const chunk of chunks) {
      const scanPromises = chunk.map(account => 
        startSingleAccountScan(scanStatus.scanId, account, scanScope, frameworks)
      );
      
      await Promise.allSettled(scanPromises);
    }
  } else {
    // Execute scans sequentially
    for (const account of accounts) {
      await startSingleAccountScan(scanStatus.scanId, account, scanScope, frameworks);
    }
  }
}

async function startSingleAccountScan(
  multiScanId: string,
  account: any,
  scanScope: any,
  frameworks: string[]
): Promise<void> {
  try {
    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Prepare scan event for Step Functions
    const scanEvent = {
      analysisId,
      tenantId: account.tenantId,
      projectId: account.projectId,
      multiScanId,
      awsConfig: {
        region: account.region,
        accountId: account.accountId,
        roleArn: account.roleArn,
        externalId: account.externalId,
      },
      scanScope,
      frameworks,
      metadata: {
        accountName: account.accountName,
        environment: account.environment,
        owner: account.owner,
        supportPlan: account.supportPlan,
      },
    };

    // Start Step Functions execution for this account
    const executionName = `LiveScan-${analysisId}`;
    await sfnClient.send(new StartExecutionCommand({
      stateMachineArn: LIVE_SCAN_STATE_MACHINE_ARN,
      name: executionName,
      input: JSON.stringify(scanEvent),
    }));

    // Update account status to RUNNING
    await updateAccountScanStatus(multiScanId, account.accountId, {
      status: 'RUNNING',
      analysisId,
      startTime: new Date().toISOString(),
    });

    logger.info('Started individual account scan', {
      multiScanId,
      accountId: account.accountId,
      analysisId,
    });
  } catch (error) {
    logger.error('Failed to start account scan', {
      multiScanId,
      accountId: account.accountId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Update account status to FAILED
    await updateAccountScanStatus(multiScanId, account.accountId, {
      status: 'FAILED',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      endTime: new Date().toISOString(),
    });
  }
}

async function getMultiAccountScanStatus(
  scanId: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: MULTI_ACCOUNT_SCANS_TABLE,
      Key: { scanId },
    }));

    if (!result.Item) {
      return createErrorResponse(404, 'Multi-account scan not found');
    }

    const scanStatus = result.Item as MultiAccountScanStatus;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && userTenantId !== scanStatus.tenantId) {
      return createErrorResponse(403, 'Cannot access scan for different tenant');
    }

    // Get latest account statuses
    const updatedStatus = await refreshScanStatus(scanStatus);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(updatedStatus),
    };
  } catch (error) {
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function refreshScanStatus(scanStatus: MultiAccountScanStatus): Promise<MultiAccountScanStatus> {
  // Query individual analysis results to update account statuses
  for (const accountResult of scanStatus.accountResults) {
    if (accountResult.analysisId && accountResult.status === 'RUNNING') {
      try {
        const analysisResult = await dynamoClient.send(new GetCommand({
          TableName: ANALYSES_TABLE,
          Key: { 
            pk: `ANALYSIS#${accountResult.analysisId}`,
            sk: '#METADATA'
          },
        }));

        if (analysisResult.Item) {
          const analysis = analysisResult.Item;
          accountResult.status = analysis.status;
          accountResult.endTime = analysis.completedAt;
          accountResult.totalResources = analysis.summary?.totalResources;
          accountResult.scannedServices = analysis.summary?.scannedServices;
          accountResult.scannedRegions = analysis.summary?.scannedRegions;
          accountResult.errors = analysis.summary?.errors;
        }
      } catch (error) {
        logger.warn('Failed to get analysis status', {
          analysisId: accountResult.analysisId,
          error,
        });
      }
    }
  }

  // Update overall scan status
  const completedAccounts = scanStatus.accountResults.filter(r => 
    ['COMPLETED', 'FAILED'].includes(r.status)
  ).length;
  const failedAccounts = scanStatus.accountResults.filter(r => r.status === 'FAILED').length;
  
  scanStatus.completedAccounts = completedAccounts;
  scanStatus.failedAccounts = failedAccounts;
  scanStatus.progress = Math.round((completedAccounts / scanStatus.totalAccounts) * 100);

  // Determine overall status
  if (completedAccounts === scanStatus.totalAccounts) {
    scanStatus.status = failedAccounts === 0 ? 'COMPLETED' : 
                        failedAccounts < scanStatus.totalAccounts ? 'PARTIAL' : 'FAILED';
    scanStatus.endTime = new Date().toISOString();
    
    // Generate aggregated summary
    if (scanStatus.status !== 'FAILED') {
      scanStatus.aggregatedSummary = generateAggregatedSummary(scanStatus.accountResults);
    }
  } else if (scanStatus.accountResults.some(r => r.status === 'RUNNING')) {
    scanStatus.status = 'RUNNING';
  }

  // Update scan metadata
  await updateScanMetadata(scanStatus);

  return scanStatus;
}

function generateAggregatedSummary(accountResults: AccountScanResult[]): AggregatedScanSummary {
  const completedResults = accountResults.filter(r => r.status === 'COMPLETED');
  
  const summary: AggregatedScanSummary = {
    totalResources: completedResults.reduce((sum, r) => sum + (r.totalResources || 0), 0),
    totalServices: 0, // Would be calculated from detailed results
    totalRegions: 0, // Would be calculated from detailed results
    resourcesByAccount: {},
    resourcesByService: {},
    resourcesByRegion: {},
    resourcesByEnvironment: {},
    supportPlanDistribution: {},
    errors: [],
    recommendations: [],
  };

  // Aggregate by account
  completedResults.forEach(result => {
    summary.resourcesByAccount[result.accountId] = result.totalResources || 0;
    summary.resourcesByEnvironment[result.environment] = 
      (summary.resourcesByEnvironment[result.environment] || 0) + (result.totalResources || 0);
    
    if (result.supportPlan) {
      summary.supportPlanDistribution[result.supportPlan] = 
        (summary.supportPlanDistribution[result.supportPlan] || 0) + 1;
    }

    if (result.errors && result.errors.length > 0) {
      summary.errors.push(...result.errors);
    }
  });

  // Generate recommendations based on results
  if (summary.supportPlanDistribution['BASIC'] > 0) {
    summary.recommendations.push(
      'Consider upgrading AWS Support plans for production environments to Business or Enterprise level'
    );
  }

  const failedAccounts = accountResults.filter(r => r.status === 'FAILED').length;
  if (failedAccounts > 0) {
    summary.recommendations.push(
      `${failedAccounts} account(s) failed to scan. Review IAM permissions and network connectivity.`
    );
  }

  return summary;
}

// Helper functions
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function storeScanMetadata(scanStatus: MultiAccountScanStatus, createdBy: string): Promise<void> {
  await dynamoClient.send(new PutCommand({
    TableName: MULTI_ACCOUNT_SCANS_TABLE,
    Item: {
      ...scanStatus,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));
}

async function updateScanMetadata(scanStatus: MultiAccountScanStatus): Promise<void> {
  await dynamoClient.send(new UpdateCommand({
    TableName: MULTI_ACCOUNT_SCANS_TABLE,
    Key: { scanId: scanStatus.scanId },
    UpdateExpression: `
      SET #status = :status, 
          completedAccounts = :completedAccounts,
          failedAccounts = :failedAccounts,
          progress = :progress,
          accountResults = :accountResults,
          updatedAt = :updatedAt
          ${scanStatus.endTime ? ', endTime = :endTime' : ''}
          ${scanStatus.aggregatedSummary ? ', aggregatedSummary = :aggregatedSummary' : ''}
    `,
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': scanStatus.status,
      ':completedAccounts': scanStatus.completedAccounts,
      ':failedAccounts': scanStatus.failedAccounts,
      ':progress': scanStatus.progress,
      ':accountResults': scanStatus.accountResults,
      ':updatedAt': new Date().toISOString(),
      ...(scanStatus.endTime && { ':endTime': scanStatus.endTime }),
      ...(scanStatus.aggregatedSummary && { ':aggregatedSummary': scanStatus.aggregatedSummary }),
    },
  }));
}

async function updateAccountScanStatus(
  multiScanId: string,
  accountId: string,
  updates: Partial<AccountScanResult>
): Promise<void> {
  // This would update the specific account status within the multi-scan record
  // Implementation depends on your data structure choice
  logger.info('Account scan status updated', {
    multiScanId,
    accountId,
    updates,
  });
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

// Placeholder implementations
async function getProjectAccounts(
  projectId: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  return createErrorResponse(501, 'Not implemented');
}

async function scheduleMultiAccountScan(
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string,
  userProjectIds: string[]
): Promise<APIGatewayProxyResult> {
  return createErrorResponse(501, 'Not implemented');
}

async function getScanHistory(
  projectId: string,
  queryParams: any,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  return createErrorResponse(501, 'Not implemented');
}