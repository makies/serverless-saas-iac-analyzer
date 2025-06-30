import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ExtendedStackProps } from '../config/types';
import { SBTAmplifyIntegrationStack } from '../sbt-amplify-integration-stack';
import { MonitoringStack } from './monitoring-stack';

/**
 * Hybrid Main Stack for Amplify + CDK architecture
 * 
 * This stack is responsible for:
 * - SBT integration (Control Plane)
 * - Advanced monitoring and alerting
 * - Cross-service integration (EventBridge)
 * - Security policies and IAM
 * 
 * Amplify manages:
 * - GraphQL API (AppSync)
 * - Authentication (Cognito)
 * - Storage (S3)
 * - Basic Lambda functions
 * - DataStore and offline capabilities
 */
export class HybridMainStack extends cdk.Stack {
  public readonly sbtIntegrationStack: SBTAmplifyIntegrationStack;
  public readonly monitoringStack: MonitoringStack;

  constructor(scope: Construct, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Read Amplify outputs from SSM Parameters (will be set by Amplify)
    const amplifyAppId = this.getAmplifyParameter('app-id');
    const amplifyApiId = this.getAmplifyParameter('api-id');
    const userPoolId = this.getAmplifyParameter('user-pool-id');
    const identityPoolId = this.getAmplifyParameter('identity-pool-id');

    // SBT + Amplify Integration Stack
    this.sbtIntegrationStack = new SBTAmplifyIntegrationStack(this, 'SBTIntegration', {
      config,
      amplifyAppId,
      amplifyApiId,
      userPoolId,
      description: 'SBT Control Plane integration with Amplify Application Plane',
    });

    // Enhanced Monitoring Stack (beyond Amplify's basic monitoring)
    this.monitoringStack = new MonitoringStack(this, 'Monitoring', {
      config,
      // We'll pass references to Amplify resources via SSM parameters
      appSyncApi: null, // Will be referenced via ARN
      lambdaFunctions: {}, // Will be referenced via ARNs
      description: 'Advanced monitoring, alerting, and observability',
    });

    // Cross-stack parameter sharing
    this.createSharedParameters(config);

    // Custom IAM policies for enhanced security
    this.createEnhancedSecurityPolicies(config);

    // Dependencies handled automatically by CDK construct references

    // CloudFormation outputs for integration
    this.createIntegrationOutputs(config);

    // Tags for all resources
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'HybridBackend');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Architecture', 'Amplify-CDK-Hybrid');
  }

  /**
   * Get Amplify-generated parameter values
   * These parameters should be created by Amplify after deployment
   */
  private getAmplifyParameter(paramName: string): string {
    try {
      return ssm.StringParameter.valueForStringParameter(
        this,
        `/cloudbpa/${this.stackName.toLowerCase()}/amplify/${paramName}`
      );
    } catch (error) {
      // Return placeholder if parameter doesn't exist yet
      return `AMPLIFY_${paramName.toUpperCase().replace('-', '_')}_PLACEHOLDER`;
    }
  }

  /**
   * Create shared parameters for cross-stack communication
   */
  private createSharedParameters(config: any) {
    // SBT EventBridge integration
    new ssm.StringParameter(this, 'SBTEventBridgeIntegrationParam', {
      parameterName: `/cloudbpa/${config.environment}/integration/eventbridge-arn`,
      stringValue: this.sbtIntegrationStack.sbtEventBridge.eventBusArn,
      description: 'EventBridge ARN for SBT-Amplify integration',
    });

    // SBT API endpoints
    new ssm.StringParameter(this, 'SBTControlPlaneApiParam', {
      parameterName: `/cloudbpa/${config.environment}/sbt/control-plane-api`,
      stringValue: 'TBD_AFTER_DEPLOYMENT', // Will be updated after stack deployment
      description: 'SBT Control Plane API endpoint',
    });

    // Cross-region/cross-account parameters if needed
    if (config.environment === 'prod') {
      new ssm.StringParameter(this, 'CrossRegionBackupParam', {
        parameterName: `/cloudbpa/${config.environment}/backup/cross-region-bucket`,
        stringValue: `cloudbpa-backup-${config.environment}-${cdk.Aws.REGION}-${cdk.Aws.ACCOUNT_ID}`,
        description: 'Cross-region backup bucket name',
      });
    }
  }

  /**
   * Create enhanced security policies for tenant isolation
   */
  private createEnhancedSecurityPolicies(config: any) {
    // Enhanced S3 bucket policies for tenant isolation
    const tenantIsolationPolicy = new cdk.aws_iam.PolicyDocument({
      statements: [
        new cdk.aws_iam.PolicyStatement({
          sid: 'EnforceTenantBoundaryAccess',
          effect: cdk.aws_iam.Effect.DENY,
          principals: [new cdk.aws_iam.AnyPrincipal()],
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
          ],
          resources: [
            `arn:aws:s3:::cloudbpa-storage-${config.environment}/*`,
          ],
          conditions: {
            StringNotLike: {
              's3:prefix': '${cognito-identity.amazonaws.com:sub}/*',
            },
          },
        }),
        new cdk.aws_iam.PolicyStatement({
          sid: 'EnforceFileUploadLimits',
          effect: cdk.aws_iam.Effect.DENY,
          principals: [new cdk.aws_iam.AnyPrincipal()],
          actions: ['s3:PutObject'],
          resources: [
            `arn:aws:s3:::cloudbpa-storage-${config.environment}/uploads/*`,
          ],
          conditions: {
            NumericGreaterThan: {
              's3:content-length': 10485760, // 10MB limit for SBT Basic
            },
          },
        }),
      ],
    });

    // Store policy as SSM parameter for reference by Amplify
    new ssm.StringParameter(this, 'TenantIsolationPolicyParam', {
      parameterName: `/cloudbpa/${config.environment}/security/tenant-isolation-policy`,
      stringValue: JSON.stringify(tenantIsolationPolicy.toJSON()),
      description: 'Tenant isolation policy for S3 resources',
    });

    // Enhanced DynamoDB access patterns
    const dynamoTenantIsolationPolicy = new cdk.aws_iam.PolicyDocument({
      statements: [
        new cdk.aws_iam.PolicyStatement({
          sid: 'AllowTenantScopedAccess',
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
          ],
          resources: [
            `arn:aws:dynamodb:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:table/*`,
          ],
          conditions: {
            'ForAllValues:StringLike': {
              'dynamodb:LeadingKeys': ['${cognito-identity.amazonaws.com:sub}'],
            },
          },
        }),
      ],
    });

    new ssm.StringParameter(this, 'DynamoTenantIsolationPolicyParam', {
      parameterName: `/cloudbpa/${config.environment}/security/dynamo-tenant-isolation-policy`,
      stringValue: JSON.stringify(dynamoTenantIsolationPolicy.toJSON()),
      description: 'DynamoDB tenant isolation policy',
    });
  }

  /**
   * Create integration outputs for Amplify consumption
   */
  private createIntegrationOutputs(config: any) {
    // EventBridge integration
    new cdk.CfnOutput(this, 'SBTEventBusArn', {
      value: this.sbtIntegrationStack.sbtEventBridge.eventBusArn,
      description: 'SBT EventBridge bus ARN for Amplify integration',
      exportName: `${this.stackName}-SBTEventBusArn`,
    });

    // SBT Control Plane API
    new cdk.CfnOutput(this, 'SBTTenantManagementFunctionArn', {
      value: this.sbtIntegrationStack.tenantManagementFunction.functionArn,
      description: 'SBT Tenant Management function ARN',
      exportName: `${this.stackName}-SBTTenantManagementFunctionArn`,
    });

    // Environment-specific outputs
    new cdk.CfnOutput(this, 'Environment', {
      value: config.environment,
      description: 'Deployment environment',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });

    // Integration status
    new cdk.CfnOutput(this, 'HybridArchitectureStatus', {
      value: 'DEPLOYED',
      description: 'Amplify-CDK hybrid architecture deployment status',
    });

    // Configuration for Amplify functions
    new cdk.CfnOutput(this, 'AmplifyIntegrationConfig', {
      value: JSON.stringify({
        sbtEventBusArn: this.sbtIntegrationStack.sbtEventBridge.eventBusArn,
        environment: config.environment,
        region: this.region,
        tenantManagementFunctionArn: this.sbtIntegrationStack.tenantManagementFunction.functionArn,
      }),
      description: 'Configuration object for Amplify function integration',
    });
  }
}