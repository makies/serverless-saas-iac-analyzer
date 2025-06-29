# AWS Powertools for Lambda (TypeScript) 統合設計

## 概要

AWS Powertools for Lambda (TypeScript) を全面的に統合し、包括的な観測可能性（Observability）とベストプラクティスを実装します。

## Powertools 機能の活用

### 1. Logger (構造化ログ)
### 2. Tracer (X-Ray 分散トレーシング)
### 3. Metrics (カスタムメトリクス)
### 4. Parser (イベント解析とバリデーション)
### 5. Idempotency (冪等性保証)
### 6. Parameters (パラメータストア統合)
### 7. Batch (バッチ処理最適化)

## 依存関係の追加

### `package.json` 更新

```json
{
  "dependencies": {
    "@aws-lambda-powertools/logger": "^1.17.0",
    "@aws-lambda-powertools/tracer": "^1.17.0",
    "@aws-lambda-powertools/metrics": "^1.17.0",
    "@aws-lambda-powertools/parser": "^1.17.0",
    "@aws-lambda-powertools/idempotency": "^1.17.0",
    "@aws-lambda-powertools/parameters": "^1.17.0",
    "@aws-lambda-powertools/batch": "^1.17.0",
    "aws-cdk-lib": "^2.100.0",
    "aws-lambda": "^1.0.7",
    "@aws-sdk/client-dynamodb": "^3.400.0"
  }
}
```

## 共通設定とユーティリティ

### `src/shared/powertools/config.ts`

```typescript
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { getParameter } from '@aws-lambda-powertools/parameters/ssm';

// 環境変数から設定を取得
const SERVICE_NAME = process.env.SERVICE_NAME || 'cloud-best-practice-analyzer';
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// Logger インスタンス
export const logger = new Logger({
  serviceName: SERVICE_NAME,
  logLevel: LOG_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  persistentLogAttributes: {
    environment: ENVIRONMENT,
    version: process.env.VERSION || '1.0.0'
  }
});

// Tracer インスタンス
export const tracer = new Tracer({
  serviceName: SERVICE_NAME,
  captureHTTPsRequests: true,
  captureResponse: true
});

// Metrics インスタンス
export const metrics = new Metrics({
  serviceName: SERVICE_NAME,
  namespace: 'CloudBestPracticeAnalyzer',
  defaultDimensions: {
    Environment: ENVIRONMENT,
    Service: SERVICE_NAME
  }
});

// パラメータ取得ヘルパー
export const getSecureParameter = async (name: string): Promise<string> => {
  return await getParameter(name, { decrypt: true });
};

export const getParameterWithCache = async (name: string, maxAge: number = 300): Promise<string> => {
  return await getParameter(name, { maxAge });
};
```

### `src/shared/powertools/decorators.ts`

