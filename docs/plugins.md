# Project Analyzer プラグイン機構 - 拡張要件定義

## 概要

Well-Architected Frameworkの6つの柱を基盤とし、プロジェクト要件に応じて追加のLensやコンプライアンス基準を動的に適用できるプラグイン機構を構築する。

## プラグイン対象レビュー基準

### 1. AWS Well-Architected Lenses

```typescript
enum WellArchitectedLens {
  // Core Framework
  CORE_FRAMEWORK = 'wa-core-framework',
  
  // Technology Lenses
  SERVERLESS = 'wa-serverless',
  MACHINE_LEARNING = 'wa-machine-learning',
  IOT = 'wa-iot',
  SAAS = 'wa-saas',
  DATA_ANALYTICS = 'wa-data-analytics',
  CONTAINER_BUILD = 'wa-container-build',
  DEVOPS = 'wa-devops',
  MIGRATION = 'wa-migration',
  CONNECTED_MOBILITY = 'wa-connected-mobility',
  SAP = 'wa-sap',
  GENERATIVE_AI = 'wa-generative-ai',
  
  // Industry Lenses
  FINANCIAL_SERVICES = 'wa-financial-services',
  HEALTHCARE = 'wa-healthcare',
  GOVERNMENT = 'wa-government',
  MERGERS_ACQUISITIONS = 'wa-mergers-acquisitions'
}
```

### 2. セキュリティ・コンプライアンス基準
```typescript
enum ComplianceFramework {
  // AWS Security Standards
  AWS_FOUNDATIONAL_SECURITY = 'aws-foundational-security',
  AWS_CONFIG_CONFORMANCE_PACKS = 'aws-config-conformance',
  
  // Industry Standards
  CIS_CONTROLS = 'cis-controls',
  CIS_AWS_FOUNDATIONS = 'cis-aws-foundations',
  CIS_AWS_COMPUTE = 'cis-aws-compute',
  
  // Government Standards
  CISA_CYBER_ESSENTIALS = 'cisa-cyber-essentials',
  FEDRAMP_MODERATE = 'fedramp-moderate',
  FEDRAMP_HIGH = 'fedramp-high',
  FFIEC = 'ffiec',
  SOC2_TYPE2 = 'soc2-type2',
  
  // Privacy Regulations
  GDPR = 'gdpr',
  CCPA = 'ccpa',
  PIPEDA = 'pipeda',
  
  // Industry-Specific
  HIPAA = 'hipaa',
  PCI_DSS = 'pci-dss',
  SOX = 'sox',
  ISO27001 = 'iso27001',
  NIST_CSF = 'nist-csf'
}
```

## プラグインアーキテクチャ設計

### 1. プラグインインターフェース
```typescript
interface AnalysisPlugin {
  // Plugin Metadata
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly category: PluginCategory;
  readonly supported_iac_types: IaCFormat[];
  readonly author: string;
  readonly license: string;
  
  // Plugin Configuration
  configuration: PluginConfiguration;
  
  // Analysis Methods
  analyze(context: AnalysisContext): Promise<PluginAnalysisResult>;
  validate(iac_content: string, format: IaCFormat): Promise<ValidationResult>;
  generateRecommendations(findings: Finding[]): Promise<Recommendation[]>;
  
  // Lifecycle Methods
  initialize(config: PluginConfiguration): Promise<void>;
  cleanup(): Promise<void>;
}

enum PluginCategory {
  WELL_ARCHITECTED_LENS = 'wa-lens',
  SECURITY_COMPLIANCE = 'security-compliance',
  INDUSTRY_STANDARD = 'industry-standard',
  CUSTOM_POLICY = 'custom-policy'
}

interface PluginConfiguration {
  enabled: boolean;
  severity_threshold: 'low' | 'medium' | 'high' | 'critical';
  custom_rules?: CustomRule[];
  exemptions?: string[];          // Resource exemptions
  parameters?: Record<string, any>; // Plugin-specific parameters
}
```

### 2. プラグインレジストリ
```typescript
interface PluginRegistry {
  // Plugin Management
  registerPlugin(plugin: AnalysisPlugin): Promise<void>;
  unregisterPlugin(plugin_id: string): Promise<void>;
  getPlugin(plugin_id: string): Promise<AnalysisPlugin | null>;
  listPlugins(category?: PluginCategory): Promise<PluginMetadata[]>;
  
  // Plugin Discovery
  searchPlugins(criteria: SearchCriteria): Promise<PluginMetadata[]>;
  getPluginDependencies(plugin_id: string): Promise<string[]>;
  validatePluginCompatibility(plugin_id: string): Promise<CompatibilityResult>;
}

interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  category: PluginCategory;
  description: string;
  supported_iac_types: IaCFormat[];
  dependencies: string[];
  minimum_analyzer_version: string;
  installation_size: number;
  last_updated: string;
  download_count: number;
  rating: number;
}
```

