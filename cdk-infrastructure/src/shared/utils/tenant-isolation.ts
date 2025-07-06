import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import {
  TenantContext,
  UserRole,
  Permission,
  TenantIsolationCheck,
  ProjectAccess,
  UsageQuota,
} from '../types/tenant-context';
import { validateBasicTierUsage, type UsageLimits } from '../../../lib/config/sbt-config';

const logger = new Logger({ serviceName: 'tenant-isolation' });
const tracer = new Tracer({ serviceName: 'tenant-isolation' });
const metrics = new Metrics({ namespace: 'CloudBPA/TenantIsolation' });

/**
 * テナントコンテキストの検証
 */
export function validateTenantContext(context: TenantContext): TenantIsolationCheck {
  const violations: string[] = [];

  // 必須フィールドチェック
  if (!context.tenantId || context.tenantId.trim() === '') {
    violations.push('Missing or empty tenantId');
  }

  if (!context.userId || context.userId.trim() === '') {
    violations.push('Missing or empty userId');
  }

  if (!Object.values(UserRole).includes(context.userRole)) {
    violations.push(`Invalid user role: ${context.userRole}`);
  }

  if (!context.sessionId || context.sessionId.trim() === '') {
    violations.push('Missing or empty sessionId');
  }

  // テナントID形式チェック (英数字とハイフンのみ)
  if (context.tenantId && !/^[a-zA-Z0-9\-]+$/.test(context.tenantId)) {
    violations.push('Invalid tenantId format');
  }

  // 権限チェック
  // const expectedPermissions = ROLE_PERMISSIONS[context.userRole] || [];
  if (context.permissions.length === 0) {
    violations.push('No permissions assigned to user');
  }

  logger.info('Tenant context validation', {
    tenantId: context.tenantId,
    userId: context.userId,
    role: context.userRole,
    violations: violations.length,
  });

  return {
    isValid: violations.length === 0,
    violations,
    accessLevel: violations.length === 0 ? 'FULL' : 'DENIED',
  };
}

/**
 * 権限チェック
 */
export function hasPermission(context: TenantContext, permission: Permission): boolean {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('hasPermission');

  try {
    const hasPermission = context.permissions.includes(permission);

    logger.debug('Permission check', {
      tenantId: context.tenantId,
      userId: context.userId,
      permission,
      hasPermission,
    });

    metrics.addMetric('PermissionCheck', 'Count', 1);
    if (!hasPermission) {
      metrics.addMetric('PermissionDenied', 'Count', 1);
    }

    return hasPermission;
  } catch (error) {
    logger.error('Permission check failed', { error });
    metrics.addMetric('PermissionCheckError', 'Count', 1);
    return false;
  } finally {
    subsegment?.close();
  }
}

/**
 * プロジェクトアクセス権限チェック
 */
export function checkProjectAccess(
  context: TenantContext,
  projectId: string,
  projectTenantId: string,
  projectManagerIds: string[] = []
): ProjectAccess {
  // テナント分離チェック
  if (context.tenantId !== projectTenantId && context.userRole !== UserRole.SYSTEM_ADMIN) {
    logger.warn('Cross-tenant access attempt blocked', {
      userTenantId: context.tenantId,
      projectTenantId,
      userId: context.userId,
      projectId,
    });

    metrics.addMetric('CrossTenantAccessBlocked', 'Count', 1);

    return {
      projectId,
      accessLevel: 'NO_ACCESS',
      canModify: false,
      canDelete: false,
      canInviteUsers: false,
    };
  }

  // ロールベースアクセス制御
  const isProjectManager = projectManagerIds.includes(context.userId);
  const role = context.userRole;

  let accessLevel: 'FULL' | 'READ_ONLY' | 'NO_ACCESS' = 'NO_ACCESS';
  let canModify = false;
  let canDelete = false;
  let canInviteUsers = false;

  switch (role) {
    case UserRole.SYSTEM_ADMIN:
    case UserRole.CLIENT_ADMIN:
      accessLevel = 'FULL';
      canModify = true;
      canDelete = true;
      canInviteUsers = true;
      break;

    case UserRole.PROJECT_MANAGER:
      if (isProjectManager || hasPermission(context, Permission.MANAGE_PROJECTS)) {
        accessLevel = 'FULL';
        canModify = true;
        canDelete = false; // プロジェクト削除は管理者のみ
        canInviteUsers = true;
      } else if (hasPermission(context, Permission.VIEW_PROJECTS)) {
        accessLevel = 'READ_ONLY';
      }
      break;

    case UserRole.ANALYST:
      if (hasPermission(context, Permission.VIEW_PROJECTS)) {
        accessLevel = 'READ_ONLY';
      }
      break;

    case UserRole.VIEWER:
    case UserRole.CLIENT_ENGINEER:
      if (hasPermission(context, Permission.VIEW_PROJECTS)) {
        accessLevel = 'READ_ONLY';
      }
      break;
  }

  logger.info('Project access check', {
    tenantId: context.tenantId,
    userId: context.userId,
    projectId,
    accessLevel,
    canModify,
    canDelete,
    canInviteUsers,
  });

  return {
    projectId,
    accessLevel,
    canModify,
    canDelete,
    canInviteUsers,
  };
}

