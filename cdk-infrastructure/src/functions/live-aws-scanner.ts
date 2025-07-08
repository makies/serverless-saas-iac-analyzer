/**
 * Live AWS Account Scanner Lambda Function
 * Performs real-time scanning of AWS resources across multiple services and regions
 * Supports Well-Architected, Security Hub, and custom framework analysis
 */

import { EventBridgeHandler } from 'aws-lambda';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { ConfigServiceClient, SelectResourceConfigCommand } from '@aws-sdk/client-config-service';
import { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVpcsCommand } from '@aws-sdk/client-ec2';
import { S3Client, ListBucketsCommand, GetBucketEncryptionCommand, GetBucketPolicyCommand } from '@aws-sdk/client-s3';
import { LambdaClient, ListFunctionsCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { RDSClient, DescribeDBInstancesCommand, DescribeDBClustersCommand } from '@aws-sdk/client-rds';
import { CloudFormationClient, ListStacksCommand, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { IAMClient, ListRolesCommand, ListPoliciesCommand, GetRoleCommand } from '@aws-sdk/client-iam';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'live-aws-scanner' });
const tracer = new Tracer({ serviceName: 'live-aws-scanner' });
const metrics = new Metrics({ serviceName: 'live-aws-scanner', namespace: 'CloudBPA/LiveScan' });

// AWS Clients
const stsClient = new STSClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});

// Environment variables
const ANALYSES_TABLE = process.env.ANALYSES_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface LiveScanEvent {
  analysisId: string;
  tenantId: string;
  projectId: string;
  awsConfig: {
    region: string;
    accountId: string;
    roleArn: string;
    externalId?: string;
  };
  scanScope: {
    services: string[];
    regions: string[];
    resourceTypes?: string[];
  };
  frameworks: string[];
}

interface ScanResult {
  service: string;
  region: string;
  resourceType: string;
  resources: any[];
  scanTime: string;
  metadata: {
    resourceCount: number;
    errors: string[];
  };
}

interface AnalysisResult {
  analysisId: string;
  status: 'SCANNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  progress: number;
  scanResults: ScanResult[];
  summary: {
    totalResources: number;
    scannedServices: number;
    scannedRegions: number;
    errors: string[];
  };
  completedAt?: string;
}

export const handler: EventBridgeHandler<string, LiveScanEvent, void> = async (event) => {
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('live-aws-scanner');

  try {
    logger.appendKeys({
      eventId: event.id,
      analysisId: event.detail.analysisId,
      tenantId: event.detail.tenantId,
    });

    logger.info('Starting live AWS account scan', {
      analysisId: event.detail.analysisId,
      accountId: event.detail.awsConfig.accountId,
      services: event.detail.scanScope.services,
      regions: event.detail.scanScope.regions,
    });

    // Update analysis status to SCANNING
    await updateAnalysisStatus(event.detail.analysisId, 'SCANNING', 0);

    // Perform the live scan
    const result = await performLiveScan(event.detail);

    // Update analysis with results
    await updateAnalysisWithResults(event.detail.analysisId, result);

    // Publish scan completion event
    await publishScanEvent('Live Scan Completed', event.detail, result);

    metrics.addMetric('LiveScanCompleted', MetricUnit.Count, 1);
    metrics.addMetric('ResourcesScanned', MetricUnit.Count, result.summary.totalResources);

    logger.info('Live AWS account scan completed', {
      analysisId: event.detail.analysisId,
      status: result.status,
      totalResources: result.summary.totalResources,
      scannedServices: result.summary.scannedServices,
    });
  } catch (error) {
    logger.error('Live AWS account scan failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      analysisId: event.detail.analysisId,
    });

    // Update analysis status to FAILED
    await updateAnalysisStatus(event.detail.analysisId, 'FAILED', 0, [
      error instanceof Error ? error.message : 'Unknown scan error'
    ]);

    metrics.addMetric('LiveScanError', MetricUnit.Count, 1);
    throw error;
  } finally {
    subsegment?.close();
    metrics.publishStoredMetrics();
  }
};

