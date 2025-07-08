/**
 * Analysis Strategy Service
 * Unified interface for Repository and Live Scan analysis approaches
 */

import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'analysis-strategy' });

export interface AnalysisInput {
  tenantId: string;
  projectId: string;
  analysisId: string;
  strategy: 'REPOSITORY' | 'LIVE_SCAN' | 'FILE_UPLOAD';
  frameworks: string[];
  createdBy: string;
}

export interface RepositoryAnalysisInput extends AnalysisInput {
  strategy: 'REPOSITORY';
  repositoryConfig: {
    repositoryId: string;
    provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET';
    owner: string;
    repo: string;
    branch: string;
    includeSubmodules?: boolean;
    pathFilters?: string[];
  };
}

export interface LiveScanAnalysisInput extends AnalysisInput {
  strategy: 'LIVE_SCAN';
  awsConfig: {
    region: string;
    accountId: string;
    roleArn: string;
    externalId?: string;
    sessionName?: string;
  };
  scanScope: {
    services: string[];
    regions: string[];
    resourceTypes?: string[];
    tagFilters?: Record<string, string>;
  };
}

export interface FileUploadAnalysisInput extends AnalysisInput {
  strategy: 'FILE_UPLOAD';
  fileConfig: {
    s3Location: {
      bucket: string;
      key: string;
    };
    detectedTypes: string[];
    metadata?: Record<string, any>;
  };
}

export interface AnalysisStrategy {
  type: 'REPOSITORY' | 'LIVE_SCAN' | 'FILE_UPLOAD';
  validate(input: AnalysisInput): Promise<boolean>;
  prepare(input: AnalysisInput): Promise<PreparedAnalysis>;
  execute(preparedAnalysis: PreparedAnalysis): Promise<AnalysisResult>;
}

export interface PreparedAnalysis {
  analysisId: string;
  strategy: string;
  inputData: any;
  s3Location?: {
    bucket: string;
    key: string;
  };
  metadata: {
    estimatedDuration: number;
    resourceCount?: number;
    fileCount?: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface AnalysisResult {
  analysisId: string;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
  strategy: string;
  findings: any[];
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    pillarScores: Record<string, number>;
    frameworkResults: Record<string, any>;
  };
  metadata: {
    executionTime: number;
    resourcesAnalyzed: number;
    filesAnalyzed?: number;
    errors?: string[];
  };
}

/**
 * Repository Analysis Strategy
 * Handles GitHub/GitLab/Bitbucket repository analysis
 */
export class RepositoryAnalysisStrategy implements AnalysisStrategy {
  type: 'REPOSITORY' = 'REPOSITORY';

  async validate(input: RepositoryAnalysisInput): Promise<boolean> {
    const { repositoryConfig } = input;
    
    // Validate repository access
    if (!repositoryConfig.repositoryId || !repositoryConfig.owner || !repositoryConfig.repo) {
      logger.error('Invalid repository configuration', { repositoryConfig });
      return false;
    }

    // Validate provider support
    if (!['GITHUB', 'GITLAB', 'BITBUCKET'].includes(repositoryConfig.provider)) {
      logger.error('Unsupported repository provider', { provider: repositoryConfig.provider });
      return false;
    }

    // Additional validations...
    return true;
  }

  async prepare(input: RepositoryAnalysisInput): Promise<PreparedAnalysis> {
    const { repositoryConfig } = input;
    
    logger.info('Preparing repository analysis', {
      analysisId: input.analysisId,
      repository: `${repositoryConfig.owner}/${repositoryConfig.repo}`,
      branch: repositoryConfig.branch,
    });

    // Fetch repository to S3
    const s3Location = await this.fetchRepositoryToS3(input);
    
    // Estimate analysis complexity
    const metadata = await this.estimateComplexity(s3Location);

    return {
      analysisId: input.analysisId,
      strategy: 'REPOSITORY',
      inputData: repositoryConfig,
      s3Location,
      metadata,
    };
  }

  async execute(preparedAnalysis: PreparedAnalysis): Promise<AnalysisResult> {
    logger.info('Executing repository analysis', {
      analysisId: preparedAnalysis.analysisId,
      s3Location: preparedAnalysis.s3Location,
    });

    // This would integrate with the existing infrastructure analyzer
    // but with AI-powered holistic analysis instead of file-type detection
    
    return {
      analysisId: preparedAnalysis.analysisId,
      status: 'COMPLETED',
      strategy: 'REPOSITORY',
      findings: [], // Would be populated by AI analysis
      summary: {
        totalFindings: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0,
        pillarScores: {},
        frameworkResults: {},
      },
      metadata: {
        executionTime: 0,
        resourcesAnalyzed: 0,
        filesAnalyzed: 0,
      },
    };
  }

