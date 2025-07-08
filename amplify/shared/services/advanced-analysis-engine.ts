import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { InfrastructureData } from './infrastructure-analyzer';
import type { Finding } from './well-architected-analyzer';

export type AnalysisFramework = 
  | 'WELL_ARCHITECTED' 
  | 'WELL_ARCHITECTED_SERVERLESS'
  | 'WELL_ARCHITECTED_SAAS'
  | 'WELL_ARCHITECTED_IOT'
  | 'WELL_ARCHITECTED_ML'
  | 'AWS_SDP'
  | 'AWS_SECURITY_HUB'
  | 'AWS_COMPETENCY';

export interface AdvancedAnalysisConfig {
  bedrockClient: BedrockRuntimeClient;
  modelId: string;
  logger: Logger;
  frameworks: AnalysisFramework[];
}

export interface FrameworkSpecificFinding extends Finding {
  framework: AnalysisFramework;
  lensName?: string;
  competencyArea?: string;
  securityStandardId?: string;
  benchmarkScore?: number;
}

/**
 * Advanced Analysis Engine with Multi-Framework Support
 * 
 * Supports:
 * - AWS Well-Architected Framework (6 pillars)
 * - AWS Well-Architected Lenses (Serverless, SaaS, IoT, ML)
 * - AWS Service Delivery Program (SDP) Best Practices
 * - AWS Security Hub CSPM Standards
 * - AWS Competency Requirements
 */
export class AdvancedAnalysisEngine {
  constructor(private config: AdvancedAnalysisConfig) {}

  /**
   * Perform comprehensive multi-framework analysis
   */
  async analyzeInfrastructure(
    infraData: InfrastructureData, 
    analysisType: string
  ): Promise<FrameworkSpecificFinding[]> {
    const allFindings: FrameworkSpecificFinding[] = [];

    this.config.logger.info('Starting advanced multi-framework analysis', {
      frameworks: this.config.frameworks,
      resourceCount: infraData.resources.length,
    });

    for (const framework of this.config.frameworks) {
      try {
        const findings = await this.analyzeWithFramework(infraData, analysisType, framework);
        allFindings.push(...findings);
        
        this.config.logger.info(`Completed ${framework} analysis`, {
          framework,
          findingsCount: findings.length,
        });
      } catch (error) {
        this.config.logger.error(`Error in ${framework} analysis`, { framework, error });
      }
    }

    // Cross-framework correlation and deduplication
    const correlatedFindings = await this.correlateFindings(allFindings);

    this.config.logger.info('Advanced analysis completed', {
      totalFindings: allFindings.length,
      correlatedFindings: correlatedFindings.length,
      frameworksAnalyzed: this.config.frameworks.length,
    });

    return correlatedFindings;
  }

  private async analyzeWithFramework(
    infraData: InfrastructureData,
    analysisType: string,
    framework: AnalysisFramework
  ): Promise<FrameworkSpecificFinding[]> {
    const prompt = this.createFrameworkPrompt(infraData, analysisType, framework);
    const response = await this.invokeAdvancedModel(prompt);
    return this.parseFrameworkResponse(response, framework);
  }

  private createFrameworkPrompt(
    infraData: InfrastructureData,
    analysisType: string,
    framework: AnalysisFramework
  ): string {
    const baseContext = `
Infrastructure Type: ${analysisType}
Resource Count: ${infraData.resources.length}
Resources: ${JSON.stringify(infraData.resources.map(r => ({ type: r.type, name: r.name })), null, 2)}
`;

    const frameworkPrompts = {
      WELL_ARCHITECTED: this.getWellArchitectedPrompt(infraData),
      WELL_ARCHITECTED_SERVERLESS: this.getServerlessLensPrompt(infraData),
      WELL_ARCHITECTED_SAAS: this.getSaaSLensPrompt(infraData),
      WELL_ARCHITECTED_IOT: this.getIoTLensPrompt(infraData),
      WELL_ARCHITECTED_ML: this.getMLLensPrompt(infraData),
      AWS_SDP: this.getSDPPrompt(infraData),
      AWS_SECURITY_HUB: this.getSecurityHubPrompt(infraData),
      AWS_COMPETENCY: this.getCompetencyPrompt(infraData),
    };

    return `${baseContext}\n\n${frameworkPrompts[framework]}`;
  }

