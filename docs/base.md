# Serverless SaaS IaC Analyzer - 詳細要件定義

## プロジェクト概要

### 目的
既存のWell-Architected IaC AnalyzerをマルチテナントSaaSとして再構築し、コンサルティング案件ごとのデータ分離とアクセス制御を実現する。

### アプローチ
- **Minimum Start**: コスト効率重視、段階的機能拡張
- **Serverless First**: 運用負荷最小化、自動スケーリング
- **Security First**: 完全なテナント分離、厳密なアクセス制御

## アーキテクチャ要件

### 技術スタック
- **Frontend**: React + AWS Amplify + Cloudscape Design System
- **Backend**: AWS Lambda (Node.js 20.x TypeScript) ← 最新ランタイム
- **Infrastructure**: AWS CDK v2 (TypeScript) + eslint-cdk-plugin
- **AI Engine**: Amazon Bedrock (Claude 3.5 Sonnet)
- **Multi-tenancy**: AWS SaaS Builder Toolkit (Basic Tier)
- **Database**: DynamoDB (Pool Model with tenant_id partition)
- **Storage**: S3 (Tenant-based prefix isolation)
- **API**: API Gateway (REST) + Lambda Authorizer
- **Authentication**: Amazon Cognito User Pool
- **Development**: TypeScript 5.x + ESLint + Prettier + Jest

### データ分離戦略

#### DynamoDB Pool Model
- **Primary Key**: tenant_id
- **Sort Key**: item_id (analysis_id, project_id, user_id)
- **GSI**: tenant_id + item_type for queries

#### S3 Isolation
- **Bucket Structure**: `{bucket-name}/{tenant_id}/{project_id}/{file_type}/`
- **IAM Policies**: Path-based access control
- **Presigned URLs**: Time-limited access

#### Lambda Security
- Tenant Context Validation in every function
- Row-level security enforcement
- Comprehensive logging for audit trail

## 機能要件詳細

### 1. マルチテナント管理

#### 1.1 テナント構造
```typescript
interface Tenant {
  tenant_id: string;          // Primary identifier
  company_name: string;       // 顧客企業名
  domain: string;            // メールドメイン制限
  subscription_tier: 'basic'; // Basic tierのみ
  settings: {
    max_analyses_per_month: 100;
    max_file_size_mb: 10;
    retention_days: 90;
    features: string[];      // 利用可能機能一覧
  };
  created_at: string;
  status: 'active' | 'inactive';
}
```

#### 1.2 プロジェクト管理
```typescript
interface Project {
  tenant_id: string;         // テナント識別子
  project_id: string;        // プロジェクト識別子
  name: string;             // プロジェクト名
  description?: string;     // プロジェクト説明
  aws_accounts: {           // 管理対象AWSアカウント
    account_id: string;
    account_name: string;
    role_arn: string;       // Cross-account access role
    external_id?: string;   // セキュリティ強化用
  }[];
  assigned_users: {         // アサインユーザー
    user_id: string;
    role: UserRole;
    assigned_at: string;
  }[];
  client_access: {          // 顧客アクセス設定
    enabled: boolean;
    allowed_users: string[]; // 顧客側ユーザーID
  };
  created_at: string;
  updated_at: string;
  status: 'active' | 'archived';
}
```

### 2. ユーザー管理・アクセス制御

#### 2.1 ユーザーロール定義
```typescript
enum UserRole {
  SYSTEM_ADMIN = 'system_admin',      // 全システム管理
  CLIENT_ADMIN = 'client_admin',      // 自社テナント管理
  PROJECT_MANAGER = 'project_manager', // 担当案件管理
  ANALYST = 'analyst',                // 担当案件分析実行
  VIEWER = 'viewer',                  // 担当案件閲覧のみ
  CLIENT_ENGINEER = 'client_engineer' // 顧客エンジニア
}

interface User {
  user_id: string;
  tenant_id: string;        // 所属テナント
  email: string;
  role: UserRole;
  assigned_projects: string[]; // アサインプロジェクト一覧
  mfa_enabled: boolean;     // MFA設定状況
  last_login: string;
  created_at: string;
  status: 'active' | 'inactive' | 'invited';
}
```

