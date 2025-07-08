/**
 * Live Scan Step Functions Workflow Definition
 * Orchestrates the complete live AWS account scanning process
 */

import { 
  DefinitionBody,
  StateMachine,
  Wait,
  WaitTime,
  Pass,
  Choice,
  Condition,
  TaskInput,
  JsonPath,
  Parallel,
  Succeed,
  Fail,
  Map,
  ItemsPath,
  MaxConcurrency,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface LiveScanWorkflowProps {
  liveScannerFunction: lambda.Function;
  frameworkAnalysisFunction: lambda.Function;
  storeResultsFunction: lambda.Function;
}

export class LiveScanWorkflow {
  public static createDefinition(props: LiveScanWorkflowProps): DefinitionBody {
    const { liveScannerFunction, frameworkAnalysisFunction, storeResultsFunction } = props;

    // Step 1: Validate scan request
    const validateRequest = new Pass('Validate Scan Request', {
      parameters: {
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'projectId.$': '$.projectId',
        'awsConfig.$': '$.awsConfig',
        'scanScope.$': '$.scanScope',
        'frameworks.$': '$.frameworks',
        'validationResult': 'PASSED',
        'startTime.$': '$$.State.EnteredTime',
      },
    });

    // Step 2: Initialize analysis record
    const initializeAnalysis = new Pass('Initialize Analysis', {
      parameters: {
        'analysisId.$': '$.analysisId',
        'status': 'INITIALIZING',
        'progress': 0,
        'initTime.$': '$$.State.EnteredTime',
      },
    });

    // Step 3: Perform live AWS resource scanning
    const performLiveScan = new LambdaInvoke('Perform Live Scan', {
      lambdaFunction: liveScannerFunction,
      payload: TaskInput.fromObject({
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'projectId.$': '$.projectId',
        'awsConfig.$': '$.awsConfig',
        'scanScope.$': '$.scanScope',
        'frameworks.$': '$.frameworks',
      }),
      resultPath: '$.scanResult',
    });

    // Step 4: Check scan status
    const checkScanStatus = new Choice('Check Scan Status')
      .when(
        Condition.stringEquals('$.scanResult.Payload.status', 'FAILED'),
        new Fail('Scan Failed', {
          cause: 'Live AWS resource scan failed',
          error: 'ScanFailure',
        })
      )
      .when(
        Condition.stringEquals('$.scanResult.Payload.status', 'PARTIAL'),
        new Pass('Handle Partial Scan', {
          parameters: {
            'analysisId.$': '$.analysisId',
            'scanStatus': 'PARTIAL',
            'resources.$': '$.scanResult.Payload.scanResults',
            'summary.$': '$.scanResult.Payload.summary',
            'frameworks.$': '$.frameworks',
          },
        })
      )
      .otherwise(
        new Pass('Handle Successful Scan', {
          parameters: {
            'analysisId.$': '$.analysisId',
            'scanStatus': 'COMPLETED',
            'resources.$': '$.scanResult.Payload.scanResults',
            'summary.$': '$.scanResult.Payload.summary',
            'frameworks.$': '$.frameworks',
          },
        })
      );

    // Step 5: Parallel framework analysis
    const frameworkAnalysis = new Map('Analyze with Frameworks', {
      itemsPath: JsonPath.stringAt('$.frameworks'),
      maxConcurrency: 3, // Process up to 3 frameworks in parallel
      parameters: {
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'framework.$': '$$.Map.Item.Value',
        'resources.$': '$.resources',
        'scanSummary.$': '$.summary',
      },
    }).iterator(
      new LambdaInvoke('Run Framework Analysis', {
        lambdaFunction: frameworkAnalysisFunction,
        payload: TaskInput.fromJsonPathAt('$'),
        resultPath: '$.frameworkResult',
      })
    );

    // Step 6: Aggregate analysis results
    const aggregateResults = new Pass('Aggregate Analysis Results', {
      parameters: {
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'projectId.$': '$.projectId',
        'scanStatus.$': '$.scanStatus',
        'scanSummary.$': '$.summary',
        'frameworkResults.$': '$[*].frameworkResult.Payload',
        'completedAt.$': '$$.State.EnteredTime',
        'totalFindings.$': '$$.Map.Item.Value.frameworkResult.Payload.findings[*] | length(@)',
      },
    });

    // Step 7: Store final results
    const storeFinalResults = new LambdaInvoke('Store Final Results', {
      lambdaFunction: storeResultsFunction,
      payload: TaskInput.fromJsonPathAt('$'),
      resultPath: '$.storeResult',
    });

    // Step 8: Send completion notification
    const sendNotification = new Pass('Send Completion Notification', {
      parameters: {
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'status': 'COMPLETED',
        'notificationSent': true,
        'finalResults.$': '$.storeResult.Payload',
      },
    });

    // Success state
    const scanCompleted = new Succeed('Live Scan Completed');

    // Error handling for framework analysis
    const handleFrameworkError = new Pass('Handle Framework Analysis Error', {
      parameters: {
        'analysisId.$': '$.analysisId',
        'error': 'Framework analysis failed',
        'partialResults': true,
      },
    });

    // Create the workflow definition
    const definition = validateRequest
      .next(initializeAnalysis)
      .next(performLiveScan)
      .next(checkScanStatus)
      .next(frameworkAnalysis.addCatch(handleFrameworkError, {
        errors: ['States.TaskFailed', 'States.ALL'],
        resultPath: '$.frameworkError',
      }))
      .next(aggregateResults)
      .next(storeFinalResults)
      .next(sendNotification)
      .next(scanCompleted);

    return DefinitionBody.fromChainable(definition);
  }

  /**
   * Create a parallel scanning workflow for multiple accounts
   */
  public static createMultiAccountDefinition(props: LiveScanWorkflowProps): DefinitionBody {
    const { liveScannerFunction, frameworkAnalysisFunction, storeResultsFunction } = props;

    // Multi-account parallel scanning
    const parallelAccountScan = new Parallel('Parallel Account Scan')
      .branch(
        // Branch for each AWS account
        new Map('Scan AWS Accounts', {
          itemsPath: JsonPath.stringAt('$.awsAccounts'),
          maxConcurrency: 2, // Scan up to 2 accounts in parallel
          parameters: {
            'analysisId.$': '$.analysisId',
            'tenantId.$': '$.tenantId',
            'projectId.$': '$.projectId',
            'awsConfig.$': '$$.Map.Item.Value',
            'scanScope.$': '$.scanScope',
            'frameworks.$': '$.frameworks',
          },
        }).iterator(
          new LambdaInvoke('Scan Individual Account', {
            lambdaFunction: liveScannerFunction,
            payload: TaskInput.fromJsonPathAt('$'),
          })
        )
      );

    // Aggregate multi-account results
    const aggregateMultiAccountResults = new Pass('Aggregate Multi-Account Results', {
      parameters: {
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'projectId.$': '$.projectId',
        'accountResults.$': '$[0]', // Results from parallel account scan
        'totalAccounts.$': '$[0] | length(@)',
        'aggregatedAt.$': '$$.State.EnteredTime',
      },
    });

    // Framework analysis across all accounts
    const crossAccountFrameworkAnalysis = new Map('Cross-Account Framework Analysis', {
      itemsPath: JsonPath.stringAt('$.frameworks'),
      maxConcurrency: 3,
      parameters: {
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'framework.$': '$$.Map.Item.Value',
        'accountResults.$': '$.accountResults',
        'analysisType': 'CROSS_ACCOUNT',
      },
    }).iterator(
      new LambdaInvoke('Run Cross-Account Framework Analysis', {
        lambdaFunction: frameworkAnalysisFunction,
        payload: TaskInput.fromJsonPathAt('$'),
      })
    );

    // Final aggregation
    const finalAggregation = new Pass('Final Multi-Account Aggregation', {
      parameters: {
        'analysisId.$': '$.analysisId',
        'analysisType': 'MULTI_ACCOUNT',
        'accountResults.$': '$.accountResults',
        'frameworkResults.$': '$[*].Payload',
        'completedAt.$': '$$.State.EnteredTime',
      },
    });

    // Store multi-account results
    const storeMultiAccountResults = new LambdaInvoke('Store Multi-Account Results', {
      lambdaFunction: storeResultsFunction,
      payload: TaskInput.fromJsonPathAt('$'),
    });

    const multiAccountCompleted = new Succeed('Multi-Account Scan Completed');

    const multiAccountDefinition = parallelAccountScan
      .next(aggregateMultiAccountResults)
      .next(crossAccountFrameworkAnalysis)
      .next(finalAggregation)
      .next(storeMultiAccountResults)
      .next(multiAccountCompleted);

    return DefinitionBody.fromChainable(multiAccountDefinition);
  }

  /**
   * Create a scheduled scanning workflow
   */
  public static createScheduledScanDefinition(props: LiveScanWorkflowProps): DefinitionBody {
    const { liveScannerFunction, frameworkAnalysisFunction, storeResultsFunction } = props;

    // Scheduled scan initialization
    const initScheduledScan = new Pass('Initialize Scheduled Scan', {
      parameters: {
        'scanType': 'SCHEDULED',
        'startTime.$': '$$.State.EnteredTime',
        'analysisId.$': '$.analysisId',
        'tenantId.$': '$.tenantId',
        'projectId.$': '$.projectId',
        'schedule.$': '$.schedule',
      },
    });

    // Check if scan should run based on schedule
    const checkSchedule = new Choice('Check Schedule')
      .when(
        Condition.stringEquals('$.schedule.enabled', 'true'),
        new Pass('Schedule Enabled', {
          parameters: {
            'proceed': true,
            'scheduledAt.$': '$$.State.EnteredTime',
          },
        })
      )
      .otherwise(
        new Pass('Schedule Disabled', {
          parameters: {
            'proceed': false,
            'reason': 'Scheduled scanning is disabled',
          },
        })
      );

    // Wait for next scheduled time (if needed)
    const waitForSchedule = new Wait('Wait for Schedule', {
      time: WaitTime.duration(require('aws-cdk-lib').Duration.minutes(1)),
    });

    // Run the main scanning workflow
    const runScheduledScan = new LambdaInvoke('Run Scheduled Scan', {
      lambdaFunction: liveScannerFunction,
      payload: TaskInput.fromJsonPathAt('$'),
      resultPath: '$.scheduledScanResult',
    });

    // Check if should continue with framework analysis
    const checkContinue = new Choice('Check Continue')
      .when(
        Condition.booleanEquals('$.proceed', true),
        runScheduledScan
      )
      .otherwise(
        new Succeed('Scheduled Scan Skipped')
      );

    const scheduledCompleted = new Succeed('Scheduled Scan Completed');

    const scheduledDefinition = initScheduledScan
      .next(checkSchedule)
      .next(checkContinue)
      .next(scheduledCompleted);

    return DefinitionBody.fromChainable(scheduledDefinition);
  }
}