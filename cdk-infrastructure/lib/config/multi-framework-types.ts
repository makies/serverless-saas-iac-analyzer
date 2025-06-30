import { FRAMEWORK_TYPES, FRAMEWORK_STATUS, SEVERITY_LEVELS } from './constants';

// Framework Registry Types
export interface FrameworkRegistryItem {
  pk: string; // FRAMEWORK#{type}
  sk: string; // #{frameworkId}
  frameworkType: keyof typeof FRAMEWORK_TYPES;
  frameworkId: string;
  name: string;
  version: string;
  description: string;
  status: keyof typeof FRAMEWORK_STATUS;
  category: string;
  provider: string;
  lastUpdated: string;
  checksCount: number;
  pillars?: string[];
  metadata: {
    industry?: string;
    workloadType?: string;
    complexity?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
    estimatedTimeMinutes?: number;
    prerequisites?: string[];
    tags?: string[];
  };
  // GSI attributes
  GSI1PK: string; // STATUS#{status}
  GSI1SK: string; // TYPE#{type}#NAME#{name}
}

// Rule Definition Types
export interface RuleDefinitionItem {
  pk: string; // RULE#{ruleId}
  sk: string; // VERSION#{version}
  frameworkId: string;
  ruleId: string;
  pillar: string;
  title: string;
  description: string;
  severity: keyof typeof SEVERITY_LEVELS;
  category: string;
  checkType: 'CODE_ANALYSIS' | 'CONFIGURATION' | 'RESOURCE_SCAN' | 'LIVE_CHECK';
  implementation: {
    cloudformation?: RuleImplementation;
    terraform?: RuleImplementation;
    cdk?: RuleImplementation;
    liveCheck?: LiveCheckImplementation;
  };
  remediation: {
    description: string;
    links: string[];
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    automatable: boolean;
    steps?: string[];
  };
  // GSI attributes
  GSI1PK: string; // FRAMEWORK#{frameworkId}
  GSI1SK: string; // PILLAR#{pillar}#SEVERITY#{severity}
}

export interface RuleImplementation {
  resourceTypes: string[];
  checks: RuleCheck[];
}

export interface RuleCheck {
  property?: string;
  attribute?: string;
  condition: 'EXISTS' | 'NOT_EXISTS' | 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'REGEX';
  value?: any;
  message: string;
}

export interface LiveCheckImplementation {
  service: string;
  api: string;
  parameters?: Record<string, any>;
  checks: RuleCheck[];
}