async function performLiveScan(scanEvent: LiveScanEvent): Promise<AnalysisResult> {
  const { awsConfig, scanScope } = scanEvent;
  const scanResults: ScanResult[] = [];
  const errors: string[] = [];

  logger.info('Assuming AWS role for scanning', {
    roleArn: awsConfig.roleArn,
    accountId: awsConfig.accountId,
  });

  // Assume the target AWS role
  const credentials = await assumeTargetRole(awsConfig);

  let totalResources = 0;
  let currentProgress = 0;
  const totalSteps = scanScope.services.length * scanScope.regions.length;

  // Scan each service in each region
  for (const service of scanScope.services) {
    for (const region of scanScope.regions) {
      try {
        logger.info('Scanning service in region', { service, region });

        const serviceResult = await scanServiceInRegion(
          service,
          region,
          credentials,
          scanScope.resourceTypes
        );

        scanResults.push(serviceResult);
        totalResources += serviceResult.metadata.resourceCount;

        // Update progress
        currentProgress++;
        const progress = Math.round((currentProgress / totalSteps) * 100);
        await updateAnalysisStatus(scanEvent.analysisId, 'SCANNING', progress);

        metrics.addMetric(`${service}ResourcesScanned`, MetricUnit.Count, serviceResult.metadata.resourceCount);
      } catch (error) {
        const errorMessage = `Failed to scan ${service} in ${region}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMessage);
        logger.error('Service scan failed', { service, region, error: errorMessage });
      }
    }
  }

  const status = errors.length === 0 ? 'COMPLETED' : 
                 scanResults.length > 0 ? 'PARTIAL' : 'FAILED';

  return {
    analysisId: scanEvent.analysisId,
    status,
    progress: 100,
    scanResults,
    summary: {
      totalResources,
      scannedServices: new Set(scanResults.map(r => r.service)).size,
      scannedRegions: new Set(scanResults.map(r => r.region)).size,
      errors,
    },
    completedAt: new Date().toISOString(),
  };
}

async function assumeTargetRole(awsConfig: any): Promise<any> {
  const command = new AssumeRoleCommand({
    RoleArn: awsConfig.roleArn,
    RoleSessionName: `CloudBPA-LiveScan-${Date.now()}`,
    DurationSeconds: 3600, // 1 hour
    ExternalId: awsConfig.externalId,
  });

  const result = await stsClient.send(command);
  
  if (!result.Credentials) {
    throw new Error('Failed to assume AWS role - no credentials returned');
  }

  return {
    accessKeyId: result.Credentials.AccessKeyId!,
    secretAccessKey: result.Credentials.SecretAccessKey!,
    sessionToken: result.Credentials.SessionToken!,
  };
}

async function scanServiceInRegion(
  service: string,
  region: string,
  credentials: any,
  resourceTypes?: string[]
): Promise<ScanResult> {
  const scanTime = new Date().toISOString();
  const resources: any[] = [];
  const errors: string[] = [];

  try {
    switch (service.toLowerCase()) {
      case 'ec2':
        const ec2Resources = await scanEC2(region, credentials, resourceTypes);
        resources.push(...ec2Resources);
        break;

      case 's3':
        // S3 is global but we'll scan from the specified region
        if (region === 'us-east-1') { // Only scan S3 from us-east-1 to avoid duplicates
          const s3Resources = await scanS3(credentials, resourceTypes);
          resources.push(...s3Resources);
        }
        break;

      case 'lambda':
        const lambdaResources = await scanLambda(region, credentials, resourceTypes);
        resources.push(...lambdaResources);
        break;

      case 'rds':
        const rdsResources = await scanRDS(region, credentials, resourceTypes);
        resources.push(...rdsResources);
        break;

      case 'cloudformation':
        const cfnResources = await scanCloudFormation(region, credentials, resourceTypes);
        resources.push(...cfnResources);
        break;

      case 'iam':
        // IAM is global but we'll scan from the specified region
        if (region === 'us-east-1') { // Only scan IAM from us-east-1 to avoid duplicates
          const iamResources = await scanIAM(credentials, resourceTypes);
          resources.push(...iamResources);
        }
        break;

      case 'config':
        const configResources = await scanConfigService(region, credentials, resourceTypes);
        resources.push(...configResources);
        break;

      default:
        logger.warn('Unsupported service for scanning', { service });
    }
  } catch (error) {
    const errorMessage = `Error scanning ${service}: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMessage);
    logger.error('Service scan error', { service, region, error: errorMessage });
  }

  return {
    service,
    region,
    resourceType: service,
    resources,
    scanTime,
    metadata: {
      resourceCount: resources.length,
      errors,
    },
  };
}

async function scanEC2(region: string, credentials: any, resourceTypes?: string[]): Promise<any[]> {
  const ec2Client = new EC2Client({ region, credentials });
  const resources: any[] = [];

  // Scan EC2 instances
  if (!resourceTypes || resourceTypes.includes('AWS::EC2::Instance')) {
    const instancesResult = await ec2Client.send(new DescribeInstancesCommand({}));
    instancesResult.Reservations?.forEach(reservation => {
      reservation.Instances?.forEach(instance => {
        resources.push({
          resourceType: 'AWS::EC2::Instance',
          resourceId: instance.InstanceId,
          resourceName: instance.Tags?.find(tag => tag.Key === 'Name')?.Value,
          configuration: instance,
          region,
        });
      });
    });
  }

  // Scan Security Groups
  if (!resourceTypes || resourceTypes.includes('AWS::EC2::SecurityGroup')) {
    const sgResult = await ec2Client.send(new DescribeSecurityGroupsCommand({}));
    sgResult.SecurityGroups?.forEach(sg => {
      resources.push({
        resourceType: 'AWS::EC2::SecurityGroup',
        resourceId: sg.GroupId,
        resourceName: sg.GroupName,
        configuration: sg,
        region,
      });
    });
  }

  // Scan VPCs
  if (!resourceTypes || resourceTypes.includes('AWS::EC2::VPC')) {
    const vpcResult = await ec2Client.send(new DescribeVpcsCommand({}));
    vpcResult.Vpcs?.forEach(vpc => {
      resources.push({
        resourceType: 'AWS::EC2::VPC',
        resourceId: vpc.VpcId,
        resourceName: vpc.Tags?.find(tag => tag.Key === 'Name')?.Value,
        configuration: vpc,
        region,
      });
    });
  }

  return resources;
}

async function scanS3(credentials: any, resourceTypes?: string[]): Promise<any[]> {
  if (resourceTypes && !resourceTypes.includes('AWS::S3::Bucket')) {
    return [];
  }

  const s3Client = new S3Client({ region: 'us-east-1', credentials });
  const resources: any[] = [];

  const bucketsResult = await s3Client.send(new ListBucketsCommand({}));
  
  if (bucketsResult.Buckets) {
    for (const bucket of bucketsResult.Buckets) {
      const bucketName = bucket.Name!;
      
      try {
        // Get bucket encryption
        let encryption = null;
        try {
          const encryptionResult = await s3Client.send(
            new GetBucketEncryptionCommand({ Bucket: bucketName })
          );
          encryption = encryptionResult.ServerSideEncryptionConfiguration;
        } catch (error) {
          // Bucket might not have encryption configured
        }

        // Get bucket policy
        let policy = null;
        try {
          const policyResult = await s3Client.send(
            new GetBucketPolicyCommand({ Bucket: bucketName })
          );
          policy = policyResult.Policy;
        } catch (error) {
          // Bucket might not have a policy
        }

        resources.push({
          resourceType: 'AWS::S3::Bucket',
          resourceId: bucketName,
          resourceName: bucketName,
          configuration: {
            ...bucket,
            encryption,
            policy,
          },
          region: 'us-east-1', // S3 is global
        });
      } catch (error) {
        logger.warn('Failed to get bucket details', { bucketName, error });
      }
    }
  }

  return resources;
}

async function scanLambda(region: string, credentials: any, resourceTypes?: string[]): Promise<any[]> {
  if (resourceTypes && !resourceTypes.includes('AWS::Lambda::Function')) {
    return [];
  }

  const lambdaClient = new LambdaClient({ region, credentials });
  const resources: any[] = [];

  const functionsResult = await lambdaClient.send(new ListFunctionsCommand({}));
  
  if (functionsResult.Functions) {
    for (const func of functionsResult.Functions) {
      try {
        const functionDetails = await lambdaClient.send(
          new GetFunctionCommand({ FunctionName: func.FunctionName })
        );

        resources.push({
          resourceType: 'AWS::Lambda::Function',
          resourceId: func.FunctionArn,
          resourceName: func.FunctionName,
          configuration: {
            ...func,
            details: functionDetails,
          },
          region,
        });
      } catch (error) {
        logger.warn('Failed to get function details', { functionName: func.FunctionName, error });
      }
    }
  }

  return resources;
}

async function scanRDS(region: string, credentials: any, resourceTypes?: string[]): Promise<any[]> {
  const rdsClient = new RDSClient({ region, credentials });
  const resources: any[] = [];

  // Scan RDS instances
  if (!resourceTypes || resourceTypes.includes('AWS::RDS::DBInstance')) {
    const instancesResult = await rdsClient.send(new DescribeDBInstancesCommand({}));
    instancesResult.DBInstances?.forEach(instance => {
      resources.push({
        resourceType: 'AWS::RDS::DBInstance',
        resourceId: instance.DBInstanceArn,
        resourceName: instance.DBInstanceIdentifier,
        configuration: instance,
        region,
      });
    });
  }

  // Scan RDS clusters
  if (!resourceTypes || resourceTypes.includes('AWS::RDS::DBCluster')) {
    const clustersResult = await rdsClient.send(new DescribeDBClustersCommand({}));
    clustersResult.DBClusters?.forEach(cluster => {
      resources.push({
        resourceType: 'AWS::RDS::DBCluster',
        resourceId: cluster.DBClusterArn,
        resourceName: cluster.DBClusterIdentifier,
        configuration: cluster,
        region,
      });
    });
  }

  return resources;
}

async function scanCloudFormation(region: string, credentials: any, resourceTypes?: string[]): Promise<any[]> {
  if (resourceTypes && !resourceTypes.includes('AWS::CloudFormation::Stack')) {
    return [];
  }

  const cfnClient = new CloudFormationClient({ region, credentials });
  const resources: any[] = [];

  const stacksResult = await cfnClient.send(new ListStacksCommand({
    StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'ROLLBACK_COMPLETE'],
  }));

  if (stacksResult.StackSummaries) {
    for (const stack of stacksResult.StackSummaries) {
      try {
        const stackDetails = await cfnClient.send(
          new DescribeStacksCommand({ StackName: stack.StackName })
        );

        resources.push({
          resourceType: 'AWS::CloudFormation::Stack',
          resourceId: stack.StackId,
          resourceName: stack.StackName,
          configuration: {
            ...stack,
            details: stackDetails.Stacks?.[0],
          },
          region,
        });
      } catch (error) {
        logger.warn('Failed to get stack details', { stackName: stack.StackName, error });
      }
    }
  }

  return resources;
}

