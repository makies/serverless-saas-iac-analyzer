# バックエンド プロジェクト構造

## ディレクトリ構造

```
backend/
├── README.md
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .gitignore
├── cdk.json
├── cdk.context.json
├── 
├── bin/
│   └── app.ts                          # CDK アプリケーションエントリーポイント
│
├── lib/                                # CDK スタック定義
│   ├── stacks/
│   │   ├── main-stack.ts              # メインスタック
│   │   ├── auth-stack.ts              # 認証関連スタック
│   │   ├── api-stack.ts               # API Gateway スタック
│   │   ├── data-stack.ts              # データベーススタック
│   │   ├── analysis-stack.ts          # 分析処理スタック
│   │   └── monitoring-stack.ts        # 監視・ログスタック
│   │
│   ├── constructs/                    # 再利用可能なコンストラクト
│   │   ├── tenant-isolated-lambda.ts  # テナント分離Lambda
│   │   ├── api-with-auth.ts          # 認証付きAPI
│   │   ├── multi-tenant-table.ts     # マルチテナントDynamoDB
│   │   └── bedrock-integration.ts    # Bedrock統合
│   │
│   └── config/                        # 環境設定
│       ├── environments.ts            # 環境別設定
│       ├── constants.ts              # 定数定義
│       └── types.ts                  # CDK用型定義
│
├── src/                               # Lambda 関数ソースコード
│   ├── shared/                        # 共通ライブラリ
│   │   ├── types/                     # 型定義
│   │   │   ├── index.ts
│   │   │   ├── tenant.ts
│   │   │   ├── project.ts
│   │   │   ├── analysis.ts
│   │   │   ├── user.ts
│   │   │   └── api.ts
│   │   │
│   │   ├── utils/                     # ユーティリティ
│   │   │   ├── logger.ts             # 構造化ログ
│   │   │   ├── response.ts           # API レスポンス
│   │   │   ├── validation.ts         # バリデーション
│   │   │   ├── encryption.ts         # 暗号化
│   │   │   └── error-handler.ts      # エラーハンドリング
│   │   │
│   │   ├── middleware/                # ミドルウェア
│   │   │   ├── auth.ts               # 認証ミドルウェア
│   │   │   ├── tenant-context.ts     # テナントコンテキスト
│   │   │   ├── validation.ts         # リクエスト検証
│   │   │   ├── cors.ts               # CORS設定
│   │   │   └── rate-limit.ts         # レート制限
│   │   │
│   │   ├── services/                  # 共通サービス
│   │   │   ├── dynamodb.ts           # DynamoDB操作
│   │   │   ├── s3.ts                 # S3操作
│   │   │   ├── bedrock.ts            # Bedrock操作
│   │   │   ├── step-functions.ts     # Step Functions操作
│   │   │   └── cloudwatch.ts         # CloudWatch操作
│   │   │
│   │   └── constants/                 # 定数
│   │       ├── errors.ts             # エラー定数
│   │       ├── permissions.ts        # 権限定数
│   │       └── analysis.ts           # 分析関連定数
│   │
│   ├── functions/                     # Lambda 関数
│   │   ├── api/                       # API関数
│   │   │   ├── auth/                  # 認証API
│   │   │   │   ├── authorizer.ts     # Lambda Authorizer
│   │   │   │   ├── login.ts          # ログイン
│   │   │   │   ├── refresh.ts        # トークン更新
│   │   │   │   └── profile.ts        # プロフィール取得
│   │   │   │
│   │   │   ├── projects/              # プロジェクトAPI
│   │   │   │   ├── create.ts         # プロジェクト作成
│   │   │   │   ├── get.ts            # プロジェクト取得
│   │   │   │   ├── list.ts           # プロジェクト一覧
│   │   │   │   ├── update.ts         # プロジェクト更新
│   │   │   │   └── delete.ts         # プロジェクト削除
│   │   │   │
│   │   │   ├── analyses/              # 分析API
│   │   │   │   ├── create.ts         # 分析作成
│   │   │   │   ├── get.ts            # 分析取得
│   │   │   │   ├── list.ts           # 分析一覧
│   │   │   │   ├── delete.ts         # 分析削除
│   │   │   │   └── status.ts         # 分析ステータス
│   │   │   │
│   │   │   ├── reports/               # レポートAPI
│   │   │   │   ├── generate.ts       # レポート生成
│   │   │   │   ├── get.ts            # レポート取得
│   │   │   │   ├── list.ts           # レポート一覧
│   │   │   │   └── download.ts       # レポートダウンロード
│   │   │   │
│   │   │   └── admin/                 # 管理API
│   │   │       ├── tenants.ts        # テナント管理
│   │   │       ├── users.ts          # ユーザー管理
│   │   │       └── metrics.ts        # メトリクス
│   │   │
│   │   ├── workers/                   # バックグラウンド処理
│   │   │   ├── analysis/              # 分析処理
│   │   │   │   ├── validate-input.ts # 入力検証
│   │   │   │   ├── process-files.ts  # ファイル処理
│   │   │   │   ├── run-analysis.ts   # 分析実行
│   │   │   │   ├── generate-report.ts # レポート生成
│   │   │   │   └── cleanup.ts        # クリーンアップ
│   │   │   │
│   │   │   ├── maintenance/           # メンテナンス
│   │   │   │   ├── cleanup-expired.ts # 期限切れデータ削除
│   │   │   │   ├── metrics-aggregation.ts # メトリクス集計
│   │   │   │   └── backup.ts         # バックアップ
│   │   │   │
│   │   │   └── notifications/         # 通知処理
│   │   │       ├── analysis-complete.ts # 分析完了通知
│   │   │       ├── quota-warning.ts     # クォータ警告
│   │   │       └── error-alert.ts       # エラーアラート
│   │   │
│   │   └── triggers/                  # イベントトリガー
│   │       ├── s3-upload.ts          # S3アップロードトリガー
│   │       ├── dynamodb-stream.ts    # DynamoDBストリーム
│   │       └── cloudwatch-alarm.ts   # CloudWatchアラーム
│   │
│   └── layers/                        # Lambda Layers
│       ├── common/                    # 共通ライブラリLayer
│       │   ├── nodejs/
│       │   │   └── node_modules/
│       │   └── package.json
│       │
│       └── aws-sdk/                   # AWS SDK Layer
│           ├── nodejs/
│           │   └── node_modules/
│           └── package.json
│
├── test/                              # テストコード
│   ├── unit/                          # ユニットテスト
│   │   ├── shared/
│   │   │   ├── utils/
│   │   │   ├── services/
│   │   │   └── middleware/
│   │   │
│   │   ├── functions/
│   │   │   ├── api/
│   │   │   ├── workers/
│   │   │   └── triggers/
│   │   │
│   │   └── lib/
│   │       └── stacks/
│   │
│   ├── integration/                   # 統合テスト
│   │   ├── api/
│   │   │   ├── projects.test.ts
│   │   │   ├── analyses.test.ts
│   │   │   └── reports.test.ts
│   │   │
│   │   ├── workflows/
│   │   │   └── analysis-workflow.test.ts
│   │   │
│   │   └── infrastructure/
│   │       └── stack-deployment.test.ts
│   │
│   ├── e2e/                           # E2Eテスト
│   │   ├── scenarios/
│   │   │   ├── complete-analysis.test.ts
│   │   │   ├── multi-tenant.test.ts
│   │   │   └── admin-operations.test.ts
│   │   │
│   │   └── fixtures/
│   │       ├── sample-cloudformation.yaml
│   │       ├── sample-terraform.tf
│   │       └── sample-cdk.ts
│   │
│   └── helpers/                       # テストヘルパー
│       ├── test-data.ts              # テストデータ
│       ├── mock-services.ts          # モックサービス
│       ├── test-utilities.ts         # テストユーティリティ
│       └── assertions.ts             # カスタムアサーション
│
├── scripts/                           # ビルド・デプロイスクリプト
│   ├── build.sh                      # ビルドスクリプト
│   ├── deploy.sh                     # デプロイスクリプト
│   ├── test.sh                       # テストスクリプト
│   ├── cleanup.sh                    # クリーンアップ
│   ├── seed-data.ts                  # テストデータ投入
│   └── migrate.ts                    # データマイグレーション
│
├── docs/                             # ドキュメント
│   ├── api/                          # API仕様
│   │   ├── openapi.yaml             # OpenAPI仕様
│   │   ├── projects.md              # プロジェクトAPI
│   │   ├── analyses.md              # 分析API
│   │   └── reports.md               # レポートAPI
│   │
│   ├── deployment/                   # デプロイメント
│   │   ├── environments.md          # 環境設定
│   │   ├── ci-cd.md                 # CI/CD設定
│   │   └── monitoring.md            # 監視設定
│   │
│   └── architecture/                 # アーキテクチャ
│       ├── data-model.md            # データモデル
│       ├── security.md              # セキュリティ設計
│       └── performance.md           # パフォーマンス設計
│
└── tools/                            # 開発ツール
    ├── local-dev/                    # ローカル開発環境
    │   ├── docker-compose.yml       # ローカルDynamoDB等
    │   ├── localstack-setup.sh      # LocalStack設定
    │   └── sam-local.yaml           # SAM Local設定
    │
    ├── monitoring/                   # 監視ツール
    │   ├── dashboard.json           # CloudWatchダッシュボード
    │   ├── alarms.ts                # アラーム定義
    │   └── log-insights.sql         # ログ分析クエリ
    │
    └── security/                     # セキュリティツール
        ├── security-scan.sh         # セキュリティスキャン
        ├── dependency-check.sh      # 依存関係チェック
        └── iam-policies.json        # IAMポリシー定義
```

