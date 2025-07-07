# Cloud Best Practice Analyzer - システムアーキテクチャ

## 全体アーキテクチャ図

```mermaid
graph TB
    %% Frontend Layer
    subgraph "Frontend (React + Amplify)"
        UI[React UI Components]
        Apollo[Apollo GraphQL Client]
        Auth[Cognito Authentication]
        RUM[CloudWatch RUM]
        Correlation[Correlation ID Context]
    end

    %% API Gateway Layer
    subgraph "API Layer"
        AppSync[AWS AppSync GraphQL API]
        RestAPI[REST API Gateway<br/>SBT Control Plane]
    end

    %% Authentication & Authorization
    subgraph "Auth & Identity"
        UserPool[Cognito User Pool]
        IdentityPool[Cognito Identity Pool]
        IAM[IAM Roles & Policies]
    end

    %% Compute Layer
    subgraph "Compute Services"
        subgraph "Lambda Functions"
            QueryResolvers[Query Resolvers<br/>- getTenant<br/>- getProject<br/>- getAnalysis<br/>- listFrameworks]
            MutationResolvers[Mutation Resolvers<br/>- createProject<br/>- startAnalysis<br/>- generateReport<br/>- createFrameworkSet]
            TenantMgmt[Tenant Management<br/>SBT Integration]
            DataSync[Data Sync Function<br/>SBT ↔ Amplify]
        end
        
        subgraph "Step Functions"
            AnalysisWF[Analysis Workflow<br/>Multi-Framework Processing]
            ReportWF[Report Generation Workflow<br/>PDF/Excel/JSON/HTML]
        end
    end

    %% Data Layer
    subgraph "Data Storage"
        subgraph "DynamoDB Tables"
            TenantsTable[Tenants Table<br/>Pool Model]
            ProjectsTable[Projects Table<br/>Tenant Isolated]
            AnalysesTable[Analyses Table<br/>Results & Status]
            FindingsTable[Findings Table<br/>Security Issues]
            ReportsTable[Reports Table<br/>Generated Reports]
            UsersTable[Users Table<br/>RBAC Data]
            FrameworkRegistry[Framework Registry<br/>Multi-Framework System]
            RuleDefinitions[Rule Definitions<br/>Analysis Rules]
            TenantFrameworkConfig[Tenant Framework Config<br/>Custom Settings]
            TenantAnalytics[Tenant Analytics<br/>Usage Metrics]
            GlobalAnalytics[Global Analytics<br/>Cross-Tenant Insights]
            SBTTenants[SBT Tenants Table<br/>Control Plane Data]
        end
        
        subgraph "S3 Storage"
            AppDataBucket[Application Data Bucket<br/>Analysis Files]
            TemplatesBucket[Templates Bucket<br/>Report Templates]
            LogsBucket[Logs Bucket<br/>Audit & Access Logs]
        end
    end

    %% AI/ML Services
    subgraph "AI Services"
        Bedrock[Amazon Bedrock<br/>Claude 3.5 Sonnet<br/>Analysis Engine]
    end

    %% Monitoring & Observability
    subgraph "Monitoring"
        CloudWatch[CloudWatch<br/>Logs & Metrics]
        XRay[X-Ray<br/>Distributed Tracing]
        EventBridge[EventBridge<br/>SBT Events]
    end

    %% Security & Compliance
    subgraph "Security"
        CDKNag[CDK Nag<br/>Security Validation]
        Encryption[Encryption at Rest<br/>& in Transit]
        VPC[VPC<br/>Network Isolation]
    end

    %% External Integrations
    subgraph "External Systems"
        SBTControlPlane[SBT Control Plane<br/>Multi-Tenant Management]
        CloudFormation[CloudFormation<br/>Infrastructure Analysis]
        Terraform[Terraform<br/>Infrastructure Analysis]
        CDKCode[AWS CDK<br/>Infrastructure Analysis]
    end

    %% Connections
    UI --> Apollo
    Apollo --> AppSync
    Auth --> UserPool
    UserPool --> IdentityPool
    IdentityPool --> IAM
    
    AppSync --> QueryResolvers
    AppSync --> MutationResolvers
    RestAPI --> TenantMgmt
    RestAPI --> DataSync
    
    QueryResolvers --> TenantsTable
    QueryResolvers --> ProjectsTable
    QueryResolvers --> AnalysesTable
    QueryResolvers --> FrameworkRegistry
    
    MutationResolvers --> AnalysisWF
    MutationResolvers --> ReportWF
    MutationResolvers --> TenantsTable
    MutationResolvers --> ProjectsTable
    
    AnalysisWF --> Bedrock
    AnalysisWF --> FindingsTable
    AnalysisWF --> AnalysesTable
    
    ReportWF --> ReportsTable
    ReportWF --> AppDataBucket
    
    TenantMgmt --> SBTTenants
    TenantMgmt --> EventBridge
    DataSync --> EventBridge
    
    EventBridge --> TenantAnalytics
    EventBridge --> GlobalAnalytics
    
    %% External connections
    AnalysisWF --> CloudFormation
    AnalysisWF --> Terraform
    AnalysisWF --> CDKCode
    
    SBTControlPlane --> EventBridge
    
    %% Monitoring connections
    QueryResolvers --> CloudWatch
    MutationResolvers --> CloudWatch
    AnalysisWF --> XRay
    ReportWF --> XRay
    RUM --> CloudWatch
    Correlation --> XRay

    %% Styling
    classDef frontend fill:#e3f2fd
    classDef api fill:#f3e5f5
    classDef auth fill:#e8f5e8
    classDef compute fill:#fff3e0
    classDef data fill:#fce4ec
    classDef ai fill:#e0f2f1
    classDef monitoring fill:#f1f8e9
    classDef security fill:#ffebee
    classDef external fill:#f5f5f5

    class UI,Apollo,Auth,RUM,Correlation frontend
    class AppSync,RestAPI api
    class UserPool,IdentityPool,IAM auth
    class QueryResolvers,MutationResolvers,TenantMgmt,DataSync,AnalysisWF,ReportWF compute
    class TenantsTable,ProjectsTable,AnalysesTable,FindingsTable,ReportsTable,UsersTable,FrameworkRegistry,RuleDefinitions,TenantFrameworkConfig,TenantAnalytics,GlobalAnalytics,SBTTenants,AppDataBucket,TemplatesBucket,LogsBucket data
    class Bedrock ai
    class CloudWatch,XRay,EventBridge monitoring
    class CDKNag,Encryption,VPC security
    class SBTControlPlane,CloudFormation,Terraform,CDKCode external
```

