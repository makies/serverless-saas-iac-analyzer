/**
 * Analysis Type Definitions
 * Multi-framework analysis execution types
 */

export interface Analysis {
  id: string; // Primary Key (UUID)
  projectId: string; // GSI1 PK
  tenantId: string; // GSI2 PK
  name: string;
  description?: string;
  status: AnalysisStatus;
  type: AnalysisType;
  configuration: AnalysisConfiguration;
  execution?: AnalysisExecution;
  results?: AnalysisResult[];
  summary?: AnalysisSummary;
  metadata: AnalysisMetadata;
  createdAt: string; // ISO 8601, GSI1 SK
  updatedAt: string; // ISO 8601
  createdBy: string;
  completedAt?: string;
  error?: string;
}

export type AnalysisStatus = 
  | 'PENDING' 
  | 'RUNNING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CANCELLED'
  | 'PARTIALLY_COMPLETED';

export type AnalysisType = 
  | 'IaC_SCAN' 
  | 'LIVE_ACCOUNT_SCAN' 
  | 'HYBRID_SCAN'
  | 'COMPLIANCE_CHECK'
  | 'SECURITY_ASSESSMENT'
  | 'COST_OPTIMIZATION';

export interface AnalysisConfiguration {
  frameworks: string[]; // Framework IDs to apply
  scope: AnalysisScope;
  settings: AnalysisSettings;
  customRules?: string[]; // Custom rule IDs
  excludeRules?: string[]; // Rule IDs to exclude
}

export interface AnalysisScope {
  type: 'IaC_FILES' | 'AWS_ACCOUNT' | 'BOTH';
  // For IaC analysis
  sourceFiles?: SourceFile[];
  // For live AWS analysis
  awsAccountIds?: string[];
  regions?: string[];
  resourceTypes?: string[];
  tags?: { [key: string]: string };
}

export interface SourceFile {
  name: string;
  path: string;
  size: number;
  type: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK_TYPESCRIPT' | 'CDK_PYTHON' | 'ARM' | 'PULUMI';
  s3Location?: {
    bucket: string;
    key: string;
    version?: string;
  };
  inline?: string; // For small files
}

export interface AnalysisSettings {
  includeInactiveResources: boolean;
  includeTaggedResources?: string[];
  excludeTaggedResources?: string[];
  maxResourcesPerAnalysis: number;
  parallelAnalysisLimit: number;
  detailedReporting: boolean;
  generateRecommendations: boolean;
  autoRemediationEnabled: boolean;
  reportFormat: ('PDF' | 'EXCEL' | 'JSON' | 'CSV')[];
  notificationSettings: {
    emailOnCompletion: boolean;
    emailOnError: boolean;
    slackWebhook?: string;
    emailRecipients?: string[];
  };
}

export interface AnalysisExecution {
  stateMachineArn: string;
  executionArn: string;
  startedAt: string;
  completedAt?: string;
  progress: number; // 0-100
  currentStep?: string;
  stepDetails?: { [step: string]: any };
}

export interface AnalysisResult {
  id: string;
  analysisId: string;
  frameworkId: string;
  frameworkName: string;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  findings: AnalysisFinding[];
  summary: FrameworkAnalysisSummary;
  executionTimeMs: number;
  error?: string;
}

export interface AnalysisFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  pillarId: string;
  pillarName: string;
  resourceArn?: string; // For live AWS scans
  resourceId: string; // For IaC or simplified ID
  resourceType: string;
  resourceName?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'MANUAL_REVIEW';
  title: string;
  description: string;
  currentValue?: any;
  expectedValue?: any;
  remediation: {
    description: string;
    steps: string[];
    automationAvailable: boolean;
    estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
    references: {
      title: string;
      url: string;
      type: 'DOCUMENTATION' | 'BLOG' | 'WHITEPAPER' | 'VIDEO';
    }[];
  };
  region?: string;
  accountId?: string;
  sourceLocation?: {
    file: string;
    line?: number;
    column?: number;
  };
  tags: { [key: string]: string };
  detectedAt: string;
  costImpact?: {
    estimatedMonthlyCost?: number;
    potentialSavings?: number;
    currency: string;
  };
}

