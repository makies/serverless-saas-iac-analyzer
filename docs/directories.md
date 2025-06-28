# プロジェクト構造

## ディレクトリ構造

```
project_analyzer/
├── infrastructure/                 # CDK Infrastructure
│   ├── lib/
│   │   ├── main-stack.ts          # メインスタック
│   │   ├── sbt-control-plane.ts   # SBT Control Plane
│   │   └── constructs/
│   │       ├── api-gateway.ts
│   │       ├── lambda-functions.ts
│   │       └── storage.ts
│   ├── bin/
│   │   └── app.ts                 # CDK エントリーポイント
│   ├── test/
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
│
├── lambda/                        # Lambda Functions
│   ├── shared/                    # 共通ライブラリ
│   │   ├── tenant-utils.ts
│   │   ├── bedrock-client.ts
│   │   └── validation.ts
│   ├── tenant-validator/
│   │   ├── index.ts
│   │   └── package.json
│   ├── file-upload/
│   │   ├── index.ts
│   │   └── package.json
│   ├── iac-analysis/
│   │   ├── iac-analysis.ts       # メイン分析ロジック
│   │   ├── well-architected-rules.ts
│   │   └── package.json
│   ├── report-generator/
│   │   ├── index.ts
│   │   └── package.json
│   └── account-scanner/
│       ├── index.ts
│       └── package.json
│
├── frontend/                      # React + Amplify Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnalysisDashboard.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   ├── ReportsView.tsx
│   │   │   ├── TenantSwitcher.tsx
│   │   │   └── WellArchitectedChart.tsx
│   │   ├── hooks/
│   │   │   ├── useAnalysis.ts
│   │   │   ├── useTenant.ts
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   └── storage.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── amplify.yml               # Amplify Build設定
│
├── scripts/                      # デプロイメントスクリプト
│   ├── deploy.sh
│   ├── setup-env.sh
│   └── build-lambdas.sh
│
├── docs/                         # ドキュメント
│   ├── api-reference.md
│   ├── deployment-guide.md
│   └── user-guide.md
│
├── .env.example
├── package.json                  # ルートpackage.json
├── README.md
└── .gitignore
```

## 初期セットアップ手順

### 1. 前提条件

```bash
# Node.js 22以上
node --version  # v22.x.x以上

# AWS CLI