```typescript
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { AppSyncResolverEvent, Context } from 'aws-lambda';
import { logger, tracer, metrics } from './config';

// カスタムデコレータ: GraphQL Resolver用の包括的な観測可能性
export function observableResolver(
  resolverName: string,
  options: {
    captureResponse?: boolean;
    logEvent?: boolean;
    addColdStartMetric?: boolean;
  } = {}
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (event: AppSyncResolverEvent<any>, context: Context) {
      const subsegment = tracer.getSegment()?.addNewSubsegment(`## ${resolverName}`);
      const startTime = Date.now();
      
      // テナントコンテキストの抽出とログへの追加
      const tenantId = event.identity?.claims?.['custom:tenantId'];
      const userId = event.identity?.sub;
      const requestId = context.awsRequestId;
      
      // ログコンテキストの設定
      logger.addContext({
        tenantId,
        userId,
        requestId,
        resolverName,
        arguments: options.logEvent ? event.arguments : '[REDACTED]'
      });
      
      // トレースコンテキストの設定
      tracer.putAnnotation('tenantId', tenantId || 'unknown');
      tracer.putAnnotation('resolverName', resolverName);
      tracer.putAnnotation('userId', userId || 'unknown');
      
      // コールドスタートメトリクス
      if (options.addColdStartMetric) {
        metrics.addMetric('ColdStart', MetricUnits.Count, 1);
      }
      
      logger.info(`${resolverName} started`, {
        operation: 'resolver_start',
        fieldName: event.info.fieldName,
        parentTypeName: event.info.parentTypeName
      });
      
      try {
        // 実際のResolver実行
        const result = await method.call(this, event, context);
        
        const duration = Date.now() - startTime;
        
        // 成功メトリクス
        metrics.addMetric(`${resolverName}Success`, MetricUnits.Count, 1);
        metrics.addMetric(`${resolverName}Duration`, MetricUnits.Milliseconds, duration);
        
        // テナント別メトリクス
        if (tenantId) {
          metrics.addDimension('TenantId', tenantId);
          metrics.addMetric('ResolverExecution', MetricUnits.Count, 1);
        }
        
        logger.info(`${resolverName} completed successfully`, {
          operation: 'resolver_success',
          duration,
          resultType: typeof result,
          resultSize: JSON.stringify(result).length
        });
        
        // レスポンスキャプチャ
        if (options.captureResponse) {
          tracer.putMetadata('response', result);
        }
        
        subsegment?.close();
        
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // エラーメトリクス
        metrics.addMetric(`${resolverName}Error`, MetricUnits.Count, 1);
        metrics.addMetric(`${resolverName}Duration`, MetricUnits.Milliseconds, duration);
        
        // エラー分類メトリクス
        const errorType = error.constructor.name;
        metrics.addMetric(`${resolverName}Error_${errorType}`, MetricUnits.Count, 1);
        
        logger.error(`${resolverName} failed`, {
          operation: 'resolver_error',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          duration
        });
        
        // X-Rayにエラー情報を記録
        tracer.addErrorAsMetadata(error);
        subsegment?.addError(error);
        subsegment?.close(error);
        
        throw error;
      } finally {
        // メトリクスの送信
        metrics.publishStoredMetrics();
        
        // ログコンテキストのクリア
        logger.removeKeys(['tenantId', 'userId', 'requestId', 'resolverName', 'arguments']);
      }
    };
    
    return descriptor;
  };
}

// バッチ処理用デコレータ
export function batchProcessor(options: {
  batchSize?: number;
  timeWindow?: number;
} = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (event: any, context: Context) {
      const { processPartialResponse } = await import('@aws-lambda-powertools/batch');
      
      return await processPartialResponse(
        event, 
        method.bind(this), 
        context,
        {
          batchSize: options.batchSize || 10,
          timeWindow: options.timeWindow || 20
        }
      );
    };
    
    return descriptor;
  };
}
```

### `src/shared/powertools/tenant-context.ts`

```typescript
import { AppSyncResolverEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { logger, tracer, metrics } from './config';

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
  projectIds: string[];
  permissions: string[];
  requestId: string;
}

export class TenantContextManager {
  private static instance: TenantContextManager;
  private currentContext: TenantContext | null = null;
  
  public static getInstance(): TenantContextManager {
    if (!TenantContextManager.instance) {
      TenantContextManager.instance = new TenantContextManager();
    }
    return TenantContextManager.instance;
  }
  
