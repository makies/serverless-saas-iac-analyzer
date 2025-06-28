# Serverless SaaS IaC Analyzer

AWS Amplify Gen 2を使用したマルチテナント対応のServerless SaaS IaC Analyzerです。

## 🏗️ アーキテクチャ

- **Frontend**: React + AWS Amplify + Cloudscape Design System
- **Backend**: AWS AppSync GraphQL + Lambda (Node.js 20.x TypeScript)
- **Database**: DynamoDB (Pool Model)
- **AI Engine**: Amazon Bedrock (Claude 4 Sonnet)
- **Authentication**: AWS Cognito User Pools
- **Package Manager**: Bun

## 🚀 セットアップ

### 前提条件
- Node.js 20.x
- Bun 1.0+
- AWS CLI設定済み

### インストール

```bash
# 1. 依存関係インストール
bun install

# 2. フロントエンド依存関係
cd frontend
bun install

# 3. Amplify開発環境起動
bun run sandbox

# 4. フロントエンド開発サーバー起動
bun run dev
```

## 📁 プロジェクト構造

```
project-analyzer/
├── frontend/                   # React アプリケーション
│   ├── amplify/               # Amplify Gen 2 バックエンド定義
│   │   ├── backend.ts         # メインバックエンド設定
│   │   ├── data/              # GraphQLスキーマ
│   │   └── functions/         # Lambda関数
│   └── src/                   # フロントエンドソース
├── backend/                   # 従来のLambda（移行予定）
├── infrastructure/            # CDK（Amplifyに統合予定）
└── docs/                      # ドキュメント
```

## 🔧 技術スタック

### GraphQL API (AppSync)
- マルチテナント対応データモデル
- ロールベースアクセス制御
- リアルタイムサブスクリプション

### Lambda Functions
- `analysisHandler`: IaC分析処理（Bedrock統合）
- `reportGenerator`: レポート生成（PDF/Excel/JSON）

### 認証・認可
- Cognito User Pools
- カスタム属性（tenantId, role）
- 6つのユーザーロール
  - SystemAdmin
  - ClientAdmin
  - ProjectManager
  - Analyst
  - Viewer
  - ClientEngineer

## 🎯 主要機能

1. **IaC分析**: CloudFormation/Terraform/CDK対応
2. **Well-Architected分析**: 6つの柱による評価
3. **ライブスキャン**: AWS アカウント直接分析
4. **レポート生成**: PDF/Excel/JSON出力
5. **マルチテナント**: 完全なデータ分離
6. **ロールベースアクセス**: プロジェクト別権限制御

## 🧪 開発コマンド

```bash
# 型チェック
bun run type-check

# リント
bun run lint

# テスト
bun test

# ビルド
bun run build

# Amplify サンドボックス
bun run sandbox

# 本番デプロイ
bun run deploy
```

## 🛡️ セキュリティ

- **テナント分離**: DynamoDB Row Level Security
- **認証**: Cognito MFA対応
- **認可**: GraphQL フィールドレベル制御
- **暗号化**: S3/DynamoDB暗号化
- **監査**: CloudTrail統合

## 📊 制約（Basic Tier）

- 月100回分析
- 10MBファイル制限
- 90日データ保存
- プラグイン5個同時実行
- プラグイン実行時間15分

## 🔄 REST API → GraphQL 移行完了

✅ Amplify Gen 2 TypeScript定義
✅ AppSync GraphQL API
✅ Lambda リゾルバー統合
✅ マルチテナント認証・認可
✅ フロントエンド型安全GraphQLクライアント