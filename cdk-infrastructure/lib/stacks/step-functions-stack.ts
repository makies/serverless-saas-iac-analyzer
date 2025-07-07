import * as cdk from 'aws-cdk-lib';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { LAMBDA_FUNCTION_NAMES } from '../config/constants';

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
      lambdaFunction: resolverFunctions[LAMBDA_FUNCTION_NAMES.CREATE_ANALYSIS] || resolverFunctions[LAMBDA_FUNCTION_NAMES.START_ANALYSIS],
      payload: stepfunctions.TaskInput.fromJsonPathAt('$'),
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

    // Framework Initialization Task
    const initializeFrameworks = new sfnTasks.LambdaInvoke(this, 'InitializeFrameworks', {
      lambdaFunction: resolverFunctions[LAMBDA_FUNCTION_NAMES.FRAMEWORK_INITIALIZATION],
      payload: stepfunctions.TaskInput.fromObject({
        action: 'initialize',
        force: false,
      }),
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    // Multi-Framework Analysis Task
    const runFrameworkAnalysis = new sfnTasks.LambdaInvoke(this, 'RunFrameworkAnalysis', {
      lambdaFunction: resolverFunctions[LAMBDA_FUNCTION_NAMES.FRAMEWORK_ANALYSIS],
      payload: stepfunctions.TaskInput.fromObject({
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'projectId.$': '$.projectId',
        'frameworks.$': '$.configuration.frameworks',
        'resourcesS3Key.$': '$.input.resourcesS3Key',
        'resources.$': '$.input.resources',
        'settings': {
          'parallelExecution': true,
          'timeout': 900000, // 15 minutes
          'strictMode': false,
        },
      }),
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
      taskTimeout: stepfunctions.Timeout.duration(cdk.Duration.minutes(15)),
    });

    // Add retry configuration for framework analysis
    runFrameworkAnalysis.addRetry({
      errors: ['Lambda.ServiceException', 'Lambda.AWSLambdaException'],
      interval: cdk.Duration.seconds(5),
      maxAttempts: 3,
      backoffRate: 2.0,
    });

    // Conditional Framework Initialization
    const frameworkInitChoice = new stepfunctions.Choice(this, 'CheckFrameworkInitialization')
      .when(
        stepfunctions.Condition.stringEquals('$.requiresInitialization', 'true'),
        initializeFrameworks
      )
      .otherwise(runFrameworkAnalysis);

    // Connect initialization to analysis
    initializeFrameworks.next(runFrameworkAnalysis);

    // Extract Results Task
    const extractResults = new stepfunctions.Pass(this, 'ExtractResults', {
      comment: 'Extract analysis results from framework analysis response',
      parameters: {
        'analysisId.$': '$.result.analysisId',
        'status.$': '$.result.status',
        'overallScore.$': '$.result.aggregatedSummary.overallScore',
        'totalFindings.$': '$.result.aggregatedSummary.totalFindings',
        'frameworks.$': '$.result.frameworks',
        'aggregatedSummary.$': '$.result.aggregatedSummary',
        'completedAt.$': '$$.State.EnteredTime',
        'execution': {
          'executionArn.$': '$$.Execution.Name',
          'stateMachineArn.$': '$$.StateMachine.Name',
        },
      },
      resultPath: '$.aggregated',
    });

    // Store Results Task
    const storeResults = new sfnTasks.LambdaInvoke(this, 'StoreResults', {
      lambdaFunction: resolverFunctions[LAMBDA_FUNCTION_NAMES.STORE_RESULTS],
      payload: stepfunctions.TaskInput.fromJsonPathAt('$.aggregated'),
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
      taskTimeout: stepfunctions.Timeout.duration(cdk.Duration.minutes(5)),
    });

    // Add retry configuration for store results
    storeResults.addRetry({
      errors: ['Lambda.ServiceException', 'Lambda.AWSLambdaException'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2.0,
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
    });

    // Connect the analysis flow to results processing
    runFrameworkAnalysis
      .next(extractResults)
      .next(storeResults)
      .next(analysisSucceeded);

    // Chain the steps together
    const definition = validateInput
      .next(initializeAnalysis)
      .next(frameworkInitChoice);

    // Connect error handler to failure state
    handleError.next(analysisFailed);

    // Add error handling
    initializeAnalysis.addCatch(handleError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    initializeFrameworks.addCatch(handleError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    runFrameworkAnalysis.addCatch(handleError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    storeResults.addCatch(handleError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    return new stepfunctions.StateMachine(this, 'AnalysisStateMachine', {
      stateMachineName: `AnalysisWorkflow-${config.environment}`,
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
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
    _resolverFunctions: Record<string, lambda.Function>,
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

    // Failure State (will be used when error handling is implemented)
    // const _reportGenerationFailed = new stepfunctions.Fail(this, 'ReportGenerationFailed', {
    //   comment: 'Report generation failed',
    //   causePath: '$.errorMessage',
    //   errorPath: '$.errorType',
    // });

    // Connect format branches to metadata storage
    generatePdfReport.next(storeReportMetadata);
    generateExcelReport.next(storeReportMetadata);
    generateJsonReport.next(storeReportMetadata);
    generateHtmlReport.next(storeReportMetadata);

    // Connect metadata storage to success
    storeReportMetadata.next(reportGenerationSucceeded);

    // Chain the steps together (formatChoice branches are defined above)
    const definition = initializeReportGeneration
      .next(fetchAnalysisData)
      .next(formatChoice);

    // Note: Error handling for report generation will be added with actual implementation states

    return new stepfunctions.StateMachine(this, 'ReportGenerationStateMachine', {
      stateMachineName: `ReportGenerationWorkflow-${config.environment}`,
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
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