#### 2.2 権限マトリックス
| Role            | Tenant Admin | Project CRUD | Analysis Execute | Cross-Tenant View | Account Scan |
|-----------------|--------------|--------------|------------------|-------------------|--------------|
| SystemAdmin     | All          | All          | All              | All              | All          |
| ClientAdmin     | Own          | Own Tenant   | Own Tenant       | None             | Own Tenant   |
| ProjectManager  | None         | Assigned     | Assigned         | None             | Assigned     |
| Analyst         | None         | Read Only    | Assigned         | None             | Assigned     |
| Viewer          | None         | Read Only    | None             | None             | None         |
| ClientEngineer  | None         | Read Only    | None             | None             | None         |

### 3. IaC分析機能

#### 3.1 対応フォーマット
```typescript
enum IaCFormat {
  CLOUDFORMATION_JSON = 'cloudformation-json',
  CLOUDFORMATION_YAML = 'cloudformation-yaml', 
  TERRAFORM_HCL = 'terraform-hcl',
  TERRAFORM_JSON = 'terraform-json',
  CDK_TYPESCRIPT = 'cdk-typescript',
  CDK_PYTHON = 'cdk-python'
}

interface AnalysisRequest {
  tenant_id: string;
  project_id: string;
  file_metadata: {
    filename: string;
    size_bytes: number;
    format: IaCFormat;
    upload_timestamp: string;
  };
  analysis_options: {
    pillars: WellArchitectedPillar[];
    severity_filter: 'all' | 'medium_high' | 'high_critical';
    generate_report: boolean;
  };
  requested_by: string;     // User ID
}
```

#### 3.2 Well-Architected Framework分析
```typescript
enum WellArchitectedPillar {
  OPERATIONAL_EXCELLENCE = 'operational_excellence',
  SECURITY = 'security',
  RELIABILITY = 'reliability', 
  PERFORMANCE_EFFICIENCY = 'performance_efficiency',
  COST_OPTIMIZATION = 'cost_optimization',
  SUSTAINABILITY = 'sustainability'
}

interface AnalysisResult {
  analysis_id: string;
  tenant_id: string;
  project_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pillar_scores: Record<WellArchitectedPillar, {
    score: number;           // 0-100
    max_score: 100;
    findings: Finding[];
    recommendations: Recommendation[];
  }>;
  overall_score: number;     // 総合スコア
  processing_time_seconds: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

interface Finding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pillar: WellArchitectedPillar;
  title: string;
  description: string;
  affected_resources: string[];
  line_numbers?: number[];   // ファイル内行番号
  remediation_steps: string[];
  aws_documentation_links: string[];
}

interface Recommendation {
  id: string;
  priority: 'low' | 'medium' | 'high';
  pillar: WellArchitectedPillar;
  title: string;
  description: string;
  implementation_guide: string;
  effort_estimate: 'low' | 'medium' | 'high';
  business_impact: 'low' | 'medium' | 'high';
  cost_impact: 'decrease' | 'neutral' | 'increase';
}
```

### 4. ライブアカウントスキャン

#### 4.1 Cross-Account Access
```typescript
interface AccountScanRequest {
  tenant_id: string;
  project_id: string;
  aws_account_id: string;
  scan_scope: {
    regions: string[];       // 対象リージョン
    services: AWSService[];  // 対象サービス
    resource_types: string[];
  };
  requested_by: string;
}

interface ScanResult {
  scan_id: string;
  tenant_id: string;
  project_id: string;
  aws_account_id: string;
  status: 'running' | 'completed' | 'failed';
  findings: {
    security_issues: SecurityFinding[];
    cost_optimization: CostFinding[];
    performance_issues: PerformanceFinding[];
    compliance_violations: ComplianceFinding[];
  };
  resource_inventory: ResourceInventory;
  scan_duration_minutes: number;
  created_at: string;
  completed_at?: string;
}
```

