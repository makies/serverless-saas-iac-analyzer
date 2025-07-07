# データフローアーキテクチャドキュメント

## 概要

CloudBestPracticeAnalyzer は、マルチテナント対応のServerless SaaS IaC Analyzerとして、複数のAWSサービスを組み合わせて包括的なデータフローを実現しています。本ドキュメントでは、システム全体のデータフロー、各コンポーネント間の相互作用、および主要な処理パターンについて詳述します。

## システムアーキテクチャ概要

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React Frontend<br/>Cloudscape Design]
        RUM[CloudWatch RUM<br/>Real User Monitoring]
    end

    subgraph "API Gateway Layer"
        APPSYNC[AWS AppSync<br/>GraphQL API]
        COGNITO[Amazon Cognito<br/>User Pool]
    end

    subgraph "Compute Layer"
        LAMBDA[Lambda Functions<br/>Node.js 22.x]
        SF[Step Functions<br/>Workflow Engine]
    end

    subgraph "Storage Layer"
        DDB[DynamoDB<br/>Multi-tenant Tables]
        S3[S3 Buckets<br/>File Storage]
    end

    subgraph "AI/ML Layer"
        BEDROCK[Amazon Bedrock<br/>Claude 4 Sonnet]
    end

    subgraph "Monitoring Layer"
        CW[CloudWatch<br/>Metrics & Logs]
        XRAY[X-Ray<br/>Distributed Tracing]
        SNS[SNS<br/>Alert Notifications]
    end

    UI --> APPSYNC
    APPSYNC --> COGNITO
    APPSYNC --> LAMBDA
    LAMBDA --> SF
    LAMBDA --> DDB
    LAMBDA --> S3
    LAMBDA --> BEDROCK
    SF --> LAMBDA
    LAMBDA --> CW
    LAMBDA --> XRAY
    CW --> SNS
    UI --> RUM
    RUM --> CW
```

## 主要データフロー

### 1. ユーザー認証・認可フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant Cognito as Cognito User Pool
    participant AppSync as AppSync API
    participant Lambda as Lambda Resolver

    User->>UI: ログイン要求
    UI->>Cognito: 認証情報送信
    Cognito->>Cognito: ユーザー検証
    Cognito-->>UI: JWT トークン返却
    UI->>AppSync: GraphQL要求（JWT付き）
    AppSync->>AppSync: JWT検証
    AppSync->>Lambda: 認証済み要求転送
    Lambda->>Lambda: テナント権限チェック
    Lambda-->>AppSync: レスポンス
    AppSync-->>UI: GraphQL レスポンス
```

**データポイント:**
- **入力**: ユーザー認証情報（Email/Password）
- **中間**: JWT トークン、テナントID、ユーザーロール
- **出力**: 認証済みセッション、ユーザープロファイル
- **ストレージ**: Users テーブル（DynamoDB）

### 2. IaC分析実行フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant AppSync as AppSync API
    participant CreateAnalysis as Create Analysis<br/>Lambda
    participant S3 as S3 Storage
    participant StepFunctions as Step Functions<br/>Workflow
    participant FrameworkEngine as Framework<br/>Analysis Engine
    participant Bedrock as Amazon Bedrock
    participant DDB as DynamoDB

    User->>UI: 分析開始要求
    UI->>AppSync: createAnalysis Mutation
    AppSync->>CreateAnalysis: 分析作成要求
    CreateAnalysis->>DDB: 分析レコード作成
    CreateAnalysis->>S3: IaCファイルアップロード
    CreateAnalysis->>StepFunctions: ワークフロー開始
    
    StepFunctions->>FrameworkEngine: フレームワーク初期化
    FrameworkEngine->>DDB: フレームワーク設定取得
    FrameworkEngine-->>StepFunctions: 初期化完了
    
    StepFunctions->>FrameworkEngine: 分析実行
    FrameworkEngine->>S3: IaCファイル読み込み
    FrameworkEngine->>Bedrock: AI分析要求
    Bedrock-->>FrameworkEngine: 分析結果
    FrameworkEngine->>DDB: 発見事項保存
    FrameworkEngine->>S3: 結果ファイル保存
    FrameworkEngine-->>StepFunctions: 分析完了
    
    StepFunctions->>DDB: 分析ステータス更新
    StepFunctions-->>CreateAnalysis: ワークフロー完了
    CreateAnalysis-->>AppSync: 分析ID返却
    AppSync-->>UI: 分析開始確認
