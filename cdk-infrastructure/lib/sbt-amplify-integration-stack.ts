import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config/environments';
import * as path from 'path';

export interface SBTAmplifyIntegrationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  amplifyAppId?: string;
  amplifyApiId?: string;
  userPoolId?: string;
}

export class SBTAmplifyIntegrationStack extends cdk.Stack {
  public readonly tenantManagementFunction: lambda.Function;
  public readonly sbtEventBridge: events.EventBus;

  constructor(scope: Construct, id: string, props: SBTAmplifyIntegrationStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Custom EventBridge bus for SBT <-> Amplify integration
    this.sbtEventBridge = new events.EventBus(this, 'SBTEventBus', {
      eventBusName: `CloudBPA-SBT-Events-${config.environment}`,
    });

    // DynamoDB table for SBT Control Plane data
    const sbtTenantsTable = new dynamodb.Table(this, 'SBTTenantsTable', {
      tableName: `SBT-Tenants-${config.environment}`,
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Global Secondary Index for tenant status queries
    sbtTenantsTable.addGlobalSecondaryIndex({
      indexName: 'ByStatus',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // IAM Role for SBT integration functions
    const sbtIntegrationRole = new iam.Role(this, 'SBTIntegrationRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        SBTIntegration: new iam.PolicyDocument({
          statements: [
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
              ],
              resources: [sbtTenantsTable.tableArn, `${sbtTenantsTable.tableArn}/index/*`],
            }),
            // EventBridge access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['events:PutEvents'],
              resources: [
                this.sbtEventBridge.eventBusArn,
                `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
              ],
            }),
            // Amplify access (for integration)
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'amplify:GetApp',
                'amplify:ListApps',
                'appsync:GetGraphqlApi',
                'appsync:ListGraphqlApis',
              ],
              resources: ['*'],
            }),
            // Cognito access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminSetUserPassword',
                'cognito-idp:AdminAddUserToGroup',
                'cognito-idp:AdminRemoveUserFromGroup',
                'cognito-idp:ListUsers',
                'cognito-idp:ListUsersInGroup',
              ],
              resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`],
            }),
            // SSM Parameter access
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:PutParameter'],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/cloudbpa/${config.environment}/*`,
              ],
            }),
            // SES access for email notifications
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ses:SendEmail',
                'ses:SendTemplatedEmail',
                'ses:SendBulkTemplatedEmail',
              ],
              resources: ['*'],
            }),
            // CloudWatch access for metrics
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
                'cloudwatch:GetMetricData',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Lambda function for tenant management (SBT Control Plane)
    this.tenantManagementFunction = new nodejs.NodejsFunction(this, 'TenantManagementFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/tenant-management.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: sbtIntegrationRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        SBT_TENANTS_TABLE: sbtTenantsTable.tableName,
        EVENT_BUS_NAME: this.sbtEventBridge.eventBusName,
        USER_POOL_ID: props.userPoolId || 'PLACEHOLDER',
        AMPLIFY_APP_ID: props.amplifyAppId || 'PLACEHOLDER',
        AMPLIFY_API_ID: props.amplifyApiId || 'PLACEHOLDER',
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-TenantManagement-${config.environment}`,
    });

    // Lambda function for SBT <-> Amplify data synchronization
    const dataSyncFunction = new nodejs.NodejsFunction(this, 'DataSyncFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/data-sync.ts'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      role: sbtIntegrationRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        SBT_TENANTS_TABLE: sbtTenantsTable.tableName,
        EVENT_BUS_NAME: this.sbtEventBridge.eventBusName,
        USER_POOL_ID: props.userPoolId || 'PLACEHOLDER',
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-DataSync-${config.environment}`,
    });

    // Lambda function for tenant onboarding automation
    const onboardingFunction = new nodejs.NodejsFunction(this, 'OnboardingAutomationFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/tenant-onboarding-automation.ts'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      role: sbtIntegrationRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        SBT_TENANTS_TABLE: sbtTenantsTable.tableName,
        PROJECTS_TABLE: `CloudBPA-Projects-${config.environment}`,
        FRAMEWORK_REGISTRY_TABLE: `CloudBPA-FrameworkRegistry-${config.environment}`,
        EVENT_BUS_NAME: this.sbtEventBridge.eventBusName,
        USER_POOL_ID: props.userPoolId || 'PLACEHOLDER',
        EMAIL_TEMPLATE_NAME: 'TenantWelcomeTemplate',
        FROM_EMAIL: config.sesConfig?.fromEmail || 'noreply@cloudbpa.com',
        SUPPORT_EMAIL: config.sesConfig?.supportEmail || 'support@cloudbpa.com',
        DOMAIN_NAME: config.domainName || 'app.cloudbpa.com',
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-OnboardingAutomation-${config.environment}`,
    });

    // Lambda function for Control Plane dashboard
    const controlPlaneDashboardFunction = new nodejs.NodejsFunction(this, 'ControlPlaneDashboardFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/control-plane-dashboard.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      role: sbtIntegrationRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        SBT_TENANTS_TABLE: sbtTenantsTable.tableName,
        ANALYSES_TABLE: `CloudBPA-Analyses-${config.environment}`,
        TENANT_ANALYTICS_TABLE: `CloudBPA-TenantAnalytics-${config.environment}`,
        FRAMEWORK_REGISTRY_TABLE: `CloudBPA-FrameworkRegistry-${config.environment}`,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-ControlPlaneDashboard-${config.environment}`,
    });

    // EventBridge rules for SBT events
    const tenantCreatedRule = new events.Rule(this, 'TenantCreatedRule', {
      eventBus: this.sbtEventBridge,
      eventPattern: {
        source: ['sbt.controlplane'],
        detailType: ['Tenant Created'],
      },
      description: 'Process tenant creation events from SBT',
    });

    const tenantUpdatedRule = new events.Rule(this, 'TenantUpdatedRule', {
      eventBus: this.sbtEventBridge,
      eventPattern: {
        source: ['sbt.controlplane'],
        detailType: ['Tenant Updated'],
      },
      description: 'Process tenant update events from SBT',
    });

    const tenantDeletedRule = new events.Rule(this, 'TenantDeletedRule', {
      eventBus: this.sbtEventBridge,
      eventPattern: {
        source: ['sbt.controlplane'],
        detailType: ['Tenant Deleted', 'Tenant Suspended'],
      },
      description: 'Process tenant deletion/suspension events from SBT',
    });

    // EventBridge rule for tenant onboarding automation
    const tenantOnboardingRule = new events.Rule(this, 'TenantOnboardingRule', {
      eventBus: this.sbtEventBridge,
      eventPattern: {
        source: ['sbt.controlplane'],
        detailType: ['Tenant Created'],
      },
      description: 'Trigger tenant onboarding automation when tenant is created',
    });

    // Add targets to EventBridge rules
    tenantCreatedRule.addTarget(new targets.LambdaFunction(dataSyncFunction));
    tenantUpdatedRule.addTarget(new targets.LambdaFunction(dataSyncFunction));
    tenantDeletedRule.addTarget(new targets.LambdaFunction(dataSyncFunction));
    
    // Add onboarding automation target
    tenantOnboardingRule.addTarget(new targets.LambdaFunction(onboardingFunction));

    // SSM Parameters for cross-stack configuration
    new ssm.StringParameter(this, 'SBTEventBusArnParameter', {
      parameterName: `/cloudbpa/${config.environment}/sbt/eventbus-arn`,
      stringValue: this.sbtEventBridge.eventBusArn,
      description: 'SBT EventBridge bus ARN for integration',
    });

    new ssm.StringParameter(this, 'SBTTenantsTableParameter', {
      parameterName: `/cloudbpa/${config.environment}/sbt/tenants-table`,
      stringValue: sbtTenantsTable.tableName,
      description: 'SBT Tenants table name',
    });

    new ssm.StringParameter(this, 'TenantManagementFunctionParameter', {
      parameterName: `/cloudbpa/${config.environment}/sbt/tenant-function-arn`,
      stringValue: this.tenantManagementFunction.functionArn,
      description: 'SBT Tenant Management function ARN',
    });

    // API Gateway for SBT Control Plane (REST endpoints)
    const sbtApi = new cdk.aws_apigateway.RestApi(this, 'SBTControlPlaneAPI', {
      restApiName: `CloudBPA-SBT-API-${config.environment}`,
      description: 'SBT Control Plane REST API for tenant management',
      endpointConfiguration: {
        types: [cdk.aws_apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: config.cognitoConfig.allowedOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Add API Gateway resources and methods
    const tenantsResource = sbtApi.root.addResource('tenants');
    const tenantResource = tenantsResource.addResource('{tenantId}');

    // Lambda integration
    const lambdaIntegration = new cdk.aws_apigateway.LambdaIntegration(
      this.tenantManagementFunction,
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
              },
            },
          }),
        },
      }
    );

    // Add methods for tenant management
    tenantsResource.addMethod('GET', lambdaIntegration);
    tenantsResource.addMethod('POST', lambdaIntegration);
    tenantResource.addMethod('GET', lambdaIntegration);
    tenantResource.addMethod('PUT', lambdaIntegration);
    tenantResource.addMethod('DELETE', lambdaIntegration);

    // Add Control Plane Dashboard API
    const dashboardResource = sbtApi.root.addResource('dashboard');
    const dashboardLambdaIntegration = new cdk.aws_apigateway.LambdaIntegration(
      controlPlaneDashboardFunction,
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
              },
            },
          }),
        },
      }
    );

    // Dashboard endpoints
    const metricsResource = dashboardResource.addResource('metrics');
    const dashboardTenantsResource = dashboardResource.addResource('tenants');
    const dashboardTenantResource = dashboardTenantsResource.addResource('{tenantId}');
    const analyticsResource = dashboardResource.addResource('analytics');
    const crossTenantResource = analyticsResource.addResource('cross-tenant');
    const frameworksResource = dashboardResource.addResource('frameworks');
    const adoptionResource = frameworksResource.addResource('adoption');
    const healthResource = dashboardResource.addResource('health');
    const overviewResource = healthResource.addResource('overview');

    // Add dashboard methods
    metricsResource.addMethod('GET', dashboardLambdaIntegration);
    dashboardTenantsResource.addMethod('GET', dashboardLambdaIntegration);
    dashboardTenantResource.addMethod('GET', dashboardLambdaIntegration);
    crossTenantResource.addMethod('GET', dashboardLambdaIntegration);
    adoptionResource.addMethod('GET', dashboardLambdaIntegration);
    overviewResource.addMethod('GET', dashboardLambdaIntegration);

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'SBTApiUrl', {
      value: sbtApi.url,
      description: 'SBT Control Plane API URL',
      exportName: `${id}-SBTApiUrl`,
    });

    new cdk.CfnOutput(this, 'SBTEventBusArn', {
      value: this.sbtEventBridge.eventBusArn,
      description: 'SBT EventBridge bus ARN',
      exportName: `${id}-SBTEventBusArn`,
    });

    new cdk.CfnOutput(this, 'SBTTenantsTableName', {
      value: sbtTenantsTable.tableName,
      description: 'SBT Tenants table name',
      exportName: `${id}-SBTTenantsTableName`,
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'SBT-Integration');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
