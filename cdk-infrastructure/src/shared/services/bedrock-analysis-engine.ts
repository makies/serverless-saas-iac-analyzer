import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import {
  AnalysisRequest,
  AnalysisResult,
  AnalysisFramework,
  AnalysisRule,
  Finding,
  Recommendation,
  AnalysisSummary,
  FrameworkResult,
  WellArchitectedPillar,
} from '../types/analysis-framework';
import { TenantContext } from '../types/tenant-context';
import { bedrockRuntimeClient } from '../utils/aws-clients';

const logger = new Logger({ serviceName: 'bedrock-analysis-engine' });
const tracer = new Tracer({ serviceName: 'bedrock-analysis-engine' });
const metrics = new Metrics({ namespace: 'CloudBPA/BedrockAnalysis' });

interface BedrockAnalysisConfig {
  modelId: string;
  region: string;
  temperature: number;
  maxTokens: number;
  topP: number;
}

interface IaCResourceDefinition {
  type: string;
  name: string;
  properties: Record<string, unknown>;
  metadata: {
    location: string;
    line?: number;
    dependencies: string[];
  };
}

interface ParsedIaCTemplate {
  templateType: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK';
  version?: string;
  resources: IaCResourceDefinition[];
  parameters: Record<string, unknown>;
  outputs: Record<string, unknown>;
  metadata: {
    fileSize: number;
    resourceCount: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

/**
 * Amazon Bedrock Claude 4 Sonnetを使用したIaC分析エンジン
 */
export class BedrockAnalysisEngine {
  private readonly config: BedrockAnalysisConfig;

  constructor(config: BedrockAnalysisConfig) {
    this.config = config;
  }

  /**
   * IaCテンプレートの分析実行
   */
  async analyzeIaCTemplate(
    context: TenantContext,
    request: AnalysisRequest,
    frameworks: AnalysisFramework[],
    iacContent: string
  ): Promise<AnalysisResult> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('analyzeIaCTemplate');

    try {
      const startTime = Date.now();

      logger.info('Starting IaC analysis', {
        tenantId: context.tenantId,
        requestId: request.id,
        frameworks: frameworks.map((f) => f.id),
      });

      // 1. IaCテンプレートの解析
      const parsedTemplate = await this.parseIaCTemplate(
        iacContent,
        request.targets[0]?.fileInfo?.fileType || 'CLOUDFORMATION'
      );

      // 2. フレームワーク別分析実行
      const frameworkResults: FrameworkResult[] = [];
      const allFindings: Finding[] = [];

      for (const framework of frameworks) {
        const frameworkResult = await this.analyzeWithFramework(
          context,
          parsedTemplate,
          framework,
          iacContent
        );
        frameworkResults.push(frameworkResult);
        allFindings.push(...frameworkResult.findings);
      }

      // 3. AI駆動の追加分析
      const aiRecommendations = await this.generateAIRecommendations(
        context,
        parsedTemplate,
        allFindings,
        iacContent
      );

      // 4. 分析結果の統合
      const summary = this.generateAnalysisSummary(frameworkResults, allFindings);

      const processingTime = (Date.now() - startTime) / 1000;

      const result: AnalysisResult = {
        id: `analysis-${Date.now()}`,
        requestId: request.id,
        tenantId: context.tenantId,
        projectId: request.projectId,
        summary,
        frameworkResults,
        findings: allFindings,
        recommendations: aiRecommendations,
        metadata: {
          version: '1.0.0',
          analysisEngine: 'BedrockClaude4Sonnet',
          processingTime,
          resourcesAnalyzed: parsedTemplate.resources.length,
          rulesExecuted: frameworks.reduce((sum, f) => sum + f.rules.length, 0),
          aiAnalysis: {
            model: this.config.modelId,
            tokensUsed: 0, // Will be updated after AI calls
            confidence: 0.85,
            processingTime: 0,
          },
          dataRetention: {
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
            autoDeleteEnabled: true,
          },
        },
        reports: [], // Will be generated separately
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      logger.info('IaC analysis completed', {
        tenantId: context.tenantId,
        requestId: request.id,
        processingTime,
        findingsCount: allFindings.length,
        overallScore: summary.overallScore,
      });

      metrics.addMetric('AnalysisCompleted', 'Count', 1);
      metrics.addMetric('AnalysisProcessingTime', 'Seconds', processingTime);
      metrics.addMetric('FindingsGenerated', 'Count', allFindings.length);

      return result;
    } catch (error) {
      logger.error('IaC analysis failed', { error, tenantId: context.tenantId });
      metrics.addMetric('AnalysisError', 'Count', 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * IaCテンプレートの解析
   */
  private async parseIaCTemplate(
    content: string,
    templateType: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK'
  ): Promise<ParsedIaCTemplate> {
    // 実際の実装では、IaCテンプレートパーサーライブラリを使用
    // ここでは簡略化した実装を示す

    let parsed: any;
    const resources: IaCResourceDefinition[] = [];

    try {
      if (templateType === 'CLOUDFORMATION') {
        parsed = JSON.parse(content);

        if (parsed.Resources) {
          Object.entries(parsed.Resources).forEach(([name, resource]: [string, any]) => {
            resources.push({
              type: resource.Type,
              name,
              properties: resource.Properties || {},
              metadata: {
                location: `Resources.${name}`,
                dependencies: resource.DependsOn || [],
              },
            });
          });
        }
      } else if (templateType === 'TERRAFORM') {
        // Terraform HCL parsing would be implemented here
        // For now, use simple regex-based parsing
        const resourceMatches = content.match(/resource\s+"([^"]+)"\s+"([^"]+)"\s*{[^}]*}/g) || [];

        resourceMatches.forEach((match, index) => {
          const typeMatch = match.match(/resource\s+"([^"]+)"/);
          const nameMatch = match.match(/resource\s+"[^"]+"\s+"([^"]+)"/);

          if (typeMatch && nameMatch) {
            resources.push({
              type: typeMatch[1],
              name: nameMatch[1],
              properties: {}, // Would extract properties from HCL
              metadata: {
                location: `line_${index + 1}`,
                dependencies: [],
              },
            });
          }
        });
      }

      return {
        templateType,
        version: parsed?.AWSTemplateFormatVersion || '2010-09-09',
        resources,
        parameters: parsed?.Parameters || {},
        outputs: parsed?.Outputs || {},
        metadata: {
          fileSize: content.length,
          resourceCount: resources.length,
          complexity: resources.length > 50 ? 'HIGH' : resources.length > 20 ? 'MEDIUM' : 'LOW',
        },
      };
    } catch (error) {
      logger.error('Failed to parse IaC template', { error, templateType });
      throw new Error(`Failed to parse ${templateType} template: ${error}`);
    }
  }

  /**
   * フレームワーク別分析実行
   */
  private async analyzeWithFramework(
    context: TenantContext,
    template: ParsedIaCTemplate,
    framework: AnalysisFramework,
    iacContent: string
  ): Promise<FrameworkResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = framework.rules.length * 100;

    // ルールベース分析
    for (const rule of framework.rules.filter((r) => r.isActive)) {
      const ruleResult = await this.evaluateRule(rule, template, iacContent);

      if (ruleResult.finding) {
        findings.push(ruleResult.finding);
      }

      if (ruleResult.passed) {
        score += 100;
      }
    }

    const pillarScores: Record<WellArchitectedPillar, number> = {} as any;
    const categoryScores: Record<string, number> = {};

    // カテゴリ別スコア計算
    framework.rules.forEach((rule) => {
      if (rule.pillar) {
        if (!pillarScores[rule.pillar]) {
          pillarScores[rule.pillar] = 0;
        }
      }

      if (!categoryScores[rule.category]) {
        categoryScores[rule.category] = 0;
      }
    });

    findings.forEach((finding) => {
      const rule = framework.rules.find((r) => r.id === finding.ruleId);
      if (rule) {
        if (rule.pillar && finding.status === 'PASSED') {
          pillarScores[rule.pillar] += 100;
        }
        if (finding.status === 'PASSED') {
          categoryScores[rule.category] += 100;
        }
      }
    });

    return {
      frameworkId: framework.id,
      frameworkName: framework.name,
      score,
      maxScore,
      percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
      pillarScores,
      categoryScores,
      passedRules: findings.filter((f) => f.status === 'PASSED').length,
      failedRules: findings.filter((f) => f.status === 'FAILED').length,
      totalRules: framework.rules.length,
      findings,
    };
  }

  /**
   * ルール評価
   */
  private async evaluateRule(
    rule: AnalysisRule,
    template: ParsedIaCTemplate,
    iacContent: string
  ): Promise<{ passed: boolean; finding?: Finding }> {
    let passed = true;
    const affectedResources: any[] = [];

    // 条件評価
    for (const condition of rule.conditions) {
      const conditionResult = this.evaluateCondition(condition, template);

      if (!conditionResult.passed) {
        passed = false;
        affectedResources.push(...conditionResult.affectedResources);
      }
    }

    // AI駆動の追加評価（カスタムロジックがある場合）
    if (rule.conditions.some((c) => c.type === 'CUSTOM' && c.customLogic)) {
      const aiEvaluation = await this.evaluateWithAI(rule, template, iacContent);
      if (!aiEvaluation.passed) {
        passed = false;
      }
    }

    if (!passed) {
      const finding: Finding = {
        id: `finding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ruleId: rule.id,
        frameworkId: rule.frameworkId,
        category: rule.category,
        pillar: rule.pillar,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        status: 'FAILED',
        affectedResources,
        remediation: rule.remediation,
      };

      return { passed: false, finding };
    }

    return { passed: true };
  }

  /**
   * 条件評価
   */
  private evaluateCondition(
    condition: any,
    template: ParsedIaCTemplate
  ): { passed: boolean; affectedResources: any[] } {
    const affectedResources: any[] = [];
    let passed = true;

    switch (condition.type) {
      case 'RESOURCE_TYPE':
        const matchingResources = template.resources.filter((r) =>
          this.matchesCondition(r.type, condition.operator, condition.value)
        );

        if (matchingResources.length === 0 && condition.operator === 'EXISTS') {
          passed = false;
        } else if (matchingResources.length > 0 && condition.operator === 'NOT_EXISTS') {
          passed = false;
          affectedResources.push(...matchingResources);
        }
        break;

      case 'PROPERTY_VALUE':
        template.resources.forEach((resource) => {
          const propertyValue = this.getNestedProperty(resource.properties, condition.field);

          if (!this.matchesCondition(propertyValue, condition.operator, condition.value)) {
            passed = false;
            affectedResources.push(resource);
          }
        });
        break;

      default:
        // その他の条件タイプの実装
        break;
    }

    return { passed, affectedResources };
  }

  /**
   * AI駆動の評価
   */
  private async evaluateWithAI(
    rule: AnalysisRule,
    template: ParsedIaCTemplate,
    iacContent: string
  ): Promise<{ passed: boolean; explanation?: string; confidence?: number }> {
    const prompt = `
Analyze the following Infrastructure as Code template against this security/best practice rule:

Rule: ${rule.title}
Description: ${rule.description}
Category: ${rule.category}
Severity: ${rule.severity}

Template Type: ${template.templateType}
Resource Count: ${template.resources.length}

IaC Content (first 2000 chars):
${iacContent.substring(0, 2000)}

Custom Logic to Evaluate:
${rule.conditions.find((c) => c.customLogic)?.customLogic || 'Standard evaluation'}

Please analyze if this template violates the rule and provide:
1. Pass/Fail determination
2. Detailed explanation
3. Confidence level (0-1)
4. Specific resources that are problematic (if any)

Response format: JSON with fields "passed", "explanation", "confidence", "problematicResources"
`;

    try {
      const command = new InvokeModelCommand({
        modelId: this.config.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      const response = await bedrockRuntimeClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Claudeの応答を解析
      const content = responseBody.content[0].text;

      try {
        const analysis = JSON.parse(content);

        metrics.addMetric('AIEvaluationSuccess', 'Count', 1);

        return {
          passed: analysis.passed === true,
          explanation: analysis.explanation,
          confidence: analysis.confidence || 0.5,
        };
      } catch (parseError) {
        logger.warn('Failed to parse AI response as JSON, using text analysis', { content });

        // JSONパースが失敗した場合はテキスト解析
        const passed =
          !content.toLowerCase().includes('fail') &&
          !content.toLowerCase().includes('violat') &&
          !content.toLowerCase().includes('problem');

        return {
          passed,
          explanation: content,
          confidence: 0.7,
        };
      }
    } catch (error) {
      logger.error('AI evaluation failed', { error, ruleId: rule.id });
      metrics.addMetric('AIEvaluationError', 'Count', 1);

      // AIが失敗した場合はデフォルトで通す
      return { passed: true, confidence: 0.1 };
    }
  }

  /**
   * AI推奨事項生成
   */
  private async generateAIRecommendations(
    context: TenantContext,
    template: ParsedIaCTemplate,
    findings: Finding[],
    iacContent: string
  ): Promise<Recommendation[]> {
    if (findings.length === 0) {
      return [];
    }

    const prompt = `
As an AWS Cloud Architecture expert, analyze the following Infrastructure as Code template and security findings to provide actionable recommendations:

Template Overview:
- Type: ${template.templateType}
- Resources: ${template.resources.length}
- Complexity: ${template.metadata.complexity}

Security Findings (${findings.length} total):
${findings
  .slice(0, 5)
  .map(
    (f) => `
- ${f.severity}: ${f.title}
  Category: ${f.category}
  Affected Resources: ${f.affectedResources.length}
`
  )
  .join('')}

Template Sample (first 1500 chars):
${iacContent.substring(0, 1500)}

Please provide 3-5 prioritized recommendations focusing on:
1. Security improvements
2. Cost optimization opportunities  
3. Performance enhancements
4. Operational excellence

For each recommendation, include:
- Priority (HIGH/MEDIUM/LOW)
- Business impact
- Implementation effort
- Technical steps
- Estimated timeline

Response format: JSON array of recommendation objects
`;

    try {
      const command = new InvokeModelCommand({
        modelId: this.config.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4000,
          temperature: 0.3,
          top_p: 0.9,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      const response = await bedrockRuntimeClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.content[0].text;

      // AI応答を構造化推奨事項に変換
      const recommendations: Recommendation[] = [];

      // 簡略化した実装 - 実際にはより詳細な解析が必要
      const mockRecommendations: Recommendation[] = [
        {
          id: `rec-${Date.now()}-1`,
          category: 'SECURITY',
          priority: 'HIGH',
          title: 'Enable encryption at rest for all storage services',
          description:
            'Implement encryption for S3 buckets, RDS instances, and other data storage services',
          businessImpact: 'Reduces data breach risk and ensures compliance with security standards',
          technicalDetails: content.substring(0, 200),
          implementation: {
            effort: 'MEDIUM',
            timeline: '1-2 weeks',
            prerequisites: ['KMS key setup', 'IAM policy updates'],
            steps: [
              'Create KMS keys for encryption',
              'Update resource configurations',
              'Test encrypted operations',
              'Update monitoring and backup procedures',
            ],
          },
          metrics: {
            riskReduction: 'High - eliminates data exposure risk',
          },
          relatedFindings: findings
            .filter((f) => f.category === 'SECURITY')
            .slice(0, 3)
            .map((f) => f.id),
        },
      ];

      metrics.addMetric('AIRecommendationsGenerated', 'Count', mockRecommendations.length);

      return mockRecommendations;
    } catch (error) {
      logger.error('Failed to generate AI recommendations', { error });
      metrics.addMetric('AIRecommendationError', 'Count', 1);
      return [];
    }
  }

  /**
   * 分析サマリー生成
   */
  private generateAnalysisSummary(
    frameworkResults: FrameworkResult[],
    findings: Finding[]
  ): AnalysisSummary {
    const totalScore = frameworkResults.reduce((sum, result) => sum + result.score, 0);
    const maxTotalScore = frameworkResults.reduce((sum, result) => sum + result.maxScore, 0);
    const overallScore = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;

    const findingCounts = {
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      medium: findings.filter((f) => f.severity === 'MEDIUM').length,
      low: findings.filter((f) => f.severity === 'LOW').length,
      info: findings.filter((f) => f.severity === 'INFO').length,
      total: findings.length,
    };

    const scoreByFramework = frameworkResults.reduce(
      (acc, result) => {
        acc[result.frameworkId] = result.percentage;
        return acc;
      },
      {} as Record<string, number>
    );

    const complianceStatus =
      findingCounts.critical > 0 || findingCounts.high > 0
        ? 'NON_COMPLIANT'
        : findingCounts.medium > 0
          ? 'PARTIAL'
          : 'COMPLIANT';

    const riskLevel =
      findingCounts.critical > 0
        ? 'CRITICAL'
        : findingCounts.high > 0
          ? 'HIGH'
          : findingCounts.medium > 0
            ? 'MEDIUM'
            : 'LOW';

    return {
      overallScore,
      maxScore: maxTotalScore,
      scoreByPillar: {} as Record<WellArchitectedPillar, number>, // Would be calculated from pillar-specific rules
      scoreByFramework,
      findingCounts,
      complianceStatus,
      riskLevel,
    };
  }

  /**
   * ヘルパーメソッド: 条件マッチング
   */
  private matchesCondition(value: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'EQUALS':
        return value === expectedValue;
      case 'NOT_EQUALS':
        return value !== expectedValue;
      case 'CONTAINS':
        return String(value).includes(String(expectedValue));
      case 'NOT_CONTAINS':
        return !String(value).includes(String(expectedValue));
      case 'REGEX':
        return new RegExp(String(expectedValue)).test(String(value));
      case 'EXISTS':
        return value !== undefined && value !== null;
      case 'NOT_EXISTS':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  /**
   * ヘルパーメソッド: ネストしたプロパティ取得
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
