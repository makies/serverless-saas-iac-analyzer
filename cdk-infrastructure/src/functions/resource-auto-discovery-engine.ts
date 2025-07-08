/**
 * Resource Auto-Discovery Engine
 * Automated resource discovery, tagging, and metadata enrichment
 */

import { ScheduledHandler } from 'aws-lambda';
import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVpcsCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVolumesCommand,
  DescribeSnapshotsCommand,
} from '@aws-sdk/client-ec2';
import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
  GetBucketPolicyCommand,
  GetBucketEncryptionCommand,
} from '@aws-sdk/client-s3';
import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
  DescribeDBSubnetGroupsCommand,
  DescribeDBParameterGroupsCommand,
} from '@aws-sdk/client-rds';
import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand,
  ListTagsCommand as ListLambdaTagsCommand,
} from '@aws-sdk/client-lambda';
import {
  IAMClient,
  ListRolesCommand,
  ListPoliciesCommand,
  ListUsersCommand,
  ListGroupsCommand,
  GetRolePolicyCommand,
  GetPolicyCommand,
} from '@aws-sdk/client-iam';
import {
  CloudFormationClient,
  ListStacksCommand,
  DescribeStacksCommand,
  DescribeStackResourcesCommand,
  ListStackResourcesCommand,
} from '@aws-sdk/client-cloudformation';
import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand,
  TagResourcesCommand,
} from '@aws-sdk/client-resource-groups-tagging-api';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cloud-bpa' });
const tracer = new Tracer({ serviceName: 'cloud-bpa' });
const metrics = new Metrics({ serviceName: 'cloud-bpa', namespace: 'CloudBPA/Discovery' });

// AWS Clients
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventBridgeClient = new EventBridgeClient({});
const stsClient = new STSClient({});
const resourceGroupsClient = new ResourceGroupsTaggingAPIClient({});

// Environment variables
const RESOURCE_INVENTORY_TABLE = process.env.RESOURCE_INVENTORY_TABLE!;
const DISCOVERY_SESSIONS_TABLE = process.env.DISCOVERY_SESSIONS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface DiscoveryConfiguration {
  tenantId: string;
  projectId: string;
  accounts: {
    accountId: string;
    regions: string[];
    roleArn?: string;
    discoveryScope: {
      includeServices: string[];
      excludeServices?: string[];
      includeResourceTypes?: string[];
      excludeResourceTypes?: string[];
      tagFilters?: Record<string, string>;
    };
  }[];
  schedule: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time?: string;
  };
  enrichment: {
    enableCostOptimization: boolean;
    enableSecurityAnalysis: boolean;
    enablePerformanceAnalysis: boolean;
    enableTagCompliance: boolean;
  };
}

interface DiscoveredResource {
  resourceId: string;
  resourceType: string;
  resourceName: string;
  resourceArn: string;
  accountId: string;
  region: string;
  service: string;
  configuration: any;
  tags: Record<string, string>;
  metadata: {
    discoveryTimestamp: string;
    lastSeen: string;
    discoverySession: string;
    costOptimization?: {
      rightsizingRecommendations: any[];
      costSavingsOpportunities: any[];
    };
    security?: {
      vulnerabilities: any[];
      complianceIssues: any[];
      securityScore: number;
    };
    performance?: {
      utilizationMetrics: any;
      performanceIssues: any[];
    };
    tagCompliance?: {
      requiredTags: string[];
      missingTags: string[];
      complianceScore: number;
    };
  };
}

interface DiscoverySession {
  sessionId: string;
  tenantId: string;
  projectId: string;
  startTime: string;
  endTime?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  configuration: DiscoveryConfiguration;
  statistics: {
    accountsScanned: number;
    regionsScanned: number;
    resourcesDiscovered: number;
    resourcesUpdated: number;
    errors: number;
  };
  errors: Array<{
    accountId: string;
    region: string;
    service: string;
    errorMessage: string;
    timestamp: string;
  }>;
}

/**
 * Scheduled resource discovery handler
 */
