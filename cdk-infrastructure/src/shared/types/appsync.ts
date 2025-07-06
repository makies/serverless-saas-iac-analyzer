/**
 * AppSync共通型定義
 */

export interface AppSyncIdentity {
  sub: string;
  claims?: {
    'custom:tenantId'?: string;
    'custom:role'?: string;
    'custom:projectIds'?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
  };
  sourceIp?: string[];
  defaultAuthStrategy?: string;
}

export interface AppSyncRequestContext {
  requestId: string;
  identity: AppSyncIdentity;
  args: Record<string, unknown>;
  source: Record<string, unknown>;
  request: {
    headers: Record<string, string>;
  };
}

export interface ProjectSettings {
  frameworks: string[];
  analysisConfig: Record<string, unknown>;
}

export interface Project {
  projectId: string;
  tenantId: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Analysis {
  analysisId: string;
  tenantId: string;
  projectId: string;
  name: string;
  type: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK' | 'LIVE_SCAN';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  createdBy: string;
}

export interface Tenant {
  tenantId: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  adminEmail: string;
  createdAt: string;
  updatedAt: string;
}