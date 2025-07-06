/**
 * マルチフレームワーク分析システム型定義
 */

/**
 * 分析フレームワーク種別
 */
export enum AnalysisFrameworkType {
  WELL_ARCHITECTED = 'well-architected',
  WELL_ARCHITECTED_SERVERLESS = 'well-architected-serverless',
  WELL_ARCHITECTED_SAAS = 'well-architected-saas',
  WELL_ARCHITECTED_IOT = 'well-architected-iot',
  WELL_ARCHITECTED_ML = 'well-architected-ml',
  WELL_ARCHITECTED_HEALTHCARE = 'well-architected-healthcare',
  AWS_SDP = 'aws-sdp',
  AWS_COMPETENCY = 'aws-competency',
  SECURITY_HUB_CSPM = 'security-hub-cspm',
  CUSTOM = 'custom',
}

/**
 * Well-Architected Framework 6つの柱
 */
export enum WellArchitectedPillar {
  OPERATIONAL_EXCELLENCE = 'operational-excellence',
  SECURITY = 'security',
  RELIABILITY = 'reliability',
  PERFORMANCE_EFFICIENCY = 'performance-efficiency',
  COST_OPTIMIZATION = 'cost-optimization',
  SUSTAINABILITY = 'sustainability',
}

/**
 * フレームワーク定義
 */
export interface AnalysisFramework {
  id: string;
  type: AnalysisFrameworkType;
  name: string;
  description: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // フレームワーク設定
  config: FrameworkConfig;

  // ルール定義
  rules: AnalysisRule[];

  // メタデータ
  metadata: FrameworkMetadata;
}

/**
 * フレームワーク設定
 */
export interface FrameworkConfig {
  // 重要度設定
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };

  // スコア計算設定
  scoring: {
    maxScore: number;
    passThreshold: number;
    weightings: Record<string, number>;
  };

  // レポート設定
  reporting: {
    includeSummary: boolean;
    includeDetails: boolean;
    includeRecommendations: boolean;
    includeCompliance: boolean;
  };

  // 対象リソース
  targetResources: string[];

  // 除外設定
  exclusions: {
    resourceTypes: string[];
    patterns: string[];
  };
}

/**
 * 分析ルール
 */
export interface AnalysisRule {
  id: string;
  frameworkId: string;
  category: string;
  subcategory?: string;
  pillar?: WellArchitectedPillar;

  // ルール詳細
  title: string;
  description: string;
  rationale: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

  // チェック条件
  conditions: RuleCondition[];

  // 修正案
  remediation: {
    description: string;
    steps: string[];
    references: string[];
    estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
    priority: number;
  };

  // メタデータ
  tags: string[];
  isActive: boolean;
  version: string;
  lastUpdated: string;
}

/**
 * ルール条件
 */
export interface RuleCondition {
  type: 'RESOURCE_TYPE' | 'PROPERTY_VALUE' | 'RELATIONSHIP' | 'PATTERN' | 'CUSTOM';
  operator:
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'REGEX'
    | 'EXISTS'
    | 'NOT_EXISTS';
  field: string;
  value?: unknown;
  pattern?: string;
  customLogic?: string; // Bedrock AI評価用
}

/**
 * フレームワークメタデータ
 */
export interface FrameworkMetadata {
  source: 'AWS' | 'CUSTOM' | 'COMMUNITY';
  author: string;
  organization?: string;
  license: string;
  documentation: string[];
  compatibility: {
    iacTypes: ('CLOUDFORMATION' | 'TERRAFORM' | 'CDK')[];
    awsServices: string[];
  };
  statistics: {
    totalRules: number;
    activeTenants: number;
    avgScore: number;
    usageCount: number;
  };
}

/**
 * テナント別フレームワーク設定
 */
