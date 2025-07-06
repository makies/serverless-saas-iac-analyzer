import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { SSMClient } from '@aws-sdk/client-ssm';
import { captureAWSv3Client } from 'aws-xray-sdk-core';

// AWS SDK Client Configuration with X-Ray Tracing
const region = process.env.AWS_REGION || 'ap-northeast-1';

// DynamoDB Client with X-Ray tracing
const dynamoDBClient = captureAWSv3Client(
  new DynamoDBClient({
    region,
    maxAttempts: 3,
  })
);

// DynamoDB Document Client with X-Ray tracing
export const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// S3 Client with X-Ray tracing
export const s3Client = captureAWSv3Client(
  new S3Client({
    region,
    maxAttempts: 3,
    requestHandler: {
      requestTimeout: 30000,
      connectionTimeout: 5000,
    },
  })
);

// Bedrock Runtime Client with X-Ray tracing
export const bedrockRuntimeClient = captureAWSv3Client(
  new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION || region,
    maxAttempts: 3,
    requestHandler: {
      requestTimeout: 300000, // 5 minutes for AI inference
      connectionTimeout: 10000,
    },
  })
);

// SSM Client with X-Ray tracing
export const ssmClient = captureAWSv3Client(
  new SSMClient({
    region,
    maxAttempts: 3,
  })
);

// Export instrumented clients
export {
  dynamoDBClient,
  region,
};

// Helper function to create custom instrumented client
export function createInstrumentedClient<T>(client: T): T {
  return captureAWSv3Client(client as any) as T;
}