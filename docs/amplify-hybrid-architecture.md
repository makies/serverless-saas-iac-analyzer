# Amplify + CDK ハイブリッドアーキテクチャ設計

## アーキテクチャ概要

AWS Amplify と CDK を組み合わせたハイブリッド構成により、開発効率とカスタマイズ性を両立します。

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Amplify)                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │  Auto Generated │ │   DataStore     │ │  Auth Library   │    │
│  │  GraphQL Client │ │  (Offline)      │ │  (Cognito)      │    │
│  │  + AI Kit       │ │                 │ │                 │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                         │
┌─────────────────────────▼───────────────────────────────────────┐
│                    AWS Amplify 管理                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   AppSync API   │ │   Cognito       │ │   S3 Storage    │    │
│  │   (GraphQL)     │ │   User Pools    │ │   (Basic)       │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   DynamoDB      │ │   Lambda        │ │   AI Kit        │    │
│  │   (DataStore)   │ │   (Resolvers)   │ │   (Bedrock)     │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                         │
┌─────────────────────────▼───────────────────────────────────────┐
│                      CDK 管理                                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   SBT Control   │ │   Monitoring    │ │   Advanced S3   │    │
│  │   Plane         │ │   & Alerts      │ │   Policies      │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   Custom IAM    │ │   EventBridge   │ │   Step          │    │
│  │   Policies      │ │   Rules         │ │   Functions     │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 責任分担

### Amplify 管理 (開発効率重視)
- **GraphQL API**: AppSync + 自動スキーマ生成
- **認証**: Cognito User Pools + Identity Pools
- **データモデル**: DynamoDB + DataStore
- **基本ストレージ**: S3 (Amplify Storage)
- **基本Lambda**: CRUD操作のリゾルバー
- **AI統合**: Amplify AI Kit + Bedrock

### CDK 管理 (カスタマイズ重視)  
- **SBT統合**: Control Plane + Tenant Management
- **高度なIAM**: マルチテナント境界ポリシー
- **モニタリング**: CloudWatch Dashboard + Alarms
- **EventBridge**: SBT ↔ Amplify 連携
- **Step Functions**: 複雑な分析ワークフロー
- **高度なS3**: ライフサイクル + セキュリティポリシー

## プロジェクト構造

```
project-analyzer/
├── amplify/                    # Amplify設定
│   ├── backend/
│   │   ├── api/               # GraphQL API定義
│   │   │   └── cloudbpa/
│   │   │       └── schema.graphql
│   │   ├── auth/              # Cognito設定
│   │   │   └── cloudbpa/
│   │   ├── storage/           # S3設定
│   │   │   └── cloudbpa/
│   │   ├── function/          # Lambda関数
│   │   │   ├── createProject/
│   │   │   ├── startAnalysis/
│   │   │   └── generateReport/
│   │   └── ai/                # AI Kit設定
│   │       └── cloudbpa/
│   ├── cli.json
│   └── team-provider-info.json
│
├── cdk-infrastructure/         # CDK専用ディレクトリ
│   ├── bin/
│   │   └── app.ts
│   ├── lib/
│   │   ├── sbt-stack.ts       # SBT統合
│   │   ├── monitoring-stack.ts # 監視
│   │   ├── security-stack.ts  # IAM + セキュリティ
│   │   └── workflow-stack.ts  # Step Functions
│   ├── package.json
│   └── cdk.json
│
├── frontend/                   # React + Amplify
└── docs/
```

## Phase 1: Amplify セットアップ

### 1. Amplify 初期化

```bash
# プロジェクトルートで
cd project-analyzer
amplify init

# プロジェクト設定
? Enter a name for the project: cloudbpa
? Enter a name for the environment: dev
? Choose your default editor: Visual Studio Code
? Choose the type of app that you're building: javascript
? What javascript framework are you using: react
? Source Directory Path: frontend/src
? Distribution Directory Path: frontend/build
? Build Command: npm run build
? Start Command: npm start
```

### 2. GraphQL API 追加

```bash
amplify add api

? Select from one of the below mentioned services: GraphQL
? Here is the GraphQL API that we will create. Select a setting to edit or continue: Continue
? Choose a schema template: Blank Schema
```

### 3. 認証設定

