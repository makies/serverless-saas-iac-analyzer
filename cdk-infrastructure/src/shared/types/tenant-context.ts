/**
 * テナントコンテキスト型定義
 * テナント分離とアクセス制御のためのコア型
 */

export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: UserRole;
  projectId?: string;
  permissions: Permission[];
  sessionId: string;
  clientIp: string;
  userAgent: string;
  timestamp: string;
}

/**
 * ユーザーロール定義
 */
export enum UserRole {
  SYSTEM_ADMIN = 'SystemAdmin',
  FRAMEWORK_ADMIN = 'FrameworkAdmin',
  CLIENT_ADMIN = 'ClientAdmin',
  PROJECT_MANAGER = 'ProjectManager',
  ANALYST = 'Analyst',
  VIEWER = 'Viewer',
  CLIENT_ENGINEER = 'ClientEngineer',
}

/**
 * 権限定義
 */
export enum Permission {
  // テナント管理
  MANAGE_TENANTS = 'manage:tenants',
  VIEW_TENANTS = 'view:tenants',

  // フレームワーク管理
  MANAGE_FRAMEWORKS = 'manage:frameworks',
  CONFIGURE_TENANT_FRAMEWORKS = 'configure:tenant-frameworks',
  VIEW_FRAMEWORKS = 'view:frameworks',

  // プロジェクト管理
  CREATE_PROJECTS = 'create:projects',
  MANAGE_PROJECTS = 'manage:projects',
  VIEW_PROJECTS = 'view:projects',
  DELETE_PROJECTS = 'delete:projects',

  // 分析実行
  RUN_ANALYSIS = 'run:analysis',
  VIEW_ANALYSIS = 'view:analysis',
  DELETE_ANALYSIS = 'delete:analysis',

  // レポート
  GENERATE_REPORTS = 'generate:reports',
  VIEW_REPORTS = 'view:reports',
  DOWNLOAD_REPORTS = 'download:reports',

  // ユーザー管理
  MANAGE_USERS = 'manage:users',
  INVITE_USERS = 'invite:users',
  VIEW_USERS = 'view:users',

  // 横断分析 (管理者のみ)
  CROSS_TENANT_ANALYTICS = 'analytics:cross-tenant',
  VIEW_USAGE_METRICS = 'view:usage-metrics',
}

/**
 * ロール別権限マッピング
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SYSTEM_ADMIN]: [
    Permission.MANAGE_TENANTS,
    Permission.VIEW_TENANTS,
    Permission.MANAGE_FRAMEWORKS,
    Permission.VIEW_FRAMEWORKS,
    Permission.CROSS_TENANT_ANALYTICS,
    Permission.VIEW_USAGE_METRICS,
    Permission.MANAGE_USERS,
    Permission.INVITE_USERS,
    Permission.VIEW_USERS,
  ],

  [UserRole.FRAMEWORK_ADMIN]: [
    Permission.MANAGE_FRAMEWORKS,
    Permission.VIEW_FRAMEWORKS,
    Permission.VIEW_TENANTS,
  ],

  [UserRole.CLIENT_ADMIN]: [
    Permission.CONFIGURE_TENANT_FRAMEWORKS,
    Permission.VIEW_FRAMEWORKS,
    Permission.CREATE_PROJECTS,
    Permission.MANAGE_PROJECTS,
    Permission.VIEW_PROJECTS,
    Permission.DELETE_PROJECTS,
    Permission.RUN_ANALYSIS,
    Permission.VIEW_ANALYSIS,
    Permission.DELETE_ANALYSIS,
    Permission.GENERATE_REPORTS,
    Permission.VIEW_REPORTS,
    Permission.DOWNLOAD_REPORTS,
    Permission.MANAGE_USERS,
    Permission.INVITE_USERS,
    Permission.VIEW_USERS,
  ],

  [UserRole.PROJECT_MANAGER]: [
    Permission.CREATE_PROJECTS,
    Permission.MANAGE_PROJECTS,
    Permission.VIEW_PROJECTS,
    Permission.RUN_ANALYSIS,
    Permission.VIEW_ANALYSIS,
    Permission.GENERATE_REPORTS,
    Permission.VIEW_REPORTS,
    Permission.DOWNLOAD_REPORTS,
    Permission.INVITE_USERS,
    Permission.VIEW_USERS,
  ],

  [UserRole.ANALYST]: [
    Permission.VIEW_PROJECTS,
    Permission.RUN_ANALYSIS,
    Permission.VIEW_ANALYSIS,
    Permission.GENERATE_REPORTS,
    Permission.VIEW_REPORTS,
    Permission.DOWNLOAD_REPORTS,
  ],

  [UserRole.VIEWER]: [Permission.VIEW_PROJECTS, Permission.VIEW_ANALYSIS, Permission.VIEW_REPORTS],

  [UserRole.CLIENT_ENGINEER]: [
    Permission.VIEW_PROJECTS,
    Permission.VIEW_ANALYSIS,
    Permission.VIEW_REPORTS,
    Permission.DOWNLOAD_REPORTS,
  ],
};

/**
 * テナント分離チェック
 */
export interface TenantIsolationCheck {
  isValid: boolean;
  violations: string[];
  accessLevel: 'FULL' | 'LIMITED' | 'DENIED';
}

/**
 * プロジェクトアクセス権限
 */
export interface ProjectAccess {
  projectId: string;
  accessLevel: 'FULL' | 'READ_ONLY' | 'NO_ACCESS';
  canModify: boolean;
  canDelete: boolean;
  canInviteUsers: boolean;
}

/**
 * Basic Tier使用量制限
 */
export interface UsageQuota {
  analysesUsed: number;
  analysesLimit: number;
  storageUsedBytes: number;
  storageLimit: number;
  retentionDays: number;
  canCreateAnalysis: boolean;
  canUploadFiles: boolean;
}