```

**データポイント:**
- **入力**: IaCファイル（CloudFormation/Terraform/CDK）、分析設定
- **中間**: ワークフロー状態、フレームワーク設定、AI分析結果
- **出力**: 分析レポート、発見事項、推奨事項
- **ストレージ**: 
  - Analyses テーブル（分析メタデータ）
  - Findings テーブル（発見事項詳細）
  - S3（IaCファイル、結果ファイル）

### 3. マルチフレームワーク分析フロー

```mermaid
graph TD
    subgraph "Framework Registry"
        FR[Framework Registry<br/>テーブル]
        RD[Rule Definitions<br/>テーブル]
        TFC[Tenant Framework Config<br/>テーブル]
    end

    subgraph "Analysis Engine"
        FI[Framework<br/>Initialization]
        FE[Framework<br/>Execution Engine]
        RV[Rule<br/>Validator]
    end

    subgraph "Rule Implementation Types"
        JS[JavaScript Rules]
        BEDROCK[Bedrock AI Rules]
        CFN[CFN Guard Rules]
        PYTHON[Python Rules]
        OPA[OPA Rules]
    end

    subgraph "Output Processing"
        RP[Result<br/>Processor]
        FG[Finding<br/>Generator]
        RM[Report<br/>Merger]
    end

    FR --> FI
    RD --> FI
    TFC --> FI
    FI --> FE
    FE --> JS
    FE --> BEDROCK
    FE --> CFN
    FE --> PYTHON
    FE --> OPA
    JS --> RV
    BEDROCK --> RV
    CFN --> RV
    PYTHON --> RV
    OPA --> RV
    RV --> RP
    RP --> FG
    FG --> RM
```

**フレームワーク処理順序:**
1. **Well-Architected Framework**: 6つの柱による基本分析
2. **Security Hub CSPM**: セキュリティ関連チェック
3. **Service Delivery Practices**: 運用ベストプラクティス
4. **AWS Competency**: 認定要件チェック
5. **Custom Framework**: テナント固有ルール

### 4. レポート生成フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant AppSync as AppSync API
    participant GenerateReport as Generate Report<br/>Lambda
    participant StepFunctions as Step Functions<br/>Report Workflow
    participant ReportEngine as Report<br/>Generation Engine
    participant S3 as S3 Storage
    participant DDB as DynamoDB

    User->>UI: レポート生成要求
    UI->>AppSync: generateReport Mutation
    AppSync->>GenerateReport: レポート生成開始
    GenerateReport->>DDB: レポートレコード作成
    GenerateReport->>StepFunctions: レポートワークフロー開始
    
    StepFunctions->>ReportEngine: データ収集
    ReportEngine->>DDB: 分析データ取得
    ReportEngine->>DDB: 発見事項取得
    ReportEngine-->>StepFunctions: データ収集完了
    
    StepFunctions->>ReportEngine: レポート生成
    ReportEngine->>ReportEngine: テンプレート適用
    ReportEngine->>ReportEngine: 図表生成
    ReportEngine->>S3: レポートファイル保存
    ReportEngine-->>StepFunctions: 生成完了
    
    StepFunctions->>DDB: レポートステータス更新
    StepFunctions-->>GenerateReport: ワークフロー完了
    GenerateReport-->>AppSync: ダウンロードURL返却
    AppSync-->>UI: レポート準備完了
```

