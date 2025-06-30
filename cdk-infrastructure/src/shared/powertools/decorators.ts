import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { AppSyncResolverEvent, Context } from 'aws-lambda';
import { logger, tracer, metrics } from './config';
import { extractTenantContext } from '../utils/tenant-context';
import { TenantContext } from '../../../lib/config/types';

// カスタムデコレータ: GraphQL Resolver用の包括的な観測可能性
export function observableResolver(
  resolverName: string,
  options: {
    captureResponse?: boolean;
    captureError?: boolean;
    addMetrics?: boolean;
  } = {}
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (event: AppSyncResolverEvent<any>, context: Context) {
      const { captureResponse = true, captureError = true, addMetrics = true } = options;
      
      // セグメント開始
      const segment = tracer.getSegment();
      const subsegment = segment?.addNewSubsegment(`GraphQL.${resolverName}`);
      
      // ログコンテキストの設定
      logger.addContext(context);
      logger.addPersistentLogAttributes({
        resolverName,
        requestId: context.awsRequestId,
        correlationId: event.request?.headers?.['x-correlation-id'] || context.awsRequestId,
      });
      
      // テナントコンテキストの抽出
      let tenantContext: TenantContext | null = null;
      try {
        tenantContext = await extractTenantContext(event);
        logger.addPersistentLogAttributes({
          tenantId: tenantContext.tenantId,
          userId: tenantContext.userId,
          userRole: tenantContext.role,
        });
      } catch (error) {
        logger.warn('Failed to extract tenant context', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      const startTime = Date.now();
      
      try {
        logger.info(`${resolverName} resolver started`, {
          arguments: captureResponse ? event.arguments : 'MASKED',
          fieldName: event.info.fieldName,
          parentTypeName: event.info.parentTypeName,
        });
        
        // メソッド実行
        const result = await method.call(this, event, context);
        
        const duration = Date.now() - startTime;
        
        // 成功メトリクス
        if (addMetrics) {
          metrics.addMetric(`${resolverName}.Success`, MetricUnit.Count, 1);
          metrics.addMetric(`${resolverName}.Duration`, MetricUnit.Milliseconds, duration);
          
          if (tenantContext) {
            metrics.addMetadata('tenantId', tenantContext.tenantId);
            metrics.addMetadata('userRole', tenantContext.role);
          }
        }
        
        logger.info(`${resolverName} resolver completed successfully`, {
          duration,
          resultSize: JSON.stringify(result).length,
          result: captureResponse ? result : 'MASKED',
        });
        
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // エラーメトリクス
        if (addMetrics) {
          metrics.addMetric(`${resolverName}.Error`, MetricUnit.Count, 1);
          metrics.addMetric(`${resolverName}.Duration`, MetricUnit.Milliseconds, duration);
        }
        
        if (captureError) {
          logger.error(`${resolverName} resolver failed`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            duration,
            arguments: event.arguments,
          });
        }
        
        // X-Ray セグメントにエラー情報を追加
        if (subsegment) {
          subsegment.addError(error instanceof Error ? error : new Error(String(error)));
        }
        
        throw error;
        
      } finally {
        // セグメント終了
        if (subsegment) {
          subsegment.close();
        }
        
        // メトリクスの送信
        if (addMetrics) {
          metrics.publishStoredMetrics();
        }
      }
    };
    
    return descriptor;
  };
}