### 3. 動的プラグイン実行エンジン
```typescript
interface PluginExecutionEngine {
  // Analysis Orchestration
  executeAnalysis(
    tenant_id: string,
    project_id: string,
    iac_content: string,
    enabled_plugins: string[]
  ): Promise<ComprehensiveAnalysisResult>;
  
  // Parallel Execution
  executePluginsInParallel(
    plugins: AnalysisPlugin[],
    context: AnalysisContext
  ): Promise<PluginAnalysisResult[]>;
  
  // Resource Management
  allocateResources(plugin_id: string): Promise<ExecutionContext>;
  releaseResources(execution_id: string): Promise<void>;
  
  // Monitoring
  getExecutionMetrics(execution_id: string): Promise<ExecutionMetrics>;
  getPluginPerformance(plugin_id: string): Promise<PerformanceMetrics>;
}

interface ComprehensiveAnalysisResult {
  analysis_id: string;
  tenant_id: string;
  project_id: string;
  
  // Core Well-Architected Results
  well_architected_results: WellArchitectedAnalysis;
  
  // Plugin Results
  plugin_results: Record<string, PluginAnalysisResult>;
  
  // Aggregated Insights
  overall_compliance_score: number;
  critical_findings_count: number;
  high_priority_recommendations: Recommendation[];
  
  // Execution Metadata
  execution_time_ms: number;
  plugins_executed: string[];
  plugins_failed: string[];
  
  created_at: string;
}
```

## プラグイン実装例

### 1. CIS AWS Foundations Benchmark Plugin
```typescript
class CISAWSFoundationsPlugin implements AnalysisPlugin {
  readonly id = 'cis-aws-foundations-v1.4.0';
  readonly name = 'CIS AWS Foundations Benchmark';
  readonly version = '1.4.0';
  readonly description = 'CIS Controls for AWS infrastructure security';
  readonly category = PluginCategory.SECURITY_COMPLIANCE;
  readonly supported_iac_types = [IaCFormat.CLOUDFORMATION_JSON, IaCFormat.CLOUDFORMATION_YAML];
  
  private rules: CISRule[] = [
    {
      id: 'CIS-1.1',
      title: 'Maintain current contact details',
      severity: 'medium',
      description: 'Ensure contact email and telephone details for AWS account are current',
      check_function: this.checkContactDetails
    },
    {
      id: 'CIS-1.2', 
      title: 'Ensure security contact information is set',
      severity: 'medium',
      description: 'AWS accounts should have security contact information set',
      check_function: this.checkSecurityContact
    },
    // ... more CIS rules
  ];

  async analyze(context: AnalysisContext): Promise<PluginAnalysisResult> {
    const findings: Finding[] = [];
    const recommendations: Recommendation[] = [];
    
    for (const rule of this.rules) {
      try {
        const ruleResult = await rule.check_function(context);
        if (!ruleResult.compliant) {
          findings.push({
            id: `${this.id}-${rule.id}`,
            severity: rule.severity,
            title: rule.title,
            description: rule.description,
            resource: ruleResult.resource,
            remediation: ruleResult.remediation,
            cis_control: rule.id
          });
        }
      } catch (error) {
        console.error(`CIS rule ${rule.id} execution failed:`, error);
      }
    }
    
    return {
      plugin_id: this.id,
      plugin_name: this.name,
      execution_status: 'completed',
      findings,
      recommendations: this.generateRecommendations(findings),
      compliance_score: this.calculateComplianceScore(findings),
      execution_time_ms: Date.now() - context.start_time
    };
  }
  
  private async checkContactDetails(context: AnalysisContext): Promise<RuleResult> {
    // CIS 1.1 implementation
    const template = context.cloudformation_template;
    
    // Check if account contact information is configured
    // This would typically require additional AWS API calls
    
    return {
      compliant: true, // or false based on actual check
      resource: 'AWS::Account',
      remediation: 'Update account contact information in AWS Account Settings'
    };
  }
}
```