#### 4.2 必要IAM権限（Read-Only）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:GetBucket*",
        "s3:ListBucket*",
        "iam:Get*",
        "iam:List*",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "cloudtrail:DescribeTrails",
        "config:GetComplianceDetailsByConfigRule",
        "config:DescribeConfigRules",
        "trustedadvisor:Describe*",
        "support:DescribeTrustedAdvisorChecks"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5. フロントエンド要件

#### 5.1 画面構成
```
┌─ Header (固定)
│  ├─ Logo & App Name
│  ├─ Project Switcher (権限に応じた案件一覧)
│  ├─ User Menu (Profile, Settings, Logout)
│  └─ Notifications
│
├─ Sidebar Navigation
│  ├─ Dashboard
│  ├─ Analysis
│  ├─ Reports  
│  ├─ Account Scan
│  ├─ Projects (管理権限のみ)
│  └─ Admin (SystemAdmin のみ)
│
└─ Main Content Area
   ├─ Breadcrumb
   ├─ Page Header & Actions
   └─ Content
```

#### 5.2 主要コンポーネント
```typescript
// プロジェクト切り替え機能
interface ProjectSwitcher {
  current_project: Project;
  available_projects: Project[];
  onProjectChange: (project_id: string) => void;
}

// Well-Architected スコア表示
interface WellArchitectedChart {
  analysis_result: AnalysisResult;
  display_mode: 'radar' | 'bar' | 'table';
  interactive: boolean;
}

// 分析履歴テーブル
interface AnalysisHistory {
  analyses: AnalysisResult[];
  pagination: PaginationProps;
  filters: {
    date_range: DateRange;
    status: AnalysisStatus[];
    pillars: WellArchitectedPillar[];
  };
}
```

### 6. 管理者機能

#### 6.1 テナント管理
```typescript
interface AdminTenantManagement {
  operations: {
    create_tenant: (tenant_data: CreateTenantRequest) => Promise<Tenant>;
    update_tenant: (tenant_id: string, updates: Partial<Tenant>) => Promise<Tenant>;
    deactivate_tenant: (tenant_id: string) => Promise<void>;
    get_tenant_usage: (tenant_id: string, period: TimePeriod) => Promise<UsageStats>;
  };
}

interface UsageStats {
  tenant_id: string;
  period: TimePeriod;
  metrics: {
    total_analyses: number;
    total_storage_gb: number;
    active_users: number;
    total_projects: number;
    api_calls: number;
  };
  costs: {
    compute_cost: number;
    storage_cost: number;
    api_cost: number;
    total_cost: number;
  };
}
```

#### 6.2 横断分析機能
```typescript
interface CrossTenantAnalytics {
  aggregate_metrics: {
    total_tenants: number;
    total_users: number;
    total_analyses_this_month: number;
    average_well_architected_score: number;
    top_security_issues: SecurityIssue[];
    cost_optimization_opportunities: CostOpportunity[];
  };
  
  trend_analysis: {
    monthly_growth: TrendData[];
    adoption_by_pillar: PillarAdoptionData[];
    issue_resolution_rates: ResolutionRateData[];
  };
  
  benchmarking: {
    tenant_rankings: TenantRanking[];
    industry_comparisons: IndustryBenchmark[];
    best_practices_adoption: BestPracticeMetrics[];
  };
}
```

## セキュリティ要件

### 1. 認証・認可
```typescript
// Cognito User Pool設定
interface AuthenticationConfig {
  user_pool: {
    mfa_required: true;
    password_policy: {
      min_length: 8;
      require_uppercase: true;
      require_lowercase: true;
      require_numbers: true;
      require_symbols: true;
    };
    account_recovery: ['email'];
    email_verification: true;
  };
  
  jwt_configuration: {
    access_token_validity: 30; // minutes
    id_token_validity: 30;     // minutes  
    refresh_token_validity: 30; // days
  };
}
```

