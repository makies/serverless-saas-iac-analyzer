# Cloud Best Practice Analyzer - AppSync GraphQL バックエンド設計書

## 概要

AWS AmplifyとAppSync GraphQLを中核としたバックエンドアーキテクチャに設計を更新します。この変更により、フロントエンドとの統合が大幅に簡素化され、リアルタイム更新やオフライン機能が容易に実装できます。

## 変更点の概要

### 旧設計 → 新設計
- **API**: API Gateway REST → AppSync GraphQL
- **認証**: Lambda Authorizer → Cognito User Pools + AppSync Authorization
- **フロントエンド統合**: 手動実装 → Amplify Auto-generation
- **リアルタイム**: なし → GraphQL Subscriptions
- **オフライン対応**: なし → DataStore

## アーキテクチャ概要

### 技術スタック (更新版)

- **GraphQL API**: AWS AppSync
- **コンピュート**: AWS Lambda (Node.js 20.x TypeScript)
- **データベース**: Amazon DynamoDB (Pool Model)
- **ストレージ**: Amazon S3 (テナントベースプレフィックス)
- **AI/ML**: Amazon Bedrock (Claude 3.5 Sonnet)
- **認証**: AWS Cognito User Pools + Identity Pools
- **フロントエンド**: AWS Amplify (Auto-generated client)
- **リアルタイム**: AppSync Subscriptions
- **オフライン**: Amplify DataStore
- **マルチテナンシー**: AWS SaaS Builder Toolkit (Basic Tier)
- **監視**: Amazon CloudWatch + AWS X-Ray

### アーキテクチャ図 (更新版)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Amplify)                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │  Auto Generated │ │   DataStore     │ │  Auth Library   │    │
│  │  GraphQL Client │ │  (Offline)      │ │  (Cognito)      │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                         │ GraphQL over HTTPS/WSS
┌─────────────────────────▼───────────────────────────────────────┐
│                      AWS AppSync                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   Auth Layer    │ │  Schema         │ │  Subscriptions  │    │
│  │   (Cognito)     │ │  (GraphQL)      │ │  (Real-time)    │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   Resolvers     │ │  Field Mapping  │ │   Pipeline      │    │
│  │   (Lambda)      │ │   (Direct)      │ │   Resolvers     │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                         │
┌─────────────────────────▼───────────────────────────────────────┐
│                     Lambda Resolvers                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Query     │ │  Mutation   │ │ Subscription│ │   Analysis  ││
│  │  Resolvers  │ │  Resolvers  │ │  Resolvers  │ │   Workers   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────┬───────────────────────────────────────┘
                         │
┌─────────────────────────▼───────────────────────────────────────┐
│                     Data Layer                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  DynamoDB   │ │   Amazon    │ │   Amazon    │ │  Amazon     ││
│  │   Tables    │ │     S3      │ │   Bedrock   │ │  Cognito    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## GraphQL スキーマ設計

### メインスキーマ定義