export const scheduledDiscoveryHandler: ScheduledHandler = async (event) => {
  logger.info('Scheduled resource discovery started', { event });

  try {
    // Get all active discovery configurations
    const configurations = await getActiveDiscoveryConfigurations();
    
    for (const config of configurations) {
      if (shouldRunDiscovery(config)) {
        await initiateDiscoverySession(config);
      }
    }

    metrics.addMetric('ScheduledDiscoveryExecuted', MetricUnit.Count, 1);
  } catch (error) {
    logger.error('Scheduled discovery failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    metrics.addMetric('ScheduledDiscoveryError', MetricUnit.Count, 1);
  }
};

/**
 * Manual resource discovery handler
 */
export const manualDiscoveryHandler = async (event: any) => {
  logger.info('Manual resource discovery started', { event });

  try {
    const configuration: DiscoveryConfiguration = event.configuration;
    const sessionId = await initiateDiscoverySession(configuration);
    
    return {
      sessionId,
      status: 'STARTED',
      message: 'Resource discovery initiated successfully',
    };
  } catch (error) {
    logger.error('Manual discovery failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

async function initiateDiscoverySession(configuration: DiscoveryConfiguration): Promise<string> {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const session: DiscoverySession = {
    sessionId,
    tenantId: configuration.tenantId,
    projectId: configuration.projectId,
    startTime: new Date().toISOString(),
    status: 'RUNNING',
    configuration,
    statistics: {
      accountsScanned: 0,
      regionsScanned: 0,
      resourcesDiscovered: 0,
      resourcesUpdated: 0,
      errors: 0,
    },
    errors: [],
  };

  // Store discovery session
  await storeDiscoverySession(session);

  // Start discovery process
  await performResourceDiscovery(session);

  return sessionId;
}

async function performResourceDiscovery(session: DiscoverySession): Promise<void> {
  logger.info('Starting resource discovery', {
    sessionId: session.sessionId,
    tenantId: session.tenantId,
    projectId: session.projectId,
  });

  try {
    for (const account of session.configuration.accounts) {
      session.statistics.accountsScanned++;
      
      for (const region of account.regions) {
        session.statistics.regionsScanned++;

        try {
          await discoverAccountRegionResources(session, account, region);
        } catch (error) {
          const errorInfo = {
            accountId: account.accountId,
            region,
            service: 'all',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          };
          
          session.errors.push(errorInfo);
          session.statistics.errors++;
          
          logger.error('Account region discovery failed', {
            sessionId: session.sessionId,
            accountId: account.accountId,
            region,
            error: errorInfo.errorMessage,
          });
        }
      }
    }

    // Complete discovery session
    session.status = session.statistics.errors > 0 ? 'COMPLETED' : 'COMPLETED';
    session.endTime = new Date().toISOString();
    
    await updateDiscoverySession(session);

    // Publish discovery completion event
    await publishDiscoveryEvent('Resource Discovery Completed', {
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      projectId: session.projectId,
      statistics: session.statistics,
    });

    metrics.addMetric('DiscoverySessionCompleted', MetricUnit.Count, 1);
    metrics.addMetric('ResourcesDiscovered', MetricUnit.Count, session.statistics.resourcesDiscovered);

    logger.info('Resource discovery completed', {
      sessionId: session.sessionId,
      statistics: session.statistics,
    });
  } catch (error) {
    session.status = 'FAILED';
    session.endTime = new Date().toISOString();
    await updateDiscoverySession(session);

    logger.error('Resource discovery failed', {
      sessionId: session.sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function discoverAccountRegionResources(
  session: DiscoverySession,
  account: any,
  region: string
): Promise<void> {
  let credentials: any = undefined;

  // Assume role if provided
  if (account.roleArn) {
    credentials = await assumeTargetRole(account.roleArn, region);
  }

  const includeServices = account.discoveryScope.includeServices;
  
  // Service-specific discovery
  if (includeServices.includes('EC2')) {
    await discoverEC2Resources(session, account.accountId, region, credentials);
  }
  
  if (includeServices.includes('S3')) {
    await discoverS3Resources(session, account.accountId, region, credentials);
  }
  
  if (includeServices.includes('RDS')) {
    await discoverRDSResources(session, account.accountId, region, credentials);
  }
  
  if (includeServices.includes('Lambda')) {
    await discoverLambdaResources(session, account.accountId, region, credentials);
  }
  
  if (includeServices.includes('IAM')) {
    await discoverIAMResources(session, account.accountId, region, credentials);
  }
  
  if (includeServices.includes('CloudFormation')) {
    await discoverCloudFormationResources(session, account.accountId, region, credentials);
  }

  // Generic resource discovery using Resource Groups API
  if (includeServices.includes('All') || includeServices.length === 0) {
    await discoverAllResources(session, account.accountId, region, account.discoveryScope, credentials);
  }
}

async function discoverEC2Resources(
  session: DiscoverySession,
  accountId: string,
  region: string,
  credentials?: any
): Promise<void> {
  const ec2Client = new EC2Client({ region, credentials });
  
  try {
    // Discover EC2 Instances
    const instancesResult = await ec2Client.send(new DescribeInstancesCommand({}));
    for (const reservation of instancesResult.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        const resource = await createDiscoveredResource(
          accountId,
          region,
          'AWS::EC2::Instance',
          instance.InstanceId!,
          instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId!,
          `arn:aws:ec2:${region}:${accountId}:instance/${instance.InstanceId}`,
          instance,
          instance.Tags || [],
          session
        );
        
        await storeDiscoveredResource(resource);
        session.statistics.resourcesDiscovered++;
      }
    }

    // Discover VPCs
    const vpcsResult = await ec2Client.send(new DescribeVpcsCommand({}));
    for (const vpc of vpcsResult.Vpcs || []) {
      const resource = await createDiscoveredResource(
        accountId,
        region,
        'AWS::EC2::VPC',
        vpc.VpcId!,
        vpc.Tags?.find(t => t.Key === 'Name')?.Value || vpc.VpcId!,
        `arn:aws:ec2:${region}:${accountId}:vpc/${vpc.VpcId}`,
        vpc,
        vpc.Tags || [],
        session
      );
      
      await storeDiscoveredResource(resource);
      session.statistics.resourcesDiscovered++;
    }

    // Discover Security Groups
    const sgResult = await ec2Client.send(new DescribeSecurityGroupsCommand({}));
    for (const sg of sgResult.SecurityGroups || []) {
      const resource = await createDiscoveredResource(
        accountId,
        region,
        'AWS::EC2::SecurityGroup',
        sg.GroupId!,
        sg.GroupName!,
        `arn:aws:ec2:${region}:${accountId}:security-group/${sg.GroupId}`,
        sg,
        sg.Tags || [],
        session
      );
      
      await storeDiscoveredResource(resource);
      session.statistics.resourcesDiscovered++;
    }

    logger.info('EC2 resource discovery completed', {
      sessionId: session.sessionId,
      accountId,
      region,
    });
  } catch (error) {
    logger.error('EC2 resource discovery failed', {
      sessionId: session.sessionId,
      accountId,
      region,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function discoverS3Resources(
  session: DiscoverySession,
  accountId: string,
  region: string,
  credentials?: any
): Promise<void> {
  const s3Client = new S3Client({ region, credentials });
  
  try {
    const bucketsResult = await s3Client.send(new ListBucketsCommand({}));
    
    for (const bucket of bucketsResult.Buckets || []) {
      try {
        // Get bucket location to check if it belongs to this region
        const locationResult = await s3Client.send(
          new GetBucketLocationCommand({ Bucket: bucket.Name! })
        );
        
        const bucketRegion = locationResult.LocationConstraint || 'us-east-1';
        if (bucketRegion !== region && !(region === 'us-east-1' && !locationResult.LocationConstraint)) {
          continue; // Skip buckets not in this region
        }

        // Get bucket tags
        let tags: any[] = [];
        try {
          const tagsResult = await s3Client.send(
            new GetBucketTaggingCommand({ Bucket: bucket.Name! })
          );
          tags = tagsResult.TagSet || [];
        } catch (error) {
          // Bucket might not have tags
        }

        const resource = await createDiscoveredResource(
          accountId,
          bucketRegion,
          'AWS::S3::Bucket',
          bucket.Name!,
          bucket.Name!,
          `arn:aws:s3:::${bucket.Name}`,
          bucket,
          tags,
          session
        );
        
        await storeDiscoveredResource(resource);
        session.statistics.resourcesDiscovered++;
      } catch (error) {
        logger.warn('Failed to process S3 bucket', {
          bucketName: bucket.Name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('S3 resource discovery completed', {
      sessionId: session.sessionId,
      accountId,
      region,
    });
  } catch (error) {
    logger.error('S3 resource discovery failed', {
      sessionId: session.sessionId,
      accountId,
      region,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function discoverRDSResources(
  session: DiscoverySession,
  accountId: string,
  region: string,
  credentials?: any
): Promise<void> {
  const rdsClient = new RDSClient({ region, credentials });
  
  try {
    // Discover RDS Instances
    const instancesResult = await rdsClient.send(new DescribeDBInstancesCommand({}));
    for (const instance of instancesResult.DBInstances || []) {
      const resource = await createDiscoveredResource(
        accountId,
        region,
        'AWS::RDS::DBInstance',
        instance.DBInstanceIdentifier!,
        instance.DBInstanceIdentifier!,
        instance.DBInstanceArn!,
        instance,
        instance.TagList || [],
        session
      );
      
      await storeDiscoveredResource(resource);
      session.statistics.resourcesDiscovered++;
    }

    // Discover RDS Clusters
    const clustersResult = await rdsClient.send(new DescribeDBClustersCommand({}));
    for (const cluster of clustersResult.DBClusters || []) {
      const resource = await createDiscoveredResource(
        accountId,
        region,
        'AWS::RDS::DBCluster',
        cluster.DBClusterIdentifier!,
        cluster.DBClusterIdentifier!,
        cluster.DBClusterArn!,
        cluster,
        cluster.TagList || [],
        session
      );
      
      await storeDiscoveredResource(resource);
      session.statistics.resourcesDiscovered++;
    }

    logger.info('RDS resource discovery completed', {
      sessionId: session.sessionId,
      accountId,
      region,
    });
  } catch (error) {
    logger.error('RDS resource discovery failed', {
      sessionId: session.sessionId,
      accountId,
      region,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function discoverLambdaResources(
  session: DiscoverySession,
  accountId: string,
  region: string,
  credentials?: any
): Promise<void> {
  const lambdaClient = new LambdaClient({ region, credentials });
  
  try {
    const functionsResult = await lambdaClient.send(new ListFunctionsCommand({}));
    
    for (const func of functionsResult.Functions || []) {
      try {
        // Get function details
        const functionResult = await lambdaClient.send(
          new GetFunctionCommand({ FunctionName: func.FunctionName! })
        );

        // Get function tags
        const tagsResult = await lambdaClient.send(
          new ListLambdaTagsCommand({ Resource: func.FunctionArn! })
        );

        const tags = Object.entries(tagsResult.Tags || {}).map(([key, value]) => ({
          Key: key,
          Value: value,
        }));

        const resource = await createDiscoveredResource(
          accountId,
          region,
          'AWS::Lambda::Function',
          func.FunctionName!,
          func.FunctionName!,
          func.FunctionArn!,
          functionResult,
          tags,
          session
        );
        
        await storeDiscoveredResource(resource);
        session.statistics.resourcesDiscovered++;
      } catch (error) {
        logger.warn('Failed to process Lambda function', {
          functionName: func.FunctionName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Lambda resource discovery completed', {
      sessionId: session.sessionId,
      accountId,
      region,
    });
  } catch (error) {
    logger.error('Lambda resource discovery failed', {
      sessionId: session.sessionId,
      accountId,
      region,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function discoverIAMResources(
  session: DiscoverySession,
  accountId: string,
  region: string,
  credentials?: any
): Promise<void> {
  // IAM is global, only discover from us-east-1
  if (region !== 'us-east-1') return;

  const iamClient = new IAMClient({ region: 'us-east-1', credentials });
  
  try {
    // Discover IAM Roles
    const rolesResult = await iamClient.send(new ListRolesCommand({}));
    for (const role of rolesResult.Roles || []) {
      const resource = await createDiscoveredResource(
        accountId,
        'us-east-1',
        'AWS::IAM::Role',
        role.RoleName!,
        role.RoleName!,
        role.Arn!,
        role,
        role.Tags || [],
        session
      );
      
      await storeDiscoveredResource(resource);
      session.statistics.resourcesDiscovered++;
    }

    // Discover IAM Policies
    const policiesResult = await iamClient.send(
      new ListPoliciesCommand({ Scope: 'Local' }) // Only customer managed policies
    );
    for (const policy of policiesResult.Policies || []) {
      const resource = await createDiscoveredResource(
        accountId,
        'us-east-1',
        'AWS::IAM::Policy',
        policy.PolicyName!,
        policy.PolicyName!,
        policy.Arn!,
        policy,
        policy.Tags || [],
        session
      );
      
      await storeDiscoveredResource(resource);
      session.statistics.resourcesDiscovered++;
    }

    logger.info('IAM resource discovery completed', {
      sessionId: session.sessionId,
      accountId,
      region,
    });
  } catch (error) {
    logger.error('IAM resource discovery failed', {
      sessionId: session.sessionId,
      accountId,
      region,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function discoverCloudFormationResources(
  session: DiscoverySession,
  accountId: string,
  region: string,
  credentials?: any
): Promise<void> {
  const cfnClient = new CloudFormationClient({ region, credentials });
  
  try {
    const stacksResult = await cfnClient.send(new ListStacksCommand({
      StackStatusFilter: [
        'CREATE_COMPLETE',
        'UPDATE_COMPLETE',
        'UPDATE_ROLLBACK_COMPLETE',
      ],
    }));
    
    for (const stack of stacksResult.StackSummaries || []) {
      try {
        const stackDetails = await cfnClient.send(
          new DescribeStacksCommand({ StackName: stack.StackName! })
        );

        const stackInfo = stackDetails.Stacks?.[0];
        if (!stackInfo) continue;

        const resource = await createDiscoveredResource(
          accountId,
          region,
          'AWS::CloudFormation::Stack',
          stack.StackName!,
          stack.StackName!,
          stack.StackId!,
          stackInfo,
          stackInfo.Tags || [],
          session
        );
        
        await storeDiscoveredResource(resource);
        session.statistics.resourcesDiscovered++;
      } catch (error) {
        logger.warn('Failed to process CloudFormation stack', {
          stackName: stack.StackName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('CloudFormation resource discovery completed', {
      sessionId: session.sessionId,
      accountId,
      region,
    });
  } catch (error) {
    logger.error('CloudFormation resource discovery failed', {
      sessionId: session.sessionId,
      accountId,
      region,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function discoverAllResources(
  session: DiscoverySession,
  accountId: string,
  region: string,
  discoveryScope: any,
  credentials?: any
): Promise<void> {
  const resourceGroupsClient = new ResourceGroupsTaggingAPIClient({ region, credentials });
  
  try {
    let paginationToken: string | undefined;
    
    do {
      const resourcesResult = await resourceGroupsClient.send(
        new GetResourcesCommand({
          PaginationToken: paginationToken,
          ResourcesPerPage: 100,
          ResourceTypeFilters: discoveryScope.includeResourceTypes,
          TagFilters: discoveryScope.tagFilters ? Object.entries(discoveryScope.tagFilters).map(([key, value]) => ({
            Key: key,
            Values: [String(value)],
          })) : undefined,
        })
      );

      for (const resource of resourcesResult.ResourceTagMappingList || []) {
        try {
          const resourceType = extractResourceTypeFromArn(resource.ResourceARN!);
          const resourceId = extractResourceIdFromArn(resource.ResourceARN!);
          const resourceName = resource.Tags?.find(t => t.Key === 'Name')?.Value || resourceId;

          const discoveredResource = await createDiscoveredResource(
            accountId,
            region,
            resourceType,
            resourceId,
            resourceName,
            resource.ResourceARN!,
            resource,
            resource.Tags || [],
            session
          );
          
          await storeDiscoveredResource(discoveredResource);
          session.statistics.resourcesDiscovered++;
        } catch (error) {
          logger.warn('Failed to process generic resource', {
            resourceArn: resource.ResourceARN,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      paginationToken = resourcesResult.PaginationToken;
    } while (paginationToken);

    logger.info('Generic resource discovery completed', {
      sessionId: session.sessionId,
      accountId,
      region,
    });
  } catch (error) {
    logger.error('Generic resource discovery failed', {
      sessionId: session.sessionId,
      accountId,
      region,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function createDiscoveredResource(
  accountId: string,
  region: string,
  resourceType: string,
  resourceId: string,
  resourceName: string,
  resourceArn: string,
  configuration: any,
  tags: any[],
  session: DiscoverySession
): Promise<DiscoveredResource> {
  const now = new Date().toISOString();
  const service = resourceType.split('::')[1];

  const tagsObject = tags.reduce((acc, tag) => {
    acc[tag.Key || tag.key] = tag.Value || tag.value;
    return acc;
  }, {} as Record<string, string>);

  const resource: DiscoveredResource = {
    resourceId,
    resourceType,
    resourceName,
    resourceArn,
    accountId,
    region,
    service,
    configuration,
    tags: tagsObject,
    metadata: {
      discoveryTimestamp: now,
      lastSeen: now,
      discoverySession: session.sessionId,
    },
  };

  // Add enrichment data if enabled
  if (session.configuration.enrichment.enableCostOptimization) {
    resource.metadata.costOptimization = await enrichWithCostData(resource);
  }

  if (session.configuration.enrichment.enableSecurityAnalysis) {
    resource.metadata.security = await enrichWithSecurityData(resource);
  }

  if (session.configuration.enrichment.enablePerformanceAnalysis) {
    resource.metadata.performance = await enrichWithPerformanceData(resource);
  }

  if (session.configuration.enrichment.enableTagCompliance) {
    resource.metadata.tagCompliance = await enrichWithTagCompliance(resource);
  }

  return resource;
}

// Helper functions
async function assumeTargetRole(roleArn: string, region: string): Promise<any> {
  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `CloudBPA-Discovery-${Date.now()}`,
    DurationSeconds: 3600,
  });

  const response = await stsClient.send(command);
  
  return {
    accessKeyId: response.Credentials!.AccessKeyId!,
    secretAccessKey: response.Credentials!.SecretAccessKey!,
    sessionToken: response.Credentials!.SessionToken!,
  };
}

function extractResourceTypeFromArn(arn: string): string {
  const parts = arn.split(':');
  if (parts.length >= 3) {
    const service = parts[2];
    const resourcePart = parts[5] || parts[4];
    const resourceType = resourcePart.split('/')[0] || resourcePart;
    return `AWS::${service.toUpperCase()}::${resourceType}`;
  }
  return 'Unknown';
}

function extractResourceIdFromArn(arn: string): string {
  const parts = arn.split(':');
  const resourcePart = parts[5] || parts[4];
  const resourceParts = resourcePart.split('/');
  return resourceParts[resourceParts.length - 1] || resourcePart;
}

async function getActiveDiscoveryConfigurations(): Promise<DiscoveryConfiguration[]> {
  // Implementation to get active discovery configurations from DynamoDB
  return [];
}

function shouldRunDiscovery(config: DiscoveryConfiguration): boolean {
  if (!config.schedule.enabled) return false;
  
  // Implementation to check if discovery should run based on schedule
  return true;
}

async function storeDiscoverySession(session: DiscoverySession): Promise<void> {
  await dynamoClient.send(
    new PutCommand({
      TableName: DISCOVERY_SESSIONS_TABLE,
      Item: {
        pk: `TENANT#${session.tenantId}`,
        sk: `SESSION#${session.sessionId}`,
        ...session,
      },
    })
  );
}

async function updateDiscoverySession(session: DiscoverySession): Promise<void> {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: DISCOVERY_SESSIONS_TABLE,
      Key: {
        pk: `TENANT#${session.tenantId}`,
        sk: `SESSION#${session.sessionId}`,
      },
      UpdateExpression: 'SET #status = :status, #endTime = :endTime, #statistics = :statistics, #errors = :errors',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#endTime': 'endTime',
        '#statistics': 'statistics',
        '#errors': 'errors',
      },
      ExpressionAttributeValues: {
        ':status': session.status,
        ':endTime': session.endTime,
        ':statistics': session.statistics,
        ':errors': session.errors,
      },
    })
  );
}

async function storeDiscoveredResource(resource: DiscoveredResource): Promise<void> {
  await dynamoClient.send(
    new PutCommand({
      TableName: RESOURCE_INVENTORY_TABLE,
      Item: {
        pk: `ACCOUNT#${resource.accountId}`,
        sk: `RESOURCE#${resource.resourceType}#${resource.resourceId}`,
        gsi1pk: `TENANT#${resource.metadata.discoverySession}`, // For tenant-based queries
        gsi1sk: `${resource.resourceType}#${resource.region}`,
        ...resource,
      },
    })
  );
}

async function publishDiscoveryEvent(eventType: string, eventData: any): Promise<void> {
  try {
    const event = {
      Source: 'cloudbpa.discovery',
      DetailType: eventType,
      Detail: JSON.stringify({
        ...eventData,
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
  } catch (error) {
    logger.error('Failed to publish discovery event', { eventType, eventData, error });
  }
}

// Enrichment functions (placeholder implementations)
async function enrichWithCostData(resource: DiscoveredResource): Promise<any> {
  return {
    rightsizingRecommendations: [],
    costSavingsOpportunities: [],
  };
}

async function enrichWithSecurityData(resource: DiscoveredResource): Promise<any> {
  return {
    vulnerabilities: [],
    complianceIssues: [],
    securityScore: 85,
  };
}

async function enrichWithPerformanceData(resource: DiscoveredResource): Promise<any> {
  return {
    utilizationMetrics: {},
    performanceIssues: [],
  };
}

async function enrichWithTagCompliance(resource: DiscoveredResource): Promise<any> {
  const requiredTags = ['Environment', 'Project', 'Owner', 'CostCenter'];
  const existingTags = Object.keys(resource.tags);
  const missingTags = requiredTags.filter(tag => !existingTags.includes(tag));
  
  return {
    requiredTags,
    missingTags,
    complianceScore: ((requiredTags.length - missingTags.length) / requiredTags.length) * 100,
  };
}