**レポート形式:**
- **PDF**: エグゼクティブサマリー
- **Excel**: 詳細分析データ
- **JSON**: API連携用データ
- **HTML**: Web表示用レポート

### 5. リアルタイム監視・アラートフロー

```mermaid
graph LR
    subgraph "Data Sources"
        LAMBDA_METRICS[Lambda Metrics]
        APPSYNC_METRICS[AppSync Metrics]
        RUM_METRICS[RUM Metrics]
        CUSTOM_METRICS[Custom Metrics]
    end

    subgraph "CloudWatch"
        CW_METRICS[CloudWatch<br/>Metrics]
        CW_ALARMS[CloudWatch<br/>Alarms]
        CW_DASHBOARD[CloudWatch<br/>Dashboard]
    end

    subgraph "Alerting"
        SNS_TOPIC[SNS Topic]
        EMAIL[Email<br/>Notifications]
        SLACK[Slack<br/>Notifications]
    end

    subgraph "Tracing"
        XRAY[X-Ray<br/>Traces]
        CORRELATION[Correlation<br/>IDs]
    end

    LAMBDA_METRICS --> CW_METRICS
    APPSYNC_METRICS --> CW_METRICS
    RUM_METRICS --> CW_METRICS
    CUSTOM_METRICS --> CW_METRICS
    
    CW_METRICS --> CW_ALARMS
    CW_METRICS --> CW_DASHBOARD
    CW_ALARMS --> SNS_TOPIC
    SNS_TOPIC --> EMAIL
    SNS_TOPIC --> SLACK
    
    LAMBDA_METRICS --> XRAY
    APPSYNC_METRICS --> XRAY
    XRAY --> CORRELATION
```

**監視メトリクス:**
- **パフォーマンス**: レスポンス時間、スループット、エラー率
- **ビジネス**: 分析実行数、テナント数、クォータ使用率
- **インフラ**: Lambda実行時間、DynamoDB消費容量、S3使用量
- **ユーザー体験**: RUMメトリクス、Core Web Vitals

## テナント分離データフロー

### マルチテナント アクセス制御

```mermaid
graph TD
    subgraph "Request Flow"
        USER[ユーザー要求]
        JWT[JWT Token<br/>検証]
        TENANT[テナントID<br/>抽出]
        AUTHZ[認可チェック]
    end

    subgraph "Data Access"
        FILTER[テナントフィルタ]
        QUERY[DynamoDB Query]
        RESPONSE[レスポンス]
    end

    subgraph "Security Layers"
        IAM[IAM Policy]
        APPSYNC_AUTH[AppSync認可]
        LAMBDA_AUTH[Lambda認可]
        ROW_LEVEL[Row-Level Security]
    end

    USER --> JWT
    JWT --> TENANT
    TENANT --> AUTHZ
    AUTHZ --> FILTER
    FILTER --> QUERY
    QUERY --> RESPONSE
    
    IAM --> APPSYNC_AUTH
    APPSYNC_AUTH --> LAMBDA_AUTH
    LAMBDA_AUTH --> ROW_LEVEL
    ROW_LEVEL --> FILTER
```

**テナント分離の実装:**
1. **JWT レベル**: Cognitoでテナント情報を含むトークン発行
2. **AppSync レベル**: GraphQLフィールドレベルの認可
3. **Lambda レベル**: 関数内でのテナントフィルタリング
4. **DynamoDB レベル**: 全クエリにテナントIDを必須化

### データアクセスパターン

