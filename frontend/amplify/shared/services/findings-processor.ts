import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { Finding } from './well-architected-analyzer';

export interface FindingsProcessorConfig {
  dynamoClient: DynamoDBClient;
  tableName: string;
  tenantId: string;
}

export interface FindingsSummary {
  bySeverity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    INFO: number;
  };
  byPillar: {
    OPERATIONAL_EXCELLENCE: number;
    SECURITY: number;
    RELIABILITY: number;
    PERFORMANCE_EFFICIENCY: number;
    COST_OPTIMIZATION: number;
    SUSTAINABILITY: number;
  };
}

/**
 * FindingsProcessor handles storage and processing of analysis findings
 */
export class FindingsProcessor {
  constructor(private config: FindingsProcessorConfig) {}

  /**
   * Store findings in DynamoDB
   */
  async storeFindings(analysisId: string, findings: Finding[]): Promise<void> {
    try {
      // Store findings in batches to avoid throttling
      const batchSize = 25; // DynamoDB batch write limit
      
      for (let i = 0; i < findings.length; i += batchSize) {
        const batch = findings.slice(i, i + batchSize);
        await this.storeFindingsBatch(analysisId, batch);
      }
    } catch (error) {
      console.error('Error storing findings:', error);
      throw error;
    }
  }

  private async storeFindingsBatch(analysisId: string, findings: Finding[]): Promise<void> {
    // For simplicity, using individual PutItem commands
    // In production, use BatchWriteItem for better performance
    const promises = findings.map(finding => 
      this.config.dynamoClient.send(
        new PutItemCommand({
          TableName: this.config.tableName,
          Item: marshall({
            id: finding.id,
            analysisId,
            tenantId: this.config.tenantId,
            title: finding.title,
            description: finding.description,
            severity: finding.severity,
            pillar: finding.pillar,
            resource: finding.resource,
            recommendation: finding.recommendation,
            category: finding.category,
            ruleId: finding.ruleId,
            line: finding.line,
            createdAt: new Date().toISOString(),
          }),
        })
      )
    );

    await Promise.all(promises);
  }

  /**
   * Generate findings summary
   */
  async generateSummary(analysisId: string): Promise<FindingsSummary> {
    try {
      // Query all findings for this analysis
      const result = await this.config.dynamoClient.send(
        new QueryCommand({
          TableName: this.config.tableName,
          IndexName: 'byAnalysis',
          KeyConditionExpression: 'analysisId = :analysisId',
          ExpressionAttributeValues: marshall({
            ':analysisId': analysisId,
          }),
        })
      );

      const findings = result.Items?.map(item => unmarshall(item)) || [];

      // Initialize summary
      const summary: FindingsSummary = {
        bySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
          INFO: 0,
        },
        byPillar: {
          OPERATIONAL_EXCELLENCE: 0,
          SECURITY: 0,
          RELIABILITY: 0,
          PERFORMANCE_EFFICIENCY: 0,
          COST_OPTIMIZATION: 0,
          SUSTAINABILITY: 0,
        },
      };

      // Count findings by severity and pillar
      findings.forEach(finding => {
        // Count by severity
        if (finding.severity in summary.bySeverity) {
          summary.bySeverity[finding.severity as keyof typeof summary.bySeverity]++;
        }

        // Count by pillar
        if (finding.pillar in summary.byPillar) {
          summary.byPillar[finding.pillar as keyof typeof summary.byPillar]++;
        }
      });

      return summary;
    } catch (error) {
      console.error('Error generating findings summary:', error);
      throw error;
    }
  }

  /**
   * Get findings with filters
   */
  async getFindings(
    analysisId: string,
    filters: {
      severityFilter?: string[];
      pillarFilter?: string[];
      limit?: number;
    } = {}
  ): Promise<Finding[]> {
    try {
      const result = await this.config.dynamoClient.send(
        new QueryCommand({
          TableName: this.config.tableName,
          IndexName: 'byAnalysis',
          KeyConditionExpression: 'analysisId = :analysisId',
          ExpressionAttributeValues: marshall({
            ':analysisId': analysisId,
          }),
          Limit: filters.limit || 1000,
        })
      );

      let findings = result.Items?.map(item => unmarshall(item)) || [];

      // Apply filters
      if (filters.severityFilter?.length) {
        findings = findings.filter(f => filters.severityFilter!.includes(f.severity));
      }

      if (filters.pillarFilter?.length) {
        findings = findings.filter(f => filters.pillarFilter!.includes(f.pillar));
      }

      return findings.map(f => ({
        id: f.id,
        title: f.title,
        description: f.description,
        severity: f.severity,
        pillar: f.pillar,
        resource: f.resource,
        recommendation: f.recommendation,
        category: f.category,
        ruleId: f.ruleId,
        line: f.line,
      }));
    } catch (error) {
      console.error('Error getting findings:', error);
      throw error;
    }
  }
}