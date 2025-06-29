# AppSync GraphQL バックエンド プロジェクト構造

## ディレクトリ構造 (AppSync版)

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
├── amplify.yml                         # Amplify CI/CD設定
├── 
├── bin/
│   └── app.ts                          # CDK アプリケーションエントリーポイント
│
├── lib/                                # CDK スタック定義
│   ├── stacks/
│   │   ├── main-stack.ts              # メインスタック (AppSync + Cognito)
│   │   ├── auth-stack.ts              # 認証関連スタック (Cognito User Pools)
│   │   ├── appsync-stack.ts           # AppSync API スタック
│   │   ├── data-stack.ts              # データベーススタック (DynamoDB)
│   │   ├── analysis-stack.ts          # 分析処理スタック (Step Functions)
│   │   ├── storage-stack.ts           # ストレージスタック (S3)
│   │   └── monitoring-stack.ts        # 監視・ログスタック
│   │
│   ├── constructs/                    # 再利用可能なコンストラクト
│   │   ├── appsync-api.ts            # AppSync API with auth
│   │   ├── tenant-isolated-table.ts   # テナント分離DynamoDB
│   │   ├── graphql-resolver.ts       # GraphQL Lambda Resolver
│   │   ├── step-function-workflow.ts  # 分析ワークフロー
│   │   └── bedrock-integration.ts     # Bedrock統合
│   │
│   └── config/                        # 環境設定
│       ├── environments.ts            # 環境別設定
│       ├── constants.ts              # 定数定義
│       └── types.ts                  # CDK用型定義
│
├── schema/                            # GraphQL スキーマ
│   ├── schema.graphql                # メインスキーマファイル
│   ├── types/                        # 型定義分割
│   │   ├── tenant.graphql
│   │   ├── project.graphql
│   │   ├── analysis.graphql
│   │   ├── report.graphql
│   │   ├── user.graphql
│   │   ├── finding.graphql
│   │   └── common.graphql
│   │
│   ├── queries/                      # Query定義
│   │   ├── tenant.graphql
│   │   ├── project.graphql
│   │   ├── analysis.graphql
│   │   ├── report.graphql
│   │   ├── dashboard.graphql
│   │   └── user.graphql
│   │
│   ├── mutations/                    # Mutation定義
│   │   ├── project.graphql
│   │   ├── analysis.graphql
│   │   ├── report.graphql
│   │   ├── user.graphql
│   │   └── admin.graphql
│   │
│   ├── subscriptions/                # Subscription定義
│   │   ├── analysis.graphql
│   │   ├── report.graphql
│   │   └── project.graphql
│   │
│   └── directives/                   # カスタムディレクティブ
│       ├── auth.graphql
│       ├── tenant-isolation.graphql
│       └── validation.graphql
│
├── src/                               # Lambda Resolver ソースコード
│   ├── shared/                        # 共通ライブラリ
│   │   ├── types/                     # 型定義 (GraphQL生成型も含む)
│   │   │   ├── index.ts
│   │   │   ├── graphql.ts            # GraphQL生成型
│   │   │   ├── tenant.ts
│   │   │   ├── project.ts
│   │   │   ├── analysis.ts
│   │   │   ├── user.ts
│   │   │   └── api.ts
│   │   │
│   │   ├── utils/                     # ユーティリティ
│   │   │   ├── logger.ts             # 構造化ログ
│   │   │   ├── response.ts           # GraphQL レスポンス
│   │   │   ├── validation.ts         # バリデーション
│   │   │   ├── encryption.ts         # 暗号化
│   │   │   ├── tenant-context.ts     # テナントコンテキスト抽出
│   │   │   └── error-handler.ts      # エラーハンドリング
│   │   │
│   │   ├── services/                  # 共通サービス
│   │   │   ├── dynamodb.ts           # DynamoDB操作
│   │   │   ├── s3.ts                 # S3操作
│   │   │   ├── bedrock.ts            # Bedrock操作
│   │   │   ├── step-functions.ts     # Step Functions操作
│   │   │   ├── appsync.ts            # AppSync操作
│   │   │   └── cloudwatch.ts         # CloudWatch操作
│   │   │
│   │   ├── middleware/                # GraphQL ミドルウェア
│   │   │   ├── auth.ts               # 認証ミドルウェア
│   │   │   ├── tenant-isolation.ts   # テナント分離
│   │   │   ├── validation.ts         # リクエスト検証
│   │   │   ├── logging.ts            # ログミドルウェア
│   │   │   └── error-handling.ts     # エラーハンドリング
│   │   │
│   │   └── constants/                 # 定数
│   │       ├── errors.ts             # エラー定数
│   │       ├── permissions.ts        # 権限定数
│   │       ├── graphql.ts            # GraphQL定数
│   │       └── analysis.ts           # 分析関連定数
│   │
│   ├── resolvers/                     # GraphQL Resolver関数
│   │   ├── query/                     # Query Resolvers
│   │   │   ├── tenant/
│   │   │   │   ├── getTenant.ts
│   │   │   │   └── listTenants.ts
│   │   │   │
│   │   │   ├── project/
│   │   │   │   ├── getProject.ts
│   │   │   │   ├── listProjects.ts
│   │   │   │   └── listProjectsByTenant.ts
│   │   │   │
│   │   │   ├── analysis/
│   │   │   │   ├── getAnalysis.ts
│   │   │   │   ├── listAnalyses.ts
│   │   │   │   ├── listAnalysesByProject.ts
│   │   │   │   └── getAnalysisFindings.ts
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── getDashboardMetrics.ts
│   │   │   │   └── getProjectMetrics.ts
│   │   │   │
│   │   │   ├── report/
│   │   │   │   ├── getReport.ts
│   │   │   │   ├── listReports.ts
│   │   │   │   └── listReportsByProject.ts
│   │   │   │
│   │   │   └── user/
│   │   │       ├── getUser.ts
│   │   │       ├── listUsers.ts
│   │   │       └── getUserProfile.ts
│   │   │
│   │   ├── mutation/                  # Mutation Resolvers
│   │   │   ├── project/
│   │   │   │   ├── createProject.ts
│   │   │   │   ├── updateProject.ts
│   │   │   │   └── deleteProject.ts
│   │   │   │
│   │   │   ├── analysis/
│   │   │   │   ├── createAnalysis.ts
│   │   │   │   ├── updateAnalysis.ts
│   │   │   │   ├── deleteAnalysis.ts
│   │   │   │   └── startAnalysis.ts
│   │   │   │
│   │   │   ├── report/
│   │   │   │   ├── generateReport.ts
│   │   │   │   └── deleteReport.ts
│   │   │   │
│   │   │   ├── user/
│   │   │   │   ├── updateUserProfile.ts
│   │   │   │   └── inviteUser.ts
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── createTenant.ts
│   │   │       ├── updateTenant.ts
│   │   │       └── suspendTenant.ts
│   │   │
│   │   ├── subscription/              # Subscription Resolvers
│   │   │   ├── onAnalysisStatusChanged.ts
│   │   │   ├── onAnalysisCompleted.ts
│   │   │   ├── onReportGenerated.ts
│   │   │   └── onProjectUpdated.ts
│   │   │
│   │   ├── field/                     # Field Resolvers (リレーション)
│   │   │   ├── tenant/
│   │   │   │   ├── projects.ts       # Tenant.projects resolver
│   │   │   │   └── users.ts          # Tenant.users resolver
│   │   │   │
│   │   │   ├── project/
│   │   │   │   ├── analyses.ts       # Project.analyses resolver
│   │   │   │   ├── reports.ts        # Project.reports resolver
│   │   │   │   └── tenant.ts         # Project.tenant resolver
│   │   │   │
│   │   │   └── analysis/
│   │   │       ├── findings.ts       # Analysis.findings resolver
│   │   │       ├── reports.ts        # Analysis.reports resolver
│   │   │       └── project.ts        # Analysis.project resolver
│   │   │
│   │   └── pipeline/                  # Pipeline Resolvers
│   │       ├── getDashboardMetrics/
│   │       │   ├── before.vtl
│   │       │   ├── after.vtl
│   │       │   ├── validateAccess.ts
│   │       │   ├── getProjectStats.ts
│   │       │   └── getAnalysisStats.ts
│   │       │
│   │       └── generateComprehensiveReport/
│   │           ├── before.vtl
│   │           ├── after.vtl
│   │           ├── gatherAnalysisData.ts
│   │           ├── processFindings.ts
│   │           └── generatePDF.ts
│   │
│   ├── workers/                       # バックグラウンド処理 (非GraphQL)
│   │   ├── analysis/                  # 分析処理ワークフロー
│   │   │   ├── validateInput.ts      # Step 1: 入力検証
│   │   │   ├── processFiles.ts       # Step 2: ファイル処理
│   │   │   ├── runAnalysis.ts        # Step 3: Bedrock分析実行
│   │   │   ├── processResults.ts     # Step 4: 結果処理
│   │   │   ├── updateDatabase.ts     # Step 5: DB更新
│   │   │   └── notifyCompletion.ts   # Step 6: 完了通知
│   │   │
│   │   ├── reports/                   # レポート生成
│   │   │   ├── generatePDF.ts        # PDF生成
│   │   │   ├── generateExcel.ts      # Excel生成
│   │   │   ├── generateJSON.ts       # JSON生成
│   │   │   └── uploadToS3.ts         # S3アップロード
│   │   │
│   │   ├── maintenance/               # メンテナンス
│   │   │   ├── cleanupExpired.ts     # 期限切れデータ削除
│   │   │   ├── aggregateMetrics.ts   # メトリクス集計
│   │   │   └── backupData.ts         # データバックアップ
│   │   │
│   │   └── notifications/             # 通知処理
│   │       ├── analysisComplete.ts   # 分析完了通知
│   │       ├── quotaWarning.ts       # クォータ警告
│   │       ├── systemAlert.ts        # システムアラート
│   │       └── pushNotification.ts   # プッシュ通知
│   │
│   ├── triggers/                      # イベントトリガー
│   │   ├── dynamodb/                  # DynamoDB Streams
│   │   │   ├── analysisStream.ts     # 分析ステータス変更
│   │   │   ├── projectStream.ts      # プロジェクト変更
│   │   │   └── userStream.ts         # ユーザー変更
│   │   │
│   │   ├── s3/                        # S3 Events
│   │   │   ├── fileUpload.ts         # ファイルアップロード
│   │   │   └── reportGenerated.ts    # レポート生成完了
│   │   │
│   │   └── eventbridge/               # EventBridge Rules
│   │       ├── scheduledMaintenance.ts # 定期メンテナンス
│   │       └── quotaCheck.ts         # クォータチェック
│   │
│   └── layers/                        # Lambda Layers
│       ├── common/                    # 共通ライブラリLayer
│       │   ├── nodejs/
│       │   │   └── node_modules/
│       │   └── package.json
│       │
│       ├── aws-sdk/                   # AWS SDK Layer
│       │   ├── nodejs/
│       │   │   └── node_modules/
│       │   └── package.json
│       │
│       └── graphql/                   # GraphQL関連Layer
│           ├── nodejs/
│           │   └── node_modules/
│           └── package.json
│
├── resolvers/                         # VTL Resolver Templates
│   ├── Query/                         # Query用VTLテンプレート
│   │   ├── getTenant/
│   │   │   ├── request.vtl
│   │   │   └── response.vtl
│   │   │
│   │   ├── listProjects/
│   │   │   ├── request.vtl
│   │   │   └── response.vtl
│   │   │
│   │   └── getDashboardMetrics/       # Pipeline Resolver
│   │       ├── before.vtl
│   │       ├── after.vtl
│   │       ├── function1-request.vtl
│   │       ├── function1-response.vtl
│   │       ├── function2-request.vtl
│   │       └── function2-response.vtl
│   │
│   ├── Mutation/                      # Mutation用VTLテンプレート
│   │   ├── createProject/
│   │   │   ├── request.vtl
│   │   │   └── response.vtl
│   │   │
│   │   └── updateAnalysis/
│   │       ├── request.vtl
│   │       └── response.vtl
│   │
│   ├── Subscription/                  # Subscription用フィルタ
│   │   ├── onAnalysisStatusChanged/
│   │   │   └── filter.vtl
│   │   │
│   │   └── onAnalysisCompleted/
│   │       └── filter.vtl
│   │
│   └── common/                        # 共通VTLユーティリティ
│       ├── auth-check.vtl
│       ├── tenant-filter.vtl
│       ├── error-handling.vtl
│       └── pagination.vtl
│
├── test/                              # テストコード
│   ├── unit/                          # ユニットテスト
│   │   ├── shared/
│   │   │   ├── utils/
│   │   │   ├── services/
│   │   │   └── middleware/
│   │   │
│   │   ├── resolvers/
│   │   │   ├── query/
│   │   │   ├── mutation/
│   │   │   ├── subscription/
│   │   │   └── field/
│   │   │
│   │   ├── workers/
│   │   │   ├── analysis/
│   │   │   └── reports/
│   │   │
│   │   └── lib/
│   │       └── stacks/
│   │
│   ├── integration/                   # 統合テスト
│   │   ├── graphql/                   # GraphQL API テスト
│   │   │   ├── queries.test.ts
│   │   │   ├── mutations.test.ts
│   │   │   ├── subscriptions.test.ts
│   │   │   └── auth.test.ts
│   │   │
│   │   ├── workflows/
│   │   │   ├── analysis-workflow.test.ts
│   │   │   └── report-generation.test.ts
│   │   │
│   │   └── infrastructure/
│   │       └── stack-deployment.test.ts
│   │
│   ├── e2e/                           # E2Eテスト
│   │   ├── scenarios/
│   │   │   ├── complete-analysis.test.ts
│   │   │   ├── multi-tenant.test.ts
│   │   │   ├── real-time-updates.test.ts
│   │   │   └── admin-operations.test.ts
│   │   │
│   │   └── fixtures/
│   │       ├── graphql/
│   │       │   ├── queries.ts
│   │       │   ├── mutations.ts
│   │       │   └── subscriptions.ts
│   │       │
│   │       ├── sample-files/
│   │       │   ├── cloudformation.yaml
│   │       │   ├── terraform.tf
│   │       │   └── cdk.ts
│   │       │
│   │       └── test-data/
│   │           ├── tenants.json
│   │           ├── projects.json
│   │           └── users.json
│   │
│   └── helpers/                       # テストヘルパー
│       ├── graphql-client.ts         # テスト用GraphQLクライアント
│       ├── cognito-helper.ts         # 認証テストヘルパー
│       ├── mock-services.ts          # モックサービス
│       ├── test-utilities.ts         # テストユーティリティ
│       └── assertions.ts             # カスタムアサーション
│
├── scripts/                           # ビルド・デプロイスクリプト
│   ├── build.sh                      # ビルドスクリプト
│   ├── deploy.sh                     # デプロイスクリプト
│   ├── generate-schema.sh            # GraphQLスキーマ生成
│   ├── codegen.sh                    # GraphQL型生成
│   ├── test.sh                       # テストスクリプト
│   ├── cleanup.sh                    # クリーンアップ
│   ├── seed-data.ts                  # テストデータ投入
│   └── migrate.ts                    # データマイグレーション
│
├── codegen/                          # GraphQL Code Generation
│   ├── codegen.yml                   # GraphQL Code Generator設定
│   ├── generated/                    # 生成されたコード
│   │   ├── graphql.ts               # GraphQL型定義
│   │   ├── operations.ts            # クエリ・ミューテーション型
│   │   └── schema.json              # スキーマJSON
│   │
│   └── templates/                    # カスタムテンプレート
│       ├── resolver.handlebars
│       └── types.handlebars
│
├── docs/                             # ドキュメント
│   ├── graphql/                      # GraphQL API仕様
│   │   ├── schema.md                # スキーマドキュメント
│   │   ├── queries.md               # クエリ仕様
│   │   ├── mutations.md             # ミューテーション仕様
│   │   ├── subscriptions.md         # サブスクリプション仕様
│   │   └── auth.md                  # 認証・認可仕様
│   │
│   ├── deployment/                   # デプロイメント
│   │   ├── environments.md          # 環境設定
│   │   ├── amplify-setup.md         # Amplify設定
│   │   └── monitoring.md            # 監視設定
│   │
│   └── architecture/                 # アーキテクチャ
│       ├── graphql-design.md        # GraphQL設計
│       ├── real-time.md             # リアルタイム機能
│       └── performance.md           # パフォーマンス設計
│
└── tools/                            # 開発ツール
    ├── local-dev/                    # ローカル開発環境
    │   ├── docker-compose.yml       # ローカルDynamoDB等
    │   ├── appsync-local.yaml       # AppSync Localエミュレーター
    │   └── amplify-mock.sh          # Amplify Mock設定
    │
    ├── graphql/                      # GraphQL開発ツール
    │   ├── playground.html          # GraphQL Playground
    │   ├── introspection.json       # スキーマイントロスペクション
    │   └── queries.graphql          # 開発用クエリ集
    │
    ├── monitoring/                   # 監視ツール
    │   ├── dashboard.json           # CloudWatchダッシュボード
    │   ├── alarms.ts                # アラーム定義
    │   └── x-ray-traces.sql         # X-Rayトレース分析
    │
    └── security/                     # セキュリティツール
        ├── schema-security-scan.sh  # GraphQLスキーマセキュリティスキャン
        ├── resolver-audit.sh        # Resolver監査
        └── auth-test.ts             # 認証テスト