async function scanIAM(credentials: any, resourceTypes?: string[]): Promise<any[]> {
  const iamClient = new IAMClient({ credentials });
  const resources: any[] = [];

  // Scan IAM roles
  if (!resourceTypes || resourceTypes.includes('AWS::IAM::Role')) {
    const rolesResult = await iamClient.send(new ListRolesCommand({}));
    
    if (rolesResult.Roles) {
      for (const role of rolesResult.Roles) {
        try {
          const roleDetails = await iamClient.send(
            new GetRoleCommand({ RoleName: role.RoleName })
          );

          resources.push({
            resourceType: 'AWS::IAM::Role',
            resourceId: role.Arn,
            resourceName: role.RoleName,
            configuration: {
              ...role,
              details: roleDetails.Role,
            },
            region: 'us-east-1', // IAM is global
          });
        } catch (error) {
          logger.warn('Failed to get role details', { roleName: role.RoleName, error });
        }
      }
    }
  }

  // Scan IAM policies (managed policies only for performance)
  if (!resourceTypes || resourceTypes.includes('AWS::IAM::Policy')) {
    const policiesResult = await iamClient.send(new ListPoliciesCommand({
      Scope: 'Local', // Only customer-managed policies
      MaxItems: 100,
    }));

    policiesResult.Policies?.forEach(policy => {
      resources.push({
        resourceType: 'AWS::IAM::Policy',
        resourceId: policy.Arn,
        resourceName: policy.PolicyName,
        configuration: policy,
        region: 'us-east-1', // IAM is global
      });
    });
  }

  return resources;
}

