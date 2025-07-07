import { v4 as uuidv4 } from 'uuid';
import { AppSyncResolverEvent, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';

/**
 * 相関ID管理ユーティリティ
 * ブラウザからバックエンドまでのリクエストトレースを可能にする
 */

export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  requestId: string;
  timestamp: string;
  sourceService: string;
}

/**
 * AppSyncイベントから相関IDを抽出または生成
 */
export function extractOrGenerateCorrelationId(
  event: AppSyncResolverEvent<any>,
  context: Context
): CorrelationContext {
  // ヘッダーから相関IDを抽出
  const correlationId = 
    event.request?.headers?.['x-correlation-id'] ||
    event.request?.headers?.['X-Correlation-Id'] ||
    event.request?.headers?.['correlationId'] ||
    context.awsRequestId ||
    uuidv4();

  // X-Rayトレース情報を抽出
  const traceHeader = process.env._X_AMZN_TRACE_ID;
  let traceId: string | undefined;
  let spanId: string | undefined;
  let parentSpanId: string | undefined;

  if (traceHeader) {
    const traceHeaderParts = traceHeader.split(';');
    for (const part of traceHeaderParts) {
      if (part.startsWith('Root=')) {
        traceId = part.replace('Root=', '');
      } else if (part.startsWith('Parent=')) {
        parentSpanId = part.replace('Parent=', '');
      } else if (part.startsWith('Sampled=')) {
        // サンプリング情報は無視
      }
    }
  }

  return {
    correlationId,
    traceId,
    spanId: context.awsRequestId,
    parentSpanId,
    requestId: context.awsRequestId,
    timestamp: new Date().toISOString(),
    sourceService: 'AppSync',
  };
}

/**
 * 相関IDをログとX-Rayに設定
 */
export function setCorrelationContext(
  correlationContext: CorrelationContext,
  logger: Logger,
  tracer: Tracer
) {
  // ログに相関情報を追加
  logger.addPersistentLogAttributes({
    correlationId: correlationContext.correlationId,
    traceId: correlationContext.traceId,
    requestId: correlationContext.requestId,
    sourceService: correlationContext.sourceService,
  });

  // X-Rayセグメントに相関情報を追加
  const segment = tracer.getSegment();
  if (segment) {
    segment.addAnnotation('correlationId', correlationContext.correlationId);
    segment.addAnnotation('sourceService', correlationContext.sourceService);
    
    if (correlationContext.traceId) {
      segment.addAnnotation('parentTraceId', correlationContext.traceId);
    }

    // メタデータとして詳細情報を追加
    segment.addMetadata('correlation', {
      correlationId: correlationContext.correlationId,
      requestFlow: {
        timestamp: correlationContext.timestamp,
        service: correlationContext.sourceService,
        requestId: correlationContext.requestId,
      },
    });
  }
}

/**
 * 下流サービス呼び出し用の相関IDヘッダーを生成
 */
export function createCorrelationHeaders(correlationContext: CorrelationContext): Record<string, string> {
  return {
    'X-Correlation-Id': correlationContext.correlationId,
    'X-Trace-Id': correlationContext.traceId || '',
    'X-Request-Id': correlationContext.requestId,
    'X-Source-Service': correlationContext.sourceService,
    'X-Timestamp': correlationContext.timestamp,
  };
}

/**
 * 相関IDをAWS SDKクライアントのカスタムヘッダーに追加
 */
export function addCorrelationToAWSClients(correlationContext: CorrelationContext) {
  // AWS SDK v3のカスタムヘッダー設定
  const customHeaders = createCorrelationHeaders(correlationContext);
  
  // 環境変数として設定（AWS SDKクライアントで利用可能）
  process.env.CORRELATION_ID = correlationContext.correlationId;
  process.env.TRACE_ID = correlationContext.traceId || '';
  process.env.REQUEST_ID = correlationContext.requestId;
  
  return customHeaders;
}

/**
 * 相関IDコンテキストをCloudWatch Logsの構造化ログに出力
 */
export function logCorrelationContext(
  correlationContext: CorrelationContext,
  logger: Logger,
  operation: string,
  additionalContext?: Record<string, any>
) {
  logger.info(`Operation: ${operation}`, {
    correlation: {
      correlationId: correlationContext.correlationId,
      traceId: correlationContext.traceId,
      requestId: correlationContext.requestId,
      sourceService: correlationContext.sourceService,
      timestamp: correlationContext.timestamp,
    },
    operation,
    ...additionalContext,
  });
}

/**
 * 相関IDベースのカスタムメトリクス
 */
export function emitCorrelationMetrics(
  correlationContext: CorrelationContext,
  metrics: any,
  metricName: string,
  value: number = 1,
  unit: string = 'Count'
) {
  metrics.addMetric(metricName, unit, value);
  metrics.addMetadata('correlationId', correlationContext.correlationId);
  metrics.addMetadata('traceId', correlationContext.traceId || 'none');
  metrics.addMetadata('sourceService', correlationContext.sourceService);
}

/**
 * エラー発生時の相関コンテキスト情報付きログ
 */
export function logCorrelationError(
  correlationContext: CorrelationContext,
  logger: Logger,
  error: Error,
  operation: string,
  additionalContext?: Record<string, any>
) {
  logger.error(`Error in operation: ${operation}`, {
    correlation: {
      correlationId: correlationContext.correlationId,
      traceId: correlationContext.traceId,
      requestId: correlationContext.requestId,
      sourceService: correlationContext.sourceService,
    },
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
    },
    operation,
    ...additionalContext,
  });
}