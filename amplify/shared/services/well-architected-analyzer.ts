import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { InfrastructureData } from './infrastructure-analyzer';

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  pillar: 'OPERATIONAL_EXCELLENCE' | 'SECURITY' | 'RELIABILITY' | 'PERFORMANCE_EFFICIENCY' | 'COST_OPTIMIZATION' | 'SUSTAINABILITY';
  resource: string;
  recommendation: string;
  category?: string;
  ruleId?: string;
  line?: number;
}

export interface WellArchitectedAnalyzerConfig {
  bedrockClient: BedrockRuntimeClient;
  modelId: string;
  logger: Logger;
}

/**
 * WellArchitectedAnalyzer performs AWS Well-Architected Framework analysis using AI
 */
export class WellArchitectedAnalyzer {
  constructor(private config: WellArchitectedAnalyzerConfig) {}

  /**
   * Analyze infrastructure against Well-Architected Framework
   */
  async analyze(infraData: InfrastructureData, analysisType: string): Promise<Finding[]> {
    try {
      const findings: Finding[] = [];

      // Analyze each resource
      for (const resource of infraData.resources) {
        const resourceFindings = await this.analyzeResource(resource, analysisType);
        findings.push(...resourceFindings);
      }

      // Add architecture-level findings
      const architecturalFindings = await this.analyzeArchitecture(infraData, analysisType);
      findings.push(...architecturalFindings);

      this.config.logger.info('Well-Architected analysis completed', {
        resourceCount: infraData.resources.length,
        findingsCount: findings.length,
        analysisType,
      });

      return findings;
    } catch (error) {
      this.config.logger.error('Error in Well-Architected analysis:', { error });
      throw error;
    }
  }

  private async analyzeResource(resource: any, analysisType: string): Promise<Finding[]> {
    const prompt = this.createResourceAnalysisPrompt(resource, analysisType);
    
    try {
      const response = await this.invokeBedrockModel(prompt);
      return this.parseAIResponse(resource.name, response);
    } catch (error) {
      this.config.logger.error('Error analyzing resource:', { resource: resource.name, error });
      return [];
    }
  }

  private async analyzeArchitecture(infraData: InfrastructureData, analysisType: string): Promise<Finding[]> {
    const prompt = this.createArchitectureAnalysisPrompt(infraData, analysisType);
    
    try {
      const response = await this.invokeBedrockModel(prompt);
      return this.parseAIResponse('Architecture', response);
    } catch (error) {
      this.config.logger.error('Error analyzing architecture:', { error });
      return [];
    }
  }

  private createResourceAnalysisPrompt(resource: any, analysisType: string): string {
    return `
Analyze the following ${analysisType} resource against the AWS Well-Architected Framework:

Resource Type: ${resource.type}
Resource Name: ${resource.name}
Properties: ${JSON.stringify(resource.properties, null, 2)}

Please evaluate this resource across all six pillars of the AWS Well-Architected Framework:
1. Operational Excellence
2. Security
3. Reliability
4. Performance Efficiency
5. Cost Optimization
6. Sustainability

For each finding, provide:
- A clear title and description
- Severity level (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- Which pillar it relates to
- Specific recommendations for improvement
- Rule ID if applicable

Format the response as JSON with the following structure:
{
  "findings": [
    {
      "title": "Finding title",
      "description": "Detailed description",
      "severity": "SEVERITY_LEVEL",
      "pillar": "PILLAR_NAME",
      "recommendation": "Specific recommendation",
      "category": "Category name",
      "ruleId": "RULE_ID"
    }
  ]
}
`;
  }

  private createArchitectureAnalysisPrompt(infraData: InfrastructureData, analysisType: string): string {
    const resourceSummary = infraData.resources.map(r => ({
      type: r.type,
      name: r.name,
    }));

    return `
Analyze the overall architecture of this ${analysisType} infrastructure against the AWS Well-Architected Framework:

Infrastructure Summary:
- Total Resources: ${infraData.resources.length}
- Resource Types: ${JSON.stringify(resourceSummary, null, 2)}

Please evaluate the overall architecture across all six pillars:
1. Operational Excellence
2. Security  
3. Reliability
4. Performance Efficiency
5. Cost Optimization
6. Sustainability

Focus on:
- Missing critical components (monitoring, backup, security)
- Architecture patterns and anti-patterns
- Cross-service configurations
- High-level design issues

Format the response as JSON with the same structure as resource analysis.
`;
  }

  private async invokeBedrockModel(prompt: string): Promise<string> {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 8000, // Increased for Claude 4 Sonnet's enhanced capabilities
      messages: [
        {
          role: "user",
          content: `${prompt}

IMPORTANT: You are Claude 4 Sonnet, the most advanced AWS Well-Architected Framework analysis AI. 
Provide comprehensive, detailed analysis with specific AWS service recommendations and implementation guidance.
Focus on actionable insights and real-world best practices.`,
        },
      ],
      temperature: 0.1,
      top_p: 0.9,
    };

    const command = new InvokeModelCommand({
      modelId: this.config.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await this.config.bedrockClient.send(command);
    
    if (!response.body) {
      throw new Error('Empty response from Bedrock');
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  }

  private parseAIResponse(resourceName: string, aiResponse: string): Finding[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.config.logger.warn('No JSON found in AI response', { aiResponse });
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.findings || !Array.isArray(parsed.findings)) {
        this.config.logger.warn('Invalid findings format in AI response', { parsed });
        return [];
      }

      return parsed.findings.map((finding: any, index: number) => ({
        id: `${resourceName}-${Date.now()}-${index}`,
        title: finding.title || 'Untitled Finding',
        description: finding.description || 'No description provided',
        severity: this.validateSeverity(finding.severity),
        pillar: this.validatePillar(finding.pillar),
        resource: resourceName,
        recommendation: finding.recommendation || 'No recommendation provided',
        category: finding.category,
        ruleId: finding.ruleId,
      }));
    } catch (error) {
      this.config.logger.error('Error parsing AI response:', { error, aiResponse });
      return [];
    }
  }

  private validateSeverity(severity: string): Finding['severity'] {
    const validSeverities: Finding['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    return validSeverities.includes(severity as Finding['severity']) 
      ? (severity as Finding['severity']) 
      : 'MEDIUM';
  }

  private validatePillar(pillar: string): Finding['pillar'] {
    const validPillars: Finding['pillar'][] = [
      'OPERATIONAL_EXCELLENCE',
      'SECURITY',
      'RELIABILITY',
      'PERFORMANCE_EFFICIENCY',
      'COST_OPTIMIZATION',
      'SUSTAINABILITY',
    ];
    return validPillars.includes(pillar as Finding['pillar']) 
      ? (pillar as Finding['pillar']) 
      : 'OPERATIONAL_EXCELLENCE';
  }
}