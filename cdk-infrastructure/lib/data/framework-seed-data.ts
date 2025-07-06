// Framework Registry Seed Data for Multi-Framework Analysis System
import { FRAMEWORK_TYPES, FRAMEWORK_STATUS } from '../config/constants';
import { FrameworkRegistryItem, RuleDefinitionItem } from '../config/multi-framework-types';

export const FRAMEWORK_REGISTRY_SEED_DATA: FrameworkRegistryItem[] = [
  // AWS Well-Architected Framework
  {
    pk: `FRAMEWORK#${FRAMEWORK_TYPES.WA_FRAMEWORK}`,
    sk: '#wa-framework-2023',
    frameworkType: 'WA_FRAMEWORK',
    frameworkId: 'wa-framework-2023',
    name: 'AWS Well-Architected Framework',
    version: '2023.10',
    description:
      'The AWS Well-Architected Framework helps you understand the pros and cons of decisions you make while building systems on AWS.',
    status: 'ACTIVE',
    category: 'Architecture Review',
    provider: 'AWS',
    lastUpdated: '2023-12-15T00:00:00Z',
    checksCount: 547,
    pillars: [
      'OPERATIONAL_EXCELLENCE',
      'SECURITY',
      'RELIABILITY',
      'PERFORMANCE_EFFICIENCY',
      'COST_OPTIMIZATION',
      'SUSTAINABILITY',
    ],
    metadata: {
      complexity: 'INTERMEDIATE',
      estimatedTimeMinutes: 120,
      prerequisites: ['Basic AWS knowledge'],
      tags: ['architecture', 'best-practices', 'aws'],
    },
    GSI1PK: `STATUS#${FRAMEWORK_STATUS.ACTIVE}`,
    GSI1SK: `TYPE#${FRAMEWORK_TYPES.WA_FRAMEWORK}#NAME#AWS Well-Architected Framework`,
  },

  // Serverless Applications Lens
  {
    pk: `FRAMEWORK#${FRAMEWORK_TYPES.WA_LENSES}`,
    sk: '#serverless-lens-2024',
    frameworkType: 'WA_LENSES',
    frameworkId: 'serverless-lens-2024',
    name: 'Serverless Applications Lens',
    version: '2.0',
    description:
      'The Serverless Application Lens focuses on how to design, deploy, and architect your serverless application workloads in the AWS Cloud.',
    status: 'ACTIVE',
    category: 'Serverless Architecture',
    provider: 'AWS',
    lastUpdated: '2024-01-10T00:00:00Z',
    checksCount: 124,
    pillars: [
      'OPERATIONAL_EXCELLENCE',
      'SECURITY',
      'RELIABILITY',
      'PERFORMANCE_EFFICIENCY',
      'COST_OPTIMIZATION',
    ],
    metadata: {
      complexity: 'ADVANCED',
      estimatedTimeMinutes: 90,
      prerequisites: ['Serverless architecture knowledge', 'Lambda experience'],
      tags: ['serverless', 'lambda', 'microservices'],
    },
    GSI1PK: `STATUS#${FRAMEWORK_STATUS.ACTIVE}`,
    GSI1SK: `TYPE#${FRAMEWORK_TYPES.WA_LENSES}#NAME#Serverless Applications Lens`,
  },

  // SaaS Applications Lens
  {
    pk: `FRAMEWORK#${FRAMEWORK_TYPES.WA_LENSES}`,
    sk: '#saas-lens-2024',
    frameworkType: 'WA_LENSES',
    frameworkId: 'saas-lens-2024',
    name: 'SaaS Applications Lens',
    version: '1.1',
    description:
      'The SaaS Lens focuses on how to design, deploy, and architect your Software as a Service (SaaS) workloads in the AWS Cloud.',
    status: 'BETA',
    category: 'SaaS Architecture',
    provider: 'AWS',
    lastUpdated: '2024-01-05T00:00:00Z',
    checksCount: 89,
    pillars: [
      'OPERATIONAL_EXCELLENCE',
      'SECURITY',
      'RELIABILITY',
      'PERFORMANCE_EFFICIENCY',
      'COST_OPTIMIZATION',
    ],
    metadata: {
      complexity: 'ADVANCED',
      estimatedTimeMinutes: 85,
      prerequisites: ['Multi-tenancy knowledge', 'SaaS architecture experience'],
      tags: ['saas', 'multi-tenancy', 'isolation'],
    },
    GSI1PK: `STATUS#${FRAMEWORK_STATUS.BETA}`,
    GSI1SK: `TYPE#${FRAMEWORK_TYPES.WA_LENSES}#NAME#SaaS Applications Lens`,
  },

  // Security Hub CSPM Controls
  {
    pk: `FRAMEWORK#${FRAMEWORK_TYPES.CSPM}`,
    sk: '#security-hub-cspm',
    frameworkType: 'CSPM',
    frameworkId: 'security-hub-cspm',
    name: 'AWS Security Hub CSPM Controls',
    version: 'Latest',
    description:
      'Cloud Security Posture Management controls from AWS Security Hub for continuous compliance monitoring.',
    status: 'ACTIVE',
    category: 'Security Compliance',
    provider: 'AWS',
    lastUpdated: '2024-01-15T00:00:00Z',
    checksCount: 342,
    metadata: {
      complexity: 'INTERMEDIATE',
      estimatedTimeMinutes: 60,
      prerequisites: ['Security Hub knowledge', 'Compliance requirements'],
      tags: ['security', 'compliance', 'cspm', 'monitoring'],
    },
    GSI1PK: `STATUS#${FRAMEWORK_STATUS.ACTIVE}`,
    GSI1SK: `TYPE#${FRAMEWORK_TYPES.CSPM}#NAME#AWS Security Hub CSPM Controls`,
  },

  // AWS Service Delivery Program
  {
    pk: `FRAMEWORK#${FRAMEWORK_TYPES.SDP}`,
    sk: '#aws-sdp-2024',
    frameworkType: 'SDP',
    frameworkId: 'aws-sdp-2024',
    name: 'AWS Service Delivery Program Requirements',
    version: '2024.1',
    description:
      'Requirements and best practices for AWS Service Delivery Partners to deliver consistent, high-quality services.',
    status: 'ACTIVE',
    category: 'Partner Requirements',
    provider: 'AWS',
    lastUpdated: '2024-01-01T00:00:00Z',
    checksCount: 156,
    metadata: {
      complexity: 'INTERMEDIATE',
      estimatedTimeMinutes: 75,
      prerequisites: ['AWS Partner Network membership', 'Service delivery experience'],
      tags: ['partner', 'service-delivery', 'quality-assurance'],
    },
    GSI1PK: `STATUS#${FRAMEWORK_STATUS.ACTIVE}`,
    GSI1SK: `TYPE#${FRAMEWORK_TYPES.SDP}#NAME#AWS Service Delivery Program Requirements`,
  },
];

