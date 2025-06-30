# マルチフレームワーク分析機能 実装ロードマップ

## 実装優先度とタイムライン

### Phase 1: 基盤システム実装 (4週間)
**目標**: マルチフレームワーク対応の基盤システム構築

#### Week 1-2: Central Master System
- [ ] **FrameworkRegistry DynamoDB Table 設計・作成**
  - Framework metadata 管理
  - Version management
  - Status tracking (ACTIVE/DEPRECATED/BETA)
  
- [ ] **RuleDefinitions DynamoDB Table 設計・作成**
  - Rule definitions for all frameworks
  - Multi-IaC format support (CloudFormation/Terraform/CDK)
  - Rule versioning and dependency management

- [ ] **Framework Management Lambda Functions**
  - GET /frameworks - Framework list API
  - GET /frameworks/{id}/rules - Rule definitions API
  - POST /frameworks/{id}/rules - Rule update API (SystemAdmin only)

#### Week 3-4: Tenant Framework Configuration
- [ ] **TenantFrameworkConfig DynamoDB Table**
  - Tenant-specific framework selections
  - Custom weights and priorities
  - Framework set definitions (production/staging/custom)

- [ ] **Framework Configuration API**
  - POST /tenants/{id}/framework-sets - Create framework sets
  - GET /tenants/{id}/framework-sets - List framework sets
  - PUT /tenants/{id}/framework-sets/{setId} - Update framework sets

- [ ] **Enhanced Analysis Engine**
  - Multi-framework rule engine
  - Weighted scoring system
  - Parallel framework execution

### Phase 2: Core Frameworks Implementation (6週間)

#### Week 1-2: Well-Architected Lenses
**Priority**: HIGH (高い需要が見込まれる)

- [ ] **Serverless Applications Lens**
  - Lambda best practices
  - API Gateway optimization
  - Event-driven architecture patterns
  - Cold start optimization
  
- [ ] **SaaS Lens**  
  - Multi-tenancy patterns
  - Data isolation strategies
  - Tenant onboarding automation
  - SaaS metrics and monitoring

#### Week 3-4: Security Hub CSPM Integration
**Priority**: HIGH (セキュリティ要件の重要性)

- [ ] **Security Hub API Integration**
  - Real-time compliance status retrieval
  - CSPM controls mapping
  - Finding correlation with IaC analysis

- [ ] **Compliance Frameworks**
  - CIS AWS Foundations Benchmark
  - PCI DSS Controls
  - SOC 2 Type II Controls
  - NIST Cybersecurity Framework

#### Week 5-6: Additional Lenses
**Priority**: MEDIUM

- [ ] **IoT Lens**
  - Device management patterns
  - Edge computing optimization
  - IoT security best practices

- [ ] **Machine Learning Lens**
  - ML pipeline optimization
  - Data privacy and governance
  - Model training cost optimization

### Phase 3: Service Delivery & Competency (4週間)

#### Week 1-2: AWS Service Delivery Program
**Priority**: MEDIUM (パートナー向け価値)

- [ ] **SDP Well-Architected Review Requirements**
  - Architecture documentation standards
  - Customer engagement patterns
  - Delivery excellence criteria

- [ ] **SDP Operational Excellence**
  - Monitoring and alerting standards
  - Incident response procedures
  - Change management processes

#### Week 3-4: AWS Competency Checks
**Priority**: MEDIUM

- [ ] **Technical Competency Validation**
  - Solution architecture best practices
  - Service-specific optimization patterns
  - Industry vertical requirements

### Phase 4: Admin Analytics & Advanced Features (8週間)

#### Week 1-2: Custom Framework Builder
**Priority**: HIGH (差別化要因)

- [ ] **Custom Rule Definition UI**
  - Visual rule builder
  - Template-based rule creation
  - Rule testing and validation

- [ ] **Industry-Specific Templates**
  - Financial Services
  - Healthcare (HIPAA)
  - Government (FedRAMP)

#### Week 3-4: Advanced Analytics
**Priority**: MEDIUM

- [ ] **Trend Analysis**
  - Framework compliance over time
  - Regression detection
  - Improvement tracking

- [ ] **Comparative Analysis**
  - Multi-framework comparison
  - Industry benchmarking
  - Peer comparison (anonymized)

#### Week 5-6: Admin Cross-Tenant Analytics
**Priority**: HIGH (SaaS運用の要)

- [ ] **Cross-Tenant Analytics Dashboard**
  - Real-time tenant metrics aggregation
  - Framework adoption analysis
  - Performance matrix visualization

- [ ] **Business Intelligence Features**
  - Industry benchmarking
  - Churn risk prediction
  - Custom report generation

#### Week 7-8: AI-Enhanced Recommendations
**Priority**: HIGH (AI活用による付加価値)

- [ ] **Intelligent Rule Suggestions**
  - Bedrock integration for context-aware recommendations
  - Automated rule prioritization
  - Risk assessment enhancement

- [ ] **Predictive Analytics**
  - Tenant success scoring
  - Framework effectiveness prediction
  - Usage pattern analysis

## 技術実装詳細

### Database Schema Updates

