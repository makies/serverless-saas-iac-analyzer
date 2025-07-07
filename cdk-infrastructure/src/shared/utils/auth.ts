/**
 * Authentication and Authorization Utilities
 */

export interface CognitoIdentity {
  sub: string;
  email?: string;
  claims: {
    'custom:tenantId'?: string;
    'custom:role'?: string;
    'custom:permissions'?: string;
    email?: string;
    email_verified?: string;
  };
}

export type UserRole = 
  | 'SystemAdmin'
  | 'FrameworkAdmin' 
  | 'ClientAdmin'
  | 'ProjectManager'
  | 'Analyst'
  | 'Viewer'
  | 'ClientEngineer';

export interface AuthContext {
  userId: string;
  tenantId?: string;
  role?: UserRole;
  permissions: string[];
}

/**
 * Extract authentication context from AppSync event identity
 */
export function getAuthContext(identity: any): AuthContext {
  if (!identity || !identity.sub) {
    throw new Error('Invalid identity: User not authenticated');
  }

  const claims = identity.claims || {};
  const permissions = claims['custom:permissions'] 
    ? claims['custom:permissions'].split(',') 
    : [];

  return {
    userId: identity.sub,
    tenantId: claims['custom:tenantId'],
    role: claims['custom:role'] as UserRole,
    permissions,
  };
}

/**
 * Check if user can access tenant data
 */
export function canAccessTenant(authContext: AuthContext, targetTenantId: string): boolean {
  // SystemAdmin can access any tenant
  if (authContext.role === 'SystemAdmin') {
    return true;
  }

  // Other users can only access their own tenant
  return authContext.tenantId === targetTenantId;
}

/**
 * Check if user has required permission
 */
export function hasPermission(authContext: AuthContext, permission: string): boolean {
  if (authContext.role === 'SystemAdmin') {
    return true;
  }

  return authContext.permissions.includes(permission);
}

/**
 * Check if user can manage projects in tenant
 */
export function canManageProjects(authContext: AuthContext, targetTenantId: string): boolean {
  if (!canAccessTenant(authContext, targetTenantId)) {
    return false;
  }

  const managerRoles: UserRole[] = ['ClientAdmin', 'ProjectManager'];
  return managerRoles.includes(authContext.role!) || authContext.role === 'SystemAdmin';
}

/**
 * Check if user can view tenant analytics
 */
export function canViewTenantAnalytics(authContext: AuthContext, targetTenantId: string): boolean {
  if (!canAccessTenant(authContext, targetTenantId)) {
    return false;
  }

  const viewerRoles: UserRole[] = ['ClientAdmin', 'ProjectManager', 'Analyst'];
  return viewerRoles.includes(authContext.role!) || authContext.role === 'SystemAdmin';
}