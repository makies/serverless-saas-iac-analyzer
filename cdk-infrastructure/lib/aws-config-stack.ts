import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config/environments';
import * as path from 'path';

export interface AwsConfigStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  sbtEventBusArn: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
}

export class AwsConfigStack extends cdk.Stack {
  public readonly configIntegrationFunction: lambda.Function;
  public readonly autoDiscoveryFunction: lambda.Function;
  public readonly resourceInventoryTable: dynamodb.Table;
  public readonly complianceResultsTable: dynamodb.Table;
  public readonly discoverySessionsTable: dynamodb.Table;
  public readonly configApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: AwsConfigStackProps) {
    super(scope, id, props);

    const { config } = props;

    // DynamoDB Tables
    this.resourceInventoryTable = new dynamodb.Table(this, 'ResourceInventoryTable', {
      tableName: `CloudBPA-ResourceInventory-${config.environment}`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.environment === 'prod',
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: config.environment !== 'prod' ? 'ttl' : undefined,
    });

    // GSI for tenant-based queries
    this.resourceInventoryTable.addGlobalSecondaryIndex({
      indexName: 'TenantResourceIndex',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
    });

    // GSI for resource type queries
    this.resourceInventoryTable.addGlobalSecondaryIndex({
      indexName: 'ResourceTypeIndex',
      partitionKey: { name: 'resourceType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'lastUpdated', type: dynamodb.AttributeType.STRING },
    });

    this.complianceResultsTable = new dynamodb.Table(this, 'ComplianceResultsTable', {
      tableName: `CloudBPA-ComplianceResults-${config.environment}`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.environment === 'prod',
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: config.environment !== 'prod' ? 'ttl' : undefined,
    });

    // GSI for evaluation queries
    this.complianceResultsTable.addGlobalSecondaryIndex({
      indexName: 'EvaluationIndex',
      partitionKey: { name: 'evaluationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'evaluationTime', type: dynamodb.AttributeType.STRING },
    });

    this.discoverySessionsTable = new dynamodb.Table(this, 'DiscoverySessionsTable', {
      tableName: `CloudBPA-DiscoverySessions-${config.environment}`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.environment === 'prod',
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: config.environment !== 'prod' ? 'ttl' : undefined,
    });

    // GSI for session status queries
    this.discoverySessionsTable.addGlobalSecondaryIndex({
      indexName: 'SessionStatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
    });

    // IAM Role for Config Integration
    const configIntegrationRole = new iam.Role(this, 'ConfigIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        ConfigIntegrationPolicy: new iam.PolicyDocument({
          statements: [
            // AWS Config permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'config:DescribeConfigurationRecorders',
                'config:DescribeConfigRules',
                'config:GetComplianceDetailsByConfigRule',
                'config:GetResourceConfigHistory',
                'config:ListDiscoveredResources',
                'config:BatchGetResourceConfig',
                'config:DescribeComplianceByConfigRule',
                'config:GetDiscoveredResourceCounts',
                'config:PutConfigRule',
                'config:DeleteConfigRule',
                'config:StartConfigurationRecorder',
                'config:StopConfigurationRecorder',
              ],
              resources: ['*'],
            }),
            // DynamoDB access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
              ],
              resources: [
                this.resourceInventoryTable.tableArn,
                this.complianceResultsTable.tableArn,
                this.discoverySessionsTable.tableArn,
                `${this.resourceInventoryTable.tableArn}/index/*`,
                `${this.complianceResultsTable.tableArn}/index/*`,
                `${this.discoverySessionsTable.tableArn}/index/*`,
              ],
            }),
            // STS AssumeRole for cross-account access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sts:AssumeRole'],
              resources: ['arn:aws:iam::*:role/CloudBPA-*'],
            }),
            // EventBridge access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['events:PutEvents'],
              resources: [
                props.sbtEventBusArn,
                `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
              ],
            }),
          ],
        }),
      },
    });

    // Lambda function for Config Integration
    this.configIntegrationFunction = new nodejs.NodejsFunction(this, 'ConfigIntegrationFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/aws-config-integration.ts'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      role: configIntegrationRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        RESOURCE_INVENTORY_TABLE: this.resourceInventoryTable.tableName,
        COMPLIANCE_RESULTS_TABLE: this.complianceResultsTable.tableName,
        CONFIG_RULES_TABLE: `CloudBPA-ConfigRules-${config.environment}`,
        EVENT_BUS_NAME: `CloudBPA-SBT-Events-${config.environment}`,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-ConfigIntegration-${config.environment}`,
      bundling: {
        externalModules: ['aws-sdk'],
        nodeModules: ['uuid'],
      },
    });

    // IAM Role for Auto Discovery
    const autoDiscoveryRole = new iam.Role(this, 'AutoDiscoveryRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        AutoDiscoveryPolicy: new iam.PolicyDocument({
          statements: [
            // Comprehensive AWS service read permissions
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                // EC2
                'ec2:DescribeInstances',
                'ec2:DescribeVpcs',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeSubnets',
                'ec2:DescribeVolumes',
                'ec2:DescribeSnapshots',
                'ec2:DescribeImages',
                'ec2:DescribeNetworkAcls',
                'ec2:DescribeRouteTables',
                'ec2:DescribeInternetGateways',
                'ec2:DescribeNatGateways',
                'ec2:DescribeVpcEndpoints',
                // S3
                's3:ListAllMyBuckets',
                's3:GetBucketLocation',
                's3:GetBucketTagging',
                's3:GetBucketPolicy',
                's3:GetBucketEncryption',
                's3:GetBucketVersioning',
                's3:GetBucketLogging',
                // RDS
                'rds:DescribeDBInstances',
                'rds:DescribeDBClusters',
                'rds:DescribeDBSubnetGroups',
                'rds:DescribeDBParameterGroups',
                'rds:DescribeDBClusterParameterGroups',
                'rds:DescribeDBSecurityGroups',
                // Lambda
                'lambda:ListFunctions',
                'lambda:GetFunction',
                'lambda:ListTags',
                'lambda:GetPolicy',
                // IAM
                'iam:ListRoles',
                'iam:ListPolicies',
                'iam:ListUsers',
                'iam:ListGroups',
                'iam:GetRole',
                'iam:GetPolicy',
                'iam:GetUser',
                'iam:GetGroup',
                'iam:ListAttachedRolePolicies',
                'iam:ListAttachedUserPolicies',
                'iam:ListAttachedGroupPolicies',
                // CloudFormation
                'cloudformation:ListStacks',
                'cloudformation:DescribeStacks',
                'cloudformation:DescribeStackResources',
                'cloudformation:ListStackResources',
                // Resource Groups
                'resource-groups:GetResources',
                'tag:GetResources',
                'tag:GetTagKeys',
                'tag:GetTagValues',
                // CloudWatch
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                // Cost Explorer (for cost optimization)
                'ce:GetRightsizingRecommendation',
                'ce:GetCostAndUsage',
                'ce:GetReservationCoverage',
                'ce:GetReservationPurchaseRecommendation',
                // Config
                'config:GetResourceConfigHistory',
                'config:ListDiscoveredResources',
                'config:BatchGetResourceConfig',
              ],
              resources: ['*'],
            }),
            // DynamoDB access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
              ],
              resources: [
                this.resourceInventoryTable.tableArn,
                this.discoverySessionsTable.tableArn,
                `${this.resourceInventoryTable.tableArn}/index/*`,
                `${this.discoverySessionsTable.tableArn}/index/*`,
              ],
            }),
            // STS AssumeRole for cross-account access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sts:AssumeRole', 'sts:GetCallerIdentity'],
              resources: ['arn:aws:iam::*:role/CloudBPA-*'],
            }),
            // EventBridge access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['events:PutEvents'],
              resources: [
                props.sbtEventBusArn,
                `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
              ],
            }),
          ],
        }),
      },
    });

    // Lambda function for Auto Discovery Engine
    this.autoDiscoveryFunction = new nodejs.NodejsFunction(this, 'AutoDiscoveryFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'scheduledDiscoveryHandler',
      entry: path.join(__dirname, '../src/functions/resource-auto-discovery-engine.ts'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 3008, // Maximum memory for better performance
      role: autoDiscoveryRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        RESOURCE_INVENTORY_TABLE: this.resourceInventoryTable.tableName,
        DISCOVERY_SESSIONS_TABLE: this.discoverySessionsTable.tableName,
        EVENT_BUS_NAME: `CloudBPA-SBT-Events-${config.environment}`,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-AutoDiscovery-${config.environment}`,
      bundling: {
        externalModules: ['aws-sdk'],
        nodeModules: ['uuid'],
      },
    });

    // Manual Discovery Function (different handler)
    const manualDiscoveryFunction = new nodejs.NodejsFunction(this, 'ManualDiscoveryFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'manualDiscoveryHandler',
      entry: path.join(__dirname, '../src/functions/resource-auto-discovery-engine.ts'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 3008,
      role: autoDiscoveryRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        RESOURCE_INVENTORY_TABLE: this.resourceInventoryTable.tableName,
        DISCOVERY_SESSIONS_TABLE: this.discoverySessionsTable.tableName,
        EVENT_BUS_NAME: `CloudBPA-SBT-Events-${config.environment}`,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-ManualDiscovery-${config.environment}`,
      bundling: {
        externalModules: ['aws-sdk'],
        nodeModules: ['uuid'],
      },
    });

    // EventBridge Rules for scheduled discovery
    const scheduledDiscoveryRule = new events.Rule(this, 'ScheduledDiscoveryRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '1', // 1 AM UTC daily
        day: '*',
        month: '*',
        year: '*',
      }),
      description: 'Trigger automated resource discovery daily',
    });

    scheduledDiscoveryRule.addTarget(new targets.LambdaFunction(this.autoDiscoveryFunction));

    // EventBridge rule for manual discovery requests
    const manualDiscoveryRule = new events.Rule(this, 'ManualDiscoveryRule', {
      eventPattern: {
        source: ['cloudbpa.discovery'],
        detailType: ['Manual Discovery Requested'],
      },
      description: 'Trigger manual resource discovery on request',
    });

    manualDiscoveryRule.addTarget(new targets.LambdaFunction(manualDiscoveryFunction, {
      event: events.RuleTargetInput.fromEventPath('$.detail'),
    }));

    // API Gateway for Config Integration
    this.configApi = new apigateway.RestApi(this, 'ConfigAPI', {
      restApiName: `CloudBPA-Config-API-${config.environment}`,
      description: 'API for AWS Config integration and resource discovery',
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: config.cognitoConfig.allowedOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Requested-With',
        ],
        maxAge: cdk.Duration.seconds(600),
      },
    });

    // Cognito Authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ConfigCognitoAuthorizer', {
      cognitoUserPools: [
        {
          userPoolId: props.cognitoUserPoolId,
          userPoolClientId: props.cognitoUserPoolClientId,
        } as any,
      ],
      authorizerName: 'ConfigCognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      this.configIntegrationFunction,
      {
        requestTemplates: {
          'application/json': JSON.stringify({
            httpMethod: '$context.httpMethod',
            resourcePath: '$context.resourcePath',
            pathParameters: '$input.params().path',
            queryStringParameters: '$input.params().querystring',
            body: '$input.json("$")',
            requestContext: {
              accountId: '$context.accountId',
              requestId: '$context.requestId',
              identity: {
                cognitoIdentityId: '$context.identity.cognitoIdentityId',
                cognitoAuthenticationType: '$context.identity.cognitoAuthenticationType',
                claims: '$context.authorizer.claims',
              },
            },
          }),
        },
        proxy: false,
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '403',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
          {
            statusCode: '500',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            },
          },
        ],
      }
    );

    // API Resources and Methods
    const configResource = this.configApi.root.addResource('config');

    // /config/discovery
    const discoveryResource = configResource.addResource('discovery');
    discoveryResource.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /config/resources
    const resourcesResource = configResource.addResource('resources');
    resourcesResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /config/resources/{resourceId}
    const resourceResource = resourcesResource.addResource('{resourceId}');
    resourceResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /config/compliance
    const complianceResource = configResource.addResource('compliance');
    complianceResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /config/compliance/evaluate
    const evaluateResource = complianceResource.addResource('evaluate');
    evaluateResource.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /config/rules
    const rulesResource = configResource.addResource('rules');
    rulesResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
    rulesResource.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '201',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /config/rules/{ruleName}
    const ruleResource = rulesResource.addResource('{ruleName}');
    ruleResource.addMethod('DELETE', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // /config/statistics
    const statisticsResource = configResource.addResource('statistics');
    statisticsResource.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // SSM Parameters for configuration
    new ssm.StringParameter(this, 'ConfigApiUrlParameter', {
      parameterName: `/cloudbpa/${config.environment}/config/api-url`,
      stringValue: this.configApi.url,
      description: 'Config integration API URL',
    });

    new ssm.StringParameter(this, 'ResourceInventoryTableParameter', {
      parameterName: `/cloudbpa/${config.environment}/config/resource-inventory-table`,
      stringValue: this.resourceInventoryTable.tableName,
      description: 'Resource inventory DynamoDB table name',
    });

    new ssm.StringParameter(this, 'DiscoverySessionsTableParameter', {
      parameterName: `/cloudbpa/${config.environment}/config/discovery-sessions-table`,
      stringValue: this.discoverySessionsTable.tableName,
      description: 'Discovery sessions DynamoDB table name',
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'ConfigApiUrl', {
      value: this.configApi.url,
      description: 'Config Integration API URL',
      exportName: `${id}-ConfigApiUrl`,
    });

    new cdk.CfnOutput(this, 'ResourceInventoryTableName', {
      value: this.resourceInventoryTable.tableName,
      description: 'Resource Inventory DynamoDB Table Name',
      exportName: `${id}-ResourceInventoryTableName`,
    });

    new cdk.CfnOutput(this, 'ConfigIntegrationFunctionArn', {
      value: this.configIntegrationFunction.functionArn,
      description: 'Config Integration Lambda Function ARN',
      exportName: `${id}-ConfigIntegrationFunctionArn`,
    });

    new cdk.CfnOutput(this, 'AutoDiscoveryFunctionArn', {
      value: this.autoDiscoveryFunction.functionArn,
      description: 'Auto Discovery Lambda Function ARN',
      exportName: `${id}-AutoDiscoveryFunctionArn`,
    });

    // CloudWatch Dashboard for monitoring
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'ConfigDashboard', {
      dashboardName: `CloudBPA-Config-${config.environment}`,
    });

    // Add widgets for monitoring
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Config Integration Operations',
        left: [this.configIntegrationFunction.metricInvocations()],
        right: [this.configIntegrationFunction.metricErrors()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Auto Discovery Operations',
        left: [this.autoDiscoveryFunction.metricInvocations()],
        right: [this.autoDiscoveryFunction.metricErrors()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'API Gateway Metrics',
        left: [this.configApi.metricCount()],
        right: [this.configApi.metricLatency()],
      })
    );

    // Add DynamoDB metrics
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Resource Inventory Table Metrics',
        left: [
          this.resourceInventoryTable.metricConsumedReadCapacityUnits(),
          this.resourceInventoryTable.metricConsumedWriteCapacityUnits(),
        ],
        right: [
          this.resourceInventoryTable.metricUserErrors(),
          this.resourceInventoryTable.metricSystemErrors(),
        ],
      })
    );

    // Tags
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'ConfigIntegration');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}