```

## 主要ファイルの詳細

### GraphQL スキーマファイル

#### `schema/schema.graphql`
```graphql
# メインスキーマファイル - 他のファイルをインポート
# scalar types
scalar AWSDateTime
scalar AWSEmail
scalar AWSJSON
scalar AWSPhone
scalar AWSURL

# Import type definitions
# NOTE: この形式は仮想的です。実際のAppSyncでは単一ファイルまたは
# CDKでプログラム的に結合する必要があります

type Query {
  # テナント関連クエリ
  getTenant(id: ID!): Tenant
  
  # プロジェクト関連クエリ  
  getProject(id: ID!): Project
  listProjectsByTenant(
    tenantId: ID!
    filter: TableProjectFilterInput
    limit: Int
    nextToken: String
  ): ModelProjectConnection
  
  # 分析関連クエリ
  getAnalysis(id: ID!): Analysis
  listAnalysesByProject(
    projectId: ID!
    filter: TableAnalysisFilterInput
    limit: Int
    nextToken: String
  ): ModelAnalysisConnection
  
  # ダッシュボード関連
  getDashboardMetrics(tenantId: ID!, projectId: ID): DashboardMetrics
}

type Mutation {
  createProject(input: CreateProjectInput!): Project
  updateProject(input: UpdateProjectInput!): Project
  
  createAnalysis(input: CreateAnalysisInput!): Analysis
  startAnalysis(input: StartAnalysisInput!): Analysis
  
  generateReport(input: GenerateReportInput!): Report
}

