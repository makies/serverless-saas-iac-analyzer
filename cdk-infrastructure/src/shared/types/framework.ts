/**
 * Framework Type Definitions
 * Multi-framework analysis system types
 */

export interface Framework {
  id: string; // Primary Key (UUID)
  type: FrameworkType;
  name: string;
  description: string;
  version: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
  categories: string[]; // Tags for categorization
  pillars: FrameworkPillar[]; // Assessment pillars/areas
  rules: FrameworkRule[];
  metadata: FrameworkMetadata;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  createdBy: string;
}

export type FrameworkType = 
  | 'AWS_WELL_ARCHITECTED' 
  | 'AWS_WELL_ARCHITECTED_LENS'
  | 'AWS_SDP'
  | 'AWS_COMPETENCY'
  | 'AWS_SECURITY_HUB'
  | 'CUSTOM';

export interface FrameworkPillar {
  id: string;
  name: string;
  description: string;
  weight: number; // Scoring weight (0-1)
  categories: string[];
  order: number; // Display order
}

export interface FrameworkRule {
  id: string;
  pillarId: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  resourceTypes: string[]; // AWS resource types this rule applies to
  conditions: RuleCondition[];
  remediation: RemediationGuidance;
  tags: string[];
  weight: number; // Scoring weight within pillar
  isRequired: boolean;
}

export interface RuleCondition {
  type: 'PROPERTY_CHECK' | 'PATTERN_MATCH' | 'CUSTOM_LOGIC';
  property: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'EXISTS' | 'NOT_EXISTS' | 'REGEX' | 'CUSTOM';
  value?: any;
  customLogic?: string; // For complex conditions
}

export interface RemediationGuidance {
  description: string;
  steps: string[];
  automationAvailable: boolean;
  automationScript?: string;
  references: {
    title: string;
    url: string;
    type: 'DOCUMENTATION' | 'BLOG' | 'WHITEPAPER' | 'VIDEO';
  }[];
  estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FrameworkMetadata {
  sourceUrl?: string;
  lastSyncAt?: string;
  syncVersion?: string;
  changeLog?: string;
  awsServiceCoverage: string[];
  industryCompliance: string[]; // SOC2, HIPAA, etc.
  applicableRegions?: string[];
  deprecationNotice?: string;
  migrationGuide?: string;
}

export interface TenantFrameworkConfig {
  id: string; // Primary Key (UUID)
  tenantId: string; // GSI1 PK
  frameworkId: string; // GSI2 PK
  isEnabled: boolean;
  customizations: FrameworkCustomization;
  defaultSettings: AnalysisSettings;
  createdAt: string;
  updatedAt: string;
  configuredBy: string;
}

export interface FrameworkCustomization {
  enabledRules: string[]; // Rule IDs to include
  disabledRules: string[]; // Rule IDs to exclude
  pillarWeights: { [pillarId: string]: number }; // Custom pillar weights
  customRules: CustomRule[]; // Tenant-specific rules
  severityOverrides: { [ruleId: string]: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };
}

export interface CustomRule extends Omit<FrameworkRule, 'id'> {
  id: string;
  tenantId: string;
  isCustom: true;
  baseRuleId?: string; // If derived from existing rule
}

export interface AnalysisSettings {
  includeInactiveResources: boolean;
  includeTaggedResources: string[]; // Only analyze resources with these tags
  excludeTaggedResources: string[]; // Exclude resources with these tags
  maxResourcesPerAnalysis: number;
  parallelAnalysisLimit: number;
  detailedReporting: boolean;
  generateRecommendations: boolean;
  autoRemediationEnabled: boolean;
}

// GraphQL Arguments
export interface ListFrameworksArgs {
  type?: FrameworkType;
  status?: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
  category?: string;
  limit?: number;
  nextToken?: string;
}

export interface GetFrameworkArgs {
  frameworkId: string;
}

export interface CreateFrameworkArgs {
  type: FrameworkType;
  name: string;
  description: string;
  version: string;
  categories?: string[];
  pillars: Omit<FrameworkPillar, 'id'>[];
  rules: Omit<FrameworkRule, 'id'>[];
  metadata?: Partial<FrameworkMetadata>;
}

export interface UpdateFrameworkArgs {
  frameworkId: string;
  name?: string;
  description?: string;
  version?: string;
  status?: 'ACTIVE' | 'DEPRECATED' | 'DRAFT';
  categories?: string[];
  pillars?: Omit<FrameworkPillar, 'id'>[];
  rules?: Omit<FrameworkRule, 'id'>[];
  metadata?: Partial<FrameworkMetadata>;
}

export interface GetTenantFrameworkConfigArgs {
  tenantId: string;
  frameworkId: string;
}

export interface UpdateTenantFrameworkConfigArgs {
  tenantId: string;
  frameworkId: string;
  isEnabled?: boolean;
  customizations?: Partial<FrameworkCustomization>;
  defaultSettings?: Partial<AnalysisSettings>;
}

export interface ListTenantFrameworkConfigsArgs {
  tenantId: string;
  frameworkType?: FrameworkType;
  enabledOnly?: boolean;
  limit?: number;
  nextToken?: string;
}

// Analysis Engine Types
export interface AnalysisRequest {
  id: string;
  projectId: string;
  tenantId: string;
  frameworkIds: string[];
  awsAccountId: string;
  regions: string[];
  resourceTypes?: string[];
  analysisType: 'FULL_SCAN' | 'INCREMENTAL' | 'TARGETED';
  settings: AnalysisSettings;
  requestedBy: string;
  createdAt: string;
}

export interface AnalysisResult {
  id: string;
  requestId: string;
  frameworkId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number; // 0-100
  findings: AnalysisFinding[];
  summary: AnalysisSummary;
  metadata: AnalysisMetadata;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface AnalysisFinding {
  id: string;
  ruleId: string;
  resourceArn: string;
  resourceType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
  title: string;
  description: string;
  currentValue?: any;
  expectedValue?: any;
  remediation: RemediationGuidance;
  region: string;
  accountId: string;
  tags: { [key: string]: string };
  detectedAt: string;
}

export interface AnalysisSummary {
  totalResources: number;
  analyzedResources: number;
  totalFindings: number;
  findingsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  complianceScore: number; // 0-100
  pillarScores: { [pillarId: string]: number };
  recommendationsCount: number;
  autoRemediableCount: number;
}

export interface AnalysisMetadata {
  executionTimeMs: number;
  resourceTypesAnalyzed: string[];
  regionsAnalyzed: string[];
  frameworkVersion: string;
  analysisVersion: string;
  costOptimizationPotential?: number;
  securityRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}