# Cloud Best Practice Analyzer - バックエンド設計書

## 概要

本文書は、Cloud Best Practice Analyzer のバックエンドシステムの設計方針と実装計画を定義します。AWS SaaS Builder Toolkit (Basic Tier) を活用したマルチテナント SaaS アーキテクチャを採用し、セキュアで拡張性の高いシステムを構築します。

## アーキテクチャ概要

### 技術スタック

- **インフラストラクチャ**: AWS CDK v2 (TypeScript)
- **コンピュート**: AWS Lambda (Node.js 20.x TypeScript)
- **API**: Amazon API Gateway (REST API)
- **データベース**: Amazon DynamoDB (Pool Model)
- **ストレージ**: Amazon S3 (テナントベースプレフィックス)
- **AI/ML**: Amazon Bedrock (Claude 3.5 Sonnet)
- **認証**: AWS Cognito User Pools
- **マルチテナンシー**: AWS SaaS Builder Toolkit (Basic Tier)
- **監視**: Amazon CloudWatch + AWS X-Ray

### アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Ant Design)            │
└─────────────────────────┬───────────────────────────────────────┘
                         │ HTTPS
┌─────────────────────────▼───────────────────────────────────────┐
│                    Amazon CloudFront                            │
└─────────────────────────┬───────────────────────────────────────┘
                         │
┌─────────────────────────▼───────────────────────────────────────┐
│                    API Gateway (REST)                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │   Auth Layer    │ │  Tenant Router  │ │   Rate Limiter  │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                         │
┌─────────────────────────▼───────────────────────────────────────┐
│                     Lambda Functions                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Analysis  │ │   Project   │ │    User     │ │   Report    ││
│  │   Service   │ │   Service   │ │   Service   │ │   Service   ││
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

## マルチテナンシー設計

### テナント分離戦略

#### 1. Pool Model with Row-Level Security
- **DynamoDB**: パーティションキーにテナントIDを含める
- **S3**: テナントIDベースのプレフィックス分離
- **Lambda**: 実行時テナントコンテキストの注入

#### 2. テナント識別フロー
```typescript
// JWT トークンからテナント情報を抽出
interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  projectIds: string[];
}

// 全てのAPI呼び出しでテナントコンテキストを検証
const validateTenantAccess = (context: TenantContext, resourceId: string) => {
  // テナント境界の検証ロジック
};
```

#### 3. データ分離パターン

**DynamoDB テーブル設計**:
```
PK: TENANT#{tenantId}#ENTITY#{entityType}#{entityId}
SK: METADATA#{timestamp}

例:
PK: TENANT#tenant-123#PROJECT#project-456
SK: METADATA#2024-01-15T10:30:00Z
```

**S3 オブジェクトキー**:
```
{bucket}/tenants/{tenantId}/analyses/{analysisId}/files/{filename}
{bucket}/tenants/{tenantId}/reports/{reportId}/output.pdf
```

## セキュリティ設計

### 1. 認証・認可

#### AWS Cognito 設定
```typescript
interface UserAttributes {
  'custom:tenantId': string;
  'custom:role': 'SystemAdmin' | 'ClientAdmin' | 'ProjectManager' | 'Analyst' | 'Viewer' | 'ClientEngineer';
  'custom:projectIds': string; // JSON array string
}
```

#### ロールベースアクセス制御 (RBAC)
```typescript
const permissions = {
  SystemAdmin: ['*'],
  ClientAdmin: ['tenant:*'],
  ProjectManager: ['project:read', 'project:write', 'analysis:*'],
  Analyst: ['project:read', 'analysis:*'],
  Viewer: ['project:read', 'analysis:read'],
  ClientEngineer: ['project:read', 'analysis:read'] // 特定プロジェクトのみ
};
```

### 2. API セキュリティ

#### Lambda Authorizer
```typescript
interface AuthorizerResponse {
  principalId: string;
  policyDocument: {
    Version: '2012-10-17';
    Statement: Array<{
      Action: string;
      Effect: 'Allow' | 'Deny';
      Resource: string;
    }>;
  };
  context: TenantContext;
}
```