type Subscription {
  onAnalysisStatusChanged(tenantId: ID!, projectId: ID): Analysis
    @aws_subscribe(mutations: ["updateAnalysis"])
  
  onReportGenerated(tenantId: ID!, projectId: ID): Report
    @aws_subscribe(mutations: ["generateReport"])
}
```

### CDK 構成

#### `lib/constructs/appsync-api.ts`
```typescript
import { Construct } from 'constructs';
import { 
  GraphqlApi, 
  Schema, 
  AuthorizationType,
  FieldLogLevel,
  Resolver,
  Code,
  FunctionRuntime
} from 'aws-cdk-lib/aws-appsync';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Table } from 'aws-cdk-lib/aws-dynamodb';

export interface AppSyncApiProps {
  userPool: UserPool;
  mainTable: Table;
  environment: string;
}

export class AppSyncApiConstruct extends Construct {
  public readonly api: GraphqlApi;
  
  constructor(scope: Construct, id: string, props: AppSyncApiProps) {
    super(scope, id);
    
    // GraphQL API
    this.api = new GraphqlApi(this, 'Api', {
      name: `CloudBestPracticeAnalyzer-${props.environment}`,
      schema: Schema.fromAsset('schema/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.userPool,
            defaultAction: UserPoolDefaultAction.ALLOW
          }
        },
        additionalAuthorizationModes: [
          {
            authorizationType: AuthorizationType.IAM
          }
        ]
      },
      logConfig: {
        fieldLogLevel: FieldLogLevel.ALL,
        excludeVerboseContent: false
      },
      xrayEnabled: true
    });
    
    // DynamoDB データソース
    const mainTableDS = this.api.addDynamoDbDataSource(
      'MainTableDataSource',
      props.mainTable
    );
    
    // Lambda データソース (共通Resolver関数用)
    const resolverFunction = new Function(this, 'ResolverFunction', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: Code.fromAsset('dist/resolvers'),
      environment: {
        MAIN_TABLE_NAME: props.mainTable.tableName,
        ENVIRONMENT: props.environment
      }
    });
    
    props.mainTable.grantReadWriteData(resolverFunction);
    
    const lambdaDS = this.api.addLambdaDataSource(
      'LambdaDataSource',
      resolverFunction
    );
    
    // Resolver定義
    this.createResolvers(mainTableDS, lambdaDS);
  }
  
  private createResolvers(
    mainTableDS: DynamoDbDataSource, 
    lambdaDS: LambdaDataSource
  ) {
    // Query Resolvers
    new Resolver(this, 'GetTenantResolver', {
      api: this.api,
      typeName: 'Query',
      fieldName: 'getTenant',
      dataSource: lambdaDS
    });
    
    new Resolver(this, 'ListProjectsByTenantResolver', {
      api: this.api,
      typeName: 'Query', 
      fieldName: 'listProjectsByTenant',
      dataSource: lambdaDS
    });
    
    // Mutation Resolvers  
    new Resolver(this, 'CreateProjectResolver', {
      api: this.api,
      typeName: 'Mutation',
      fieldName: 'createProject', 
      dataSource: lambdaDS
    });
    
    // Subscription Resolvers (フィルタのみ)
    new Resolver(this, 'OnAnalysisStatusChangedResolver', {
      api: this.api,
      typeName: 'Subscription',
      fieldName: 'onAnalysisStatusChanged',
      requestMappingTemplate: MappingTemplate.fromString(`
        {
          "version": "2018-05-29",
          "payload": {}
        }
      `),
      responseMappingTemplate: MappingTemplate.fromString(`
        ## テナント境界チェック
        #if($context.identity.claims.get("custom:tenantId") != $context.arguments.tenantId)
          $util.unauthorized()
        #end
        
        ## プロジェクトアクセスチェック
        #set($projectIds = $util.parseJson($context.identity.claims.get("custom:projectIds")))
        #if(!$projectIds.contains($context.arguments.projectId))
          #set($role = $context.identity.claims.get("custom:role"))
          #if($role != "SystemAdmin" && $role != "ClientAdmin")
            $util.unauthorized()
          #end
        #end
        
        $util.toJson($context.source)
      `)
    });
  }
}
```

### Resolver実装例

#### `src/resolvers/query/project/listProjectsByTenant.ts`
```typescript
import { AppSyncResolverHandler } from 'aws-lambda';
import { ListProjectsByTenantQueryVariables, Project } from '@shared/types/graphql';
import { TenantContext } from '@shared/types';
import { ProjectService } from '@shared/services';
import { extractTenantContext, validateTenantAccess } from '@shared/utils';
import { logger } from '@shared/utils/logger';