export interface TenantFrameworkConfig {
  tenantId: string;
  frameworkId: string;
  isEnabled: boolean;
  customizations: {
    disabledRules: string[];
    customRules: AnalysisRule[];
    severityOverrides: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'>;
    scoringWeights: Record<string, number>;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 分析リクエスト
 */
export interface AnalysisRequest {
  id: string;
  tenantId: string;
  projectId: string;
  userId: string;

  // 分析対象
  targets: AnalysisTarget[];

  // 使用フレームワーク
  frameworks: string[]; // framework IDs

  // 分析オプション
  options: AnalysisOptions;

  // メタデータ
  createdAt: string;
  status: AnalysisStatus;
}

/**
 * 分析対象
 */
export interface AnalysisTarget {
  type: 'FILE' | 'LIVE_ACCOUNT' | 'URL';

  // ファイル分析
  fileInfo?: {
    s3Bucket: string;
    s3Key: string;
    fileName: string;
    fileSize: number;
    fileType: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK';
  };

  // ライブアカウント分析
  awsAccount?: {
    accountId: string;
    regions: string[];
    assumeRoleArn?: string;
    externalId?: string;
  };

  // URL分析
  url?: {
    endpoint: string;
    authHeaders?: Record<string, string>;
  };
}

/**
 * 分析オプション
 */
export interface AnalysisOptions {
  includeCompliance: boolean;
  includeSecurityCheck: boolean;
  includeCostOptimization: boolean;
  includePerformanceAnalysis: boolean;
  includeRecommendations: boolean;

  // AI分析オプション
  useAIAnalysis: boolean;
  aiModel: string;
  aiTemperature: number;

  // 出力オプション
  outputFormats: ('JSON' | 'PDF' | 'EXCEL' | 'CSV')[];
  includeDiagrams: boolean;
  includeExecutiveSummary: boolean;
}

/**
 * 分析ステータス
 */
export enum AnalysisStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * 分析結果
 */
export interface AnalysisResult {
  id: string;
  requestId: string;
  tenantId: string;
  projectId: string;

  // 分析サマリー
  summary: AnalysisSummary;

  // フレームワーク別結果
  frameworkResults: FrameworkResult[];

  // 検出事項
  findings: Finding[];

  // 推奨事項
  recommendations: Recommendation[];

  // メタデータ
  metadata: AnalysisMetadata;

  // 生成されたレポート
  reports: GeneratedReport[];

  createdAt: string;
  completedAt: string;
}

/**
 * 分析サマリー
 */
export interface AnalysisSummary {
  overallScore: number;
  maxScore: number;
  scoreByPillar: Record<WellArchitectedPillar, number>;
  scoreByFramework: Record<string, number>;

  findingCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };

  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * フレームワーク結果
 */
export interface FrameworkResult {
  frameworkId: string;
  frameworkName: string;
  score: number;
  maxScore: number;
  percentage: number;

  pillarScores?: Record<WellArchitectedPillar, number>;
  categoryScores: Record<string, number>;

  passedRules: number;
  failedRules: number;
  totalRules: number;

  findings: Finding[];
}

/**
 * 検出事項
 */
export interface Finding {
  id: string;
  ruleId: string;
  frameworkId: string;
  category: string;
  pillar?: WellArchitectedPillar;

  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  status: 'FAILED' | 'PASSED' | 'WARNING' | 'NOT_APPLICABLE';

  affectedResources: AffectedResource[];

  remediation: {
    description: string;
    steps: string[];
    references: string[];
    estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
    priority: number;
  };

  aiInsights?: {
    explanation: string;
    recommendation: string;
    confidence: number;
  };
}

/**
 * 影響を受けるリソース
 */
export interface AffectedResource {
  type: string;
  id: string;
  name?: string;
  region?: string;
  properties: Record<string, unknown>;
  relationships: string[];
}

/**
 * 推奨事項
 */
export interface Recommendation {
  id: string;
  category: 'SECURITY' | 'COST' | 'PERFORMANCE' | 'OPERATIONAL' | 'SUSTAINABILITY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';

  title: string;
  description: string;
  businessImpact: string;
  technicalDetails: string;

  implementation: {
    effort: 'LOW' | 'MEDIUM' | 'HIGH';
    timeline: string;
    prerequisites: string[];
    steps: string[];
  };

  metrics: {
    potentialSavings?: number;
    performanceImprovement?: string;
    riskReduction?: string;
  };

  relatedFindings: string[];
}

/**
 * 分析メタデータ
 */
export interface AnalysisMetadata {
  version: string;
  analysisEngine: string;
  processingTime: number; // seconds
  resourcesAnalyzed: number;
  rulesExecuted: number;

  aiAnalysis?: {
    model: string;
    tokensUsed: number;
    confidence: number;
    processingTime: number;
  };

  dataRetention: {
    expiresAt: string;
    autoDeleteEnabled: boolean;
  };
}

/**
 * 生成されたレポート
 */
export interface GeneratedReport {
  id: string;
  type: 'EXECUTIVE_SUMMARY' | 'TECHNICAL_REPORT' | 'COMPLIANCE_REPORT' | 'DASHBOARD';
  format: 'PDF' | 'EXCEL' | 'JSON' | 'HTML';

  s3Location: {
    bucket: string;
    key: string;
  };

  metadata: {
    fileName: string;
    fileSize: number;
    generatedAt: string;
    expiresAt: string;
  };
}
