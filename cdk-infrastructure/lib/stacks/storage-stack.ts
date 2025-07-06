import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { S3_PREFIXES } from '../config/constants';

export interface StorageStackProps {
  config: EnvironmentConfig;
  description?: string;
}

export class StorageStack extends Construct {
  public readonly buckets: Record<string, s3.Bucket>;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id);

    const { config } = props;

    this.buckets = {};

    // メインアプリケーションバケット (環境ベースの安定した命名)
    const bucketSuffix = `${config.environment}-${cdk.Aws.ACCOUNT_ID}`;
    this.buckets.ApplicationData = new s3.Bucket(this, 'ApplicationDataBucket', {
      bucketName: `cloudbpa-app-${bucketSuffix}`,
      versioned: config.s3Config.versioning,
      encryption: config.s3Config.encryption
        ? s3.BucketEncryption.S3_MANAGED
        : s3.BucketEncryption.UNENCRYPTED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'AnalysisInputsCleanup',
          enabled: true,
          prefix: S3_PREFIXES.ANALYSIS_INPUTS,
          expiration: cdk.Duration.days(90), // SBT Basic Tier制限
        },
        {
          id: 'AnalysisOutputsCleanup',
          enabled: true,
          prefix: S3_PREFIXES.ANALYSIS_OUTPUTS,
          expiration: cdk.Duration.days(90),
        },
        {
          id: 'ReportsCleanup',
          enabled: true,
          prefix: S3_PREFIXES.REPORTS,
          expiration: cdk.Duration.days(365), // レポートは長期保存
        },
        {
          id: 'IncompleteMultipartUploads',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: 'OldVersionCleanup',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: config.cognitoConfig.allowedOrigins,
          exposedHeaders: ['ETag', 'x-amz-version-id'],
          maxAge: 3000,
        },
      ],
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.environment !== 'prod',
    });

    // CloudFormation テンプレート保存用バケット
    this.buckets.Templates = new s3.Bucket(this, 'TemplatesBucket', {
      bucketName: `cloudbpa-tpl-${bucketSuffix}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'TemplateVersionCleanup',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(365),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN, // テンプレートは常に保持
    });

    // ログ保存用バケット
    this.buckets.Logs = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `cloudbpa-logs-${bucketSuffix}`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'LogsCleanup',
          enabled: true,
          expiration: cdk.Duration.days(config.monitoringConfig.logRetentionDays),
        },
        {
          id: 'LogsIntelligentTiering',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(1),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // バックアップ用バケット（本番環境のみ）
    if (config.environment === 'prod') {
      this.buckets.Backup = new s3.Bucket(this, 'BackupBucket', {
        bucketName: `cloudbpa-backup-${bucketSuffix}`,
        versioned: true,
        encryption: s3.BucketEncryption.KMS_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        lifecycleRules: [
          {
            id: 'BackupRetention',
            enabled: true,
            transitions: [
              {
                storageClass: s3.StorageClass.GLACIER,
                transitionAfter: cdk.Duration.days(30),
              },
              {
                storageClass: s3.StorageClass.DEEP_ARCHIVE,
                transitionAfter: cdk.Duration.days(180),
              },
            ],
            expiration: cdk.Duration.days(2555), // 7年保存
          },
        ],
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
    }

    // バケットポリシーの設定
    this.setupBucketPolicies(config);

    // イベント通知の設定
    this.setupEventNotifications(config);

    // タグの追加
    Object.values(this.buckets).forEach((bucket) => {
      cdk.Tags.of(bucket).add('Environment', config.environment);
      cdk.Tags.of(bucket).add('Project', 'CloudBestPracticeAnalyzer');
      cdk.Tags.of(bucket).add('Service', 'Storage');
      cdk.Tags.of(bucket).add('DataClassification', 'Internal');
    });

    // CloudFormation Outputs
    Object.entries(this.buckets).forEach(([name, bucket]) => {
      new cdk.CfnOutput(scope, `${name}BucketName`, {
        value: bucket.bucketName,
        description: `${name} S3 bucket name`,
        exportName: `${config.environment}-${name}BucketName`,
      });

      new cdk.CfnOutput(scope, `${name}BucketArn`, {
        value: bucket.bucketArn,
        description: `${name} S3 bucket ARN`,
        exportName: `${config.environment}-${name}BucketArn`,
      });
    });
  }

  private setupBucketPolicies(config: EnvironmentConfig) {
    // アプリケーションデータバケットのポリシー
    this.buckets.ApplicationData.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyInsecureConnections',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [
          this.buckets.ApplicationData.bucketArn,
          this.buckets.ApplicationData.arnForObjects('*'),
        ],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    );

    // テナント境界の強制はIAMロールレベルで実施（バケットポリシーではなく）
    // S3バケットポリシーの条件キーに制限があるため、より詳細なアクセス制御は
    // Cognito Identity Pool のIAMロールで実装

    // 最大ファイルサイズ制限（SBT Basic Tier: 10MB）
    this.buckets.ApplicationData.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'EnforceFileSizeLimit',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [this.buckets.ApplicationData.arnForObjects(`${S3_PREFIXES.ANALYSIS_INPUTS}/*`)],
        conditions: {
          NumericGreaterThan: {
            's3:content-length': 10485760, // 10MB
          },
        },
      })
    );
  }

  private setupEventNotifications(config: EnvironmentConfig) {
    // 現在は設定なし（後でLambda関数が作成された後に設定）
    // EventBridge 統合は AppSync スタックで設定
  }
}