## データフロー図

```mermaid
sequenceDiagram
    participant User as Frontend User
    participant UI as React UI
    participant Apollo as Apollo Client
    participant AppSync as AppSync API
    participant Lambda as Lambda Resolver
    participant StepFn as Step Functions
    participant Bedrock as Amazon Bedrock
    participant DDB as DynamoDB
    participant S3 as S3 Storage
    participant EventBridge as EventBridge

    User->>UI: Start Analysis
    UI->>Apollo: Generate Correlation ID
    Apollo->>AppSync: startAnalysis Mutation
    Note over Apollo,AppSync: Headers: X-Correlation-Id, Authorization
    
    AppSync->>Lambda: Invoke Mutation Resolver
    Lambda->>StepFn: Start Analysis Workflow
    
    StepFn->>StepFn: Validate Input
    StepFn->>StepFn: Initialize Analysis
    StepFn->>Lambda: Initialize Frameworks
    Lambda->>DDB: Check Framework Config
    
    StepFn->>Lambda: Run Framework Analysis
    Lambda->>Bedrock: Invoke Claude 3.5 Sonnet
    Bedrock-->>Lambda: Analysis Results
    
    Lambda->>DDB: Store Findings
    Lambda->>S3: Store Analysis Files
    Lambda->>EventBridge: Publish Analysis Event
    
    StepFn->>Lambda: Extract Results
    Lambda->>DDB: Update Analysis Status
    
    StepFn-->>AppSync: Analysis Complete
    AppSync-->>Apollo: GraphQL Response
    Apollo-->>UI: Update UI State
    UI-->>User: Show Results
```

## マルチテナント分離アーキテクチャ

```mermaid
graph TB
    subgraph "Tenant A"
        TenantA_Users[Users]
        TenantA_Projects[Projects]
        TenantA_Data[Analysis Data]
    end
    
    subgraph "Tenant B"
        TenantB_Users[Users]
        TenantB_Projects[Projects]
        TenantB_Data[Analysis Data]
    end
    
    subgraph "Shared Infrastructure"
        subgraph "Pool Model DynamoDB"
            SharedTable[Single Table<br/>with Tenant ID]
        end
        
        subgraph "IAM Policies"
            TenantIsolation[Row Level Security<br/>Tenant ID Conditions]
        end
        
        subgraph "Lambda Functions"
            SharedLambda[Shared Lambda Functions<br/>with Tenant Context]
        end
    end
    
    subgraph "SBT Control Plane"
        TenantMgmt[Tenant Management]
        UserMgmt[User Management]
        BillingMgmt[Billing Management]
    end
    
    TenantA_Users --> SharedTable
    TenantA_Projects --> SharedTable
    TenantA_Data --> SharedTable
    
    TenantB_Users --> SharedTable
    TenantB_Projects --> SharedTable
    TenantB_Data --> SharedTable
    
    SharedTable --> TenantIsolation
    TenantIsolation --> SharedLambda
    
    TenantMgmt --> SharedTable
    UserMgmt --> SharedTable
    BillingMgmt --> SharedTable
```

