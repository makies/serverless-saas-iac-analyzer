import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { SBTBasicTierConfig, sbtBasicTierConfig } from '../config/sbt-config';

export interface TenantIsolationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  sbtConfig?: SBTBasicTierConfig;
}

/**
 * テナント分離スタック - DynamoDB Pool Model実装
 *
 * 特徴:
 * - 完全なテナント分離 (Row Level Security)
 * - Pool Modelによるコスト効率化
 * - Basic Tier制約の強制
 * - 監査ログとアクセス制御
 */
export class TenantIsolationStack extends cdk.Stack {
  public readonly tables: {
    tenants: dynamodb.Table;
    projects: dynamodb.Table;
    analyses: dynamodb.Table;
    frameworks: dynamodb.Table;
    tenantFrameworkConfigs: dynamodb.Table;
    usage: dynamodb.Table;
  };
  public readonly buckets: {
    iacFiles: s3.Bucket;
    reports: s3.Bucket;
  };
  public readonly tenantIsolationRole: iam.Role;

  constructor(scope: Construct, id: string, props: TenantIsolationStackProps) {
    super(scope, id, props);

    const { config } = props;
    const sbtConfig = props.sbtConfig || sbtBasicTierConfig;

    // === DynamoDB Tables with Pool Model ===

    // テナント情報テーブル
    const tenantsTable = new dynamodb.Table(this, 'TenantsTable', {
      tableName: `CloudBPA-Tenants-${config.environment}`,
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.dynamoDbConfig.pointInTimeRecovery,
      encryption: config.dynamoDbConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : dynamodb.TableEncryption.DEFAULT,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI: ステータス別検索
    tenantsTable.addGlobalSecondaryIndex({
      indexName: 'ByStatus',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // プロジェクトテーブル (Pool Model)
    const projectsTable = new dynamodb.Table(this, 'ProjectsTable', {
      tableName: `CloudBPA-Projects-${config.environment}`,
      partitionKey: {
        name: 'tenantId', // テナント分離のキー
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'projectId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.dynamoDbConfig.pointInTimeRecovery,
      encryption: config.dynamoDbConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : dynamodb.TableEncryption.DEFAULT,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI: プロジェクト検索用
    projectsTable.addGlobalSecondaryIndex({
      indexName: 'ByProjectStatus',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // 分析履歴テーブル (Pool Model)
    const analysesTable = new dynamodb.Table(this, 'AnalysesTable', {
      tableName: `CloudBPA-Analyses-${config.environment}`,
      partitionKey: {
        name: 'tenantId', // テナント分離のキー
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'analysisId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.dynamoDbConfig.pointInTimeRecovery,
      encryption: config.dynamoDbConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : dynamodb.TableEncryption.DEFAULT,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI: プロジェクト別分析検索
    analysesTable.addGlobalSecondaryIndex({
      indexName: 'ByProject',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'projectId',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // GSI: 作成日時別検索
    analysesTable.addGlobalSecondaryIndex({
      indexName: 'ByCreatedAt',
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // フレームワーク設定テーブル (Pool Model)
    const frameworksTable = new dynamodb.Table(this, 'FrameworksTable', {
      tableName: `CloudBPA-Frameworks-${config.environment}`,
      partitionKey: {
        name: 'frameworkId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.dynamoDbConfig.pointInTimeRecovery,
      encryption: config.dynamoDbConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // テナント別フレームワーク設定テーブル
    const tenantFrameworkConfigsTable = new dynamodb.Table(this, 'TenantFrameworkConfigsTable', {
      tableName: `CloudBPA-TenantFrameworkConfigs-${config.environment}`,
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'frameworkId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.dynamoDbConfig.pointInTimeRecovery,
      encryption: config.dynamoDbConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // 使用量追跡テーブル (Basic Tier制約チェック用)
    const usageTable = new dynamodb.Table(this, 'UsageTable', {
      tableName: `CloudBPA-Usage-${config.environment}`,
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'month', // YYYY-MM形式
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: config.dynamoDbConfig.pointInTimeRecovery,
      encryption: config.dynamoDbConfig.encryption
        ? dynamodb.TableEncryption.AWS_MANAGED
        : dynamodb.TableEncryption.DEFAULT,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // === S3 Buckets with Tenant-based Prefix ===

    // IaCファイル保存用バケット
    const iacFilesBucket = new s3.Bucket(this, 'IaCFilesBucket', {
      bucketName: `cloudbpa-iac-files-${config.environment}-${this.region}`,
      versioned: config.s3Config.versioning,
      encryption: config.s3Config.encryption
        ? s3.BucketEncryption.S3_MANAGED
        : s3.BucketEncryption.UNENCRYPTED,
      lifecycleRules: [
        {
          id: 'BasicTierRetention',
          enabled: true,
          expiration: cdk.Duration.days(sbtConfig.constraints.dataRetentionDays),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(60),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // レポート保存用バケット
    const reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: `cloudbpa-reports-${config.environment}-${this.region}`,
      versioned: config.s3Config.versioning,
      encryption: config.s3Config.encryption
        ? s3.BucketEncryption.S3_MANAGED
        : s3.BucketEncryption.UNENCRYPTED,
      lifecycleRules: [
        {
          id: 'BasicTierRetention',
          enabled: true,
          expiration: cdk.Duration.days(sbtConfig.constraints.dataRetentionDays),
        },
      ],
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // オブジェクトの初期化
    this.tables = {
      tenants: tenantsTable,
      projects: projectsTable,
      analyses: analysesTable,
      frameworks: frameworksTable,
      tenantFrameworkConfigs: tenantFrameworkConfigsTable,
      usage: usageTable,
    };

    this.buckets = {
      iacFiles: iacFilesBucket,
      reports: reportsBucket,
    };

    // === IAM Role for Tenant Isolation ===
    this.tenantIsolationRole = new iam.Role(this, 'TenantIsolationRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        TenantIsolationPolicy: new iam.PolicyDocument({
          statements: [
            // DynamoDB: テナント分離されたアクセス
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
              ],
              resources: [
                tenantsTable.tableArn,
                `${tenantsTable.tableArn}/index/*`,
                projectsTable.tableArn,
                `${projectsTable.tableArn}/index/*`,
                analysesTable.tableArn,
                `${analysesTable.tableArn}/index/*`,
                frameworksTable.tableArn,
                `${frameworksTable.tableArn}/index/*`,
                tenantFrameworkConfigsTable.tableArn,
                `${tenantFrameworkConfigsTable.tableArn}/index/*`,
                usageTable.tableArn,
                `${usageTable.tableArn}/index/*`,
              ],
              conditions: {
                'ForAllValues:StringEquals': {
                  'dynamodb:LeadingKeys': ['${aws:RequestTag/TenantId}'],
                },
              },
            }),
            // S3: テナントプレフィックス制限
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
              resources: [
                `${iacFilesBucket.bucketArn}/\${aws:RequestTag/TenantId}/*`,
                `${reportsBucket.bucketArn}/\${aws:RequestTag/TenantId}/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:ListBucket'],
              resources: [
                iacFilesBucket.bucketArn,
                reportsBucket.bucketArn,
              ],
              conditions: {
                StringLike: {
                  's3:prefix': ['${aws:RequestTag/TenantId}/*'],
                },
              },
            }),
          ],
        }),
      },
    });

    // === CloudWatch Logs for Audit ===
    const auditLogGroup = new logs.LogGroup(this, 'AuditLogGroup', {
      logGroupName: `/cloudbpa/${config.environment}/audit`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // === Stack Outputs ===
    new cdk.CfnOutput(this, 'TenantIsolationConfigOutput', {
      value: JSON.stringify(
        {
          tables: {
            tenants: this.tables.tenants.tableName,
            projects: this.tables.projects.tableName,
            analyses: this.tables.analyses.tableName,
            frameworks: this.tables.frameworks.tableName,
            tenantFrameworkConfigs: this.tables.tenantFrameworkConfigs.tableName,
            usage: this.tables.usage.tableName,
          },
          buckets: {
            iacFiles: this.buckets.iacFiles.bucketName,
            reports: this.buckets.reports.bucketName,
          },
          roleArn: this.tenantIsolationRole.roleArn,
          auditLogGroup: auditLogGroup.logGroupName,
        },
        null,
        2
      ),
      description: 'Tenant isolation configuration for multi-tenant SaaS',
    });
  }
}
