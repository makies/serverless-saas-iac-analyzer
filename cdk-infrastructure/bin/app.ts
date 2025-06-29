#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MainStack } from '../lib/stacks/main-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

const app = new cdk.App();

// 環境設定の取得
const envName = app.node.tryGetContext('env') || 'dev';
const config = getEnvironmentConfig(envName);

// メインスタックのデプロイ
new MainStack(app, `CloudBestPracticeAnalyzer-${config.environment}`, {
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

app.synth();