  public extractFromEvent(event: AppSyncResolverEvent<any>, requestId: string): TenantContext {
    const claims = event.identity?.claims;
    
    if (!claims) {
      throw new Error('No identity claims found in event');
    }
    
    const context: TenantContext = {
      tenantId: claims['custom:tenantId'] || '',
      userId: event.identity?.sub || '',
      role: claims['custom:role'] || '',
      projectIds: JSON.parse(claims['custom:projectIds'] || '[]'),
      permissions: this.getRolePermissions(claims['custom:role'] || ''),
      requestId
    };
    
    // バリデーション
    if (!context.tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    if (!context.userId) {
      throw new Error('User ID is required');
    }
    
    // コンテキストの設定
    this.setContext(context);
    
    return context;
  }
  
  public setContext(context: TenantContext): void {
    this.currentContext = context;
    
    // Logger にコンテキストを追加
    logger.addPersistentLogAttributes({
      tenantId: context.tenantId,
      userId: context.userId,
      role: context.role,
      requestId: context.requestId
    });
    
    // Tracer にアノテーションを追加
    tracer.putAnnotation('tenantId', context.tenantId);
    tracer.putAnnotation('userId', context.userId);
    tracer.putAnnotation('role', context.role);
    
    // Metrics にディメンションを追加
    metrics.addDimension('TenantId', context.tenantId);
    metrics.addDimension('UserRole', context.role);
  }
  
  public getContext(): TenantContext {
    if (!this.currentContext) {
      throw new Error('Tenant context not initialized');
    }
    return this.currentContext;
  }
  
  public clearContext(): void {
    if (this.currentContext) {
      // Logger からコンテキストを削除
      logger.removeKeys(['tenantId', 'userId', 'role', 'requestId']);
      
      this.currentContext = null;
    }
  }
  
  private getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      'SystemAdmin': ['*'],
      'ClientAdmin': ['tenant:*'],
      'ProjectManager': ['project:read', 'project:write', 'analysis:*'],
      'Analyst': ['project:read', 'analysis:*'],
      'Viewer': ['project:read', 'analysis:read'],
      'ClientEngineer': ['project:read', 'analysis:read']
    };
    
    return rolePermissions[role] || [];
  }
}

// ヘルパー関数
export const extractTenantContext = (
  event: AppSyncResolverEvent<any>, 
  requestId: string
): TenantContext => {
  return TenantContextManager.getInstance().extractFromEvent(event, requestId);
};

export const getCurrentTenantContext = (): TenantContext => {
  return TenantContextManager.getInstance().getContext();
};
```

## Resolver実装例 (Powertools統合)

### `src/resolvers/query/project/listProjectsByTenant.ts`

```typescript
import { AppSyncResolverHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { 
  ListProjectsByTenantQueryVariables, 
  ModelProjectConnection 
} from '@shared/types/graphql';
import { ProjectService } from '@shared/services';
import { observableResolver } from '@shared/powertools/decorators';
import { extractTenantContext } from '@shared/powertools/tenant-context';
import { logger, tracer, metrics } from '@shared/powertools/config';

class ListProjectsByTenantResolver {
  
  @observableResolver('listProjectsByTenant', {
    captureResponse: true,
    logEvent: false, // 機密情報を含む可能性があるため
    addColdStartMetric: true
  })
  public async handler(
    event: AppSyncResolverEvent<ListProjectsByTenantQueryVariables>
  ): Promise<ModelProjectConnection> {
    
    // テナントコンテキストの抽出
    const tenantContext = extractTenantContext(event, event.requestId || '');
    
    // 入力バリデーション
    const { tenantId, filter, limit, nextToken } = event.arguments;
    
    if (!tenantId) {
      throw new Error('tenantId is required');
    }
    
    // テナント境界チェック
    if (tenantContext.tenantId !== tenantId) {
      metrics.addMetric('TenantBoundaryViolation', MetricUnits.Count, 1);
      
      logger.warn('Tenant boundary violation attempt', {
        requestedTenantId: tenantId,
        userTenantId: tenantContext.tenantId,
        operation: 'tenant_boundary_violation'
      });
      
      throw new Error('Access denied: Cross-tenant access not allowed');
    }
    
    // サービス実行のトレース
    return await tracer.captureAsyncFunc('ProjectService.listByTenant', async (subsegment) => {
      // サブセグメントにメタデータを追加
      subsegment?.addMetadata('input', {
        tenantId,
        hasFilter: !!filter,
        limit: limit || 'default',
        hasNextToken: !!nextToken
      });
      
      const projectService = new ProjectService();
      
      // キャッシュ確認のトレース
      const cacheResult = await tracer.captureAsyncFunc('checkCache', async () => {
        // キャッシュロジック（実装例）
        return null; // キャッシュミス
      });
      
      if (cacheResult) {
        metrics.addMetric('CacheHit', MetricUnits.Count, 1);
        logger.info('Cache hit for projects list', {
          operation: 'cache_hit',
          tenantId
        });
        return cacheResult;
      } else {
        metrics.addMetric('CacheMiss', MetricUnits.Count, 1);
      }
      
      // データベースアクセスのトレース
      const result = await tracer.captureAsyncFunc('DynamoDB.query', async (dbSegment) => {
        dbSegment?.addMetadata('query_params', {
          tableName: process.env.MAIN_TABLE_NAME,
          partitionKey: `TENANT#${tenantId}#TYPE#PROJECT`,
          limit
        });
        
        return await projectService.listByTenant(
          tenantId,
          { filter, limit, nextToken },
          tenantContext
        );
      });
      
      // 結果メトリクス
      metrics.addMetric('ProjectsRetrieved', MetricUnits.Count, result.items.length);
      
      if (result.items.length > 0) {
        metrics.addMetric('ProjectQuerySuccess', MetricUnits.Count, 1);
      }
      
      // 結果の特性メトリクス
      const activeProjects = result.items.filter(p => p.status === 'ACTIVE').length;
      metrics.addMetric('ActiveProjects', MetricUnits.Count, activeProjects);
      
      logger.info('Projects retrieved successfully', {
        operation: 'projects_retrieved',
        totalCount: result.items.length,
        activeCount: activeProjects,
        hasNextToken: !!result.nextToken
      });
      
      return result;
    });
  }
}

export const handler: AppSyncResolverHandler<
  ListProjectsByTenantQueryVariables,
  ModelProjectConnection
> = async (event, context) => {
  const resolver = new ListProjectsByTenantResolver();
  return await resolver.handler(event);
};
```

### `src/resolvers/mutation/analysis/createAnalysis.ts`

```typescript
import { AppSyncResolverHandler } from 'aws-lambda';
import { Parser } from '@aws-lambda-powertools/parser';
import { IdempotencyKey, makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { 
  CreateAnalysisInput, 
  Analysis 
} from '@shared/types/graphql';
import { AnalysisService } from '@shared/services';
import { observableResolver } from '@shared/powertools/decorators';
import { extractTenantContext } from '@shared/powertools/tenant-context';
import { logger, tracer, metrics } from '@shared/powertools/config';
import { z } from 'zod';

// 入力スキーマ定義
const CreateAnalysisInputSchema = z.object({
  input: z.object({
    tenantId: z.string().min(1),
    projectId: z.string().min(1),
    name: z.string().min(1).max(100),
    type: z.enum(['CLOUDFORMATION', 'TERRAFORM', 'CDK', 'LIVE_SCAN']),
    inputFiles: z.array(z.object({
      bucket: z.string(),
      key: z.string(),
      size: z.number().positive()
    })).optional(),
    awsConfig: z.object({
      region: z.string(),
      accountId: z.string().regex(/^\d{12}$/),
      roleArn: z.string().optional()
    }).optional()
  })
});

// 冪等性のためのPersistence Layer
const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME || 'IdempotencyTable'
});

