import { defineFunction } from '@aws-amplify/backend';

/**
 * Infrastructure Analysis Lambda Function
 * 
 * This function handles infrastructure analysis for the Cloud Best Practice Analyzer.
 * It performs:
 * - CloudFormation template analysis
 * - Terraform configuration analysis
 * - CDK code analysis
 * - Live AWS account scanning
 * 
 * Features:
 * - Multi-tenant data isolation
 * - AWS Well-Architected Framework analysis
 * - Integration with Amazon Bedrock (Claude 4 Sonnet)
 * - Secure file processing with S3
 * - Real-time status updates via GraphQL subscriptions
 */
export const analyzeInfrastructure = defineFunction({
  name: 'analyze-infrastructure',
  entry: './handler.ts',
  runtime: 'nodejs20.x',
  timeout: 900, // 15 minutes for complex analyses
  memoryMB: 1024,
  environment: {
    // Tenant isolation
    TENANT_TABLE_NAME: process.env.TENANT_TABLE_NAME || '',
    PROJECT_TABLE_NAME: process.env.PROJECT_TABLE_NAME || '',
    ANALYSIS_TABLE_NAME: process.env.ANALYSIS_TABLE_NAME || '',
    FINDING_TABLE_NAME: process.env.FINDING_TABLE_NAME || '',
    
    // Storage
    INFRASTRUCTURE_BUCKET: process.env.INFRASTRUCTURE_BUCKET || '',
    RESULTS_BUCKET: process.env.RESULTS_BUCKET || '',
    
    // AI Services
    BEDROCK_REGION: process.env.BEDROCK_REGION || 'us-east-1',
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    
    // API Configuration
    GRAPHQL_API_ENDPOINT: process.env.GRAPHQL_API_ENDPOINT || '',
    GRAPHQL_API_KEY: process.env.GRAPHQL_API_KEY || '',
    
    // Security
    ENCRYPTION_KEY_ARN: process.env.ENCRYPTION_KEY_ARN || '',
    
    // Monitoring
    LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
    POWERTOOLS_SERVICE_NAME: 'analyze-infrastructure',
    POWERTOOLS_METRICS_NAMESPACE: 'CloudBestPracticeAnalyzer/Analysis',
    
    // Feature flags
    ENABLE_LIVE_SCAN: process.env.ENABLE_LIVE_SCAN || 'true',
    ENABLE_PARALLEL_ANALYSIS: process.env.ENABLE_PARALLEL_ANALYSIS || 'true',
    MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB || '10',
    
    // Well-Architected Framework configuration
    WA_PILLARS: JSON.stringify([
      'OPERATIONAL_EXCELLENCE',
      'SECURITY',
      'RELIABILITY', 
      'PERFORMANCE_EFFICIENCY',
      'COST_OPTIMIZATION',
      'SUSTAINABILITY'
    ]),
    
    // Analysis limits (Basic Tier)
    MONTHLY_ANALYSIS_LIMIT: process.env.MONTHLY_ANALYSIS_LIMIT || '100',
    RETENTION_DAYS: process.env.RETENTION_DAYS || '90',
  },
  bundling: {
    minify: true,
    sourceMap: true,
    target: 'node20',
    format: 'esm',
    platform: 'node',
    externalModules: [
      '@aws-sdk/client-dynamodb',
      '@aws-sdk/client-s3',
      '@aws-sdk/client-bedrock-runtime',
      '@aws-sdk/client-cloudformation',
      '@aws-sdk/client-sts',
      '@aws-lambda-powertools/logger',
      '@aws-lambda-powertools/metrics',
      '@aws-lambda-powertools/tracer',
    ],
  },
  layers: [
    // Add shared layer for common dependencies
    process.env.SHARED_LAYER_ARN || '',
  ].filter(Boolean),
});

/**
 * Type definitions for the function arguments and return types
 */
export interface AnalyzeInfrastructureArgs {
  analysisId: string;
  projectId: string;
  tenantId: string;
  infrastructureFiles: string[];
  analysisType: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK' | 'LIVE_SCAN';
  awsConfig?: {
    region?: string;
    accountId?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken?: string;
    };
    assumeRoleArn?: string;
  };
}

export interface AnalyzeInfrastructureResult {
  success: boolean;
  analysisId: string;
  executionId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  message?: string;
  error?: string;
  resultSummary?: {
    totalResources: number;
    totalFindings: number;
    findingsBySeverity: {
      CRITICAL: number;
      HIGH: number;
      MEDIUM: number;
      LOW: number;
      INFO: number;
    };
    findingsByPillar: {
      OPERATIONAL_EXCELLENCE: number;
      SECURITY: number;
      RELIABILITY: number;
      PERFORMANCE_EFFICIENCY: number;
      COST_OPTIMIZATION: number;
      SUSTAINABILITY: number;
    };
  };
}