#### リクエスト検証
- スキーマベースのペイロード検証
- レート制限 (テナント別)
- SQLインジェクション対策
- XSS防止

### 3. データ暗号化

- **保存時**: DynamoDB 暗号化、S3 SSE-KMS
- **転送時**: TLS 1.2+ 必須
- **アプリケーションレベル**: 機密データの追加暗号化

## データモデル設計

### DynamoDB テーブル構造

#### 1. メインテーブル (multi-entity table)
```typescript
interface MainTableItem {
  PK: string; // TENANT#{tenantId}#ENTITY#{entityType}#{entityId}
  SK: string; // METADATA#{timestamp} | RELATION#{relationType}#{targetId}
  GSI1PK?: string; // インデックス用
  GSI1SK?: string; // インデックス用
  entityType: 'TENANT' | 'PROJECT' | 'ANALYSIS' | 'USER' | 'FINDING';
  data: Record<string, any>; // エンティティ固有データ
  createdAt: string;
  updatedAt: string;
  ttl?: number; // TTL for temporary data
}
```

#### 2. エンティティ定義

**Tenant**:
```typescript
interface Tenant {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  subscription: {
    tier: 'BASIC';
    limits: {
      monthlyAnalyses: 100;
      maxFileSize: 10485760; // 10MB
      retentionDays: 90;
    };
  };
  adminEmail: string;
  createdAt: string;
  updatedAt: string;
}
```

