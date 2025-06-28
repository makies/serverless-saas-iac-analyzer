# Cloud Best Practice Analyzer

AWS Amplify Gen 2 を使用したマルチテナント対応の Cloud Best Practice Analyzer です。

## 🏗️ アーキテクチャ

- **Frontend**: React + AWS Amplify + Cloudscape Design System
- **Backend**: AWS AppSync GraphQL + Lambda (Node.js 22.x TypeScript)
- **Database**: DynamoDB (Pool Model)
- **AI Engine**: Amazon Bedrock (Claude 4 Sonnet)
- **Authentication**: AWS Cognito User Pools
- **Package Manager**: bun

## 🚀 セットアップ

### 前提条件

- Node.js 22.x
- Bun 1.0+
- AWS CLI 設定済み

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
└── docs/                      # ドキュメント
```

## 🔧 技術スタック

### GraphQL API (AppSync)

- マルチテナント対応データモデル
- ロールベースアクセス制御
- リアルタイムサブスクリプション

### Lambda Functions

- `analysisHandler`: クラウドインフラ分析処理（Bedrock 統合）
- `reportGenerator`: ベストプラクティスレポート生成（PDF/Excel/JSON）

### 認証・認可

- Cognito User Pools
- カスタム属性（tenantId, role）
- 6 つのユーザーロール
  - SystemAdmin
  - ClientAdmin
  - ProjectManager
  - Analyst
  - Viewer
  - ClientEngineer

## 🎯 主要機能

1. **クラウドインフラ分析**: CloudFormation/Terraform/CDK 対応
2. **ベストプラクティス評価**: AWS Well-Architected Framework 準拠
3. **ライブスキャン**: AWS アカウント直接分析
4. **レポート生成**: PDF/Excel/JSON 出力
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
- **認証**: Cognito MFA 対応
- **認可**: GraphQL フィールドレベル制御
- **暗号化**: S3/DynamoDB 暗号化
- **監査**: CloudTrail 統合

## 📊 制約（Basic Tier）

- 月 100 回分析
- 10MB ファイル制限
- 90 日データ保存
- プラグイン 5 個同時実行
- プラグイン実行時間 15 分

## 🔄 REST API → GraphQL 移行完了

✅ Amplify Gen 2 TypeScript 定義
✅ AppSync GraphQL API
✅ Lambda リゾルバー統合
✅ マルチテナント認証・認可
✅ フロントエンド型安全 GraphQL クライアント
