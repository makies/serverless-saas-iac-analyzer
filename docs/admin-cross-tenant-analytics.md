# Admin管理画面 - テナント横断分析機能設計

## 1. 概要

SystemAdminとFrameworkAdminが、テナントを横断した分析結果の集計・可視化・トレンド分析を行える管理機能を提供する。

### 目的
- **ビジネス洞察**: 全体的な利用状況とトレンドの把握
- **プロダクト改善**: フレームワーク利用状況に基づく機能改善
- **営業支援**: 顧客の成熟度とアップセル機会の特定
- **運用最適化**: リソース使用量の最適化とキャパシティプランニング

## 2. 分析ダッシュボード設計

### 2.1 メインダッシュボード

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Analytics Dashboard                   │
├─────────────────────────────────────────────────────────────────┤
│  🎯 Key Metrics (Last 30 Days)                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ Active      │ │ Total       │ │ Analysis    │ │ Avg Score │ │
│  │ Tenants     │ │ Analyses    │ │ Success     │ │ Improve   │ │
│  │    247      │ │   1,847     │ │   Rate      │ │   ment    │ │
│  │   (+12%)    │ │  (+156%)    │ │   94.2%     │ │   +8.3%   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  📊 Framework Usage Distribution                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ████████████ Well-Architected (85%)                    │   │
│  │ ████████ Serverless Lens (65%)                         │   │
│  │ ██████ Security Hub CSPM (45%)                         │   │
│  │ ████ SaaS Lens (32%)                                   │   │
│  │ ███ SDP Best Practices (28%)                           │   │
│  │ ██ ML Lens (18%)                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  📈 Trend Analysis                    🏆 Top Performing       │
│  ┌─────────────────────────────────┐  ┌─────────────────────┐ │
│  │ Monthly Analysis Volume         │  │ Tenants by Score    │ │
│  │      ▲                          │  │ 1. TechCorp (94.2%) │ │
│  │    ▲   ▲                        │  │ 2. DataFlow (92.8%) │ │
│  │  ▲       ▲                      │  │ 3. CloudPro (91.5%) │ │
│  │▲           ▲                    │  │ 4. DevOps+ (89.7%)  │ │
│  │Jan Feb Mar Apr May Jun          │  │ 5. ScaleTech (88.2%)│ │
│  └─────────────────────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 詳細分析画面