## 主要ファイルの説明

### CDK関連

#### `bin/app.ts`
```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MainStack } from '../lib/stacks/main-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const config = getEnvironmentConfig(environment);

new MainStack(app, `CloudBestPracticeAnalyzer-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  config,
  environment,
});
```

#### `lib/config/environments.ts`
```typescript
export interface EnvironmentConfig {
  environment: string;
  domain?: string;
  certificateArn?: string;
  
  // Lambda設定
  lambda: {
    timeout: number;
    memorySize: number;
    runtime: string;
  };
  
  // DynamoDB設定
  dynamodb: {
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
    pointInTimeRecovery: boolean;
  };
  
  // 分析設定
  analysis: {
    maxFileSize: number;
    timeoutMinutes: number;
    maxConcurrentAnalyses: number;
  };
  
  // モニタリング設定
  monitoring: {
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    xrayTracing: boolean;
    alarmsEnabled: boolean;
  };
}

export const getEnvironmentConfig = (env: string): EnvironmentConfig => {
  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      environment: 'dev',
      lambda: {
        timeout: 300,
        memorySize: 512,
        runtime: 'nodejs20.x'
      },
      dynamodb: {
        billingMode: 'PAY_PER_REQUEST',
        pointInTimeRecovery: false
      },
      analysis: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        timeoutMinutes: 5,
        maxConcurrentAnalyses: 2
      },
      monitoring: {
        logLevel: 'DEBUG',
        xrayTracing: true,
        alarmsEnabled: false
      }
    },
    staging: {
      // staging設定
    },
    production: {
      // production設定
    }
  };
  
  return configs[env] || configs.dev;
};
```

### 共通ライブラリ

#### `src/shared/types/index.ts`
```typescript
export * from './tenant';
export * from './project';
export * from './analysis';
export * from './user';
export * from './api';