  private getWellArchitectedPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Well-Architected Framework (Core 6 Pillars)

Analyze this infrastructure against the AWS Well-Architected Framework's 6 pillars:

1. OPERATIONAL_EXCELLENCE: Design principles for supporting development and running workloads effectively
2. SECURITY: Design principles for protecting information, systems, and assets
3. RELIABILITY: Design principles for ensuring workload performs its intended function consistently
4. PERFORMANCE_EFFICIENCY: Design principles for using computing resources efficiently
5. COST_OPTIMIZATION: Design principles for avoiding unnecessary costs
6. SUSTAINABILITY: Design principles for minimizing environmental impacts

For each finding, evaluate:
- Automation capabilities
- Monitoring and observability
- Security controls and compliance
- Fault tolerance and recovery
- Resource optimization
- Environmental impact

Provide specific AWS service recommendations and implementation guidance.
Focus on actionable architectural improvements.
`;
  }

  private getServerlessLensPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Well-Architected Serverless Lens

Analyze this infrastructure specifically for serverless best practices:

Key Areas:
- Function design and lifecycle management
- API design and implementation
- Database design for serverless
- Processing design patterns
- Monitoring and troubleshooting

Serverless Services to Evaluate:
- AWS Lambda functions and configurations
- API Gateway designs
- DynamoDB table structures
- Step Functions workflows
- EventBridge/SNS/SQS messaging
- S3 event-driven architectures

Focus on:
- Cold start optimization
- Concurrency management
- Event-driven design patterns
- Cost optimization for serverless
- Security in serverless environments
`;
  }

  private getSaaSLensPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Well-Architected SaaS Lens

Analyze this infrastructure for multi-tenant SaaS applications:

Key Areas:
- Tenant isolation strategies (Pool, Bridge, Silo models)
- Identity and access management
- Data partitioning and isolation
- Billing and metering
- Deployment and management automation

SaaS-Specific Evaluations:
- Tenant data isolation mechanisms
- Resource sharing efficiency
- Tenant-aware monitoring and analytics
- Cost attribution and optimization
- Scaling strategies per tenant tier

Focus on:
- Data isolation and security
- Per-tenant customization capabilities
- Operational efficiency
- Cost allocation accuracy
- Compliance and governance
`;
  }

  private getIoTLensPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Well-Architected IoT Lens

Analyze this infrastructure for IoT workload best practices:

Key Areas:
- Device connectivity and communication
- Device and fleet management
- Data processing and analytics
- Security at scale
- Device lifecycle management

IoT Services to Evaluate:
- AWS IoT Core connectivity
- IoT Device Management
- IoT Analytics and processing
- IoT Greengrass edge computing
- Security certificates and policies

Focus on:
- Device authentication and authorization
- Data ingestion and processing at scale
- Edge computing optimization
- Firmware update strategies
- Monitoring and alerting for devices
`;
  }

  private getMLLensPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Well-Architected Machine Learning Lens

Analyze this infrastructure for ML workload best practices:

Key Areas:
- ML development lifecycle
- Data engineering and preparation
- Model training and validation
- Model deployment and inference
- ML pipeline automation

ML Services to Evaluate:
- Amazon SageMaker components
- ML data storage and processing
- Model training infrastructure
- Inference endpoints and scaling
- MLOps pipeline automation

Focus on:
- Data quality and lineage
- Model training efficiency
- Inference performance and cost
- ML pipeline automation
- Model monitoring and drift detection
`;
  }

  private getSDPPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Service Delivery Program (SDP) Best Practices

Analyze this infrastructure against AWS SDP delivery standards:

Key Areas:
- Solution architecture patterns
- Implementation best practices
- Operational excellence standards
- Customer success metrics
- Quality assurance criteria

SDP Standards:
- Architecture documentation quality
- Code quality and testing coverage
- Deployment automation
- Monitoring and alerting
- Support and maintenance procedures

Focus on:
- Production-ready architecture
- Scalability and resilience
- Security implementation
- Cost optimization strategies
- Operational procedures
`;
  }

  private getSecurityHubPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Security Hub CSPM (Cloud Security Posture Management)

Analyze this infrastructure for security compliance:

Security Standards:
- AWS Config Rules
- CIS AWS Foundations Benchmark
- Payment Card Industry Data Security Standard (PCI DSS)
- AWS Security Best Practices

Key Security Areas:
- Identity and Access Management (IAM)
- Data protection and encryption
- Infrastructure protection
- Detective controls
- Incident response preparation

Focus on:
- Security misconfigurations
- Compliance violations
- Vulnerability assessments
- Access control weaknesses
- Data exposure risks
`;
  }

  private getCompetencyPrompt(infraData: InfrastructureData): string {
    return `
ANALYSIS FRAMEWORK: AWS Competency Requirements Analysis

Analyze this infrastructure against AWS Partner Competency standards:

Competency Areas:
- Solution Architecture
- DevOps and Development
- Data & Analytics
- Machine Learning
- Security
- Migration