```graphql
type Query {
  # テナント管理
  getTenant(id: ID!): Tenant
  listTenants(filter: TableTenantFilterInput, limit: Int, nextToken: String): ModelTenantConnection
  
  # プロジェクト管理
  getProject(id: ID!): Project
  listProjects(filter: TableProjectFilterInput, limit: Int, nextToken: String): ModelProjectConnection
  listProjectsByTenant(tenantId: ID!, filter: TableProjectFilterInput, limit: Int, nextToken: String): ModelProjectConnection
  
  # 分析管理
  getAnalysis(id: ID!): Analysis
  listAnalyses(filter: TableAnalysisFilterInput, limit: Int, nextToken: String): ModelAnalysisConnection
  listAnalysesByProject(projectId: ID!, filter: TableAnalysisFilterInput, limit: Int, nextToken: String): ModelAnalysisConnection
  listAnalysesByTenant(tenantId: ID!, filter: TableAnalysisFilterInput, limit: Int, nextToken: String): ModelAnalysisConnection
  
  # レポート管理
  getReport(id: ID!): Report
  listReports(filter: TableReportFilterInput, limit: Int, nextToken: String): ModelReportConnection
  listReportsByProject(projectId: ID!, filter: TableReportFilterInput, limit: Int, nextToken: String): ModelReportConnection
  
  # ユーザー管理
  getUser(id: ID!): User
  listUsers(filter: TableUserFilterInput, limit: Int, nextToken: String): ModelUserConnection
  getUserProfile: UserProfile
  
  # 分析結果
  getAnalysisFindings(analysisId: ID!, filter: TableFindingFilterInput, limit: Int, nextToken: String): ModelFindingConnection
  
  # ダッシュボード
  getDashboardMetrics(tenantId: ID!, projectId: ID): DashboardMetrics
  getProjectMetrics(projectId: ID!): ProjectMetrics
}

type Mutation {
  # プロジェクト管理
  createProject(input: CreateProjectInput!): Project
  updateProject(input: UpdateProjectInput!): Project
  deleteProject(input: DeleteProjectInput!): Project
  
  # 分析管理
  createAnalysis(input: CreateAnalysisInput!): Analysis
  updateAnalysis(input: UpdateAnalysisInput!): Analysis
  deleteAnalysis(input: DeleteAnalysisInput!): Analysis
  startAnalysis(input: StartAnalysisInput!): Analysis
  
  # レポート管理
  generateReport(input: GenerateReportInput!): Report
  deleteReport(input: DeleteReportInput!): Report
  
  # ユーザー管理
  updateUserProfile(input: UpdateUserProfileInput!): UserProfile
  inviteUser(input: InviteUserInput!): InviteUserResult
  
  # 管理者機能
  createTenant(input: CreateTenantInput!): Tenant @auth(rules: [{allow: groups, groups: ["SystemAdmins"]}])
  updateTenant(input: UpdateTenantInput!): Tenant @auth(rules: [{allow: groups, groups: ["SystemAdmins", "ClientAdmins"]}])
  suspendTenant(input: SuspendTenantInput!): Tenant @auth(rules: [{allow: groups, groups: ["SystemAdmins"]}])
}

type Subscription {
  # 分析進捗のリアルタイム更新
  onAnalysisStatusChanged(tenantId: ID!, projectId: ID): Analysis
    @auth(rules: [{allow: groups, groups: ["Analysts", "ProjectManagers", "ClientAdmins"]}])
    @aws_subscribe(mutations: ["updateAnalysis"])
  
  # 新しい分析完了通知
  onAnalysisCompleted(tenantId: ID!): Analysis
    @auth(rules: [{allow: groups, groups: ["Analysts", "ProjectManagers", "ClientAdmins"]}])
    @aws_subscribe(mutations: ["updateAnalysis"])
  
  # レポート生成完了通知
  onReportGenerated(tenantId: ID!, projectId: ID): Report
    @auth(rules: [{allow: groups, groups: ["Analysts", "ProjectManagers", "ClientAdmins"]}])
    @aws_subscribe(mutations: ["generateReport"])
  
  # プロジェクト更新通知
  onProjectUpdated(tenantId: ID!): Project
    @auth(rules: [{allow: groups, groups: ["ProjectManagers", "ClientAdmins"]}])
    @aws_subscribe(mutations: ["updateProject"])
}
```

### 型定義