/**
 * Basic Tier使用量制限チェック
 */
export async function checkUsageQuota(
  tenantId: string,
  currentUsage: UsageLimits
): Promise<UsageQuota> {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('checkUsageQuota');

  try {
    const validation = validateBasicTierUsage(currentUsage);

    const quota: UsageQuota = {
      analysesUsed: currentUsage.analysesThisMonth,
      analysesLimit: 100, // Basic Tier limit
      storageUsedBytes: currentUsage.totalStorageBytes,
      storageLimit: 10 * 1024 * 1024 * 1024, // 10GB for Basic Tier
      retentionDays: 90,
      canCreateAnalysis: validation.isValid && currentUsage.analysesThisMonth < 100,
      canUploadFiles: validation.isValid,
    };

    logger.info('Usage quota check', {
      tenantId,
      quota,
      violations: validation.violations,
    });

    metrics.addMetric('UsageQuotaCheck', 'Count', 1);
    if (!validation.isValid) {
      metrics.addMetric('UsageQuotaExceeded', 'Count', 1);
      metrics.addMetric('AnalysesUsed', 'Count', currentUsage.analysesThisMonth);
    }

    return quota;
  } catch (error) {
    logger.error('Usage quota check failed', { error, tenantId });
    metrics.addMetric('UsageQuotaCheckError', 'Count', 1);

    // エラー時は安全側に倒す
    return {
      analysesUsed: 0,
      analysesLimit: 100,
      storageUsedBytes: 0,
      storageLimit: 10 * 1024 * 1024 * 1024,
      retentionDays: 90,
      canCreateAnalysis: false,
      canUploadFiles: false,
    };
  } finally {
    subsegment?.close();
  }
}

/**
 * DynamoDB条件式生成 (テナント分離)
 */
export function generateTenantIsolationCondition(tenantId: string) {
  return {
    FilterExpression: 'tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':tenantId': tenantId,
    },
  };
}

/**
 * S3オブジェクトキー生成 (テナントプレフィックス)
 */
export function generateTenantS3Key(tenantId: string, ...pathParts: string[]): string {
  const sanitizedTenantId = tenantId.replace(/[^a-zA-Z0-9\-]/g, '');
  return [sanitizedTenantId, ...pathParts].join('/');
}

/**
 * 監査ログ出力
 */
export function auditLog(
  context: TenantContext,
  action: string,
  resourceType: string,
  resourceId?: string,
  result: 'SUCCESS' | 'FAILURE' | 'DENIED' = 'SUCCESS',
  details?: Record<string, unknown>
): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    tenantId: context.tenantId,
    userId: context.userId,
    userRole: context.userRole,
    sessionId: context.sessionId,
    clientIp: context.clientIp,
    userAgent: context.userAgent,
    action,
    resourceType,
    resourceId,
    result,
    details,
  };

  logger.info('AUDIT', auditEntry);

  metrics.addMetric('AuditLog', 'Count', 1);
  metrics.addMetric(`AuditLog_${result}`, 'Count', 1);
}