### 2. データ暗号化
```typescript
interface EncryptionConfig {
  dynamodb: {
    encryption_at_rest: 'AWS_MANAGED'; // KMS
    point_in_time_recovery: true;
  };
  
  s3: {
    default_encryption: 'AES256';
    bucket_key_enabled: true;
    versioning: true;
  };
  
  lambda: {
    environment_variables_encryption: 'KMS';
  };
  
  api_gateway: {
    tls_version: '1.2';
    request_logging: true;
  };
}
```

### 3. 監査・ログ
```typescript
interface AuditLogging {
  events_to_log: [
    'user_login',
    'user_logout', 
    'tenant_switch',
    'project_switch',
    'analysis_start',
    'analysis_complete',
    'file_upload',
    'file_download',
    'report_generate',
    'admin_action',
    'cross_tenant_query', // 管理者のみ
    'permission_denied'
  ];
  
  log_format: {
    timestamp: string;
    user_id: string;
    tenant_id: string;
    project_id?: string;
    action: string;
    resource: string;
    ip_address: string;
    user_agent: string;
    result: 'success' | 'failure';
    error_message?: string;
  };
  
  retention_policy: {
    cloudwatch_logs: '1_year';
    cloudtrail: '7_years';
    access_logs: '1_year';
  };
}
```

## パフォーマンス要件

### 1. レスポンス時間目標
- ページ初期表示: < 2秒
- API レスポンス: < 500ms (分析除く)
- IaC分析処理: < 5分 (10MB以下ファイル)
- レポート生成: < 30秒
- アカウントスキャン: < 10分

### 2. スケーラビリティ設計
```typescript
interface ScalabilityLimits {
  basic_tier: {
    max_users_per_tenant: 50;
    max_projects_per_tenant: 20;
    max_analyses_per_month: 100;
    max_concurrent_analyses: 3;
    max_file_size_mb: 10;
  };
  
  system_limits: {
    max_tenants: 50;
    max_total_users: 2500;
    max_concurrent_requests: 1000;
  };
}
```

## 開発・デプロイ要件

### 1. 開発環境設定
```typescript
// 最新技術要件
interface DevelopmentEnvironment {
  runtime: {
    nodejs: '20.x';        // 最新安定版
    typescript: '^5.3.0';  // 最新版
    aws_cdk: '^2.110.0';   // CDK v2最新
  };
  
  tools: {
    linting: [
      'eslint',
      '@typescript-eslint/eslint-plugin',
      'eslint-plugin-aws-cdk',  // CDK専用ルール
      'prettier'
    ];
    testing: [
      'jest',
      '@aws-cdk/assertions',
      'aws-cdk-lib/assertions'
    ];
  };
}
```

### 2. プロジェクト構造
```
serverless-saas-iac-analyzer/
├── infrastructure/           # CDK Infrastructure
│   ├── lib/
│   │   ├── sbt-control-plane-stack.ts
│   │   ├── application-plane-stack.ts
│   │   ├── shared-resources-stack.ts
│   │   └── constructs/
│   ├── bin/app.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.js      # ESLint + CDK plugin設定
│   └── jest.config.js
├── backend/                 # Lambda Functions (Node.js 20.x)
│   ├── shared/             # 共通ライブラリ
│   │   ├── tenant-utils.ts
│   │   ├── validation.ts
│   │   ├── bedrock-client.ts
│   │   └── types.ts
│   ├── tenant-validator/
│   │   ├── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── iac-analyzer/
│   ├── account-scanner/
│   ├── report-generator/
│   └── admin-functions/
├── frontend/               # React + Amplify
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── package.json
├── scripts/               # デプロイスクリプト
├── docs/                 # ドキュメント
└── tests/               # テストコード
```