```graphql
type Tenant @model 
  @auth(rules: [
    {allow: groups, groups: ["SystemAdmins"], operations: [create, read, update, delete]}
    {allow: groups, groups: ["ClientAdmins"], operations: [read, update]}
  ]) {
  id: ID!
  name: String!
  status: TenantStatus!
  subscription: TenantSubscription!
  adminEmail: AWSEmail!
  settings: TenantSettings
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  
  # リレーション
  projects: [Project] @hasMany(indexName: "byTenant", fields: ["id"])
  users: [User] @hasMany(indexName: "byTenant", fields: ["id"])
}

type Project @model
  @auth(rules: [
    {allow: groups, groups: ["SystemAdmins", "ClientAdmins"], operations: [create, read, update, delete]}
    {allow: groups, groups: ["ProjectManagers"], operations: [read, update]}
    {allow: groups, groups: ["Analysts", "Viewers"], operations: [read]}
  ]) {
  id: ID!
  tenantId: ID! @index(name: "byTenant")
  name: String!
  description: String
  status: ProjectStatus!
  memberIds: [String]!
  settings: ProjectSettings
  metrics: ProjectMetrics
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  createdBy: String!
  
  # リレーション
  tenant: Tenant @belongsTo(fields: ["tenantId"])
  analyses: [Analysis] @hasMany(indexName: "byProject", fields: ["id"])
  reports: [Report] @hasMany(indexName: "byProject", fields: ["id"])
}

type Analysis @model
  @auth(rules: [
    {allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"], operations: [create, read, update, delete]}
    {allow: groups, groups: ["Viewers", "ClientEngineers"], operations: [read]}
  ]) {
  id: ID!
  tenantId: ID! @index(name: "byTenant")
  projectId: ID! @index(name: "byProject")
  name: String!
  type: AnalysisType!
  status: AnalysisStatus!
  inputFiles: [S3Object]
  awsConfig: AWSConfig
  resultSummary: AnalysisResultSummary
  executionId: String
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  completedAt: AWSDateTime
  createdBy: String!
  
  # リレーション
  tenant: Tenant @belongsTo(fields: ["tenantId"])
  project: Project @belongsTo(fields: ["projectId"])
  findings: [Finding] @hasMany(indexName: "byAnalysis", fields: ["id"])
  reports: [Report] @hasMany(indexName: "byAnalysis", fields: ["id"])
}

type Finding @model
  @auth(rules: [
    {allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"], operations: [create, read, update, delete]}
    {allow: groups, groups: ["Viewers", "ClientEngineers"], operations: [read]}
  ]) {
  id: ID!
  analysisId: ID! @index(name: "byAnalysis")
  tenantId: ID! @index(name: "byTenant")
  title: String!
  description: String!
  severity: FindingSeverity!
  pillar: WellArchitectedPillar!
  resource: String
  line: Int
  recommendation: String!
  category: String
  ruleId: String
  createdAt: AWSDateTime!
  
  # リレーション
  analysis: Analysis @belongsTo(fields: ["analysisId"])
}

type Report @model
  @auth(rules: [
    {allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"], operations: [create, read, update, delete]}
    {allow: groups, groups: ["Viewers", "ClientEngineers"], operations: [read]}
  ]) {
  id: ID!
  tenantId: ID! @index(name: "byTenant")
  projectId: ID! @index(name: "byProject")
  analysisId: ID @index(name: "byAnalysis")
  name: String!
  type: ReportType!
  format: ReportFormat!
  status: ReportStatus!
  s3Location: S3Object
  generatedBy: String!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  
  # リレーション
  tenant: Tenant @belongsTo(fields: ["tenantId"])
  project: Project @belongsTo(fields: ["projectId"])
  analysis: Analysis @belongsTo(fields: ["analysisId"])
}

type User @model
  @auth(rules: [
    {allow: groups, groups: ["SystemAdmins"], operations: [create, read, update, delete]}
    {allow: groups, groups: ["ClientAdmins"], operations: [read, update]}
    {allow: owner, operations: [read, update]}
  ]) {
  id: ID!
  tenantId: ID! @index(name: "byTenant")
  cognitoId: String! @index(name: "byCognitoId")
  email: AWSEmail!
  firstName: String!
  lastName: String!
  role: UserRole!
  status: UserStatus!
  projectIds: [String]!
  preferences: UserPreferences
  lastLoginAt: AWSDateTime
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  
  # リレーション
  tenant: Tenant @belongsTo(fields: ["tenantId"])
}

# Enum定義
enum TenantStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum ProjectStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum AnalysisType {
  CLOUDFORMATION
  TERRAFORM
  CDK
  LIVE_SCAN
}

enum AnalysisStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum FindingSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  INFO
}

enum WellArchitectedPillar {
  OPERATIONAL_EXCELLENCE
  SECURITY
  RELIABILITY
  PERFORMANCE_EFFICIENCY
  COST_OPTIMIZATION
  SUSTAINABILITY
}

enum ReportType {
  ANALYSIS_SUMMARY
  DETAILED_FINDINGS
  EXECUTIVE_SUMMARY
  COMPLIANCE_REPORT
}

enum ReportFormat {
  PDF
  EXCEL
  JSON
  HTML
}

enum ReportStatus {
  GENERATING
  COMPLETED
  FAILED
}

enum UserRole {
  SYSTEM_ADMIN
  CLIENT_ADMIN
  PROJECT_MANAGER
  ANALYST
  VIEWER
  CLIENT_ENGINEER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  PENDING_INVITATION
}

# カスタム型定義
type TenantSubscription {
  tier: String! # "BASIC"
  limits: TenantLimits!
}

type TenantLimits {
  monthlyAnalyses: Int!
  maxFileSize: Int!
  retentionDays: Int!
  maxConcurrentAnalyses: Int!
}

type TenantSettings {
  allowClientAccess: Boolean!
  defaultAnalysisType: AnalysisType!
  notificationSettings: NotificationSettings
}

type ProjectSettings {
  allowClientAccess: Boolean!
  defaultAnalysisType: AnalysisType!
  autoDeleteAnalyses: Boolean!
  retentionDays: Int
}

type ProjectMetrics {
  totalAnalyses: Int!
  completedAnalyses: Int!
  avgScore: Float
  lastAnalysisAt: AWSDateTime
}

type AnalysisResultSummary {
  overallScore: Int!
  pillars: [PillarScore]!
  criticalFindings: Int!
  highFindings: Int!
  mediumFindings: Int!
  lowFindings: Int!
  totalFindings: Int!
}

type PillarScore {
  pillar: WellArchitectedPillar!
  score: Int!
  findings: Int!
}

type S3Object {
  bucket: String!
  key: String!
  size: Int!
  contentType: String
}

type AWSConfig {
  region: String!
  accountId: String!
  roleArn: String
}

type DashboardMetrics {
  totalProjects: Int!
  totalAnalyses: Int!
  completedAnalyses: Int!
  avgScore: Float!
  recentAnalyses: [Analysis]!
  pillarScores: [PillarScore]!
}

type UserPreferences {
  language: String!
  timezone: String!
  emailNotifications: Boolean!
  theme: String!
}

type NotificationSettings {
  analysisComplete: Boolean!
  quotaWarning: Boolean!
  systemAlerts: Boolean!
}

# Input 型定義
input CreateProjectInput {
  tenantId: ID!
  name: String!
  description: String
  memberIds: [String]!
  settings: ProjectSettingsInput
}

input UpdateProjectInput {
  id: ID!
  name: String
  description: String
  status: ProjectStatus
  memberIds: [String]
  settings: ProjectSettingsInput
}

input DeleteProjectInput {
  id: ID!
}

input CreateAnalysisInput {
  tenantId: ID!
  projectId: ID!
  name: String!
  type: AnalysisType!
  inputFiles: [S3ObjectInput]
  awsConfig: AWSConfigInput
}

input StartAnalysisInput {
  id: ID!
}

input GenerateReportInput {
  tenantId: ID!
  projectId: ID!
  analysisId: ID
  name: String!
  type: ReportType!
  format: ReportFormat!
}

# Connection型（ページネーション）
type ModelTenantConnection {
  items: [Tenant]!
  nextToken: String
}

type ModelProjectConnection {
  items: [Project]!
  nextToken: String
}

type ModelAnalysisConnection {
  items: [Analysis]!
  nextToken: String
}

type ModelReportConnection {
  items: [Report]!
  nextToken: String
}

type ModelUserConnection {
  items: [User]!
  nextToken: String
}

type ModelFindingConnection {
  items: [Finding]!
  nextToken: String
}
```

