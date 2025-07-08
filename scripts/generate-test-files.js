#!/usr/bin/env node

/**
 * ファイルアップロードテスト用のサンプルファイル生成スクリプト
 * 
 * このスクリプトはIaC Analyzerのファイルアップロード機能をテストするための
 * 様々なタイプとサイズのサンプルファイルを生成します。
 */

const fs = require('fs');
const path = require('path');

// テストファイル出力ディレクトリ
const OUTPUT_DIR = path.join(__dirname, '..', 'test-files');

// ディレクトリ作成
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// CloudFormationテンプレートの生成
function generateCloudFormationTemplates() {
  const cfDir = path.join(OUTPUT_DIR, 'cloudformation');
  ensureDirectory(cfDir);

  // 基本的なS3バケットテンプレート
  const basicS3Template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Basic S3 bucket template for testing',
    Resources: {
      TestBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'test-bucket-for-analysis',
          VersioningConfiguration: {
            Status: 'Enabled'
          },
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            BlockPublicPolicy: true,
            IgnorePublicAcls: true,
            RestrictPublicBuckets: true
          }
        }
      }
    },
    Outputs: {
      BucketName: {
        Description: 'Name of the created S3 bucket',
        Value: { Ref: 'TestBucket' }
      }
    }
  };

  // 複雑なWebアプリケーションテンプレート
  const webAppTemplate = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Web application with ALB, EC2, and RDS',
    Parameters: {
      VpcId: {
        Type: 'AWS::EC2::VPC::Id',
        Description: 'VPC ID for the application'
      },
      InstanceType: {
        Type: 'String',
        Default: 't3.micro',
        AllowedValues: ['t3.micro', 't3.small', 't3.medium']
      }
    },
    Resources: {
      ALB: {
        Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        Properties: {
          Type: 'application',
          Scheme: 'internet-facing',
          SecurityGroups: [{ Ref: 'ALBSecurityGroup' }]
        }
      },
      ALBSecurityGroup: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: 'Security group for ALB',
          VpcId: { Ref: 'VpcId' },
          SecurityGroupIngress: [
            {
              IpProtocol: 'tcp',
              FromPort: 80,
              ToPort: 80,
              CidrIp: '0.0.0.0/0'
            },
            {
              IpProtocol: 'tcp',
              FromPort: 443,
              ToPort: 443,
              CidrIp: '0.0.0.0/0'
            }
          ]
        }
      },
      LaunchTemplate: {
        Type: 'AWS::EC2::LaunchTemplate',
        Properties: {
          LaunchTemplateName: 'WebAppLaunchTemplate',
          LaunchTemplateData: {
            ImageId: 'ami-0abcdef1234567890',
            InstanceType: { Ref: 'InstanceType' },
            SecurityGroupIds: [{ Ref: 'InstanceSecurityGroup' }]
          }
        }
      },
      InstanceSecurityGroup: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: 'Security group for EC2 instances',
          VpcId: { Ref: 'VpcId' }
        }
      },
      Database: {
        Type: 'AWS::RDS::DBInstance',
        Properties: {
          DBInstanceClass: 'db.t3.micro',
          Engine: 'mysql',
          MasterUsername: 'admin',
          MasterUserPassword: 'password123',
          AllocatedStorage: 20,
          VPCSecurityGroups: [{ Ref: 'DBSecurityGroup' }]
        }
      },
      DBSecurityGroup: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: 'Security group for RDS',
          VpcId: { Ref: 'VpcId' }
        }
      }
    }
  };

  // セキュリティ問題のあるテンプレート（テスト用）
  const insecureTemplate = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'Template with security issues for testing',
    Resources: {
      InsecureBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: false,
            BlockPublicPolicy: false,
            IgnorePublicAcls: false,
            RestrictPublicBuckets: false
          }
        }
      },
      WideOpenSecurityGroup: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
          GroupDescription: 'Security group with wide open access',
          SecurityGroupIngress: [
            {
              IpProtocol: '-1',
              CidrIp: '0.0.0.0/0'
            }
          ]
        }
      }
    }
  };

  // ファイル保存
  fs.writeFileSync(
    path.join(cfDir, 'basic-s3-bucket.yaml'),
    `# Basic S3 Bucket Template
# Generated for testing purposes

${require('yaml').stringify(basicS3Template)}`
  );

  fs.writeFileSync(
    path.join(cfDir, 'basic-s3-bucket.json'),
    JSON.stringify(basicS3Template, null, 2)
  );

  fs.writeFileSync(
    path.join(cfDir, 'web-application.yaml'),
    `# Web Application Template
# Contains ALB, EC2, and RDS resources

${require('yaml').stringify(webAppTemplate)}`
  );

  fs.writeFileSync(
    path.join(cfDir, 'insecure-template.yaml'),
    `# Template with Security Issues
# For testing security analysis features

${require('yaml').stringify(insecureTemplate)}`
  );

  console.log('✅ CloudFormation templates generated');
}

