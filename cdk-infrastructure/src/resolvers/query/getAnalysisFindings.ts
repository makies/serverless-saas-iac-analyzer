/**
 * Get Analysis Findings Query Resolver
 * Retrieves findings for a specific analysis with filtering and pagination
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'AnalysisService' });
const tracer = new Tracer({ serviceName: 'AnalysisService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface GetAnalysisFindingsArgs {
  analysisId: string;
  severity?: string;
  pillar?: string;
  category?: string;
  limit?: number;
  nextToken?: string;
}

interface Finding {
  findingId: string;
  analysisId: string;
  tenantId: string;
  title: string;
  description: string;
  severity: string;
  pillar: string;
  resource?: string;
  line?: number;
  recommendation: string;
  category: string;
  ruleId: string;
  frameworkId: string;
  createdAt: string;
}

interface FindingConnection {
  items: Finding[];
  nextToken?: string;
}

const getAnalysisFindings: AppSyncResolverHandler<GetAnalysisFindingsArgs, FindingConnection> = async (event) => {
  const { arguments: args, identity } = event;
  const { analysisId, severity, pillar, category, limit = 50, nextToken } = args;

  const userTenantId = (identity as any)?.claims?.['custom:tenantId'];
  const userRole = (identity as any)?.claims?.['custom:role'];
  const userId = (identity as any)?.sub;

  logger.info('GetAnalysisFindings query started', {
    userId,
    analysisId,
    userTenantId,
    userRole,
    filters: { severity, pillar, category },
    limit,
  });

  try {
    // First verify the analysis exists and user has access
    const analysisQuery = new QueryCommand({
      TableName: process.env.ANALYSES_TABLE!,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `ANALYSIS#${analysisId}`,
        ':sk': '#METADATA',
      },
    });

    const analysisResult = await ddbDocClient.send(analysisQuery);
    if (!analysisResult.Items || analysisResult.Items.length === 0) {
      throw new Error(`Analysis '${analysisId}' not found`);
    }

    const analysis = analysisResult.Items[0];

    // Tenant isolation check
    if (userRole !== 'SystemAdmin' && analysis.tenantId !== userTenantId) {
      logger.warn('Access denied to analysis from different tenant', {
        analysisId,
        analysisTenantId: analysis.tenantId,
        userTenantId,
      });
      throw new Error('Access denied: Cannot access analysis from different tenant');
    }

    // Build the query for findings
    let keyConditionExpression = 'pk = :pk';
    const expressionAttributeValues: any = {
      ':pk': `ANALYSIS#${analysisId}`,
    };

    // Add sort key filter for findings
    keyConditionExpression += ' AND begins_with(sk, :skPrefix)';
    expressionAttributeValues[':skPrefix'] = 'FINDING#';

    // Build filter expression for optional filters
    let filterExpression = '';
    const filterConditions: string[] = [];

    if (severity) {
      filterConditions.push('#severity = :severity');
      expressionAttributeValues[':severity'] = severity;
    }

    if (pillar) {
      filterConditions.push('#pillar = :pillar');
      expressionAttributeValues[':pillar'] = pillar;
    }

    if (category) {
      filterConditions.push('#category = :category');
      expressionAttributeValues[':category'] = category;
    }

    if (filterConditions.length > 0) {
      filterExpression = filterConditions.join(' AND ');
    }

    const queryParams: any = {
      TableName: process.env.FINDINGS_TABLE!,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: Math.min(limit, 100), // Cap at 100 items per page
      ScanIndexForward: false, // Most recent findings first
    };

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
      queryParams.ExpressionAttributeNames = {
        '#severity': 'severity',
        '#pillar': 'pillar',
        '#category': 'category',
      };
    }

    if (nextToken) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
      } catch (error) {
        throw new Error('Invalid pagination token');
      }
    }

    const result = await ddbDocClient.send(new QueryCommand(queryParams));

    const findings: Finding[] = (result.Items || []).map(item => ({
      findingId: item.findingId,
      analysisId: item.analysisId,
      tenantId: item.tenantId,
      title: item.title,
      description: item.description,
      severity: item.severity,
      pillar: item.pillar,
      resource: item.resource,
      line: item.line,
      recommendation: item.recommendation,
      category: item.category,
      ruleId: item.ruleId,
      frameworkId: item.frameworkId,
      createdAt: item.createdAt,
    }));

    const response: FindingConnection = {
      items: findings,
    };

    if (result.LastEvaluatedKey) {
      response.nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    logger.info('GetAnalysisFindings query completed', {
      analysisId,
      tenantId: analysis.tenantId,
      findingsCount: findings.length,
      hasMore: !!response.nextToken,
      filters: { severity, pillar, category },
    });

    return response;
  } catch (error: any) {
    logger.error('Error getting analysis findings', {
      error: error instanceof Error ? error.message : String(error),
      analysisId,
      filters: { severity, pillar, category },
    });
    throw new Error('Failed to get analysis findings');
  }
};

// Export the handler with middleware
export const handler = middy(getAnalysisFindings)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));