// Tenant Framework Configuration Types
export interface TenantFrameworkConfigItem {
  pk: string; // TENANT#{tenantId}
  sk: string; // FRAMEWORK_SET#{setName}
  configId: string;
  tenantId: string;
  setName: string;
  description?: string;
  frameworks: FrameworkSelection[];
  customRules?: CustomRuleOverride[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  // GSI attributes
  GSI1PK: string; // TENANT#{tenantId}#DEFAULT
  GSI1SK: string; // #{isDefault}
}

export interface FrameworkSelection {
  frameworkId: string;
  version?: string;
  pillars?: string[];
  weight: number;
  enabled: boolean;
  customConfig?: {
    severityWeights?: Record<string, number>;
    excludedRules?: string[];
    customThresholds?: Record<string, number>;
  };
}

export interface CustomRuleOverride {
  ruleId: string;
  enabled: boolean;
  severity?: keyof typeof SEVERITY_LEVELS;
  customMessage?: string;
}

// Tenant Analytics Types
export interface TenantAnalyticsItem {
  pk: string; // TENANT_ANALYTICS#{tenantId}
  sk: string; // MONTH#{YYYY-MM}
  tenantId: string;
  tenantName: string;
  industry: string;
  tier: 'Enterprise' | 'Growth' | 'Startup' | 'Trial';
  period: string; // YYYY-MM format
  metrics: {
    analysisCount: number;
    avgScore: number;
    scoreImprovement: number;
    frameworkUsage: Record<string, FrameworkUsageMetrics>;
    pillarScores: Record<string, number>;
    findingsByCategory: Record<string, number>;
  };
  comparisonMetrics: {
    industryPercentile: number;
    tierPercentile: number;
    overallPercentile: number;
  };
  // GSI attributes
  GSI1PK: string; // MONTH#{YYYY-MM}
  GSI1SK: string; // INDUSTRY#{industry}#SCORE#{score}
  GSI2PK: string; // TIER#{tier}
  GSI2SK: string; // SCORE#{score}#TENANT#{tenantId}
}

export interface FrameworkUsageMetrics {
  count: number;
  avgScore: number;
  improvement: number;
}

// Global Analytics Types
export interface GlobalAnalyticsItem {
  pk: string; // GLOBAL_ANALYTICS
  sk: string; // MONTH#{YYYY-MM} or QUARTER#{YYYY-Q} or YEAR#{YYYY}
  period: string;
  totalTenants: number;
  activeTenants: number;
  totalAnalyses: number;
  avgScore: number;
  frameworkAdoption: Record<string, FrameworkAdoptionMetrics>;
  industryBreakdown: Record<string, IndustryMetrics>;
  tierBreakdown: Record<string, TierMetrics>;
}

export interface FrameworkAdoptionMetrics {
  tenants: number;
  percentage: number;
  trend: number; // % change from previous period
}

export interface IndustryMetrics {
  tenants: number;
  avgScore: number;
  trend: number;
}

export interface TierMetrics {
  tenants: number;
  avgScore: number;
  churnRate?: number;
}

// API Request/Response Types
export interface GetFrameworksRequest {
  type?: keyof typeof FRAMEWORK_TYPES;
  status?: keyof typeof FRAMEWORK_STATUS;
  limit?: number;
  nextToken?: string;
}

export interface GetFrameworksResponse {
  frameworks: FrameworkSummary[];
  pagination: {
    nextToken?: string;
    totalCount: number;
  };
}

export interface FrameworkSummary {
  id: string;
  name: string;
  type: keyof typeof FRAMEWORK_TYPES;
  version: string;
  description: string;
  status: keyof typeof FRAMEWORK_STATUS;
  checksCount: number;
  lastUpdated: string;
  category: string;
  provider: string;
}

export interface GetFrameworkRulesRequest {
  frameworkId: string;
  pillar?: string;
  severity?: keyof typeof SEVERITY_LEVELS;
  limit?: number;
  nextToken?: string;
}

export interface GetFrameworkRulesResponse {
  frameworkId: string;
  rules: RuleDefinitionSummary[];
  statistics: {
    totalRules: number;
    rulesBySeverity: Record<string, number>;
    rulesByPillar: Record<string, number>;
  };
  pagination?: {
    nextToken?: string;
  };
}

export interface RuleDefinitionSummary {
  ruleId: string;
  title: string;
  description: string;
  pillar: string;
  severity: keyof typeof SEVERITY_LEVELS;
  category: string;
  checkType: string;
  version: string;
}

export interface CreateFrameworkSetRequest {
  name: string;
  description?: string;
  frameworks: FrameworkSelection[];
  customRules?: CustomRuleOverride[];
  isDefault?: boolean;
}

export interface FrameworkSetResponse {
  setId: string;
  tenantId: string;
  name: string;
  description?: string;
  frameworks: FrameworkSelection[];
  customRules?: CustomRuleOverride[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Analysis Request with Multi-Framework Support
export interface MultiFrameworkAnalysisRequest {
  projectId: string;
  name: string;
  frameworkSetId?: string; // If not provided, use default
  files: {
    key: string;
    type: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK';
  }[];
  options: {
    includeSecurityHubFindings?: boolean;
    includeLiveAccountScan?: boolean;
    customWeights?: Record<string, number>;
    parallelExecution?: boolean;
  };
}

export interface MultiFrameworkAnalysisResult {
  analysisId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: {
    currentStage: string;
    completedFrameworks: string[];
    totalFrameworks: number;
    percentComplete: number;
  };
  results?: {
    overallScore: number;
    frameworkResults: FrameworkAnalysisResult[];
    recommendations: Recommendation[];
    securityFindings?: SecurityHubFinding[];
  };
}

export interface FrameworkAnalysisResult {
  frameworkId: string;
  frameworkName: string;
  score: number;
  weight: number;
  findings: Finding[];
  statistics: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    skippedChecks: number;
  };
  executionTime: number;
}

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: keyof typeof SEVERITY_LEVELS;
  pillar: string;
  resource?: string;
  recommendation: string;
  category?: string;
  line?: number;
}

export interface Recommendation {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  impact: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  frameworks: string[];
}

export interface SecurityHubFinding {
  id: string;
  awsAccountId: string;
  region: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  remediation?: {
    recommendation: string;
    url?: string;
  };
}