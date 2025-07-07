/**
 * Parameter Store Utility
 * Provides cached access to AWS Systems Manager Parameter Store values
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'ParameterStoreUtil' });
const ssmClient = new SSMClient({});

// Cache to avoid repeated Parameter Store calls
const parameterCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get a parameter value from Parameter Store with caching
 * @param parameterName The name of the parameter to retrieve
 * @param useCache Whether to use caching (default: true)
 * @returns The parameter value
 */
export async function getParameter(parameterName: string, useCache: boolean = true): Promise<string> {
  const now = Date.now();
  
  // Check cache first if enabled
  if (useCache) {
    const cached = parameterCache.get(parameterName);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      logger.debug('Parameter retrieved from cache', { parameterName });
      return cached.value;
    }
  }

  try {
    logger.debug('Retrieving parameter from Parameter Store', { parameterName });
    
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true, // Support encrypted parameters
    });

    const response = await ssmClient.send(command);
    const value = response.Parameter?.Value;

    if (!value) {
      throw new Error(`Parameter '${parameterName}' not found or has no value`);
    }

    // Cache the result if caching is enabled
    if (useCache) {
      parameterCache.set(parameterName, { value, timestamp: now });
    }

    logger.debug('Parameter retrieved successfully', { parameterName });
    return value;
  } catch (error) {
    logger.error('Failed to retrieve parameter', {
      parameterName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to retrieve parameter '${parameterName}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get Step Functions ARNs using standardized parameter names
 * @param environment The environment (dev, staging, prod)
 * @returns Object containing both Step Functions ARNs
 */
export async function getStepFunctionsArns(environment: string): Promise<{
  analysisStateMachineArn: string;
  reportGenerationStateMachineArn: string;
}> {
  const [analysisArn, reportArn] = await Promise.all([
    getParameter(`/cloud-bpa/${environment}/step-functions/analysis-arn`),
    getParameter(`/cloud-bpa/${environment}/step-functions/report-generation-arn`),
  ]);

  return {
    analysisStateMachineArn: analysisArn,
    reportGenerationStateMachineArn: reportArn,
  };
}

/**
 * Clear the parameter cache (useful for testing or long-running functions)
 */
export function clearParameterCache(): void {
  parameterCache.clear();
  logger.debug('Parameter cache cleared');
}