// Terraformファイルの生成
function generateTerraformFiles() {
  const tfDir = path.join(OUTPUT_DIR, 'terraform');
  ensureDirectory(tfDir);

  // 基本的なS3バケット
  const basicS3 = `# Basic S3 bucket configuration
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
  default     = "test-bucket-for-terraform-analysis"
}

resource "aws_s3_bucket" "test_bucket" {
  bucket = var.bucket_name

  tags = {
    Environment = "test"
    Purpose     = "file-upload-testing"
  }
}

resource "aws_s3_bucket_versioning" "test_bucket_versioning" {
  bucket = aws_s3_bucket.test_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "test_bucket_pab" {
  bucket = aws_s3_bucket.test_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "bucket_name" {
  description = "Name of the created S3 bucket"
  value       = aws_s3_bucket.test_bucket.bucket
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.test_bucket.arn
}`;

  // VPCとネットワーク設定
  const vpcConfig = `# VPC and networking configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "main-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "main-igw"
  }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.\${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "public-subnet-\${count.index + 1}"
    Type = "Public"
  }
}

resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.\${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "private-subnet-\${count.index + 1}"
    Type = "Private"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}`;

  // セキュリティグループ（問題あり）
  const insecureSecurityGroup = `# Security group with issues for testing
resource "aws_security_group" "insecure" {
  name_prefix = "insecure-sg"
  vpc_id      = aws_vpc.main.id

  # WARNING: This is intentionally insecure for testing purposes
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "insecure-security-group"
    Purpose     = "testing-security-analysis"
    Warning     = "intentionally-insecure"
  }
}

# S3 bucket with public access (insecure)
resource "aws_s3_bucket" "public_bucket" {
  bucket = "intentionally-public-bucket-for-testing"

  tags = {
    Purpose = "testing-security-analysis"
    Warning = "intentionally-insecure"
  }
}

resource "aws_s3_bucket_public_access_block" "public_bucket_pab" {
  bucket = aws_s3_bucket.public_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}`;

  // ファイル保存
  fs.writeFileSync(path.join(tfDir, 'main.tf'), basicS3);
  fs.writeFileSync(path.join(tfDir, 'vpc.tf'), vpcConfig);
  fs.writeFileSync(path.join(tfDir, 'insecure.tf'), insecureSecurityGroup);

  // variables.tf
  const variables = `# Variables file
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "test"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "iac-analyzer-test"
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default = {
    Project     = "iac-analyzer"
    Environment = "test"
    ManagedBy   = "terraform"
  }
}`;

  fs.writeFileSync(path.join(tfDir, 'variables.tf'), variables);

  console.log('✅ Terraform files generated');
}

