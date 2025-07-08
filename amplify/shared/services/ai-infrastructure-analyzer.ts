/**
 * AI-Powered Infrastructure Analyzer
 * Uses Amazon Bedrock Claude 4 to understand and analyze any infrastructure code
 * No file type detection needed - AI understands context holistically
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import AdmZip from 'adm-zip';
import { Readable } from 'stream';

const logger = new Logger({ serviceName: 'ai-infrastructure-analyzer' });
const tracer = new Tracer({ serviceName: 'ai-infrastructure-analyzer' });
const metrics = new Metrics({ serviceName: 'ai-infrastructure-analyzer' });

const bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });
const s3Client = new S3Client({});

export interface AnalysisInput {
  tenantId: string;
  projectId: string;
  analysisId: string;
  s3Location: {
    bucket: string;
    key: string;
  };
  frameworks: string[];
  strategy: 'REPOSITORY' | 'LIVE_SCAN' | 'FILE_UPLOAD';
  metadata?: {
    repositoryInfo?: {
      owner: string;
      repo: string;
      branch: string;
    };
    awsAccount?: {
      accountId: string;
      region: string;
    };
  };
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  pillar: 'OPERATIONAL_EXCELLENCE' | 'SECURITY' | 'RELIABILITY' | 'PERFORMANCE_EFFICIENCY' | 'COST_OPTIMIZATION' | 'SUSTAINABILITY';
  category: string;
  resource?: string;
  file?: string;
  line?: number;
  recommendation: string;
  remediation: {
    description: string;
    steps: string[];
    estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
    businessImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    costImpact: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  framework: string;
  ruleId: string;
  links: {
    awsDocs?: string;
    bestPractices?: string;
    examples?: string;
  };
}

export interface AnalysisResult {
  analysisId: string;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  findings: Finding[];
  summary: {
    totalFindings: number;
    findingsBySeverity: Record<string, number>;
    findingsByPillar: Record<string, number>;
    findingsByFramework: Record<string, number>;
    pillarScores: Record<string, number>;
    overallScore: number;
    recommendations: {
      immediate: string[];
      shortTerm: string[];
      longTerm: string[];
    };
  };
  metadata: {
    analysisType: string;
    executionTime: number;
    filesAnalyzed: number;
    resourcesAnalyzed: number;
    frameworksApplied: string[];
    aiModel: string;
    timestamp: string;
  };
}

export interface InfrastructureContent {
  files: FileContent[];
  totalSize: number;
  structure: DirectoryStructure;
  detectedTechnologies: string[];
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  encoding: string;
  isText: boolean;
}

export interface DirectoryStructure {
  directories: string[];
  fileTypes: Record<string, number>;
  totalFiles: number;
  maxDepth: number;
}

export class AIInfrastructureAnalyzer {
  private readonly modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
  
  constructor() {
    logger.info('Initializing AI Infrastructure Analyzer', {
      modelId: this.modelId,
      region: process.env.BEDROCK_REGION || 'us-east-1',
    });
  }

  async analyzeInfrastructure(input: AnalysisInput): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting AI infrastructure analysis', {
        analysisId: input.analysisId,
        strategy: input.strategy,
        frameworks: input.frameworks,
      });

      // Step 1: Load and prepare content
      const content = await this.loadInfrastructureContent(input.s3Location);
      
      // Step 2: Analyze with AI
      const findings = await this.performAIAnalysis(input, content);
      
      // Step 3: Generate summary and scores
      const summary = this.generateSummary(findings);
      
      const executionTime = Date.now() - startTime;
      
      const result: AnalysisResult = {
        analysisId: input.analysisId,
        status: 'COMPLETED',
        findings,
        summary,
        metadata: {
          analysisType: input.strategy,
          executionTime,
          filesAnalyzed: content.files.length,
          resourcesAnalyzed: this.countResources(content),
          frameworksApplied: input.frameworks,
          aiModel: this.modelId,
          timestamp: new Date().toISOString(),
        },
      };

      logger.info('AI infrastructure analysis completed', {
        analysisId: input.analysisId,
        totalFindings: findings.length,
        executionTime,
        filesAnalyzed: content.files.length,
      });

      metrics.addMetric('AnalysisCompleted', 'Count', 1);
      metrics.addMetric('FindingsGenerated', 'Count', findings.length);
      metrics.addMetric('ExecutionTime', 'Milliseconds', executionTime);

      return result;
    } catch (error) {
      logger.error('AI infrastructure analysis failed', {
        analysisId: input.analysisId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      metrics.addMetric('AnalysisFailed', 'Count', 1);
      throw error;
    }
  }

  private async loadInfrastructureContent(s3Location: { bucket: string; key: string }): Promise<InfrastructureContent> {
    logger.info('Loading infrastructure content from S3', s3Location);

    try {
      // Download from S3
      const { Body } = await s3Client.send(new GetObjectCommand({
        Bucket: s3Location.bucket,
        Key: s3Location.key,
      }));

      if (!Body) {
        throw new Error('No content found in S3 object');
      }

      const buffer = await this.streamToBuffer(Body as Readable);
      
      // Extract content based on file type
      const content = await this.extractContent(buffer, s3Location.key);
      
      logger.info('Infrastructure content loaded successfully', {
        totalFiles: content.files.length,
        totalSize: content.totalSize,
        complexity: content.complexity,
        detectedTechnologies: content.detectedTechnologies,
      });

      return content;
    } catch (error) {
      logger.error('Failed to load infrastructure content', {
        s3Location,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async extractContent(buffer: Buffer, fileName: string): Promise<InfrastructureContent> {
    const files: FileContent[] = [];
    let totalSize = 0;
    const directories = new Set<string>();
    const fileTypes: Record<string, number> = {};
    let maxDepth = 0;

    if (fileName.endsWith('.zip')) {
      // Handle ZIP files
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) {
          directories.add(entry.entryName);
          continue;
        }

        // Skip binary files and large files
        if (this.shouldSkipFile(entry.entryName) || entry.header.size > 1024 * 1024) {
          continue;
        }

        const content = entry.getData().toString('utf8');
        const fileExt = this.getFileExtension(entry.entryName);
        
        files.push({
          path: entry.entryName,
          content,
          size: entry.header.size,
          encoding: 'utf8',
          isText: true,
        });

        totalSize += entry.header.size;
        fileTypes[fileExt] = (fileTypes[fileExt] || 0) + 1;
        
        const depth = entry.entryName.split('/').length - 1;
        maxDepth = Math.max(maxDepth, depth);
      }
    } else {
      // Handle single file
      const content = buffer.toString('utf8');
      const fileExt = this.getFileExtension(fileName);
      
      files.push({
        path: fileName,
        content,
        size: buffer.length,
        encoding: 'utf8',
        isText: true,
      });

      totalSize = buffer.length;
      fileTypes[fileExt] = 1;
    }

    const detectedTechnologies = this.detectTechnologies(files);
    const complexity = this.assessComplexity(files.length, totalSize, detectedTechnologies);

    return {
      files,
      totalSize,
      structure: {
        directories: Array.from(directories),
        fileTypes,
        totalFiles: files.length,
        maxDepth,
      },
      detectedTechnologies,
      complexity,
    };
  }

  private async performAIAnalysis(input: AnalysisInput, content: InfrastructureContent): Promise<Finding[]> {
    logger.info('Starting AI analysis', {
      analysisId: input.analysisId,
      filesCount: content.files.length,
      frameworks: input.frameworks,
    });

    // Prepare context for AI
    const analysisContext = this.prepareAnalysisContext(input, content);
    
    // Generate AI prompt
    const prompt = this.generateAnalysisPrompt(input, content, analysisContext);
    
    // Invoke Claude 4
    const aiResponse = await this.invokeClaude(prompt);
    
    // Parse AI response to findings
    const findings = this.parseAIResponse(aiResponse, input.analysisId);
    
    logger.info('AI analysis completed', {
      analysisId: input.analysisId,
      findingsCount: findings.length,
    });

    return findings;
  }

  private prepareAnalysisContext(input: AnalysisInput, content: InfrastructureContent): any {
    const context = {
      analysisType: input.strategy,
      frameworks: input.frameworks,
      technologies: content.detectedTechnologies,
      fileStructure: content.structure,
      complexity: content.complexity,
      tenant: input.tenantId,
      project: input.projectId,
    };

    if (input.metadata?.repositoryInfo) {
      (context as any).repository = input.metadata.repositoryInfo;
    }

    if (input.metadata?.awsAccount) {
      (context as any).awsAccount = input.metadata.awsAccount;
    }

    return context;
  }

  private generateAnalysisPrompt(input: AnalysisInput, content: InfrastructureContent, context: any): string {
    const fileContents = content.files.map(file => 
      `=== FILE: ${file.path} ===\n${file.content}\n`
    ).join('\n\n');

    return `
You are an expert AWS infrastructure analyst specializing in Well-Architected Framework assessment. 
Analyze the provided infrastructure code and generate comprehensive findings.

## Analysis Context
- Analysis ID: ${input.analysisId}
- Strategy: ${input.strategy}
- Frameworks: ${input.frameworks.join(', ')}
- Technologies Detected: ${content.detectedTechnologies.join(', ')}
- Total Files: ${content.files.length}
- Complexity: ${content.complexity}

## Analysis Requirements
1. Analyze ALL provided files holistically - understand the complete infrastructure architecture
2. Do NOT rely on file extensions - understand content based on actual syntax and patterns
3. Identify mixed IaC patterns (CloudFormation + Terraform + CDK in same project)
4. Apply ALL specified frameworks: ${input.frameworks.join(', ')}
5. Generate findings for each applicable pillar: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability

## Infrastructure Files
${fileContents}

## Output Format
Return a JSON array of findings with this exact structure:
[
  {
    "title": "Clear, actionable title",
    "description": "Detailed description of the issue",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
    "pillar": "OPERATIONAL_EXCELLENCE|SECURITY|RELIABILITY|PERFORMANCE_EFFICIENCY|COST_OPTIMIZATION|SUSTAINABILITY",
    "category": "Specific category (e.g., 'Encryption', 'Monitoring', 'Backup')",
    "resource": "Resource identifier if applicable",
    "file": "File path where issue was found",
    "line": 0,
    "recommendation": "Specific recommendation to fix the issue",
    "remediation": {
      "description": "How to implement the fix",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "estimatedEffort": "LOW|MEDIUM|HIGH",
      "businessImpact": "LOW|MEDIUM|HIGH",
      "costImpact": "LOW|MEDIUM|HIGH"
    },
    "framework": "Framework that flagged this (e.g., 'Well-Architected', 'Security Hub')",
    "ruleId": "Unique rule identifier",
    "links": {
      "awsDocs": "AWS documentation URL",
      "bestPractices": "Best practices URL",
      "examples": "Example implementations URL"
    }
  }
]

Focus on:
- Security misconfigurations
- Performance bottlenecks
- Cost optimization opportunities
- Operational excellence gaps
- Reliability concerns
- Sustainability improvements
- Compliance violations

Generate comprehensive, actionable findings that help improve the infrastructure.
`;
  }

  private async invokeClaude(prompt: string): Promise<string> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 100000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        top_p: 0.9,
      }),
    });

    try {
      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return responseBody.content[0].text;
    } catch (error) {
      logger.error('Failed to invoke Claude model', {
        modelId: this.modelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private parseAIResponse(aiResponse: string, analysisId: string): Finding[] {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in AI response');
      }

      const findings = JSON.parse(jsonMatch[0]);
      
      // Add IDs and validate findings
      return findings.map((finding: any, index: number) => ({
        id: `${analysisId}-${index + 1}`,
        ...finding,
      })).filter(this.isValidFinding);
    } catch (error) {
      logger.error('Failed to parse AI response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseLength: aiResponse.length,
      });
      return [];
    }
  }

  private isValidFinding(finding: any): boolean {
    return finding.title && 
           finding.description && 
           finding.severity && 
           finding.pillar && 
           finding.recommendation;
  }

  private generateSummary(findings: Finding[]): any {
    const findingsBySeverity = findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const findingsByPillar = findings.reduce((acc, f) => {
      acc[f.pillar] = (acc[f.pillar] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const findingsByFramework = findings.reduce((acc, f) => {
      acc[f.framework] = (acc[f.framework] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate pillar scores (0-100)
    const pillarScores = this.calculatePillarScores(findings);
    const overallScore = Object.values(pillarScores).reduce((sum, score) => sum + score, 0) / Object.keys(pillarScores).length;

    // Generate recommendations
    const recommendations = this.generateRecommendations(findings);

    return {
      totalFindings: findings.length,
      findingsBySeverity,
      findingsByPillar,
      findingsByFramework,
      pillarScores,
      overallScore: Math.round(overallScore),
      recommendations,
    };
  }

  private calculatePillarScores(findings: Finding[]): Record<string, number> {
    const pillars = ['OPERATIONAL_EXCELLENCE', 'SECURITY', 'RELIABILITY', 'PERFORMANCE_EFFICIENCY', 'COST_OPTIMIZATION', 'SUSTAINABILITY'];
    const scores: Record<string, number> = {};

    for (const pillar of pillars) {
      const pillarFindings = findings.filter(f => f.pillar === pillar);
      const severityWeights = { CRITICAL: 25, HIGH: 10, MEDIUM: 5, LOW: 2, INFO: 1 };
      
      const totalDeductions = pillarFindings.reduce((sum, f) => 
        sum + (severityWeights[f.severity] || 0), 0
      );

      // Start with 100 and deduct based on findings
      scores[pillar] = Math.max(0, 100 - totalDeductions);
    }

    return scores;
  }

  private generateRecommendations(findings: Finding[]): any {
    const critical = findings.filter(f => f.severity === 'CRITICAL');
    const high = findings.filter(f => f.severity === 'HIGH');
    const medium = findings.filter(f => f.severity === 'MEDIUM');

    return {
      immediate: critical.slice(0, 3).map(f => f.recommendation),
      shortTerm: high.slice(0, 5).map(f => f.recommendation),
      longTerm: medium.slice(0, 5).map(f => f.recommendation),
    };
  }

  // Utility methods
  private shouldSkipFile(fileName: string): boolean {
    const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so'];
    const skipDirs = ['node_modules', '.git', '.svn', '__pycache__', 'venv', '.env'];
    
    return skipExtensions.some(ext => fileName.toLowerCase().endsWith(ext)) ||
           skipDirs.some(dir => fileName.includes(`/${dir}/`) || fileName.includes(`\\${dir}\\`));
  }

  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : 'no-ext';
  }

  private detectTechnologies(files: FileContent[]): string[] {
    const technologies = new Set<string>();

    for (const file of files) {
      const content = file.content.toLowerCase();
      const path = file.path.toLowerCase();

      // Infrastructure as Code
      if (content.includes('aws::') || content.includes('type: aws::')) {
        technologies.add('CloudFormation');
      }
      if (content.includes('provider "aws"') || content.includes('resource "aws_')) {
        technologies.add('Terraform');
      }
      if (content.includes('@aws-cdk') || content.includes('aws-cdk-lib')) {
        technologies.add('AWS CDK');
      }
      if (content.includes('pulumi')) {
        technologies.add('Pulumi');
      }

      // Container technologies
      if (path.includes('dockerfile') || content.includes('from ')) {
        technologies.add('Docker');
      }
      if (content.includes('apiversion:') && content.includes('kind:')) {
        technologies.add('Kubernetes');
      }

      // CI/CD
      if (path.includes('.github/workflows') || path.includes('.gitlab-ci')) {
        technologies.add('CI/CD');
      }

      // Languages
      if (path.endsWith('.py') || content.includes('import ')) {
        technologies.add('Python');
      }
      if (path.endsWith('.js') || path.endsWith('.ts')) {
        technologies.add('JavaScript/TypeScript');
      }
      if (path.endsWith('.go')) {
        technologies.add('Go');
      }
      if (path.endsWith('.java')) {
        technologies.add('Java');
      }
    }

    return Array.from(technologies);
  }

  private assessComplexity(fileCount: number, totalSize: number, technologies: string[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    let complexityScore = 0;

    // File count factor
    if (fileCount > 100) complexityScore += 3;
    else if (fileCount > 50) complexityScore += 2;
    else if (fileCount > 10) complexityScore += 1;

    // Size factor
    if (totalSize > 1024 * 1024) complexityScore += 3; // 1MB+
    else if (totalSize > 512 * 1024) complexityScore += 2; // 512KB+
    else if (totalSize > 100 * 1024) complexityScore += 1; // 100KB+

    // Technology diversity factor
    complexityScore += Math.min(technologies.length, 3);

    if (complexityScore >= 7) return 'HIGH';
    if (complexityScore >= 4) return 'MEDIUM';
    return 'LOW';
  }

  private countResources(content: InfrastructureContent): number {
    let resourceCount = 0;

    for (const file of content.files) {
      const lines = file.content.split('\n');
      
      // Count CloudFormation resources
      resourceCount += (file.content.match(/Type:\s*AWS::/g) || []).length;
      
      // Count Terraform resources
      resourceCount += (file.content.match(/resource\s+"aws_/g) || []).length;
      
      // Count CDK constructs (approximate)
      resourceCount += (file.content.match(/new\s+\w+\.\w+/g) || []).length;
    }

    return resourceCount;
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}