export interface FrameworkAnalysisSummary {
  frameworkId: string;
  frameworkName: string;
  totalResources: number;
  analyzedResources: number;
  totalFindings: number;
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findingsByStatus: {
    compliant: number;
    nonCompliant: number;
    notApplicable: number;
    manualReview: number;
  };
  complianceScore: number; // 0-100
  pillarScores: { [pillarId: string]: number };
  recommendationsCount: number;
  autoRemediableCount: number;
  costOptimizationPotential?: number;
}

export interface AnalysisSummary {
  totalFrameworks: number;
  completedFrameworks: number;
  totalResources: number;
  analyzedResources: number;
  totalFindings: number;
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  overallComplianceScore: number; // 0-100
  frameworkSummaries: FrameworkAnalysisSummary[];
  executionTimeMs: number;
  estimatedCostSavings?: number;
  securityRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface AnalysisMetadata {
  analysisVersion: string;
  engineVersion: string;
  resourceTypesAnalyzed: string[];
  regionsAnalyzed?: string[];
  filesAnalyzed?: string[];
  executionEnvironment: {
    region: string;
    accountId: string;
    runtime: string;
  };
  quotaUsage: {
    analysisCount: number;
    monthlyLimit: number;
    fileSize: number;
    fileSizeLimit: number;
  };
  performance: {
    totalExecutionTime: number;
    frameworkExecutionTimes: { [frameworkId: string]: number };
    resourceScanTime?: number;
    reportGenerationTime?: number;
  };
}

// GraphQL Arguments
export interface CreateAnalysisArgs {
  projectId: string;
  name: string;
  description?: string;
  type: AnalysisType;
  configuration: Omit<AnalysisConfiguration, 'settings'> & {
    settings?: Partial<AnalysisSettings>;
  };
}

export interface StartAnalysisArgs {
  analysisId: string;
  input?: {
    sourceFiles?: SourceFile[];
    liveAccountScan?: boolean;
    customParameters?: Record<string, any>;
  };
}

export interface GetAnalysisArgs {
  analysisId: string;
}

export interface ListAnalysesByProjectArgs {
  projectId: string;
  status?: AnalysisStatus;
  type?: AnalysisType;
  limit?: number;
  nextToken?: string;
}

export interface UpdateAnalysisArgs {
  analysisId: string;
  name?: string;
  description?: string;
  configuration?: Partial<AnalysisConfiguration>;
}

export interface CancelAnalysisArgs {
  analysisId: string;
  reason?: string;
}

export interface GetAnalysisFindingsArgs {
  analysisId: string;
  frameworkId?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'MANUAL_REVIEW';
  pillarId?: string;
  resourceType?: string;
  limit?: number;
  nextToken?: string;
}

export interface GenerateAnalysisReportArgs {
  analysisId: string;
  format: 'PDF' | 'EXCEL' | 'JSON' | 'CSV';
  includeDetails?: boolean;
  frameworkIds?: string[];
  sections?: ('EXECUTIVE_SUMMARY' | 'DETAILED_FINDINGS' | 'RECOMMENDATIONS' | 'APPENDIX')[];
}

// Step Functions State Machine Types
export interface AnalysisWorkflowInput {
  analysisId: string;
  tenantId: string;
  projectId: string;
  configuration: AnalysisConfiguration;
  input: {
    sourceFiles?: SourceFile[];
    liveAccountScan?: boolean;
    customParameters?: Record<string, any>;
  };
  metadata: {
    startedBy: string;
    startedAt: string;
  };
}

export interface AnalysisWorkflowState {
  analysisId: string;
  tenantId: string;
  projectId: string;
  currentStep: string;
  progress: number;
  results: AnalysisResult[];
  errors: string[];
  configuration: AnalysisConfiguration;
  executionContext: {
    stateMachineArn: string;
    executionArn: string;
    startTime: string;
  };
}

// Report Generation Types
export interface AnalysisReport {
  id: string;
  analysisId: string;
  format: 'PDF' | 'EXCEL' | 'JSON' | 'CSV';
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  s3Location?: {
    bucket: string;
    key: string;
    presignedUrl?: string;
    expiresAt?: string;
  };
  metadata: {
    generatedBy: string;
    generatedAt: string;
    fileSize?: number;
    pageCount?: number;
  };
  error?: string;
}

export interface GenerateReportArgs {
  analysisId: string;
  format: 'PDF' | 'EXCEL' | 'JSON' | 'CSV';
  options?: {
    includeDetails?: boolean;
    frameworkIds?: string[];
    sections?: string[];
    template?: string;
  };
}