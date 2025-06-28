プロジェクト概要
目的
既存のWell-Architected IaC AnalyzerをマルチテナントSaaSとして再構築し、コンサルティング案件ごとのデータ分離とアクセス制御を実現する。
アプローチ

Minimum Start: コスト効率重視、段階的機能拡張
Serverless First: 運用負荷最小化、自動スケーリング
Security First: 完全なテナント分離、厳密なアクセス制御

アーキテクチャ要件
技術スタック
Frontend: React + AWS Amplify + Cloudscape Design System
Backend: AWS Lambda (Node.js 20.x TypeScript) ← 最新ランタイム
Infrastructure: AWS CDK v2 (TypeScript) + eslint-cdk-plugin
AI Engine: Amazon Bedrock (Claude 3.5 Sonnet)
Multi-tenancy: AWS SaaS Builder Toolkit (Basic Tier)
Database: DynamoDB (Pool Model with tenant_id partition)
Storage: S3 (Tenant-based prefix isolation)
API: API Gateway (REST) + Lambda Authorizer
Authentication: Amazon Cognito User Pool + AWS WAF integration
Security: AWS WAF + Cognito multi-layer protection
Development: TypeScript 5.x + ESLint + Prettier + Jest
Plugin System: Container-based plugin execution environment
データ分離戦略
DynamoDB Pool Model:
- Primary Key: tenant_id
- Sort Key: item_id (analysis_id, project_id, user_id)
- GSI: tenant_id + item_type for queries

S3 Isolation:
- Bucket Structure: {bucket-name}/{tenant_id}/{project_id}/{file_type}/
- IAM Policies: Path-based access control
- Presigned URLs: Time-limited access