### 2. GDPR Compliance Plugin
```typescript
class GDPRCompliancePlugin implements AnalysisPlugin {
  readonly id = 'gdpr-compliance-v2.0.0';
  readonly name = 'GDPR Compliance Checker';
  readonly version = '2.0.0';
  readonly description = 'General Data Protection Regulation compliance validation';
  readonly category = PluginCategory.SECURITY_COMPLIANCE;
  
  private gdprRequirements: GDPRRequirement[] = [
    {
      article: 'Article 25',
      requirement: 'Data Protection by Design and by Default',
      checks: [
        this.checkEncryptionAtRest,
        this.checkEncryptionInTransit,
        this.checkDataMinimization
      ]
    },
    {
      article: 'Article 32',
      requirement: 'Security of Processing',
      checks: [
        this.checkSecurityMeasures,
        this.checkAccessControls,
        this.checkDataIntegrityMeasures
      ]
    }
    // ... more GDPR requirements
  ];

  async analyze(context: AnalysisContext): Promise<PluginAnalysisResult> {
    const findings: Finding[] = [];
    
    for (const requirement of this.gdprRequirements) {
      for (const check of requirement.checks) {
        const result = await check(context);
        if (result.violations.length > 0) {
          findings.push(...result.violations.map(violation => ({
            id: `gdpr-${requirement.article.toLowerCase().replace(' ', '-')}-${violation.id}`,
            severity: violation.severity,
            title: `${requirement.article}: ${violation.title}`,
            description: `${requirement.requirement} - ${violation.description}`,
            resource: violation.resource,
            remediation: violation.remediation,
            gdpr_article: requirement.article,
            data_protection_impact: violation.impact
          })));
        }
      }
    }
    
    return {
      plugin_id: this.id,
      plugin_name: this.name,
      execution_status: 'completed',
      findings,
      recommendations: await this.generateGDPRRecommendations(findings),
      compliance_score: this.calculateGDPRScore(findings),
      gdpr_assessment: {
        data_protection_by_design: this.assessDataProtectionByDesign(findings),
        lawful_basis_compliance: this.assessLawfulBasis(findings),
        data_subject_rights: this.assessDataSubjectRights(findings)
      }
    };
  }
  
  private async checkEncryptionAtRest(context: AnalysisContext): Promise<GDPRCheckResult> {
    const violations: GDPRViolation[] = [];
    
    // Check S3 buckets
    const s3Resources = context.getResourcesByType('AWS::S3::Bucket');
    for (const bucket of s3Resources) {
      if (!bucket.properties?.BucketEncryption) {
        violations.push({
          id: 'encryption-at-rest-s3',
          severity: 'high',
          title: 'S3 bucket lacks encryption at rest',
          description: 'Personal data must be encrypted to meet GDPR Article 32 requirements',
          resource: bucket.logical_id,
          remediation: 'Enable S3 bucket encryption using AWS KMS or AES-256',
          impact: 'data_confidentiality'
        });
      }
    }
    
    // Check RDS instances
    const rdsResources = context.getResourcesByType('AWS::RDS::DBInstance');
    for (const db of rdsResources) {
      if (!db.properties?.StorageEncrypted) {
        violations.push({
          id: 'encryption-at-rest-rds',
          severity: 'high',
          title: 'RDS instance lacks encryption at rest',
          description: 'Database containing personal data must be encrypted',
          resource: db.logical_id,
          remediation: 'Enable RDS encryption by setting StorageEncrypted to true',
          impact: 'data_confidentiality'
        });
      }
    }
    
    return { violations };
  }
}
```

## データベース設計（プラグイン対応）

### 1. プラグイン管理テーブル
```typescript
interface PluginRegistryTable {
  // DynamoDB Table: plugin-registry
  plugin_id: string;              // PK
  name: string;
  version: string;
  category: PluginCategory;
  description: string;
  author: string;
  license: string;
  supported_iac_types: IaCFormat[];
  dependencies: string[];
  minimum_analyzer_version: string;
  configuration_schema: object;   // JSON Schema for plugin config
  installation_package_url: string;
  checksum: string;
  status: 'active' | 'deprecated' | 'suspended';
  created_at: string;
  updated_at: string;
}

interface ProjectPluginConfiguration {
  // DynamoDB Table: project-plugin-config
  tenant_id: string;              // PK
  project_id: string;             // SK
  enabled_plugins: {
    plugin_id: string;
    configuration: PluginConfiguration;
    last_updated: string;
    updated_by: string;
  }[];
  default_severity_threshold: string;
  auto_update_enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

### 2. 分析結果テーブル（拡張版）
```typescript
interface EnhancedAnalysisResult {
  // DynamoDB Table: enhanced-analysis-results  
  tenant_id: string;              // PK
  analysis_id: string;            // SK
  project_id: string;
  
