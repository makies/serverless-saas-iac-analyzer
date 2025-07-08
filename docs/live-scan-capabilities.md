# ライブスキャン機能 - 分析対象詳細仕様

## 概要

ライブスキャン機能は、顧客のAWSアカウントに対してRead-OnlyのIAMロールを使用し、実際のAWSリソース構成をリアルタイムで取得・分析する機能です。デプロイ済みのリソースを直接スキャンすることで、IaCコードと実際の運用環境の差異を検出し、運用中のセキュリティ・コンプライアンス状況を継続的に監視します。

## 必要な権限

### 基本権限（全サービス共通）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:AssumeRole"
      ],
      "Resource": "*"
    }
  ]
}
```

### サービス別詳細権限

#### 1. AWS Config（推奨）
```json
{
  "Effect": "Allow",
  "Action": [
    "config:SelectResourceConfig",
    "config:GetResourceConfigHistory",
    "config:DescribeConfigurationRecorders",
    "config:DescribeDeliveryChannels"
  ],
  "Resource": "*"
}
```

#### 2. ECS（Container Services）
```json
{
  "Effect": "Allow",
  "Action": [
    "ecs:ListClusters",
    "ecs:DescribeClusters",
    "ecs:ListServices",
    "ecs:DescribeServices",
    "ecs:ListTasks",
    "ecs:DescribeTasks",
    "ecs:ListTaskDefinitions",
    "ecs:DescribeTaskDefinition",
    "ecs:ListContainerInstances",
    "ecs:DescribeContainerInstances",
    "ecs:ListAccountSettings",
    "ecs:DescribeCapacityProviders",
    "ec2:DescribeSecurityGroups",
    "ec2:DescribeVpcs",
    "ec2:DescribeSubnets",
    "logs:DescribeLogGroups",
    "logs:DescribeLogStreams"
  ],
  "Resource": "*"
}
```

#### 3. S3（Storage Services）
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:ListAllMyBuckets",
    "s3:GetBucketLocation",
    "s3:GetBucketVersioning",
    "s3:GetBucketEncryption",
    "s3:GetBucketPolicy",
    "s3:GetBucketPolicyStatus",
    "s3:GetBucketPublicAccessBlock",
    "s3:GetBucketLogging",
    "s3:GetBucketNotification",
    "s3:GetBucketReplication",
    "s3:GetBucketRequestPayment",
    "s3:GetBucketTagging",
    "s3:GetBucketWebsite",
    "s3:GetLifecycleConfiguration",
    "s3:GetBucketCors"
  ],
  "Resource": "*"
}
```

#### 4. Lambda（Serverless Services）
```json
{
  "Effect": "Allow",
  "Action": [
    "lambda:ListFunctions",
    "lambda:GetFunction",
    "lambda:GetFunctionConfiguration",
    "lambda:GetPolicy",
    "lambda:ListEventSourceMappings",
    "lambda:ListLayers",
    "lambda:GetLayerVersion",
    "lambda:ListAliases",
    "lambda:ListVersionsByFunction"
  ],
  "Resource": "*"
}
```

#### 5. RDS（Database Services）
```json
{
  "Effect": "Allow",
  "Action": [
    "rds:DescribeDBInstances",
    "rds:DescribeDBClusters",
    "rds:DescribeDBSubnetGroups",
    "rds:DescribeDBParameterGroups",
    "rds:DescribeDBClusterParameterGroups",
    "rds:DescribeDBSnapshots",
    "rds:DescribeDBClusterSnapshots",
    "rds:DescribeDBSecurityGroups",
    "rds:DescribeEventSubscriptions",
    "rds:DescribeDBLogFiles"
  ],
  "Resource": "*"
}
```

#### 6. IAM（Identity & Access Management）
```json
{
  "Effect": "Allow",
  "Action": [
    "iam:ListRoles",
    "iam:ListUsers",
    "iam:ListGroups",
    "iam:ListPolicies",
    "iam:GetRole",
    "iam:GetUser",
    "iam:GetGroup",
    "iam:GetPolicy",
    "iam:GetPolicyVersion",
    "iam:ListAttachedRolePolicies",
    "iam:ListAttachedUserPolicies",
    "iam:ListAttachedGroupPolicies",
    "iam:ListRolePolicies",
    "iam:ListUserPolicies",
    "iam:ListGroupPolicies",
    "iam:GetRolePolicy",
    "iam:GetUserPolicy",
    "iam:GetGroupPolicy",
    "iam:ListInstanceProfiles",
    "iam:GetAccountSummary",
    "iam:GetAccountPasswordPolicy"
  ],
  "Resource": "*"
}
```