Lambda Security:
- Tenant Context Validation in every function
- Row-level security enforcement
- Comprehensive logging for audit trail
機能要件詳細
1. マルチテナント管理
1.1 テナント構造
typescriptinterface Tenant {
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
1.2 プロジェクト管理
typescriptinterface Project {
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
2. ユーザー管理・アクセス制御
2.1 ユーザーロール定義
typescriptenum UserRole {
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
2.2 権限マトリックス
| Role            | Tenant Admin | Project CRUD | Analysis Execute | Cross-Tenant View | Account Scan |
|-----------------|--------------|--------------|------------------|-------------------|--------------|
| SystemAdmin     | All          | All          | All              | All              | All          |
| ClientAdmin     | Own          | Own Tenant   | Own Tenant       | None             | Own Tenant   |
| ProjectManager  | None         | Assigned     | Assigned         | None             | Assigned     |
| Analyst         | None         | Read Only    | Assigned         | None             | Assigned     |
| Viewer          | None         | Read Only    | None             | None             | None         |
| ClientEngineer  | None         | Read Only    | None             | None             | None         |
3. IaC分析機能
3.1 対応フォーマット
typescriptenum IaCFormat {
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
3.2 Well-Architected Framework分析
typescriptenum WellArchitectedPillar {
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
4. ライブアカウントスキャン
4.1 Cross-Account Access
typescriptinterface AccountScanRequest {
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
4.2 必要IAM権限（Read-Only）
json{
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
5. フロントエンド要件
5.1 画面構成
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
5.2 主要コンポーネント
typescript// プロジェクト切り替え機能
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
6. 管理者機能
6.1 テナント管理
typescriptinterface AdminTenantManagement {
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
6.2 横断分析機能
typescriptinterface CrossTenantAnalytics {
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
セキュリティ要件
1. 多層防御アーキテクチャ（AWS WAF統合）
typescriptinterface MultiLayerSecurity {
  // Layer 1: AWS WAF Protection
  waf_protection: {
    owasp_top10_protection: 'Automated protection against common vulnerabilities';
    ddos_mitigation: 'Distributed Denial of Service attack protection';
    rate_limiting: 'Per-user and per-tenant rate limiting';
    ip_filtering: 'Malicious IP blocking and geo-restrictions';
    bot_protection: 'Automated bot detection and mitigation';
    custom_rules: 'Tenant-specific and compliance-driven security rules';
  };
  
  // Layer 2: Cognito Authentication
  cognito_integration: {
    user_pool_authentication: 'Centralized user management';
    mfa_enforcement: 'Multi-factor authentication required';
    session_management: 'Secure session handling and timeout';
    jwt_validation: 'Token-based authentication with WAF integration';
    federated_identity: 'Support for enterprise SSO (future)';
  };
  
  // Layer 3: Application-Level Security  
  application_security: {
    tenant_isolation: 'Row-level security and data partitioning';
    rbac_enforcement: 'Role-based access control';
    api_authorization: 'Fine-grained permission checking';
    audit_logging: 'Comprehensive security audit trail';
    data_encryption: 'End-to-end encryption for sensitive data';
  };
}
2. WAF Rule Configuration
typescriptinterface WAFConfiguration {
  // Managed Rule Groups
  managed_rules: {
    aws_common_rule_set: {
      enabled: true;
      priority: 100;
      description: 'OWASP Top 10 protection including SQL injection, XSS';
      action: 'BLOCK';
    };
    
    aws_known_bad_inputs: {
      enabled: true;
      priority: 200;  
      description: 'Protection against known malicious patterns';
      action: 'BLOCK';
    };
    
    aws_sqli_rule_set: {
      enabled: true;
      priority: 300;
      description: 'Enhanced SQL injection protection';
      action: 'BLOCK';
    };
  };
  
  // Custom Rules for Multi-tenant SaaS
  custom_rules: {
    tenant_isolation_rule: {
      priority: 400;
      description: 'Validate X-Tenant-ID header and prevent cross-tenant access';
      conditions: [
        'Header X-Tenant-ID matches authenticated user tenant',
        'Block requests with invalid or missing tenant context'
      ];
      action: 'BLOCK';
    };
    
    rate_limiting_per_tenant: {
      priority: 500;
      description: 'Per-tenant rate limiting based on subscription tier';
      conditions: [
        'Basic tier: 100 requests per minute per user',
        'Premium tier: 500 requests per minute per user'
      ];
      action: 'BLOCK';
    };
    
    analysis_endpoint_protection: {
      priority: 600;
      description: 'Special protection for analysis endpoints';
      conditions: [
        'Large file upload validation',
        'Analysis request frequency limits',
        'Plugin execution request validation'
      ];
      action: 'RATE_LIMIT';
    };
  };
  
  // Compliance-Specific Rules
  compliance_rules: {
    gdpr_protection: {
      priority: 700;
      description: 'GDPR data protection compliance';
      conditions: [
        'Validate consent for data processing',
        'Block requests from restricted regions if configured',
        'Enforce data minimization principles'
      ];
      action: 'CUSTOM_RESPONSE';
    };
    
    pci_dss_compliance: {
      priority: 800;
      description: 'PCI DSS compliance for payment data handling';
      enabled: false; // Per-tenant configuration
      conditions: [
        'Enhanced logging for payment-related endpoints',
        'Strict input validation for card data'
      ];
      action: 'ALLOW_WITH_ENHANCED_LOGGING';
    };
  };
}

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
3. セキュリティ監視・アラート
typescriptinterface SecurityMonitoring {
  // WAF Metrics and Alarms
  waf_monitoring: {
    blocked_requests_alarm: {
      threshold: '> 100 blocked requests in 5 minutes';
      action: 'SNS notification + automatic investigation';
    };
    
    ddos_detection_alarm: {
      threshold: '> 1000 requests per minute from single IP';
      action: 'Automatic IP blocking + security team alert';
    };
    
    false_positive_tracking: {
      threshold: '> 10 legitimate requests blocked in 1 hour';
      action: 'WAF rule review alert';
    };
  };
  
  // Authentication Security
  auth_monitoring: {
    failed_login_attempts: {
      threshold: '> 20 failed attempts in 5 minutes per IP';
      action: 'Temporary IP blocking + investigation';
    };
    
    suspicious_login_patterns: {
      detection: 'Multiple geographic locations, unusual access times';
      action: 'Enhanced verification + security team notification';
    };
    
    token_abuse_detection: {
      detection: 'Token reuse, expired token attempts';
      action: 'Force token refresh + audit logging';
    };
  };
  
  // Tenant Security Monitoring
  tenant_monitoring: {
    cross_tenant_access_attempts: {
      detection: 'Attempts to access other tenant data';
      action: 'Immediate blocking + security incident creation';
    };
    
    unusual_analysis_patterns: {
      detection: 'Bulk analysis requests, large file uploads';
      action: 'Rate limiting + manual review';
    };
    
    plugin_security_violations: {
      detection: 'Plugin execution errors, security policy violations';
      action: 'Plugin quarantine + security review';
    };
  };
}

## パフォーマンス要件

### 1. レスポンス時間目標

ページ初期表示: < 2秒
API レスポンス: < 500ms (分析除く)
IaC分析処理: < 5分 (10MB以下ファイル)
レポート生成: < 30秒
アカウントスキャン: < 10分


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
開発・デプロイ要件
1. 開発環境設定
typescript// 最新技術要件
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
2. プロジェクト構造
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
2. CI/CD パイプライン
yaml# GitHub Actions workflow (最新版対応)
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

stages:
  - lint_and_test
  - security_scan
  - cdk_diff
  - infrastructure_deploy
  - backend_deploy  
  - frontend_deploy
  - integration_test
  - production_deploy (main branch only)
3. 環境管理
typescriptinterface Environments {
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
運用要件
1. 監視・アラート
typescriptinterface MonitoringConfig {
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
2. バックアップ・災害復旧
typescriptinterface BackupConfig {
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
3. コスト最適化
typescriptinterface CostOptimization {
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
これらの詳細要件に基づいて、段階的な開発を進めてください。特にセキュリティとテナント分離の実装は最優先で確実に行ってください。
