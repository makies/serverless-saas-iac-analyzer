/**
 * Built-in rule templates for different frameworks
 */

import {
  Rule,
  FindingSeverity,
  WellArchitectedPillar,
  RuleImplementationType,
  FrameworkType,
} from './types';

export class RuleTemplates {
  /**
   * Get sample rules for AWS Well-Architected Framework
   */
  static getWellArchitectedRules(): Rule[] {
    return [
      {
        id: 'wa-sec-01',
        frameworkId: 'aws-well-architected-framework',
        ruleId: 'SEC.01',
        name: 'Implement strong identity foundation',
        description: 'Ensure that proper authentication and authorization mechanisms are in place',
        severity: FindingSeverity.HIGH,
        pillar: WellArchitectedPillar.SECURITY,
        category: 'Identity and Access Management',
        tags: ['iam', 'authentication', 'authorization'],
        implementation: {
          type: RuleImplementationType.BEDROCK_AI,
          code: '',
          language: 'natural',
        },
        conditions: {
          resourceTypes: ['AWS::IAM::Role', 'AWS::IAM::User', 'AWS::IAM::Policy'],
          checkpoints: [
            'IAM users should not have inline policies',
            'IAM roles should have proper trust relationships',
            'Admin privileges should not be granted broadly',
            'Multi-factor authentication should be enabled',
          ],
        },
        remediation: 'Remove inline policies from IAM users and use managed policies instead. Configure proper trust relationships for IAM roles and enable MFA for privileged access.',
      },
      {
        id: 'wa-sec-02',
        frameworkId: 'aws-well-architected-framework',
        ruleId: 'SEC.02',
        name: 'Apply security at all layers',
        description: 'Implement defense in depth with multiple security controls',
        severity: FindingSeverity.HIGH,
        pillar: WellArchitectedPillar.SECURITY,
        category: 'Defense in Depth',
        tags: ['security-groups', 'nacls', 'encryption'],
        implementation: {
          type: RuleImplementationType.JAVASCRIPT,
          code: `
// Check for security groups and NACLs
const findings = [];

resources.forEach(resource => {
  if (resource.Type === 'AWS::EC2::SecurityGroup') {
    const ingressRules = resource.Properties?.SecurityGroupIngress || [];
    
    ingressRules.forEach((rule, index) => {
      if (rule.CidrIp === '0.0.0.0/0' && rule.IpProtocol !== 'icmp') {
        findings.push(utils.createFinding(
          resource,
          'Security Group allows unrestricted access',
          \`Security group \${resource.LogicalResourceId} has inbound rule \${index} that allows access from anywhere (0.0.0.0/0)\`
        ));
      }
    });
  }
  
  if (resource.Type === 'AWS::S3::Bucket') {
    const publicRead = resource.Properties?.PublicReadAccess;
    const publicWrite = resource.Properties?.PublicWriteAccess;
    
    if (publicRead === true || publicWrite === true) {
      findings.push(utils.createFinding(
        resource,
        'S3 Bucket has public access enabled',
        \`S3 bucket \${resource.LogicalResourceId} has public access enabled which may expose sensitive data\`
      ));
    }
  }
});

return findings;
          `,
          language: 'javascript',
        },
        conditions: {
          resourceTypes: ['AWS::EC2::SecurityGroup', 'AWS::S3::Bucket', 'AWS::EC2::NetworkAcl'],
          checkpoints: [
            'Security groups should not allow unrestricted access',
            'S3 buckets should not have public access',
            'Network ACLs should follow least privilege',
          ],
        },
        remediation: 'Restrict security group rules to specific IP ranges or security groups. Disable public access on S3 buckets unless specifically required.',
      },
      {
        id: 'wa-rel-01',
        frameworkId: 'aws-well-architected-framework',
        ruleId: 'REL.01',
        name: 'Automatically recover from failure',
        description: 'Implement automatic recovery mechanisms and fault tolerance',
        severity: FindingSeverity.MEDIUM,
        pillar: WellArchitectedPillar.RELIABILITY,
        category: 'Fault Tolerance',
        tags: ['auto-scaling', 'multi-az', 'backup'],
        implementation: {
          type: RuleImplementationType.JAVASCRIPT,
          code: `
const findings = [];

resources.forEach(resource => {
  if (resource.Type === 'AWS::RDS::DBInstance') {
    const multiAZ = resource.Properties?.MultiAZ;
    const backupRetention = resource.Properties?.BackupRetentionPeriod;
    
    if (!multiAZ) {
      findings.push(utils.createFinding(
        resource,
        'RDS instance not configured for Multi-AZ',
        \`RDS instance \${resource.LogicalResourceId} should be configured for Multi-AZ deployment for high availability\`
      ));
    }
    
    if (!backupRetention || backupRetention < 7) {
      findings.push(utils.createFinding(
        resource,
        'RDS backup retention period too short',
        \`RDS instance \${resource.LogicalResourceId} should have backup retention period of at least 7 days\`
      ));
    }
  }
  
  if (resource.Type === 'AWS::AutoScaling::AutoScalingGroup') {
    const minSize = resource.Properties?.MinSize || 0;
    const availabilityZones = resource.Properties?.AvailabilityZones || [];
    
    if (minSize < 2) {
      findings.push(utils.createFinding(
        resource,
        'Auto Scaling Group minimum size too low',
        \`Auto Scaling Group \${resource.LogicalResourceId} should have minimum size of at least 2 for fault tolerance\`
      ));
    }
    
    if (availabilityZones.length < 2) {
      findings.push(utils.createFinding(
        resource,
        'Auto Scaling Group not spanning multiple AZs',
        \`Auto Scaling Group \${resource.LogicalResourceId} should span multiple availability zones\`
      ));
    }
  }
});

return findings;
          `,
          language: 'javascript',
        },
        conditions: {
          resourceTypes: ['AWS::RDS::DBInstance', 'AWS::AutoScaling::AutoScalingGroup', 'AWS::ELB::LoadBalancer'],
          checkpoints: [
            'RDS instances should be Multi-AZ',
            'Auto Scaling Groups should span multiple AZs',
            'Load balancers should distribute across AZs',
          ],
        },
        remediation: 'Enable Multi-AZ deployment for RDS instances, configure Auto Scaling Groups to span multiple availability zones, and ensure proper backup retention periods.',
      },
      {
        id: 'wa-cost-01',
        frameworkId: 'aws-well-architected-framework',
        ruleId: 'COST.01',
        name: 'Implement cloud financial management',
        description: 'Adopt consumption model and optimize costs',
        severity: FindingSeverity.MEDIUM,
        pillar: WellArchitectedPillar.COST_OPTIMIZATION,
        category: 'Cost Management',
        tags: ['rightsizing', 'reserved-instances', 'monitoring'],
        implementation: {
          type: RuleImplementationType.BEDROCK_AI,
          code: '',
          language: 'natural',
        },
        conditions: {
          resourceTypes: ['AWS::EC2::Instance', 'AWS::RDS::DBInstance', 'AWS::ElastiCache::CacheCluster'],
          checkpoints: [
            'Instance types should be right-sized',
            'Unused resources should be identified',
            'Cost monitoring should be enabled',
            'Reserved instances should be considered for steady workloads',
          ],
        },
        remediation: 'Right-size instances based on utilization metrics, terminate unused resources, enable cost monitoring and budgets, and consider reserved instances for predictable workloads.',
      },
    ];
  }