// 共通型定義
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: UserRole[];
  projectIds: string[];
  permissions: Permission[];
}

export type UserRole = 
  | 'SystemAdmin'
  | 'ClientAdmin'
  | 'ProjectManager'
  | 'Analyst'
  | 'Viewer'
  | 'ClientEngineer';

export type Permission = 
  | 'tenant:*'
  | 'project:read'
  | 'project:write'
  | 'analysis:read'
  | 'analysis:write'
  | 'analysis:delete'
  | 'report:generate'
  | 'user:manage';
```

#### `src/shared/middleware/auth.ts`
```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TenantContext } from '../types';
import { logger } from '../utils/logger';

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  tenantContext: TenantContext;
}

export const withAuth = (
  handler: (event: AuthenticatedEvent) => Promise<APIGatewayProxyResult>
) => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const tenantContext = await extractTenantContext(event);
      
      const authenticatedEvent: AuthenticatedEvent = {
        ...event,
        tenantContext
      };
      
      return await handler(authenticatedEvent);
    } catch (error) {
      logger.error('Authentication failed', { error });
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }
  };
};

const extractTenantContext = async (event: APIGatewayProxyEvent): Promise<TenantContext> => {
  // JWT トークンからテナントコンテキストを抽出
  const token = event.headers.Authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('No authorization token provided');
  }
  
  // トークン検証とコンテキスト抽出のロジック
  // 実装詳細は後続で定義
  throw new Error('Not implemented');
};
```

#### `src/shared/utils/logger.ts`
```typescript
export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  tenantId?: string;
  userId?: string;
  requestId?: string;
  service: string;
  action: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

