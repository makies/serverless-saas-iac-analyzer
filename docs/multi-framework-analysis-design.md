# マルチフレームワーク分析機能 設計書

## 1. 概要

Well-Architected Framework の6つの柱に加え、以下のフレームワークに対応する拡張分析機能を実装する：

### 対応フレームワーク
- **AWS Well-Architected Framework** (基本機能)
- **AWS Well-Architected Lenses** (特定業界・ワークロード向け)
- **AWS Service Delivery Service (SDP)** ベストプラクティス
- **AWS Competency** チェック項目
- **AWS Security Hub CSPM** 適合状況

## 2. アーキテクチャ設計

### 2.1 中央マスター管理システム

```
┌─────────────────────────────────────────────────────────────────┐
│                    Central Master System                       │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Framework      │  │  Rule Engine    │  │  Version        │ │
│  │  Repository     │  │                 │  │  Management     │ │
│  │                 │  │ • Rule Parser   │  │                 │ │
│  │ • WA Framework  │  │ • Validation    │  │ • Framework     │ │
│  │ • WA Lenses     │  │ • Scoring       │  │   Versions      │ │
│  │ • SDP Rules     │  │ • Reporting     │  │ • Rule Updates  │ │
│  │ • Competency    │  │                 │  │ • Deprecation   │ │
│  │ • CSPM Controls │  │                 │  │   Management    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tenant-Specific Configuration               │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Framework      │  │  Custom Rules   │  │  Analysis       │ │
│  │  Selection      │  │                 │  │  Profiles       │ │
│  │                 │  │ • Tenant Rules  │  │                 │ │
│  │ • Active Sets   │  │ • Overrides     │  │ • Default Set   │ │
│  │ • Priorities    │  │ • Exceptions    │  │ • Custom Sets   │ │
│  │ • Weights       │  │ • Suppressions  │  │ • Quick Scan    │ │
│  │                 │  │                 │  │ • Deep Audit    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 データモデル設計

#### Central Master Tables (DynamoDB)

**FrameworkRegistry Table**
```json
{
  "pk": "FRAMEWORK#WA_LENSES",
  "sk": "LENS#SERVERLESS",
  "frameworkType": "WA_LENSES",
  "frameworkId": "serverless",
  "name": "Serverless Lens",
  "version": "2.0",
  "description": "AWS Well-Architected Serverless Applications Lens",
  "status": "ACTIVE",
  "category": "WORKLOAD_SPECIFIC",
  "provider": "AWS",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "checksCount": 47,
  "pillars": ["reliability", "performance", "cost", "security"],
  "metadata": {
    "industry": "Technology",
    "workloadType": "Serverless",
    "complexity": "INTERMEDIATE"
  }
}
```

**RuleDefinitions Table**
```json
{
  "pk": "RULE#SERVERLESS_REL_01",
  "sk": "VERSION#2.0",
  "frameworkId": "serverless",
  "ruleId": "SERVERLESS_REL_01",
  "pillar": "reliability",
  "title": "Lambda function error handling",
  "description": "Lambda functions should implement proper error handling patterns",
  "severity": "HIGH",
  "category": "ERROR_HANDLING",
  "checkType": "CODE_ANALYSIS",
  "implementation": {
    "cloudformation": {
      "resourceTypes": ["AWS::Lambda::Function"],
      "checks": [
        {
          "property": "DeadLetterConfig",
          "condition": "EXISTS",
          "message": "Lambda function should have dead letter queue configured"
        }
      ]
    },
    "terraform": {
      "resourceTypes": ["aws_lambda_function"],
      "checks": [
        {
          "attribute": "dead_letter_config",
          "condition": "EXISTS"
        }
      ]
    }
  },
  "remediation": {
    "description": "Configure dead letter queue for Lambda function",
    "links": ["https://docs.aws.amazon.com/lambda/latest/dg/dlq.html"],
    "effort": "LOW"
  }
}
```

**TenantFrameworkConfig Table**
```json
{
  "pk": "TENANT#tenant-123",
  "sk": "FRAMEWORK_SET#production",
  "tenantId": "tenant-123",
  "setName": "production",
  "description": "Production environment analysis set",
  "frameworks": [
    {
      "frameworkId": "well-architected",
      "version": "latest",
      "pillars": ["all"],
      "weight": 0.4,
      "enabled": true
    },
    {
      "frameworkId": "serverless",
      "version": "2.0",
      "pillars": ["reliability", "performance"],
      "weight": 0.3,
      "enabled": true
    },
    {
      "frameworkId": "security-hub-cspm",
      "version": "latest",
      "controls": ["CIS_AWS", "PCI_DSS"],
      "weight": 0.3,
      "enabled": true
    }
  ],
  "customRules": [
    {
      "ruleId": "CUSTOM_TENANT_001",
      "enabled": true,
      "severity": "MEDIUM"
    }
  ],
  "isDefault": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## 3. API設計

### 3.1 Framework Management API

```typescript
// GET /frameworks
interface GetFrameworksResponse {
  frameworks: {
    id: string;
    name: string;
    type: 'WA_FRAMEWORK' | 'WA_LENSES' | 'SDP' | 'COMPETENCY' | 'CSPM';
    version: string;
    description: string;
    status: 'ACTIVE' | 'DEPRECATED' | 'BETA';
    checksCount: number;
    lastUpdated: string;
  }[];
  pagination: {
    nextToken?: string;
    totalCount: number;
  };
}

// GET /frameworks/{frameworkId}/rules
interface GetFrameworkRulesResponse {
  frameworkId: string;
  rules: FrameworkRule[];
  statistics: {
    totalRules: number;
    rulesBySeverity: Record<string, number>;
    rulesByPillar: Record<string, number>;
  };
}

// POST /tenants/{tenantId}/framework-sets
interface CreateFrameworkSetRequest {
  name: string;
  description?: string;
  frameworks: {
    frameworkId: string;
    version?: string;
    pillars?: string[];
    weight: number;
    enabled: boolean;
  }[];
  customRules?: {
    ruleId: string;
    enabled: boolean;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];
  isDefault?: boolean;
}
```

### 3.2 Enhanced Analysis API

```typescript
// POST /analyses
interface CreateAnalysisRequest {
  projectId: string;
  name: string;
  frameworkSetId?: string; // If not provided, use default
  files: {
    key: string;
    type: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK';
  }[];
  options: {
    includeSecurityHubFindings?: boolean;
    includeLiveAccountScan?: boolean;
    customWeights?: Record<string, number>;
  };
}

interface AnalysisResult {
  analysisId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: {
    currentStage: string;
    completedFrameworks: string[];
    totalFrameworks: number;
    percentComplete: number;
  };
  results?: {
    overallScore: number;
    frameworkResults: {
      frameworkId: string;
      score: number;
      weight: number;
      findings: Finding[];
      statistics: {
        totalChecks: number;
        passedChecks: number;
        failedChecks: number;
        skippedChecks: number;
      };
    }[];
    recommendations: Recommendation[];
    securityFindings?: SecurityHubFinding[];
  };
}
```

## 4. 実装計画

### 4.1 フェーズ1: 基盤実装 (4週間)

**Week 1-2: データモデル&マスター管理**
- Central Master DynamoDB テーブル設計・作成
- Framework Registry Lambda 関数実装
- Rule Definition 管理機能
- Version Management システム

**Week 3-4: 拡張分析エンジン**
- Multi-Framework Analysis Engine 実装
- Rule Engine の拡張
- Weight & Scoring システム
- Tenant Framework Configuration 管理

### 4.2 フェーズ2: フレームワーク統合 (6週間)

**Week 1-2: WA Lenses 統合**
- Serverless Lens 実装
- SaaS Lens 実装
- IoT Lens 実装
- Machine Learning Lens 実装

**Week 3-4: Security Hub CSPM 統合**
- Security Hub API 統合
- CSPM Controls マッピング
- 準拠状況分析機能
- セキュリティスコアリング

**Week 5-6: SDP & Competency 統合**
- Service Delivery Partner ベストプラクティス
- AWS Competency チェック項目
- カスタムルール定義機能

### 4.3 フェーズ3: UI/UX 拡張 (4週間)

**Week 1-2: Framework 選択 UI**
- Framework Selection ダッシュボード
- Weight Configuration 画面
- Custom Rule Definition 画面

**Week 3-4: 結果表示 UI**
- Multi-Framework Results ダッシュボード
- Comparative Analysis 画面
- Enhanced Reporting 機能

## 5. セキュリティ考慮事項

### 5.1 テナント分離
- Framework Configuration の完全な分離
- Custom Rules のテナント境界
- 分析結果の適切な分離

### 5.2 アクセス制御
- Framework Master データの読み取り専用アクセス
- Tenant Configuration の適切な権限管理
- Rule Definition の変更履歴追跡

### 5.3 データ保護
- センシティブな設定情報の暗号化
- 監査ログの完全性保証
- Personal/Company 情報の適切な扱い

## 6. パフォーマンス最適化

### 6.1 キャッシュ戦略
- Framework Definition の CloudFront キャッシュ
- Rule Engine 結果の Redis キャッシュ
- Tenant Configuration のメモリキャッシュ

### 6.2 並列処理
- Multiple Framework の並列分析
- Rule Evaluation の並列実行
- Batch 処理の最適化

### 6.3 コスト最適化
- S3 Intelligent Tiering の活用
- DynamoDB On-Demand の効率的利用
- Lambda Cold Start 最適化

## 7. モニタリング & 運用

### 7.1 メトリクス
- Framework Usage 統計
- Analysis Performance メトリクス
- Error Rate & Latency 監視

### 7.2 アラート
- Framework Update 通知
- Analysis Failure アラート
- Performance Degradation 検知

### 7.3 運用手順
- Framework Version Update 手順
- Rule Definition Deployment プロセス
- Tenant Migration 手順