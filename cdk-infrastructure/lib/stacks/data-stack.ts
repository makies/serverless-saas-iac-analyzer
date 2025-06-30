import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { TABLE_NAMES } from '../config/constants';

export interface DataStackProps {
  config: EnvironmentConfig;
  description?: string;
}

export class DataStack extends Construct {
  public readonly tables: Record<string, dynamodb.Table>;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id);

    const { config } = props;
    
    this.tables = {};

    // Tenants テーブル
    this.tables.Tenants = new dynamodb.Table(this, 'TenantsTable', {
      tableName: `${TABLE_NAMES.TENANTS}-${config.environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for tenant status queries
    this.tables.Tenants.addGlobalSecondaryIndex({
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

    // Projects テーブル
    this.tables.Projects = new dynamodb.Table(this, 'ProjectsTable', {
      tableName: `${TABLE_NAMES.PROJECTS}-${config.environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for tenant-based project queries (tenant isolation)
    this.tables.Projects.addGlobalSecondaryIndex({
      indexName: 'ByTenant',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for project status queries
    this.tables.Projects.addGlobalSecondaryIndex({
      indexName: 'ByStatus',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'updatedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Analyses テーブル
    this.tables.Analyses = new dynamodb.Table(this, 'AnalysesTable', {
      tableName: `${TABLE_NAMES.ANALYSES}-${config.environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for tenant-based analysis queries (tenant isolation)
    this.tables.Analyses.addGlobalSecondaryIndex({
      indexName: 'ByTenant',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for project-based analysis queries
    this.tables.Analyses.addGlobalSecondaryIndex({
      indexName: 'ByProject',
      partitionKey: {
        name: 'projectId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for status-based analysis queries
    this.tables.Analyses.addGlobalSecondaryIndex({
      indexName: 'ByStatus',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'updatedAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Findings テーブル
    this.tables.Findings = new dynamodb.Table(this, 'FindingsTable', {
      tableName: `${TABLE_NAMES.FINDINGS}-${config.environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for analysis-based finding queries
    this.tables.Findings.addGlobalSecondaryIndex({
      indexName: 'ByAnalysis',
      partitionKey: {
        name: 'analysisId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'severity',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for tenant-based finding queries (tenant isolation)
    this.tables.Findings.addGlobalSecondaryIndex({
      indexName: 'ByTenant',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for severity-based finding queries
    this.tables.Findings.addGlobalSecondaryIndex({
      indexName: 'BySeverity',
      partitionKey: {
        name: 'severity',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Reports テーブル
    this.tables.Reports = new dynamodb.Table(this, 'ReportsTable', {
      tableName: `${TABLE_NAMES.REPORTS}-${config.environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for tenant-based report queries (tenant isolation)
    this.tables.Reports.addGlobalSecondaryIndex({
      indexName: 'ByTenant',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for project-based report queries
    this.tables.Reports.addGlobalSecondaryIndex({
      indexName: 'ByProject',
      partitionKey: {
        name: 'projectId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for analysis-based report queries
    this.tables.Reports.addGlobalSecondaryIndex({
      indexName: 'ByAnalysis',
      partitionKey: {
        name: 'analysisId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Users テーブル
    this.tables.Users = new dynamodb.Table(this, 'UsersTable', {
      tableName: `${TABLE_NAMES.USERS}-${config.environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for tenant-based user queries (tenant isolation)
    this.tables.Users.addGlobalSecondaryIndex({
      indexName: 'ByTenant',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for Cognito ID-based user queries
    this.tables.Users.addGlobalSecondaryIndex({
      indexName: 'ByCognitoId',
      partitionKey: {
        name: 'cognitoId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for email-based user queries
    this.tables.Users.addGlobalSecondaryIndex({
      indexName: 'ByEmail',
      partitionKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for role-based user queries
    this.tables.Users.addGlobalSecondaryIndex({
      indexName: 'ByRole',
      partitionKey: {
        name: 'role',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'lastLoginAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // FrameworkRegistry テーブル - 中央フレームワーク管理
    this.tables.FrameworkRegistry = new dynamodb.Table(this, 'FrameworkRegistryTable', {
      tableName: `${TABLE_NAMES.FRAMEWORK_REGISTRY}-${config.environment}`,
      partitionKey: {
        name: 'pk', // FRAMEWORK#{type}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk', // #{frameworkId}
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for framework status queries
    this.tables.FrameworkRegistry.addGlobalSecondaryIndex({
      indexName: 'ByStatus',
      partitionKey: {
        name: 'GSI1PK', // STATUS#{status}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK', // TYPE#{type}#NAME#{name}
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // RuleDefinitions テーブル - ルール定義管理
    this.tables.RuleDefinitions = new dynamodb.Table(this, 'RuleDefinitionsTable', {
      tableName: `${TABLE_NAMES.RULE_DEFINITIONS}-${config.environment}`,
      partitionKey: {
        name: 'pk', // RULE#{ruleId}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk', // VERSION#{version}
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for framework-based rule queries
    this.tables.RuleDefinitions.addGlobalSecondaryIndex({
      indexName: 'ByFramework',
      partitionKey: {
        name: 'GSI1PK', // FRAMEWORK#{frameworkId}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK', // PILLAR#{pillar}#SEVERITY#{severity}
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // TenantFrameworkConfig テーブル - テナント別フレームワーク設定
    this.tables.TenantFrameworkConfig = new dynamodb.Table(this, 'TenantFrameworkConfigTable', {
      tableName: `${TABLE_NAMES.TENANT_FRAMEWORK_CONFIG}-${config.environment}`,
      partitionKey: {
        name: 'pk', // TENANT#{tenantId}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk', // FRAMEWORK_SET#{setName}
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for default framework set queries
    this.tables.TenantFrameworkConfig.addGlobalSecondaryIndex({
      indexName: 'ByDefault',
      partitionKey: {
        name: 'GSI1PK', // TENANT#{tenantId}#DEFAULT
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK', // #{isDefault}
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // TenantAnalytics テーブル - テナント分析メトリクス
    this.tables.TenantAnalytics = new dynamodb.Table(this, 'TenantAnalyticsTable', {
      tableName: `${TABLE_NAMES.TENANT_ANALYTICS}-${config.environment}`,
      partitionKey: {
        name: 'pk', // TENANT_ANALYTICS#{tenantId}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk', // MONTH#{YYYY-MM}
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for period-based analytics queries
    this.tables.TenantAnalytics.addGlobalSecondaryIndex({
      indexName: 'ByPeriod',
      partitionKey: {
        name: 'GSI1PK', // MONTH#{YYYY-MM}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK', // INDUSTRY#{industry}#SCORE#{score}
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for tier-based analytics queries
    this.tables.TenantAnalytics.addGlobalSecondaryIndex({
      indexName: 'ByTier',
      partitionKey: {
        name: 'GSI2PK', // TIER#{tier}
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK', // SCORE#{score}#TENANT#{tenantId}
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GlobalAnalytics テーブル - 全体分析メトリクス
    this.tables.GlobalAnalytics = new dynamodb.Table(this, 'GlobalAnalyticsTable', {
      tableName: `${TABLE_NAMES.GLOBAL_ANALYTICS}-${config.environment}`,
      partitionKey: {
        name: 'pk', // GLOBAL_ANALYTICS
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk', // MONTH#{YYYY-MM} or QUARTER#{YYYY-Q} or YEAR#{YYYY}
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: config.dynamoDbConfig.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: config.dynamoDbConfig.pointInTimeRecovery,
      },
      encryption: config.dynamoDbConfig.encryption 
        ? dynamodb.TableEncryption.AWS_MANAGED 
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy: config.environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
    });

    // Add tags to all tables
    Object.values(this.tables).forEach(table => {
      cdk.Tags.of(table).add('Environment', config.environment);
      cdk.Tags.of(table).add('Project', 'CloudBestPracticeAnalyzer');
      cdk.Tags.of(table).add('Service', 'Database');
      cdk.Tags.of(table).add('DataClassification', 'Internal');
    });

    // CloudFormation Outputs
    Object.entries(this.tables).forEach(([name, table]) => {
      new cdk.CfnOutput(scope, `${name}TableName`, {
        value: table.tableName,
        description: `${name} DynamoDB table name`,
        exportName: `${config.environment}-${name}TableName`,
      });

      new cdk.CfnOutput(scope, `${name}TableArn`, {
        value: table.tableArn,
        description: `${name} DynamoDB table ARN`,
        exportName: `${config.environment}-${name}TableArn`,
      });
    });
  }
}