class CreateAnalysisResolver {
  
  @observableResolver('createAnalysis', {
    captureResponse: false, // 機密情報を含む可能性
    logEvent: false,
    addColdStartMetric: true
  })
  @Parser({ schema: CreateAnalysisInputSchema }) // 入力バリデーション
  public async handler(
    event: AppSyncResolverEvent<{ input: CreateAnalysisInput }>
  ): Promise<Analysis> {
    
    const tenantContext = extractTenantContext(event, event.requestId || '');
    const { input } = event.arguments;
    
    // 権限チェック
    if (!tenantContext.permissions.includes('analysis:create') && 
        !tenantContext.permissions.includes('*')) {
      metrics.addMetric('UnauthorizedAccess', MetricUnits.Count, 1);
      throw new Error('Permission denied: analysis:create required');
    }
    
    // テナント境界チェック
    if (tenantContext.tenantId !== input.tenantId) {
      metrics.addMetric('TenantBoundaryViolation', MetricUnits.Count, 1);
      throw new Error('Cross-tenant access denied');
    }
    
    // プロジェクトアクセスチェック
    if (!tenantContext.projectIds.includes(input.projectId) &&
        !['SystemAdmin', 'ClientAdmin'].includes(tenantContext.role)) {
      metrics.addMetric('ProjectAccessDenied', MetricUnits.Count, 1);
      throw new Error('Project access denied');
    }
    
    // クォータチェック
    await this.checkQuota(tenantContext.tenantId, input);
    
    // 冪等性キーの生成
    const idempotencyKey = `${tenantContext.tenantId}:${input.projectId}:${input.name}:${JSON.stringify(input.inputFiles || input.awsConfig)}`;
    
    // 冪等性を保証した分析作成
    return await this.createAnalysisIdempotent(input, tenantContext, idempotencyKey);
  }
  
