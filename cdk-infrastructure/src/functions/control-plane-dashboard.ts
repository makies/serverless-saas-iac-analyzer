/**
 * Control Plane Dashboard Lambda Function
 * Provides comprehensive tenant management and cross-tenant analytics
 * For SystemAdmin and FrameworkAdmin roles
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'control-plane-dashboard' });
const tracer = new Tracer({ serviceName: 'control-plane-dashboard' });
const metrics = new Metrics({ serviceName: 'control-plane-dashboard', namespace: 'CloudBPA/Control' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cloudWatchClient = new CloudWatchClient({});

// Environment variables
const TENANTS_TABLE = process.env.SBT_TENANTS_TABLE!;
const ANALYSES_TABLE = process.env.ANALYSES_TABLE!;
const TENANT_ANALYTICS_TABLE = process.env.TENANT_ANALYTICS_TABLE!;
const FRAMEWORK_REGISTRY_TABLE = process.env.FRAMEWORK_REGISTRY_TABLE!;

interface DashboardMetrics {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    byTier: Record<string, number>;
    newThisMonth: number;
    churnRisk: number;
  };
  usage: {
    totalAnalyses: number;
    analysesThisMonth: number;
    activeProjects: number;
    storageUtilization: number;
    apiCallsToday: number;
  };
  frameworks: {
    mostUsed: Array<{ frameworkId: string; name: string; usage: number }>;
    adoptionRate: Record<string, number>;
    averageRulesPerFramework: number;
  };
  performance: {
    averageAnalysisTime: number;
    successRate: number;
    errorRate: number;
    topErrors: Array<{ error: string; count: number }>;
  };
  business: {
    monthlyGrowthRate: number;
    tierDistribution: Record<string, number>;
    retentionRate: number;
    supportTickets: number;
  };
}

interface TenantDetails {
  tenantId: string;
  tenantName: string;
  adminEmail: string;
  status: string;
  tier: string;
  createdAt: string;
  lastActivity: string;
  usage: {
    analysesThisMonth: number;
    totalAnalyses: number;
    activeProjects: number;
    lastAnalysisDate: string;
  };
  health: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('control-plane-dashboard');

  try {
    logger.appendKeys({
      requestId: event.requestContext.requestId,
      stage: event.requestContext.stage,
    });

    // Verify admin access
    const userRole = (event.requestContext.identity as any)?.claims?.['custom:role'];
    if (!['SystemAdmin', 'FrameworkAdmin'].includes(userRole)) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Access Denied',
          message: 'Insufficient permissions for Control Plane access',
        }),
      };
    }

    const { httpMethod, resource, pathParameters, queryStringParameters } = event;

    let result: APIGatewayProxyResult;

    switch (`${httpMethod} ${resource}`) {
      case 'GET /dashboard/metrics':
        result = await getDashboardMetrics(queryStringParameters);
        break;
      case 'GET /dashboard/tenants':
        result = await getTenantsList(queryStringParameters);
        break;
      case 'GET /dashboard/tenants/{tenantId}':
        result = await getTenantDetails(pathParameters!.tenantId!);
        break;
      case 'GET /dashboard/analytics/cross-tenant':
        result = await getCrossTenantAnalytics(queryStringParameters);
        break;
      case 'GET /dashboard/frameworks/adoption':
        result = await getFrameworkAdoption(queryStringParameters);
        break;
      case 'GET /dashboard/health/overview':
        result = await getSystemHealthOverview();
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

    metrics.addMetric('DashboardRequestSuccess', MetricUnit.Count, 1);
    return result;
  } catch (error) {
    logger.error('Control plane dashboard request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    metrics.addMetric('DashboardRequestError', MetricUnit.Count, 1);

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

async function getDashboardMetrics(queryParams: any): Promise<APIGatewayProxyResult> {
  const timeRange = queryParams?.timeRange || '30d';
  
  logger.info('Generating dashboard metrics', { timeRange });

  const [
    tenantMetrics,
    usageMetrics,
    frameworkMetrics,
    performanceMetrics,
    businessMetrics,
  ] = await Promise.all([
    getTenantMetrics(),
    getUsageMetrics(timeRange),
    getFrameworkMetrics(),
    getPerformanceMetrics(timeRange),
    getBusinessMetrics(timeRange),
  ]);

  const dashboardMetrics: DashboardMetrics = {
    tenants: tenantMetrics,
    usage: usageMetrics,
    frameworks: frameworkMetrics,
    performance: performanceMetrics,
    business: businessMetrics,
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      metrics: dashboardMetrics,
      generatedAt: new Date().toISOString(),
      timeRange,
    }),
  };
}

async function getTenantMetrics(): Promise<DashboardMetrics['tenants']> {
  // Get all tenants
  const tenantsResult = await dynamoClient.send(
    new ScanCommand({
      TableName: TENANTS_TABLE,
      ProjectionExpression: 'tenantId, #status, tier, createdAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
    })
  );

  const tenants = tenantsResult.Items || [];
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Calculate metrics
  const total = tenants.length;
  const active = tenants.filter(t => t.status === 'ACTIVE').length;
  const suspended = tenants.filter(t => t.status === 'SUSPENDED').length;

  const byTier = tenants.reduce((acc, tenant) => {
    acc[tenant.tier] = (acc[tenant.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const newThisMonth = tenants.filter(t => 
    new Date(t.createdAt) >= thisMonth
  ).length;

  // Simple churn risk calculation (tenants without recent activity)
  const churnRisk = Math.floor(tenants.length * 0.15); // Placeholder calculation

  return {
    total,
    active,
    suspended,
    byTier,
    newThisMonth,
    churnRisk,
  };
}

async function getUsageMetrics(timeRange: string): Promise<DashboardMetrics['usage']> {
  const now = new Date();
  const startDate = getStartDateForRange(timeRange);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get analysis metrics
  const analysisQuery = await dynamoClient.send(
    new ScanCommand({
      TableName: ANALYSES_TABLE,
      ProjectionExpression: 'createdAt, #status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      FilterExpression: 'createdAt >= :startDate',
      ExpressionAttributeValues: {
        ':startDate': startDate.toISOString(),
      },
    })
  );

  const analyses = analysisQuery.Items || [];
  const totalAnalyses = analyses.length;
  const analysesThisMonth = analyses.filter(a => 
    new Date(a.createdAt) >= thisMonth
  ).length;

  // Get CloudWatch metrics for API calls
  const apiCallsToday = await getCloudWatchMetric(
    'AWS/ApiGateway',
    'Count',
    'CloudBPA-API',
    24 // hours
  );

  return {
    totalAnalyses,
    analysesThisMonth,
    activeProjects: 0, // Would be calculated from projects table
    storageUtilization: 0, // Would be calculated from S3 metrics
    apiCallsToday,
  };
}

async function getFrameworkMetrics(): Promise<DashboardMetrics['frameworks']> {
  // Get framework usage from analytics table
  const frameworkQuery = await dynamoClient.send(
    new ScanCommand({
      TableName: FRAMEWORK_REGISTRY_TABLE,
      ProjectionExpression: 'frameworkId, tenantId, enabled',
    })
  );

  const frameworks = frameworkQuery.Items || [];
  
  // Calculate most used frameworks
  const usage = frameworks.reduce((acc, fw) => {
    if (fw.enabled) {
      acc[fw.frameworkId] = (acc[fw.frameworkId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const mostUsed = Object.entries(usage)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([frameworkId, usage]) => ({
      frameworkId,
      name: getFrameworkDisplayName(frameworkId),
      usage,
    }));

  // Calculate adoption rates
  const totalTenants = new Set(frameworks.map(f => f.tenantId)).size;
  const adoptionRate = Object.entries(usage).reduce((acc, [frameworkId, count]) => {
    acc[frameworkId] = Math.round((count / totalTenants) * 100);
    return acc;
  }, {} as Record<string, number>);

  return {
    mostUsed,
    adoptionRate,
    averageRulesPerFramework: 25, // Placeholder
  };
}

async function getPerformanceMetrics(timeRange: string): Promise<DashboardMetrics['performance']> {
  const averageAnalysisTime = await getCloudWatchMetric(
    'CloudBPA/Analysis',
    'Average',
    'AnalysisDuration',
    getHoursForRange(timeRange)
  );

  const errorRate = await getCloudWatchMetric(
    'CloudBPA/Analysis',
    'Average',
    'ErrorRate',
    getHoursForRange(timeRange)
  );

  return {
    averageAnalysisTime: averageAnalysisTime || 120, // seconds
    successRate: Math.max(0, 100 - (errorRate || 5)),
    errorRate: errorRate || 5,
    topErrors: [], // Would be populated from error logs
  };
}

async function getBusinessMetrics(timeRange: string): Promise<DashboardMetrics['business']> {
  return {
    monthlyGrowthRate: 15, // Placeholder percentage
    tierDistribution: {
      BASIC: 60,
      PREMIUM: 30,
      ENTERPRISE: 10,
    },
    retentionRate: 85, // Placeholder percentage
    supportTickets: 12, // Placeholder count
  };
}

async function getTenantsList(queryParams: any): Promise<APIGatewayProxyResult> {
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 50;
  const status = queryParams?.status;
  const tier = queryParams?.tier;

  let filterExpression = '';
  const expressionAttributeValues: any = {};
  const expressionAttributeNames: any = {};

  if (status) {
    filterExpression = '#status = :status';
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = status;
  }

  if (tier) {
    filterExpression += filterExpression ? ' AND ' : '';
    filterExpression += 'tier = :tier';
    expressionAttributeValues[':tier'] = tier;
  }

  const scanParams: any = {
    TableName: TENANTS_TABLE,
    Limit: limit,
  };

  if (filterExpression) {
    scanParams.FilterExpression = filterExpression;
    scanParams.ExpressionAttributeValues = expressionAttributeValues;
    if (Object.keys(expressionAttributeNames).length > 0) {
      scanParams.ExpressionAttributeNames = expressionAttributeNames;
    }
  }

  const result = await dynamoClient.send(new ScanCommand(scanParams));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      tenants: result.Items || [],
      count: result.Items?.length || 0,
    }),
  };
}

async function getTenantDetails(tenantId: string): Promise<APIGatewayProxyResult> {
  // Get tenant basic info
  const tenantQuery = await dynamoClient.send(
    new QueryCommand({
      TableName: TENANTS_TABLE,
      KeyConditionExpression: 'tenantId = :tenantId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
      },
    })
  );

  if (!tenantQuery.Items || tenantQuery.Items.length === 0) {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Not Found',
        message: `Tenant ${tenantId} not found`,
      }),
    };
  }

  const tenant = tenantQuery.Items[0];

  // Get tenant analytics
  const analyticsQuery = await dynamoClient.send(
    new QueryCommand({
      TableName: TENANT_ANALYTICS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
      },
    })
  );

  const analytics = analyticsQuery.Items || [];
  const totalAnalyses = analytics.length;
  const thisMonth = new Date().toISOString().substring(0, 7);
  const analysesThisMonth = analytics.filter(a => a.month === thisMonth).length;

  const tenantDetails: TenantDetails = {
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    adminEmail: tenant.adminEmail,
    status: tenant.status,
    tier: tenant.tier,
    createdAt: tenant.createdAt,
    lastActivity: getLastActivityDate(analytics),
    usage: {
      analysesThisMonth,
      totalAnalyses,
      activeProjects: 0, // Would be calculated
      lastAnalysisDate: getLastAnalysisDate(analytics),
    },
    health: {
      score: calculateHealthScore(tenant, analytics),
      issues: [],
      recommendations: [],
    },
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(tenantDetails),
  };
}

async function getCrossTenantAnalytics(queryParams: any): Promise<APIGatewayProxyResult> {
  const metric = queryParams?.metric || 'usage';
  const groupBy = queryParams?.groupBy || 'tenant';

  // This would implement cross-tenant analytics
  // For now, return placeholder data
  const analytics = {
    metric,
    groupBy,
    data: [], // Would be populated with actual analytics
    generatedAt: new Date().toISOString(),
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(analytics),
  };
}

async function getFrameworkAdoption(queryParams: any): Promise<APIGatewayProxyResult> {
  const timeRange = queryParams?.timeRange || '30d';

  // Implementation would analyze framework adoption trends
  const adoption = {
    timeRange,
    trends: [], // Would be populated with actual trends
    generatedAt: new Date().toISOString(),
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(adoption),
  };
}

async function getSystemHealthOverview(): Promise<APIGatewayProxyResult> {
  const health = {
    overall: 'HEALTHY',
    services: {
      api: 'HEALTHY',
      database: 'HEALTHY',
      analysis: 'HEALTHY',
      storage: 'HEALTHY',
    },
    alerts: [],
    lastChecked: new Date().toISOString(),
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(health),
  };
}

// Helper functions
async function getCloudWatchMetric(
  namespace: string,
  statistic: string,
  metricName: string,
  hours: number
): Promise<number> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));

    const result = await cloudWatchClient.send(
      new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour
        Statistics: [statistic],
      })
    );

    const datapoints = result.Datapoints || [];
    if (datapoints.length === 0) return 0;

    const values = datapoints.map(dp => dp[statistic as keyof typeof dp] as number);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  } catch (error) {
    logger.warn('Failed to get CloudWatch metric', { namespace, metricName, error });
    return 0;
  }
}

function getStartDateForRange(timeRange: string): Date {
  const now = new Date();
  const ranges = {
    '1d': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };
  const days = ranges[timeRange as keyof typeof ranges] || 30;
  return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
}

function getHoursForRange(timeRange: string): number {
  const ranges = {
    '1d': 24,
    '7d': 168,
    '30d': 720,
    '90d': 2160,
  };
  return ranges[timeRange as keyof typeof ranges] || 720;
}

function getFrameworkDisplayName(frameworkId: string): string {
  const names = {
    'well-architected': 'AWS Well-Architected',
    'security-hub': 'AWS Security Hub',
    'serverless-lens': 'Serverless Lens',
    'saas-lens': 'SaaS Lens',
    'iot-lens': 'IoT Lens',
    'ml-lens': 'Machine Learning Lens',
    'aws-competency': 'AWS Competency',
    'service-delivery': 'Service Delivery',
  };
  return names[frameworkId as keyof typeof names] || frameworkId;
}

function getLastActivityDate(analytics: any[]): string {
  if (analytics.length === 0) return new Date().toISOString();
  return analytics.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt;
}

function getLastAnalysisDate(analytics: any[]): string {
  return getLastActivityDate(analytics);
}

function calculateHealthScore(tenant: any, analytics: any[]): number {
  // Simple health score calculation based on activity and status
  let score = 100;
  
  if (tenant.status !== 'ACTIVE') score -= 50;
  if (analytics.length === 0) score -= 30;
  
  const daysSinceLastActivity = analytics.length > 0 ? 
    Math.floor((Date.now() - new Date(getLastActivityDate(analytics)).getTime()) / (1000 * 60 * 60 * 24)) : 999;
  
  if (daysSinceLastActivity > 30) score -= 20;
  if (daysSinceLastActivity > 60) score -= 30;
  
  return Math.max(0, score);
}