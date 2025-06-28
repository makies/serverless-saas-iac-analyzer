import { useState, useEffect } from 'react';
import { getCurrentUser, fetchAuthSession, AuthUser } from 'aws-amplify/auth';

interface UserProfile extends AuthUser {
  tenantId?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      // Extract custom attributes from JWT token
      const idToken = session.tokens?.idToken;
      const tenantId = idToken?.payload['custom:tenantId'] as string;
      const role = idToken?.payload['custom:role'] as string;
      const firstName = idToken?.payload['given_name'] as string;
      const lastName = idToken?.payload['family_name'] as string;

      setUser({
        ...currentUser,
        tenantId,
        role,
        firstName,
        lastName
      });
      setError(null);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (requiredRole: string): boolean => {
    if (!user?.role) return false;

    const roleHierarchy = {
      'SYSTEM_ADMIN': 5,
      'CLIENT_ADMIN': 4,
      'PROJECT_MANAGER': 3,
      'ANALYST': 2,
      'VIEWER': 1,
      'CLIENT_ENGINEER': 1
    };

    const userRoleLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

    return userRoleLevel >= requiredRoleLevel;
  };

  const isTenantAdmin = (): boolean => {
    return user?.role === 'SYSTEM_ADMIN' || user?.role === 'CLIENT_ADMIN';
  };

  const isSystemAdmin = (): boolean => {
    return user?.role === 'SYSTEM_ADMIN';
  };

  return {
    user,
    loading,
    error,
    hasPermission,
    isTenantAdmin,
    isSystemAdmin,
    refreshAuth: checkAuthState
  };
}