  private async checkQuota(tenantId: string, input: CreateAnalysisInput): Promise<void> {
    return await tracer.captureAsyncFunc('checkQuota', async (subsegment) => {
      // 月間分析数チェック
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      
      subsegment?.addMetadata('quota_check', {
        tenantId,
        month: currentMonth,
        analysisType: input.type
      });
      
      // TODO: DynamoDBから月間分析数を取得
      const monthlyCount = await this.getMonthlyAnalysisCount(tenantId, currentMonth);
      const quota = 100; // Basic Tier制限
      
      if (monthlyCount >= quota) {
        metrics.addMetric('QuotaExceeded', MetricUnits.Count, 1);
        metrics.addDimension('QuotaType', 'MonthlyAnalyses');
        
        logger.warn('Monthly analysis quota exceeded', {
          operation: 'quota_exceeded',
          tenantId,
          currentCount: monthlyCount,
          quota
        });
        
        throw new Error(`Monthly analysis quota exceeded. Current: ${monthlyCount}, Limit: ${quota}`);
      }
      
      // ファイルサイズチェック
      if (input.inputFiles) {
        const totalSize = input.inputFiles.reduce((sum, file) => sum + file.size, 0);
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (totalSize > maxSize) {
          metrics.addMetric('FileSizeExceeded', MetricUnits.Count, 1);
          throw new Error(`File size limit exceeded. Total: ${totalSize}, Limit: ${maxSize}`);
        }
      }
      
      metrics.addMetric('QuotaCheckPassed', MetricUnits.Count, 1);
    });
  }
  
  @makeIdempotent({
    persistenceStore,
    config: {
      eventKeyJmespath: 'idempotencyKey',
      payloadValidationJmespath: 'input',
      throwOnNoIdempotencyKey: true,
      expiresAfterSeconds: 3600, // 1時間
      useLocalCache: true
    }
  })
  private async createAnalysisIdempotent(
    input: CreateAnalysisInput,
    tenantContext: any,
    idempotencyKey: string
  ): Promise<Analysis> {
    
    return await tracer.captureAsyncFunc('AnalysisService.create', async (subsegment) => {
      subsegment?.addMetadata('create_analysis', {
        tenantId: input.tenantId,
        projectId: input.projectId,
        analysisType: input.type,
        hasFiles: !!input.inputFiles,
        hasAwsConfig: !!input.awsConfig
      });
      
      const analysisService = new AnalysisService();
      const analysis = await analysisService.create(input, tenantContext);
      
      // 成功メトリクス
      metrics.addMetric('AnalysisCreated', MetricUnits.Count, 1);
      metrics.addDimension('AnalysisType', input.type);
      
      // 分析開始の非同期処理をトリガー
      await this.triggerAnalysisWorkflow(analysis.id);
      
      logger.info('Analysis created successfully', {
        operation: 'analysis_created',
        analysisId: analysis.id,
        analysisType: input.type,
        projectId: input.projectId
      });
      
      return analysis;
    });
  }
  
  private async getMonthlyAnalysisCount(tenantId: string, month: string): Promise<number> {
    // DynamoDB クエリ実装
    // GSI: byTenantMonth (tenantId-month, createdAt)
    return 0; // 仮実装
  }
  
  private async triggerAnalysisWorkflow(analysisId: string): Promise<void> {
    await tracer.captureAsyncFunc('triggerStepFunction', async () => {
      // Step Functions実行開始
      // 実装は後続で定義
    });
  }
}

export const handler: AppSyncResolverHandler<
  { input: CreateAnalysisInput },
  Analysis
