// Well-Architected Framework の6つの柱
export const WELL_ARCHITECTED_PILLARS = {
  OPERATIONAL_EXCELLENCE: 'OPERATIONAL_EXCELLENCE',
  SECURITY: 'SECURITY',
  RELIABILITY: 'RELIABILITY',
  PERFORMANCE_EFFICIENCY: 'PERFORMANCE_EFFICIENCY',
  COST_OPTIMIZATION: 'COST_OPTIMIZATION',
  SUSTAINABILITY: 'SUSTAINABILITY',
} as const;

// ユーザーロール
export const USER_ROLES = {
  SYSTEM_ADMIN: 'SystemAdmin',
  FRAMEWORK_ADMIN: 'FrameworkAdmin',
  CLIENT_ADMIN: 'ClientAdmin',
  PROJECT_MANAGER: 'ProjectManager',
  ANALYST: 'Analyst',
  VIEWER: 'Viewer',
  CLIENT_ENGINEER: 'ClientEngineer',
} as const;

// 分析タイプ
export const ANALYSIS_TYPES = {
  CLOUDFORMATION: 'CLOUDFORMATION',
  TERRAFORM: 'TERRAFORM',
  CDK: 'CDK',
  LIVE_SCAN: 'LIVE_SCAN',
} as const;

// 分析ステータス
export const ANALYSIS_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// 重要度レベル
export const SEVERITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
} as const;

// レポート形式
export const REPORT_FORMATS = {
  PDF: 'PDF',
  EXCEL: 'EXCEL',
  JSON: 'JSON',
  HTML: 'HTML',
} as const;

// SBT Basic Tier制限
export const SBT_BASIC_LIMITS = {
  MONTHLY_ANALYSES: 100,
  MAX_FILE_SIZE_MB: 10,
  RETENTION_DAYS: 90,
  MAX_CONCURRENT_ANALYSES: 5,
} as const;

// DynamoDB テーブル名
export const TABLE_NAMES = {
  TENANTS: 'Tenants',
  PROJECTS: 'Projects',
  ANALYSES: 'Analyses',
  FINDINGS: 'Findings',
  REPORTS: 'Reports',
  USERS: 'Users',
  // Multi-Framework Tables
  FRAMEWORK_REGISTRY: 'FrameworkRegistry',
  RULE_DEFINITIONS: 'RuleDefinitions', 
  TENANT_FRAMEWORK_CONFIG: 'TenantFrameworkConfig',
  TENANT_ANALYTICS: 'TenantAnalytics',
  GLOBAL_ANALYTICS: 'GlobalAnalytics',
} as const;

// Framework Types
export const FRAMEWORK_TYPES = {
  WA_FRAMEWORK: 'WA_FRAMEWORK',
  WA_LENSES: 'WA_LENSES', 
  SDP: 'SDP',
  COMPETENCY: 'COMPETENCY',
  CSPM: 'CSPM',
  CUSTOM: 'CUSTOM',
} as const;

// Framework Status
export const FRAMEWORK_STATUS = {
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  BETA: 'BETA',
  DRAFT: 'DRAFT',
} as const;

// S3 プレフィックス
export const S3_PREFIXES = {
  TENANT_DATA: 'tenants',
  ANALYSIS_INPUTS: 'analysis-inputs',
  ANALYSIS_OUTPUTS: 'analysis-outputs',
  REPORTS: 'reports',
  TEMPLATES: 'templates',
} as const;

// EventBridge ソース
export const EVENT_SOURCES = {
  SBT_CONTROL_PLANE: 'sbt.controlplane',
  GRAPHQL_APPLICATION_PLANE: 'graphql.applicationplane',
  ANALYSIS_ENGINE: 'analysis.engine',
  REPORT_GENERATOR: 'report.generator',
} as const;

// EventBridge イベントタイプ
export const EVENT_TYPES = {
  TENANT_CREATED: 'Tenant Created',
  TENANT_UPDATED: 'Tenant Updated',
  TENANT_SUSPENDED: 'Tenant Suspended',
  ANALYSIS_STARTED: 'Analysis Started',
  ANALYSIS_COMPLETED: 'Analysis Completed',
  ANALYSIS_FAILED: 'Analysis Failed',
  REPORT_GENERATED: 'Report Generated',
  USER_INVITED: 'User Invited',
} as const;

// Bedrock モデル設定
export const BEDROCK_MODELS = {
  CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
} as const;

// GraphQL エラーコード
export const GRAPHQL_ERROR_CODES = {
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  ANALYSIS_NOT_FOUND: 'ANALYSIS_NOT_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Lambda 関数名
export const LAMBDA_FUNCTION_NAMES = {
  // Query Resolvers
  GET_TENANT: 'getTenant',
  LIST_TENANTS: 'listTenants',
  GET_PROJECT: 'getProject',
  LIST_PROJECTS: 'listProjects',
  LIST_PROJECTS_BY_TENANT: 'listProjectsByTenant',
  GET_ANALYSIS: 'getAnalysis',
  LIST_ANALYSES: 'listAnalyses',
  LIST_ANALYSES_BY_PROJECT: 'listAnalysesByProject',
  GET_DASHBOARD_METRICS: 'getDashboardMetrics',
  
  // Framework Management Queries
  LIST_FRAMEWORKS: 'listFrameworks',
  GET_FRAMEWORK: 'getFramework',
  LIST_FRAMEWORK_RULES: 'listFrameworkRules',
  GET_TENANT_FRAMEWORK_CONFIG: 'getTenantFrameworkConfig',
  
  // Mutation Resolvers
  CREATE_PROJECT: 'createProject',
  UPDATE_PROJECT: 'updateProject',
  DELETE_PROJECT: 'deleteProject',
  CREATE_ANALYSIS: 'createAnalysis',
  START_ANALYSIS: 'startAnalysis',
  UPDATE_ANALYSIS: 'updateAnalysis',
  GENERATE_REPORT: 'generateReport',
  
  // Framework Management Mutations
  CREATE_FRAMEWORK_SET: 'createFrameworkSet',
  UPDATE_FRAMEWORK_SET: 'updateFrameworkSet',
  DELETE_FRAMEWORK_SET: 'deleteFrameworkSet',
  
  // Subscription Resolvers
  ON_ANALYSIS_STATUS_CHANGED: 'onAnalysisStatusChanged',
  ON_REPORT_GENERATED: 'onReportGenerated',
  
  // Background Workers
  ANALYSIS_WORKER: 'analysisWorker',
  REPORT_WORKER: 'reportWorker',
  NOTIFICATION_WORKER: 'notificationWorker',
} as const;

// CloudWatch メトリクス
export const CLOUDWATCH_METRICS = {
  NAMESPACE: 'CloudBestPracticeAnalyzer',
  ANALYSIS_COUNT: 'AnalysisCount',
  ANALYSIS_DURATION: 'AnalysisDuration',
  ERROR_RATE: 'ErrorRate',
  QUOTA_USAGE: 'QuotaUsage',
  TENANT_COUNT: 'TenantCount',
  PROJECT_COUNT: 'ProjectCount',
} as const;