  // Core Analysis
  well_architected_results: WellArchitectedAnalysis;
  
  // Plugin Results
  plugin_results: {
    [plugin_id: string]: {
      plugin_name: string;
      plugin_version: string;
      execution_status: 'completed' | 'failed' | 'timeout';
      findings: Finding[];
      recommendations: Recommendation[];
      compliance_score: number;
      execution_time_ms: number;
      error_message?: string;
    };
  };
  
  // Aggregated Compliance
  compliance_summary: {
    [framework: string]: {
      total_controls: number;
      compliant_controls: number;
      compliance_percentage: number;
      critical_violations: number;
      high_violations: number;
    };
  };
  
  // Execution Metadata
  total_execution_time_ms: number;
  plugins_requested: string[];
  plugins_executed: string[];
  plugins_failed: string[];
  
  created_at: string;
  expires_at: string;             // TTL for data retention
}
```

## API設計（プラグイン対応）

### 1. プラグイン管理API
```typescript
// Plugin Management Endpoints
interface PluginManagementAPI {
  // Plugin Registry
  'GET /plugins': () => Promise<PluginMetadata[]>;
  'GET /plugins/{plugin_id}': (plugin_id: string) => Promise<PluginDetail>;
  'POST /plugins': (plugin_package: PluginPackage) => Promise<InstallationResult>;
  'DELETE /plugins/{plugin_id}': (plugin_id: string) => Promise<void>;
  
  // Plugin Configuration
  'GET /projects/{project_id}/plugins': (project_id: string) => Promise<ProjectPluginConfiguration>;
  'PUT /projects/{project_id}/plugins': (project_id: string, config: ProjectPluginConfiguration) => Promise<void>;
  'POST /projects/{project_id}/plugins/{plugin_id}/enable': (project_id: string, plugin_id: string) => Promise<void>;
  'POST /projects/{project_id}/plugins/{plugin_id}/disable': (project_id: string, plugin_id: string) => Promise<void>;
  
  // Plugin Testing
  'POST /plugins/{plugin_id}/test': (plugin_id: string, test_data: TestData) => Promise<TestResult>;
}
```

### 2. 分析実行API（拡張版）
```typescript
interface EnhancedAnalysisAPI {
  // Enhanced Analysis Request
  'POST /analysis': (request: EnhancedAnalysisRequest) => Promise<AnalysisResponse>;
  'GET /analysis/{analysis_id}': (analysis_id: string) => Promise<EnhancedAnalysisResult>;
  
  // Compliance Reporting
  'GET /analysis/{analysis_id}/compliance/{framework}': (analysis_id: string, framework: string) => Promise<ComplianceReport>;
  'GET /projects/{project_id}/compliance-summary': (project_id: string) => Promise<ComplianceSummary>;
  
  // Plugin-specific Results
  'GET /analysis/{analysis_id}/plugins/{plugin_id}': (analysis_id: string, plugin_id: string) => Promise<PluginAnalysisResult>;
}

interface EnhancedAnalysisRequest {
  tenant_id: string;
  project_id: string;
  file_metadata: FileMetadata;
  
  // Analysis Configuration
  well_architected_options: {
    pillars: WellArchitectedPillar[];
    lenses: WellArchitectedLens[];
  };
  
  // Plugin Selection
  enabled_plugins: string[];
  plugin_configurations?: Record<string, PluginConfiguration>;
  