> = async (event, context) => {
  const resolver = new CreateAnalysisResolver();
  return await resolver.handler(event);
};
```

## パラメータ管理とシークレット管理

### `src/shared/powertools/parameters.ts`

```typescript
import { 
  getParameter, 
  getParameters, 
  getSecret 
} from '@aws-lambda-powertools/parameters/ssm';
import { 
  getSecret as getSecretsManagerSecret 
} from '@aws-lambda-powertools/parameters/secrets';
import { tracer } from './config';

export class ParameterManager {
  private static instance: ParameterManager;
  
  public static getInstance(): ParameterManager {
    if (!ParameterManager.instance) {
      ParameterManager.instance = new ParameterManager();
    }
    return ParameterManager.instance;
  }
  
  // Bedrock設定の取得
  public async getBedrockConfig(): Promise<{
    region: string;
    modelId: string;
    maxTokens: number;
  }> {
    return await tracer.captureAsyncFunc('getBedrockConfig', async () => {
      const parameters = await getParameters('/cloud-best-practice-analyzer/bedrock/', {
        recursive: true,
        decrypt: true,
        maxAge: 300 // 5分キャッシュ
      });
      
      return {
        region: parameters['/cloud-best-practice-analyzer/bedrock/region'] || 'us-east-1',
        modelId: parameters['/cloud-best-practice-analyzer/bedrock/model-id'] || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        maxTokens: parseInt(parameters['/cloud-best-practice-analyzer/bedrock/max-tokens'] || '4000')
      };
    });
  }
  
  // データベース設定の取得
  public async getDatabaseConfig(): Promise<{
    tableName: string;
    gsi1Name: string;
    gsi2Name: string;
  }> {
    return await tracer.captureAsyncFunc('getDatabaseConfig', async () => {
      const config = await getParameters('/cloud-best-practice-analyzer/database/', {
        recursive: true,
        maxAge: 600 // 10分キャッシュ
      });
      
      return {
        tableName: config['/cloud-best-practice-analyzer/database/main-table'] || process.env.MAIN_TABLE_NAME || '',
        gsi1Name: config['/cloud-best-practice-analyzer/database/gsi1-name'] || 'GSI1',
        gsi2Name: config['/cloud-best-practice-analyzer/database/gsi2-name'] || 'GSI2'
      };
    });
  }
  
  // 機密情報の取得（Secrets Manager）
  public async getBedrockApiKey(): Promise<string> {
    return await tracer.captureAsyncFunc('getBedrockApiKey', async () => {
      return await getSecretsManagerSecret('/cloud-best-practice-analyzer/bedrock/api-key', {
        maxAge: 3600 // 1時間キャッシュ
      });
    });
  }
  
  // 外部API設定の取得
  public async getExternalApiConfig(): Promise<Record<string, any>> {
    return await tracer.captureAsyncFunc('getExternalApiConfig', async () => {
      const config = await getParameters('/cloud-best-practice-analyzer/external-apis/', {
        recursive: true,
        decrypt: true,
        maxAge: 300
      });
      
      return config;
    });
  }
}
```

## バッチ処理での活用

### `src/workers/analysis/processAnalysisBatch.ts`

```typescript
import { SQSHandler, SQSEvent, SQSRecord } from 'aws-lambda';
import { BatchProcessor, EventType, processPartialResponse } from '@aws-lambda-powertools/batch';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Parser } from '@aws-lambda-powertools/parser';
import { logger, tracer, metrics } from '@shared/powertools/config';
import { z } from 'zod';

// SQSメッセージスキーマ
const AnalysisMessageSchema = z.object({
  analysisId: z.string(),
  tenantId: z.string(),
  projectId: z.string(),
  type: z.enum(['CLOUDFORMATION', 'TERRAFORM', 'CDK', 'LIVE_SCAN']),
  inputFiles: z.array(z.object({
    bucket: z.string(),
    key: z.string()
  })).optional(),
  awsConfig: z.object({
    region: z.string(),
    accountId: z.string()
  }).optional()
});

const processor = new BatchProcessor(EventType.SQS);

