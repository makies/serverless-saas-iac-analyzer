import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as resourcegroups from 'aws-cdk-lib/aws-resourcegroups';
import { Construct } from 'constructs';
import { ExtendedStackProps } from '../config/types';
import { AuthStack } from './auth-stack';
import { DataStack } from './data-stack';
import { AppSyncStack } from './appsync-stack';
import { StorageStack } from './storage-stack';
import { MonitoringStack } from './monitoring-stack';
import { StepFunctionsStack } from './step-functions-stack';

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

    // Step Functions ワークフロースタック
    const stepFunctionsStack = new StepFunctionsStack(this, 'StepFunctions', {
      config,
      resolverFunctions: appSyncStack.resolverFunctions,
      description: 'Step Functions workflows for analysis and report generation',
    });

    // Step Functions ARNs を Parameter Store に保存 (循環依存を回避)
    const analysisStateMachineParam = new ssm.StringParameter(this, 'AnalysisStateMachineParam', {
      parameterName: `/cloud-bpa/${config.environment}/step-functions/analysis-arn`,
      stringValue: stepFunctionsStack.analysisStateMachine.stateMachineArn,
      description: 'Analysis State Machine ARN for Lambda functions',
    });

    const reportGenerationStateMachineParam = new ssm.StringParameter(this, 'ReportGenerationStateMachineParam', {
      parameterName: `/cloud-bpa/${config.environment}/step-functions/report-generation-arn`,
      stringValue: stepFunctionsStack.reportGenerationStateMachine.stateMachineArn,
      description: 'Report Generation State Machine ARN for Lambda functions',
    });

    // Parameter Store権限はAppSyncStack内のIAMポリシーで管理 (循環依存回避)

    // モニタリングスタック (循環依存を避けるため完全に独立して作成)
    const monitoringStack = new MonitoringStack(this, 'Monitoring', {
      config,
      appSyncApi: null, // 循環依存を避けるためnullに設定
      lambdaFunctions: {}, // 循環依存を避けるため空のオブジェクトに設定
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

    // Step Functions outputs
    new cdk.CfnOutput(this, 'AnalysisStateMachineArn', {
      value: stepFunctionsStack.analysisStateMachine.stateMachineArn,
      description: 'Analysis State Machine ARN',
      exportName: `${id}-AnalysisStateMachineArn`,
    });

    new cdk.CfnOutput(this, 'ReportGenerationStateMachineArn', {
      value: stepFunctionsStack.reportGenerationStateMachine.stateMachineArn,
      description: 'Report Generation State Machine ARN',
      exportName: `${id}-ReportGenerationStateMachineArn`,
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

    // Resource Groups for better organization and cost tracking
    this.createResourceGroups(config);

    // Tags for all resources
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'Backend');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }

  /**
   * Creates resource groups for better organization and cost tracking
   */
  private createResourceGroups(config: any) {
    // Environment-based Resource Group
    new resourcegroups.CfnGroup(this, 'EnvironmentResourceGroup', {
      name: `CloudBPA-${config.environment}`,
      description: `All resources for ${config.environment} environment`,
      resourceQuery: {
        type: 'TAG_FILTERS_1_0',
        query: {
          resourceTypeFilters: ['AWS::AllSupported'],
          tagFilters: [
            {
              key: 'Project',
              values: ['CloudBestPracticeAnalyzer'],
            },
            {
              key: 'Environment',
              values: [config.environment],
            },
          ],
        },
      },
      tags: [
        { key: 'Name', value: `CloudBPA-${config.environment}` },
        { key: 'Project', value: 'CloudBestPracticeAnalyzer' },
        { key: 'Environment', value: config.environment },
        { key: 'ManagedBy', value: 'CDK' },
        { key: 'ResourceGroupType', value: 'Environment' },
      ],
    });

    // Service-based Resource Groups
    this.createServiceResourceGroups(config);
  }

  /**
   * Creates service-specific resource groups
   */
  private createServiceResourceGroups(config: any) {
    const services = [
      { name: 'Authentication', tag: 'Auth', description: 'Cognito User Pools Identity Pools and IAM roles' },
      { name: 'Database', tag: 'Database', description: 'DynamoDB tables and related resources' },
      { name: 'Storage', tag: 'Storage', description: 'S3 buckets and storage resources' },
      { name: 'GraphQL', tag: 'GraphQL', description: 'AppSync API Lambda resolvers and data sources' },
      { name: 'Analytics', tag: 'Analytics', description: 'Step Functions workflows and analysis engines' },
      { name: 'Monitoring', tag: 'Monitoring', description: 'CloudWatch metrics alarms and monitoring resources' },
    ];

    services.forEach(service => {
      new resourcegroups.CfnGroup(this, `${service.name}ResourceGroup`, {
        name: `CloudBPA-${config.environment}-${service.name}`,
        description: `Resources for ${config.environment} environment`,
        resourceQuery: {
          type: 'TAG_FILTERS_1_0',
          query: {
            resourceTypeFilters: ['AWS::AllSupported'],
            tagFilters: [
              {
                key: 'Project',
                values: ['CloudBestPracticeAnalyzer'],
              },
              {
                key: 'Environment',
                values: [config.environment],
              },
              {
                key: 'Service',
                values: [service.tag, service.name],
              },
            ],
          },
        },
        tags: [
          { key: 'Name', value: `CloudBPA-${config.environment}-${service.name}` },
          { key: 'Project', value: 'CloudBestPracticeAnalyzer' },
          { key: 'Environment', value: config.environment },
          { key: 'Service', value: service.name },
          { key: 'ManagedBy', value: 'CDK' },
          { key: 'ResourceGroupType', value: 'Service' },
        ],
      });
    });

    // Cost Tracking Resource Group (for billing analysis)
    new resourcegroups.CfnGroup(this, 'CostTrackingResourceGroup', {
      name: `CloudBPA-${config.environment}-CostTracking`,
      description: `Cost tracking and billing analysis for ${config.environment}`,
      resourceQuery: {
        type: 'TAG_FILTERS_1_0',
        query: {
          resourceTypeFilters: ['AWS::AllSupported'],
          tagFilters: [
            {
              key: 'Project',
              values: ['CloudBestPracticeAnalyzer'],
            },
            {
              key: 'Environment',
              values: [config.environment],
            },
          ],
        },
      },
      tags: [
        { key: 'Name', value: `CloudBPA-${config.environment}-CostTracking` },
        { key: 'Project', value: 'CloudBestPracticeAnalyzer' },
        { key: 'Environment', value: config.environment },
        { key: 'ManagedBy', value: 'CDK' },
        { key: 'ResourceGroupType', value: 'CostTracking' },
        { key: 'Purpose', value: 'Billing' },
      ],
    });
  }
}