async function scanConfigService(region: string, credentials: any, resourceTypes?: string[]): Promise<any[]> {
  const configClient = new ConfigServiceClient({ region, credentials });
  const resources: any[] = [];

  try {
    // Use AWS Config to get a comprehensive view of resources
    const configQuery = `
      SELECT 
        resourceType,
        resourceId,
        resourceName,
        configuration,
        configurationItemStatus
      WHERE 
        configurationItemStatus = 'OK'
      ${resourceTypes ? `AND resourceType IN (${resourceTypes.map(t => `'${t}'`).join(',')})` : ''}
      LIMIT 1000
    `;

    const result = await configClient.send(new SelectResourceConfigCommand({
      Expression: configQuery,
    }));

    if (result.Results) {
      result.Results.forEach(item => {
        try {
          const parsedItem = JSON.parse(item);
          resources.push({
            resourceType: parsedItem.resourceType,
            resourceId: parsedItem.resourceId,
            resourceName: parsedItem.resourceName,
            configuration: JSON.parse(parsedItem.configuration),
            region,
            source: 'AWS Config',
          });
        } catch (error) {
          logger.warn('Failed to parse Config result item', { error });
        }
      });
    }
  } catch (error) {
    logger.warn('AWS Config scan failed (Config may not be enabled)', { region, error });
  }

  return resources;
}