  /**
   * Get sample rules for AWS Security Hub CSPM
   */
  static getSecurityHubRules(): Rule[] {
    return [
      {
        id: 'cspm-s3-01',
        frameworkId: 'aws-security-hub-cspm',
        ruleId: 'S3.1',
        name: 'S3 bucket public access',
        description: 'S3 buckets should not have public read or write access',
        severity: FindingSeverity.CRITICAL,
        category: 'S3',
        tags: ['s3', 'public-access', 'data-exposure'],
        implementation: {
          type: RuleImplementationType.JAVASCRIPT,
          code: `
const findings = [];

resources.forEach(resource => {
  if (resource.Type === 'AWS::S3::Bucket') {
    const publicAccessBlock = resource.Properties?.PublicAccessBlockConfiguration;
    const bucketPolicy = resource.Properties?.BucketPolicy;
    const accessControl = resource.Properties?.AccessControl;
    
    // Check for explicit public access settings
    if (accessControl === 'PublicRead' || accessControl === 'PublicReadWrite') {
      findings.push(utils.createFinding(
        resource,
        'S3 bucket has public access via ACL',
        \`S3 bucket \${resource.LogicalResourceId} has public access configured via ACL: \${accessControl}\`
      ));
    }
    
    // Check if public access block is not properly configured
    if (!publicAccessBlock || 
        !publicAccessBlock.BlockPublicAcls || 
        !publicAccessBlock.BlockPublicPolicy ||
        !publicAccessBlock.IgnorePublicAcls ||
        !publicAccessBlock.RestrictPublicBuckets) {
      findings.push(utils.createFinding(
        resource,
        'S3 bucket public access block not properly configured',
        \`S3 bucket \${resource.LogicalResourceId} should have all public access block settings enabled\`
      ));
    }
  }
});

return findings;
          `,
          language: 'javascript',
        },
        conditions: {
          resourceTypes: ['AWS::S3::Bucket'],
          checkpoints: [
            'S3 buckets should not have public read access',
            'S3 buckets should not have public write access',
            'Public access block should be enabled',
          ],
        },
        remediation: 'Enable S3 bucket public access block settings and remove public ACLs and bucket policies unless specifically required.',
      },
      {
        id: 'csmp-ec2-01',
        frameworkId: 'aws-security-hub-cspm',
        ruleId: 'EC2.2',
        name: 'EC2 security groups SSH access',
        description: 'Security groups should not allow unrestricted SSH access from 0.0.0.0/0',
        severity: FindingSeverity.HIGH,
        category: 'EC2',
        tags: ['ec2', 'security-groups', 'ssh'],
        implementation: {
          type: RuleImplementationType.JAVASCRIPT,
          code: `
const findings = [];

resources.forEach(resource => {
  if (resource.Type === 'AWS::EC2::SecurityGroup') {
    const ingressRules = resource.Properties?.SecurityGroupIngress || [];
    
    ingressRules.forEach((rule, index) => {
      if ((rule.IpProtocol === 'tcp' && (rule.FromPort === 22 || rule.ToPort === 22)) &&
          (rule.CidrIp === '0.0.0.0/0' || rule.CidrIpv6 === '::/0')) {
        findings.push(utils.createFinding(
          resource,
          'Security group allows unrestricted SSH access',
          \`Security group \${resource.LogicalResourceId} allows SSH access (port 22) from anywhere. This poses a security risk.\`
        ));
      }
    });
  }
});

return findings;
          `,
          language: 'javascript',
        },
        conditions: {
          resourceTypes: ['AWS::EC2::SecurityGroup'],
          checkpoints: [
            'Security groups should not allow SSH (port 22) from 0.0.0.0/0',
            'Security groups should not allow SSH (port 22) from ::/0',
          ],
        },
        remediation: 'Restrict SSH access to specific IP ranges or use AWS Systems Manager Session Manager for secure access.',
      },
    ];
  }

