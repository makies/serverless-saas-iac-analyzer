import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { storage } from './storage/resource.js';

/**
 * Cloud Best Practice Analyzer Backend
 *
 * Amplify Gen 2 backend definition with:
 * - Multi-tenant authentication (Cognito)
 * - GraphQL API with DynamoDB (AppSync + DataStore)
 * - File storage with tenant isolation (S3)
 *
 * @see https://docs.amplify.aws/react/build-a-backend/
 */
export const backend = defineBackend({
  // Authentication with Cognito User Pools + Identity Pools
  auth,

  // GraphQL API with DynamoDB tables
  data,

  // S3 storage with tenant isolation
  storage,
});

// Configure additional access for user groups to storage
// This will be handled in a post-deployment step to avoid circular dependencies

// Add custom outputs for CDK integration
backend.addOutput({
  custom: {
    // SBT integration flags
    sbtIntegrationEnabled: 'true',
    architecture: 'amplify-gen2-cdk-hybrid',

    // Resource identifiers for CDK
    userPoolId: backend.auth.resources.userPool.userPoolId,
    identityPoolId: backend.auth.resources.identityPoolId,
    graphqlApiId: backend.data.resources.graphqlApi.apiId,

    // Storage configuration
    storageBucketName: backend.storage.resources.bucket.bucketName,

    // Environment configuration
    environment: process.env.NODE_ENV || 'dev',
    region: process.env.AWS_REGION || 'ap-northeast-1',
  },
});

export type Backend = typeof backend;
  