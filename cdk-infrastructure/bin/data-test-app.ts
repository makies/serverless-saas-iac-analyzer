#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataTestStack } from '../lib/stacks/data-test-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

const app = new cdk.App();

// Get environment
const environment = app.node.tryGetContext('environment') || 'dev';
const config = getEnvironmentConfig(environment);

// Data Stack for testing
const dataTestStack = new DataTestStack(app, 'DataTestStack', {
  config,
  description: 'DynamoDB tables test for multi-framework system',
});

// Add tags
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('Project', 'CloudBestPracticeAnalyzer');
cdk.Tags.of(app).add('Purpose', 'DataTesting');