### 3. CI/CD パイプライン
```yaml
# GitHub Actions workflow (最新版対応)
name: Deploy SaaS IaC Analyzer
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint_and_test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]  # Node.js 20.x使用
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint         # ESLint + CDK plugin実行
      - run: npm run type-check   # TypeScript型チェック
      - run: npm run test         # Jest テスト実行
      
  security_scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run security audit
        run: npm audit --audit-level high
        
  cdk_diff:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
      - run: npm ci
      - name: CDK Diff
        run: npx cdk diff
        working-directory: ./infrastructure

# Deployment stages:
# - lint_and_test
# - security_scan
# - cdk_diff
# - infrastructure_deploy
# - backend_deploy  
# - frontend_deploy
# - integration_test
# - production_deploy (main branch only)
```

### 4. 環境管理
```typescript
interface Environments {
  development: {
    aws_account: 'dev-account-id';
    domain: 'dev.iac-analyzer.example.com';
    bedrock_region: 'us-east-1';
    log_level: 'DEBUG';
  };
  
  staging: {
    aws_account: 'staging-account-id'; 
    domain: 'staging.iac-analyzer.example.com';
    bedrock_region: 'us-east-1';
    log_level: 'INFO';
  };
  
  production: {
    aws_account: 'prod-account-id';
    domain: 'iac-analyzer.example.com';
    bedrock_region: 'us-east-1';
    log_level: 'WARN';
  };
}
```

## 運用要件

### 1. 監視・アラート
```typescript
interface MonitoringConfig {
  cloudwatch_dashboards: [
    'system_overview',      // 全体システム状況
    'tenant_usage',        // テナント別使用状況  
    'api_performance',     // API パフォーマンス
    'error_tracking',      // エラー追跡
    'cost_monitoring'      // コスト監視
  ];
  
  alarms: {
    error_rate_threshold: 5;      // % per 5min
    latency_threshold_ms: 2000;   // API response time
    concurrent_executions: 800;    // Lambda concurrent
    dynamodb_throttles: 10;       // per 5min
    failed_analyses_rate: 10;     // % per hour
  };
  
  notifications: {
    critical_alerts: 'slack://ops-channel';
    warning_alerts: 'email://ops-team@company.com';
    daily_reports: 'email://management@company.com';
  };
}
```

### 2. バックアップ・災害復旧
```typescript
interface BackupConfig {
  dynamodb: {
    point_in_time_recovery: true;
    backup_retention_days: 30;
    cross_region_replication: false; // Basic tier制約
  };
  
  s3: {
    versioning: true;
    lifecycle_policy: {
      transition_to_ia: 30; // days
      transition_to_glacier: 90; // days
      delete_after: 2555; // 7 years (compliance)
    };
  };
  
  disaster_recovery: {
    rto_target_hours: 4;    // Recovery Time Objective
    rpo_target_minutes: 15; // Recovery Point Objective
    backup_regions: ['us-west-2']; // Primary: us-east-1
  };
}
```

### 3. コスト最適化
```typescript
interface CostOptimization {
  lambda: {
    memory_optimization: 'automatic_based_on_usage';
    provisioned_concurrency: false; // Basic tier
    reserved_capacity: false;       // Basic tier
  };
  
  dynamodb: {
    billing_mode: 'PAY_PER_REQUEST';
    auto_scaling: true;
  };
  
  s3: {
    intelligent_tiering: true;
    lifecycle_management: true;
    request_cost_optimization: true;
  };
  
  monitoring: {
    cost_alerts: [
      { threshold_usd: 500, period: 'monthly' },
      { threshold_usd: 100, period: 'weekly' }
    ];
    resource_tagging: 'mandatory';
    unused_resource_detection: 'weekly';
  };
}
```

---

これらの詳細要件に基づいて、段階的な開発を進めてください。特にセキュリティとテナント分離の実装は最優先で確実に行ってください。