## Lambda Resolver 設計

### Resolver マッピング

#### Query Resolvers
```typescript
// src/resolvers/query/getDashboardMetrics.ts
import { AppSyncResolverHandler } from 'aws-lambda';
import { TenantContext } from '@shared/types';

export const handler: AppSyncResolverHandler<
  { tenantId: string; projectId?: string },
  DashboardMetrics
> = async (event) => {
  const tenantContext = await extractTenantContext(event);
  
  // テナント境界チェック
  if (tenantContext.tenantId !== event.arguments.tenantId) {
    throw new Error('Access denied: Invalid tenant');
  }
  
  const dashboardService = new DashboardService();
  return await dashboardService.getMetrics(
    event.arguments.tenantId,
    event.arguments.projectId
  );
};
```

#### Mutation Resolvers
```typescript
// src/resolvers/mutation/createAnalysis.ts
import { AppSyncResolverHandler } from 'aws-lambda';
import { CreateAnalysisInput, Analysis } from '@shared/types';

export const handler: AppSyncResolverHandler<
  { input: CreateAnalysisInput },
  Analysis
> = async (event) => {
  const tenantContext = await extractTenantContext(event);
  
  // 権限チェック
  await validatePermission(tenantContext, 'analysis:create');
  
  // テナント境界チェック
  if (tenantContext.tenantId !== event.arguments.input.tenantId) {
    throw new Error('Access denied: Invalid tenant');
  }
  
  const analysisService = new AnalysisService();
  return await analysisService.createAnalysis(
    event.arguments.input,
    tenantContext
  );
};
```

