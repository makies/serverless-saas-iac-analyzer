# DynamoDB テーブル定義ドキュメント

## 概要

CloudBestPracticeAnalyzer では、マルチテナント対応のSaaSアプリケーションとして、完全なデータ分離を実現するためにDynamoDBテーブルを使用しています。各テーブルは、テナント分離、セキュリティ、スケーラビリティを考慮して設計されています。

## テーブル一覧

### 1. Tenants テーブル
**目的**: テナント（顧客企業）の基本情報管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| id | String | PK | テナントID (UUID) |
| name | String | - | テナント名 |
| status | String | GSI(PK) | テナントステータス (ACTIVE, SUSPENDED, INACTIVE) |
| tier | String | - | サービスティア (BASIC, PREMIUM, ENTERPRISE) |
| settings | Object | - | テナント固有設定 |
| createdAt | String | GSI(SK) | 作成日時 (ISO 8601) |
| updatedAt | String | - | 更新日時 (ISO 8601) |
| contactEmail | String | - | 主要連絡先メールアドレス |

**GSI**:
- ByStatus: status(PK) + createdAt(SK)

### 2. Projects テーブル  
**目的**: テナント内のプロジェクト管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| id | String | PK | プロジェクトID (UUID) |
| tenantId | String | GSI1(PK) | 所属テナントID |
| name | String | - | プロジェクト名 |
| description | String | - | プロジェクト説明 |
| status | String | GSI2(PK) | プロジェクトステータス (ACTIVE, ARCHIVED, DELETED) |
| awsAccountIds | List | - | 関連AWSアカウントIDリスト |
| members | List | - | プロジェクトメンバーリスト |
| createdAt | String | GSI1(SK) | 作成日時 |
| updatedAt | String | GSI2(SK) | 更新日時 |
| createdBy | String | - | 作成者ユーザーID |

**GSI**:
- ByTenant: tenantId(PK) + createdAt(SK)
- ByStatus: status(PK) + updatedAt(SK)

### 3. Analyses テーブル
**目的**: IaC分析実行の管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| id | String | PK | 分析ID (UUID) |
| tenantId | String | GSI1(PK) | 所属テナントID |
| projectId | String | GSI2(PK) | 所属プロジェクトID |
| name | String | - | 分析名 |
| type | String | - | 分析タイプ (IaC_SCAN, LIVE_SCAN) |
| status | String | GSI3(PK) | 分析ステータス (PENDING, RUNNING, COMPLETED, FAILED) |
| frameworks | List | - | 使用フレームワークリスト |
| resourcesS3Key | String | - | 分析対象リソースのS3キー |
| resultS3Key | String | - | 分析結果のS3キー |
| summary | Object | - | 分析結果サマリー |
| createdAt | String | GSI1(SK) | 作成日時 |
| updatedAt | String | GSI3(SK) | 更新日時 |
| completedAt | String | - | 完了日時 |
| createdBy | String | - | 実行者ユーザーID |

**GSI**:
- ByTenant: tenantId(PK) + createdAt(SK)
- ByProject: projectId(PK) + createdAt(SK)  
- ByStatus: status(PK) + updatedAt(SK)

### 4. Findings テーブル
**目的**: 分析結果の詳細な発見事項管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| id | String | PK | 発見事項ID (UUID) |
| analysisId | String | GSI1(PK) | 所属分析ID |
| tenantId | String | GSI2(PK) | 所属テナントID |
| severity | String | GSI1(SK), GSI3(PK) | 重要度 (CRITICAL, HIGH, MEDIUM, LOW, INFO) |
| category | String | - | カテゴリー (SECURITY, PERFORMANCE, COST, etc.) |
| framework | String | - | 検出フレームワーク |
| ruleId | String | - | 適用ルールID |
| title | String | - | 発見事項タイトル |
| description | String | - | 詳細説明 |
| recommendation | String | - | 推奨対応策 |
| resourceType | String | - | 対象リソースタイプ |
| resourceId | String | - | 対象リソースID |
| compliance | Object | - | コンプライアンス情報 |
| createdAt | String | GSI2(SK), GSI3(SK) | 作成日時 |

