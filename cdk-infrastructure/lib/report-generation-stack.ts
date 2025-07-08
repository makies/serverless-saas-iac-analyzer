import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config/environments';
import * as path from 'path';

export interface ReportGenerationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  sbtEventBusArn: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  analysesTable: dynamodb.Table;
  resourceInventoryTable: dynamodb.Table;
  complianceResultsTable: dynamodb.Table;
}

export class ReportGenerationStack extends cdk.Stack {
  public readonly reportGenerationFunction: lambda.Function;
  public readonly reportsTable: dynamodb.Table;
  public readonly reportsBucket: s3.Bucket;
  public readonly reportsApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ReportGenerationStackProps) {
    super(scope, id, props);

    const { config } = props;

    // S3 Bucket for storing generated reports
    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: `cloudbpa-reports-${config.environment}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ReportRetention',
          enabled: true,
          expiration: cdk.Duration.days(config.environment === 'prod' ? 365 : 90),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
    });

    // DynamoDB Table for report metadata
    this.reportsTable = new dynamodb.Table(this, 'ReportsTable', {
      tableName: `CloudBPA-Reports-${config.environment}`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.environment === 'prod',
      removalPolicy: config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: config.environment !== 'prod' ? 'ttl' : undefined,
    });

    // GSI for status-based queries
    this.reportsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // GSI for user-based queries
    this.reportsTable.addGlobalSecondaryIndex({
      indexName: 'UserReportsIndex',
      partitionKey: { name: 'generatedBy', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // IAM Role for Report Generation
    const reportGenerationRole = new iam.Role(this, 'ReportGenerationRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        ReportGenerationPolicy: new iam.PolicyDocument({
          statements: [
            // DynamoDB access for reading analysis data and storing reports
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
              ],
              resources: [
                this.reportsTable.tableArn,
                props.analysesTable.tableArn,
                props.resourceInventoryTable.tableArn,
                props.complianceResultsTable.tableArn,
                `${this.reportsTable.tableArn}/index/*`,
                `${props.analysesTable.tableArn}/index/*`,
                `${props.resourceInventoryTable.tableArn}/index/*`,
                `${props.complianceResultsTable.tableArn}/index/*`,
              ],
            }),
            // S3 access for storing and retrieving reports
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
              ],
              resources: [
                this.reportsBucket.bucketArn,
                `${this.reportsBucket.bucketArn}/*`,
              ],
            }),
            // EventBridge access for publishing events
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

    // Lambda function for Report Generation
    this.reportGenerationFunction = new nodejs.NodejsFunction(this, 'ReportGenerationFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/report-generation-engine.ts'),
      timeout: cdk.Duration.minutes(15), // Extended timeout for report generation
      memorySize: 3008, // Maximum memory for better performance
      role: reportGenerationRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        ANALYSES_TABLE: props.analysesTable.tableName,
        RESOURCE_INVENTORY_TABLE: props.resourceInventoryTable.tableName,
        COMPLIANCE_RESULTS_TABLE: props.complianceResultsTable.tableName,
        REPORTS_BUCKET: this.reportsBucket.bucketName,
        REPORTS_TABLE: this.reportsTable.tableName,
        EVENT_BUS_NAME: `CloudBPA-SBT-Events-${config.environment}`,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-ReportGeneration-${config.environment}`,
      bundling: {
        externalModules: ['aws-sdk'],
        nodeModules: ['pdfkit', 'exceljs', 'uuid'],
      },
    });

    // EventBridge rule for report generation requests
    const reportGenerationRule = new events.Rule(this, 'ReportGenerationRule', {
      eventPattern: {
        source: ['cloudbpa.reports'],
        detailType: ['Report Generation Requested'],
      },
      description: 'Trigger report generation when requested',
    });

    reportGenerationRule.addTarget(new targets.LambdaFunction(this.reportGenerationFunction, {
      event: events.RuleTargetInput.fromEventPath('$.detail'),
    }));

    // API Gateway for Reports
    this.reportsApi = new apigateway.RestApi(this, 'ReportsAPI', {
      restApiName: `CloudBPA-Reports-API-${config.environment}`,
      description: 'API for report generation and management',
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
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ReportsCognitoAuthorizer', {
      cognitoUserPools: [
        {
          userPoolId: props.cognitoUserPoolId,
          userPoolClientId: props.cognitoUserPoolClientId,
        } as any,
      ],
      authorizerName: 'ReportsCognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      this.reportGenerationFunction,
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
            statusCode: '202',
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
    const reportsResource = this.reportsApi.root.addResource('reports');

    // POST /reports/generate
    const generateResource = reportsResource.addResource('generate');
    generateResource.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '202',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // GET /reports
    reportsResource.addMethod('GET', lambdaIntegration, {
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

    // GET /reports/{reportId}
    const reportResource = reportsResource.addResource('{reportId}');
    reportResource.addMethod('GET', lambdaIntegration, {
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

    // DELETE /reports/{reportId}
    reportResource.addMethod('DELETE', lambdaIntegration, {
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

    // GET /reports/{reportId}/download
    const downloadResource = reportResource.addResource('download');
    downloadResource.addMethod('GET', lambdaIntegration, {
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
    new ssm.StringParameter(this, 'ReportsApiUrlParameter', {
      parameterName: `/cloudbpa/${config.environment}/reports/api-url`,
      stringValue: this.reportsApi.url,
      description: 'Reports API URL',
    });

    new ssm.StringParameter(this, 'ReportsBucketParameter', {
      parameterName: `/cloudbpa/${config.environment}/reports/bucket-name`,
      stringValue: this.reportsBucket.bucketName,
      description: 'Reports S3 bucket name',
    });

    new ssm.StringParameter(this, 'ReportsTableParameter', {
      parameterName: `/cloudbpa/${config.environment}/reports/table-name`,
      stringValue: this.reportsTable.tableName,
      description: 'Reports DynamoDB table name',
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'ReportsApiUrl', {
      value: this.reportsApi.url,
      description: 'Reports API URL',
      exportName: `${id}-ReportsApiUrl`,
    });

    new cdk.CfnOutput(this, 'ReportsBucketName', {
      value: this.reportsBucket.bucketName,
      description: 'Reports S3 Bucket Name',
      exportName: `${id}-ReportsBucketName`,
    });

    new cdk.CfnOutput(this, 'ReportsTableName', {
      value: this.reportsTable.tableName,
      description: 'Reports DynamoDB Table Name',
      exportName: `${id}-ReportsTableName`,
    });

    new cdk.CfnOutput(this, 'ReportGenerationFunctionArn', {
      value: this.reportGenerationFunction.functionArn,
      description: 'Report Generation Lambda Function ARN',
      exportName: `${id}-ReportGenerationFunctionArn`,
    });

    // CloudWatch Dashboard for monitoring
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'ReportsDashboard', {
      dashboardName: `CloudBPA-Reports-${config.environment}`,
    });

    // Add widgets for monitoring
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Report Generation Operations',
        left: [this.reportGenerationFunction.metricInvocations()],
        right: [this.reportGenerationFunction.metricErrors()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Report Generation Duration',
        left: [this.reportGenerationFunction.metricDuration()],
        right: [this.reportGenerationFunction.metricThrottles()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'API Gateway Metrics',
        left: [this.reportsApi.metricCount()],
        right: [this.reportsApi.metricLatency()],
      })
    );

    // Add S3 and DynamoDB metrics
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Reports Bucket Metrics',
        left: [
          this.reportsBucket.metricBucketSizeBytes(),
          this.reportsBucket.metricNumberOfObjects(),
        ],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Reports Table Metrics',
        left: [
          this.reportsTable.metricConsumedReadCapacityUnits(),
          this.reportsTable.metricConsumedWriteCapacityUnits(),
        ],
        right: [
          this.reportsTable.metricUserErrors(),
          this.reportsTable.metricSystemErrors(),
        ],
      })
    );

    // Tags
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'ReportGeneration');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}