Key Evaluation Criteria:
- Technical depth and breadth
- Solution complexity handling
- Best practices implementation
- Innovation and optimization
- Customer success enablement

Focus on:
- Architectural sophistication
- Implementation quality
- Operational maturity
- Security posture
- Performance optimization
`;
  }

  private async invokeAdvancedModel(prompt: string): Promise<string> {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 12000, // Increased for comprehensive analysis
      messages: [
        {
          role: "user",
          content: `${prompt}

IMPORTANT: You are Claude 4 Sonnet, the most advanced AWS cloud architecture analysis AI.
You have expert knowledge of:
- AWS Well-Architected Framework and all specialized lenses
- AWS Service Delivery Program standards
- AWS Security Hub compliance standards
- AWS Partner Competency requirements

Provide extremely detailed, actionable analysis with:
- Specific AWS service recommendations
- Exact configuration improvements
- Implementation code snippets where applicable
- Cost impact estimates
- Priority ranking for recommendations

Return findings as JSON with this structure:
{
  "findings": [
    {
      "title": "Specific finding title",
      "description": "Detailed technical description",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "pillar": "APPLICABLE_PILLAR",
      "recommendation": "Specific implementation steps",
      "implementation": "Code/configuration examples",
      "costImpact": "LOW|MEDIUM|HIGH",
      "priority": 1-10,
      "category": "Category name",
      "ruleId": "FRAMEWORK_RULE_ID",
      "benchmarkScore": 0-100
    }
  ]
}`,
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

  private parseFrameworkResponse(aiResponse: string, framework: AnalysisFramework): FrameworkSpecificFinding[] {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.config.logger.warn('No JSON found in AI response', { framework, aiResponse });
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.findings || !Array.isArray(parsed.findings)) {
        this.config.logger.warn('Invalid findings format in AI response', { framework, parsed });
        return [];
      }

      return parsed.findings.map((finding: any, index: number): FrameworkSpecificFinding => ({
        id: `${framework}-${Date.now()}-${index}`,
        title: finding.title || 'Untitled Finding',
        description: finding.description || 'No description provided',
        severity: this.validateSeverity(finding.severity),
        pillar: this.validatePillar(finding.pillar),
        resource: finding.resource || 'Architecture',
        recommendation: finding.recommendation || 'No recommendation provided',
        category: finding.category,
        ruleId: finding.ruleId,
        framework,
        benchmarkScore: finding.benchmarkScore,
      }));
    } catch (error) {
      this.config.logger.error('Error parsing framework response:', { framework, error, aiResponse });
      return [];
    }
  }

  private async correlateFindings(findings: FrameworkSpecificFinding[]): Promise<FrameworkSpecificFinding[]> {
    // Group similar findings from different frameworks
    const groups = new Map<string, FrameworkSpecificFinding[]>();
    
    for (const finding of findings) {
      const key = `${finding.resource}-${finding.severity}-${finding.pillar}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(finding);
    }

    // Merge related findings and eliminate duplicates
    const correlatedFindings: FrameworkSpecificFinding[] = [];
    
    for (const [key, groupFindings] of groups) {
      if (groupFindings.length === 1) {
        correlatedFindings.push(groupFindings[0]);
      } else {
        // Merge multiple framework findings into a comprehensive finding
        const primary = groupFindings[0];
        const frameworks = groupFindings.map(f => f.framework);
        
        correlatedFindings.push({
          ...primary,
          framework: 'WELL_ARCHITECTED', // Use primary framework
          description: `${primary.description}\n\nAlso identified by: ${frameworks.slice(1).join(', ')}`,
          recommendation: groupFindings.map(f => f.recommendation).join('\n\n'),
        });
      }
    }

    return correlatedFindings;
  }

  private validateSeverity(severity: string): FrameworkSpecificFinding['severity'] {
    const validSeverities: FrameworkSpecificFinding['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    return validSeverities.includes(severity as FrameworkSpecificFinding['severity']) 
      ? (severity as FrameworkSpecificFinding['severity']) 
      : 'MEDIUM';
  }

  private validatePillar(pillar: string): FrameworkSpecificFinding['pillar'] {
    const validPillars: FrameworkSpecificFinding['pillar'][] = [
      'OPERATIONAL_EXCELLENCE',
      'SECURITY',
      'RELIABILITY',
      'PERFORMANCE_EFFICIENCY',
      'COST_OPTIMIZATION',
      'SUSTAINABILITY',
    ];
    return validPillars.includes(pillar as FrameworkSpecificFinding['pillar']) 
      ? (pillar as FrameworkSpecificFinding['pillar']) 
      : 'OPERATIONAL_EXCELLENCE';
  }
}