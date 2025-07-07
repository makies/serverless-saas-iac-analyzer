import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { LAMBDA_FUNCTION_NAMES } from '../config/constants';
import * as path from 'path';

export interface AppSyncStackProps {
  config: EnvironmentConfig;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  identityPool: cognito.CfnIdentityPool;
  tables: Record<string, dynamodb.Table>;
  buckets: Record<string, s3.Bucket>;
  analysisStateMachineArn?: string;
  reportGenerationStateMachineArn?: string;
  description?: string;
}

export class AppSyncStack extends Construct {
  public readonly api: appsync.GraphqlApi;
  public readonly resolverFunctions: Record<string, lambda.Function>;
  private readonly dataSources: Record<string, appsync.BaseDataSource>;

  constructor(scope: Construct, id: string, props: AppSyncStackProps) {
    super(scope, id);

    const { config, userPool, tables, buckets, analysisStateMachineArn, reportGenerationStateMachineArn } = props;

    this.resolverFunctions = {};
    this.dataSources = {};

    // GraphQL API
    this.api = new appsync.GraphqlApi(this, 'GraphQL', {
      name: `${config.appSyncConfig.name}-${config.environment}`,
      definition: appsync.Definition.fromFile(path.join(__dirname, '../../schema/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],
      },
      logConfig: {
        fieldLogLevel: config.appSyncConfig.fieldLogLevel as appsync.FieldLogLevel,
        excludeVerboseContent: false,
        retention: logs.RetentionDays.ONE_MONTH,
      },
      xrayEnabled: config.monitoringConfig.enableXRay,
    });

    // Lambda Execution Role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
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
              resources: Object.values(tables).flatMap((table) => [
                table.tableArn,
                `${table.tableArn}/index/*`,
              ]),
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
              resources: Object.values(buckets).flatMap((bucket) => [
                bucket.bucketArn,
                `${bucket.bucketArn}/*`,
              ]),
            }),
          ],
        }),
        BedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              resources: [
                `arn:aws:bedrock:${config.bedrockConfig.region}::foundation-model/${config.bedrockConfig.modelId}`,
              ],
            }),
          ],
        }),
        ParameterStoreAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
              resources: [
                `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/cloud-bpa/${config.environment}/*`,
              ],
            }),
          ],
        }),
        StepFunctionsAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['states:StartExecution', 'states:DescribeExecution', 'states:StopExecution'],
              resources: [
                analysisStateMachineArn || `arn:aws:states:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stateMachine:AnalysisWorkflow-${config.environment}`,
                reportGenerationStateMachineArn || `arn:aws:states:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:stateMachine:ReportGenerationWorkflow-${config.environment}`,
              ],
            }),
          ],
        }),
        STSAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sts:AssumeRole'],
              resources: ['*'],
              conditions: {
                StringLike: {
                  'sts:RoleSessionName': 'CloudBPA-Analysis-*',
                },
              },
            }),
          ],
        }),
      },
    });

    // Lambda PowerTools Layer - Get latest version from SSM Parameter Store
    const powerToolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'PowerToolsLayer',
      ssm.StringParameter.valueForStringParameter(
        this,
        '/aws/service/powertools/typescript/generic/all/latest'
      )
    );

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(config.lambdaConfig.timeout),
      memorySize: config.lambdaConfig.memorySize,
      role: lambdaExecutionRole,
      layers: [powerToolsLayer],
      environment: {
        ...config.lambdaConfig.environment,
        LOG_LEVEL: config.lambdaConfig.logLevel,
        SERVICE_NAME: 'cloud-best-practice-analyzer',
        ENVIRONMENT: config.environment,
        // DynamoDB Table Names
        TENANTS_TABLE: tables.Tenants.tableName,
        PROJECTS_TABLE: tables.Projects.tableName,
        ANALYSES_TABLE: tables.Analyses.tableName,
        FINDINGS_TABLE: tables.Findings.tableName,
        REPORTS_TABLE: tables.Reports.tableName,
        USERS_TABLE: tables.Users.tableName,
        // Multi-Framework System Tables
        FRAMEWORK_REGISTRY_TABLE: tables.FrameworkRegistry.tableName,
        RULE_DEFINITIONS_TABLE: tables.RuleDefinitions.tableName,
        TENANT_FRAMEWORK_CONFIG_TABLE: tables.TenantFrameworkConfig.tableName,
        TENANT_ANALYTICS_TABLE: tables.TenantAnalytics.tableName,
        GLOBAL_ANALYTICS_TABLE: tables.GlobalAnalytics.tableName,
        // S3 Bucket Names
        APPLICATION_DATA_BUCKET: buckets.ApplicationData.bucketName,
        TEMPLATES_BUCKET: buckets.Templates.bucketName,
        LOGS_BUCKET: buckets.Logs.bucketName,
        // Bedrock Configuration
        BEDROCK_MODEL_ID: config.bedrockConfig.modelId,
        BEDROCK_REGION: config.bedrockConfig.region,
        // Step Functions Configuration
        ANALYSIS_STATE_MACHINE_ARN: analysisStateMachineArn || '',
        REPORT_GENERATION_STATE_MACHINE_ARN: reportGenerationStateMachineArn || '',
      },
      tracing: config.monitoringConfig.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    };

    // Query Resolvers
    this.createQueryResolvers(config, commonLambdaProps);

    // Mutation Resolvers
    this.createMutationResolvers(config, commonLambdaProps);

    // Subscription Resolvers
    this.createSubscriptionResolvers(config, commonLambdaProps);

    // Data Sources
    this.createDataSources();

    // Resolvers
    this.attachResolvers();

    // Setup log retention for Lambda functions
    this.setupLogRetention(config);

    // Tags
    cdk.Tags.of(this.api).add('Environment', config.environment);
    cdk.Tags.of(this.api).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this.api).add('Service', 'GraphQL');
  }

  private createQueryResolvers(config: EnvironmentConfig, commonProps: nodejs.NodejsFunctionProps) {
    // Tenant queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_TENANT] = new nodejs.NodejsFunction(
      this,
      'GetTenantFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getTenant.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getTenant-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_TENANTS] = new nodejs.NodejsFunction(
      this,
      'ListTenantsFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/listTenants.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-listTenants-${config.environment}`,
      }
    );

    // Project queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_PROJECT] = new nodejs.NodejsFunction(
      this,
      'GetProjectFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getProject.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getProject-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_PROJECTS_BY_TENANT] =
      new nodejs.NodejsFunction(this, 'ListProjectsByTenantFunction', {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/listProjectsByTenant.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-listProjectsByTenant-${config.environment}`,
      });

    // Analysis queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_ANALYSIS] = new nodejs.NodejsFunction(
      this,
      'GetAnalysisFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getAnalysis.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getAnalysis-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_ANALYSES_BY_PROJECT] =
      new nodejs.NodejsFunction(this, 'ListAnalysesByProjectFunction', {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/listAnalysesByProject.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-listAnalysesByProject-${config.environment}`,
      });

    // Dashboard queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_DASHBOARD_METRICS] = new nodejs.NodejsFunction(
      this,
      'GetDashboardMetricsFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getDashboardMetrics.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getDashboardMetrics-${config.environment}`,
      }
    );

    // Framework Management queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_FRAMEWORKS] = new nodejs.NodejsFunction(
      this,
      'ListFrameworksFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/framework/listFrameworks.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-listFrameworks-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_FRAMEWORK] = new nodejs.NodejsFunction(
      this,
      'GetFrameworkFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/framework/getFramework.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getFramework-${config.environment}`,
      }
    );

    // User Profile queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_USER_PROFILE] = new nodejs.NodejsFunction(
      this,
      'GetUserProfileFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getUserProfile.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getUserProfile-${config.environment}`,
      }
    );

    // Analysis Findings queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_ANALYSIS_FINDINGS] = new nodejs.NodejsFunction(
      this,
      'GetAnalysisFindingsFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getAnalysisFindings.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getAnalysisFindings-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_FRAMEWORK_RULES] = new nodejs.NodejsFunction(
      this,
      'ListFrameworkRulesFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/framework/listFrameworkRules.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-listFrameworkRules-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_TENANT_FRAMEWORK_CONFIG] =
      new nodejs.NodejsFunction(this, 'GetTenantFrameworkConfigFunction', {
        ...commonProps,
        entry: path.join(
          __dirname,
          '../../src/resolvers/query/framework/getTenantFrameworkConfig.ts'
        ),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-getTenantFrameworkConfig-${config.environment}`,
      });
  }

  private createMutationResolvers(config: EnvironmentConfig, commonProps: nodejs.NodejsFunctionProps) {
    // Project mutations
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.CREATE_PROJECT] = new nodejs.NodejsFunction(
      this,
      'CreateProjectFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/createProject.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-createProject-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.UPDATE_PROJECT] = new nodejs.NodejsFunction(
      this,
      'UpdateProjectFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/updateProject.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-updateProject-${config.environment}`,
      }
    );

    // Analysis mutations
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.CREATE_ANALYSIS] = new nodejs.NodejsFunction(
      this,
      'CreateAnalysisFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/createAnalysis.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-createAnalysis-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.START_ANALYSIS] = new nodejs.NodejsFunction(
      this,
      'StartAnalysisFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/startAnalysis.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-startAnalysis-${config.environment}`,
      }
    );

    // Report mutations
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GENERATE_REPORT] = new nodejs.NodejsFunction(
      this,
      'GenerateReportFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/generateReport.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-generateReport-${config.environment}`,
      }
    );

    // Framework Management mutations
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.CREATE_FRAMEWORK_SET] = new nodejs.NodejsFunction(
      this,
      'CreateFrameworkSetFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/framework/createFrameworkSet.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-createFrameworkSet-${config.environment}`,
      }
    );

    // Enhanced analysis mutations
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.CREATE_ANALYSIS_WITH_LIVE_SCAN] = new nodejs.NodejsFunction(
      this,
      'CreateAnalysisWithLiveScanFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/createAnalysisWithLiveScan.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-createAnalysisWithLiveScan-${config.environment}`,
      }
    );

    // Enhanced report generation
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GENERATE_REPORT_ENHANCED] = new nodejs.NodejsFunction(
      this,
      'GenerateReportEnhancedFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/generateReportEnhanced.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-generateReportEnhanced-${config.environment}`,
      }
    );

    // User Profile mutations
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.UPDATE_USER_PROFILE] = new nodejs.NodejsFunction(
      this,
      'UpdateUserProfileFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/updateUserProfile.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-updateUserProfile-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.UPDATE_FRAMEWORK_SET] = new nodejs.NodejsFunction(
      this,
      'UpdateFrameworkSetFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/framework/updateFrameworkSet.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-updateFrameworkSet-${config.environment}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.DELETE_FRAMEWORK_SET] = new nodejs.NodejsFunction(
      this,
      'DeleteFrameworkSetFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/framework/deleteFrameworkSet.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-deleteFrameworkSet-${config.environment}`,
      }
    );

    // Framework Engine Functions
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.FRAMEWORK_INITIALIZATION] = new nodejs.NodejsFunction(
      this,
      'FrameworkInitializationFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/functions/framework-initialization/handler.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-frameworkInitialization-${config.environment}`,
        timeout: cdk.Duration.minutes(5), // Longer timeout for initialization
        memorySize: 1024, // Higher memory for processing
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.FRAMEWORK_ANALYSIS] = new nodejs.NodejsFunction(
      this,
      'FrameworkAnalysisFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/functions/framework-analysis/handler.ts'),
        handler: 'handler',
        functionName: `${config.appSyncConfig.name}-frameworkAnalysis-${config.environment}`,
        timeout: cdk.Duration.minutes(15), // Long timeout for comprehensive analysis
        memorySize: 2048, // High memory for processing large datasets
      }
    );
  }

  private createSubscriptionResolvers(_config: EnvironmentConfig, _commonProps: nodejs.NodejsFunctionProps) {
    // Subscription resolvers are handled by AppSync's built-in subscription mechanism
    // No separate Lambda functions needed for basic subscriptions
  }

  private createDataSources() {
    // Lambda Data Sources
    Object.entries(this.resolverFunctions).forEach(([name, func]) => {
      const dataSourceName = `${name}DataSource`;
      this.dataSources[dataSourceName] = this.api.addLambdaDataSource(dataSourceName, func, {
        description: `Lambda data source for ${name}`,
      });
    });
  }

  private attachResolvers() {
    // Query resolvers
    this.api.createResolver('GetTenantResolver', {
      typeName: 'Query',
      fieldName: 'getTenant',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_TENANT}DataSource`],
    });

    this.api.createResolver('ListTenantsResolver', {
      typeName: 'Query',
      fieldName: 'listTenants',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.LIST_TENANTS}DataSource`],
    });

    this.api.createResolver('GetProjectResolver', {
      typeName: 'Query',
      fieldName: 'getProject',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_PROJECT}DataSource`],
    });

    this.api.createResolver('ListProjectsByTenantResolver', {
      typeName: 'Query',
      fieldName: 'listProjectsByTenant',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.LIST_PROJECTS_BY_TENANT}DataSource`],
    });

    this.api.createResolver('GetAnalysisResolver', {
      typeName: 'Query',
      fieldName: 'getAnalysis',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_ANALYSIS}DataSource`],
    });

    this.api.createResolver('ListAnalysesByProjectResolver', {
      typeName: 'Query',
      fieldName: 'listAnalysesByProject',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.LIST_ANALYSES_BY_PROJECT}DataSource`],
    });

    this.api.createResolver('GetDashboardMetricsResolver', {
      typeName: 'Query',
      fieldName: 'getDashboardMetrics',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_DASHBOARD_METRICS}DataSource`],
    });

    // Framework Management Query resolvers
    this.api.createResolver('ListFrameworksResolver', {
      typeName: 'Query',
      fieldName: 'listFrameworks',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.LIST_FRAMEWORKS}DataSource`],
    });

    this.api.createResolver('GetFrameworkResolver', {
      typeName: 'Query',
      fieldName: 'getFramework',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_FRAMEWORK}DataSource`],
    });

    this.api.createResolver('ListFrameworkRulesResolver', {
      typeName: 'Query',
      fieldName: 'listFrameworkRules',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.LIST_FRAMEWORK_RULES}DataSource`],
    });

    this.api.createResolver('GetTenantFrameworkConfigResolver', {
      typeName: 'Query',
      fieldName: 'getTenantFrameworkConfig',
      dataSource:
        this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_TENANT_FRAMEWORK_CONFIG}DataSource`],
    });

    // Mutation resolvers
    this.api.createResolver('CreateProjectResolver', {
      typeName: 'Mutation',
      fieldName: 'createProject',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.CREATE_PROJECT}DataSource`],
    });

    this.api.createResolver('UpdateProjectResolver', {
      typeName: 'Mutation',
      fieldName: 'updateProject',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.UPDATE_PROJECT}DataSource`],
    });

    this.api.createResolver('CreateAnalysisResolver', {
      typeName: 'Mutation',
      fieldName: 'createAnalysis',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.CREATE_ANALYSIS}DataSource`],
    });

    this.api.createResolver('StartAnalysisResolver', {
      typeName: 'Mutation',
      fieldName: 'startAnalysis',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.START_ANALYSIS}DataSource`],
    });

    this.api.createResolver('GenerateReportResolver', {
      typeName: 'Mutation',
      fieldName: 'generateReport',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GENERATE_REPORT}DataSource`],
    });

    // Framework Management Mutation resolvers
    this.api.createResolver('CreateFrameworkSetResolver', {
      typeName: 'Mutation',
      fieldName: 'createFrameworkSet',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.CREATE_FRAMEWORK_SET}DataSource`],
    });

    this.api.createResolver('UpdateFrameworkSetResolver', {
      typeName: 'Mutation',
      fieldName: 'updateFrameworkSet',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.UPDATE_FRAMEWORK_SET}DataSource`],
    });

    this.api.createResolver('DeleteFrameworkSetResolver', {
      typeName: 'Mutation',
      fieldName: 'deleteFrameworkSet',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.DELETE_FRAMEWORK_SET}DataSource`],
    });

    // User Profile resolvers
    this.api.createResolver('GetUserProfileResolver', {
      typeName: 'Query',
      fieldName: 'getUserProfile',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_USER_PROFILE}DataSource`],
    });

    this.api.createResolver('UpdateUserProfileResolver', {
      typeName: 'Mutation',
      fieldName: 'updateUserProfile',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.UPDATE_USER_PROFILE}DataSource`],
    });

    // Analysis Findings resolver
    this.api.createResolver('GetAnalysisFindingsResolver', {
      typeName: 'Query',
      fieldName: 'getAnalysisFindings',
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_ANALYSIS_FINDINGS}DataSource`],
    });
  }

  private setupLogRetention(config: EnvironmentConfig) {
    // Set log retention for all Lambda functions
    Object.entries(this.resolverFunctions).forEach(([name, func]) => {
      new logs.LogGroup(this, `${name}LogGroup`, {
        logGroupName: `/aws/lambda/${func.functionName}`,
        retention: this.getLogRetention(config.monitoringConfig.logRetentionDays),
        removalPolicy:
          config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    });
  }

  private getLogRetention(days: number): logs.RetentionDays {
    const retentionMap: Record<number, logs.RetentionDays> = {
      1: logs.RetentionDays.ONE_DAY,
      3: logs.RetentionDays.THREE_DAYS,
      5: logs.RetentionDays.FIVE_DAYS,
      7: logs.RetentionDays.ONE_WEEK,
      14: logs.RetentionDays.TWO_WEEKS,
      30: logs.RetentionDays.ONE_MONTH,
      60: logs.RetentionDays.TWO_MONTHS,
      90: logs.RetentionDays.THREE_MONTHS,
      120: logs.RetentionDays.FOUR_MONTHS,
      150: logs.RetentionDays.FIVE_MONTHS,
      180: logs.RetentionDays.SIX_MONTHS,
      365: logs.RetentionDays.ONE_YEAR,
      400: logs.RetentionDays.THIRTEEN_MONTHS,
      545: logs.RetentionDays.EIGHTEEN_MONTHS,
      731: logs.RetentionDays.TWO_YEARS,
      1827: logs.RetentionDays.FIVE_YEARS,
      3653: logs.RetentionDays.TEN_YEARS,
    };

    return retentionMap[days] || logs.RetentionDays.ONE_MONTH;
  }
}