// CDKファイルの生成
function generateCDKFiles() {
  const cdkDir = path.join(OUTPUT_DIR, 'cdk');
  ensureDirectory(cdkDir);

  // TypeScript CDK スタック
  const cdkStack = `import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class TestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket with best practices
    const bucket = new s3.Bucket(this, 'TestBucket', {
      bucketName: 'test-bucket-for-cdk-analysis',
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          expiration: cdk.Duration.days(365),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    // VPC
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Groups
    const albSg = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    // RDS Database
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      multiAz: false,
      allocatedStorage: 20,
      storageEncrypted: true,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
    });
  }
}`;

  // CDK App
  const cdkApp = `#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TestStack } from './test-stack';

const app = new cdk.App();

new TestStack(app, 'TestStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Test stack for IaC analysis',
  tags: {
    Project: 'iac-analyzer',
    Environment: 'test',
  },
});`;

  // セキュリティ問題のあるCDKスタック
  const insecureCdkStack = `import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class InsecureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // WARNING: This is intentionally insecure for testing purposes
    
    // S3 Bucket with public access
    const publicBucket = new s3.Bucket(this, 'PublicBucket', {
      bucketName: 'intentionally-public-bucket-cdk',
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: true,
    });

    // VPC with default settings
    const vpc = new ec2.Vpc(this, 'InsecureVPC', {
      maxAzs: 1,
      natGateways: 0, // No NAT gateways for cost savings, but less secure
    });

    // Security Group allowing all traffic
    const wideOpenSg = new ec2.SecurityGroup(this, 'WideOpenSecurityGroup', {
      vpc,
      description: 'Security group with wide open access - FOR TESTING ONLY',
      allowAllOutbound: true,
    });

    // Allow all inbound traffic - THIS IS INSECURE
    wideOpenSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      'Allow all traffic - INSECURE'
    );
  }
}`;

  // package.json
  const packageJson = {
    name: 'cdk-test-files',
    version: '0.1.0',
    bin: {
      'cdk-test-files': 'bin/cdk-test-files.js'
    },
    scripts: {
      build: 'tsc',
      watch: 'tsc -w',
      test: 'jest',
      'cdk:deploy': 'cdk deploy',
      'cdk:diff': 'cdk diff',
      'cdk:synth': 'cdk synth'
    },
    devDependencies: {
      '@types/jest': '^29.4.0',
      '@types/node': '18.14.6',
      jest: '^29.5.0',
      'ts-jest': '^29.0.5',
      'aws-cdk': '2.70.0',
      typescript: '~4.9.5'
    },
    dependencies: {
      'aws-cdk-lib': '2.70.0',
      constructs: '^10.0.0',
      'source-map-support': '^0.5.21'
    }
  };

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['es2020'],
      declaration: true,
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      noImplicitThis: true,
      alwaysStrict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: false,
      inlineSourceMap: true,
      inlineSources: true,
      experimentalDecorators: true,
      strictPropertyInitialization: false,
      typeRoots: ['./node_modules/@types']
    },
    exclude: ['cdk.out']
  };

  // cdk.json
  const cdkJson = {
    app: 'npx ts-node --prefer-ts-exts bin/cdk-test-files.ts',
    watch: {
      include: ['**'],
      exclude: [
        'README.md',
        'cdk*.json',
        '**/*.d.ts',
        '**/*.js',
        'tsconfig.json',
        'package*.json',
        'yarn.lock',
        'node_modules',
        'test'
      ]
    },
    context: {
      '@aws-cdk/aws-lambda:recognizeLayerVersion': true,
      '@aws-cdk/core:checkSecretUsage': true,
      '@aws-cdk/core:target-partitions': ['aws', 'aws-cn']
    }
  };

  // ディレクトリ作成
  ensureDirectory(path.join(cdkDir, 'bin'));
  ensureDirectory(path.join(cdkDir, 'lib'));

  // ファイル保存
  fs.writeFileSync(path.join(cdkDir, 'lib', 'test-stack.ts'), cdkStack);
  fs.writeFileSync(path.join(cdkDir, 'lib', 'insecure-stack.ts'), insecureCdkStack);
  fs.writeFileSync(path.join(cdkDir, 'bin', 'cdk-test-files.ts'), cdkApp);
  fs.writeFileSync(path.join(cdkDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  fs.writeFileSync(path.join(cdkDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  fs.writeFileSync(path.join(cdkDir, 'cdk.json'), JSON.stringify(cdkJson, null, 2));

  console.log('✅ CDK files generated');
}

// 様々なサイズのファイルを生成
function generateVariousSizedFiles() {
  const sizesDir = path.join(OUTPUT_DIR, 'file-sizes');
  ensureDirectory(sizesDir);

  // 1KB ファイル
  const small = 'a'.repeat(1024);
  fs.writeFileSync(path.join(sizesDir, 'small-1kb.txt'), small);

  // 100KB ファイル
  const medium = 'b'.repeat(100 * 1024);
  fs.writeFileSync(path.join(sizesDir, 'medium-100kb.txt'), medium);

  // 1MB ファイル
  const large = 'c'.repeat(1024 * 1024);
  fs.writeFileSync(path.join(sizesDir, 'large-1mb.txt'), large);

  // 5MB ファイル
  const veryLarge = 'd'.repeat(5 * 1024 * 1024);
  fs.writeFileSync(path.join(sizesDir, 'very-large-5mb.txt'), veryLarge);

  // 10MB ファイル（制限テスト用）
  const maxSize = 'e'.repeat(10 * 1024 * 1024);
  fs.writeFileSync(path.join(sizesDir, 'max-size-10mb.txt'), maxSize);

  // 15MB ファイル（制限超過テスト用）
  const overLimit = 'f'.repeat(15 * 1024 * 1024);
  fs.writeFileSync(path.join(sizesDir, 'over-limit-15mb.txt'), overLimit);

  console.log('✅ Various sized files generated');
}

// 特殊なファイル形式を生成
function generateSpecialFormats() {
  const specialDir = path.join(OUTPUT_DIR, 'special-formats');
  ensureDirectory(specialDir);

  // ZIP ファイル（バイナリなので実際のZIPは作成しない、テキストで代用）
  const fakeZip = `PK\x03\x04\x14\x00\x00\x00\x08\x00fake zip content for testing`;
  fs.writeFileSync(path.join(specialDir, 'fake-archive.zip'), fakeZip);

  // CSV ファイル
  const csv = `resource_type,resource_name,security_issue,severity
S3::Bucket,public-bucket,Public read access,HIGH
EC2::SecurityGroup,wide-open-sg,Allows all traffic,CRITICAL
RDS::DBInstance,test-db,No encryption,MEDIUM
Lambda::Function,test-function,No VPC configuration,LOW`;
  fs.writeFileSync(path.join(specialDir, 'security-issues.csv'), csv);

  // 空ファイル
  fs.writeFileSync(path.join(specialDir, 'empty-file.txt'), '');

  // Unicode文字を含むファイル
  const unicode = `# 日本語を含むCloudFormationテンプレート
AWSTemplateFormatVersion: '2010-09-09'
Description: 'テスト用のテンプレート 🚀'
Resources:
  テストバケット:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: 'unicode-test-bucket-日本語'`;
  fs.writeFileSync(path.join(specialDir, 'unicode-template.yaml'), unicode);

  console.log('✅ Special format files generated');
}

// README.md を生成
function generateReadme() {
  const readme = `# Test Files for IaC Analyzer

このディレクトリには、IaC Analyzerのファイルアップロード機能をテストするための様々なサンプルファイルが含まれています。

## ディレクトリ構成

### CloudFormation Templates (\`cloudformation/\`)
- \`basic-s3-bucket.yaml\` - 基本的なS3バケットテンプレート（YAML形式）
- \`basic-s3-bucket.json\` - 基本的なS3バケットテンプレート（JSON形式）
- \`web-application.yaml\` - ALB、EC2、RDSを含む複雑なWebアプリケーション
- \`insecure-template.yaml\` - セキュリティ問題を含むテンプレート（テスト用）

### Terraform Files (\`terraform/\`)
- \`main.tf\` - 基本的なS3バケット設定
- \`vpc.tf\` - VPCとネットワーク設定
- \`variables.tf\` - 変数定義
- \`insecure.tf\` - セキュリティ問題を含む設定（テスト用）

### CDK Files (\`cdk/\`)
- \`lib/test-stack.ts\` - TypeScriptで書かれたCDKスタック
- \`lib/insecure-stack.ts\` - セキュリティ問題を含むCDKスタック
- \`bin/cdk-test-files.ts\` - CDKアプリケーションエントリーポイント
- \`package.json\` - プロジェクト設定
- \`cdk.json\` - CDK設定

### File Sizes (\`file-sizes/\`)
ファイルサイズ制限のテスト用：
- \`small-1kb.txt\` - 1KB
- \`medium-100kb.txt\` - 100KB
- \`large-1mb.txt\` - 1MB
- \`very-large-5mb.txt\` - 5MB
- \`max-size-10mb.txt\` - 10MB（制限内）
- \`over-limit-15mb.txt\` - 15MB（制限超過）

### Special Formats (\`special-formats/\`)
- \`fake-archive.zip\` - ZIPファイル（テキストで代用）
- \`security-issues.csv\` - CSVファイル
- \`empty-file.txt\` - 空ファイル
- \`unicode-template.yaml\` - Unicode文字を含むファイル

## 使用方法

1. ファイル生成：
   \`\`\`bash
   node scripts/generate-test-files.js
   \`\`\`

2. アップロードテスト：
   - 各ディレクトリのファイルを使用してファイルアップロード機能をテスト
   - サイズ制限、形式チェック、セキュリティ分析の動作確認

## テストシナリオ

### 正常系
- ✅ 有効なCloudFormation/Terraform/CDKファイルのアップロード
- ✅ YAML、JSON、TypeScript形式の対応確認
- ✅ 制限内サイズのファイル処理

### 異常系
- ❌ サイズ制限超過ファイルの拒否
- ❌ 無効な形式のファイルの拒否
- ❌ 空ファイルの処理
- ❌ バイナリファイルの拒否

### セキュリティテスト
- 🔍 セキュリティ問題の検出確認
- 🔍 Well-Architected原則との適合性チェック
- 🔍 ベストプラクティス違反の特定

## 注意事項

- \`insecure-\` で始まるファイルは意図的にセキュリティ問題を含んでいます
- 実際のAWSアカウントでのデプロイは避けてください
- テスト環境でのみ使用してください
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme);
  console.log('✅ README.md generated');
}

// メイン実行関数
function main() {
  console.log('🚀 Generating test files for IaC Analyzer file upload testing...\n');

  // 出力ディレクトリを作成
  ensureDirectory(OUTPUT_DIR);

  try {
    // YAML パッケージが必要なので、一時的にrequireを使わない方法で生成
    generateCloudFormationTemplates();
    generateTerraformFiles();
    generateCDKFiles();
    generateVariousSizedFiles();
    generateSpecialFormats();
    generateReadme();

    console.log('\n🎉 All test files generated successfully!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log('\n📋 Generated files:');
    console.log('  - CloudFormation templates (YAML/JSON)');
    console.log('  - Terraform configurations');
    console.log('  - CDK TypeScript files');
    console.log('  - Various file sizes (1KB - 15MB)');
    console.log('  - Special format files');
    console.log('  - README.md with usage instructions');

  } catch (error) {
    console.error('❌ Error generating test files:', error);
    process.exit(1);
  }
}

// YAMLライブラリがない場合の代替実装
function generateCloudFormationTemplates() {
  const cfDir = path.join(OUTPUT_DIR, 'cloudformation');
  ensureDirectory(cfDir);

  // YAML文字列として直接生成
  const basicS3Yaml = `# Basic S3 Bucket Template
# Generated for testing purposes

AWSTemplateFormatVersion: '2010-09-09'
Description: Basic S3 bucket template for testing
Resources:
  TestBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-bucket-for-analysis
      VersioningConfiguration:
        Status: Enabled
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
Outputs:
  BucketName:
    Description: Name of the created S3 bucket
    Value: !Ref TestBucket`;

  const basicS3Json = {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "Basic S3 bucket template for testing",
    "Resources": {
      "TestBucket": {
        "Type": "AWS::S3::Bucket",
        "Properties": {
          "BucketName": "test-bucket-for-analysis",
          "VersioningConfiguration": {
            "Status": "Enabled"
          },
          "PublicAccessBlockConfiguration": {
            "BlockPublicAcls": true,
            "BlockPublicPolicy": true,
            "IgnorePublicAcls": true,
            "RestrictPublicBuckets": true
          }
        }
      }
    },
    "Outputs": {
      "BucketName": {
        "Description": "Name of the created S3 bucket",
        "Value": { "Ref": "TestBucket" }
      }
    }
  };

  const webAppYaml = `# Web Application Template
# Contains ALB, EC2, and RDS resources

AWSTemplateFormatVersion: '2010-09-09'
Description: Web application with ALB, EC2, and RDS
Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
    Description: VPC ID for the application
  InstanceType:
    Type: String
    Default: t3.micro
    AllowedValues:
      - t3.micro
      - t3.small
      - t3.medium
Resources:
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Type: application
      Scheme: internet-facing
      SecurityGroups:
        - !Ref ALBSecurityGroup
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for ALB
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceClass: db.t3.micro
      Engine: mysql
      MasterUsername: admin
      MasterUserPassword: password123
      AllocatedStorage: 20`;

  const insecureYaml = `# Template with Security Issues
# For testing security analysis features

AWSTemplateFormatVersion: '2010-09-09'
Description: Template with security issues for testing
Resources:
  InsecureBucket:
    Type: AWS::S3::Bucket
    Properties:
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false
  WideOpenSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group with wide open access
      SecurityGroupIngress:
        - IpProtocol: '-1'
          CidrIp: 0.0.0.0/0`;

  // ファイル保存
  fs.writeFileSync(path.join(cfDir, 'basic-s3-bucket.yaml'), basicS3Yaml);
  fs.writeFileSync(path.join(cfDir, 'basic-s3-bucket.json'), JSON.stringify(basicS3Json, null, 2));
  fs.writeFileSync(path.join(cfDir, 'web-application.yaml'), webAppYaml);
  fs.writeFileSync(path.join(cfDir, 'insecure-template.yaml'), insecureYaml);

  console.log('✅ CloudFormation templates generated');
}

// スクリプト実行
if (require.main === module) {
  main();
}