class Logger {
  private service: string;
  
  constructor(service: string) {
    this.service = service;
  }
  
  private log(level: LogEntry['level'], message: string, meta: Partial<LogEntry> = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      action: message,
      ...meta
    };
    
    console.log(JSON.stringify(entry));
  }
  
  debug(message: string, meta?: Partial<LogEntry>) {
    this.log('DEBUG', message, meta);
  }
  
  info(message: string, meta?: Partial<LogEntry>) {
    this.log('INFO', message, meta);
  }
  
  warn(message: string, meta?: Partial<LogEntry>) {
    this.log('WARN', message, meta);
  }
  
  error(message: string, meta?: Partial<LogEntry>) {
    this.log('ERROR', message, meta);
  }
}

export const logger = new Logger(process.env.SERVICE_NAME || 'unknown');
```

### パッケージ設定

#### `package.json`
```json
{
  "name": "cloud-best-practice-analyzer-backend",
  "version": "1.0.0",
  "description": "Cloud Best Practice Analyzer Backend Infrastructure and Functions",
  "main": "lib/app.js",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "cdk": "cdk",
    "deploy": "npm run build && cdk deploy",
    "deploy:dev": "npm run build && cdk deploy --context environment=dev",
    "deploy:staging": "npm run build && cdk deploy --context environment=staging",
    "deploy:prod": "npm run build && cdk deploy --context environment=production",
    "lint": "eslint --ext .ts .",
    "lint:fix": "eslint --ext .ts . --fix",
    "type-check": "tsc --noEmit",
    "bootstrap": "cdk bootstrap",
    "synth": "cdk synth",
    "diff": "cdk diff"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.100.0",
    "aws-lambda": "^1.0.7",
    "aws-sdk": "^2.1400.0",
    "@aws-sdk/client-dynamodb": "^3.400.0",
    "@aws-sdk/client-s3": "^3.400.0",
    "@aws-sdk/client-bedrock-runtime": "^3.400.0",
    "@aws-sdk/client-stepfunctions": "^3.400.0",
    "@aws-sdk/lib-dynamodb": "^3.400.0",
    "constructs": "^10.3.0",
    "jsonwebtoken": "^9.0.2",
    "ajv": "^8.12.0",
    "uuid": "^9.0.0",
    "source-map-support": "^0.5.21"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.119",
    "@types/jest": "^29.5.5",
    "@types/node": "^20.5.0",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/uuid": "^9.0.2",
    "@typescript-eslint/eslint-plugin": "^6.4.0",
    "@typescript-eslint/parser": "^6.4.0",
    "aws-cdk": "^2.100.0",
    "eslint": "^8.47.0",
    "jest": "^29.6.2",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.6"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": ["./node_modules/@types"],
    "baseUrl": "./",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@functions/*": ["src/functions/*"],
      "@lib/*": ["lib/*"]
    },
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "bin/**/*",
    "lib/**/*",
    "src/**/*",
    "test/**/*"
  ],
  "exclude": [
    "node_modules",
    "cdk.out",
    "dist",
    "coverage"
  ]
}
```

この構造により、以下の利点が得られます：

## 構造の利点

1. **関心の分離**: API、ワーカー、トリガーなど機能別に分離
2. **再利用性**: 共通ライブラリとユーティリティの活用
3. **テスタビリティ**: 包括的なテスト構造
4. **保守性**: 明確なディレクトリ構造と命名規則
5. **スケーラビリティ**: 新機能追加が容易な設計
6. **型安全性**: TypeScript の活用

次のステップでは、この構造に基づいてCDKスタックの実装を開始します。