```mermaid
graph LR
    subgraph "Access Patterns"
        TENANT_ISOLATION[テナント分離<br/>パターン]
        PROJECT_SCOPE[プロジェクト<br/>スコープ]
        USER_PERMISSION[ユーザー権限<br/>ベース]
        ADMIN_CROSS[管理者横断<br/>アクセス]
    end

    subgraph "DynamoDB Design"
        PK[Partition Key<br/>tenantId]
        SK[Sort Key<br/>entityId]
        GSI[GSI<br/>アクセスパターン]
        FILTER[FilterExpression<br/>追加制御]
    end

    TENANT_ISOLATION --> PK
    PROJECT_SCOPE --> SK
    USER_PERMISSION --> GSI
    ADMIN_CROSS --> FILTER
```

## データ永続化戦略

### DynamoDB テーブル設計

| テーブル名 | 主要用途 | アクセスパターン | 分離方法 |
|------------|----------|------------------|----------|
| Tenants | テナント管理 | Admin横断参照 | 管理者権限制御 |
| Projects | プロジェクト管理 | テナント内参照 | tenantId PK |
| Analyses | 分析管理 | プロジェクト内参照 | tenantId + projectId |
| Findings | 発見事項 | 分析内参照 | tenantId + analysisId |
| Reports | レポート管理 | プロジェクト内参照 | tenantId + projectId |
| Users | ユーザー管理 | テナント内参照 | tenantId PK |
| FrameworkRegistry | フレームワーク | Global共有 | バージョン管理 |
| RuleDefinitions | ルール定義 | フレームワーク内 | バージョン管理 |
| TenantFrameworkConfig | テナント設定 | テナント内参照 | tenantId PK |
| TenantAnalytics | 分析統計 | テナント内参照 | tenantId PK |
| GlobalAnalytics | システム統計 | Admin専用 | 管理者権限制御 |

### S3 データ組織化

```
application-data-bucket/
├── tenants/
│   ├── {tenantId}/
│   │   ├── projects/
│   │   │   ├── {projectId}/
│   │   │   │   ├── analyses/
│   │   │   │   │   ├── {analysisId}/
│   │   │   │   │   │   ├── input/          # IaCファイル
│   │   │   │   │   │   ├── output/         # 分析結果
│   │   │   │   │   │   └── reports/        # 生成レポート
│   │   │   │   │   └── ...
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── settings/                       # テナント設定
│   └── ...
├── frameworks/                             # フレームワーク定義（共有）
│   ├── well-architected/
│   ├── security-hub/
│   └── custom/
└── templates/                              # レポートテンプレート（共有）
    ├── pdf/
    ├── excel/
    └── html/
```

## パフォーマンス最適化

### 1. DynamoDB 最適化

- **読み取りパターン**: Hot Partitionを避ける分散設計
- **書き込みパターン**: Batch操作でスループット向上
- **GSI設計**: クエリパターンに最適化されたインデックス
- **TTL**: 期限切れデータの自動削除

### 2. Lambda 最適化

- **コールドスタート対策**: Provisioned Concurrency（本番環境）
- **メモリ設定**: CPU性能とコスト最適化
- **レイヤー活用**: 共通ライブラリの効率的共有
- **バンドルサイズ**: esbuildによる最適化

### 3. S3 最適化

- **プレフィックス**: 並列処理を考慮した分散
- **圧縮**: 大容量ファイルの効率的保存
- **ライフサイクル**: 古いデータの自動アーカイブ
- **転送高速化**: CloudFront経由でのダウンロード

## セキュリティデータフロー

### 1. 認証・認可チェーン

```
User Request → Cognito JWT → AppSync Authorization → Lambda Execution → DynamoDB Access
     ↓              ↓                ↓                      ↓               ↓
WAF Protection → JWT Validation → Field Authorization → Tenant Filtering → Row Security
```

### 2. データ暗号化

- **転送時**: HTTPS/TLS 1.3（全通信）
- **保存時**: DynamoDB暗号化、S3暗号化（KMS）
- **メモリ内**: 機密データの適切なライフサイクル管理

### 3. 監査・コンプライアンス

- **CloudTrail**: API呼び出しログ
- **DynamoDB Streams**: データ変更監査
- **X-Ray**: リクエストトレーシング
- **カスタムログ**: ビジネスロジック監査