  private async fetchRepositoryToS3(input: RepositoryAnalysisInput): Promise<{ bucket: string; key: string }> {
    // This would call the GitHub integration Lambda
    // Return S3 location where repository is stored
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const s3Key = `repositories/${input.tenantId}/${input.repositoryConfig.owner}/${input.repositoryConfig.repo}/${input.repositoryConfig.branch}/${timestamp}.zip`;
    
    return {
      bucket: process.env.S3_BUCKET_NAME!,
      key: s3Key,
    };
  }

  private async estimateComplexity(s3Location: { bucket: string; key: string }): Promise<any> {
    // Analyze repository size and structure to estimate complexity
    return {
      estimatedDuration: 300, // 5 minutes
      complexity: 'MEDIUM' as const,
    };
  }
}

/**
 * Live Scan Analysis Strategy
 * Handles AWS account live scanning
 */
export class LiveScanAnalysisStrategy implements AnalysisStrategy {
  type: 'LIVE_SCAN' = 'LIVE_SCAN';

  async validate(input: LiveScanAnalysisInput): Promise<boolean> {
    const { awsConfig, scanScope } = input;
    
    // Validate AWS configuration
    if (!awsConfig.accountId || !awsConfig.roleArn || !awsConfig.region) {
      logger.error('Invalid AWS configuration', { awsConfig });
      return false;
    }

    // Validate scan scope
    if (!scanScope.services?.length || !scanScope.regions?.length) {
      logger.error('Invalid scan scope', { scanScope });
      return false;
    }

    // Test role assumption (optional pre-check)
    return true;
  }

  async prepare(input: LiveScanAnalysisInput): Promise<PreparedAnalysis> {
    const { awsConfig, scanScope } = input;
    
    logger.info('Preparing live scan analysis', {
      analysisId: input.analysisId,
      accountId: awsConfig.accountId,
      services: scanScope.services,
      regions: scanScope.regions,
    });

    // Estimate scan complexity based on services and regions
    const estimatedResourceCount = this.estimateResourceCount(scanScope);
    const complexity = this.determineComplexity(estimatedResourceCount);

    return {
      analysisId: input.analysisId,
      strategy: 'LIVE_SCAN',
      inputData: { awsConfig, scanScope },
      metadata: {
        estimatedDuration: this.estimateDuration(complexity),
        resourceCount: estimatedResourceCount,
        complexity,
      },
    };
  }

  async execute(preparedAnalysis: PreparedAnalysis): Promise<AnalysisResult> {
    logger.info('Executing live scan analysis', {
      analysisId: preparedAnalysis.analysisId,
    });

    // This would trigger the existing live scanner
    // and then process results through AI analysis
    
    return {
      analysisId: preparedAnalysis.analysisId,
      status: 'COMPLETED',
      strategy: 'LIVE_SCAN',
      findings: [], // Would be populated by scan results
      summary: {
        totalFindings: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0,
        pillarScores: {},
        frameworkResults: {},
      },
      metadata: {
        executionTime: 0,
        resourcesAnalyzed: 0,
      },
    };
  }

  private estimateResourceCount(scanScope: any): number {
    const serviceMultipliers = {
      ec2: 50,
      s3: 10,
      lambda: 30,
      rds: 5,
      iam: 100,
      cloudformation: 20,
    };

    let totalResources = 0;
    for (const service of scanScope.services) {
      const multiplier = (serviceMultipliers as any)[service.toLowerCase()] || 10;
      totalResources += multiplier * scanScope.regions.length;
    }

    return totalResources;
  }

  private determineComplexity(resourceCount: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (resourceCount < 100) return 'LOW';
    if (resourceCount < 500) return 'MEDIUM';
    return 'HIGH';
  }