async function updateAnalysisStatus(
  analysisId: string,
  status: string,
  progress: number,
  errors?: string[]
): Promise<void> {
  const updateExpression = 'SET #status = :status, progress = :progress, updatedAt = :updatedAt';
  const expressionAttributeNames = { '#status': 'status' };
  const expressionAttributeValues: any = {
    ':status': status,
    ':progress': progress,
    ':updatedAt': new Date().toISOString(),
  };

  if (errors && errors.length > 0) {
    updateExpression.concat(', errors = :errors');
    expressionAttributeValues[':errors'] = errors;
  }

  await dynamoClient.send(
    new UpdateCommand({
      TableName: ANALYSES_TABLE,
      Key: { pk: `ANALYSIS#${analysisId}`, sk: '#METADATA' },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

async function updateAnalysisWithResults(
  analysisId: string,
  result: AnalysisResult
): Promise<void> {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: ANALYSES_TABLE,
      Key: { pk: `ANALYSIS#${analysisId}`, sk: '#METADATA' },
      UpdateExpression: 'SET #status = :status, progress = :progress, scanResults = :scanResults, summary = :summary, completedAt = :completedAt, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': result.status,
        ':progress': result.progress,
        ':scanResults': result.scanResults,
        ':summary': result.summary,
        ':completedAt': result.completedAt,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );
}

async function publishScanEvent(
  eventType: string,
  scanEvent: LiveScanEvent,
  result: AnalysisResult
): Promise<void> {
  const event = {
    Source: 'cloudbpa.livescan',
    DetailType: eventType,
    Detail: JSON.stringify({
      analysisId: scanEvent.analysisId,
      tenantId: scanEvent.tenantId,
      projectId: scanEvent.projectId,
      accountId: scanEvent.awsConfig.accountId,
      status: result.status,
      totalResources: result.summary.totalResources,
      scannedServices: result.summary.scannedServices,
      scannedRegions: result.summary.scannedRegions,
      errors: result.summary.errors,
      timestamp: new Date().toISOString(),
      environment: ENVIRONMENT,
    }),
    EventBusName: EVENT_BUS_NAME,
  };

  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [event],
    })
  );
}