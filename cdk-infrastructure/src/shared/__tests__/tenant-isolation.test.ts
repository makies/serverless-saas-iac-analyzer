import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  validateTenantContext,
  hasPermission,
  checkProjectAccess,
  generateTenantS3Key,
  auditLog,
} from '../utils/tenant-isolation';
import { TenantContext, UserRole, Permission } from '../types/tenant-context';

describe('テナント分離機能のテスト', () => {
  const mockTenantContext: TenantContext = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    userRole: UserRole.PROJECT_MANAGER,
    permissions: [
      Permission.VIEW_PROJECTS,
      Permission.MANAGE_PROJECTS,
      Permission.RUN_ANALYSIS,
      Permission.VIEW_ANALYSIS,
    ],
    sessionId: 'session-789',
    clientIp: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date().toISOString(),
  };

  describe('validateTenantContext', () => {
    test('有効なテナントコンテキストの検証', () => {
      const result = validateTenantContext(mockTenantContext);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.accessLevel).toBe('FULL');
    });

    test('無効なテナントIDの検証', () => {
      const invalidContext = {
        ...mockTenantContext,
        tenantId: '',
      };

      const result = validateTenantContext(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Missing or empty tenantId');
      expect(result.accessLevel).toBe('DENIED');
    });

    test('無効なユーザーロールの検証', () => {
      const invalidContext = {
        ...mockTenantContext,
        userRole: 'InvalidRole' as UserRole,
      };

      const result = validateTenantContext(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Invalid user role: InvalidRole');
    });

    test('テナントID形式の検証', () => {
      const invalidContext = {
        ...mockTenantContext,
        tenantId: 'tenant@123!',
      };

      const result = validateTenantContext(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Invalid tenantId format');
    });
  });

  describe('hasPermission', () => {
    test('有効な権限のチェック', () => {
      const result = hasPermission(mockTenantContext, Permission.VIEW_PROJECTS);

      expect(result).toBe(true);
    });

    test('無効な権限のチェック', () => {
      const result = hasPermission(mockTenantContext, Permission.MANAGE_TENANTS);

      expect(result).toBe(false);
    });
  });

  describe('checkProjectAccess', () => {
    test('同一テナント内のプロジェクトアクセス', () => {
      const projectAccess = checkProjectAccess(mockTenantContext, 'project-123', 'tenant-123', [
        'user-456',
      ]);

      expect(projectAccess.accessLevel).toBe('FULL');
      expect(projectAccess.canModify).toBe(true);
      expect(projectAccess.canDelete).toBe(false); // PROJECT_MANAGERは削除不可
      expect(projectAccess.canInviteUsers).toBe(true);
    });

    test('異なるテナントのプロジェクトアクセス拒否', () => {
      const projectAccess = checkProjectAccess(
        mockTenantContext,
        'project-123',
        'different-tenant',
        []
      );

      expect(projectAccess.accessLevel).toBe('NO_ACCESS');
      expect(projectAccess.canModify).toBe(false);
      expect(projectAccess.canDelete).toBe(false);
      expect(projectAccess.canInviteUsers).toBe(false);
    });

    test('SystemAdminの全テナントアクセス', () => {
      const adminContext = {
        ...mockTenantContext,
        userRole: UserRole.SYSTEM_ADMIN,
      };

      const projectAccess = checkProjectAccess(adminContext, 'project-123', 'different-tenant', []);

      expect(projectAccess.accessLevel).toBe('FULL');
    });

    test('Viewerの読み取り専用アクセス', () => {
      const viewerContext = {
        ...mockTenantContext,
        userRole: UserRole.VIEWER,
        permissions: [Permission.VIEW_PROJECTS],
      };

      const projectAccess = checkProjectAccess(viewerContext, 'project-123', 'tenant-123', []);

      expect(projectAccess.accessLevel).toBe('READ_ONLY');
      expect(projectAccess.canModify).toBe(false);
      expect(projectAccess.canDelete).toBe(false);
      expect(projectAccess.canInviteUsers).toBe(false);
    });
  });

  describe('generateTenantS3Key', () => {
    test('テナントプレフィックス付きS3キーの生成', () => {
      const s3Key = generateTenantS3Key('tenant-123', 'uploads', 'file.json');

      expect(s3Key).toBe('tenant-123/uploads/file.json');
    });

    test('特殊文字を含むテナントIDのサニタイズ', () => {
      const s3Key = generateTenantS3Key('tenant@123!', 'uploads', 'file.json');

      expect(s3Key).toBe('tenant123/uploads/file.json');
    });

    test('空のパスパーツの処理', () => {
      const s3Key = generateTenantS3Key('tenant-123');

      expect(s3Key).toBe('tenant-123');
    });
  });

  describe('auditLog', () => {
    test('監査ログの出力', () => {
      // auditLog関数を実行
      auditLog(mockTenantContext, 'CREATE_PROJECT', 'PROJECT', 'project-123', 'SUCCESS', {
        additionalInfo: 'test',
      });

      // auditLogが正常に完了することを確認
      // logger.infoはjest.setup.jsでモックされているため、実際のログ出力はされない
      expect(true).toBe(true); // 関数が例外なく実行されることを確認
    });
  });

  describe('ユーザーロール別権限テスト', () => {
    test('ClientAdminの権限確認', () => {
      const clientAdminContext = {
        ...mockTenantContext,
        userRole: UserRole.CLIENT_ADMIN,
        permissions: [
          Permission.MANAGE_PROJECTS,
          Permission.CREATE_PROJECTS,
          Permission.RUN_ANALYSIS,
          Permission.MANAGE_USERS,
        ],
      };

      expect(hasPermission(clientAdminContext, Permission.MANAGE_PROJECTS)).toBe(true);
      expect(hasPermission(clientAdminContext, Permission.MANAGE_TENANTS)).toBe(false);
      expect(hasPermission(clientAdminContext, Permission.CROSS_TENANT_ANALYTICS)).toBe(false);
    });

    test('Analystの権限確認', () => {
      const analystContext = {
        ...mockTenantContext,
        userRole: UserRole.ANALYST,
        permissions: [
          Permission.VIEW_PROJECTS,
          Permission.RUN_ANALYSIS,
          Permission.VIEW_ANALYSIS,
          Permission.GENERATE_REPORTS,
        ],
      };

      expect(hasPermission(analystContext, Permission.RUN_ANALYSIS)).toBe(true);
      expect(hasPermission(analystContext, Permission.MANAGE_PROJECTS)).toBe(false);
      expect(hasPermission(analystContext, Permission.DELETE_PROJECTS)).toBe(false);
    });

    test('ClientEngineerの制限された権限', () => {
      const clientEngineerContext = {
        ...mockTenantContext,
        userRole: UserRole.CLIENT_ENGINEER,
        permissions: [
          Permission.VIEW_PROJECTS,
          Permission.VIEW_ANALYSIS,
          Permission.VIEW_REPORTS,
          Permission.DOWNLOAD_REPORTS,
        ],
      };

      expect(hasPermission(clientEngineerContext, Permission.VIEW_PROJECTS)).toBe(true);
      expect(hasPermission(clientEngineerContext, Permission.RUN_ANALYSIS)).toBe(false);
      expect(hasPermission(clientEngineerContext, Permission.MANAGE_PROJECTS)).toBe(false);
    });
  });

  describe('セキュリティテスト', () => {
    test('クロステナントアクセスの防止', () => {
      const maliciousContext = {
        ...mockTenantContext,
        tenantId: 'attacker-tenant',
      };

      const projectAccess = checkProjectAccess(
        maliciousContext,
        'victim-project',
        'victim-tenant',
        []
      );

      expect(projectAccess.accessLevel).toBe('NO_ACCESS');
    });

    test('権限昇格の防止', () => {
      const limitedUserContext = {
        ...mockTenantContext,
        userRole: UserRole.VIEWER,
        permissions: [Permission.VIEW_PROJECTS], // 本来の権限のみ
      };

      // MANAGE_PROJECTSを要求しても拒否されるべき
      expect(hasPermission(limitedUserContext, Permission.MANAGE_PROJECTS)).toBe(false);
      expect(hasPermission(limitedUserContext, Permission.DELETE_PROJECTS)).toBe(false);
      expect(hasPermission(limitedUserContext, Permission.MANAGE_USERS)).toBe(false);
    });

    test('セッション検証の必須チェック', () => {
      const noSessionContext = {
        ...mockTenantContext,
        sessionId: '',
      };

      const result = validateTenantContext(noSessionContext);
      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Missing or empty sessionId');
    });
  });
});