#### Subscription Resolvers
```typescript
// src/resolvers/subscription/onAnalysisStatusChanged.ts
import { AppSyncResolverHandler } from 'aws-lambda';

export const handler: AppSyncResolverHandler<any, any> = async (event) => {
  // Subscription フィルタリングロジック
  const tenantContext = await extractTenantContext(event);
  
  // テナント境界でフィルタ
  if (event.source.tenantId !== tenantContext.tenantId) {
    return null; // フィルタアウト
  }
  
  // プロジェクトアクセス権限チェック
  if (!tenantContext.projectIds.includes(event.source.projectId)) {
    return null; // フィルタアウト
  }
  
  return event.source;
};
```

### Pipeline Resolvers

#### 複雑なクエリ用のパイプライン
```vtl
## getDashboardMetrics Pipeline Resolver

## Before Mapping Template
{
  "version": "2018-05-29",
  "operation": "BatchInvoke",
  "payload": {
    "tenantId": "$ctx.args.tenantId",
    "projectId": "$ctx.args.projectId",
    "userId": "$ctx.identity.sub"
  }
}

## Function 1: validateTenantAccess
{
  "version": "2018-05-29",
  "operation": "Invoke",
  "payload": {
    "field": "validateTenantAccess",
    "arguments": {
      "tenantId": "$ctx.args.tenantId",
      "userId": "$ctx.identity.sub"
    }
  }
}

## Function 2: getProjectMetrics
{
  "version": "2018-05-29",
  "operation": "Invoke",
  "payload": {
    "field": "getProjectMetrics",
    "arguments": {
      "tenantId": "$ctx.args.tenantId",
      "projectId": "$ctx.args.projectId"
    }
  }
}

## Function 3: getAnalysisMetrics
{
  "version": "2018-05-29",
  "operation": "Invoke",
  "payload": {
    "field": "getAnalysisMetrics",
    "arguments": {
      "tenantId": "$ctx.args.tenantId",
      "projectId": "$ctx.args.projectId"
    }
  }
}

## After Mapping Template
{
  "totalProjects": $ctx.result.projectMetrics.total,
  "totalAnalyses": $ctx.result.analysisMetrics.total,
  "completedAnalyses": $ctx.result.analysisMetrics.completed,
  "avgScore": $ctx.result.analysisMetrics.avgScore,
  "recentAnalyses": $ctx.result.analysisMetrics.recent,
  "pillarScores": $ctx.result.analysisMetrics.pillarScores
}
```

## 認証・認可設計

### Cognito User Pools 設定

