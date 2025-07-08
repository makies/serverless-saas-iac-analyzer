/**
 * Differential Analysis Lambda Function
 * Compares scan results over time to identify changes in infrastructure
 * Tracks resource changes, compliance drift, and security improvements/regressions
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cloud-bpa' });
const tracer = new Tracer({ serviceName: 'cloud-bpa' });
const metrics = new Metrics({ serviceName: 'cloud-bpa', namespace: 'CloudBPA/DifferentialAnalysis' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Environment variables
const ANALYSES_TABLE = process.env.ANALYSES_TABLE!;
const DIFFERENTIAL_ANALYSES_TABLE = process.env.DIFFERENTIAL_ANALYSES_TABLE!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface DifferentialAnalysisRequest {
  tenantId: string;
  projectId: string;
  baselineScanId: string;
  comparisonScanId: string;
  analysisType: 'full' | 'security' | 'compliance' | 'resources';
  options?: {
    includeDetails: boolean;
    threshold: 'all' | 'medium' | 'high';
  };
}

interface ScanResult {
  scanId: string;
  analysisId: string;
  accountId: string;
  accountName: string;
  environment: string;
  scanDate: string;
  totalResources: number;
  resourcesByService: Record<string, number>;
  resourcesByRegion: Record<string, number>;
  resourcesByType: Record<string, number>;
  complianceScore: number;
  securityFindings: number;
  criticalFindings: number;
  findings: any[];
  status: string;
}

interface ResourceDifference {
  resourceType: string;
  service: string;
  region: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED';
  oldValue?: any;
  newValue?: any;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  resourceId?: string;
}

interface ComplianceDifference {
  ruleId: string;
  ruleName: string;
  changeType: 'NEW_VIOLATION' | 'RESOLVED' | 'STATUS_CHANGED';
  oldStatus?: string;
  newStatus?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impact: string;
  resourceId?: string;
  description: string;
}

interface DifferentialAnalysisResult {
  id: string;
  tenantId: string;
  projectId: string;
  baselineScan: ScanResult;
  comparisonScan: ScanResult;
  analysisDate: string;
  analysisType: string;
  totalChanges: number;
  resourceChanges: {
    added: number;
    removed: number;
    modified: number;
    differences: ResourceDifference[];
  };
  complianceChanges: {
    newViolations: number;
    resolvedViolations: number;
    statusChanges: number;
    differences: ComplianceDifference[];
  };
  securityImpact: {
    scoreChange: number;
    riskLevel: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
    criticalChanges: number;
    findingsChange: number;
  };
  performanceMetrics: {
    executionTime: number;
    resourcesCompared: number;
    findingsCompared: number;
  };
  recommendations: string[];
  createdAt: string;
  createdBy: string;
}

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('differential-analyzer');

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
      return createErrorResponse(403, 'Insufficient permissions for differential analysis');
    }

    let result: APIGatewayProxyResult;

    switch (`${httpMethod} ${resource}`) {
      case 'POST /differential-analysis/start':
        result = await startDifferentialAnalysis(event, userTenantId, userRole, userProjectIds);
        break;
      case 'GET /differential-analysis/result/{analysisId}':
        result = await getDifferentialAnalysisResult(pathParameters!.analysisId!, userTenantId, userRole);
        break;
      case 'GET /differential-analysis/history/{projectId}':
        result = await getDifferentialAnalysisHistory(pathParameters!.projectId!, queryStringParameters, userTenantId, userRole);
        break;
      case 'GET /differential-analysis/scans/{projectId}':
        result = await getAvailableScans(pathParameters!.projectId!, userTenantId, userRole);
        break;
      default:
        result = createErrorResponse(404, `Route not found: ${httpMethod} ${resource}`);
    }

    metrics.addMetric('DifferentialAnalysisRequestSuccess', MetricUnit.Count, 1);
    return result;
  } catch (error) {
    logger.error('Differential analysis request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    metrics.addMetric('DifferentialAnalysisRequestError', MetricUnit.Count, 1);
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function startDifferentialAnalysis(
  event: APIGatewayProxyEvent,
  userTenantId: string,
  userRole: string,
  userProjectIds: string[]
): Promise<APIGatewayProxyResult> {
  const body: DifferentialAnalysisRequest = JSON.parse(event.body || '{}');
  const { tenantId, projectId, baselineScanId, comparisonScanId, analysisType, options } = body;

  // Tenant isolation check
  if (userRole !== 'SystemAdmin' && userTenantId !== tenantId) {
    return createErrorResponse(403, 'Cannot perform analysis for different tenant');
  }

  // Project access check
  if (userRole !== 'SystemAdmin' && userRole !== 'ClientAdmin' && !userProjectIds.includes(projectId)) {
    return createErrorResponse(403, 'No access to this project');
  }

  try {
    const startTime = Date.now();

    // Get baseline and comparison scan results
    const [baselineScan, comparisonScan] = await Promise.all([
      getScanResult(baselineScanId, tenantId),
      getScanResult(comparisonScanId, tenantId),
    ]);

    if (!baselineScan || !comparisonScan) {
      return createErrorResponse(404, 'One or both scan results not found');
    }

    // Validate scans are from the same account/project
    if (baselineScan.accountId !== comparisonScan.accountId) {
      return createErrorResponse(400, 'Scans must be from the same AWS account');
    }

    // Perform differential analysis
    const analysisResult = await performDifferentialAnalysis(
      baselineScan,
      comparisonScan,
      analysisType,
      options || { includeDetails: true, threshold: 'all' }
    );

    // Store analysis result
    const analysisId = `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdBy = (event.requestContext.identity as any)?.claims?.sub || 'system';

    const finalResult: DifferentialAnalysisResult = {
      ...analysisResult,
      id: analysisId,
      tenantId,
      projectId,
      analysisType,
      performanceMetrics: {
        executionTime: Date.now() - startTime,
        resourcesCompared: baselineScan.totalResources + comparisonScan.totalResources,
        findingsCompared: baselineScan.findings.length + comparisonScan.findings.length,
      },
      createdAt: new Date().toISOString(),
      createdBy,
    };

    await storeDifferentialAnalysisResult(finalResult);

    metrics.addMetric('DifferentialAnalysisCompleted', MetricUnit.Count, 1);
    metrics.addMetric('ResourcesCompared', MetricUnit.Count, finalResult.performanceMetrics.resourcesCompared);
    metrics.addMetric('AnalysisExecutionTime', MetricUnit.Milliseconds, finalResult.performanceMetrics.executionTime);

    logger.info('Differential analysis completed', {
      analysisId,
      tenantId,
      projectId,
      baselineScanId,
      comparisonScanId,
      totalChanges: finalResult.totalChanges,
      executionTime: finalResult.performanceMetrics.executionTime,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Differential analysis completed',
        analysisId,
        totalChanges: finalResult.totalChanges,
        resourceChanges: finalResult.resourceChanges,
        complianceChanges: finalResult.complianceChanges,
        securityImpact: finalResult.securityImpact,
        recommendations: finalResult.recommendations,
      }),
    };
  } catch (error) {
    throw error;
  }
}

async function performDifferentialAnalysis(
  baselineScan: ScanResult,
  comparisonScan: ScanResult,
  analysisType: string,
  options: any
): Promise<Partial<DifferentialAnalysisResult>> {
  const resourceChanges = await analyzeResourceChanges(baselineScan, comparisonScan, options);
  const complianceChanges = await analyzeComplianceChanges(baselineScan, comparisonScan, options);
  const securityImpact = await analyzeSecurityImpact(baselineScan, comparisonScan, complianceChanges);

  const totalChanges = 
    resourceChanges.added + 
    resourceChanges.removed + 
    resourceChanges.modified +
    complianceChanges.newViolations +
    complianceChanges.resolvedViolations +
    complianceChanges.statusChanges;

  const recommendations = generateRecommendations(resourceChanges, complianceChanges, securityImpact);

  return {
    baselineScan,
    comparisonScan,
    analysisDate: new Date().toISOString(),
    totalChanges,
    resourceChanges,
    complianceChanges,
    securityImpact,
    recommendations,
  };
}

async function analyzeResourceChanges(
  baselineScan: ScanResult,
  comparisonScan: ScanResult,
  options: any
): Promise<DifferentialAnalysisResult['resourceChanges']> {
  const differences: ResourceDifference[] = [];

  // Compare resource counts by service
  const baselineServices = baselineScan.resourcesByService || {};
  const comparisonServices = comparisonScan.resourcesByService || {};
  const allServices = new Set([...Object.keys(baselineServices), ...Object.keys(comparisonServices)]);

  for (const service of allServices) {
    const baselineCount = baselineServices[service] || 0;
    const comparisonCount = comparisonServices[service] || 0;
    const delta = comparisonCount - baselineCount;

    if (delta !== 0) {
      differences.push({
        resourceType: 'ServiceResources',
        service,
        region: 'all',
        changeType: delta > 0 ? 'ADDED' : 'REMOVED',
        oldValue: baselineCount,
        newValue: comparisonCount,
        impact: Math.abs(delta) > 10 ? 'HIGH' : Math.abs(delta) > 5 ? 'MEDIUM' : 'LOW',
        description: `${service}サービスのリソース数が${Math.abs(delta)}${delta > 0 ? '増加' : '減少'}しました`,
      });
    }
  }

  // Compare resource counts by region
  const baselineRegions = baselineScan.resourcesByRegion || {};
  const comparisonRegions = comparisonScan.resourcesByRegion || {};
  const allRegions = new Set([...Object.keys(baselineRegions), ...Object.keys(comparisonRegions)]);

  for (const region of allRegions) {
    const baselineCount = baselineRegions[region] || 0;
    const comparisonCount = comparisonRegions[region] || 0;
    const delta = comparisonCount - baselineCount;

    if (Math.abs(delta) > 5) { // Only report significant regional changes
      differences.push({
        resourceType: 'RegionalResources',
        service: 'all',
        region,
        changeType: delta > 0 ? 'ADDED' : 'REMOVED',
        oldValue: baselineCount,
        newValue: comparisonCount,
        impact: Math.abs(delta) > 20 ? 'HIGH' : Math.abs(delta) > 10 ? 'MEDIUM' : 'LOW',
        description: `${region}リージョンのリソース数が${Math.abs(delta)}${delta > 0 ? '増加' : '減少'}しました`,
      });
    }
  }

  const added = differences.filter(d => d.changeType === 'ADDED').length;
  const removed = differences.filter(d => d.changeType === 'REMOVED').length;
  const modified = differences.filter(d => d.changeType === 'MODIFIED').length;

  return {
    added,
    removed,
    modified,
    differences: differences.filter(d => {
      if (options.threshold === 'high') return d.impact === 'HIGH';
      if (options.threshold === 'medium') return ['HIGH', 'MEDIUM'].includes(d.impact);
      return true;
    }),
  };
}

async function analyzeComplianceChanges(
  baselineScan: ScanResult,
  comparisonScan: ScanResult,
  options: any
): Promise<DifferentialAnalysisResult['complianceChanges']> {
  const differences: ComplianceDifference[] = [];
  
  // Extract findings by rule ID for comparison
  const baselineFindings = extractFindingsByRule(baselineScan.findings || []);
  const comparisonFindings = extractFindingsByRule(comparisonScan.findings || []);
  
  const allRuleIds = new Set([...Object.keys(baselineFindings), ...Object.keys(comparisonFindings)]);

  for (const ruleId of allRuleIds) {
    const baselineFinding = baselineFindings[ruleId];
    const comparisonFinding = comparisonFindings[ruleId];

    if (!baselineFinding && comparisonFinding) {
      // New violation
      differences.push({
        ruleId,
        ruleName: comparisonFinding.title || ruleId,
        changeType: 'NEW_VIOLATION',
        newStatus: 'VIOLATION',
        severity: comparisonFinding.severity || 'MEDIUM',
        impact: '新しいコンプライアンス違反が検出されました',
        description: comparisonFinding.description || '詳細な説明が利用できません',
      });
    } else if (baselineFinding && !comparisonFinding) {
      // Resolved violation
      differences.push({
        ruleId,
        ruleName: baselineFinding.title || ruleId,
        changeType: 'RESOLVED',
        oldStatus: 'VIOLATION',
        newStatus: 'COMPLIANT',
        severity: baselineFinding.severity || 'MEDIUM',
        impact: 'コンプライアンス違反が解決されました',
        description: baselineFinding.description || '詳細な説明が利用できません',
      });
    } else if (baselineFinding && comparisonFinding) {
      // Check for status changes
      if (baselineFinding.severity !== comparisonFinding.severity) {
        differences.push({
          ruleId,
          ruleName: comparisonFinding.title || ruleId,
          changeType: 'STATUS_CHANGED',
          oldStatus: baselineFinding.severity,
          newStatus: comparisonFinding.severity,
          severity: comparisonFinding.severity || 'MEDIUM',
          impact: `重要度が${baselineFinding.severity}から${comparisonFinding.severity}に変更されました`,
          description: comparisonFinding.description || '詳細な説明が利用できません',
        });
      }
    }
  }

  const newViolations = differences.filter(d => d.changeType === 'NEW_VIOLATION').length;
  const resolvedViolations = differences.filter(d => d.changeType === 'RESOLVED').length;
  const statusChanges = differences.filter(d => d.changeType === 'STATUS_CHANGED').length;

  return {
    newViolations,
    resolvedViolations,
    statusChanges,
    differences: differences.filter(d => {
      if (options.threshold === 'high') return ['CRITICAL', 'HIGH'].includes(d.severity);
      if (options.threshold === 'medium') return ['CRITICAL', 'HIGH', 'MEDIUM'].includes(d.severity);
      return true;
    }),
  };
}

async function analyzeSecurityImpact(
  baselineScan: ScanResult,
  comparisonScan: ScanResult,
  complianceChanges: DifferentialAnalysisResult['complianceChanges']
): Promise<DifferentialAnalysisResult['securityImpact']> {
  const scoreChange = comparisonScan.complianceScore - baselineScan.complianceScore;
  const findingsChange = comparisonScan.securityFindings - baselineScan.securityFindings;
  const criticalChanges = comparisonScan.criticalFindings - baselineScan.criticalFindings;

  let riskLevel: 'INCREASED' | 'DECREASED' | 'UNCHANGED' = 'UNCHANGED';
  
  if (criticalChanges > 0 || complianceChanges.newViolations > complianceChanges.resolvedViolations) {
    riskLevel = 'INCREASED';
  } else if (criticalChanges < 0 || complianceChanges.resolvedViolations > complianceChanges.newViolations) {
    riskLevel = 'DECREASED';
  }

  return {
    scoreChange,
    riskLevel,
    criticalChanges,
    findingsChange,
  };
}

function generateRecommendations(
  resourceChanges: DifferentialAnalysisResult['resourceChanges'],
  complianceChanges: DifferentialAnalysisResult['complianceChanges'],
  securityImpact: DifferentialAnalysisResult['securityImpact']
): string[] {
  const recommendations: string[] = [];

  // Resource-based recommendations
  if (resourceChanges.added > 10) {
    recommendations.push('多数のリソースが追加されました。適切なタグ付けとコスト監視の設定を確認してください。');
  }
  
  if (resourceChanges.removed > 5) {
    recommendations.push('複数のリソースが削除されました。バックアップとデータ保持ポリシーを確認してください。');
  }

  // Compliance-based recommendations
  if (complianceChanges.newViolations > 0) {
    recommendations.push('新しいコンプライアンス違反が検出されました。セキュリティチームによる確認をお勧めします。');
  }

  if (complianceChanges.resolvedViolations > complianceChanges.newViolations) {
    recommendations.push('コンプライアンス状況が改善されています。継続的な監視を維持してください。');
  }

  // Security-based recommendations
  if (securityImpact.riskLevel === 'INCREASED') {
    recommendations.push('セキュリティリスクが増加しています。緊急対応が必要な場合があります。');
  }

  if (securityImpact.criticalChanges > 0) {
    recommendations.push('重大なセキュリティ問題が新たに検出されました。即座の対応が必要です。');
  }

  if (recommendations.length === 0) {
    recommendations.push('重大な変更は検出されませんでした。定期的な監視を継続してください。');
  }

  return recommendations;
}

function extractFindingsByRule(findings: any[]): Record<string, any> {
  const findingsByRule: Record<string, any> = {};
  
  for (const finding of findings) {
    if (finding.ruleId) {
      findingsByRule[finding.ruleId] = finding;
    }
  }
  
  return findingsByRule;
}

async function getScanResult(scanId: string, tenantId: string): Promise<ScanResult | null> {
  try {
    // Query analyses table to find the scan result
    const result = await dynamoClient.send(new QueryCommand({
      TableName: ANALYSES_TABLE,
      KeyConditionExpression: 'tenantId = :tenantId',
      FilterExpression: 'scanId = :scanId',
      ExpressionAttributeValues: {
        ':tenantId': tenantId,
        ':scanId': scanId,
      },
    }));

    if (result.Items && result.Items.length > 0) {
      const analysis = result.Items[0];
      
      // Transform to ScanResult format
      return {
        scanId,
        analysisId: analysis.id,
        accountId: analysis.awsConfig?.accountId || '',
        accountName: analysis.metadata?.accountName || '',
        environment: analysis.metadata?.environment || 'UNKNOWN',
        scanDate: analysis.createdAt,
        totalResources: analysis.summary?.totalResources || 0,
        resourcesByService: analysis.summary?.resourcesByService || {},
        resourcesByRegion: analysis.summary?.resourcesByRegion || {},
        resourcesByType: analysis.summary?.resourcesByType || {},
        complianceScore: analysis.summary?.complianceScore || 0,
        securityFindings: analysis.summary?.securityFindings || 0,
        criticalFindings: analysis.summary?.criticalFindings || 0,
        findings: analysis.findings || [],
        status: analysis.status,
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to get scan result', { scanId, error });
    return null;
  }
}

async function storeDifferentialAnalysisResult(result: DifferentialAnalysisResult): Promise<void> {
  await dynamoClient.send(new PutCommand({
    TableName: DIFFERENTIAL_ANALYSES_TABLE,
    Item: {
      ...result,
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
    },
  }));
}

// Helper functions for other endpoints
async function getDifferentialAnalysisResult(
  analysisId: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: DIFFERENTIAL_ANALYSES_TABLE,
      Key: { id: analysisId },
    }));

    if (!result.Item) {
      return createErrorResponse(404, 'Differential analysis result not found');
    }

    const analysis = result.Item as DifferentialAnalysisResult;

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && userTenantId !== analysis.tenantId) {
      return createErrorResponse(403, 'Cannot access analysis for different tenant');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(analysis),
    };
  } catch (error) {
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function getDifferentialAnalysisHistory(
  projectId: string,
  queryParams: any,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    const limit = parseInt(queryParams?.limit || '50');
    const offset = parseInt(queryParams?.offset || '0');

    const result = await dynamoClient.send(new QueryCommand({
      TableName: DIFFERENTIAL_ANALYSES_TABLE,
      KeyConditionExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId,
        ':tenantId': userTenantId,
      },
      FilterExpression: userRole !== 'SystemAdmin' ? 'tenantId = :tenantId' : undefined,
      ScanIndexForward: false, // Sort by newest first
      Limit: limit,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        analyses: result.Items || [],
        hasMore: result.LastEvaluatedKey ? true : false,
        total: result.Count || 0,
      }),
    };
  } catch (error) {
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function getAvailableScans(
  projectId: string,
  userTenantId: string,
  userRole: string
): Promise<APIGatewayProxyResult> {
  try {
    // Query analyses table for completed scans in this project
    const result = await dynamoClient.send(new QueryCommand({
      TableName: ANALYSES_TABLE,
      KeyConditionExpression: 'tenantId = :tenantId',
      FilterExpression: 'projectId = :projectId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':tenantId': userTenantId,
        ':projectId': projectId,
        ':status': 'COMPLETED',
      },
      ScanIndexForward: false,
      Limit: 100,
    }));

    const scans = (result.Items || []).map(item => ({
      scanId: item.scanId || item.id,
      analysisId: item.id,
      accountId: item.awsConfig?.accountId,
      accountName: item.metadata?.accountName,
      environment: item.metadata?.environment,
      scanDate: item.createdAt,
      totalResources: item.summary?.totalResources || 0,
      complianceScore: item.summary?.complianceScore || 0,
      securityFindings: item.summary?.securityFindings || 0,
      criticalFindings: item.summary?.criticalFindings || 0,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ scans }),
    };
  } catch (error) {
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
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