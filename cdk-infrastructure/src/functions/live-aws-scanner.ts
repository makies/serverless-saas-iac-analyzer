/**
 * Live AWS Account Scanner Lambda Function
 * Performs real-time scanning of AWS resources across multiple services and regions
 * Supports Well-Architected, Security Hub, and custom framework analysis
 */

import { EventBridgeHandler } from 'aws-lambda';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { ConfigServiceClient, SelectResourceConfigCommand } from '@aws-sdk/client-config-service';
import { ECSClient, ListClustersCommand, DescribeClustersCommand, ListServicesCommand, DescribeServicesCommand, ListTaskDefinitionsCommand, DescribeTaskDefinitionCommand } from '@aws-sdk/client-ecs';
import { EC2Client, DescribeSecurityGroupsCommand, DescribeVpcsCommand, DescribeSubnetsCommand } from '@aws-sdk/client-ec2';
import { S3Client, ListBucketsCommand, GetBucketEncryptionCommand, GetBucketPolicyCommand } from '@aws-sdk/client-s3';
import { LambdaClient, ListFunctionsCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { RDSClient, DescribeDBInstancesCommand, DescribeDBClustersCommand } from '@aws-sdk/client-rds';
import { CloudFormationClient, ListStacksCommand, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { IAMClient, ListRolesCommand, ListPoliciesCommand, GetRoleCommand } from '@aws-sdk/client-iam';
import { OrganizationsClient, DescribeOrganizationCommand, DescribeAccountCommand, ListAccountsCommand, ListRootsCommand, ListOrganizationalUnitsForParentCommand, ListPoliciesCommand as ListOrgPoliciesCommand, DescribePolicyCommand } from '@aws-sdk/client-organizations';
import { SupportClient, DescribeSeverityLevelsCommand, DescribeTrustedAdvisorChecksCommand, DescribeCasesCommand } from '@aws-sdk/client-support';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

// PowerTools setup
const logger = new Logger({ serviceName: 'cloud-bpa' });
const tracer = new Tracer({ serviceName: 'cloud-bpa' });
const metrics = new Metrics({ serviceName: 'cloud-bpa', namespace: 'CloudBPA/LiveScan' });

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
      case 'ecs':
        const ecsResources = await scanECS(region, credentials, resourceTypes);
        resources.push(...ecsResources);
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

      case 'organizations':
        // Organizations is global but we'll scan from the specified region
        if (region === 'us-east-1') { // Only scan Organizations from us-east-1 to avoid duplicates
          const orgResources = await scanOrganizations(credentials, resourceTypes);
          resources.push(...orgResources);
        }
        break;

      case 'support':
        // Support is global but we'll scan from the specified region
        if (region === 'us-east-1') { // Only scan Support from us-east-1 to avoid duplicates
          const supportResources = await scanSupport(credentials, resourceTypes);
          resources.push(...supportResources);
        }
        break;

      case 'ec2':
        // Moved to Phase 2 - keeping for future reference
        logger.info('EC2 scanning moved to Phase 2', { service });
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

async function scanECS(region: string, credentials: any, resourceTypes?: string[]): Promise<any[]> {
  const ecsClient = new ECSClient({ region, credentials });
  const resources: any[] = [];

  // Scan ECS Clusters
  if (!resourceTypes || resourceTypes.includes('AWS::ECS::Cluster')) {
    const clustersResult = await ecsClient.send(new ListClustersCommand({}));
    
    if (clustersResult.clusterArns && clustersResult.clusterArns.length > 0) {
      const clusterDetails = await ecsClient.send(new DescribeClustersCommand({
        clusters: clustersResult.clusterArns,
        include: ['CONFIGURATIONS', 'TAGS', 'CAPACITY_PROVIDERS', 'INSIGHTS']
      }));

      clusterDetails.clusters?.forEach(cluster => {
        resources.push({
          resourceType: 'AWS::ECS::Cluster',
          resourceId: cluster.clusterArn,
          resourceName: cluster.clusterName,
          configuration: {
            ...cluster,
            insights: cluster.configuration?.executeCommandConfiguration,
            capacityProviders: cluster.capacityProviders,
            defaultCapacityProviderStrategy: cluster.defaultCapacityProviderStrategy,
          },
          region,
        });
      });
    }
  }

  // Scan ECS Services
  if (!resourceTypes || resourceTypes.includes('AWS::ECS::Service')) {
    const clustersResult = await ecsClient.send(new ListClustersCommand({}));
    
    if (clustersResult.clusterArns) {
      for (const clusterArn of clustersResult.clusterArns) {
        try {
          const servicesResult = await ecsClient.send(new ListServicesCommand({
            cluster: clusterArn,
          }));

          if (servicesResult.serviceArns && servicesResult.serviceArns.length > 0) {
            const serviceDetails = await ecsClient.send(new DescribeServicesCommand({
              cluster: clusterArn,
              services: servicesResult.serviceArns,
              include: ['TAGS']
            }));

            serviceDetails.services?.forEach(service => {
              resources.push({
                resourceType: 'AWS::ECS::Service',
                resourceId: service.serviceArn,
                resourceName: service.serviceName,
                configuration: {
                  ...service,
                  cluster: clusterArn,
                  taskDefinition: service.taskDefinition,
                  desiredCount: service.desiredCount,
                  runningCount: service.runningCount,
                  pendingCount: service.pendingCount,
                  launchType: service.launchType,
                  platformVersion: service.platformVersion,
                  networkConfiguration: service.networkConfiguration,
                  loadBalancers: service.loadBalancers,
                  serviceRegistries: service.serviceRegistries,
                  autoScaling: service.deploymentConfiguration,
                },
                region,
              });
            });
          }
        } catch (error) {
          logger.warn('Failed to scan services for cluster', { clusterArn, error });
        }
      }
    }
  }

  // Scan Task Definitions
  if (!resourceTypes || resourceTypes.includes('AWS::ECS::TaskDefinition')) {
    const taskDefinitionsResult = await ecsClient.send(new ListTaskDefinitionsCommand({
      status: 'ACTIVE',
      maxResults: 100, // Limit to avoid overwhelming
    }));

    if (taskDefinitionsResult.taskDefinitionArns) {
      for (const taskDefArn of taskDefinitionsResult.taskDefinitionArns) {
        try {
          const taskDefDetails = await ecsClient.send(new DescribeTaskDefinitionCommand({
            taskDefinition: taskDefArn,
            include: ['TAGS']
          }));

          if (taskDefDetails.taskDefinition) {
            const taskDef = taskDefDetails.taskDefinition;
            resources.push({
              resourceType: 'AWS::ECS::TaskDefinition',
              resourceId: taskDef.taskDefinitionArn,
              resourceName: `${taskDef.family}:${taskDef.revision}`,
              configuration: {
                ...taskDef,
                security: {
                  executionRoleArn: taskDef.executionRoleArn,
                  taskRoleArn: taskDef.taskRoleArn,
                  networkMode: taskDef.networkMode,
                  requiresCompatibilities: taskDef.requiresCompatibilities,
                },
                resources: {
                  cpu: taskDef.cpu,
                  memory: taskDef.memory,
                },
                containerDefinitions: taskDef.containerDefinitions?.map(container => ({
                  name: container.name,
                  image: container.image,
                  cpu: container.cpu,
                  memory: container.memory,
                  memoryReservation: container.memoryReservation,
                  essential: container.essential,
                  portMappings: container.portMappings,
                  environment: container.environment,
                  secrets: container.secrets,
                  mountPoints: container.mountPoints,
                  volumesFrom: container.volumesFrom,
                  logConfiguration: container.logConfiguration,
                  healthCheck: container.healthCheck,
                  systemControls: container.systemControls,
                  resourceRequirements: container.resourceRequirements,
                  firelensConfiguration: container.firelensConfiguration,
                  user: container.user,
                  workingDirectory: container.workingDirectory,
                  disableNetworking: container.disableNetworking,
                  privileged: container.privileged,
                  readonlyRootFilesystem: container.readonlyRootFilesystem,
                  dnsServers: container.dnsServers,
                  dnsSearchDomains: container.dnsSearchDomains,
                  extraHosts: container.extraHosts,
                  dockerSecurityOptions: container.dockerSecurityOptions,
                  interactive: container.interactive,
                  pseudoTerminal: container.pseudoTerminal,
                  dockerLabels: container.dockerLabels,
                  ulimits: container.ulimits,
                  startTimeout: container.startTimeout,
                  stopTimeout: container.stopTimeout,
                })),
                volumes: taskDef.volumes,
                placementConstraints: taskDef.placementConstraints,
                requiresAttributes: taskDef.requiresAttributes,
                pidMode: taskDef.pidMode,
                ipcMode: taskDef.ipcMode,
                proxyConfiguration: taskDef.proxyConfiguration,
                inferenceAccelerators: taskDef.inferenceAccelerators,
                ephemeralStorage: taskDef.ephemeralStorage,
                runtimePlatform: taskDef.runtimePlatform,
              },
              region,
            });
          }
        } catch (error) {
          logger.warn('Failed to get task definition details', { taskDefArn, error });
        }
      }
    }
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

async function scanOrganizations(credentials: any, resourceTypes?: string[]): Promise<any[]> {
  const orgClient = new OrganizationsClient({ credentials });
  const resources: any[] = [];

  try {
    // Scan Organization information
    if (!resourceTypes || resourceTypes.includes('AWS::Organizations::Organization')) {
      try {
        const orgResult = await orgClient.send(new DescribeOrganizationCommand({}));
        
        if (orgResult.Organization) {
          const org = orgResult.Organization;
          resources.push({
            resourceType: 'AWS::Organizations::Organization',
            resourceId: org.Id,
            resourceName: 'Organization',
            configuration: {
              ...org,
              featureSet: org.FeatureSet,
              masterAccountId: org.MasterAccountId,
              masterAccountEmail: org.MasterAccountEmail,
              availablePolicyTypes: org.AvailablePolicyTypes,
            },
            region: 'us-east-1', // Organizations is global
          });
        }
      } catch (error) {
        logger.warn('Failed to describe organization (account may not be in an organization)', { error });
      }
    }

    // Scan Organization Accounts
    if (!resourceTypes || resourceTypes.includes('AWS::Organizations::Account')) {
      try {
        const accountsResult = await orgClient.send(new ListAccountsCommand({}));
        
        if (accountsResult.Accounts) {
          for (const account of accountsResult.Accounts) {
            try {
              // Get detailed account information
              const accountDetails = await orgClient.send(new DescribeAccountCommand({
                AccountId: account.Id,
              }));

              resources.push({
                resourceType: 'AWS::Organizations::Account',
                resourceId: account.Id,
                resourceName: account.Name,
                configuration: {
                  ...account,
                  details: accountDetails.Account,
                  status: account.Status,
                  joinedMethod: account.JoinedMethod,
                  joinedTimestamp: account.JoinedTimestamp,
                },
                region: 'us-east-1', // Organizations is global
              });
            } catch (error) {
              logger.warn('Failed to get account details', { accountId: account.Id, error });
              // Add basic account info even if detailed info fails
              resources.push({
                resourceType: 'AWS::Organizations::Account',
                resourceId: account.Id,
                resourceName: account.Name,
                configuration: account,
                region: 'us-east-1',
              });
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to list organization accounts', { error });
      }
    }

    // Scan Organizational Units
    if (!resourceTypes || resourceTypes.includes('AWS::Organizations::OrganizationalUnit')) {
      try {
        const rootsResult = await orgClient.send(new ListRootsCommand({}));
        
        if (rootsResult.Roots) {
          for (const root of rootsResult.Roots) {
            // Add root as a resource
            resources.push({
              resourceType: 'AWS::Organizations::Root',
              resourceId: root.Id,
              resourceName: root.Name,
              configuration: {
                ...root,
                type: 'ROOT',
                policyTypes: root.PolicyTypes,
              },
              region: 'us-east-1',
            });

            // Recursively scan OUs under this root
            await scanOrganizationalUnits(orgClient, root.Id!, resources);
          }
        }
      } catch (error) {
        logger.warn('Failed to list organization roots', { error });
      }
    }

    // Scan Service Control Policies
    if (!resourceTypes || resourceTypes.includes('AWS::Organizations::Policy')) {
      try {
        const policiesResult = await orgClient.send(new ListOrgPoliciesCommand({
          Filter: 'SERVICE_CONTROL_POLICY',
        }));
        
        if (policiesResult.Policies) {
          for (const policy of policiesResult.Policies) {
            try {
              const policyDetails = await orgClient.send(new DescribePolicyCommand({
                PolicyId: policy.Id,
              }));

              resources.push({
                resourceType: 'AWS::Organizations::Policy',
                resourceId: policy.Id,
                resourceName: policy.Name,
                configuration: {
                  ...policy,
                  details: policyDetails.Policy,
                  content: policyDetails.Policy?.Content,
                  type: policy.Type,
                  awsManaged: policy.AwsManaged,
                },
                region: 'us-east-1',
              });
            } catch (error) {
              logger.warn('Failed to get policy details', { policyId: policy.Id, error });
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to list organization policies', { error });
      }
    }

  } catch (error) {
    logger.error('Organizations scan failed', { error });
  }

  return resources;
}

async function scanOrganizationalUnits(orgClient: OrganizationsClient, parentId: string, resources: any[]): Promise<void> {
  try {
    const ousResult = await orgClient.send(new ListOrganizationalUnitsForParentCommand({
      ParentId: parentId,
    }));

    if (ousResult.OrganizationalUnits) {
      for (const ou of ousResult.OrganizationalUnits) {
        resources.push({
          resourceType: 'AWS::Organizations::OrganizationalUnit',
          resourceId: ou.Id,
          resourceName: ou.Name,
          configuration: {
            ...ou,
            parentId,
            type: 'ORGANIZATIONAL_UNIT',
          },
          region: 'us-east-1',
        });

        // Recursively scan child OUs
        if (ou.Id) {
          await scanOrganizationalUnits(orgClient, ou.Id, resources);
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to list organizational units', { parentId, error });
  }
}

async function scanSupport(credentials: any, resourceTypes?: string[]): Promise<any[]> {
  const supportClient = new SupportClient({ credentials });
  const resources: any[] = [];

  try {
    // Scan Support Plan information by checking access to premium features
    if (!resourceTypes || resourceTypes.includes('AWS::Support::Plan')) {
      try {
        // Try to access Trusted Advisor checks - only available with Business/Enterprise support
        const checksResult = await supportClient.send(new DescribeTrustedAdvisorChecksCommand({
          language: 'en',
        }));
        
        if (checksResult.checks && checksResult.checks.length > 0) {
          // Business or Enterprise support plan detected
          let supportLevel = 'Business';
          
          // Check for Enterprise-specific features by testing severity levels
          try {
            const severityResult = await supportClient.send(new DescribeSeverityLevelsCommand({
              language: 'en',
            }));
            
            // Enterprise plans typically have more severity levels and faster response times
            if (severityResult.severityLevels && severityResult.severityLevels.length >= 4) {
              const hasEnterprise = severityResult.severityLevels.some(level => 
                level.name?.toLowerCase().includes('critical') && 
                level.name?.toLowerCase().includes('urgent')
              );
              if (hasEnterprise) {
                supportLevel = 'Enterprise';
              }
            }
          } catch (severityError) {
            // If we can't get severity levels, stick with Business plan detection
            logger.debug('Could not determine enterprise features', { error: severityError });
          }

          resources.push({
            resourceType: 'AWS::Support::Plan',
            resourceId: 'support-plan',
            resourceName: `${supportLevel} Support Plan`,
            configuration: {
              planName: supportLevel,
              planType: supportLevel.toUpperCase(),
              trustedAdvisorAccess: true,
              caseManagementAccess: true,
              checksAvailable: checksResult.checks.length,
              features: {
                trustedAdvisor: true,
                caseManagement: true,
                phoneSupport: supportLevel === 'Enterprise',
                chatSupport: true,
                architecturalGuidance: supportLevel === 'Enterprise',
                infrastructureEventManagement: supportLevel === 'Enterprise',
              },
            },
            region: 'us-east-1', // Support is global
          });

          // Get some sample Trusted Advisor check status for additional context
          try {
            const sampleChecks = checksResult.checks.slice(0, 5); // Get first 5 checks
            for (const check of sampleChecks) {
              // Note: We're not calling DescribeTrustedAdvisorCheckResult to avoid permissions issues
              // Just documenting that the check exists
              resources.push({
                resourceType: 'AWS::Support::TrustedAdvisorCheck',
                resourceId: check.id,
                resourceName: check.name,
                configuration: {
                  ...check,
                  category: check.category,
                  description: check.description,
                  metadata: check.metadata,
                },
                region: 'us-east-1',
              });
            }
          } catch (checkError) {
            logger.debug('Could not retrieve Trusted Advisor check details', { error: checkError });
          }
        }
      } catch (trustedAdvisorError) {
        // If Trusted Advisor is not accessible, likely Basic or Developer support
        logger.debug('Trusted Advisor not accessible, checking for basic support', { error: trustedAdvisorError });
        
        try {
          // Try to create a test case to determine support level
          // Note: We won't actually create a case, just check permissions
          const casesResult = await supportClient.send(new DescribeCasesCommand({
            maxResults: 1,
          }));
          
          // If we can list cases, at least Developer support is enabled
          resources.push({
            resourceType: 'AWS::Support::Plan',
            resourceId: 'support-plan',
            resourceName: 'Developer Support Plan',
            configuration: {
              planName: 'Developer',
              planType: 'DEVELOPER',
              trustedAdvisorAccess: false,
              caseManagementAccess: true,
              checksAvailable: 0,
              features: {
                trustedAdvisor: false,
                caseManagement: true,
                phoneSupport: false,
                chatSupport: false,
                architecturalGuidance: false,
                infrastructureEventManagement: false,
              },
            },
            region: 'us-east-1',
          });
        } catch (caseError) {
          // If we can't access cases either, likely Basic support
          resources.push({
            resourceType: 'AWS::Support::Plan',
            resourceId: 'support-plan',
            resourceName: 'Basic Support Plan',
            configuration: {
              planName: 'Basic',
              planType: 'BASIC',
              trustedAdvisorAccess: false,
              caseManagementAccess: false,
              checksAvailable: 0,
              features: {
                trustedAdvisor: false,
                caseManagement: false,
                phoneSupport: false,
                chatSupport: false,
                architecturalGuidance: false,
                infrastructureEventManagement: false,
              },
            },
            region: 'us-east-1',
          });
        }
      }
    }

  } catch (error) {
    logger.error('Support scan failed', { error });
    // Even if the scan fails, we can indicate that we couldn't determine the support plan
    resources.push({
      resourceType: 'AWS::Support::Plan',
      resourceId: 'support-plan',
      resourceName: 'Unknown Support Plan',
      configuration: {
        planName: 'Unknown',
        planType: 'UNKNOWN',
        trustedAdvisorAccess: false,
        caseManagementAccess: false,
        checksAvailable: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        features: {
          trustedAdvisor: false,
          caseManagement: false,
          phoneSupport: false,
          chatSupport: false,
          architecturalGuidance: false,
          infrastructureEventManagement: false,
        },
      },
      region: 'us-east-1',
    });
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