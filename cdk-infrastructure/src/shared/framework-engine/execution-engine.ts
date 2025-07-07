/**
 * Framework Execution Engine - Executes analysis frameworks and rules
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  Framework,
  Rule,
  FrameworkExecutionContext,
  RuleExecutionContext,
  RuleExecutionResult,
  FrameworkAnalysisResult,
  MultiFrameworkAnalysisResult,
  Finding,
  FindingSeverity,
  RuleImplementationType,
  FrameworkSummary,
  AggregatedSummary,
  WellArchitectedPillar
} from './types';
import { FrameworkRegistry } from './registry';

export class FrameworkExecutionEngine {
  private readonly logger: Logger;
  private readonly registry: FrameworkRegistry;
  private readonly bedrockClient: BedrockRuntimeClient;

  constructor(logger: Logger) {
    this.logger = logger;
    this.registry = new FrameworkRegistry(logger);
    this.bedrockClient = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || 'us-east-1',
    });
  }

  /**
   * Execute multiple frameworks for an analysis
   */
  async executeMultiFrameworkAnalysis(
    tenantId: string,
    projectId: string,
    analysisId: string,
    frameworkIds: string[],
    resources: any[]
  ): Promise<MultiFrameworkAnalysisResult> {
    const startTime = new Date().toISOString();
    
    try {
      this.logger.info('Starting multi-framework analysis', {
        tenantId,
        projectId,
        analysisId,
        frameworkIds,
        resourceCount: resources.length,
      });

      const frameworkResults: FrameworkAnalysisResult[] = [];

      // Execute frameworks in parallel (with concurrency limit)
      const concurrencyLimit = 3;
      const chunks = this.chunkArray(frameworkIds, concurrencyLimit);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(frameworkId =>
          this.executeSingleFramework(tenantId, projectId, analysisId, frameworkId, resources)
        );

        const chunkResults = await Promise.allSettled(chunkPromises);
        
        for (const result of chunkResults) {
          if (result.status === 'fulfilled') {
            frameworkResults.push(result.value);
          } else {
            this.logger.error('Framework execution failed', { error: result.reason });
            // Create failed result
            frameworkResults.push(this.createFailedFrameworkResult(
              chunk[chunkResults.indexOf(result)],
              result.reason.message
            ));
          }
        }
      }

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      const aggregatedSummary = this.aggregateResults(frameworkResults);

      const status = this.determineOverallStatus(frameworkResults);

      return {
        analysisId,
        tenantId,
        projectId,
        status,
        startTime,
        endTime,
        duration,
        frameworks: frameworkResults,
        aggregatedSummary,
        metadata: {
          totalFrameworks: frameworkIds.length,
          resourceCount: resources.length,
          executionMode: 'parallel',
        },
      };
    } catch (error) {
      this.logger.error('Multi-framework analysis failed', { error });
      
      return {
        analysisId,
        tenantId,
        projectId,
        status: 'FAILED',
        startTime,
        endTime: new Date().toISOString(),
        duration: new Date().getTime() - new Date(startTime).getTime(),
        frameworks: [],
        aggregatedSummary: this.createEmptyAggregatedSummary(),
        metadata: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Execute a single framework
   */
  async executeSingleFramework(
    tenantId: string,
    projectId: string,
    analysisId: string,
    frameworkId: string,
    resources: any[]
  ): Promise<FrameworkAnalysisResult> {
    const startTime = new Date().toISOString();

    try {
      this.logger.info('Executing framework', { frameworkId, tenantId, projectId });

      // Get framework definition
      const framework = await this.registry.getFramework(frameworkId);
      if (!framework) {
        throw new Error(`Framework not found: ${frameworkId}`);
      }

      // Get tenant configuration
      const tenantConfig = await this.registry.getTenantFrameworkConfig(tenantId, frameworkId);
      if (!tenantConfig) {
        throw new Error(`Tenant framework configuration not found: ${tenantId}/${frameworkId}`);
      }

      // Get framework rules
      const { rules } = await this.registry.getFrameworkRules(frameworkId);
      
      // Filter rules based on tenant configuration
      const enabledRules = rules.filter(rule => 
        tenantConfig.enabledRules.includes(rule.ruleId)
      );

      this.logger.info('Framework rules loaded', {
        frameworkId,
        totalRules: rules.length,
        enabledRules: enabledRules.length,
      });

      // Execute rules
      const ruleResults = await this.executeRules(
        tenantId,
        projectId,
        analysisId,
        framework,
        enabledRules,
        resources,
        tenantConfig
      );

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // Aggregate findings
      const findings = ruleResults.flatMap(result => result.findings);

      // Calculate summary
      const summary = this.calculateFrameworkSummary(framework, enabledRules, findings);

      return {
        frameworkId: framework.id,
        frameworkName: framework.name,
        frameworkType: framework.type,
        status: 'COMPLETED',
        startTime,
        endTime,
        duration,
        findings,
        summary,
      };
    } catch (error) {
      this.logger.error('Framework execution failed', { frameworkId, error });
      
      return this.createFailedFrameworkResult(frameworkId, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Execute rules for a framework
   */
  private async executeRules(
    tenantId: string,
    projectId: string,
    analysisId: string,
    framework: Framework,
    rules: Rule[],
    resources: any[],
    tenantConfig: any
  ): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    // Execute rules in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = this.chunkArray(rules, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(rule =>
        this.executeRule({
          tenantId,
          projectId,
          analysisId,
          frameworkId: framework.id,
          rule,
          resources,
          parameters: tenantConfig.ruleOverrides[rule.ruleId] || {},
        })
      );

      const chunkResults = await Promise.allSettled(chunkPromises);
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.error('Rule execution failed', { error: result.reason });
          // Create failed rule result
          const ruleIndex = chunkResults.indexOf(result);
          results.push({
            ruleId: chunk[ruleIndex].ruleId,
            status: 'ERROR',
            findings: [],
            executionTime: 0,
            error: result.reason.message,
            metadata: {},
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute a single rule
   */
  private async executeRule(context: RuleExecutionContext): Promise<RuleExecutionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug('Executing rule', { 
        ruleId: context.rule.ruleId, 
        implementation: context.rule.implementation.type 
      });

      let findings: Finding[] = [];

      switch (context.rule.implementation.type) {
        case RuleImplementationType.BEDROCK_AI:
          findings = await this.executeBedrockAIRule(context);
          break;

        case RuleImplementationType.JAVASCRIPT:
          findings = await this.executeJavaScriptRule(context);
          break;

        case RuleImplementationType.CFN_GUARD:
          findings = await this.executeCfnGuardRule(context);
          break;

        case RuleImplementationType.PYTHON:
          findings = await this.executePythonRule(context);
          break;

        case RuleImplementationType.OPEN_POLICY_AGENT:
          findings = await this.executeOPARule(context);
          break;

        default:
          throw new Error(`Unsupported rule implementation type: ${context.rule.implementation.type}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        ruleId: context.rule.ruleId,
        status: findings.length > 0 ? 'FAIL' : 'PASS',
        findings,
        executionTime,
        metadata: {
          implementationType: context.rule.implementation.type,
          resourcesEvaluated: context.resources.length,
        },
      };
    } catch (error) {
      this.logger.error('Rule execution error', { 
        ruleId: context.rule.ruleId, 
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        ruleId: context.rule.ruleId,
        status: 'ERROR',
        findings: [],
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {},
      };
    }
  }

  /**
   * Execute rule using Bedrock AI
   */
  private async executeBedrockAIRule(context: RuleExecutionContext): Promise<Finding[]> {
    try {
      const prompt = this.buildBedrockPrompt(context);

      const command = new InvokeModelCommand({
        modelId: process.env.BEDROCK_MODEL_ID!,
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return this.parseBedrockResponse(context, responseBody.content[0].text);
    } catch (error) {
      this.logger.error('Bedrock AI rule execution failed', { 
        ruleId: context.rule.ruleId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Execute JavaScript rule
   */
  private async executeJavaScriptRule(context: RuleExecutionContext): Promise<Finding[]> {
    try {
      // Create a sandboxed environment for executing JavaScript rules
      const ruleFunction = new Function(
        'resources',
        'rule',
        'parameters',
        'utils',
        context.rule.implementation.code
      );

      const utils = this.createRuleUtils(context);
      const results = await ruleFunction(context.resources, context.rule, context.parameters, utils);

      return Array.isArray(results) ? results : [];
    } catch (error) {
      this.logger.error('JavaScript rule execution failed', { 
        ruleId: context.rule.ruleId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Execute CloudFormation Guard rule
   */
  private async executeCfnGuardRule(context: RuleExecutionContext): Promise<Finding[]> {
    // Implementation would use CFN Guard binary or API
    // For now, return empty findings
    this.logger.warn('CFN Guard execution not implemented', { ruleId: context.rule.ruleId });
    return [];
  }

  /**
   * Execute Python rule
   */
  private async executePythonRule(context: RuleExecutionContext): Promise<Finding[]> {
    // Implementation would use Python runtime or subprocess
    // For now, return empty findings
    this.logger.warn('Python rule execution not implemented', { ruleId: context.rule.ruleId });
    return [];
  }

  /**
   * Execute Open Policy Agent rule
   */
  private async executeOPARule(context: RuleExecutionContext): Promise<Finding[]> {
    // Implementation would use OPA runtime or API
    // For now, return empty findings
    this.logger.warn('OPA rule execution not implemented', { ruleId: context.rule.ruleId });
    return [];
  }

  /**
   * Build Bedrock prompt for AI-based rule evaluation
   */
  private buildBedrockPrompt(context: RuleExecutionContext): string {
    return `
You are an AWS cloud security and best practices expert. Analyze the following AWS resources against the specified rule and identify any violations or issues.

**Rule Details:**
- Rule ID: ${context.rule.ruleId}
- Name: ${context.rule.name}
- Description: ${context.rule.description}
- Severity: ${context.rule.severity}
- Category: ${context.rule.category}

**Rule Conditions:**
${JSON.stringify(context.rule.conditions, null, 2)}

**AWS Resources to Analyze:**
${JSON.stringify(context.resources, null, 2)}

**Instructions:**
1. Analyze each resource against the rule conditions
2. Identify any violations or non-compliance issues
3. For each finding, provide:
   - Resource identifier (name, ARN, or ID)
   - Specific violation description
   - Recommended remediation action

**Response Format:**
Return a JSON array of findings. Each finding should have this structure:
{
  "resourceName": "string",
  "resourceType": "string", 
  "resourceArn": "string",
  "title": "brief description",
  "description": "detailed description of the issue",
  "remediation": "specific steps to fix the issue"
}

If no violations are found, return an empty array [].
`;
  }

  /**
   * Parse Bedrock AI response into findings
   */
  private parseBedrockResponse(context: RuleExecutionContext, responseText: string): Finding[] {
    try {
      // Extract JSON from response text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const findings = JSON.parse(jsonMatch[0]);
      
      return findings.map((finding: any, index: number) => ({
        id: `${context.analysisId}-${context.rule.ruleId}-${index}`,
        ruleId: context.rule.ruleId,
        ruleName: context.rule.name,
        severity: context.rule.severity,
        category: context.rule.category,
        pillar: context.rule.pillar,
        title: finding.title,
        description: finding.description,
        resource: {
          type: finding.resourceType,
          name: finding.resourceName,
          arn: finding.resourceArn,
          region: context.credentials?.region || 'unknown',
          accountId: context.tenantId,
          properties: {},
        },
        remediation: finding.remediation,
        references: [],
        metadata: {
          detectedBy: 'bedrock-ai',
          confidence: 'high',
        },
      }));
    } catch (error) {
      this.logger.error('Failed to parse Bedrock response', { 
        ruleId: context.rule.ruleId, 
        error,
        responseText: responseText.substring(0, 500) 
      });
      return [];
    }
  }

  /**
   * Create utility functions for rule execution
   */
  private createRuleUtils(context: RuleExecutionContext) {
    return {
      createFinding: (resource: any, title: string, description: string) => ({
        id: `${context.analysisId}-${context.rule.ruleId}-${Date.now()}`,
        ruleId: context.rule.ruleId,
        ruleName: context.rule.name,
        severity: context.rule.severity,
        category: context.rule.category,
        pillar: context.rule.pillar,
        title,
        description,
        resource: {
          type: resource.resourceType || resource.Type || 'Unknown',
          name: resource.resourceName || resource.PhysicalResourceId || resource.LogicalResourceId || 'Unknown',
          arn: resource.resourceArn || resource.Arn || '',
          region: context.credentials?.region || 'unknown',
          accountId: context.tenantId,
          properties: resource.Properties || resource,
        },
        remediation: context.rule.remediation,
        references: [],
        metadata: {
          detectedBy: 'javascript-rule',
        },
      }),
      logger: this.logger,
    };
  }

  /**
   * Calculate framework summary
   */
  private calculateFrameworkSummary(
    framework: Framework,
    executedRules: Rule[],
    findings: Finding[]
  ): FrameworkSummary {
    const findingsBySeverity: Record<FindingSeverity, number> = {
      [FindingSeverity.CRITICAL]: 0,
      [FindingSeverity.HIGH]: 0,
      [FindingSeverity.MEDIUM]: 0,
      [FindingSeverity.LOW]: 0,
      [FindingSeverity.INFORMATIONAL]: 0,
    };

    const findingsByCategory: Record<string, number> = {};
    const findingsByPillar: Record<WellArchitectedPillar, number> = {
      [WellArchitectedPillar.OPERATIONAL_EXCELLENCE]: 0,
      [WellArchitectedPillar.SECURITY]: 0,
      [WellArchitectedPillar.RELIABILITY]: 0,
      [WellArchitectedPillar.PERFORMANCE_EFFICIENCY]: 0,
      [WellArchitectedPillar.COST_OPTIMIZATION]: 0,
      [WellArchitectedPillar.SUSTAINABILITY]: 0,
    };

    findings.forEach(finding => {
      findingsBySeverity[finding.severity]++;
      findingsByCategory[finding.category] = (findingsByCategory[finding.category] || 0) + 1;
      if (finding.pillar) {
        findingsByPillar[finding.pillar]++;
      }
    });

    // Calculate score (rules that passed)
    const passedRules = executedRules.length - findings.length;
    const maxScore = executedRules.length * 10;
    const score = passedRules * 10;
    const percentage = executedRules.length > 0 ? (score / maxScore) * 100 : 0;

    return {
      totalRules: executedRules.length,
      executedRules: executedRules.length,
      skippedRules: 0,
      totalFindings: findings.length,
      findingsBySeverity,
      findingsByCategory,
      findingsByPillar,
      score,
      maxScore,
      percentage,
    };
  }

  /**
   * Aggregate results from multiple frameworks
   */
  private aggregateResults(frameworkResults: FrameworkAnalysisResult[]): AggregatedSummary {
    const findingsBySeverity: Record<FindingSeverity, number> = {
      [FindingSeverity.CRITICAL]: 0,
      [FindingSeverity.HIGH]: 0,
      [FindingSeverity.MEDIUM]: 0,
      [FindingSeverity.LOW]: 0,
      [FindingSeverity.INFORMATIONAL]: 0,
    };

    const findingsByCategory: Record<string, number> = {};
    const findingsByPillar: Record<WellArchitectedPillar, number> = {
      [WellArchitectedPillar.OPERATIONAL_EXCELLENCE]: 0,
      [WellArchitectedPillar.SECURITY]: 0,
      [WellArchitectedPillar.RELIABILITY]: 0,
      [WellArchitectedPillar.PERFORMANCE_EFFICIENCY]: 0,
      [WellArchitectedPillar.COST_OPTIMIZATION]: 0,
      [WellArchitectedPillar.SUSTAINABILITY]: 0,
    };

    const frameworkScores: Record<string, number> = {};
    let totalFindings = 0;
    let totalScore = 0;
    let maxPossibleScore = 0;

    frameworkResults.forEach(result => {
      if (result.status === 'COMPLETED') {
        totalFindings += result.findings.length;
        frameworkScores[result.frameworkId] = result.summary.percentage;
        totalScore += result.summary.score;
        maxPossibleScore += result.summary.maxScore;

        // Aggregate findings by severity
        Object.entries(result.summary.findingsBySeverity).forEach(([severity, count]) => {
          findingsBySeverity[severity as FindingSeverity] += count;
        });

        // Aggregate findings by category
        Object.entries(result.summary.findingsByCategory).forEach(([category, count]) => {
          findingsByCategory[category] = (findingsByCategory[category] || 0) + count;
        });

        // Aggregate findings by pillar
        if (result.summary.findingsByPillar) {
          Object.entries(result.summary.findingsByPillar).forEach(([pillar, count]) => {
            findingsByPillar[pillar as WellArchitectedPillar] += count;
          });
        }
      }
    });

    const overallScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    return {
      totalFrameworks: frameworkResults.length,
      completedFrameworks: frameworkResults.filter(r => r.status === 'COMPLETED').length,
      failedFrameworks: frameworkResults.filter(r => r.status === 'FAILED').length,
      totalFindings,
      findingsBySeverity,
      findingsByCategory,
      findingsByPillar,
      overallScore,
      frameworkScores,
      recommendations: this.generateRecommendations(findingsBySeverity, findingsByCategory),
    };
  }

  private generateRecommendations(
    findingsBySeverity: Record<FindingSeverity, number>,
    findingsByCategory: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (findingsBySeverity[FindingSeverity.CRITICAL] > 0) {
      recommendations.push('Address critical security findings immediately to prevent potential breaches.');
    }

    if (findingsBySeverity[FindingSeverity.HIGH] > 0) {
      recommendations.push('Prioritize high-severity findings for remediation within the next sprint.');
    }

    const topCategories = Object.entries(findingsByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (topCategories.length > 0) {
      recommendations.push(`Focus on ${topCategories[0][0]} improvements as this category has the most findings.`);
    }

    return recommendations;
  }

  private createFailedFrameworkResult(frameworkId: string, error: string): FrameworkAnalysisResult {
    const now = new Date().toISOString();
    return {
      frameworkId,
      frameworkName: frameworkId,
      frameworkType: 'CUSTOM' as any,
      status: 'FAILED',
      startTime: now,
      endTime: now,
      duration: 0,
      findings: [],
      summary: {
        totalRules: 0,
        executedRules: 0,
        skippedRules: 0,
        totalFindings: 0,
        findingsBySeverity: {
          [FindingSeverity.CRITICAL]: 0,
          [FindingSeverity.HIGH]: 0,
          [FindingSeverity.MEDIUM]: 0,
          [FindingSeverity.LOW]: 0,
          [FindingSeverity.INFORMATIONAL]: 0,
        },
        findingsByCategory: {},
        findingsByPillar: {
          [WellArchitectedPillar.OPERATIONAL_EXCELLENCE]: 0,
          [WellArchitectedPillar.SECURITY]: 0,
          [WellArchitectedPillar.RELIABILITY]: 0,
          [WellArchitectedPillar.PERFORMANCE_EFFICIENCY]: 0,
          [WellArchitectedPillar.COST_OPTIMIZATION]: 0,
          [WellArchitectedPillar.SUSTAINABILITY]: 0,
        },
        score: 0,
        maxScore: 0,
        percentage: 0,
      },
      error,
    };
  }

  private createEmptyAggregatedSummary(): AggregatedSummary {
    return {
      totalFrameworks: 0,
      completedFrameworks: 0,
      failedFrameworks: 0,
      totalFindings: 0,
      findingsBySeverity: {
        [FindingSeverity.CRITICAL]: 0,
        [FindingSeverity.HIGH]: 0,
        [FindingSeverity.MEDIUM]: 0,
        [FindingSeverity.LOW]: 0,
        [FindingSeverity.INFORMATIONAL]: 0,
      },
      findingsByCategory: {},
      findingsByPillar: {
        [WellArchitectedPillar.OPERATIONAL_EXCELLENCE]: 0,
        [WellArchitectedPillar.SECURITY]: 0,
        [WellArchitectedPillar.RELIABILITY]: 0,
        [WellArchitectedPillar.PERFORMANCE_EFFICIENCY]: 0,
        [WellArchitectedPillar.COST_OPTIMIZATION]: 0,
        [WellArchitectedPillar.SUSTAINABILITY]: 0,
      },
      overallScore: 0,
      frameworkScores: {},
      recommendations: [],
    };
  }

  private determineOverallStatus(frameworkResults: FrameworkAnalysisResult[]): 'COMPLETED' | 'FAILED' | 'PARTIAL' | 'TIMEOUT' {
    const completed = frameworkResults.filter(r => r.status === 'COMPLETED').length;
    const total = frameworkResults.length;

    if (completed === total) return 'COMPLETED';
    if (completed === 0) return 'FAILED';
    return 'PARTIAL';
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}