export const handler: AppSyncResolverHandler<
  ListProjectsByTenantQueryVariables,
  ModelProjectConnection
> = async (event) => {
  logger.info('listProjectsByTenant resolver started', {
    arguments: event.arguments,
    identity: event.identity?.sub
  });
  
  try {
    // テナントコンテキスト抽出
    const tenantContext = extractTenantContext(event);
    
    // テナント境界チェック
    await validateTenantAccess(tenantContext, event.arguments.tenantId);
    
    // プロジェクト一覧取得
    const projectService = new ProjectService();
    const result = await projectService.listByTenant(
      event.arguments.tenantId,
      {
        filter: event.arguments.filter,
        limit: event.arguments.limit,
        nextToken: event.arguments.nextToken
      },
      tenantContext
    );
    
    logger.info('listProjectsByTenant resolver completed', {
      tenantId: event.arguments.tenantId,
      count: result.items.length
    });
    
    return result;
    
  } catch (error) {
    logger.error('listProjectsByTenant resolver failed', {
      error: error.message,
      stack: error.stack,
      arguments: event.arguments
    });
    
    throw error;
  }
};
```

#### `src/resolvers/mutation/analysis/createAnalysis.ts`
```typescript
import { AppSyncResolverHandler } from 'aws-lambda';
import { CreateAnalysisInput, Analysis } from '@shared/types/graphql';
import { AnalysisService } from '@shared/services';
import { extractTenantContext, validatePermission } from '@shared/utils';
import { logger } from '@shared/utils/logger';

