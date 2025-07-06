/**
 * AWS SaaS Builder Toolkit (SBT) Basic Tier Configuration
 *
 * Basic Tier Constraints:
 * - 月100回分析まで (100 analyses per month)
 * - 10MBファイル制限 (10MB file limit)
 * - 90日保存 (90 days retention)
 * - 課金機能は使用しない (No billing features)
 */

export interface SBTBasicTierConfig {
  // Basic Tier制約設定
  readonly constraints: {
    maxAnalysesPerMonth: number;
    maxFileSize: number; // bytes
    dataRetentionDays: number;
    enableBilling: boolean;
  };

  // テナント管理設定
  readonly tenantManagement: {
    enableAutoOnboarding: boolean;
    requireApproval: boolean;
    defaultTier: string;
    maxTenantsPerAccount: number;
  };

  // セキュリティ設定
  readonly security: {
    enableMFA: boolean;
    requireStrongPasswords: boolean;
    sessionTimeoutMinutes: number;
    enableAuditLogs: boolean;
  };

  // データ分離設定 (Pool Model)
  readonly dataIsolation: {
    model: 'POOL' | 'BRIDGE' | 'SILO';
    enableRowLevelSecurity: boolean;
    enableEncryption: boolean;
  };
}

export const sbtBasicTierConfig: SBTBasicTierConfig = {
  constraints: {
    maxAnalysesPerMonth: 100,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    dataRetentionDays: 90,
    enableBilling: false,
  },

  tenantManagement: {
    enableAutoOnboarding: false, // 手動承認必須
    requireApproval: true,
    defaultTier: 'basic',
    maxTenantsPerAccount: 50, // Basic tierの制限
  },

  security: {
    enableMFA: true, // MFA必須
    requireStrongPasswords: true,
    sessionTimeoutMinutes: 60,
    enableAuditLogs: true,
  },

  dataIsolation: {
    model: 'POOL', // DynamoDB Pool Model
    enableRowLevelSecurity: true,
    enableEncryption: true,
  },
};

/**
 * テナント使用量制限のチェック関数
 */
export interface UsageLimits {
  analysesThisMonth: number;
  totalStorageBytes: number;
  oldestDataDate: Date;
}

export function validateBasicTierUsage(
  usage: UsageLimits,
  config: SBTBasicTierConfig = sbtBasicTierConfig
): { isValid: boolean; violations: string[] } {
  const violations: string[] = [];

  // 月間分析回数チェック
  if (usage.analysesThisMonth >= config.constraints.maxAnalysesPerMonth) {
    violations.push(
      `Monthly analysis limit exceeded: ${usage.analysesThisMonth}/${config.constraints.maxAnalysesPerMonth}`
    );
  }

  // データ保存期間チェック
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - config.constraints.dataRetentionDays);

  if (usage.oldestDataDate < retentionCutoff) {
    violations.push(
      `Data retention period exceeded: oldest data from ${usage.oldestDataDate.toISOString()}`
    );
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * ファイルサイズ制限チェック
 */
export function validateFileSize(
  fileSizeBytes: number,
  config: SBTBasicTierConfig = sbtBasicTierConfig
): { isValid: boolean; message?: string } {
  if (fileSizeBytes > config.constraints.maxFileSize) {
    return {
      isValid: false,
      message: `File size ${Math.round(fileSizeBytes / 1024 / 1024)}MB exceeds limit of ${Math.round(config.constraints.maxFileSize / 1024 / 1024)}MB`,
    };
  }

  return { isValid: true };
}