#### 7. Organizations（アカウント管理）
```json
{
  "Effect": "Allow",
  "Action": [
    "organizations:DescribeOrganization",
    "organizations:DescribeAccount",
    "organizations:ListAccounts",
    "organizations:ListRoots",
    "organizations:ListOrganizationalUnitsForParent",
    "organizations:ListAccountsForParent",
    "organizations:DescribeOrganizationalUnit",
    "organizations:ListPolicies",
    "organizations:DescribePolicy",
    "organizations:ListPoliciesForTarget",
    "organizations:ListTargetsForPolicy",
    "organizations:DescribeEffectivePolicy",
    "organizations:ListTagsForResource"
  ],
  "Resource": "*"
}
```

#### 8. Support（サポートプラン・契約状況）
```json
{
  "Effect": "Allow",
  "Action": [
    "support:DescribeSeverityLevels",
    "support:DescribeTrustedAdvisorChecks",
    "support:DescribeCases",
    "support:DescribeServices",
    "support:DescribeCommunications"
  ],
  "Resource": "*"
}
```

## 分析対象リソース

### 1. Container Services（ECS）

#### ECS Clusters
- **チェック項目**:
  - クラスター設定の適正性
  - Fargate vs EC2起動タイプ選択
  - 容量プロバイダー設定
  - クラスターレベルログ設定
  - コンテナインサイト有効化
  - タグ付けポリシー準拠
  - クラスターの適切な分離

#### ECS Services
- **チェック項目**:
  - サービス設定の最適化
  - 目標タスク数の適正性
  - デプロイメント設定
  - ロードバランサー統合
  - 自動スケーリング設定
  - ヘルスチェック設定
  - ネットワーク設定（awsvpc）
  - セキュリティグループ設定

#### Task Definitions
- **チェック項目**:
  - CPUとメモリ設定の適正性
  - 実行ロール・タスクロール設定
  - ネットワークモード設定
  - ログ設定（CloudWatch Logs）
  - 環境変数のセキュリティ
  - シークレット管理
  - ヘルスチェック設定
  - コンテナイメージのセキュリティ

#### Container Security
- **チェック項目**:
  - 最小権限実行ユーザー
  - 読み取り専用ルートファイルシステム
  - privileged実行の回避
  - capabilities の最小化
  - ポートマッピングの適正性
  - tmpfs マウント設定
  - ulimits設定

#### Fargate Configuration
- **チェック項目**:
  - プラットフォームバージョン
  - 実行時間最適化
  - ネットワーク設定
  - セキュリティグループ設定
  - サブネット配置戦略
  - パブリックIP割り当て
  - EFS統合設定

#### Networking & Security
- **チェック項目**:
  - VPC設定の適正性
  - サブネット分離戦略
  - セキュリティグループ設計
  - NACLによる多層防御
  - サービスメッシュ統合
  - ロードバランサー設定
  - VPCフローログ有効化

### 2. Storage Services（S3）

#### S3 Buckets
- **チェック項目**:
  - バケット暗号化設定（AES-256、KMS）
  - パブリックアクセスブロック設定
  - バケットポリシーのセキュリティ
  - バージョニング有効化
  - MFA削除設定
  - アクセスログ記録
  - ライフサイクル管理
  - レプリケーション設定
  - 静的ウェブサイトホスティング設定
  - CORS設定
  - 通知設定

### 3. Serverless Services（Lambda）

#### Lambda Functions
- **チェック項目**:
  - ランタイムバージョンの最新性
  - メモリ・タイムアウト設定の適正性
  - 環境変数のセキュリティ
  - VPC設定の必要性
  - 実行ロール権限の最小化
  - デッドレターキュー設定
  - 予約済み同時実行数
  - X-Rayトレーシング有効化
  - エラーハンドリング設定

#### Lambda Layers
- **チェック項目**:
  - レイヤーバージョン管理
  - 互換性設定
  - サイズ最適化
  - 共有ライブラリのセキュリティ

### 4. Database Services（RDS）

#### RDS Instances
- **チェック項目**:
  - インスタンスクラスの適正性
  - ストレージ暗号化
  - バックアップ設定（保持期間、ウィンドウ）
  - マルチAZ配置
  - 自動マイナーバージョンアップデート
  - パフォーマンスインサイト有効化
  - 監視・ログ設定
  - パラメータグループ設定
  - セキュリティグループ設定
  - サブネットグループ設定

#### RDS Clusters（Aurora）
- **チェック項目**:
  - クラスター構成の冗長性
  - 読み取りレプリカ配置
  - バックトラッキング設定
  - 並列クエリ有効化
  - グローバルデータベース設定

### 5. Identity & Access Management（IAM）

#### IAM Roles
- **チェック項目**:
  - 信頼関係の適正性
  - 権限の最小化原則
  - 管理ポリシーvs.インラインポリシー
  - AssumeRoleポリシーのセキュリティ
  - パスワードポリシー
  - MFA設定
  - 未使用ロール検出
  - 権限境界設定