#### Framework Adoption Analysis
```
┌─────────────────────────────────────────────────────────────────┐
│                 Framework Adoption Analysis                    │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [All Tenants ▼] [Last 6 Months ▼] [All Industries ▼] │
├─────────────────────────────────────────────────────────────────┤
│  📊 Adoption Rate by Framework                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Q1    Q2    Q3    Q4   Trend         │   │
│  │ Well-Architected  ████████████████████  ↗ +15%         │   │
│  │ Serverless Lens   ███████████████       ↗ +42%         │   │
│  │ Security CSPM     ██████████            ↗ +67%         │   │
│  │ SaaS Lens         ██████                ↗ +89%         │   │
│  │ SDP Practices     ████                  ↗ +125%        │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  🎯 Framework Effectiveness (Score Improvement)                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Security CSPM:     Initial: 72.3% → Current: 84.1%     │   │
│  │ Serverless Lens:   Initial: 76.8% → Current: 85.2%     │   │
│  │ Well-Architected:  Initial: 81.2% → Current: 87.9%     │   │
│  │ SaaS Lens:         Initial: 69.4% → Current: 79.6%     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Tenant Performance Matrix
```
┌─────────────────────────────────────────────────────────────────┐
│                    Tenant Performance Matrix                   │
├─────────────────────────────────────────────────────────────────┤
│  High Usage │ TechCorp        │ DataFlow       │ CloudPro      │
│  High Score │ (Enterprise)    │ (Growth)       │ (Enterprise)  │
│             │ Score: 94.2%    │ Score: 92.8%   │ Score: 91.5%  │
│             │ Analyses: 47/mo │ Analyses: 23/mo│ Analyses: 31/mo│
├─────────────┼─────────────────┼────────────────┼───────────────┤
│  High Usage │ StartupFast     │ WebScale       │ MicroServ     │
│  Low Score  │ (Startup)       │ (Growth)       │ (Startup)     │
│             │ Score: 67.2%    │ Score: 71.8%   │ Score: 69.4%  │
│             │ Analyses: 19/mo │ Analyses: 15/mo│ Analyses: 12/mo│
├─────────────┼─────────────────┼────────────────┼───────────────┤
│  Low Usage  │ Enterprise123   │ LegacyTech     │ SlowAdopt     │
│  High Score │ (Enterprise)    │ (Enterprise)   │ (Growth)      │
│             │ Score: 88.7%    │ Score: 86.3%   │ Score: 84.9%  │
│             │ Analyses: 4/mo  │ Analyses: 2/mo │ Analyses: 3/mo│
├─────────────┼─────────────────┼────────────────┼───────────────┤
│  Low Usage  │ TrialUser1      │ InactiveInc    │ ChurnRisk     │
│  Low Score  │ (Trial)         │ (Growth)       │ (Startup)     │
│             │ Score: 58.2%    │ Score: 61.4%   │ Score: 54.1%  │
│             │ Analyses: 1/mo  │ Analyses: 1/mo │ Analyses: 0/mo│
└─────────────┴─────────────────┴────────────────┴───────────────┘
```

## 3. データモデル設計

### 3.1 集計用テーブル設計

**TenantAnalytics Table**
```json
{
  "pk": "TENANT_ANALYTICS#tenant-123",
  "sk": "MONTH#2024-01",
  "tenantId": "tenant-123",
  "tenantName": "TechCorp Ltd",
  "industry": "Technology",
  "tier": "Enterprise",
  "period": "2024-01",
  "metrics": {
    "analysisCount": 47,
    "avgScore": 94.2,
    "scoreImprovement": 8.3,
    "frameworkUsage": {
      "well-architected": { "count": 47, "avgScore": 94.2 },
      "serverless": { "count": 32, "avgScore": 91.8 },
      "security-cspm": { "count": 28, "avgScore": 96.1 }
    },
    "pillarScores": {
      "operational-excellence": 92.1,
      "security": 96.3,
      "reliability": 94.8,
      "performance": 93.2,
      "cost": 91.7,
      "sustainability": 89.4
    },
    "findingsByCategory": {
      "critical": 2,
      "high": 8,
      "medium": 15,
      "low": 23,
      "info": 41
    }
  },
  "comparisonMetrics": {
    "industryPercentile": 87,
    "tierPercentile": 92,
    "overallPercentile": 89
  },
  "GSI1PK": "MONTH#2024-01",
  "GSI1SK": "INDUSTRY#Technology#SCORE#94.2",
  "GSI2PK": "TIER#Enterprise",
  "GSI2SK": "SCORE#94.2#TENANT#tenant-123"
}
```

**GlobalAnalytics Table**
```json
{
  "pk": "GLOBAL_ANALYTICS",
  "sk": "MONTH#2024-01",
  "period": "2024-01",
  "totalTenants": 247,
  "activeTenants": 189,
  "totalAnalyses": 1847,
  "avgScore": 82.4,
  "frameworkAdoption": {
    "well-architected": { "tenants": 209, "percentage": 84.6 },
    "serverless": { "tenants": 161, "percentage": 65.2 },
    "security-cspm": { "tenants": 111, "percentage": 44.9 }
  },
  "industryBreakdown": {
    "Technology": { "tenants": 78, "avgScore": 85.2 },
    "Financial": { "tenants": 45, "avgScore": 88.7 },
    "Healthcare": { "tenants": 32, "avgScore": 91.3 },
    "Retail": { "tenants": 28, "avgScore": 79.8 }
  },
  "tierBreakdown": {
    "Enterprise": { "tenants": 67, "avgScore": 89.2 },
    "Growth": { "tenants": 102, "avgScore": 81.7 },
    "Startup": { "tenants": 58, "avgScore": 75.3 },
    "Trial": { "tenants": 20, "avgScore": 68.1 }
  }
}
```

## 4. API設計

### 4.1 Analytics API

```typescript
// GET /admin/analytics/dashboard
interface DashboardMetricsResponse {
  keyMetrics: {
    activeTenants: number;
    totalAnalyses: number;
    successRate: number;
    avgScoreImprovement: number;
    trends: {
      activeTenants: number; // % change
      totalAnalyses: number;
      successRate: number;
      avgScoreImprovement: number;
    };
  };
  frameworkUsage: {
    frameworkId: string;
    name: string;
    adoptionRate: number;
    tenantCount: number;
    trend: number;
  }[];
  topPerformingTenants: {
    tenantId: string;
    tenantName: string;
    avgScore: number;
    tier: string;
  }[];
}