export const RULE_DEFINITIONS_SEED_DATA: RuleDefinitionItem[] = [
  // Well-Architected Framework Sample Rules
  {
    pk: 'RULE#WA-OPS-01',
    sk: 'VERSION#1.0',
    frameworkId: 'wa-framework-2023',
    ruleId: 'WA-OPS-01',
    pillar: 'OPERATIONAL_EXCELLENCE',
    title: 'Use Infrastructure as Code',
    description:
      'Use infrastructure as code to define your infrastructure and deploy it consistently across environments.',
    severity: 'HIGH',
    category: 'Infrastructure Management',
    checkType: 'CODE_ANALYSIS',
    implementation: {
      cloudformation: {
        resourceTypes: ['AWS::CloudFormation::Stack'],
        checks: [
          {
            condition: 'EXISTS',
            message: 'Infrastructure should be defined using CloudFormation templates',
          },
        ],
      },
      terraform: {
        resourceTypes: ['terraform'],
        checks: [
          {
            condition: 'EXISTS',
            message: 'Infrastructure should be defined using Terraform configuration',
          },
        ],
      },
      cdk: {
        resourceTypes: ['AWS::CDK::Stack'],
        checks: [
          {
            condition: 'EXISTS',
            message: 'Infrastructure should be defined using AWS CDK',
          },
        ],
      },
    },
    remediation: {
      description:
        'Define infrastructure using CloudFormation, Terraform, or CDK instead of manual configuration.',
      links: [
        'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/',
        'https://docs.aws.amazon.com/cdk/',
      ],
      effort: 'MEDIUM',
      automatable: true,
      steps: [
        'Choose an IaC tool (CloudFormation, Terraform, or CDK)',
        'Define infrastructure resources in code',
        'Implement CI/CD pipeline for deployment',
        'Test infrastructure changes in non-production environments',
      ],
    },
    GSI1PK: 'FRAMEWORK#wa-framework-2023',
    GSI1SK: 'PILLAR#OPERATIONAL_EXCELLENCE#SEVERITY#HIGH',
  },

  // Serverless Lens Sample Rules
  {
    pk: 'RULE#SLS-PERF-01',
    sk: 'VERSION#1.0',
    frameworkId: 'serverless-lens-2024',
    ruleId: 'SLS-PERF-01',
    pillar: 'PERFORMANCE_EFFICIENCY',
    title: 'Optimize Lambda Function Memory',
    description: 'Configure Lambda function memory appropriately to balance performance and cost.',
    severity: 'MEDIUM',
    category: 'Performance Optimization',
    checkType: 'CONFIGURATION',
    implementation: {
      cloudformation: {
        resourceTypes: ['AWS::Lambda::Function'],
        checks: [
          {
            property: 'MemorySize',
            condition: 'EXISTS',
            message: 'Lambda function memory size should be explicitly configured',
          },
          {
            property: 'MemorySize',
            condition: 'REGEX',
            value: '^(128|256|512|1024|1536|2048|3008)$',
            message: 'Lambda memory should be optimized based on performance testing',
          },
        ],
      },
    },
    remediation: {
      description: 'Use AWS Lambda Power Tuning to find optimal memory configuration.',
      links: ['https://github.com/alexcasalboni/aws-lambda-power-tuning'],
      effort: 'LOW',
      automatable: true,
      steps: [
        'Deploy AWS Lambda Power Tuning tool',
        'Run performance tests with different memory configurations',
        'Analyze cost vs performance trade-offs',
        'Update Lambda function memory configuration',
      ],
    },
    GSI1PK: 'FRAMEWORK#serverless-lens-2024',
    GSI1SK: 'PILLAR#PERFORMANCE_EFFICIENCY#SEVERITY#MEDIUM',
  },

  // Security Hub CSPM Sample Rule
  {
    pk: 'RULE#CSPM-SEC-01',
    sk: 'VERSION#1.0',
    frameworkId: 'security-hub-cspm',
    ruleId: 'CSPM-SEC-01',
    pillar: 'SECURITY',
    title: 'S3 Bucket Public Read Access',
    description: 'S3 buckets should not allow public read access unless explicitly required.',
    severity: 'CRITICAL',
    category: 'Data Protection',
    checkType: 'LIVE_CHECK',
    implementation: {
      liveCheck: {
        service: 'S3',
        api: 'GetBucketAcl',
        checks: [
          {
            condition: 'NOT_CONTAINS',
            value: 'AllUsers',
            message: 'S3 bucket should not grant public read access',
          },
        ],
      },
    },
    remediation: {
      description: 'Remove public read access from S3 bucket ACL and bucket policy.',
      links: [
        'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
      ],
      effort: 'LOW',
      automatable: true,
      steps: [
        'Review bucket access requirements',
        'Remove public read permissions from bucket ACL',
        'Update bucket policy to remove public access',
        'Enable S3 Block Public Access if appropriate',
      ],
    },
    GSI1PK: 'FRAMEWORK#security-hub-cspm',
    GSI1SK: 'PILLAR#SECURITY#SEVERITY#CRITICAL',
  },
];
