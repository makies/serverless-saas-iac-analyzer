#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { MainStack } from '../lib/stacks/main-stack';
import { getEnvironmentConfig } from '../lib/config/environments';
import {
  CdkNagAspects,
  ServerlessSecurityAspect,
  MultiTenantSecurityAspect,
} from '../lib/security/cdk-nag-aspects';
import { SaaSNagSuppressions } from '../lib/security/nag-suppressions';

const app = new cdk.App();

// 環境設定の取得
const envName = app.node.tryGetContext('env') || 'dev';
const config = getEnvironmentConfig(envName);

console.log(`Deploying to environment: ${config.environment}`);

// メインスタックのデプロイ
const stack = new MainStack(app, `CloudBestPracticeAnalyzer-${config.environment}`, {
  env: {
    account: config.account,
    region: config.region,
  },
  config,
  tags: {
    Environment: config.environment,
    Project: 'CloudBestPracticeAnalyzer',
    Service: 'Backend',
    Owner: 'TechLead',
    CostCenter: 'Engineering',
  },
});

// Apply CDK Nag security checks (controlled by environment variable)
const enableCdkNag = process.env.ENABLE_CDK_NAG === 'true' || config.environment === 'prod';

if (enableCdkNag) {
  console.log('Applying CDK Nag security checks...');

  // Core security checks (AWS Solutions + NIST 800-53 R5 + Serverless Rules)
  CdkNagAspects.applyAwsSolutionsChecks(app);

  // Custom serverless and multi-tenant security aspects
  Aspects.of(app).add(new ServerlessSecurityAspect());
  Aspects.of(app).add(new MultiTenantSecurityAspect());

  // Apply SaaS-specific suppression rules
  console.log('Applying SaaS-specific CDK Nag suppressions...');
  SaaSNagSuppressions.applyAllSuppressions(stack, config.environment);

  console.log('CDK Nag security checks applied successfully');
} else {
  console.log('CDK Nag security checks disabled for development');
}

// Optional: Apply compliance checks for specific industries
// Uncomment if financial or healthcare compliance is required
// CdkNagAspects.applyComplianceChecks(app, true, false); // PCI DSS for financial
// CdkNagAspects.applyComplianceChecks(app, false, true); // HIPAA for healthcare

app.synth();
