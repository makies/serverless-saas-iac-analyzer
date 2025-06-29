import { StackProps } from 'aws-cdk-lib';
import { EnvironmentConfig } from './environments';

export interface ExtendedStackProps extends StackProps {
  config: EnvironmentConfig;
}

// DynamoDB スキーマ型定義
export interface TenantRecord {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  subscription: {
    tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
    limits: {
      monthlyAnalyses: number;
      maxFileSize: number;
      retentionDays: number;
      maxConcurrentAnalyses: number;
    };
  };
  adminEmail: string;
  settings?: {
    allowClientAccess: boolean;
    defaultAnalysisType: string;
    notificationSettings?: {
      analysisComplete: boolean;
      quotaWarning: boolean;
      systemAlerts: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  memberIds: string[];
  settings?: {
    allowClientAccess: boolean;
    defaultAnalysisType: string;
    autoDeleteAnalyses: boolean;
    retentionDays?: number;
  };
  metrics?: {
    totalAnalyses: number;
    completedAnalyses: number;
    avgScore?: number;
    lastAnalysisAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AnalysisRecord {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  type: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK' | 'LIVE_SCAN';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  inputFiles?: Array<{
    bucket: string;
    key: string;
    size: number;
    contentType?: string;
  }>;
  awsConfig?: {
    region: string;
    accountId: string;
    roleArn?: string;
  };
  resultSummary?: {
    overallScore: number;
    pillars: Array<{
      pillar: string;
      score: number;
      findings: number;
    }>;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    totalFindings: number;
  };
  executionId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  createdBy: string;
}

export interface FindingRecord {
  id: string;
  analysisId: string;
  tenantId: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  pillar: string;
  resource?: string;
  line?: number;
  recommendation: string;
  category?: string;
  ruleId?: string;
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  tenantId: string;
  projectId: string;
  analysisId?: string;
  name: string;
  type: 'ANALYSIS_SUMMARY' | 'DETAILED_FINDINGS' | 'EXECUTIVE_SUMMARY' | 'COMPLIANCE_REPORT';
  format: 'PDF' | 'EXCEL' | 'JSON' | 'HTML';
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  s3Location?: {
    bucket: string;
    key: string;
    size: number;
    contentType?: string;
  };
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  tenantId: string;
  cognitoId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SYSTEM_ADMIN' | 'CLIENT_ADMIN' | 'PROJECT_MANAGER' | 'ANALYST' | 'VIEWER' | 'CLIENT_ENGINEER';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_INVITATION';
  projectIds: string[];
  preferences?: {
    language: string;
    timezone: string;
    emailNotifications: boolean;
    theme: string;
  };
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// AppSync Context型
export interface AppSyncIdentity {
  sub: string;
  issuer: string;
  username: string;
  claims: {
    'custom:tenantId': string;
    'custom:role': string;
    'custom:projectIds': string;
    email: string;
    given_name: string;
    family_name: string;
  };
  sourceIp: string[];
  defaultAuthStrategy: string;
}

export interface AppSyncRequestContext {
  requestId: string;
  identity: AppSyncIdentity;
  args: Record<string, any>;
  source: Record<string, any>;
  request: {
    headers: Record<string, string>;
  };
}

// テナントコンテキスト
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
  projectIds: string[];
  email: string;
  firstName: string;
  lastName: string;
}

// EventBridge イベント型
export interface BaseEvent {
  source: string;
  'detail-type': string;
  detail: Record<string, any>;
  time: string;
  region: string;
  account: string;
}

export interface TenantEvent extends BaseEvent {
  source: 'sbt.controlplane';
  'detail-type': 'Tenant Created' | 'Tenant Updated' | 'Tenant Suspended';
  detail: {
    tenantId: string;
    tenantName: string;
    adminEmail: string;
    tier: string;
    status: string;
  };
}

export interface AnalysisEvent extends BaseEvent {
  source: 'analysis.engine';
  'detail-type': 'Analysis Started' | 'Analysis Completed' | 'Analysis Failed';
  detail: {
    analysisId: string;
    tenantId: string;
    projectId: string;
    status: string;
    executionId?: string;
    errorMessage?: string;
  };
}