**Project**:
```typescript
interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  memberIds: string[];
  settings: {
    allowClientAccess: boolean;
    defaultAnalysisType: AnalysisType;
  };
  metrics: {
    totalAnalyses: number;
    lastAnalysisAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

**Analysis**:
```typescript
interface Analysis {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  type: 'CloudFormation' | 'Terraform' | 'CDK' | 'LiveScan';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  inputFiles?: {
    bucket: string;
    key: string;
    size: number;
  }[];
  awsConfig?: {
    region: string;
    accountId: string;
  };
  resultSummary?: {
    overallScore: number;
    pillars: Record<WellArchitectedPillar, {
      score: number;
      findings: number;
    }>;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };
  executionId?: string; // Step Functions execution ID
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

### GSI 設計

#### GSI1: テナント別エンティティ一覧
```
GSI1PK: TENANT#{tenantId}#TYPE#{entityType}
GSI1SK: CREATED#{createdAt}#{entityId}
```

#### GSI2: プロジェクト別分析
```
GSI2PK: PROJECT#{projectId}
GSI2SK: ANALYSIS#{status}#{createdAt}
```

## Lambda 関数設計

### 1. 共通アーキテクチャパターン

#### 関数構造
```typescript
// 共通ハンドラーパターン
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const context = await extractTenantContext(event);
  
  try {
    await validateTenantAccess(context, event);
    const result = await businessLogic(event, context);
    
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(result)
    };
  } catch (error) {
    return handleError(error);
  }
};
```

#### エラーハンドリング
```typescript
class TenantBoundaryViolationError extends Error {
  constructor(tenantId: string, resourceId: string) {
    super(`Tenant ${tenantId} cannot access resource ${resourceId}`);
    this.name = 'TenantBoundaryViolationError';
  }
}

class ResourceNotFoundError extends Error {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} ${resourceId} not found`);
    this.name = 'ResourceNotFoundError';
  }
}
```

### 2. マイクロサービス一覧

#### Analysis Service
- `POST /api/analyses` - 分析開始
- `GET /api/analyses/{analysisId}` - 分析結果取得
- `GET /api/analyses` - 分析一覧
- `DELETE /api/analyses/{analysisId}` - 分析削除

#### Project Service
- `POST /api/projects` - プロジェクト作成
- `GET /api/projects/{projectId}` - プロジェクト詳細
- `PUT /api/projects/{projectId}` - プロジェクト更新
- `GET /api/projects` - プロジェクト一覧

#### User Service
- `GET /api/users/profile` - ユーザープロフィール
- `PUT /api/users/profile` - プロフィール更新
- `GET /api/users/{userId}/permissions` - 権限確認

#### Report Service
- `POST /api/reports/generate` - レポート生成
- `GET /api/reports/{reportId}` - レポート取得
- `GET /api/reports` - レポート一覧

### 3. 分析処理フロー

#### Step Functions ワークフロー
```json
{
  "Comment": "Well-Architected Analysis Workflow",
  "StartAt": "ValidateInput",
  "States": {
    "ValidateInput": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:validateAnalysisInput",
      "Next": "ProcessFiles"
    },
    "ProcessFiles": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:processIaCFiles",
      "Next": "RunAnalysis"
    },
    "RunAnalysis": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:runBedrockAnalysis",
      "Next": "GenerateReport"
    },
    "GenerateReport": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:generateAnalysisReport",
      "End": true
    }
  }
}
```

## Amazon Bedrock 統合

### 1. Claude 3.5 Sonnet 設定

#### プロンプトテンプレート
```typescript
const analysisPrompt = `
あなたはAWS Well-Architected Frameworkの専門家です。
以下のIaCファイルを分析し、6つの柱に基づいて評価してください。

# 分析対象
ファイルタイプ: {fileType}
ファイル内容:
{fileContent}

# 評価基準
以下の6つの柱について、それぞれ0-100点で評価してください：
1. 運用上の優秀性 (Operational Excellence)
2. セキュリティ (Security)
3. 信頼性 (Reliability)
4. パフォーマンス効率 (Performance Efficiency)
5. コスト最適化 (Cost Optimization)
6. 持続可能性 (Sustainability)

# 出力形式
以下のJSON形式で回答してください：
{
  "overallScore": 85,
  "pillars": {
    "OperationalExcellence": { "score": 80, "findings": [...] },
    "Security": { "score": 75, "findings": [...] },
    ...
  },
  "findings": [
    {
      "id": "SEC-001",
      "title": "暗号化が設定されていません",
      "description": "S3バケットで暗号化が有効になっていません",
      "severity": "High",
      "pillar": "Security",
      "resource": "aws_s3_bucket.example",
      "line": 15,
      "recommendation": "server_side_encryption_configuration ブロックを追加してください"
    }
  ]
}
`;
```

#### API呼び出し実装
```typescript
const analyzeWithBedrock = async (content: string, fileType: string): Promise<AnalysisResult> => {
  const client = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  const prompt = analysisPrompt
    .replace('{fileType}', fileType)
    .replace('{fileContent}', content);
  
  const response = await client.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    contentType: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return parseAnalysisResult(result.content[0].text);
};
```

## 運用・監視設計

### 1. ログ戦略

#### CloudWatch Logs 構造
```
/aws/lambda/analysis-service/{tenantId}/{functionName}
/aws/lambda/project-service/{tenantId}/{functionName}
/aws/apigateway/{api-id}/{stage}/{tenantId}
```

#### 構造化ログ
```typescript
interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  tenantId: string;
  userId?: string;
  requestId: string;
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
```

### 2. メトリクス

#### カスタムメトリクス
- `TenantActiveUsers` - テナント別アクティブユーザー数
- `AnalysisExecutionTime` - 分析実行時間
- `AnalysisSuccessRate` - 分析成功率
- `TenantApiCalls` - テナント別API呼び出し数
- `BedrockTokenUsage` - Bedrockトークン使用量

#### アラート設定
```typescript
const alerts = {
  highErrorRate: {
    threshold: '5%',
    period: '5 minutes',
    action: 'SNS notification'
  },
  longAnalysisTime: {
    threshold: '10 minutes',
    period: '1 occurrence',
    action: 'CloudWatch alarm'
  },
  tenantQuotaExceeded: {
    threshold: '90% of limit',
    period: '1 occurrence',
    action: 'Throttle + notification'
  }
};
```

## パフォーマンス設計

### 1. 最適化戦略

#### Lambda 最適化
```typescript
// コールドスタート対策
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3
});