#### IAM Policies
- **チェック項目**:
  - ワイルドカード（*）の適切な使用
  - リソース指定の詳細度
  - 条件設定の活用
  - 管理ポリシーの最新性
  - カスタムポリシーの必要性

#### IAM Users & Groups
- **チェック項目**:
  - プログラムアクセス vs. コンソールアクセス
  - アクセスキーのローテーション
  - 未使用認証情報
  - グループベース権限管理
  - 最終アクセス時間

### 6. CloudFormation Stacks

#### Stack Management
- **チェック項目**:
  - スタック状態の健全性
  - ドリフト検出
  - スタック更新履歴
  - ロールバック設定
  - 削除保護設定
  - タグ戦略
  - ネストされたスタック構造
  - テンプレートのベストプラクティス

### 7. Organizations（アカウント管理）

#### Organization Structure
- **チェック項目**:
  - 組織の基本情報・設定
  - マスターアカウント情報
  - 機能セット（ALL_FEATURES vs CONSOLIDATED_BILLING）
  - 組織構造の可視化
  - アカウント階層構造
  - OU（Organizational Unit）設計
  - アカウント移動履歴

#### Account Management
- **チェック項目**:
  - アカウント一覧・ステータス
  - アカウント作成日・作成者
  - アカウント名・メールアドレス
  - アカウントタグ戦略
  - アカウント階層構造
  - アカウント間の関係性
  - 未使用・休眠アカウント検出

#### Service Control Policies (SCP)
- **チェック項目**:
  - SCP適用状況
  - ポリシー階層の継承
  - 権限制限の妥当性
  - デニーポリシーの効果範囲
  - ポリシー競合・重複
  - 最小権限原則の実装
  - セキュリティガードレール

#### Governance & Compliance
- **チェック項目**:
  - 組織レベルのガバナンス
  - コンプライアンス要件適合
  - アカウント作成承認プロセス
  - リソース利用ポリシー
  - タグ付けポリシー適用
  - バックアップポリシー
  - 課金・コスト管理ポリシー

#### Multi-Account Strategy
- **チェック項目**:
  - ワークロード分離戦略
  - 環境分離（Dev/Stage/Prod）
  - セキュリティ境界設計
  - 障害影響範囲の分離
  - アカウント間通信設計
  - 共有リソース戦略
  - マルチアカウント監視

### 8. Support（サポートプラン・契約状況）

#### Support Plan Detection
- **チェック項目**:
  - サポートプラン種別（Basic/Developer/Business/Enterprise）
  - Trusted Advisor機能アクセス権限
  - ケース管理機能の利用可否
  - 利用可能なサポートチャネル
  - レスポンス時間・SLA確認
  - アーキテクチャレビュー利用可否
  - インフラストラクチャイベント管理

#### Support Services Access
- **チェック項目**:
  - Trusted Advisor チェック項目数
  - 利用可能なサポート機能一覧
  - ケース作成・管理権限
  - 技術サポート範囲
  - 24時間サポート可否
  - 電話サポート利用可否
  - チャットサポート利用可否

#### Business Impact Assessment
- **チェック項目**:
  - サポートプランとビジネス要件の適合性
  - ミッションクリティカルシステムの保護レベル
  - 障害対応時間要件との適合性
  - コスト対効果の評価
  - サポートプラン変更推奨事項
  - 追加サポートサービス推奨

#### Trusted Advisor Integration
- **チェック項目**:
  - 利用可能なTrusted Advisorチェック
  - セキュリティ推奨事項の実行状況
  - パフォーマンス最適化提案
  - コスト最適化提案
  - 可用性・冗長性改善提案
  - サービス制限監視状況

### 9. Monitoring & Logging Services

#### CloudWatch
- **チェック項目**:
  - カスタムメトリクス設定
  - アラーム設定の適正性
  - ログ保持期間
  - ログ暗号化
  - ダッシュボード設定

#### CloudTrail
- **チェック項目**:
  - 証跡の有効化状況
  - S3バケット設定
  - ログファイル検証
  - 暗号化設定
  - マルチリージョン設定

## 分析フレームワーク

### 1. AWS Well-Architected Framework

#### Operational Excellence（運用上の優秀性）
- **自動化**: 運用タスクの自動化度
- **監視**: リソース監視・アラート設定
- **文書化**: タグ付け、ドキュメント整備
- **運用手順**: 標準化された運用プロセス

#### Security（セキュリティ）
- **Identity & Access Management**: 最小権限原則
- **Detection**: ログ記録・監視体制
- **Infrastructure Protection**: ネットワーク・ホストレベル保護
- **Data Protection**: 保存時・転送時暗号化
- **Incident Response**: インシデント対応準備