// GET /admin/analytics/tenants
interface TenantAnalyticsResponse {
  tenants: {
    tenantId: string;
    tenantName: string;
    industry: string;
    tier: string;
    metrics: {
      analysisCount: number;
      avgScore: number;
      scoreImprovement: number;
      lastAnalysis: string;
    };
    usageCategory: 'high-usage-high-score' | 'high-usage-low-score' | 
                   'low-usage-high-score' | 'low-usage-low-score';
    riskLevel: 'low' | 'medium' | 'high' | 'churn-risk';
  }[];
  aggregates: {
    byIndustry: Record<string, { count: number; avgScore: number }>;
    byTier: Record<string, { count: number; avgScore: number }>;
    byUsageCategory: Record<string, number>;
  };
}

// GET /admin/analytics/frameworks
interface FrameworkAnalyticsResponse {
  frameworks: {
    frameworkId: string;
    name: string;
    adoption: {
      currentTenants: number;
      adoptionRate: number;
      quarterlyGrowth: number;
    };
    effectiveness: {
      avgInitialScore: number;
      avgCurrentScore: number;
      improvement: number;
    };
    usage: {
      totalAnalyses: number;
      avgAnalysesPerTenant: number;
      peakUsageMonth: string;
    };
  }[];
  trends: {
    adoptionTrend: { period: string; adoptionRate: number }[];
    effectivenessTrend: { period: string; avgImprovement: number }[];
  };
}
```

### 4.2 レポート生成API

```typescript
// POST /admin/reports/generate
interface GenerateAdminReportRequest {
  reportType: 'tenant-performance' | 'framework-adoption' | 'industry-analysis' | 'comprehensive';
  period: {
    start: string; // ISO date
    end: string;
  };
  filters: {
    industries?: string[];
    tiers?: string[];
    frameworks?: string[];
    minAnalysisCount?: number;
  };
  format: 'pdf' | 'excel' | 'json';
  includeCharts: boolean;
  includeTenantDetails: boolean; // 個別テナント詳細を含むか
}

interface AdminReportResponse {
  reportId: string;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  generatedAt: string;
  expiresAt: string;
}
```

## 5. セキュリティ・プライバシー考慮事項

### 5.1 データアクセス制御
```typescript
// Role-based access control
const ADMIN_PERMISSIONS = {
  SystemAdmin: [
    'view:all-tenant-analytics',
    'view:individual-tenant-details',
    'export:detailed-reports',
    'view:financial-metrics'
  ],
  FrameworkAdmin: [
    'view:framework-analytics',
    'view:aggregated-tenant-metrics',
    'export:framework-reports'
  ]
} as const;

// Data anonymization levels
interface DataAnonymizationConfig {
  level: 'none' | 'partial' | 'full';
  anonymizeTenantNames: boolean;
  anonymizeIndustryDetails: boolean;
  aggregateSmallGroups: boolean; // <5 tenants
  excludeFinancialData: boolean;
}
```

### 5.2 データプライバシー保護
- **テナント名の匿名化**: 必要に応じてテナント名をマスク
- **小規模グループの集約**: 5テナント未満の業界等は「その他」に集約
- **個人情報の除外**: 担当者名等の個人情報は一切含めない
- **データ保持期間**: 集計データは2年間保持、詳細データは1年間

## 6. 実装優先度

### Phase 1: 基本ダッシュボード (2週間)
- [ ] メインダッシュボードUI実装
- [ ] 基本メトリクス表示
- [ ] テナント一覧・検索機能

### Phase 2: 詳細分析 (3週間)
- [ ] Framework adoption analysis
- [ ] Tenant performance matrix
- [ ] トレンド分析機能

### Phase 3: レポート機能 (2週間)
- [ ] PDF/Excel レポート生成
- [ ] スケジュール配信機能
- [ ] カスタムレポート作成

### Phase 4: 高度分析 (3週間)
- [ ] 予測分析（チャーンリスク等）
- [ ] ベンチマーク機能
- [ ] アラート・通知機能

## 7. ビジネス価値

### 7.1 運用効率化
- **顧客成功**: 早期のリスク検知とプロアクティブサポート
- **プロダクト改善**: データドリブンな機能開発
- **営業支援**: アップセル機会の特定

### 7.2 戦略的洞察
- **市場理解**: 業界別の利用パターン分析
- **競争優位**: 顧客の成熟度に応じたサービス提供
- **価格最適化**: 利用状況に基づく価格戦略