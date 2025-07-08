/**
 * Live Scan Step Functions Workflow Definition
 * Orchestrates the complete live AWS account scanning process
 */

import { DefinitionBody } from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface LiveScanWorkflowProps {
  liveScannerFunction: lambda.Function;
  frameworkAnalysisFunction: lambda.Function;
  storeResultsFunction: lambda.Function;
}

export class LiveScanWorkflow {
  public static createDefinition(props: LiveScanWorkflowProps): DefinitionBody {
    const { liveScannerFunction, frameworkAnalysisFunction, storeResultsFunction } = props;

    const definition = {
      Comment: "Live AWS Account Scanning Workflow",
      StartAt: "ValidateRequest",
      States: {
        ValidateRequest: {
          Type: "Pass",
          Parameters: {
            "analysisId.$": "$.analysisId",
            "tenantId.$": "$.tenantId",
            "projectId.$": "$.projectId",
            "awsConfig.$": "$.awsConfig",
            "scanScope.$": "$.scanScope",
            "frameworks.$": "$.frameworks",
            "validationResult": "PASSED",
            "startTime.$": "$$.State.EnteredTime"
          },
          Next: "InitializeAnalysis"
        },
        InitializeAnalysis: {
          Type: "Pass",
          Parameters: {
            "analysisId.$": "$.analysisId",
            "status": "INITIALIZING",
            "progress": 0,
            "initTime.$": "$$.State.EnteredTime"
          },
          Next: "PerformLiveScan"
        },
        PerformLiveScan: {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: liveScannerFunction.functionArn,
            Payload: {
              "analysisId.$": "$.analysisId",
              "tenantId.$": "$.tenantId",
              "projectId.$": "$.projectId",
              "awsConfig.$": "$.awsConfig",
              "scanScope.$": "$.scanScope",
              "frameworks.$": "$.frameworks"
            }
          },
          ResultPath: "$.scanResult",
          Next: "CheckScanStatus",
          Retry: [
            {
              ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"],
              IntervalSeconds: 5,
              MaxAttempts: 3,
              BackoffRate: 2.0
            }
          ],
          Catch: [
            {
              ErrorEquals: ["States.ALL"],
              Next: "ScanFailed",
              ResultPath: "$.error"
            }
          ]
        },
        CheckScanStatus: {
          Type: "Choice",
          Choices: [
            {
              Variable: "$.scanResult.Payload.status",
              StringEquals: "FAILED",
              Next: "ScanFailed"
            },
            {
              Variable: "$.scanResult.Payload.status",
              StringEquals: "COMPLETED",
              Next: "ProcessFrameworks"
            }
          ],
          Default: "WaitForScan"
        },
        WaitForScan: {
          Type: "Wait",
          Seconds: 30,
          Next: "PerformLiveScan"
        },
        ProcessFrameworks: {
          Type: "Map",
          ItemsPath: "$.frameworks",
          MaxConcurrency: 3,
          Iterator: {
            StartAt: "AnalyzeFramework",
            States: {
              AnalyzeFramework: {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: {
                  FunctionName: frameworkAnalysisFunction.functionArn,
                  Payload: {
                    "analysisId.$": "$.analysisId",
                    "framework.$": "$",
                    "scanResult.$": "$.scanResult.Payload"
                  }
                },
                End: true
              }
            }
          },
          ResultPath: "$.frameworkResults",
          Next: "StoreResults"
        },
        StoreResults: {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: storeResultsFunction.functionArn,
            Payload: {
              "analysisId.$": "$.analysisId",
              "tenantId.$": "$.tenantId",
              "projectId.$": "$.projectId",
              "scanResult.$": "$.scanResult.Payload",
              "frameworkResults.$": "$.frameworkResults",
              "completedAt.$": "$$.State.EnteredTime"
            }
          },
          ResultPath: "$.storeResult",
          Next: "ScanCompleted",
          Retry: [
            {
              ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException"],
              IntervalSeconds: 5,
              MaxAttempts: 3,
              BackoffRate: 2.0
            }
          ]
        },
        ScanCompleted: {
          Type: "Pass",
          Parameters: {
            "status": "COMPLETED",
            "analysisId.$": "$.analysisId",
            "completedAt.$": "$$.State.EnteredTime",
            "scanSummary.$": "$.scanResult.Payload.summary",
            "frameworkSummary.$": "$.frameworkResults"
          },
          End: true
        },
        ScanFailed: {
          Type: "Fail",
          Cause: "Live AWS resource scan failed",
          Error: "ScanFailure"
        }
      }
    };

    return DefinitionBody.fromString(JSON.stringify(definition));
  }

  public static createMultiAccountDefinition(props: LiveScanWorkflowProps): DefinitionBody {
    const { liveScannerFunction, frameworkAnalysisFunction, storeResultsFunction } = props;

    const definition = {
      Comment: "Multi-Account Live AWS Scanning Workflow",
      StartAt: "ValidateMultiAccountRequest",
      States: {
        ValidateMultiAccountRequest: {
          Type: "Pass",
          Parameters: {
            "scanId.$": "$.scanId",
            "tenantId.$": "$.tenantId",
            "projectId.$": "$.projectId",
            "accountIds.$": "$.accountIds",
            "frameworks.$": "$.frameworks",
            "scanScope.$": "$.scanScope",
            "startTime.$": "$$.State.EnteredTime"
          },
          Next: "ProcessAccounts"
        },
        ProcessAccounts: {
          Type: "Map",
          ItemsPath: "$.accountIds",
          MaxConcurrency: 5,
          Iterator: {
            StartAt: "ScanAccount",
            States: {
              ScanAccount: {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: {
                  FunctionName: liveScannerFunction.functionArn,
                  Payload: {
                    "accountId.$": "$",
                    "tenantId.$": "$.tenantId",
                    "projectId.$": "$.projectId",
                    "frameworks.$": "$.frameworks",
                    "scanScope.$": "$.scanScope"
                  }
                },
                Next: "AnalyzeAccountFrameworks",
                Retry: [
                  {
                    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
                    IntervalSeconds: 5,
                    MaxAttempts: 2,
                    BackoffRate: 2.0
                  }
                ],
                Catch: [
                  {
                    ErrorEquals: ["States.ALL"],
                    Next: "AccountScanFailed",
                    ResultPath: "$.error"
                  }
                ]
              },
              AnalyzeAccountFrameworks: {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: {
                  FunctionName: frameworkAnalysisFunction.functionArn,
                  Payload: {
                    "accountId.$": "$",
                    "scanResult.$": "$.Payload",
                    "frameworks.$": "$.frameworks"
                  }
                },
                Next: "AccountScanCompleted",
                Retry: [
                  {
                    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
                    IntervalSeconds: 5,
                    MaxAttempts: 2,
                    BackoffRate: 2.0
                  }
                ]
              },
              AccountScanCompleted: {
                Type: "Pass",
                Parameters: {
                  "accountId.$": "$.accountId",
                  "status": "COMPLETED",
                  "scanResult.$": "$.Payload"
                },
                End: true
              },
              AccountScanFailed: {
                Type: "Pass",
                Parameters: {
                  "accountId.$": "$.accountId",
                  "status": "FAILED",
                  "error.$": "$.error"
                },
                End: true
              }
            }
          },
          ResultPath: "$.accountResults",
          Next: "StoreMultiAccountResults"
        },
        StoreMultiAccountResults: {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: storeResultsFunction.functionArn,
            Payload: {
              "scanId.$": "$.scanId",
              "tenantId.$": "$.tenantId",
              "projectId.$": "$.projectId",
              "accountResults.$": "$.accountResults",
              "completedAt.$": "$$.State.EnteredTime"
            }
          },
          Next: "MultiAccountScanCompleted"
        },
        MultiAccountScanCompleted: {
          Type: "Pass",
          Parameters: {
            "status": "COMPLETED",
            "scanId.$": "$.scanId",
            "completedAt.$": "$$.State.EnteredTime",
            "totalAccounts.$": "$.accountResults.length",
            "results.$": "$.accountResults"
          },
          End: true
        }
      }
    };

    return DefinitionBody.fromString(JSON.stringify(definition));
  }

  public static createScheduledScanDefinition(props: LiveScanWorkflowProps): DefinitionBody {
    const { liveScannerFunction, frameworkAnalysisFunction, storeResultsFunction } = props;

    const definition = {
      Comment: "Scheduled Live AWS Scanning Workflow",
      StartAt: "ValidateScheduledRequest",
      States: {
        ValidateScheduledRequest: {
          Type: "Pass",
          Parameters: {
            "scheduleId.$": "$.scheduleId",
            "tenantId.$": "$.tenantId",
            "projectId.$": "$.projectId",
            "repositoryIds.$": "$.repositoryIds",
            "frameworks.$": "$.frameworks",
            "triggeredBy": "SCHEDULED",
            "startTime.$": "$$.State.EnteredTime"
          },
          Next: "ProcessRepositories"
        },
        ProcessRepositories: {
          Type: "Map",
          ItemsPath: "$.repositoryIds",
          MaxConcurrency: 3,
          Iterator: {
            StartAt: "ScanRepository",
            States: {
              ScanRepository: {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: {
                  FunctionName: liveScannerFunction.functionArn,
                  Payload: {
                    "repositoryId.$": "$",
                    "tenantId.$": "$.tenantId",
                    "projectId.$": "$.projectId",
                    "frameworks.$": "$.frameworks",
                    "scanType": "SCHEDULED"
                  }
                },
                Next: "AnalyzeRepositoryFrameworks",
                Retry: [
                  {
                    ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
                    IntervalSeconds: 10,
                    MaxAttempts: 2,
                    BackoffRate: 2.0
                  }
                ]
              },
              AnalyzeRepositoryFrameworks: {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: {
                  FunctionName: frameworkAnalysisFunction.functionArn,
                  Payload: {
                    "repositoryId.$": "$",
                    "scanResult.$": "$.Payload",
                    "frameworks.$": "$.frameworks"
                  }
                },
                End: true
              }
            }
          },
          ResultPath: "$.repositoryResults",
          Next: "StoreScheduledResults"
        },
        StoreScheduledResults: {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: storeResultsFunction.functionArn,
            Payload: {
              "scheduleId.$": "$.scheduleId",
              "tenantId.$": "$.tenantId",
              "projectId.$": "$.projectId",
              "repositoryResults.$": "$.repositoryResults",
              "completedAt.$": "$$.State.EnteredTime"
            }
          },
          Next: "ScheduledScanCompleted"
        },
        ScheduledScanCompleted: {
          Type: "Pass",
          Parameters: {
            "status": "COMPLETED",
            "scheduleId.$": "$.scheduleId",
            "completedAt.$": "$$.State.EnteredTime",
            "totalRepositories.$": "$.repositoryResults.length",
            "results.$": "$.repositoryResults"
          },
          End: true
        }
      }
    };

    return DefinitionBody.fromString(JSON.stringify(definition));
  }
}