  // Execution Options
  execution_mode: 'fast' | 'comprehensive' | 'compliance_focused';
  timeout_minutes: number;
  parallel_execution: boolean;
}
```

## フロントエンド拡張（プラグイン対応）

### 1. プラグイン管理UI
```typescript
// Plugin Management Dashboard Component
interface PluginManagementDashboard {
  components: {
    PluginMarketplace: React.FC<{
      availablePlugins: PluginMetadata[];
      onInstall: (plugin_id: string) => void;
    }>;
    
    InstalledPluginsList: React.FC<{
      installedPlugins: PluginMetadata[];
      onUninstall: (plugin_id: string) => void;
      onConfigure: (plugin_id: string) => void;
    }>;
    
    PluginConfigurationModal: React.FC<{
      plugin: PluginDetail;
      currentConfig: PluginConfiguration;
      onSave: (config: PluginConfiguration) => void;
    }>;
    
    ComplianceFrameworkSelector: React.FC<{
      availableFrameworks: ComplianceFramework[];
      selectedFrameworks: ComplianceFramework[];
      onSelectionChange: (frameworks: ComplianceFramework[]) => void;
    }>;
  };
}
```

### 2. 拡張分析結果表示
```typescript
// Enhanced Analysis Results Component
interface EnhancedAnalysisResultsView {
  components: {
    ComplianceScorecard: React.FC<{
      complianceSummary: ComplianceSummary;
      selectedFrameworks: string[];
    }>;
    
    MultiFrameworkFindings: React.FC<{
      findingsByFramework: Record<string, Finding[]>;
      onFilterChange: (filters: FindingFilters) => void;
    }>;
    
    RecommendationPrioritizer: React.FC<{
      recommendations: Recommendation[];
      prioritizationCriteria: PrioritizationCriteria;
    }>;
    
    ComplianceReportExporter: React.FC<{
      analysisResult: EnhancedAnalysisResult;
      exportFormats: ('pdf' | 'excel' | 'json')[];
      selectedFrameworks: string[];
    }>;
  };
}
```

## デプロイメント要件

### 1. プラグインパッケージング
```dockerfile
# Plugin Container Format
FROM public.ecr.aws/lambda/nodejs:20

# Plugin metadata
LABEL plugin.id="cis-aws-foundations"
LABEL plugin.version="1.4.0"
LABEL plugin.category="security-compliance"

# Plugin dependencies
COPY package.json ./
RUN npm install --production

# Plugin code
COPY src/ ./src/
COPY plugin-manifest.json ./

# Plugin execution environment
ENV PLUGIN_ID=cis-aws-foundations
ENV PLUGIN_VERSION=1.4.0

CMD ["src/index.handler"]
```

### 2. プラグイン実行環境（Lambda）
```typescript
// Plugin Execution Lambda
export const pluginExecutorHandler = async (event: PluginExecutionEvent): Promise<PluginExecutionResult> => {
  const { plugin_id, plugin_configuration, analysis_context } = event;
  
  try {
    // Load plugin dynamically
    const plugin = await loadPlugin(plugin_id);
    
    // Initialize plugin with configuration
    await plugin.initialize(plugin_configuration);
    
    // Execute analysis
    const result = await plugin.analyze(analysis_context);
    
    // Cleanup plugin resources
    await plugin.cleanup();
    
    return {
      status: 'success',
      plugin_id,
      result
    };
    
  } catch (error) {
    return {
      status: 'error',
      plugin_id,
      error: error.message
    };
  }
};
```

この拡張により、IaC Analyzerは単なるWell-Architected分析ツールから、包括的なコンプライアンス・セキュリティ分析プラットフォームへと進化します。プラグイン機構により、顧客の具体的な規制要件や業界標準に柔軟に対応できるようになります。



# Claude Code プロンプト（プラグイン機構対応版）

```
あなたはAWSのServerless SaaSアプリケーション開発とコンプライアンス分析の専門家です。
以下の要件に基づいて、拡張可能なプラグイン機構を持つServerless SaaS IaC Analyzerを開発してください。

## プロジェクト概要
- 既存のWell-Architected IaC Analyzerをマルチテナント対応のSaaSとして再構築
- **新機能**: 動的プラグイン機構による分析フレームワーク拡張対応
- AWS SaaS Builder Toolkit (Basic Tier) を使用
- コンサルティング案件ごとのデータ分離とアクセス制御を実現
- Minimum Startアプローチでコスト効率的な運用

## 技術スタック
- Frontend: React + AWS Amplify + Cloudscape Design System
- Backend: AWS Lambda (Node.js 22.x TypeScript) ← 最新ランタイム使用
- Infrastructure: AWS CDK (TypeScript) + eslint-cdk-plugin
- AI Engine: Amazon Bedrock (Claude 3.5 Sonnet)
- Multi-tenancy: AWS SaaS Builder Toolkit (Basic Tier、課金機能は使用しない)
- Database: DynamoDB (Pool Model)
- Storage: S3 (Tenant-based prefix)
- API: API Gateway (REST)
- **新機能**: プラグイン実行環境（Lambda + Container）

## 重要な新機能要件

