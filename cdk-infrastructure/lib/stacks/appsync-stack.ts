import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
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
  description?: string;
}

export class AppSyncStack extends Construct {
  public readonly api: appsync.GraphqlApi;
  public readonly resolverFunctions: Record<string, lambda.Function>;
  private readonly dataSources: Record<string, appsync.BaseDataSource>;

  constructor(scope: Construct, id: string, props: AppSyncStackProps) {
    super(scope, id);

    const { config, userPool, tables, buckets } = props;

    this.resolverFunctions = {};
    this.dataSources = {};

    // GraphQL API
    this.api = new appsync.GraphqlApi(this, 'GraphQLAPI', {
      name: `${config.appSyncConfig.name}-${config.environment}`,
      schema: appsync.SchemaFile.fromAsset(
        path.join(__dirname, '../../schema/schema.graphql')
      ),
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
              resources: Object.values(tables).flatMap(table => [
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
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
              ],
              resources: Object.values(buckets).flatMap(bucket => [
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
              actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ],
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
              actions: [
                'ssm:GetParameter',
                'ssm:GetParameters',
                'ssm:GetParametersByPath',
              ],
              resources: [
                `arn:aws:ssm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:parameter/cloud-bpa/${config.environment}/*`,
              ],
            }),
          ],
        }),
      },
    });

    // Lambda Layer for PowerTools
    const powerToolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'PowerToolsLayer',
      `arn:aws:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsTypeScriptV2:1`
    );

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
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
      },
      tracing: config.monitoringConfig.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
    };

    // Query Resolvers
    this.createQueryResolvers(commonLambdaProps);

    // Mutation Resolvers
    this.createMutationResolvers(commonLambdaProps);

    // Subscription Resolvers
    this.createSubscriptionResolvers(commonLambdaProps);

    // Data Sources
    this.createDataSources();

    // Resolvers
    this.attachResolvers();

    // Tags
    cdk.Tags.of(this.api).add('Environment', config.environment);
    cdk.Tags.of(this.api).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this.api).add('Service', 'GraphQL');
  }

  private createQueryResolvers(commonProps: any) {
    // Tenant queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_TENANT] = new nodejs.NodejsFunction(
      this,
      'GetTenantFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getTenant.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-getTenant-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_TENANTS] = new nodejs.NodejsFunction(
      this,
      'ListTenantsFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/listTenants.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-listTenants-${commonProps.environment.ENVIRONMENT}`,
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
        functionName: `${commonProps.environment.SERVICE_NAME}-getProject-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_PROJECTS_BY_TENANT] = new nodejs.NodejsFunction(
      this,
      'ListProjectsByTenantFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/listProjectsByTenant.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-listProjectsByTenant-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    // Analysis queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_ANALYSIS] = new nodejs.NodejsFunction(
      this,
      'GetAnalysisFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getAnalysis.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-getAnalysis-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_ANALYSES_BY_PROJECT] = new nodejs.NodejsFunction(
      this,
      'ListAnalysesByProjectFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/listAnalysesByProject.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-listAnalysesByProject-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    // Dashboard queries
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_DASHBOARD_METRICS] = new nodejs.NodejsFunction(
      this,
      'GetDashboardMetricsFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/getDashboardMetrics.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-getDashboardMetrics-${commonProps.environment.ENVIRONMENT}`,
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
        functionName: `${commonProps.environment.SERVICE_NAME}-listFrameworks-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_FRAMEWORK] = new nodejs.NodejsFunction(
      this,
      'GetFrameworkFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/framework/getFramework.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-getFramework-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.LIST_FRAMEWORK_RULES] = new nodejs.NodejsFunction(
      this,
      'ListFrameworkRulesFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/framework/listFrameworkRules.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-listFrameworkRules-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.GET_TENANT_FRAMEWORK_CONFIG] = new nodejs.NodejsFunction(
      this,
      'GetTenantFrameworkConfigFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/query/framework/getTenantFrameworkConfig.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-getTenantFrameworkConfig-${commonProps.environment.ENVIRONMENT}`,
      }
    );
  }

  private createMutationResolvers(commonProps: any) {
    // Project mutations
    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.CREATE_PROJECT] = new nodejs.NodejsFunction(
      this,
      'CreateProjectFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/createProject.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-createProject-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.UPDATE_PROJECT] = new nodejs.NodejsFunction(
      this,
      'UpdateProjectFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/updateProject.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-updateProject-${commonProps.environment.ENVIRONMENT}`,
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
        functionName: `${commonProps.environment.SERVICE_NAME}-createAnalysis-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.START_ANALYSIS] = new nodejs.NodejsFunction(
      this,
      'StartAnalysisFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/startAnalysis.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-startAnalysis-${commonProps.environment.ENVIRONMENT}`,
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
        functionName: `${commonProps.environment.SERVICE_NAME}-generateReport-${commonProps.environment.ENVIRONMENT}`,
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
        functionName: `${commonProps.environment.SERVICE_NAME}-createFrameworkSet-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.UPDATE_FRAMEWORK_SET] = new nodejs.NodejsFunction(
      this,
      'UpdateFrameworkSetFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/framework/updateFrameworkSet.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-updateFrameworkSet-${commonProps.environment.ENVIRONMENT}`,
      }
    );

    this.resolverFunctions[LAMBDA_FUNCTION_NAMES.DELETE_FRAMEWORK_SET] = new nodejs.NodejsFunction(
      this,
      'DeleteFrameworkSetFunction',
      {
        ...commonProps,
        entry: path.join(__dirname, '../../src/resolvers/mutation/framework/deleteFrameworkSet.ts'),
        handler: 'handler',
        functionName: `${commonProps.environment.SERVICE_NAME}-deleteFrameworkSet-${commonProps.environment.ENVIRONMENT}`,
      }
    );
  }

  private createSubscriptionResolvers(commonProps: any) {
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
      dataSource: this.dataSources[`${LAMBDA_FUNCTION_NAMES.GET_TENANT_FRAMEWORK_CONFIG}DataSource`],
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
  }
}