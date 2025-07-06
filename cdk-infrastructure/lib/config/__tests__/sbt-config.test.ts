import { describe, test, expect } from '@jest/globals';
import {
  sbtBasicTierConfig,
  validateBasicTierUsage,
  validateFileSize,
  type UsageLimits,
} from '../sbt-config';

describe('SBT Basic Tier設定テスト', () => {
  describe('基本設定の確認', () => {
    test('Basic Tier制約の設定値', () => {
      expect(sbtBasicTierConfig.constraints.maxAnalysesPerMonth).toBe(100);
      expect(sbtBasicTierConfig.constraints.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
      expect(sbtBasicTierConfig.constraints.dataRetentionDays).toBe(90);
      expect(sbtBasicTierConfig.constraints.enableBilling).toBe(false);
    });

    test('セキュリティ設定の確認', () => {
      expect(sbtBasicTierConfig.security.enableMFA).toBe(true);
      expect(sbtBasicTierConfig.security.requireStrongPasswords).toBe(true);
      expect(sbtBasicTierConfig.security.enableAuditLogs).toBe(true);
    });

    test('データ分離設定の確認', () => {
      expect(sbtBasicTierConfig.dataIsolation.model).toBe('POOL');
      expect(sbtBasicTierConfig.dataIsolation.enableRowLevelSecurity).toBe(true);
      expect(sbtBasicTierConfig.dataIsolation.enableEncryption).toBe(true);
    });

    test('テナント管理設定の確認', () => {
      expect(sbtBasicTierConfig.tenantManagement.enableAutoOnboarding).toBe(false);
      expect(sbtBasicTierConfig.tenantManagement.requireApproval).toBe(true);
      expect(sbtBasicTierConfig.tenantManagement.defaultTier).toBe('basic');
    });
  });

  describe('使用量制限の検証', () => {
    test('制限内の使用量', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 50,
        totalStorageBytes: 5 * 1024 * 1024 * 1024, // 5GB
        oldestDataDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30日前
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('月間分析回数制限の超過', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 101, // 制限を超過
        totalStorageBytes: 1024 * 1024, // 1MB
        oldestDataDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Monthly analysis limit exceeded: 101/100');
    });

    test('データ保存期間の超過', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 50,
        totalStorageBytes: 1024 * 1024,
        oldestDataDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100日前
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('Data retention period exceeded');
    });

    test('複数の制限違反', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 150, // 制限超過
        totalStorageBytes: 15 * 1024 * 1024 * 1024, // 15GB (制限超過)
        oldestDataDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120日前
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
    });

    test('制限値ちょうどの使用量', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 100, // 制限値ちょうど
        totalStorageBytes: 1024 * 1024,
        oldestDataDate: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000), // 89日前
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(false); // 100回以上は制限違反
      expect(result.violations).toContain('Monthly analysis limit exceeded: 100/100');
    });

    test('制限値未満の使用量', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 99, // 制限値未満
        totalStorageBytes: 1024 * 1024,
        oldestDataDate: new Date(Date.now() - 88 * 24 * 60 * 60 * 1000), // 88日前
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('ファイルサイズ制限の検証', () => {
    test('制限内のファイルサイズ', () => {
      const fileSizeBytes = 5 * 1024 * 1024; // 5MB

      const result = validateFileSize(fileSizeBytes);

      expect(result.isValid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    test('制限を超過するファイルサイズ', () => {
      const fileSizeBytes = 15 * 1024 * 1024; // 15MB

      const result = validateFileSize(fileSizeBytes);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('File size 15MB exceeds limit of 10MB');
    });

    test('制限値ちょうどのファイルサイズ', () => {
      const fileSizeBytes = 10 * 1024 * 1024; // 10MB

      const result = validateFileSize(fileSizeBytes);

      expect(result.isValid).toBe(true);
    });

    test('ゼロバイトファイル', () => {
      const fileSizeBytes = 0;

      const result = validateFileSize(fileSizeBytes);

      expect(result.isValid).toBe(true);
    });

    test('非常に大きなファイル', () => {
      const fileSizeBytes = 100 * 1024 * 1024; // 100MB

      const result = validateFileSize(fileSizeBytes);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('File size 100MB exceeds limit of 10MB');
    });
  });

  describe('エッジケースのテスト', () => {
    test('未来の日付での検証', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 50,
        totalStorageBytes: 1024 * 1024,
        oldestDataDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 明日
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(true); // 未来の日付は問題なし
    });

    test('ゼロ使用量での検証', () => {
      const usage: UsageLimits = {
        analysesThisMonth: 0,
        totalStorageBytes: 0,
        oldestDataDate: new Date(), // 今日
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('負の値での検証', () => {
      const usage: UsageLimits = {
        analysesThisMonth: -1,
        totalStorageBytes: -1000,
        oldestDataDate: new Date(),
      };

      const result = validateBasicTierUsage(usage);

      expect(result.isValid).toBe(true); // 負の値は問題として扱わない
    });
  });

  describe('カスタム設定での検証', () => {
    test('カスタム制限設定での検証', () => {
      const customConfig = {
        ...sbtBasicTierConfig,
        constraints: {
          ...sbtBasicTierConfig.constraints,
          maxAnalysesPerMonth: 50, // より厳しい制限
          dataRetentionDays: 30, // より短い保存期間
        },
      };

      const usage: UsageLimits = {
        analysesThisMonth: 60,
        totalStorageBytes: 1024 * 1024,
        oldestDataDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45日前
      };

      const result = validateBasicTierUsage(usage, customConfig);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});