#### Reliability（信頼性）
- **Change Management**: 変更管理プロセス
- **Failure Management**: 障害対応・回復手順
- **Foundations**: アーキテクチャ基盤設計
- **Recovery**: バックアップ・復旧戦略

#### Performance Efficiency（パフォーマンス効率）
- **Selection**: 適切なリソースタイプ選択
- **Review**: 継続的なパフォーマンス評価
- **Monitoring**: パフォーマンス監視
- **Evolution**: 技術進歩への適応

#### Cost Optimization（コスト最適化）
- **Expenditure Awareness**: コスト可視化
- **Cost-Effective Resources**: コスト効率的リソース選択
- **Matching Supply & Demand**: 需要と供給の最適化
- **Optimizing Over Time**: 継続的コスト最適化

#### Sustainability（持続可能性）
- **Region Selection**: 地域選択による環境負荷軽減
- **Alignment to Demand**: 需要に応じたリソース調整
- **Software and Architecture**: 効率的なソフトウェア設計
- **Data**: データライフサイクル管理

### 2. AWS Security Hub Controls

#### CIS AWS Foundations Benchmark
- IAM設定のベストプラクティス
- ログ記録・監視要件
- ネットワーキングセキュリティ

#### AWS Foundational Security Standard
- 各AWSサービスの基本セキュリティ設定
- 業界標準への準拠確認

#### PCI DSS（Payment Card Industry Data Security Standard）
- 決済カード業界のセキュリティ基準
- データ保護要件

### 3. AWS Trusted Advisor
- **Cost Optimization**: 未使用リソース検出
- **Performance**: パフォーマンス改善提案
- **Security**: セキュリティ設定チェック
- **Fault Tolerance**: 可用性向上提案
- **Service Limits**: サービス制限監視

## スキャン実行プロセス

### 1. 事前準備
1. **IAMロール設定**: 顧客環境でのRead-Onlyロール作成
2. **クロスアカウントアクセス**: 信頼関係設定
3. **スキャンスコープ定義**: 対象サービス・リージョン選択
4. **フレームワーク選択**: 適用する分析フレームワーク指定

### 2. スキャン実行
1. **認証**: AssumeRoleによる一時的認証情報取得
2. **リソース検出**: 各サービスAPIを使用したリソース情報取得
3. **設定取得**: リソース詳細設定の収集
4. **データ正規化**: 統一フォーマットでのデータ整理

### 3. 分析・レポート生成
1. **AI分析**: Claude 4による包括的分析
2. **フレームワーク適用**: 選択されたフレームワークでの評価
3. **優先度付け**: ビジネス影響度・修正難易度による優先順位付け
4. **レポート生成**: 詳細分析結果とアクションプラン提供

## セキュリティ考慮事項

### 1. アクセス制御
- **Read-Only権限**: 書き込み操作は一切実行しない
- **最小権限原則**: 必要最小限の権限のみ要求
- **一時的認証**: AssumeRoleによる一時的アクセス
- **監査ログ**: 全てのAPI呼び出しをCloudTrailで記録

### 2. データ保護
- **暗号化**: 取得データの暗号化保存
- **テナント分離**: マルチテナント環境での完全データ分離
- **保存期間**: 90日間の自動削除
- **アクセス制御**: プロジェクトベースのアクセス制限

### 3. ネットワークセキュリティ
- **VPC設定**: 必要に応じたVPC内実行
- **通信暗号化**: HTTPS/TLS通信の強制
- **プライベート接続**: VPC Endpointを通じたAWS API アクセス

## 制限事項

### 1. 技術的制限
- **API制限**: AWS APIのスロットリング制限
- **権限依存**: 顧客から提供された権限の範囲内
- **リージョン制限**: 有効化されたリージョンのみ
- **サービス制限**: 対応サービスの段階的拡張

### 2. コンプライアンス制限
- **データ主権**: 顧客データの地理的制約
- **規制要件**: 業界固有の規制要件への対応
- **プライバシー**: 個人情報の取り扱い制限

## サポート対象拡張計画

### Phase 1（現在）
- ECS, S3, Lambda, RDS, IAM, CloudFormation, Organizations, Support

### Phase 2（今後3ヶ月）
- EC2, API Gateway, CloudFront, Route53
- DynamoDB, ElastiCache, Elasticsearch

### Phase 3（今後6ヶ月）
- SNS, SQS, EventBridge, Step Functions
- CodePipeline, CodeBuild, CodeDeploy
- Systems Manager, Secrets Manager

### Phase 4（今後1年）
- Control Tower, Config
- Security Hub, GuardDuty, Inspector
- Cost Explorer, Billing Analytics