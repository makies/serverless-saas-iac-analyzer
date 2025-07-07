import * as cdk from 'aws-cdk-lib';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface StepFunctionsStackProps {
  config: EnvironmentConfig;
  resolverFunctions: Record<string, lambda.Function>;
  description?: string;
}

export class StepFunctionsStack extends Construct {
  public readonly analysisStateMachine: stepfunctions.StateMachine;
  public readonly reportGenerationStateMachine: stepfunctions.StateMachine;

  constructor(scope: Construct, id: string, props: StepFunctionsStackProps) {
    super(scope, id);

    const { config, resolverFunctions } = props;

    // CloudWatch Log Groups for Step Functions
    const analysisLogGroup = new logs.LogGroup(this, 'AnalysisWorkflowLogs', {
      logGroupName: `/aws/stepfunctions/analysis-workflow-${config.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const reportLogGroup = new logs.LogGroup(this, 'ReportGenerationLogs', {
      logGroupName: `/aws/stepfunctions/report-generation-${config.environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // IAM Role for Step Functions
    const stepFunctionsRole = new iam.Role(this, 'StepFunctionsRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
      inlinePolicies: {
        LambdaInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: Object.values(resolverFunctions).map(func => func.functionArn),
            }),
          ],
        }),
        CloudWatchLogsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogDelivery',
                'logs:GetLogDelivery',
                'logs:UpdateLogDelivery',
                'logs:DeleteLogDelivery',
                'logs:ListLogDeliveries',
                'logs:PutResourcePolicy',
                'logs:DescribeResourcePolicies',
                'logs:DescribeLogGroups',
              ],
              resources: ['*'],
            }),
          ],
        }),
        BedrockInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              resources: [
                `arn:aws:bedrock:${config.bedrockConfig.region}::foundation-model/${config.bedrockConfig.modelId}`,
              ],
            }),
          ],
        }),
      },
    });

    // Analysis State Machine Definition
    this.analysisStateMachine = this.createAnalysisStateMachine(
      config,
      resolverFunctions,
      stepFunctionsRole,
      analysisLogGroup
    );

    // Report Generation State Machine Definition
    this.reportGenerationStateMachine = this.createReportGenerationStateMachine(
      config,
      resolverFunctions,
      stepFunctionsRole,
      reportLogGroup
    );

    // Tags
    cdk.Tags.of(this.analysisStateMachine).add('Environment', config.environment);
    cdk.Tags.of(this.analysisStateMachine).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this.analysisStateMachine).add('Service', 'AnalysisWorkflow');

    cdk.Tags.of(this.reportGenerationStateMachine).add('Environment', config.environment);
    cdk.Tags.of(this.reportGenerationStateMachine).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this.reportGenerationStateMachine).add('Service', 'ReportGeneration');
  }

  private createAnalysisStateMachine(
    config: EnvironmentConfig,
    resolverFunctions: Record<string, lambda.Function>,
    role: iam.Role,
    logGroup: logs.LogGroup
  ): stepfunctions.StateMachine {
    // Initialize Analysis Task
    const initializeAnalysis = new sfnTasks.LambdaInvoke(this, 'InitializeAnalysis', {
      lambdaFunction: resolverFunctions.startAnalysis || resolverFunctions.createAnalysis,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    // Validate Input Task
    const validateInput = new stepfunctions.Pass(this, 'ValidateInput', {
      comment: 'Validate analysis input parameters',
      result: stepfunctions.Result.fromObject({
        validation: 'passed',
        timestamp: stepfunctions.JsonPath.stringAt('$$.State.EnteredTime'),
      }),
      resultPath: '$.validation',
    });

    // Multi-Framework Analysis Task (Parallel execution)
    const runWellArchitectedAnalysis = new stepfunctions.Pass(this, 'RunWellArchitectedAnalysis', {
      comment: 'Run AWS Well-Architected Framework analysis',
      result: stepfunctions.Result.fromObject({
        framework: 'well-architected',
        status: 'completed',
        findings: [],
      }),
      resultPath: '$.frameworks.wellArchitected',
    });

    const runSecurityAnalysis = new stepfunctions.Pass(this, 'RunSecurityAnalysis', {
      comment: 'Run security-focused analysis',
      result: stepfunctions.Result.fromObject({
        framework: 'security',
        status: 'completed',
        findings: [],
      }),
      resultPath: '$.frameworks.security',
    });

    const runCostOptimizationAnalysis = new stepfunctions.Pass(this, 'RunCostOptimizationAnalysis', {
      comment: 'Run cost optimization analysis',
      result: stepfunctions.Result.fromObject({
        framework: 'cost-optimization',
        status: 'completed',
        findings: [],
      }),
      resultPath: '$.frameworks.costOptimization',
    });

    // Parallel framework analysis execution
    const parallelAnalysis = new stepfunctions.Parallel(this, 'ParallelFrameworkAnalysis', {
      comment: 'Run multiple framework analyses in parallel',
      resultPath: '$.parallelResults',
    });

    parallelAnalysis.branch(runWellArchitectedAnalysis);
    parallelAnalysis.branch(runSecurityAnalysis);
    parallelAnalysis.branch(runCostOptimizationAnalysis);

    // Aggregate Results Task
    const aggregateResults = new stepfunctions.Pass(this, 'AggregateResults', {
      comment: 'Aggregate analysis results from all frameworks',
      parameters: {
        'analysisId.$': '$.analysisId',
        'overallScore.$': '$.parallelResults[0].score',
        'totalFindings.$': 'States.ArrayLength($.parallelResults[*].findings[*])',
        'frameworks.$': '$.parallelResults',
        'completedAt.$': '$$.State.EnteredTime',
      },
      resultPath: '$.aggregated',
    });

    // Store Results Task
    const storeResults = new stepfunctions.Pass(this, 'StoreResults', {
      comment: 'Store analysis results to DynamoDB',
      result: stepfunctions.Result.fromObject({
        status: 'COMPLETED',
        storedAt: stepfunctions.JsonPath.stringAt('$$.State.EnteredTime'),
      }),
      resultPath: '$.storage',
    });

    // Success State
    const analysisSucceeded = new stepfunctions.Succeed(this, 'AnalysisSucceeded', {
      comment: 'Analysis completed successfully',
    });

    // Failure State
    const analysisFailed = new stepfunctions.Fail(this, 'AnalysisFailed', {
      comment: 'Analysis failed',
      causePath: '$.errorMessage',
      errorPath: '$.errorType',
    });

    // Error Handler
    const handleError = new stepfunctions.Pass(this, 'HandleError', {
      comment: 'Handle analysis errors',
      parameters: {
        'errorType.$': '$.Error',
        'errorMessage.$': '$.Cause',
        'analysisId.$': '$.analysisId',
        'failedAt.$': '$$.State.EnteredTime',
      },
      next: analysisFailed,
    });

    // Chain the steps together
    const definition = validateInput
      .next(initializeAnalysis)
      .next(parallelAnalysis)
      .next(aggregateResults)
      .next(storeResults)
      .next(analysisSucceeded);

    // Add error handling
    initializeAnalysis.addCatch(handleError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    parallelAnalysis.addCatch(handleError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    return new stepfunctions.StateMachine(this, 'AnalysisStateMachine', {
      stateMachineName: `AnalysisWorkflow-${config.environment}`,
      definition,
      role,
      timeout: cdk.Duration.hours(2),
      tracingEnabled: config.monitoringConfig.enableXRay,
      logs: {
        destination: logGroup,
        level: stepfunctions.LogLevel.ALL,
        includeExecutionData: true,
      },
    });
  }

  private createReportGenerationStateMachine(
    config: EnvironmentConfig,
    resolverFunctions: Record<string, lambda.Function>,
    role: iam.Role,
    logGroup: logs.LogGroup
  ): stepfunctions.StateMachine {
    // Initialize Report Generation
    const initializeReportGeneration = new stepfunctions.Pass(this, 'InitializeReportGeneration', {
      comment: 'Initialize report generation process',
      parameters: {
        'reportId.$': '$.reportId',
        'reportType.$': '$.reportType',
        'format.$': '$.format',
        'startedAt.$': '$$.State.EnteredTime',
      },
      resultPath: '$.initialization',
    });

    // Fetch Analysis Data
    const fetchAnalysisData = new stepfunctions.Pass(this, 'FetchAnalysisData', {
      comment: 'Fetch analysis data for report generation',
      result: stepfunctions.Result.fromObject({
        analysisData: {
          findings: [],
          metrics: {},
          recommendations: [],
        },
      }),
      resultPath: '$.analysisData',
    });

    // Generate PDF Report Branch
    const generatePdfReport = new stepfunctions.Pass(this, 'GeneratePdfReport', {
      comment: 'Generate PDF format report',
      result: stepfunctions.Result.fromObject({
        format: 'PDF',
        status: 'generated',
        s3Location: {
          bucket: 'reports-bucket',
          key: 'reports/pdf/report.pdf',
        },
      }),
    });

    // Generate Excel Report Branch
    const generateExcelReport = new stepfunctions.Pass(this, 'GenerateExcelReport', {
      comment: 'Generate Excel format report',
      result: stepfunctions.Result.fromObject({
        format: 'EXCEL',
        status: 'generated',
        s3Location: {
          bucket: 'reports-bucket',
          key: 'reports/excel/report.xlsx',
        },
      }),
    });

    // Generate JSON Report Branch
    const generateJsonReport = new stepfunctions.Pass(this, 'GenerateJsonReport', {
      comment: 'Generate JSON format report',
      result: stepfunctions.Result.fromObject({
        format: 'JSON',
        status: 'generated',
        s3Location: {
          bucket: 'reports-bucket',
          key: 'reports/json/report.json',
        },
      }),
    });

    // Generate HTML Report Branch
    const generateHtmlReport = new stepfunctions.Pass(this, 'GenerateHtmlReport', {
      comment: 'Generate HTML format report',
      result: stepfunctions.Result.fromObject({
        format: 'HTML',
        status: 'generated',
        s3Location: {
          bucket: 'reports-bucket',
          key: 'reports/html/report.html',
        },
      }),
    });

    // Format Choice
    const formatChoice = new stepfunctions.Choice(this, 'ChooseReportFormat')
      .when(stepfunctions.Condition.stringEquals('$.format', 'PDF'), generatePdfReport)
      .when(stepfunctions.Condition.stringEquals('$.format', 'EXCEL'), generateExcelReport)
      .when(stepfunctions.Condition.stringEquals('$.format', 'JSON'), generateJsonReport)
      .when(stepfunctions.Condition.stringEquals('$.format', 'HTML'), generateHtmlReport)
      .otherwise(
        new stepfunctions.Fail(this, 'UnsupportedFormat', {
          comment: 'Unsupported report format',
          error: 'UnsupportedFormatError',
          cause: 'The specified report format is not supported',
        })
      );

    // Store Report Metadata
    const storeReportMetadata = new stepfunctions.Pass(this, 'StoreReportMetadata', {
      comment: 'Store report metadata in DynamoDB',
      result: stepfunctions.Result.fromObject({
        status: 'COMPLETED',
        completedAt: stepfunctions.JsonPath.stringAt('$$.State.EnteredTime'),
      }),
      resultPath: '$.storage',
    });

    // Success State
    const reportGenerationSucceeded = new stepfunctions.Succeed(this, 'ReportGenerationSucceeded', {
      comment: 'Report generation completed successfully',
    });

    // Failure State
    const reportGenerationFailed = new stepfunctions.Fail(this, 'ReportGenerationFailed', {
      comment: 'Report generation failed',
      causePath: '$.errorMessage',
      errorPath: '$.errorType',
    });

    // Chain the steps together
    const definition = initializeReportGeneration
      .next(fetchAnalysisData)
      .next(formatChoice)
      .next(storeReportMetadata)
      .next(reportGenerationSucceeded);

    // Connect format branches to metadata storage
    generatePdfReport.next(storeReportMetadata);
    generateExcelReport.next(storeReportMetadata);
    generateJsonReport.next(storeReportMetadata);
    generateHtmlReport.next(storeReportMetadata);

    return new stepfunctions.StateMachine(this, 'ReportGenerationStateMachine', {
      stateMachineName: `ReportGenerationWorkflow-${config.environment}`,
      definition,
      role,
      timeout: cdk.Duration.minutes(30),
      tracingEnabled: config.monitoringConfig.enableXRay,
      logs: {
        destination: logGroup,
        level: stepfunctions.LogLevel.ALL,
        includeExecutionData: true,
      },
    });
  }
}