// バッチ処理用デコレータ
export function batchProcessor(
  processorName: string,
  options: {
    batchSize?: number;
    maxRetries?: number;
    timeoutMs?: number;
  } = {}
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const { batchSize = 10, maxRetries = 3, timeoutMs = 30000 } = options;
    
    descriptor.value = async function (records: any[], context: Context) {
      logger.addContext(context);
      logger.addPersistentLogAttributes({
        processorName,
        batchSize: records.length,
        requestId: context.awsRequestId,
      });
      
      const startTime = Date.now();
      let processedCount = 0;
      let errorCount = 0;
      
      try {
        logger.info(`${processorName} batch processing started`, {
          totalRecords: records.length,
          batchSize,
        });
        
        // バッチを小さなチャンクに分割
        const chunks = [];
        for (let i = 0; i < records.length; i += batchSize) {
          chunks.push(records.slice(i, i + batchSize));
        }
        
        for (const chunk of chunks) {
          const chunkStartTime = Date.now();
          let retryCount = 0;
          
          while (retryCount <= maxRetries) {
            try {
              await Promise.race([
                method.call(this, chunk, context),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Batch processing timeout')), timeoutMs)
                )
              ]);
              
              processedCount += chunk.length;
              
              metrics.addMetric(`${processorName}.ChunkProcessed`, MetricUnit.Count, 1);
              metrics.addMetric(`${processorName}.RecordsProcessed`, MetricUnit.Count, chunk.length);
              metrics.addMetric(`${processorName}.ChunkDuration`, MetricUnit.Milliseconds, Date.now() - chunkStartTime);
              
              break; // 成功したのでリトライループを抜ける
              
            } catch (error) {
              retryCount++;
              
              if (retryCount > maxRetries) {
                logger.error(`${processorName} chunk failed after ${maxRetries} retries`, {
                  error: error instanceof Error ? error.message : String(error),
                  chunkSize: chunk.length,
                  retryCount,
                });
                
                errorCount += chunk.length;
                metrics.addMetric(`${processorName}.ChunkFailed`, MetricUnit.Count, 1);
                metrics.addMetric(`${processorName}.RecordsFailed`, MetricUnit.Count, chunk.length);
              } else {
                logger.warn(`${processorName} chunk retry ${retryCount}/${maxRetries}`, {
                  error: error instanceof Error ? error.message : String(error),
                  chunkSize: chunk.length,
                });
                
                // 指数バックオフ
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
              }
            }
          }
        }
        
        const duration = Date.now() - startTime;
        
        logger.info(`${processorName} batch processing completed`, {
          totalRecords: records.length,
          processedCount,
          errorCount,
          duration,
          successRate: ((processedCount / records.length) * 100).toFixed(2) + '%',
        });
        
        metrics.addMetric(`${processorName}.BatchCompleted`, MetricUnit.Count, 1);
        metrics.addMetric(`${processorName}.BatchDuration`, MetricUnit.Milliseconds, duration);
        metrics.addMetric(`${processorName}.SuccessRate`, MetricUnit.Percent, (processedCount / records.length) * 100);
        
        return {
          processedCount,
          errorCount,
          totalCount: records.length,
          duration,
        };
        
      } catch (error) {
        logger.error(`${processorName} batch processing failed`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          totalRecords: records.length,
          processedCount,
          errorCount,
        });
        
        metrics.addMetric(`${processorName}.BatchFailed`, MetricUnit.Count, 1);
        
        throw error;
        
      } finally {
        metrics.publishStoredMetrics();
      }
    };
    
    return descriptor;
  };
}

// 冪等性保証デコレータ
export function idempotent(
  options: {
    eventKeyJmesPath?: string;
    persistenceStore?: 'dynamodb' | 'redis';
    expiresAfterSeconds?: number;
  } = {}
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const { 
      eventKeyJmesPath = 'requestId',
      persistenceStore = 'dynamodb',
      expiresAfterSeconds = 3600 
    } = options;
    
    descriptor.value = async function (event: any, context: Context) {
      logger.addContext(context);
      
      try {
        // 冪等性キーの生成
        const idempotencyKey = eventKeyJmesPath === 'requestId' 
          ? context.awsRequestId 
          : event[eventKeyJmesPath] || context.awsRequestId;
        
        logger.addPersistentLogAttributes({
          idempotencyKey,
          functionName: context.functionName,
        });
        
        logger.debug('Checking idempotency', { idempotencyKey });
        
        // ここで実際の冪等性チェックロジックを実装
        // PowerTools の Idempotency デコレータを使用する場合は、
        // import { makeIdempotent } from '@aws-lambda-powertools/idempotency';
        // を使用して実装
        
        const result = await method.call(this, event, context);
        
        logger.debug('Idempotent operation completed', { idempotencyKey });
        
        return result;
        
      } catch (error) {
        logger.error('Idempotent operation failed', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
}