## セキュリティアーキテクチャ

```mermaid
graph TB
    subgraph "Frontend Security"
        HTTPS[HTTPS/TLS 1.3]
        CSP[Content Security Policy]
        CORS[CORS Configuration]
    end
    
    subgraph "API Security"
        Cognito[Cognito Authentication]
        JWT[JWT Token Validation]
        RBAC[Role-Based Access Control]
        RateLimit[Rate Limiting]
    end
    
    subgraph "Data Security"
        Encryption[Encryption at Rest]
        Transit[Encryption in Transit]
        TenantIsolation[Tenant Data Isolation]
        Audit[Audit Logging]
    end
    
    subgraph "Infrastructure Security"
        VPCEndpoints[VPC Endpoints]
        SecurityGroups[Security Groups]
        NACLs[Network ACLs]
        WAF[AWS WAF]
    end
    
    subgraph "Compliance"
        CDKNag[CDK Nag Validation]
        NIST[NIST 800-53 R5]
        SOC2[SOC 2 Compliance]
        GDPR[GDPR Compliance]
    end
    
    HTTPS --> JWT
    JWT --> RBAC
    RBAC --> TenantIsolation
    TenantIsolation --> Encryption
    Encryption --> Audit
    
    VPCEndpoints --> SecurityGroups
    SecurityGroups --> NACLs
    WAF --> RateLimit
    
    CDKNag --> NIST
    NIST --> SOC2
    SOC2 --> GDPR
```

## 監視・可観測性アーキテクチャ

```mermaid
graph TB
    subgraph "Frontend Monitoring"
        RUM[CloudWatch RUM<br/>Real User Monitoring]
        ClientMetrics[Client-Side Metrics]
        ErrorTracking[Error Tracking]
    end
    
    subgraph "API Monitoring"
        AppSyncLogs[AppSync Logs]
        APIMetrics[API Gateway Metrics]
        LambdaMetrics[Lambda Metrics]
    end
    
    subgraph "Infrastructure Monitoring"
        CloudWatchLogs[CloudWatch Logs]
        CloudWatchMetrics[CloudWatch Metrics]
        XRayTracing[X-Ray Distributed Tracing]
    end
    
    subgraph "Business Monitoring"
        TenantMetrics[Tenant Usage Metrics]
        AnalysisMetrics[Analysis Performance]
        CostMetrics[Cost Optimization]
    end
    
    subgraph "Alerting"
        CloudWatchAlarms[CloudWatch Alarms]
        SNSNotifications[SNS Notifications]
        SlackIntegration[Slack Integration]
    end
    
    RUM --> CloudWatchLogs
    ClientMetrics --> CloudWatchMetrics
    ErrorTracking --> CloudWatchAlarms
    
    AppSyncLogs --> XRayTracing
    APIMetrics --> CloudWatchMetrics
    LambdaMetrics --> CloudWatchAlarms
    
    TenantMetrics --> CloudWatchMetrics
    AnalysisMetrics --> CloudWatchAlarms
    CostMetrics --> SNSNotifications
    
    CloudWatchAlarms --> SNSNotifications
    SNSNotifications --> SlackIntegration
```

## 技術スタック概要

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React + TypeScript + Apollo Client | ユーザーインターフェース |
| API | AWS AppSync GraphQL | API Gateway & リアルタイム |
| Authentication | AWS Cognito | 認証・認可 |
| Compute | AWS Lambda + Step Functions | サーバーレス処理 |
| AI/ML | Amazon Bedrock (Claude 3.5 Sonnet) | 分析エンジン |
| Database | DynamoDB (Pool Model) | NoSQL データストア |
| Storage | Amazon S3 | ファイルストレージ |
| Monitoring | CloudWatch + X-Ray + RUM | 可観測性 |
| Security | CDK Nag + IAM + VPC | セキュリティ |
| Multi-Tenancy | SBT (SaaS Builder Toolkit) | テナント管理 |
| IaC | AWS CDK + TypeScript | インフラ定義 |

このアーキテクチャは、スケーラブルで安全なマルチテナントSaaSアプリケーションとして設計されており、AWS Well-Architected Frameworkの5つの柱（運用性、セキュリティ、信頼性、パフォーマンス効率、コスト最適化）に準拠しています。