// 接続プールの再利用
let bedrock: BedrockRuntimeClient;
const getBedrockClient = () => {
  if (!bedrock) {
    bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  }
  return bedrock;
};
```

#### DynamoDB 最適化
- Read/Write キャパシティの適切な設定
- パーティションキーの均等分散
- GSI の効率的な設計
- バッチ処理の活用

#### キャッシュ戦略
```typescript
// ElastiCache Redis クラスター
interface CacheStrategy {
  userProfiles: '1 hour';
  projectMetadata: '30 minutes';
  analysisResults: '24 hours';
  tenantSettings: '1 hour';
}
```

### 2. スケーリング設計

#### Lambda 同時実行数
```typescript
const concurrencyLimits = {
  'analysis-service': 100, // CPU集約的
  'project-service': 50,
  'user-service': 30,
  'report-service': 20
};
```

#### DynamoDB オートスケーリング
```typescript
const autoScalingConfig = {
  readCapacity: {
    min: 5,
    max: 1000,
    targetUtilization: 70
  },
  writeCapacity: {
    min: 5,
    max: 500,
    targetUtilization: 70
  }
};
```

## 開発・デプロイ戦略

### 1. 環境構成

#### 環境別設定
```typescript
interface EnvironmentConfig {
  dev: {
    analysisTimeout: 300; // 5分
    bedrockRegion: 'us-east-1';
    retentionDays: 7;
  };
  staging: {
    analysisTimeout: 600; // 10分
    bedrockRegion: 'us-east-1';
    retentionDays: 30;
  };
  production: {
    analysisTimeout: 900; // 15分
    bedrockRegion: 'us-east-1';
    retentionDays: 90;
  };
}
```

### 2. CI/CD パイプライン

#### GitHub Actions ワークフロー
```yaml
name: Deploy Backend
on:
  push:
    branches: [main, develop]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20.x'
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run type-check

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: npm ci
      - run: npm run build
      - run: npx cdk deploy --require-approval never
```

### 3. テスト戦略

#### テストピラミッド
```typescript
// Unit Tests (70%)
describe('TenantService', () => {
  it('should validate tenant access', async () => {
    const service = new TenantService();
    const result = await service.validateAccess('tenant-123', 'resource-456');
    expect(result).toBe(true);
  });
});

// Integration Tests (20%)
describe('Analysis API', () => {
  it('should create analysis with valid input', async () => {
    const response = await request(app)
      .post('/api/analyses')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validAnalysisRequest);
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });
});

// E2E Tests (10%)
describe('Analysis Workflow', () => {
  it('should complete full analysis workflow', async () => {
    // Upload file -> Start analysis -> Wait for completion -> Verify results
  });
});
```

## 制約事項と制限

### AWS SaaS Builder Toolkit Basic Tier 制限
- 月間分析数: 100回
- ファイルサイズ上限: 10MB
- データ保存期間: 90日
- 同時実行分析: 5個

### 技術的制限
- Lambda タイムアウト: 15分
- DynamoDB項目サイズ: 400KB
- API Gateway ペイロード: 10MB
- Bedrock レスポンス: 4096トークン

## 次のステップ

1. **プロジェクト構造の作成** - CDKプロジェクトのセットアップ
2. **共通ライブラリの実装** - テナント管理、認証、ログ
3. **DynamoDB テーブルの作成** - CDKでのインフラ定義
4. **Lambda 関数の実装** - マイクロサービスの順次開発
5. **API Gateway の設定** - エンドポイントとオーソライザー
6. **テスト環境の構築** - CI/CDパイプライン
7. **本番環境デプロイ** - 段階的リリース

---

この設計書に基づいて、次の段階では具体的な実装を開始します。質問や追加の詳細が必要な箇所があれば、お知らせください。