  /**
   * Get sample rules for AWS Service Delivery Practices
   */
  static getServiceDeliveryRules(): Rule[] {
    return [
      {
        id: 'sdp-mon-01',
        frameworkId: 'aws-service-delivery-practices',
        ruleId: 'MON.01',
        name: 'Application monitoring and observability',
        description: 'Applications should have comprehensive monitoring and logging configured',
        severity: FindingSeverity.MEDIUM,
        category: 'Monitoring',
        tags: ['monitoring', 'logging', 'observability'],
        implementation: {
          type: RuleImplementationType.BEDROCK_AI,
          code: '',
          language: 'natural',
        },
        conditions: {
          resourceTypes: ['AWS::Lambda::Function', 'AWS::ECS::Service', 'AWS::EC2::Instance'],
          checkpoints: [
            'CloudWatch monitoring should be enabled',
            'Application logs should be centralized',
            'Custom metrics should be defined',
            'Alarms should be configured for critical metrics',
          ],
        },
        remediation: 'Enable detailed CloudWatch monitoring, configure centralized logging with CloudWatch Logs, create custom metrics for business KPIs, and set up alarms for critical thresholds.',
      },
      {
        id: 'sdp-deploy-01',
        frameworkId: 'aws-service-delivery-practices',
        ruleId: 'DEPLOY.01',
        name: 'Automated deployment pipeline',
        description: 'Applications should use automated CI/CD pipelines for deployment',
        severity: FindingSeverity.MEDIUM,
        category: 'Deployment',
        tags: ['cicd', 'automation', 'deployment'],
        implementation: {
          type: RuleImplementationType.BEDROCK_AI,
          code: '',
          language: 'natural',
        },
        conditions: {
          resourceTypes: ['AWS::CodePipeline::Pipeline', 'AWS::CodeBuild::Project', 'AWS::CodeDeploy::Application'],
          checkpoints: [
            'CI/CD pipeline should be implemented',
            'Automated testing should be included',
            'Blue/green or rolling deployments should be used',
            'Rollback capabilities should be available',
          ],
        },
        remediation: 'Implement AWS CodePipeline for automated deployments, include automated testing stages, use deployment strategies like blue/green deployments, and ensure rollback capabilities.',
      },
    ];
  }

  /**
   * Get all rule templates organized by framework
   */
  static getAllRuleTemplates(): Record<string, Rule[]> {
    return {
      'aws-well-architected-framework': this.getWellArchitectedRules(),
      'aws-security-hub-cspm': this.getSecurityHubRules(),
      'aws-service-delivery-practices': this.getServiceDeliveryRules(),
    };
  }

  /**
   * Create a custom rule template
   */
  static createCustomRule(
    frameworkId: string,
    ruleId: string,
    name: string,
    description: string,
    severity: FindingSeverity,
    category: string,
    implementation: {
      type: RuleImplementationType;
      code: string;
      language?: string;
    },
    conditions: Record<string, any>,
    remediation: string,
    pillar?: WellArchitectedPillar
  ): Rule {
    return {
      id: `custom-${ruleId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      frameworkId,
      ruleId,
      name,
      description,
      severity,
      pillar,
      category,
      tags: ['custom'],
      implementation,
      conditions,
      remediation,
    };
  }
}