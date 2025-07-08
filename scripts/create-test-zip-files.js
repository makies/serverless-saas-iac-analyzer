#!/usr/bin/env node

/**
 * ZIPファイルテスト用のサンプルファイル生成スクリプト
 * 
 * このスクリプトは実際のZIPアーカイブを作成して
 * ZIP対応のファイルアップロード機能をテストします。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// テストファイル出力ディレクトリ
const OUTPUT_DIR = path.join(__dirname, '..', 'test-files', 'zip-archives');

// ディレクトリ作成
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// CloudFormation用ZIPファイル作成
function createCloudFormationZip() {
  const tempDir = path.join(__dirname, 'temp-cf');
  ensureDirectory(tempDir);

  // 複数のCloudFormationテンプレートを作成
  const templates = {
    'vpc.yaml': `AWSTemplateFormatVersion: '2010-09-09'
Description: VPC infrastructure for multi-tier application
Parameters:
  EnvironmentName:
    Type: String
    Default: production
Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub \${EnvironmentName}-VPC
  
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.1.0/24
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub \${EnvironmentName} Public Subnet (AZ1)

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: 10.0.2.0/24
      Tags:
        - Key: Name
          Value: !Sub \${EnvironmentName} Private Subnet (AZ1)

Outputs:
  VPC:
    Description: A reference to the created VPC
    Value: !Ref VPC
    Export:
      Name: !Sub \${EnvironmentName}-VPCID`,

    'security-groups.yaml': `AWSTemplateFormatVersion: '2010-09-09'
Description: Security groups for web application
Parameters:
  EnvironmentName:
    Type: String
    Default: production
  VpcId:
    Type: String
    Description: VPC ID from VPC stack
Resources:
  WebServerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub \${EnvironmentName}-WebServers
      GroupDescription: Security group for web servers
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          SourceSecurityGroupId: !Ref LoadBalancerSecurityGroup
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          SourceSecurityGroupId: !Ref LoadBalancerSecurityGroup

  LoadBalancerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub \${EnvironmentName}-LoadBalancers
      GroupDescription: Security group for load balancers
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0`,

    'application.json': JSON.stringify({
      "AWSTemplateFormatVersion": "2010-09-09",
      "Description": "Application resources including ALB and Auto Scaling",
      "Parameters": {
        "EnvironmentName": {
          "Type": "String",
          "Default": "production"
        },
        "InstanceType": {
          "Type": "String",
          "Default": "t3.micro",
          "AllowedValues": ["t3.micro", "t3.small", "t3.medium"]
        }
      },
      "Resources": {
        "ApplicationLoadBalancer": {
          "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
          "Properties": {
            "Scheme": "internet-facing",
            "Type": "application",
            "IpAddressType": "ipv4"
          }
        },
        "AutoScalingGroup": {
          "Type": "AWS::AutoScaling::AutoScalingGroup",
          "Properties": {
            "MinSize": "1",
            "MaxSize": "3",
            "DesiredCapacity": "2",
            "HealthCheckType": "ELB",
            "HealthCheckGracePeriod": 300
          }
        }
      }
    }, null, 2),

    'insecure-resources.yaml': `AWSTemplateFormatVersion: '2010-09-09'
Description: Resources with intentional security issues for testing
Resources:
  # WARNING: This S3 bucket is intentionally insecure for testing
  PublicBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: intentionally-public-test-bucket
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false
  
  # WARNING: This security group allows all traffic
  WideOpenSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group with wide open access - FOR TESTING ONLY
      SecurityGroupIngress:
        - IpProtocol: "-1"
          CidrIp: "0.0.0.0/0"`
  };

  // ファイルを一時ディレクトリに書き込み
  for (const [fileName, content] of Object.entries(templates)) {
    fs.writeFileSync(path.join(tempDir, fileName), content);
  }

  // ZIPファイル作成
  try {
    const zipPath = path.join(OUTPUT_DIR, 'cloudformation-multi-stack.zip');
    execSync(`cd "${tempDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
    console.log('✅ CloudFormation ZIP created:', zipPath);
  } catch (error) {
    console.error('❌ Error creating CloudFormation ZIP:', error.message);
  }

  // 一時ディレクトリを削除
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// Terraform用ZIPファイル作成
function createTerraformZip() {
  const tempDir = path.join(__dirname, 'temp-tf');
  ensureDirectory(tempDir);

  const terraformFiles = {
    'main.tf': `terraform {
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

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "\${var.environment}-vpc"
    Environment = var.environment
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "\${var.environment}-igw"
    Environment = var.environment
  }
}`,

    'variables.tf': `variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}`,

    'outputs.tf': `output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}`,

    'subnets.tf': `# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "\${var.environment}-public-subnet-\${count.index + 1}"
    Type        = "Public"
    Environment = var.environment
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "\${var.environment}-private-subnet-\${count.index + 1}"
    Type        = "Private"
    Environment = var.environment
  }
}`,

    'security-groups.tf': `# Web Server Security Group
resource "aws_security_group" "web_servers" {
  name_prefix = "\${var.environment}-web-servers"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }

  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.load_balancer.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "\${var.environment}-web-servers"
    Environment = var.environment
  }
}

# Load Balancer Security Group
resource "aws_security_group" "load_balancer" {
  name_prefix = "\${var.environment}-load-balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
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
    Name        = "\${var.environment}-load-balancer"
    Environment = var.environment
  }
}`,

    'terraform.tfvars': `aws_region = "us-east-1"
environment = "test"
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]`,

    'insecure.tf': `# WARNING: This file contains intentionally insecure resources for testing

# S3 bucket with public access
resource "aws_s3_bucket" "public_bucket" {
  bucket = "intentionally-public-bucket-terraform-test"

  tags = {
    Purpose     = "testing-security-analysis"
    Warning     = "intentionally-insecure"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "public_bucket_pab" {
  bucket = aws_s3_bucket.public_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Security group allowing all traffic
resource "aws_security_group" "insecure" {
  name_prefix = "\${var.environment}-insecure"
  vpc_id      = aws_vpc.main.id

  # WARNING: This allows all inbound traffic
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
    Name        = "\${var.environment}-insecure-sg"
    Purpose     = "testing-security-analysis"
    Warning     = "intentionally-insecure"
    Environment = var.environment
  }
}`
  };

  // ファイルを一時ディレクトリに書き込み
  for (const [fileName, content] of Object.entries(terraformFiles)) {
    fs.writeFileSync(path.join(tempDir, fileName), content);
  }

  // ZIPファイル作成
  try {
    const zipPath = path.join(OUTPUT_DIR, 'terraform-infrastructure.zip');
    execSync(`cd "${tempDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
    console.log('✅ Terraform ZIP created:', zipPath);
  } catch (error) {
    console.error('❌ Error creating Terraform ZIP:', error.message);
  }

  // 一時ディレクトリを削除
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// CDK用ZIPファイル作成
function createCDKZip() {
  const tempDir = path.join(__dirname, 'temp-cdk');
  ensureDirectory(tempDir);

  const cdkFiles = {
    'package.json': JSON.stringify({
      "name": "test-cdk-infrastructure",
      "version": "0.1.0",
      "bin": {
        "test-cdk-infrastructure": "bin/test-cdk-infrastructure.js"
      },
      "scripts": {
        "build": "tsc",
        "watch": "tsc -w",
        "test": "jest",
        "cdk": "cdk"
      },
      "devDependencies": {
        "@types/jest": "^29.4.0",
        "@types/node": "18.14.6",
        "jest": "^29.5.0",
        "ts-jest": "^29.0.5",
        "aws-cdk": "2.70.0",
        "typescript": "~4.9.5"
      },
      "dependencies": {
        "aws-cdk-lib": "2.70.0",
        "constructs": "^10.0.0",
        "source-map-support": "^0.5.21"
      }
    }, null, 2),

    'bin/test-cdk-infrastructure.ts': `#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { ApplicationStack } from '../lib/application-stack';
import { SecurityStack } from '../lib/security-stack';

const app = new cdk.App();

const environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Create VPC stack first
const vpcStack = new VpcStack(app, 'TestVpcStack', {
  env: environment,
  description: 'VPC and networking infrastructure',
});

// Create security stack
const securityStack = new SecurityStack(app, 'TestSecurityStack', {
  env: environment,
  vpc: vpcStack.vpc,
  description: 'Security groups and IAM roles',
});

// Create application stack
const applicationStack = new ApplicationStack(app, 'TestApplicationStack', {
  env: environment,
  vpc: vpcStack.vpc,
  securityGroups: securityStack.securityGroups,
  description: 'Application infrastructure',
});`,

    'lib/vpc-stack.ts': `import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    this.vpc = new ec2.Vpc(this, 'TestVpc', {
      maxAzs: 3,
      cidr: '10.0.0.0/16',
      natGateways: 2,
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

    // Add VPC Flow Logs
    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
    });

    // Output VPC ID
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
    });
  }
}`,

    'lib/security-stack.ts': `import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SecurityStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class SecurityStack extends cdk.Stack {
  public readonly securityGroups: {
    webServer: ec2.SecurityGroup;
    loadBalancer: ec2.SecurityGroup;
    database: ec2.SecurityGroup;
  };

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    // Load Balancer Security Group
    const loadBalancerSg = new ec2.SecurityGroup(this, 'LoadBalancerSG', {
      vpc: props.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    loadBalancerSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    loadBalancerSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Web Server Security Group
    const webServerSg = new ec2.SecurityGroup(this, 'WebServerSG', {
      vpc: props.vpc,
      description: 'Security group for web servers',
      allowAllOutbound: true,
    });

    webServerSg.addIngressRule(
      loadBalancerSg,
      ec2.Port.tcp(80),
      'Allow HTTP from ALB'
    );

    // Database Security Group
    const databaseSg = new ec2.SecurityGroup(this, 'DatabaseSG', {
      vpc: props.vpc,
      description: 'Security group for database',
      allowAllOutbound: false,
    });

    databaseSg.addIngressRule(
      webServerSg,
      ec2.Port.tcp(3306),
      'Allow MySQL from web servers'
    );

    this.securityGroups = {
      webServer: webServerSg,
      loadBalancer: loadBalancerSg,
      database: databaseSg,
    };

    // Create IAM role for EC2 instances
    const ec2Role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });
  }
}`,

    'lib/application-stack.ts': `import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface ApplicationStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  securityGroups: {
    webServer: ec2.SecurityGroup;
    loadBalancer: ec2.SecurityGroup;
    database: ec2.SecurityGroup;
  };
}

export class ApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ApplicationLB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.securityGroups.loadBalancer,
    });

    // Auto Scaling Group
    const asg = new autoscaling.AutoScalingGroup(this, 'WebServerASG', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: props.securityGroups.webServer,
      minCapacity: 1,
      maxCapacity: 5,
      desiredCapacity: 2,
    });

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'WebServerTG', {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [asg],
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
      },
    });

    // Listener
    alb.addListener('Listener', {
      port: 80,
      defaultTargetGroups: [targetGroup],
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
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.securityGroups.database],
      multiAz: false,
      allocatedStorage: 20,
      storageEncrypted: true,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.instanceEndpoint.hostname,
      description: 'RDS Database Endpoint',
    });
  }
}`,

    'lib/insecure-stack.ts': `import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

// WARNING: This stack contains intentionally insecure resources for testing

export class InsecureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // WARNING: S3 Bucket with public access
    const publicBucket = new s3.Bucket(this, 'PublicBucket', {
      bucketName: 'intentionally-public-bucket-cdk-test',
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: true,
    });

    // WARNING: Security Group allowing all traffic
    const insecureSg = new ec2.SecurityGroup(this, 'InsecureSecurityGroup', {
      vpc: ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true }),
      description: 'Security group with wide open access - FOR TESTING ONLY',
      allowAllOutbound: true,
    });

    insecureSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      'Allow all traffic - INSECURE'
    );

    // Add tags to indicate this is for testing
    cdk.Tags.of(this).add('Purpose', 'security-analysis-testing');
    cdk.Tags.of(this).add('Warning', 'intentionally-insecure');
  }
}`,

    'cdk.json': JSON.stringify({
      "app": "npx ts-node --prefer-ts-exts bin/test-cdk-infrastructure.ts",
      "watch": {
        "include": ["**"],
        "exclude": [
          "README.md",
          "cdk*.json",
          "**/*.d.ts",
          "**/*.js",
          "tsconfig.json",
          "package*.json",
          "yarn.lock",
          "node_modules",
          "test"
        ]
      },
      "context": {
        "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
        "@aws-cdk/core:checkSecretUsage": true,
        "@aws-cdk/core:target-partitions": ["aws", "aws-cn"]
      }
    }, null, 2),

    'tsconfig.json': JSON.stringify({
      "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "lib": ["es2020"],
        "declaration": true,
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "noImplicitThis": true,
        "alwaysStrict": true,
        "noUnusedLocals": false,
        "noUnusedParameters": false,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": false,
        "inlineSourceMap": true,
        "inlineSources": true,
        "experimentalDecorators": true,
        "strictPropertyInitialization": false,
        "typeRoots": ["./node_modules/@types"]
      },
      "exclude": ["cdk.out"]
    }, null, 2)
  };

  // ディレクトリ作成
  ensureDirectory(path.join(tempDir, 'bin'));
  ensureDirectory(path.join(tempDir, 'lib'));

  // ファイルを一時ディレクトリに書き込み
  for (const [fileName, content] of Object.entries(cdkFiles)) {
    const filePath = path.join(tempDir, fileName);
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
  }

  // ZIPファイル作成
  try {
    const zipPath = path.join(OUTPUT_DIR, 'cdk-typescript-project.zip');
    execSync(`cd "${tempDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
    console.log('✅ CDK ZIP created:', zipPath);
  } catch (error) {
    console.error('❌ Error creating CDK ZIP:', error.message);
  }

  // 一時ディレクトリを削除
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// 混合ファイル用ZIPファイル作成
function createMixedZip() {
  const tempDir = path.join(__dirname, 'temp-mixed');
  ensureDirectory(tempDir);

  const mixedFiles = {
    'README.md': `# Mixed Infrastructure Project

This ZIP contains a combination of different IaC formats:
- CloudFormation templates
- Terraform configurations  
- CDK TypeScript code

Use this to test multi-format analysis capabilities.`,

    'cloudformation/vpc.yaml': `AWSTemplateFormatVersion: '2010-09-09'
Description: VPC for mixed infrastructure project
Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true`,

    'terraform/main.tf': `resource "aws_s3_bucket" "app_bucket" {
  bucket = "mixed-project-app-bucket"
  
  tags = {
    Project = "mixed-infrastructure"
    Type    = "application"
  }
}`,

    'cdk/app-stack.ts': `import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new lambda.Function(this, 'HelloWorldFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200, body: "Hello World" });'),
    });
  }
}`,

    'config/parameters.json': JSON.stringify({
      "environment": "test",
      "region": "us-east-1",
      "project": "mixed-infrastructure",
      "owner": "development-team"
    }, null, 2)
  };

  // ファイルを一時ディレクトリに書き込み
  for (const [fileName, content] of Object.entries(mixedFiles)) {
    const filePath = path.join(tempDir, fileName);
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
  }

  // ZIPファイル作成
  try {
    const zipPath = path.join(OUTPUT_DIR, 'mixed-infrastructure.zip');
    execSync(`cd "${tempDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
    console.log('✅ Mixed infrastructure ZIP created:', zipPath);
  } catch (error) {
    console.error('❌ Error creating mixed infrastructure ZIP:', error.message);
  }

  // 一時ディレクトリを削除
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// メイン実行関数
function main() {
  console.log('🗜️  Creating ZIP archives for testing...\n');

  // 出力ディレクトリを作成
  ensureDirectory(OUTPUT_DIR);

  try {
    createCloudFormationZip();
    createTerraformZip();
    createCDKZip();
    createMixedZip();

    console.log('\n🎉 All ZIP test files created successfully!');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log('\n📋 Created ZIP archives:');
    console.log('  - cloudformation-multi-stack.zip (4 CloudFormation templates)');
    console.log('  - terraform-infrastructure.zip (7 Terraform files)');
    console.log('  - cdk-typescript-project.zip (Complete CDK TypeScript project)');
    console.log('  - mixed-infrastructure.zip (Mixed CF/TF/CDK files)');

  } catch (error) {
    console.error('❌ Error creating ZIP files:', error);
    process.exit(1);
  }
}

// zipコマンドが利用可能かチェック
function checkZipCommand() {
  try {
    execSync('zip --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('❌ Error: zip command is not available.');
    console.error('Please install zip utility:');
    console.error('  - macOS: zip is pre-installed');
    console.error('  - Ubuntu/Debian: sudo apt install zip');
    console.error('  - CentOS/RHEL: sudo yum install zip');
    return false;
  }
}

// スクリプト実行
if (require.main === module) {
  if (checkZipCommand()) {
    main();
  } else {
    process.exit(1);
  }
}