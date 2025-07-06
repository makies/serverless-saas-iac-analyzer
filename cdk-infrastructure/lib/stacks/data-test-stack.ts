import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataStack } from './data-stack';
import { EnvironmentConfig } from '../config/environments';

export interface DataTestStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class DataTestStack extends cdk.Stack {
  public readonly dataStack: DataStack;

  constructor(scope: Construct, id: string, props: DataTestStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Create data constructs
    this.dataStack = new DataStack(this, 'Data', {
      config,
      description: 'DynamoDB tables for multi-framework system',
    });

    // The DataStack construct already creates all necessary outputs
  }
}