**GSI**:
- ByAnalysis: analysisId(PK) + severity(SK)
- ByTenant: tenantId(PK) + createdAt(SK)
- BySeverity: severity(PK) + createdAt(SK)

### 5. Reports テーブル
**目的**: 生成されたレポートの管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| id | String | PK | レポートID (UUID) |
| tenantId | String | GSI1(PK) | 所属テナントID |
| projectId | String | GSI2(PK) | 所属プロジェクトID |
| analysisId | String | GSI3(PK) | 基となる分析ID |
| name | String | - | レポート名 |
| type | String | - | レポートタイプ (EXECUTIVE, TECHNICAL, COMPLIANCE) |
| format | String | - | フォーマット (PDF, EXCEL, JSON, HTML) |
| status | String | - | 生成ステータス (GENERATING, COMPLETED, FAILED) |
| s3Key | String | - | レポートファイルのS3キー |
| downloadUrl | String | - | ダウンロードURL（期限付き） |
| metadata | Object | - | レポートメタデータ |
| createdAt | String | GSI1(SK), GSI2(SK), GSI3(SK) | 作成日時 |
| expiresAt | String | - | ダウンロードURL有効期限 |
| createdBy | String | - | 生成実行者ユーザーID |

**GSI**:
- ByTenant: tenantId(PK) + createdAt(SK)
- ByProject: projectId(PK) + createdAt(SK)
- ByAnalysis: analysisId(PK) + createdAt(SK)

### 6. Users テーブル
**目的**: ユーザー情報とプロファイル管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| id | String | PK | ユーザーID (UUID) |
| tenantId | String | GSI1(PK) | 所属テナントID |
| cognitoId | String | GSI2(PK) | Cognito User Pool ID |
| email | String | GSI3(PK) | メールアドレス |
| firstName | String | - | 名 |
| lastName | String | - | 姓 |
| role | String | GSI4(PK) | ユーザーロール |
| projectIds | List | - | アクセス可能プロジェクトIDリスト |
| preferences | Object | - | ユーザー設定 |
| isActive | Boolean | - | アクティブフラグ |
| createdAt | String | GSI1(SK) | 作成日時 |
| lastLoginAt | String | GSI4(SK) | 最終ログイン日時 |
| updatedAt | String | - | 更新日時 |

**GSI**:
- ByTenant: tenantId(PK) + createdAt(SK)
- ByCognitoId: cognitoId(PK)
- ByEmail: email(PK)
- ByRole: role(PK) + lastLoginAt(SK)

## マルチフレームワーク分析システム関連テーブル

### 7. FrameworkRegistry テーブル
**目的**: 分析フレームワークの中央管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| pk | String | PK | フレームワークID |
| sk | String | SK | バージョン番号 |
| name | String | - | フレームワーク名 |
| type | String | - | フレームワークタイプ |
| description | String | - | 説明 |
| status | String | GSI1(PK) | ステータス (ACTIVE, DEPRECATED, BETA) |
| version | String | - | バージョン |
| rules | List | - | 含まれるルールIDリスト |
| metadata | Object | - | フレームワークメタデータ |
| createdAt | String | GSI1(SK) | 作成日時 |
| updatedAt | String | - | 更新日時 |

**GSI**:
- ByStatus: GSI1PK(status) + GSI1SK(createdAt)

### 8. RuleDefinitions テーブル  
**目的**: 分析ルールの定義管理

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| pk | String | PK | ルールID |
| sk | String | SK | バージョン |
| frameworkId | String | GSI1(PK) | 所属フレームワークID |
| name | String | - | ルール名 |
| description | String | - | ルール説明 |
| severity | String | - | デフォルト重要度 |
| category | String | - | カテゴリー |
| implementation | Object | - | 実装定義 |
| tags | List | - | タグリスト |
| compliance | Object | - | コンプライアンス情報 |
| isActive | Boolean | - | アクティブフラグ |
| createdAt | String | GSI1(SK) | 作成日時 |
| updatedAt | String | - | 更新日時 |

**GSI**:
- ByFramework: GSI1PK(frameworkId) + GSI1SK(createdAt)