## 運用・監視データフロー

### メトリクス収集パイプライン

```mermaid
graph TB
    subgraph "Application Layer"
        LAMBDA_LOGS[Lambda Logs]
        APPSYNC_LOGS[AppSync Logs]
        CUSTOM_METRICS[Custom Metrics]
    end

    subgraph "Infrastructure Layer"
        DDB_METRICS[DynamoDB Metrics]
        S3_METRICS[S3 Metrics]
        COGNITO_METRICS[Cognito Metrics]
    end

    subgraph "Frontend Layer"
        RUM_METRICS_2[RUM Metrics]
        BROWSER_LOGS[Browser Logs]
    end

    subgraph "Processing Layer"
        CW_AGENT[CloudWatch Agent]
        LOG_INSIGHTS[CloudWatch Insights]
        XRAY_TRACES[X-Ray Traces]
    end

    subgraph "Analytics Layer"
        DASHBOARDS[Dashboards]
        ALARMS[Alarms]
        REPORTS_2[Analytics Reports]
    end

    LAMBDA_LOGS --> CW_AGENT
    APPSYNC_LOGS --> CW_AGENT
    CUSTOM_METRICS --> CW_AGENT
    DDB_METRICS --> CW_AGENT
    S3_METRICS --> CW_AGENT
    COGNITO_METRICS --> CW_AGENT
    RUM_METRICS_2 --> CW_AGENT
    BROWSER_LOGS --> LOG_INSIGHTS
    
    CW_AGENT --> XRAY_TRACES
    CW_AGENT --> DASHBOARDS
    LOG_INSIGHTS --> DASHBOARDS
    XRAY_TRACES --> DASHBOARDS
    
    DASHBOARDS --> ALARMS
    DASHBOARDS --> REPORTS_2
```

## エラーハンドリング・復旧フロー

### 1. エラー分類と対応

| エラータイプ | 検出方法 | 対応策 | 復旧手順 |
|-------------|---------|--------|---------|
| 認証エラー | JWT検証失敗 | 再認証促す | トークンリフレッシュ |
| 認可エラー | テナントアクセス違反 | アクセス拒否 | 権限確認・修正 |
| ビジネスロジックエラー | バリデーション失敗 | エラーメッセージ表示 | 入力値修正 |
| インフラエラー | サービス障害 | 自動リトライ | 障害復旧待機 |
| データ整合性エラー | DynamoDB制約違反 | トランザクション中止 | データ修正・再実行 |

### 2. 自動復旧メカニズム

```mermaid
graph TD
    ERROR[エラー検出] --> CLASSIFY[エラー分類]
    CLASSIFY --> RETRIABLE{リトライ可能?}
    RETRIABLE -->|Yes| RETRY[自動リトライ]
    RETRIABLE -->|No| ALERT[アラート送信]
    RETRY --> SUCCESS{成功?}
    SUCCESS -->|Yes| COMPLETE[処理完了]
    SUCCESS -->|No| BACKOFF[指数バックオフ]
    BACKOFF --> RETRY
    ALERT --> MANUAL[手動対応]
    MANUAL --> RESOLVE[問題解決]
```

## まとめ

CloudBestPracticeAnalyzer のデータフローは、以下の主要な特徴を持ちます：

1. **完全なテナント分離**: あらゆるレベルでのデータ分離
2. **スケーラブル設計**: サーバーレスアーキテクチャによる自動スケーリング
3. **堅牢なセキュリティ**: 多層防御によるセキュリティ確保
4. **包括的監視**: リアルタイム監視とアラート
5. **高度な分析**: AIを活用したマルチフレームワーク分析
6. **運用効率**: 自動化された運用・保守プロセス

このアーキテクチャにより、企業向けSaaSとして求められる信頼性、セキュリティ、パフォーマンスを実現しています。