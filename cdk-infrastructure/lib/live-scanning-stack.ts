import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config/environments';
import { LiveScanWorkflow } from '../src/step-functions/live-scan-workflow';
import * as path from 'path';

export interface LiveScanningStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  sbtEventBusArn: string;
  frameworkAnalysisFunction: lambda.Function;
  storeResultsFunction: lambda.Function;
}

export class LiveScanningStack extends cdk.Stack {
  public readonly liveScannerFunction: lambda.Function;
  public readonly liveScanStateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: LiveScanningStackProps) {
    super(scope, id, props);

    const { config } = props;

    // IAM Role for Live Scanning with cross-account assume role permissions
    const liveScanRole = new iam.Role(this, 'LiveScanRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        LiveScanPolicy: new iam.PolicyDocument({
          statements: [
            // DynamoDB access for storing analysis results
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                `arn:aws:dynamodb:${this.region}:${this.account}:table/CloudBPA-Analyses-${config.environment}`,
                `arn:aws:dynamodb:${this.region}:${this.account}:table/CloudBPA-Analyses-${config.environment}/index/*`,
              ],
            }),
            // STS AssumeRole for cross-account scanning
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sts:AssumeRole'],
              resources: ['arn:aws:iam::*:role/CloudBPA-*'], // Customer-defined role pattern
            }),
            // EventBridge access for publishing scan events
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['events:PutEvents'],
              resources: [
                props.sbtEventBusArn,
                `arn:aws:events:${this.region}:${this.account}:event-bus/default`,
              ],
            }),
            // Step Functions execution for workflow coordination
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'states:StartExecution',
                'states:StopExecution',
                'states:DescribeExecution',
              ],
              resources: [`arn:aws:states:${this.region}:${this.account}:stateMachine:CloudBPA-LiveScan-*`],
            }),
          ],
        }),
      },
    });

    // Lambda function for live AWS resource scanning
    this.liveScannerFunction = new nodejs.NodejsFunction(this, 'LiveScannerFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/live-aws-scanner.ts'),
      timeout: cdk.Duration.minutes(15), // Extended timeout for resource scanning
      memorySize: 2048, // More memory for processing large resource sets
      role: liveScanRole,
      environment: {
        NODE_ENV: 'production',
        ENVIRONMENT: config.environment,
        ANALYSES_TABLE: `CloudBPA-Analyses-${config.environment}`,
        EVENT_BUS_NAME: 'CloudBPA-SBT-Events-' + config.environment,
        LOG_LEVEL: config.lambdaConfig.logLevel,
      },
      tracing: lambda.Tracing.ACTIVE,
      functionName: `CloudBPA-LiveScanner-${config.environment}`,
      bundling: {
        externalModules: ['aws-sdk'], // Exclude AWS SDK to reduce bundle size
        nodeModules: ['uuid'],
      },
    });

    // Step Functions State Machine for live scan workflow orchestration
    this.liveScanStateMachine = new sfn.StateMachine(this, 'LiveScanWorkflow', {
      stateMachineName: `CloudBPA-LiveScan-${config.environment}`,
      definitionBody: LiveScanWorkflow.createDefinition({
        liveScannerFunction: this.liveScannerFunction,
        frameworkAnalysisFunction: props.frameworkAnalysisFunction,
        storeResultsFunction: props.storeResultsFunction,
      }),
      timeout: cdk.Duration.hours(2), // Maximum execution time
      tracingEnabled: true,
    });

    // Multi-account scanning workflow
    const multiAccountStateMachine = new sfn.StateMachine(this, 'MultiAccountScanWorkflow', {
      stateMachineName: `CloudBPA-MultiAccountScan-${config.environment}`,
      definitionBody: LiveScanWorkflow.createMultiAccountDefinition({
        liveScannerFunction: this.liveScannerFunction,
        frameworkAnalysisFunction: props.frameworkAnalysisFunction,
        storeResultsFunction: props.storeResultsFunction,
      }),
      timeout: cdk.Duration.hours(4), // Extended timeout for multi-account scans
      tracingEnabled: true,
    });

    // Scheduled scanning workflow
    const scheduledScanStateMachine = new sfn.StateMachine(this, 'ScheduledScanWorkflow', {
      stateMachineName: `CloudBPA-ScheduledScan-${config.environment}`,
      definitionBody: LiveScanWorkflow.createScheduledScanDefinition({
        liveScannerFunction: this.liveScannerFunction,
        frameworkAnalysisFunction: props.frameworkAnalysisFunction,
        storeResultsFunction: props.storeResultsFunction,
      }),
      timeout: cdk.Duration.hours(3),
      tracingEnabled: true,
    });

    // Grant permissions to Step Functions to invoke Lambda functions
    this.liveScannerFunction.grantInvoke(this.liveScanStateMachine);
    props.frameworkAnalysisFunction.grantInvoke(this.liveScanStateMachine);
    props.storeResultsFunction.grantInvoke(this.liveScanStateMachine);

    this.liveScannerFunction.grantInvoke(multiAccountStateMachine);
    props.frameworkAnalysisFunction.grantInvoke(multiAccountStateMachine);
    props.storeResultsFunction.grantInvoke(multiAccountStateMachine);

    this.liveScannerFunction.grantInvoke(scheduledScanStateMachine);
    props.frameworkAnalysisFunction.grantInvoke(scheduledScanStateMachine);
    props.storeResultsFunction.grantInvoke(scheduledScanStateMachine);

    // EventBridge rule to trigger live scans
    const liveScanTriggerRule = new events.Rule(this, 'LiveScanTriggerRule', {
      eventPattern: {
        source: ['cloudbpa.analysis'],
        detailType: ['Live Scan Requested'],
      },
      description: 'Trigger live AWS account scanning when requested',
    });

    // Add Step Functions as target for live scan events
    liveScanTriggerRule.addTarget(new targets.SfnStateMachine(this.liveScanStateMachine, {
      input: events.RuleTargetInput.fromEventPath('$.detail'),
    }));

    // Scheduled scan trigger (daily at 2 AM UTC)
    const scheduledScanRule = new events.Rule(this, 'ScheduledScanRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        day: '*',
        month: '*',
        year: '*',
      }),
      description: 'Trigger scheduled scans for active projects',
    });

    scheduledScanRule.addTarget(new targets.SfnStateMachine(scheduledScanStateMachine));

    // IAM role for EventBridge to invoke Step Functions
    const eventBridgeRole = new iam.Role(this, 'EventBridgeStepFunctionsRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: {
        StepFunctionsExecution: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['states:StartExecution'],
              resources: [
                this.liveScanStateMachine.stateMachineArn,
                multiAccountStateMachine.stateMachineArn,
                scheduledScanStateMachine.stateMachineArn,
              ],
            }),
          ],
        }),
      },
    });

    // SSM Parameters for configuration
    new ssm.StringParameter(this, 'LiveScanStateMachineParameter', {
      parameterName: `/cloudbpa/${config.environment}/live-scan/state-machine-arn`,
      stringValue: this.liveScanStateMachine.stateMachineArn,
      description: 'Live scan Step Functions state machine ARN',
    });

    new ssm.StringParameter(this, 'MultiAccountScanStateMachineParameter', {
      parameterName: `/cloudbpa/${config.environment}/live-scan/multi-account-state-machine-arn`,
      stringValue: multiAccountStateMachine.stateMachineArn,
      description: 'Multi-account scan Step Functions state machine ARN',
    });

    new ssm.StringParameter(this, 'LiveScannerFunctionParameter', {
      parameterName: `/cloudbpa/${config.environment}/live-scan/function-arn`,
      stringValue: this.liveScannerFunction.functionArn,
      description: 'Live scanner Lambda function ARN',
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'LiveScanStateMachineArn', {
      value: this.liveScanStateMachine.stateMachineArn,
      description: 'Live Scan Step Functions State Machine ARN',
      exportName: `${id}-LiveScanStateMachineArn`,
    });

    new cdk.CfnOutput(this, 'MultiAccountScanStateMachineArn', {
      value: multiAccountStateMachine.stateMachineArn,
      description: 'Multi-Account Scan Step Functions State Machine ARN',
      exportName: `${id}-MultiAccountScanStateMachineArn`,
    });

    new cdk.CfnOutput(this, 'LiveScannerFunctionArn', {
      value: this.liveScannerFunction.functionArn,
      description: 'Live Scanner Lambda Function ARN',
      exportName: `${id}-LiveScannerFunctionArn`,
    });

    // CloudWatch Dashboard for monitoring live scans
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'LiveScanDashboard', {
      dashboardName: `CloudBPA-LiveScan-${config.environment}`,
    });

    // Add widgets for monitoring
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Live Scan Executions',
        left: [this.liveScanStateMachine.metricExecutionsFailed()],
        right: [this.liveScanStateMachine.metricExecutionsSucceeded()],
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Lambda Function Metrics',
        left: [this.liveScannerFunction.metricDuration()],
        right: [this.liveScannerFunction.metricErrors()],
      })
    );

    // Tags
    cdk.Tags.of(this).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this).add('Environment', config.environment);
    cdk.Tags.of(this).add('Service', 'LiveScanning');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}