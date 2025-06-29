import { AppSyncResolverEvent } from 'aws-lambda';
import { logger } from '../powertools/config';
import { TenantContext } from '../../lib/config/types';

/**
 * AppSync Event から テナントコンテキストを抽出
 */
export async function extractTenantContext(event: AppSyncResolverEvent<any>): Promise<TenantContext> {
  const identity = event.identity as any;
  
  if (!identity || !identity.claims) {
    throw new Error('No authentication context found');
  }

  const { claims } = identity;
  
  // Cognito JWT クレームからテナント情報を抽出
  const tenantId = claims['custom:tenantId'];
  const role = claims['custom:role'];
  const projectIds = JSON.parse(claims['custom:projectIds'] || '[]');
  const email = claims.email;
  const firstName = claims.given_name;
  const lastName = claims.family_name;
  const userId = claims.sub;

  if (!tenantId) {
    throw new Error('Tenant ID not found in user claims');
  }

  if (!role) {
    throw new Error('User role not found in user claims');
  }

  const tenantContext: TenantContext = {
    tenantId,
    userId,
    role,
    projectIds,
    email,
    firstName,
    lastName,
  };

  logger.debug('Extracted tenant context', {
    tenantId: tenantContext.tenantId,
    userId: tenantContext.userId,
    role: tenantContext.role,
    projectCount: tenantContext.projectIds.length,
  });

  return tenantContext;
}

/**
 * テナント境界の検証
 */
export function validateTenantBoundary(
  tenantContext: TenantContext,
  resourceTenantId: string
): void {
  if (tenantContext.tenantId !== resourceTenantId) {
    logger.warn('Cross-tenant access attempt', {
      userTenantId: tenantContext.tenantId,
      resourceTenantId,
      userId: tenantContext.userId,
    });
    throw new Error('Access denied: Cross-tenant access not allowed');
  }
}

/**
 * プロジェクトアクセス権限の検証
 */
export function validateProjectAccess(
  tenantContext: TenantContext,
  projectId: string
): void {
  // システム管理者とテナント管理者は全プロジェクトにアクセス可能
  if (['SystemAdmin', 'ClientAdmin'].includes(tenantContext.role)) {
    return;
  }

  // その他のロールはアサインされたプロジェクトのみ
  if (!tenantContext.projectIds.includes(projectId)) {
    logger.warn('Project access denied', {
      userId: tenantContext.userId,
      role: tenantContext.role,
      requestedProjectId: projectId,
      assignedProjects: tenantContext.projectIds,
    });
    throw new Error('Access denied: Project access not allowed');
  }
}

/**
 * ロールベース権限の検証
 */
export function validateRolePermission(
  tenantContext: TenantContext,
  requiredRoles: string[]
): void {
  if (!requiredRoles.includes(tenantContext.role)) {
    logger.warn('Role permission denied', {
      userId: tenantContext.userId,
      currentRole: tenantContext.role,
      requiredRoles,
    });
    throw new Error('Access denied: Insufficient role permissions');
  }
}

/**
 * リソースの作成権限チェック
 */
export function validateCreatePermission(
  tenantContext: TenantContext,
  resourceType: 'project' | 'analysis' | 'report'
): void {
  const createPermissions: Record<string, string[]> = {
    project: ['SystemAdmin', 'ClientAdmin'],
    analysis: ['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst'],
    report: ['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst'],
  };

  const allowedRoles = createPermissions[resourceType];
  if (!allowedRoles || !allowedRoles.includes(tenantContext.role)) {
    logger.warn('Create permission denied', {
      userId: tenantContext.userId,
      role: tenantContext.role,
      resourceType,
      allowedRoles,
    });
    throw new Error(`Access denied: Cannot create ${resourceType}`);
  }
}

/**
 * リソースの更新権限チェック
 */
export function validateUpdatePermission(
  tenantContext: TenantContext,
  resourceType: 'project' | 'analysis' | 'report',
  resourceOwnerId?: string
): void {
  const updatePermissions: Record<string, string[]> = {
    project: ['SystemAdmin', 'ClientAdmin', 'ProjectManager'],
    analysis: ['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst'],
    report: ['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst'],
  };

  const allowedRoles = updatePermissions[resourceType];
  if (!allowedRoles || !allowedRoles.includes(tenantContext.role)) {
    // リソースの作成者は自分のリソースを更新可能
    if (resourceOwnerId && resourceOwnerId === tenantContext.userId) {
      return;
    }

    logger.warn('Update permission denied', {
      userId: tenantContext.userId,
      role: tenantContext.role,
      resourceType,
      resourceOwnerId,
      allowedRoles,
    });
    throw new Error(`Access denied: Cannot update ${resourceType}`);
  }
}

/**
 * リソースの削除権限チェック
 */
export function validateDeletePermission(
  tenantContext: TenantContext,
  resourceType: 'project' | 'analysis' | 'report'
): void {
  const deletePermissions: Record<string, string[]> = {
    project: ['SystemAdmin', 'ClientAdmin'],
    analysis: ['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst'],
    report: ['SystemAdmin', 'ClientAdmin', 'ProjectManager'],
  };

  const allowedRoles = deletePermissions[resourceType];
  if (!allowedRoles || !allowedRoles.includes(tenantContext.role)) {
    logger.warn('Delete permission denied', {
      userId: tenantContext.userId,
      role: tenantContext.role,
      resourceType,
      allowedRoles,
    });
    throw new Error(`Access denied: Cannot delete ${resourceType}`);
  }
}