### 1. プラグイン機構
- **コアフレームワーク**: AWS Well-Architected Framework 6つの柱
- **Well-Architected Lenses**: Serverless, ML, IoT, SaaS, Healthcare, Financial Services等
- **セキュリティ・コンプライアンス**: CIS, GDPR, FEDRAMP, HIPAA, SOC2等
- **動的プラグイン読み込み**: プロジェクトごとの要件に応じた分析基準適用
- **プラグインレジストリ**: 社内外プラグインの管理・配布

### 2. 対応分析基準
```
Core Frameworks:
- AWS Well-Architected Framework (6 pillars + Lenses)

Security & Compliance:
- AWS Foundational Security Best Practices
- CIS Controls & CIS AWS Foundations Benchmark
- CIS AWS Compute Services Benchmark
- CISA Cyber Essentials
- FedRAMP (Moderate/High)
- FFIEC
- GDPR
- HIPAA
- PCI DSS
- SOC 2 Type II
- ISO 27001
- NIST Cybersecurity Framework

Custom Requirements:
- プロジェクト固有のカスタムポリシー
- 業界特化型コンプライアンス要件
```

### 3. プラグインアーキテクチャ要件
- **プラグインインターフェース**: 標準化されたAnalysisPlugin interface
- **並列実行**: 複数プラグインの効率的な並行処理
- **設定管理**: プロジェクトごとのプラグイン有効化・設定
- **結果統合**: 複数フレームワークの分析結果統合表示
- **パフォーマンス監視**: プラグイン実行時間・リソース使用量監視

## 既存要件（変更なし）
1. **完全なテナント分離**: 他の顧客企業データへのアクセスは絶対に禁止
2. **プロジェクトベースアクセス制御**: 案件アサインメンバーのみアクセス可能
3. **顧客エンジニアアクセス**: 必要に応じて顧客側エンジニアも特定案件のみアクセス可能
4. **管理者機能**: 複数顧客企業の複数システム・複数AWSアカウント情報の横断集計表示

## ユーザーロール（拡張）
- SystemAdmin: 全テナント管理権限 + プラグイン管理権限
- ClientAdmin: 自社テナント管理権限 + プラグイン設定権限
- ProjectManager: 担当案件の管理権限 + 分析フレームワーク選択権限
- Analyst: 担当案件の分析実行権限
- Viewer: 担当案件の閲覧のみ権限
- ClientEngineer: 顧客側エンジニア（特定案件のみ）
- **新規**: ComplianceOfficer: コンプライアンス分析結果の閲覧・監査権限

## 拡張機能要件
1. **プラグイン管理機能**
   - プラグインマーケットプレイス
   - プラグインインストール・アンインストール
   - バージョン管理・更新
   - プラグイン設定UI

2. **分析フレームワーク選択**
   - プロジェクトごとの分析基準設定
   - 複数フレームワーク同時適用
   - カスタムポリシー追加

3. **統合コンプライアンスレポート**
   - 複数基準の統合スコア表示
   - フレームワーク別詳細レポート
   - エクスポート機能（PDF、Excel、JSON）
   - トレンド分析

4. **プラグイン開発支援**
   - プラグインSDK
   - テストフレームワーク
   - デバッグ機能

## 制約事項
- Basic Tier制約: 月100回分析、10MBファイル制限、90日保存
- プラグイン実行時間制限: 15分以内
- 完全なテナント分離必須
- セキュリティ重視（MFA必須、暗号化、監査ログ）

CLAUDE.mdファイルに詳細要件（プラグイン機構含む）が記載されているので、それを参照して段階的に開発を進めてください。

開発は以下の順序で進めてください：
1. プロジェクト構造とセットアップ（プラグイン対応）
2. CDK Infrastructure（SBT統合、プラグイン実行環境含む）
3. プラグインインターフェース設計と基本実装
4. Core Lambda Functions（テナント分離ロジック含む）
5. プラグイン実行エンジン
6. React Frontend（プラグイン管理UI含む、Amplify統合）
7. サンプルプラグイン実装（CIS、GDPR等）
8. テスト実装（プラグインテスト含む）
9. デプロイメント設定

各段階で、以下を確実に実装してください：
- セキュリティベストプラクティスとテナント分離
- プラグインの安全な実行環境
- パフォーマンス最適化
- 拡張性を考慮したアーキテクチャ設計

プラグイン機構は将来的な拡張性を重視し、サードパーティプラグインの安全な実行も考慮してください。
```