export const handler: AppSyncResolverHandler<
  { input: CreateAnalysisInput },
  Analysis
> = async (event) => {
  logger.info('createAnalysis resolver started', {
    input: event.arguments.input,
    identity: event.identity?.sub
  });
  
  try {
    const tenantContext = extractTenantContext(event);
    const input = event.arguments.input;
    
    // 権限チェック
    await validatePermission(tenantContext, 'analysis:create');
    
    // テナント境界チェック
    if (tenantContext.tenantId !== input.tenantId) {
      throw new Error('Cross-tenant access denied');
    }
    
    // プロジェクトアクセスチェック
    if (!tenantContext.projectIds.includes(input.projectId)) {
      if (!['SystemAdmin', 'ClientAdmin'].includes(tenantContext.role)) {
        throw new Error('Project access denied');
      }
    }
    
    // 分析作成
    const analysisService = new AnalysisService();
    const analysis = await analysisService.create(input, tenantContext);
    
    logger.info('createAnalysis resolver completed', {
      analysisId: analysis.id,
      tenantId: input.tenantId,
      projectId: input.projectId
    });
    
    return analysis;
    
  } catch (error) {
    logger.error('createAnalysis resolver failed', {
      error: error.message,
      stack: error.stack,
      input: event.arguments.input
    });
    
    throw error;
  }
};
```

### GraphQL Code Generation設定

#### `codegen/codegen.yml`
```yaml
overwrite: true
schema: 
  - "schema/**/*.graphql"