```bash
amplify add auth

? Do you want to use the default authentication and security configuration? Manual configuration
? Select the authentication/authorization services that you want to use: User Sign-Up, Sign-In, connected with AWS IAM controls
? Please provide a friendly name for your resource that will be used to label this category in the backend: cloudbpaauth
? Please enter a name for your identity pool: cloudbpa_identitypool_dev
? Allow unauthenticated logins? No
? Do you want to enable 3rd party authentication providers in your identity pool? No
? Please provide a name for your user pool: cloudbpa_userpool_dev
? How do you want users to be able to sign in? Email
? Do you want to add User Pool Groups? Yes
? Provide a name for your user pool group: SystemAdmins
? Do you want to add another User Pool Group: Yes
? Provide a name for your user pool group: ClientAdmins
? Do you want to add another User Pool Group: Yes
? Provide a name for your user pool group: ProjectManagers
? Do you want to add another User Pool Group: Yes
? Provide a name for your user pool group: Analysts
? Do you want to add another User Pool Group: Yes
? Provide a name for your user pool group: Viewers
? Do you want to add another User Pool Group: Yes
? Provide a name for your user pool group: ClientEngineers
? Do you want to add another User Pool Group: No
```

### 4. ストレージ追加

```bash
amplify add storage

? Select from one of the below mentioned services: Content (Images, audio, video, etc.)
? Provide a friendly name for your resource that will be used to label this category in the backend: cloudbpastorage
? Provide bucket name: cloudbpa-storage
? Who should have access: Auth users only
? What kind of access do you want for Authenticated users? create/update, read, delete
```

### 5. AI Kit 追加

```bash
amplify add ai

? Select from one of the below mentioned services: Bedrock
? Provide a friendly name for your resource: cloudbpaai
? What models would you like to enable? Claude 3.5 Sonnet
? Do you want to configure advanced settings? Yes
? What is the maximum number of tokens to generate? 4096
? What is the temperature? 0.1
```

## Amplify GraphQL Schema

