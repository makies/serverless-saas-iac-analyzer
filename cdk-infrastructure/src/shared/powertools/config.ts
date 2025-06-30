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
  captureHTTPsRequests: true
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
  return await getParameter(name, { decrypt: true }) as string;
};

export const getParameterWithCache = async (name: string, maxAge: number = 300): Promise<string> => {
  return await getParameter(name, { maxAge }) as string;
};