const recordHandler = async (record: SQSRecord): Promise<void> => {
  const subsegment = tracer.getSegment()?.addNewSubsegment('## ProcessAnalysisRecord');
  
  try {
    // メッセージの解析とバリデーション
    const message = JSON.parse(record.body);
    const validatedMessage = AnalysisMessageSchema.parse(message);
    
    // テナントIDをログとメトリクスに追加
    logger.addContext({
      tenantId: validatedMessage.tenantId,
      analysisId: validatedMessage.analysisId,
      analysisType: validatedMessage.type,
      messageId: record.messageId
    });
    
    tracer.putAnnotation('tenantId', validatedMessage.tenantId);
    tracer.putAnnotation('analysisId', validatedMessage.analysisId);
    tracer.putAnnotation('analysisType', validatedMessage.type);
    
    metrics.addDimension('TenantId', validatedMessage.tenantId);
    metrics.addDimension('AnalysisType', validatedMessage.type);
    
    logger.info('Processing analysis record', {
      operation: 'batch_process_start',
      analysisId: validatedMessage.analysisId
    });
    
    // 分析処理の実行
    await tracer.captureAsyncFunc('executeAnalysis', async () => {
      const analysisService = new AnalysisService();
      await analysisService.processAnalysis(validatedMessage);
    });
    
    // 成功メトリクス
    metrics.addMetric('AnalysisProcessingSuccess', MetricUnits.Count, 1);
    
    logger.info('Analysis processing completed', {
      operation: 'batch_process_success',
      analysisId: validatedMessage.analysisId
    });
    
  } catch (error) {
    // エラーメトリクス
    metrics.addMetric('AnalysisProcessingError', MetricUnits.Count, 1);
    
    logger.error('Analysis processing failed', {
      operation: 'batch_process_error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      messageId: record.messageId
    });
    
    tracer.addErrorAsMetadata(error);
    subsegment?.addError(error);
    
    throw error; // バッチ処理でのリトライのため再スロー
    
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

export const handler: SQSHandler = async (event: SQSEvent, context) => {
  return processPartialResponse(event, recordHandler, processor, {
    context
  });
};
```

## メトリクス・ダッシュボード定義

### `src/shared/powertools/metrics-definitions.ts`

```typescript
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { metrics } from './config';

export class BusinessMetrics {
  
  // テナント関連メトリクス
  public static recordTenantActivity(tenantId: string, activityType: string): void {
    metrics.addDimension('TenantId', tenantId);
    metrics.addDimension('ActivityType', activityType);
    metrics.addMetric('TenantActivity', MetricUnits.Count, 1);
  }
  
  // 分析関連メトリクス
  public static recordAnalysisMetrics(data: {
    tenantId: string;
    analysisType: string;
    duration: number;
    fileSize?: number;
    findingsCount?: number;
    overallScore?: number;
  }): void {
    metrics.addDimension('TenantId', data.tenantId);
    metrics.addDimension('AnalysisType', data.analysisType);
    
    metrics.addMetric('AnalysisCompleted', MetricUnits.Count, 1);
    metrics.addMetric('AnalysisDuration', MetricUnits.Milliseconds, data.duration);
    
    if (data.fileSize) {
      metrics.addMetric('FileSize', MetricUnits.Bytes, data.fileSize);
    }
    
    if (data.findingsCount !== undefined) {
      metrics.addMetric('FindingsCount', MetricUnits.Count, data.findingsCount);
    }
    
    if (data.overallScore !== undefined) {
      metrics.addMetric('OverallScore', MetricUnits.Percent, data.overallScore);
    }
  }
  
  // Bedrockコスト追跡メトリクス
  public static recordBedrockUsage(data: {
    tenantId: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
  }): void {
    metrics.addDimension('TenantId', data.tenantId);
    metrics.addDimension('ModelId', data.modelId);
    
    metrics.addMetric('BedrockInputTokens', MetricUnits.Count, data.inputTokens);
    metrics.addMetric('BedrockOutputTokens', MetricUnits.Count, data.outputTokens);
    metrics.addMetric('BedrockRequests', MetricUnits.Count, data.requestCount);
    
    // コスト計算（概算）
    const inputCost = data.inputTokens * 0.003 / 1000; // $0.003 per 1K input tokens
    const outputCost = data.outputTokens * 0.015 / 1000; // $0.015 per 1K output tokens
    const totalCost = inputCost + outputCost;
    
    metrics.addMetric('BedrockCost', MetricUnits.Count, totalCost);
  }
  
  // ユーザーエクスペリエンス関連メトリクス
  public static recordUserExperience(data: {
    tenantId: string;
    operation: string;
    latency: number;
    success: boolean;
  }): void {
    metrics.addDimension('TenantId', data.tenantId);
    metrics.addDimension('Operation', data.operation);
    
    metrics.addMetric('Latency', MetricUnits.Milliseconds, data.latency);
    metrics.addMetric(data.success ? 'Success' : 'Error', MetricUnits.Count, 1);
  }
}
```

## CDK統合

### `lib/constructs/lambda-with-powertools.ts`

```typescript
import { Construct } from 'constructs';
import { Function, Runtime, Code, Tracing, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Duration } from 'aws-cdk-lib';

export interface PowertoolsLambdaProps {
  functionName: string;
  handler: string;
  timeout?: Duration;
  memorySize?: number;
  environment?: Record<string, string>;
  mainTable?: Table;
  idempotencyTable?: Table;
}

export class PowertoolsLambdaConstruct extends Construct {
  public readonly function: Function;
  
  constructor(scope: Construct, id: string, props: PowertoolsLambdaProps) {
    super(scope, id);
    
    // Powertools Layer（オプション）
    const powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      'PowertoolsLayer',
      'arn:aws:lambda:us-east-1:017000801446:layer:AWSLambdaPowertoolsTypeScript:18'
    );
    
    this.function = new Function(this, 'Function', {
      functionName: props.functionName,
      runtime: Runtime.NODEJS_20_X,
      handler: props.handler,
      code: Code.fromAsset('dist'),
      timeout: props.timeout || Duration.minutes(5),
      memorySize: props.memorySize || 512,
      tracing: Tracing.ACTIVE, // X-Ray有効化
      layers: [powertoolsLayer],
      environment: {
        // Powertools設定
        POWERTOOLS_SERVICE_NAME: 'cloud-best-practice-analyzer',
        POWERTOOLS_LOG_LEVEL: 'INFO',
        POWERTOOLS_LOGGER_SAMPLE_RATE: '0.1',
        POWERTOOLS_LOGGER_LOG_EVENT: 'false',
        POWERTOOLS_METRICS_NAMESPACE: 'CloudBestPracticeAnalyzer',
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
        POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
        
        // テーブル名
        MAIN_TABLE_NAME: props.mainTable?.tableName || '',
        IDEMPOTENCY_TABLE_NAME: props.idempotencyTable?.tableName || '',
        
        // カスタム環境変数
        ...props.environment
      }
    });
    
    // DynamoDB権限
    if (props.mainTable) {
      props.mainTable.grantReadWriteData(this.function);
    }
    
    if (props.idempotencyTable) {
      props.idempotencyTable.grantReadWriteData(this.function);
    }
    
    // パラメータストア読み取り権限
    this.function.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath'
      ],
      resources: [
        `arn:aws:ssm:*:${Stack.of(this).account}:parameter/cloud-best-practice-analyzer/*`
      ]
    }));
    
    // Secrets Manager読み取り権限
    this.function.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue'
      ],
      resources: [
        `arn:aws:secretsmanager:*:${Stack.of(this).account}:secret:/cloud-best-practice-analyzer/*`
      ]
    }));
  }
}
```

## 次のステップ

Powertools統合により以下が実現されます：

### 1. 包括的な観測可能性
- 構造化ログによる効率的なデバッグ
- X-Ray分散トレーシングによるボトルネック特定
- ビジネスメトリクスによるSLA監視

### 2. 運用効率の向上
- 自動化されたログ・メトリクス収集
- アラート基盤の構築
- トラブルシューティングの高速化

### 3. コード品質の向上
- 標準化されたエラーハンドリング
- 入力バリデーションの自動化
- 冪等性保証による信頼性向上

### 4. セキュリティ強化
- 機密情報のマスキング
- 監査ログの自動生成
- アクセスパターンの可視化

次の段階では、この Powertools 統合を含む実際の CDK スタック実装に進みます。