```sql
-- New Tables
CREATE TABLE FrameworkRegistry (
  pk VARCHAR PRIMARY KEY,        -- "FRAMEWORK#{type}"
  sk VARCHAR SORT KEY,          -- "#{frameworkId}"
  frameworkType VARCHAR,        -- "WA_LENSES", "SDP", "COMPETENCY", "CSPM"
  frameworkId VARCHAR,          
  name VARCHAR,
  version VARCHAR,
  status VARCHAR,               -- "ACTIVE", "DEPRECATED", "BETA"
  metadata JSON,
  GSI1PK VARCHAR,              -- "STATUS#{status}"
  GSI1SK VARCHAR               -- "TYPE#{type}#NAME#{name}"
);

CREATE TABLE RuleDefinitions (
  pk VARCHAR PRIMARY KEY,        -- "RULE#{ruleId}"
  sk VARCHAR SORT KEY,          -- "VERSION#{version}"
  frameworkId VARCHAR,
  ruleId VARCHAR,
  pillar VARCHAR,
  severity VARCHAR,
  implementation JSON,          -- Multi-IaC format implementations
  remediation JSON,
  GSI1PK VARCHAR,              -- "FRAMEWORK#{frameworkId}"
  GSI1SK VARCHAR               -- "PILLAR#{pillar}#SEVERITY#{severity}"
);

CREATE TABLE TenantFrameworkConfig (
  pk VARCHAR PRIMARY KEY,        -- "TENANT#{tenantId}"
  sk VARCHAR SORT KEY,          -- "FRAMEWORK_SET#{setName}"
  tenantId VARCHAR,
  setName VARCHAR,
  frameworks JSON,              -- Framework selections with weights
  customRules JSON,
  isDefault BOOLEAN,
  GSI1PK VARCHAR,              -- "TENANT#{tenantId}#DEFAULT"
  GSI1SK VARCHAR               -- "#{isDefault}"
);
```

### API Extensions

```typescript
// Framework Selection API
interface FrameworkSelectionRequest {
  frameworks: {
    frameworkId: string;
    version?: string;
    pillars?: string[];
    weight: number;
    enabled: boolean;
    customConfig?: {
      severity_weights?: Record<string, number>;
      excluded_rules?: string[];
      custom_thresholds?: Record<string, number>;
    };
  }[];
  setName: string;
  description?: string;
  isDefault?: boolean;
}

// Enhanced Analysis Request
interface EnhancedAnalysisRequest {
  projectId: string;
  frameworkSetId?: string;
  analysisMode: 'QUICK_SCAN' | 'STANDARD' | 'DEEP_AUDIT' | 'COMPLIANCE_ONLY';
  options: {
    includeSecurityHubFindings: boolean;
    includeLiveAccountScan: boolean;
    parallelFrameworkExecution: boolean;
    customWeights?: Record<string, number>;
    frameworkPriority?: string[]; // Execution order
  };
}
```

### Lambda Function Architecture

```typescript
// Framework-Agnostic Analysis Engine
class MultiFrameworkAnalyzer {
  private frameworks: Map<string, FrameworkAnalyzer>;
  
  async analyzeInfrastructure(
    config: TenantFrameworkConfig,
    infrastructure: ParsedInfrastructure
  ): Promise<MultiFrameworkResult> {
    const results = await Promise.all(
      config.frameworks.map(fw => 
        this.frameworks.get(fw.frameworkId)
          ?.analyze(infrastructure, fw.config)
      )
    );
    
    return this.aggregateResults(results, config.weights);
  }
}

// Framework-Specific Analyzers
class ServerlessLensAnalyzer implements FrameworkAnalyzer {
  async analyze(
    infrastructure: ParsedInfrastructure,
    config: FrameworkConfig
  ): Promise<FrameworkResult> {
    // Serverless-specific analysis logic
  }
}

class CSPMAnalyzer implements FrameworkAnalyzer {
  async analyze(
    infrastructure: ParsedInfrastructure,
    config: FrameworkConfig
  ): Promise<FrameworkResult> {
    // Security Hub CSPM integration
    const securityHubFindings = await this.getSecurityHubFindings();
    return this.correlateWithInfrastructure(securityHubFindings, infrastructure);
  }
}
```

## ROI分析

### 顧客価値
1. **包括的分析**: 単一ツールで複数フレームワーク対応
2. **カスタマイズ性**: 業界・企業固有の要件に対応
3. **効率性**: 重複チェックの排除、優先度付け
4. **コンプライアンス**: 規制要件への対応支援

### 技術的利点
1. **拡張性**: 新フレームワークの追加が容易
2. **保守性**: 中央管理によるルール更新の効率化
3. **再利用性**: フレームワーク間でのルール共有

### 実装コスト
- 開発工数: 約20週間（5人月相当）
- インフラコスト: 月額約$500-1000追加
- 運用コスト: フレームワーク更新作業月2-4時間

### 期待される売上効果
- 既存顧客の利用拡大: 30-50%
- 新規顧客獲得: Enterprise顧客層への訴求力向上
- 価格プレミアム: 15-25%の価格向上可能性