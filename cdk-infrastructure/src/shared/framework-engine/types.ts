/**
 * Core types for the multi-framework analysis engine
 */

export enum FrameworkType {
  WA_FRAMEWORK = 'WA_FRAMEWORK',
  WA_LENSES = 'WA_LENSES',
  SDP = 'SDP',
  COMPETENCY = 'COMPETENCY',
  CSPM = 'CSPM',
  CUSTOM = 'CUSTOM',
}

export enum FrameworkStatus {
  ACTIVE = 'ACTIVE',
  DRAFT = 'DRAFT',
  DEPRECATED = 'DEPRECATED',
  ARCHIVED = 'ARCHIVED',
}

export enum WellArchitectedPillar {
  OPERATIONAL_EXCELLENCE = 'OPERATIONAL_EXCELLENCE',
  SECURITY = 'SECURITY',
  RELIABILITY = 'RELIABILITY',
  PERFORMANCE_EFFICIENCY = 'PERFORMANCE_EFFICIENCY',
  COST_OPTIMIZATION = 'COST_OPTIMIZATION',
  SUSTAINABILITY = 'SUSTAINABILITY',
}

export enum FindingSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFORMATIONAL = 'INFORMATIONAL',
}

export enum RuleImplementationType {
  CFN_GUARD = 'CFN_GUARD',
  OPEN_POLICY_AGENT = 'OPEN_POLICY_AGENT',
  JAVASCRIPT = 'JAVASCRIPT',
  PYTHON = 'PYTHON',
  BEDROCK_AI = 'BEDROCK_AI',
}

export interface Framework {
  id: string;
  type: FrameworkType;
  name: string;
  description: string;
  version: string;
  status: FrameworkStatus;
  rules: Rule[];
  categories: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Rule {
  id: string;
  frameworkId: string;
  ruleId: string;
  name: string;
  description: string;
  severity: FindingSeverity;
  pillar?: WellArchitectedPillar;
  category: string;
  tags: string[];
  implementation: RuleImplementation;
  conditions: Record<string, any>;
  parameters?: Record<string, any>;
  remediation: string;
}

export interface RuleImplementation {
  type: RuleImplementationType;
  code: string;
  language?: string;
  runtime?: string;
  dependencies?: string[];
  timeout?: number;
  memoryLimit?: number;
}

export interface TenantFrameworkConfig {
  tenantId: string;
  frameworkId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  enabledRules: string[];
  customRules: CustomRule[];
  ruleOverrides: Record<string, any>;
  settings: FrameworkSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  severity: FindingSeverity;
  category: string;
  implementation: RuleImplementation;
}

export interface FrameworkSettings {
  strictMode: boolean;
  includeInformational: boolean;
  customSeverityLevels: Record<string, any>;
  notificationSettings: Record<string, any>;
}

export interface AnalysisConfiguration {
  frameworks: string[];
  scope: 'full' | 'security' | 'cost' | 'custom';
  settings: {
    enabledRules?: string[];
    disabledRules?: string[];
    customRules?: CustomRule[];
    strictMode?: boolean;
    includeInformational?: boolean;
    parallelExecution?: boolean;
    timeout?: number;
  };
}

export interface FrameworkAnalysisResult {
  frameworkId: string;
  frameworkName: string;
  frameworkType: FrameworkType;
  status: 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'SKIPPED';
  startTime: string;
  endTime: string;
  duration: number;
  findings: Finding[];
  summary: FrameworkSummary;
  error?: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: FindingSeverity;
  category: string;
  pillar?: WellArchitectedPillar;
  title: string;
  description: string;
  resource: ResourceInfo;
  remediation: string;
  references: string[];
  metadata: Record<string, any>;
}

export interface ResourceInfo {
  type: string;
  name: string;
  arn?: string;
  region: string;
  accountId: string;
  properties: Record<string, any>;
}

export interface FrameworkSummary {
  totalRules: number;
  executedRules: number;
  skippedRules: number;
  totalFindings: number;
  findingsBySeverity: Record<FindingSeverity, number>;
  findingsByCategory: Record<string, number>;
  findingsByPillar?: Record<WellArchitectedPillar, number>;
  score: number;
  maxScore: number;
  percentage: number;
}

export interface MultiFrameworkAnalysisResult {
  analysisId: string;
  tenantId: string;
  projectId: string;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL' | 'TIMEOUT';
  startTime: string;
  endTime: string;
  duration: number;
  frameworks: FrameworkAnalysisResult[];
  aggregatedSummary: AggregatedSummary;
  metadata: Record<string, any>;
}

export interface AggregatedSummary {
  totalFrameworks: number;
  completedFrameworks: number;
  failedFrameworks: number;
  totalFindings: number;
  findingsBySeverity: Record<FindingSeverity, number>;
  findingsByCategory: Record<string, number>;
  findingsByPillar: Record<WellArchitectedPillar, number>;
  overallScore: number;
  frameworkScores: Record<string, number>;
  recommendations: string[];
}

export interface FrameworkExecutionContext {
  tenantId: string;
  projectId: string;
  analysisId: string;
  framework: Framework;
  tenantConfig: TenantFrameworkConfig;
  resources: any[];
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region: string;
  };
  settings: {
    timeout: number;
    parallelRules: number;
    strictMode: boolean;
    includeInformational: boolean;
  };
}

export interface RuleExecutionContext {
  tenantId: string;
  projectId: string;
  analysisId: string;
  frameworkId: string;
  rule: Rule;
  resources: any[];
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region: string;
  };
  parameters: Record<string, any>;
}

export interface RuleExecutionResult {
  ruleId: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
  findings: Finding[];
  executionTime: number;
  error?: string;
  metadata: Record<string, any>;
}