```typescript
// lib/constructs/auth-construct.ts
import { UserPool, UserPoolClient, CfnIdentityPool } from 'aws-cdk-lib/aws-cognito';

export class AuthConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // User Pool
    const userPool = new UserPool(this, 'UserPool', {
      userPoolName: 'CloudBestPracticeAnalyzer',
      signInAliases: {
        email: true,
        username: true
      },
      standardAttributes: {
        email: { required: true },
        givenName: { required: true },
        familyName: { required: true }
      },
      customAttributes: {
        tenantId: new StringAttribute({ minLen: 1, maxLen: 50 }),
        role: new StringAttribute({ minLen: 1, maxLen: 50 }),
        projectIds: new StringAttribute({ minLen: 0, maxLen: 1000 })
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      selfSignUpEnabled: false, // 招待制
      adminCreateUserConfig: {
        allowAdminCreateUserOnly: true,
        inviteMessageTemplate: {
          emailSubject: 'Cloud Best Practice Analyzerへの招待',
          emailBody: `
            こんにちは,
            
            Cloud Best Practice Analyzerにご招待いたします。
            
            ユーザー名: {username}
            一時パスワード: {####}
            
            初回ログイン後にパスワードを変更してください。
          `
        }
      }
    });
    
    // User Pool Client
    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userSrp: true,
        adminUserPassword: true
      },
      generateSecret: false,
      tokenValidity: {
        accessToken: Duration.hours(1),
        idToken: Duration.hours(1),
        refreshToken: Duration.days(30)
      }
    });
    
    // Identity Pool
    const identityPool = new CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: userPoolClient.userPoolClientId,
        providerName: userPool.userPoolProviderName
      }]
    });
  }
}
```

### AppSync Authorization Rules

```graphql
# マルチレベル認証ルール
type Project @model
  @auth(rules: [
    # システム管理者: フル権限
    {allow: groups, groups: ["SystemAdmins"], operations: [create, read, update, delete]}
    
    # テナント管理者: 自テナント内フル権限
    {allow: groups, groups: ["ClientAdmins"], operations: [create, read, update, delete]}
    
    # プロジェクトマネージャー: 担当プロジェクトの読み書き
    {allow: groups, groups: ["ProjectManagers"], operations: [read, update]}
    
    # アナリスト: 担当プロジェクトの読み書き（分析関連）
    {allow: groups, groups: ["Analysts"], operations: [read, update]}
    
    # ビューアー: 担当プロジェクトの読み取りのみ
    {allow: groups, groups: ["Viewers"], operations: [read]}
    
    # 顧客エンジニア: 特定プロジェクトの読み取りのみ
    {allow: groups, groups: ["ClientEngineers"], operations: [read]}
  ]) 
  @key(name: "byTenant", fields: ["tenantId", "createdAt"], queryField: "listProjectsByTenant") {
  
  id: ID!
  tenantId: ID!
  # ... 他のフィールド
}
```

### カスタム認証ルール

```typescript
// カスタム認証関数
export const customAuthResolver = async (event: any) => {
  const { identity, source, arguments: args } = event;
  
  // Cognito User Poolからのクレーム抽出
  const tenantId = identity.claims['custom:tenantId'];
  const role = identity.claims['custom:role'];
  const projectIds = JSON.parse(identity.claims['custom:projectIds'] || '[]');
  
  // テナント境界チェック
  if (source && source.tenantId && source.tenantId !== tenantId) {
    throw new Error('Cross-tenant access denied');
  }
  
  // プロジェクトアクセスチェック
  if (source && source.projectId && !projectIds.includes(source.projectId)) {
    if (!['SystemAdmin', 'ClientAdmin'].includes(role)) {
      throw new Error('Project access denied');
    }
  }
  
  return {
    isAuthorized: true,
    resolverContext: {
      tenantId,
      userId: identity.sub,
      role,
      projectIds
    }
  };
};
```

## フロントエンド統合

### Amplify 設定

```typescript
// src/aws-exports.ts (Auto-generated)
const awsconfig = {
  aws_project_region: 'us-east-1',
  aws_appsync_graphqlEndpoint: 'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql',
  aws_appsync_region: 'us-east-1',
  aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
  aws_cognito_identity_pool_id: 'us-east-1:xxx',
  aws_cognito_region: 'us-east-1',
  aws_user_pools_id: 'us-east-1_xxx',
  aws_user_pools_web_client_id: 'xxx',
  aws_cloud_logic_custom: [
    {
      name: 'CloudBestPracticeAnalyzer',
      endpoint: 'https://xxx.appsync-api.us-east-1.amazonaws.com/graphql',
      region: 'us-east-1'
    }
  ]
};

export default awsconfig;
```

### GraphQL Hooks (Auto-generated)

```typescript
// Auto-generated GraphQL hooks
export const useGetDashboardMetrics = (tenantId: string, projectId?: string) => {
  return useQuery(getDashboardMetrics, {
    variables: { tenantId, projectId },
    pollInterval: 30000 // 30秒ごとに更新
  });
};

export const useCreateAnalysis = () => {
  return useMutation(createAnalysis, {
    onCompleted: (data) => {
      // キャッシュ更新
      client.refetchQueries({
        include: [listAnalysesByProject]
      });
    }
  });
};

export const useAnalysisStatusSubscription = (tenantId: string, projectId: string) => {
  return useSubscription(onAnalysisStatusChanged, {
    variables: { tenantId, projectId }
  });
};
```

### DataStore (オフライン対応)

```typescript
// src/models/index.ts (Auto-generated)
import { DataStore } from '@aws-amplify/datastore';
import { Project, Analysis, Report } from './schema';

// オフライン対応の CRUD 操作
export const ProjectService = {
  // リアルタイム同期
  async list(tenantId: string) {
    return await DataStore.query(Project, p => 
      p.tenantId('eq', tenantId)
    );
  },
  
  async create(input: CreateProjectInput) {
    return await DataStore.save(new Project(input));
  },
  
  // オフライン時は自動でローカルに保存、オンライン復帰時に同期
  async update(id: string, updates: Partial<Project>) {
    const original = await DataStore.query(Project, id);
    if (original) {
      return await DataStore.save(Project.copyOf(original, updated => {
        Object.assign(updated, updates);
      }));
    }
  }
};

// リアルタイム変更監視
DataStore.observe(Analysis).subscribe(msg => {
  console.log('Analysis changed:', msg.model, msg.opType, msg.element);
  
  // UI更新のトリガー
  if (msg.opType === 'UPDATE' && msg.element.status === 'COMPLETED') {
    showNotification('分析が完了しました', msg.element.name);
  }
});
```

## リアルタイム機能

### Subscription の活用

```typescript
// フロントエンドでのリアルタイム分析進捗表示
const AnalysisProgress: React.FC<{ analysisId: string }> = ({ analysisId }) => {
  const [analysis, setAnalysis] = useState<Analysis>();
  
  // 初期データ取得
  useEffect(() => {
    DataStore.query(Analysis, analysisId).then(setAnalysis);
  }, [analysisId]);
  
  // リアルタイム更新
  useEffect(() => {
    const subscription = DataStore.observe(Analysis, analysisId).subscribe(msg => {
      if (msg.opType === 'UPDATE') {
        setAnalysis(msg.element);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [analysisId]);
  
  if (!analysis) return <Spin />;
  
  return (
    <Card>
      <Title level={3}>{analysis.name}</Title>
      <Progress 
        percent={getProgressPercent(analysis.status)} 
        status={getProgressStatus(analysis.status)}
      />
      <Tag color={getStatusColor(analysis.status)}>
        {analysis.status}
      </Tag>
    </Card>
  );
};
```

### プッシュ通知

```typescript
// Lambda Function: 分析完了時の通知
export const notifyAnalysisComplete = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventName === 'MODIFY') {
      const newImage = record.dynamodb?.NewImage;
      const oldImage = record.dynamodb?.OldImage;
      
      if (newImage?.status?.S === 'COMPLETED' && oldImage?.status?.S === 'RUNNING') {
        const analysisId = newImage.id.S;
        const tenantId = newImage.tenantId.S;
        
        // AppSync Mutation を通じて Subscription をトリガー
        await appSyncClient.mutate({
          mutation: updateAnalysis,
          variables: {
            input: {
              id: analysisId,
              // トリガー用の最小限の更新
              updatedAt: new Date().toISOString()
            }
          }
        });
        
        // Amplify Push Notifications
        await sendPushNotification(tenantId, {
          title: '分析完了',
          body: `分析 "${newImage.name.S}" が完了しました`,
          data: { analysisId, type: 'ANALYSIS_COMPLETE' }
        });
      }
    }
  }
};
```

## 次のステップ

AppSync GraphQL設計に更新したことで、以下の利点が得られます：

### 利点
1. **型安全性**: Auto-generated GraphQL client
2. **リアルタイム**: Subscriptions による即座の更新
3. **オフライン対応**: DataStore による自動同期
4. **簡単な統合**: Amplify による設定の自動化
5. **効率的なデータ取得**: GraphQL による最適化されたクエリ
6. **キャッシュ管理**: Apollo Client による自動キャッシュ

### 次の実装段階
1. **CDK スタックの作成** - AppSync API の定義
2. **GraphQL スキーマのデプロイ** - 型生成とコード生成
3. **Lambda Resolver の実装** - ビジネスロジック
4. **フロントエンド統合** - Amplify client setup
5. **テスト環境構築** - E2E テストとシナリオ

この設計により、モダンで保守性の高いサーバーレス GraphQL API が構築できます。