documents: null
generates:
  src/shared/types/graphql.ts:
    plugins:
      - "typescript"
      - "typescript-resolvers"
    config:
      useIndexSignature: true
      contextType: "../utils/tenant-context#TenantContext"
      scalars:
        AWSDateTime: string
        AWSEmail: string
        AWSJSON: string
        AWSPhone: string
        AWSURL: string
      
  frontend/src/graphql/generated.ts:
    plugins:
      - "typescript"
      - "typescript-operations"
      - "typescript-react-apollo"
    config:
      withHooks: true
      withComponent: false
      apolloReactHooksImportFrom: "@apollo/client"
      
  docs/schema.md:
    plugins:
      - "schema-ast"
      
  schema.json:
    plugins:
      - "introspection"
```

### パッケージ設定更新

#### `package.json` (AppSync版)
```json
{
  "name": "cloud-best-practice-analyzer-backend",
  "version": "1.0.0",
  "description": "Cloud Best Practice Analyzer Backend with AppSync GraphQL",
  "main": "lib/app.js",
  "scripts": {
    "build": "tsc",
    "build:resolvers": "tsc --project tsconfig.resolvers.json",
    "watch": "tsc -w",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "cdk": "cdk",
    "deploy": "npm run build && npm run build:resolvers && cdk deploy",
    "deploy:dev": "npm run build && npm run build:resolvers && cdk deploy --context environment=dev",
    "lint": "eslint --ext .ts .",
    "lint:fix": "eslint --ext .ts . --fix",
    "type-check": "tsc --noEmit",
    "codegen": "graphql-codegen --config codegen/codegen.yml",
    "codegen:watch": "graphql-codegen --config codegen/codegen.yml --watch",
    "schema:build": "node scripts/build-schema.js",
    "schema:validate": "graphql-schema-linter schema/schema.graphql",
    "amplify:mock": "amplify mock api",
    "bootstrap": "cdk bootstrap",
    "synth": "cdk synth",
    "diff": "cdk diff"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.100.0",
    "aws-lambda": "^1.0.7",
    "@aws-sdk/client-dynamodb": "^3.400.0",
    "@aws-sdk/client-s3": "^3.400.0",
    "@aws-sdk/client-bedrock-runtime": "^3.400.0",
    "@aws-sdk/client-stepfunctions": "^3.400.0",
    "@aws-sdk/client-appsync": "^3.400.0",
    "@aws-sdk/lib-dynamodb": "^3.400.0",
    "constructs": "^10.3.0",
    "graphql": "^16.8.0",
    "graphql-tag": "^2.12.6",
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
    "@graphql-codegen/cli": "^5.0.0",
    "@graphql-codegen/typescript": "^4.0.0",
    "@graphql-codegen/typescript-resolvers": "^4.0.0",
    "@graphql-codegen/typescript-operations": "^4.0.0",
    "@graphql-codegen/typescript-react-apollo": "^4.0.0",
    "@graphql-codegen/introspection": "^4.0.0",
    "@graphql-codegen/schema-ast": "^4.0.0",
    "aws-cdk": "^2.100.0",
    "eslint": "^8.47.0",
    "jest": "^29.6.2",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.6",
    "graphql-schema-linter": "^3.0.1"
  }
}
```

## AppSync構造の利点

この構造により、以下の利点が得られます：

### 1. 型安全性
- GraphQL Code Generationによる完全な型安全性
- コンパイル時エラー検出
- IDE補完サポート

### 2. 自動生成
- フロントエンド用GraphQLクライアントの自動生成
- Resolver型定義の自動生成  
- APIドキュメントの自動生成

### 3. リアルタイム機能
- GraphQL Subscriptionsによるリアルタイム更新
- 効率的なデータ同期
- オフライン対応

### 4. 開発効率
- Hot Reloadingによる高速開発
- モック機能による独立開発
- 統合されたテスト環境

### 5. 保守性
- スキーマファースト開発
- 明確な責任分離
- バージョン管理可能なAPI

次のステップでは、この構造に基づいてCDKスタックとGraphQLスキーマの実装を開始します。