### 9. TenantFrameworkConfig テーブル
**目的**: テナント別フレームワーク設定

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| pk | String | PK | tenantId |
| sk | String | SK | frameworkId |
| isEnabled | Boolean | - | 有効フラグ |
| customRules | Object | - | カスタムルール設定 |
| severityMappings | Object | - | 重要度マッピング |
| excludedRules | List | - | 除外ルールリスト |
| configuration | Object | - | フレームワーク固有設定 |
| isDefault | Boolean | GSI1(PK) | デフォルト設定フラグ |
| createdAt | String | GSI1(SK) | 作成日時 |
| updatedAt | String | - | 更新日時 |

**GSI**:
- ByDefault: GSI1PK(isDefault) + GSI1SK(createdAt)

### 10. TenantAnalytics テーブル
**目的**: テナント別分析統計

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| pk | String | PK | tenantId |
| sk | String | SK | period (YYYY-MM-DD) |
| analysisCount | Number | - | 分析実行回数 |
| findingsCount | Object | - | 重要度別発見件数 |
| frameworkUsage | Object | - | フレームワーク別使用統計 |
| quotaUsage | Object | - | クォータ使用状況 |
| tier | String | GSI2(PK) | サービスティア |
| period | String | GSI1(PK) | 集計期間 |
| createdAt | String | GSI1(SK), GSI2(SK) | 作成日時 |
| updatedAt | String | - | 更新日時 |

**GSI**:
- ByPeriod: GSI1PK(period) + GSI1SK(createdAt)  
- ByTier: GSI2PK(tier) + GSI2SK(createdAt)

### 11. GlobalAnalytics テーブル
**目的**: システム全体の分析統計

| 属性名 | 型 | キー | 説明 |
|--------|------|------|------|
| pk | String | PK | GLOBAL |
| sk | String | SK | period (YYYY-MM-DD) |
| totalAnalyses | Number | - | 総分析実行数 |
| totalTenants | Number | - | アクティブテナント数 |
| frameworkPopularity | Object | - | フレームワーク人気度統計 |
| performanceMetrics | Object | - | システムパフォーマンス指標 |
| errorMetrics | Object | - | エラー統計 |
| period | String | GSI1(PK) | 集計期間 |
| createdAt | String | GSI1(SK) | 作成日時 |
| updatedAt | String | - | 更新日時 |

**GSI**:
- ByPeriod: GSI1PK(period) + GSI1SK(createdAt)

## データ分離とセキュリティ

### テナント分離戦略
- **Pool Model**: 全テナントが同じテーブルを共有
- **テナントID**: 全レコードにtenantIdを含める
- **行レベルセキュリティ**: Lambda関数でテナントIDによるフィルタリング
- **暗号化**: DynamoDB暗号化（保存時・転送時）

### アクセス制御
- **IAM**: サービス間のアクセス制御
- **Cognito**: ユーザー認証・認可
- **AppSync**: GraphQLレベルでの認可制御
- **Lambda**: ビジネスロジックレベルでのデータフィルタリング

### バックアップとリカバリ
- **Point-in-Time Recovery**: 全テーブルで有効
- **DynamoDB Streams**: データ変更の監査ログ
- **タグ管理**: 環境・プロジェクト・データ分類別タグ

## パフォーマンス設計

### 課金モデル
- **Pay-per-Request**: 予測困難なワークロードに最適
- **オンデマンドスケーリング**: 自動的な読み書き容量調整

### アクセスパターン最適化
- **GSI設計**: 主要なクエリパターンに対応
- **複合キー**: 効率的なソート・フィルタリング
- **バッチ処理**: 複数レコードの効率的読み書き

### モニタリング
- **CloudWatch**: DynamoDBメトリクス監視
- **X-Ray**: 分散トレーシング
- **カスタムメトリクス**: アプリケーションレベル監視

## 運用考慮事項

### 容量計画
- 初期: Basic Tier対応（月100分析、10MBファイル、90日保存）
- スケール: テナント数・分析頻度に応じた自動拡張

### コスト最適化
- **TTL設定**: 期限切れデータの自動削除
- **圧縮**: 大きなオブジェクトの効率的保存
- **アーカイブ**: 古いデータのS3 Glacierへの移行

### 災害復旧
- **リージョン横断**: 重要データの複製
- **自動バックアップ**: 定期的なデータバックアップ
- **復旧手順**: 文書化された復旧プロセス