import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { Finding } from './well-architected-analyzer';
import type { FrameworkSpecificFinding } from './advanced-analysis-engine';

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
  byFramework?: {
    [framework: string]: number;
  };
  scores: {
    overallScore: number;
    pillarScores: {
      OPERATIONAL_EXCELLENCE: number;
      SECURITY: number;
      RELIABILITY: number;
      PERFORMANCE_EFFICIENCY: number;
      COST_OPTIMIZATION: number;
      SUSTAINABILITY: number;
    };
    frameworkScores?: {
      [framework: string]: number;
    };
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * FindingsProcessor handles storage and processing of analysis findings
 */
export class FindingsProcessor {
  constructor(private config: FindingsProcessorConfig) {}

  /**
   * Store findings in DynamoDB (supports both basic and framework-specific findings)
   */
  async storeFindings(analysisId: string, findings: (Finding | FrameworkSpecificFinding)[]): Promise<void> {
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

  private async storeFindingsBatch(analysisId: string, findings: (Finding | FrameworkSpecificFinding)[]): Promise<void> {
    // For simplicity, using individual PutItem commands
    // In production, use BatchWriteItem for better performance
    const promises = findings.map(finding => {
      const baseItem = {
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
      };

      // Add framework-specific fields if available
      if ('framework' in finding) {
        const frameworkFinding = finding as FrameworkSpecificFinding;
        Object.assign(baseItem, {
          framework: frameworkFinding.framework,
          lensName: frameworkFinding.lensName,
          competencyArea: frameworkFinding.competencyArea,
          securityStandardId: frameworkFinding.securityStandardId,
          benchmarkScore: frameworkFinding.benchmarkScore,
        });
      }

      return this.config.dynamoClient.send(
        new PutItemCommand({
          TableName: this.config.tableName,
          Item: marshall(baseItem),
        })
      );
    });

    await Promise.all(promises);
  }

  /**
   * Generate comprehensive findings summary with scoring
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
        byFramework: {},
        scores: {
          overallScore: 0,
          pillarScores: {
            OPERATIONAL_EXCELLENCE: 0,
            SECURITY: 0,
            RELIABILITY: 0,
            PERFORMANCE_EFFICIENCY: 0,
            COST_OPTIMIZATION: 0,
            SUSTAINABILITY: 0,
          },
          frameworkScores: {},
        },
        riskLevel: 'LOW',
      };

      // Count findings by severity, pillar, and framework
      findings.forEach(finding => {
        // Count by severity
        if (finding.severity in summary.bySeverity) {
          summary.bySeverity[finding.severity as keyof typeof summary.bySeverity]++;
        }

        // Count by pillar
        if (finding.pillar in summary.byPillar) {
          summary.byPillar[finding.pillar as keyof typeof summary.byPillar]++;
        }

        // Count by framework (if available)
        if (finding.framework) {
          summary.byFramework![finding.framework] = (summary.byFramework![finding.framework] || 0) + 1;
        }
      });

      // Calculate scores
      summary.scores = this.calculateScores(findings);
      summary.riskLevel = this.determineRiskLevel(summary.scores.overallScore, summary.bySeverity);

      return summary;
    } catch (error) {
      console.error('Error generating findings summary:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive scores based on findings
   */
  private calculateScores(findings: any[]): FindingsSummary['scores'] {
    const severityWeights = {
      CRITICAL: 10,
      HIGH: 7,
      MEDIUM: 4,
      LOW: 2,
      INFO: 0,
    };

    const pillarScores = {
      OPERATIONAL_EXCELLENCE: 100,
      SECURITY: 100,
      RELIABILITY: 100,
      PERFORMANCE_EFFICIENCY: 100,
      COST_OPTIMIZATION: 100,
      SUSTAINABILITY: 100,
    };

    const frameworkScores: Record<string, number> = {};

    // Calculate deductions for each pillar
    findings.forEach(finding => {
      const severityPenalty = severityWeights[finding.severity as keyof typeof severityWeights] || 0;
      
      // Deduct from pillar score
      if (finding.pillar in pillarScores) {
        pillarScores[finding.pillar as keyof typeof pillarScores] = Math.max(0, 
          pillarScores[finding.pillar as keyof typeof pillarScores] - severityPenalty
        );
      }

      // Calculate framework scores
      if (finding.framework) {
        if (!frameworkScores[finding.framework]) {
          frameworkScores[finding.framework] = 100;
        }
        frameworkScores[finding.framework] = Math.max(0, frameworkScores[finding.framework] - severityPenalty);
      }
    });

    // Calculate overall score as weighted average of pillar scores
    const pillarValues = Object.values(pillarScores);
    const overallScore = pillarValues.reduce((sum, score) => sum + score, 0) / pillarValues.length;

    return {
      overallScore: Math.round(overallScore),
      pillarScores,
      frameworkScores,
    };
  }

  /**
   * Determine risk level based on score and critical findings
   */
  private determineRiskLevel(
    overallScore: number, 
    severityCount: FindingsSummary['bySeverity']
  ): FindingsSummary['riskLevel'] {
    // High risk if any critical findings
    if (severityCount.CRITICAL > 0) {
      return 'CRITICAL';
    }

    // Risk level based on score and high findings
    if (overallScore < 50 || severityCount.HIGH > 5) {
      return 'HIGH';
    } else if (overallScore < 75 || severityCount.HIGH > 2) {
      return 'MEDIUM';
    } else {
      return 'LOW';
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
        framework: f.framework,
        benchmarkScore: f.benchmarkScore,
      }));
    } catch (error) {
      console.error('Error getting findings:', error);
      throw error;
    }
  }

  /**
   * Generate detailed analysis report
   */
  async generateAnalysisReport(analysisId: string): Promise<{
    summary: FindingsSummary;
    recommendations: Array<{
      priority: number;
      pillar: string;
      title: string;
      description: string;
      estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
      costImpact: 'LOW' | 'MEDIUM' | 'HIGH';
      businessValue: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
    quickWins: Array<{
      title: string;
      description: string;
      effort: 'LOW';
      impact: 'MEDIUM' | 'HIGH';
    }>;
    trendAnalysis?: {
      scoreImprovement: number;
      riskReduction: string;
      timeToTarget: string;
    };
  }> {
    try {
      const summary = await this.generateSummary(analysisId);
      const findings = await this.getFindings(analysisId);

      // Generate prioritized recommendations
      const recommendations = this.generateRecommendations(findings);
      
      // Identify quick wins (low effort, high impact)
      const quickWins = this.identifyQuickWins(findings);

      return {
        summary,
        recommendations,
        quickWins,
      };
    } catch (error) {
      console.error('Error generating analysis report:', error);
      throw error;
    }
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(findings: any[]): Array<{
    priority: number;
    pillar: string;
    title: string;
    description: string;
    estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
    costImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    businessValue: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const recommendations: Map<string, any> = new Map();

    // Group findings by pillar and severity
    findings.forEach(finding => {
      const key = `${finding.pillar}-${finding.severity}`;
      
      if (!recommendations.has(key)) {
        recommendations.set(key, {
          priority: this.getPriorityScore(finding.severity),
          pillar: finding.pillar,
          title: `Improve ${finding.pillar.toLowerCase().replace('_', ' ')} practices`,
          description: finding.recommendation,
          estimatedEffort: this.estimateEffort(finding.severity),
          costImpact: this.estimateCostImpact(finding.severity),
          businessValue: this.estimateBusinessValue(finding.pillar, finding.severity),
          count: 1,
        });
      } else {
        const existing = recommendations.get(key);
        existing.count++;
        existing.priority += this.getPriorityScore(finding.severity);
      }
    });

    return Array.from(recommendations.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // Top 10 recommendations
  }

  /**
   * Identify quick wins (low effort, high impact)
   */
  private identifyQuickWins(findings: any[]): Array<{
    title: string;
    description: string;
    effort: 'LOW';
    impact: 'MEDIUM' | 'HIGH';
  }> {
    const quickWins: Array<{
      title: string;
      description: string;
      effort: 'LOW';
      impact: 'MEDIUM' | 'HIGH';
    }> = [];

    // Look for specific patterns that indicate quick wins
    const quickWinPatterns = [
      {
        pattern: /tag/i,
        title: 'Add resource tags',
        description: 'Implement consistent tagging strategy for better resource management',
        impact: 'MEDIUM' as const,
      },
      {
        pattern: /encrypt/i,
        title: 'Enable encryption',
        description: 'Enable encryption at rest for improved security',
        impact: 'HIGH' as const,
      },
      {
        pattern: /backup/i,
        title: 'Configure backups',
        description: 'Set up automated backup policies for data protection',
        impact: 'HIGH' as const,
      },
      {
        pattern: /monitor/i,
        title: 'Add monitoring',
        description: 'Implement CloudWatch monitoring and alerting',
        impact: 'MEDIUM' as const,
      },
    ];

    findings.forEach(finding => {
      if (finding.severity === 'MEDIUM' || finding.severity === 'LOW') {
        quickWinPatterns.forEach(pattern => {
          if (pattern.pattern.test(finding.title) || pattern.pattern.test(finding.description)) {
            quickWins.push({
              title: pattern.title,
              description: pattern.description,
              effort: 'LOW',
              impact: pattern.impact,
            });
          }
        });
      }
    });

    // Remove duplicates and limit to 5
    const uniqueQuickWins = quickWins.filter((win, index, array) => 
      array.findIndex(w => w.title === win.title) === index
    );

    return uniqueQuickWins.slice(0, 5);
  }

  private getPriorityScore(severity: string): number {
    const scores = { CRITICAL: 10, HIGH: 7, MEDIUM: 4, LOW: 2, INFO: 1 };
    return scores[severity as keyof typeof scores] || 1;
  }

  private estimateEffort(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (severity === 'CRITICAL') return 'HIGH';
    if (severity === 'HIGH') return 'MEDIUM';
    return 'LOW';
  }

  private estimateCostImpact(severity: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (severity === 'CRITICAL') return 'HIGH';
    if (severity === 'HIGH') return 'MEDIUM';
    return 'LOW';
  }

  private estimateBusinessValue(pillar: string, severity: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    // Security and reliability issues have high business value
    if (pillar === 'SECURITY' || pillar === 'RELIABILITY') {
      return severity === 'CRITICAL' || severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    }
    
    // Cost optimization has high business value
    if (pillar === 'COST_OPTIMIZATION') {
      return 'HIGH';
    }
    
    return severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM';
  }
}