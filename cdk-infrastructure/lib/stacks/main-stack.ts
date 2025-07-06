import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ExtendedStackProps } from '../config/types';
import { AuthStack } from './auth-stack';
import { DataStack } from './data-stack';
import { AppSyncStack } from './appsync-stack';
import { StorageStack } from './storage-stack';
import { MonitoringStack } from './monitoring-stack';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    const { config } = props;

    // 認証スタック (Cognito User Pools + Identity Pools)
    const authStack = new AuthStack(this, 'Auth', {
      config,
      description: 'Authentication and authorization infrastructure',
    });

    // データスタック (DynamoDB テーブル)
    const dataStack = new DataStack(this, 'Data', {
      config,
      description: 'DynamoDB tables and data infrastructure',
    });

    // ストレージスタック (S3バケット)
    const storageStack = new StorageStack(this, 'Storage', {
      config,
      description: 'S3 buckets and storage infrastructure',
    });

    // AppSync GraphQL API スタック
    const appSyncStack = new AppSyncStack(this, 'AppSync', {
      config,
      userPool: authStack.userPool,
      userPoolClient: authStack.userPoolClient,
      identityPool: authStack.identityPool,
      tables: dataStack.tables,
      buckets: storageStack.buckets,
      description: 'AppSync GraphQL API and Lambda resolvers',
    });

    // モニタリングスタック (CloudWatch, X-Ray)
    const monitoringStack = new MonitoringStack(this, 'Monitoring', {
      config,
      appSyncApi: appSyncStack.api,
      lambdaFunctions: appSyncStack.resolverFunctions,
      description: 'Monitoring, logging, and alerting infrastructure',
    });

    // Dependencies are handled automatically by CDK construct references

    // Stack outputs
    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });

    new cdk.CfnOutput(this, 'Environment', {
      value: config.environment,
      description: 'Environment name',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: authStack.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${id}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: authStack.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${id}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: authStack.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${id}-IdentityPoolId`,
    });

    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: appSyncStack.api.apiId,
      description: 'AppSync GraphQL API ID',
      exportName: `${id}-GraphQLApiId`,
    });

    new cdk.CfnOutput(this, 'GraphQLApiUrl', {
      value: appSyncStack.api.graphqlUrl,
      description: 'AppSync GraphQL API URL',
      exportName: `${id}-GraphQLApiUrl`,
    });

    new cdk.CfnOutput(this, 'GraphQLApiKey', {
      value: appSyncStack.api.apiKey || 'N/A',
      description: 'AppSync GraphQL API Key (if enabled)',
      exportName: `${id}-GraphQLApiKey`,
    });

    // S3 Bucket outputs
    Object.entries(storageStack.buckets).forEach(([name, bucket]) => {
      new cdk.CfnOutput(this, `${name}Bucket`, {
        value: bucket.bucketName,
        description: `${name} S3 Bucket name`,
        exportName: `${id}-${name}BucketName`,
      });
    });

    // DynamoDB Table outputs
    Object.entries(dataStack.tables).forEach(([name, table]) => {
      new cdk.CfnOutput(this, `${name}Table`, {
        value: table.tableName,
        description: `${name} DynamoDB table name`,
        exportName: `${id}-${name}TableName`,
      });

      new cdk.CfnOutput(this, `${name}TableArnOutput`, {
        value: table.tableArn,
        description: `${name} DynamoDB table ARN`,
        exportName: `${id}-${name}TableArn`,
      });
    });

    // Lambda Function outputs (for debugging)
    if (config.environment === 'dev') {
      Object.entries(appSyncStack.resolverFunctions).forEach(([name, func]) => {
        new cdk.CfnOutput(this, `${name}FunctionName`, {
          value: func.functionName,
          description: `${name} Lambda function name`,
        });
      });
    }

    // Tags for all resources
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'Backend');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
