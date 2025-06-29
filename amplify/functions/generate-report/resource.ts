import { defineFunction } from '@aws-amplify/backend';

/**
 * Report Generation Lambda Function
 * 
 * This function handles report generation for the Cloud Best Practice Analyzer.
 * It generates:
 * - Analysis summary reports
 * - Detailed findings reports
 * - Executive summary reports
 * - Compliance reports
 * 
 * Features:
 * - Multi-tenant data isolation
 * - Multiple output formats (PDF, Excel, JSON, HTML)
 * - Template-based report generation
 * - S3 storage with secure access
 * - Real-time status updates via GraphQL subscriptions
 */
export const generateReport = defineFunction({
  name: 'generate-report',
  entry: './handler.ts',
  runtime: 'nodejs20.x',
  timeout: 600, // 10 minutes for report generation
  memoryMB: 2048, // Higher memory for PDF/Excel generation
  environment: {
    // Tenant isolation
    TENANT_TABLE_NAME: process.env.TENANT_TABLE_NAME || '',
    PROJECT_TABLE_NAME: process.env.PROJECT_TABLE_NAME || '',
    ANALYSIS_TABLE_NAME: process.env.ANALYSIS_TABLE_NAME || '',
    FINDING_TABLE_NAME: process.env.FINDING_TABLE_NAME || '',
    REPORT_TABLE_NAME: process.env.REPORT_TABLE_NAME || '',
    
    // Storage
    REPORTS_BUCKET: process.env.REPORTS_BUCKET || '',
    TEMPLATES_BUCKET: process.env.TEMPLATES_BUCKET || '',
    
    // Report templates
    TEMPLATE_PREFIX: process.env.TEMPLATE_PREFIX || 'templates/',
    ANALYSIS_SUMMARY_TEMPLATE: process.env.ANALYSIS_SUMMARY_TEMPLATE || 'analysis-summary.html',
    DETAILED_FINDINGS_TEMPLATE: process.env.DETAILED_FINDINGS_TEMPLATE || 'detailed-findings.html',
    EXECUTIVE_SUMMARY_TEMPLATE: process.env.EXECUTIVE_SUMMARY_TEMPLATE || 'executive-summary.html',
    COMPLIANCE_REPORT_TEMPLATE: process.env.COMPLIANCE_REPORT_TEMPLATE || 'compliance-report.html',
    
    // API Configuration
    GRAPHQL_API_ENDPOINT: process.env.GRAPHQL_API_ENDPOINT || '',
    GRAPHQL_API_KEY: process.env.GRAPHQL_API_KEY || '',
    
    // Security
    ENCRYPTION_KEY_ARN: process.env.ENCRYPTION_KEY_ARN || '',
    SIGNED_URL_EXPIRATION: process.env.SIGNED_URL_EXPIRATION || '3600', // 1 hour
    
    // Monitoring
    LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
    POWERTOOLS_SERVICE_NAME: 'generate-report',
    POWERTOOLS_METRICS_NAMESPACE: 'CloudBestPracticeAnalyzer/Reports',
    
    // Feature flags
    ENABLE_PDF_GENERATION: process.env.ENABLE_PDF_GENERATION || 'true',
    ENABLE_EXCEL_GENERATION: process.env.ENABLE_EXCEL_GENERATION || 'true',
    ENABLE_CHARTS: process.env.ENABLE_CHARTS || 'true',
    ENABLE_WATERMARKS: process.env.ENABLE_WATERMARKS || 'true',
    
    // Report configuration
    MAX_FINDINGS_PER_REPORT: process.env.MAX_FINDINGS_PER_REPORT || '1000',
    CHART_WIDTH: process.env.CHART_WIDTH || '800',
    CHART_HEIGHT: process.env.CHART_HEIGHT || '400',
    
    // AI Services for report enhancement
    BEDROCK_REGION: process.env.BEDROCK_REGION || 'us-east-1',
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    ENABLE_AI_INSIGHTS: process.env.ENABLE_AI_INSIGHTS || 'true',
    
    // Retention (Basic Tier)
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
      '@aws-lambda-powertools/logger',
      '@aws-lambda-powertools/metrics',
      '@aws-lambda-powertools/tracer',
      'puppeteer-core',
      'exceljs',
      'handlebars',
      'chartjs-node-canvas',
    ],
  },
  layers: [
    // Add shared layer for common dependencies
    process.env.SHARED_LAYER_ARN || '',
    // Add layer with headless Chrome for PDF generation
    process.env.PUPPETEER_LAYER_ARN || '',
  ].filter(Boolean),
});

/**
 * Type definitions for the function arguments and return types
 */
export interface GenerateReportArgs {
  analysisId: string;
  projectId: string;
  tenantId: string;
  reportType: 'ANALYSIS_SUMMARY' | 'DETAILED_FINDINGS' | 'EXECUTIVE_SUMMARY' | 'COMPLIANCE_REPORT';
  format: 'PDF' | 'EXCEL' | 'JSON' | 'HTML';
  name: string;
  includeCharts?: boolean;
  includeRecommendations?: boolean;
  severityFilter?: ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO')[];
  pillarFilter?: (
    'OPERATIONAL_EXCELLENCE' |
    'SECURITY' |
    'RELIABILITY' |
    'PERFORMANCE_EFFICIENCY' |
    'COST_OPTIMIZATION' |
    'SUSTAINABILITY'
  )[];
  customTemplate?: string;
  branding?: {
    logo?: string;
    companyName?: string;
    colors?: {
      primary?: string;
      secondary?: string;
    };
  };
}

export interface GenerateReportResult {
  success: boolean;
  reportId: string;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  message?: string;
  error?: string;
  s3Location?: {
    bucket: string;
    key: string;
    region: string;
    signedUrl?: string;
    expiresAt?: string;
  };
  metadata?: {
    fileSize: number;
    format: string;
    generatedAt: string;
    pagesCount?: number;
    findingsCount: number;
    reportType: string;
  };
}

/**
 * Report template data structure
 */
export interface ReportTemplateData {
  // Report metadata
  reportInfo: {
    title: string;
    type: string;
    format: string;
    generatedAt: string;
    generatedBy: string;
    version: string;
  };
  
  // Tenant and project info
  tenant: {
    id: string;
    name: string;
  };
  
  project: {
    id: string;
    name: string;
    description?: string;
  };
  
  // Analysis data
  analysis: {
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    duration?: number;
  };
  
  // Summary statistics
  summary: {
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
    complianceScore?: number;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  
  // Detailed findings
  findings: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    pillar: string;
    resource: string;
    recommendation: string;
    category?: string;
    ruleId?: string;
    line?: number;
  }>;
  
  // Charts and visualizations data
  charts?: {
    severityDistribution: Array<{ label: string; value: number; color: string }>;
    pillarDistribution: Array<{ label: string; value: number; color: string }>;
    trends?: Array<{ date: string; value: number }>;
  };
  
  // Branding
  branding?: {
    logo?: string;
    companyName?: string;
    colors?: {
      primary: string;
      secondary: string;
    };
  };
}