```graphql
# amplify/backend/api/cloudbpa/schema.graphql

# Enable DataStore
input AMPLIFY { globalAuthRule: AuthRule = { allow: public } }

type Tenant @model 
  @auth(rules: [
    { allow: groups, groups: ["SystemAdmins"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["ClientAdmins"], operations: [read, update] }
  ]) {
  id: ID!
  name: String!
  status: TenantStatus!
  adminEmail: AWSEmail!
  settings: AWSJSON
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  
  # Relations
  projects: [Project] @hasMany(indexName: "byTenant", fields: ["id"])
  users: [User] @hasMany(indexName: "byTenant", fields: ["id"])
}

type Project @model
  @auth(rules: [
    { allow: groups, groups: ["SystemAdmins", "ClientAdmins"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["ProjectManagers"], operations: [read, update] }
    { allow: groups, groups: ["Analysts", "Viewers"], operations: [read] }
  ]) {
  id: ID!
  tenantId: ID! @index(name: "byTenant")
  name: String!
  description: String
  status: ProjectStatus!
  memberIds: [String]!
  settings: AWSJSON
  metrics: AWSJSON
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  createdBy: String!
  
  # Relations
  tenant: Tenant @belongsTo(fields: ["tenantId"])
  analyses: [Analysis] @hasMany(indexName: "byProject", fields: ["id"])
  reports: [Report] @hasMany(indexName: "byProject", fields: ["id"])
}

type Analysis @model
  @auth(rules: [
    { allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["Viewers", "ClientEngineers"], operations: [read] }
  ]) {
  id: ID!
  tenantId: ID! @index(name: "byTenant")
  projectId: ID! @index(name: "byProject")
  name: String!
  type: AnalysisType!
  status: AnalysisStatus!
  inputFiles: AWSJSON
  awsConfig: AWSJSON
  resultSummary: AWSJSON
  executionId: String
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  completedAt: AWSDateTime
  createdBy: String!
  
  # Relations
  tenant: Tenant @belongsTo(fields: ["tenantId"])
  project: Project @belongsTo(fields: ["projectId"])
  findings: [Finding] @hasMany(indexName: "byAnalysis", fields: ["id"])
  reports: [Report] @hasMany(indexName: "byAnalysis", fields: ["id"])
}

type Finding @model
  @auth(rules: [
    { allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["Viewers", "ClientEngineers"], operations: [read] }
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
  
  # Relations
  analysis: Analysis @belongsTo(fields: ["analysisId"])
}

type Report @model
  @auth(rules: [
    { allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["Viewers", "ClientEngineers"], operations: [read] }
  ]) {
  id: ID!
  tenantId: ID! @index(name: "byTenant")
  projectId: ID! @index(name: "byProject")
  analysisId: ID @index(name: "byAnalysis")
  name: String!
  type: ReportType!
  format: ReportFormat!
  status: ReportStatus!
  s3Location: AWSJSON
  generatedBy: String!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  
  # Relations
  tenant: Tenant @belongsTo(fields: ["tenantId"])
  project: Project @belongsTo(fields: ["projectId"])
  analysis: Analysis @belongsTo(fields: ["analysisId"])
}

type User @model
  @auth(rules: [
    { allow: groups, groups: ["SystemAdmins"], operations: [create, read, update, delete] }
    { allow: groups, groups: ["ClientAdmins"], operations: [read, update] }
    { allow: owner, operations: [read, update] }
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
  preferences: AWSJSON
  lastLoginAt: AWSDateTime
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  
  # Relations
  tenant: Tenant @belongsTo(fields: ["tenantId"])
}

# Enums
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

# AI分析用のカスタムミューテーション
type Mutation {
  analyzeInfrastructure(input: AnalyzeInfrastructureInput!): AnalysisResult
    @function(name: "analyzeInfrastructure-${env}")
    @auth(rules: [{ allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"] }])
    
  generateReport(input: GenerateReportInput!): ReportResult
    @function(name: "generateReport-${env}")
    @auth(rules: [{ allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts"] }])
}

input AnalyzeInfrastructureInput {
  analysisId: ID!
  infrastructureFiles: [String]!
  analysisType: AnalysisType!
}

input GenerateReportInput {
  analysisId: ID!
  reportType: ReportType!
  format: ReportFormat!
}

type AnalysisResult {
  success: Boolean!
  message: String!
  executionId: String
}

type ReportResult {
  success: Boolean!
  message: String!
  reportId: String
  downloadUrl: String
}

# Subscriptions for real-time updates
type Subscription {
  onAnalysisStatusUpdated(tenantId: ID!): Analysis
    @aws_subscribe(mutations: ["updateAnalysis"])
    @auth(rules: [{ allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts", "Viewers"] }])
    
  onReportGenerated(tenantId: ID!): Report
    @aws_subscribe(mutations: ["createReport", "updateReport"])
    @auth(rules: [{ allow: groups, groups: ["SystemAdmins", "ClientAdmins", "ProjectManagers", "Analysts", "Viewers"] }])
}
```

## AI Kit 統合

### Bedrock設定

```typescript
// amplify/backend/ai/cloudbpaai/ai-config.ts
export const aiConfig = {
  bedrock: {
    region: 'us-east-1',
    models: {
      claude: {
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        maxTokens: 4096,
        temperature: 0.1,
      }
    }
  }
};
```

### Lambda関数での AI Kit 使用

```typescript
// amplify/backend/function/analyzeInfrastructure/src/index.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { generateText } from '@aws-amplify/ai';

export const handler = async (event: any) => {
  const { analysisId, infrastructureFiles, analysisType } = event.arguments.input;
  
  try {
    // Amplify AI Kit を使用した分析
    const analysisPrompt = `
    Well-Architected Framework の6つの柱に基づいて、以下の${analysisType}コードを分析してください：
    
    ${infrastructureFiles.join('\n\n')}
    
    以下の形式でJSON応答してください：
    {
      "overallScore": 0-100,
      "pillars": [
        {
          "pillar": "SECURITY",
          "score": 0-100,
          "findings": [
            {
              "severity": "HIGH",
              "title": "問題のタイトル",
              "description": "詳細な説明",
              "recommendation": "改善提案",
              "resource": "リソース名",
              "line": 行番号
            }
          ]
        }
      ]
    }
    `;
    
    const result = await generateText({
      prompt: analysisPrompt,
      model: 'claude-3-5-sonnet',
      maxTokens: 4096,
    });
    
    // 結果をDynamoDBに保存
    // ...
    
    return {
      success: true,
      message: 'Analysis completed successfully',
      executionId: `exec-${Date.now()}`,
    };
    
  } catch (error) {
    console.error('Analysis failed:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};
```

次のステップとして、実際にAmplifyプロジェクトのセットアップを開始しますか？