  private estimateDuration(complexity: 'LOW' | 'MEDIUM' | 'HIGH'): number {
    const durations = {
      LOW: 300,    // 5 minutes
      MEDIUM: 900, // 15 minutes
      HIGH: 1800,  // 30 minutes
    };
    return durations[complexity];
  }
}

/**
 * File Upload Analysis Strategy (Enhanced for AI)
 * Handles traditional file upload with AI-powered analysis
 */
export class FileUploadAnalysisStrategy implements AnalysisStrategy {
  type: 'FILE_UPLOAD' = 'FILE_UPLOAD';

  async validate(input: FileUploadAnalysisInput): Promise<boolean> {
    const { fileConfig } = input;
    
    if (!fileConfig.s3Location?.bucket || !fileConfig.s3Location?.key) {
      logger.error('Invalid file configuration', { fileConfig });
      return false;
    }

    return true;
  }

  async prepare(input: FileUploadAnalysisInput): Promise<PreparedAnalysis> {
    const { fileConfig } = input;
    
    logger.info('Preparing file upload analysis', {
      analysisId: input.analysisId,
      s3Location: fileConfig.s3Location,
    });

    // Analyze file structure for complexity estimation
    const metadata = await this.analyzeFileStructure(fileConfig.s3Location);

    return {
      analysisId: input.analysisId,
      strategy: 'FILE_UPLOAD',
      inputData: fileConfig,
      s3Location: fileConfig.s3Location,
      metadata,
    };
  }

  async execute(preparedAnalysis: PreparedAnalysis): Promise<AnalysisResult> {
    logger.info('Executing file upload analysis', {
      analysisId: preparedAnalysis.analysisId,
      s3Location: preparedAnalysis.s3Location,
    });

    // Enhanced AI analysis - no file type detection needed
    // AI reads everything and understands context
    
    return {
      analysisId: preparedAnalysis.analysisId,
      status: 'COMPLETED',
      strategy: 'FILE_UPLOAD',
      findings: [],
      summary: {
        totalFindings: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0,
        pillarScores: {},
        frameworkResults: {},
      },
      metadata: {
        executionTime: 0,
        resourcesAnalyzed: 0,
        filesAnalyzed: 0,
      },
    };
  }

  private async analyzeFileStructure(s3Location: { bucket: string; key: string }): Promise<any> {
    // Analyze uploaded files to estimate complexity
    return {
      estimatedDuration: 180, // 3 minutes
      fileCount: 10,
      complexity: 'MEDIUM' as const,
    };
  }
}

/**
 * Analysis Strategy Factory
 * Creates appropriate strategy based on input type
 */
export class AnalysisStrategyFactory {
  static create(strategy: 'REPOSITORY' | 'LIVE_SCAN' | 'FILE_UPLOAD'): AnalysisStrategy {
    switch (strategy) {
      case 'REPOSITORY':
        return new RepositoryAnalysisStrategy();
      case 'LIVE_SCAN':
        return new LiveScanAnalysisStrategy();
      case 'FILE_UPLOAD':
        return new FileUploadAnalysisStrategy();
      default:
        throw new Error(`Unsupported analysis strategy: ${strategy}`);
    }
  }
}

/**
 * Analysis Orchestrator
 * Coordinates the analysis process across different strategies
 */
export class AnalysisOrchestrator {
  async executeAnalysis(input: AnalysisInput): Promise<AnalysisResult> {
    logger.info('Starting analysis orchestration', {
      analysisId: input.analysisId,
      strategy: input.strategy,
    });

    try {
      // Create appropriate strategy
      const strategy = AnalysisStrategyFactory.create(input.strategy);
      
      // Validate input
      const isValid = await strategy.validate(input);
      if (!isValid) {
        throw new Error(`Invalid input for ${input.strategy} analysis`);
      }

      // Prepare analysis
      const preparedAnalysis = await strategy.prepare(input);
      
      // Execute analysis
      const result = await strategy.execute(preparedAnalysis);

      logger.info('Analysis orchestration completed', {
        analysisId: input.analysisId,
        status: result.status,
        totalFindings: result.summary.totalFindings,
      });

      return result;
    } catch (error) {
      logger.error('Analysis orchestration failed', {
        analysisId: input.analysisId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        analysisId: input.analysisId,
        status: 'FAILED',
        strategy: input.strategy,
        findings: [],
        summary: {
          totalFindings: 0,
          criticalFindings: 0,
          highFindings: 0,
          mediumFindings: 0,
          lowFindings: 0,
          pillarScores: {},
          frameworkResults: {},
        },
        metadata: {
          executionTime: 0,
          resourcesAnalyzed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      };
    }
  }
}