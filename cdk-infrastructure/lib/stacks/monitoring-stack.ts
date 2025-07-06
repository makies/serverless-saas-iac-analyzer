import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rum from 'aws-cdk-lib/aws-rum';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { CLOUDWATCH_METRICS } from '../config/constants';

export interface MonitoringStackProps {
  config: EnvironmentConfig;
  appSyncApi: appsync.GraphqlApi | null;
  lambdaFunctions: Record<string, lambda.Function>;
  description?: string;
}

export class MonitoringStack extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;
  public readonly rumAppMonitor: rum.CfnAppMonitor;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id);

    const { config, appSyncApi, lambdaFunctions } = props;

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `CloudBPA-Alarms-${config.environment}`,
      displayName: 'Cloud Best Practice Analyzer Alarms',
    });

    // Add email subscription for production
    if (config.environment === 'prod') {
      this.alarmTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(config.sbtConfig.systemAdminEmail)
      );
    }

    // CloudWatch RUM App Monitor
    this.rumAppMonitor = this.createRumAppMonitor(config);

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `CloudBPA-${config.environment}`,
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // AppSync Metrics
    this.createAppSyncMetrics(appSyncApi, config);

    // Lambda Metrics
    this.createLambdaMetrics(lambdaFunctions, config);

    // Custom Application Metrics
    this.createApplicationMetrics(config);

    // RUM Metrics
    this.createRumMetrics(config);

    // Alarms
    if (appSyncApi) {
      this.createAlarms(appSyncApi, lambdaFunctions, config);
    }

    // Log Groups with retention
    this.setupLogRetention(lambdaFunctions, config);

    // Tags
    cdk.Tags.of(this.dashboard).add('Environment', config.environment);
    cdk.Tags.of(this.dashboard).add('Project', 'CloudBestPracticeAnalyzer');
    cdk.Tags.of(this.dashboard).add('Service', 'Monitoring');
  }

  private createAppSyncMetrics(api: appsync.GraphqlApi | null, config: EnvironmentConfig) {
    if (!api) {
      // Skip AppSync metrics if API is not provided (e.g., in hybrid mode)
      return;
    }
    // AppSync Request Count
    const appSyncRequestCount = new cloudwatch.Metric({
      namespace: 'AWS/AppSync',
      metricName: '4XXError',
      dimensionsMap: {
        GraphQLAPIId: api.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // AppSync Error Rate
    const appSyncErrorRate = new cloudwatch.Metric({
      namespace: 'AWS/AppSync',
      metricName: '5XXError',
      dimensionsMap: {
        GraphQLAPIId: api.apiId,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // AppSync Latency
    const appSyncLatency = new cloudwatch.Metric({
      namespace: 'AWS/AppSync',
      metricName: 'Latency',
      dimensionsMap: {
        GraphQLAPIId: api.apiId,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'AppSync API Metrics',
        left: [appSyncRequestCount],
        right: [appSyncErrorRate],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'AppSync API Latency',
        left: [appSyncLatency],
        width: 12,
      })
    );
  }

  private createLambdaMetrics(
    functions: Record<string, lambda.Function>,
    config: EnvironmentConfig
  ) {
    const lambdaMetrics = Object.entries(functions).map(([name, func]) => {
      return {
        name,
        duration: func.metricDuration(),
        errors: func.metricErrors(),
        invocations: func.metricInvocations(),
        throttles: func.metricThrottles(),
      };
    });

    // Group Lambda functions by type (query, mutation, etc.)
    const queryFunctions = lambdaMetrics.filter(
      (m) => m.name.toLowerCase().includes('get') || m.name.toLowerCase().includes('list')
    );
    const mutationFunctions = lambdaMetrics.filter(
      (m) =>
        m.name.toLowerCase().includes('create') ||
        m.name.toLowerCase().includes('update') ||
        m.name.toLowerCase().includes('delete') ||
        m.name.toLowerCase().includes('start') ||
        m.name.toLowerCase().includes('generate')
    );

    // Query Lambda Metrics
    if (queryFunctions.length > 0) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Query Lambda Duration',
          left: queryFunctions.map((f) => f.duration),
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Query Lambda Errors',
          left: queryFunctions.map((f) => f.errors),
          width: 12,
        })
      );
    }

    // Mutation Lambda Metrics
    if (mutationFunctions.length > 0) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Mutation Lambda Duration',
          left: mutationFunctions.map((f) => f.duration),
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Mutation Lambda Errors',
          left: mutationFunctions.map((f) => f.errors),
          width: 12,
        })
      );
    }

    // Lambda Throttles (all functions)
    const allThrottles = lambdaMetrics.map((f) => f.throttles);
    if (allThrottles.length > 0) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda Throttles',
          left: allThrottles,
          width: 24,
        })
      );
    }
  }

  private createApplicationMetrics(config: EnvironmentConfig) {
    // Custom application metrics
    const analysisCount = new cloudwatch.Metric({
      namespace: CLOUDWATCH_METRICS.NAMESPACE,
      metricName: CLOUDWATCH_METRICS.ANALYSIS_COUNT,
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    const analysisSuccessRate = new cloudwatch.MathExpression({
      expression: '100 - (failures / total * 100)',
      usingMetrics: {
        total: new cloudwatch.Metric({
          namespace: CLOUDWATCH_METRICS.NAMESPACE,
          metricName: CLOUDWATCH_METRICS.ANALYSIS_COUNT,
          statistic: 'Sum',
        }),
        failures: new cloudwatch.Metric({
          namespace: CLOUDWATCH_METRICS.NAMESPACE,
          metricName: CLOUDWATCH_METRICS.ERROR_RATE,
          statistic: 'Sum',
        }),
      },
      period: cdk.Duration.hours(1),
    });

    const tenantCount = new cloudwatch.Metric({
      namespace: CLOUDWATCH_METRICS.NAMESPACE,
      metricName: CLOUDWATCH_METRICS.TENANT_COUNT,
      statistic: 'Maximum',
      period: cdk.Duration.hours(24),
    });

    const quotaUsage = new cloudwatch.Metric({
      namespace: CLOUDWATCH_METRICS.NAMESPACE,
      metricName: CLOUDWATCH_METRICS.QUOTA_USAGE,
      statistic: 'Maximum',
      period: cdk.Duration.hours(1),
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Analysis Metrics',
        left: [analysisCount],
        right: [analysisSuccessRate],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'System Metrics',
        left: [tenantCount],
        right: [quotaUsage],
        width: 12,
      })
    );

    // Number widgets for key KPIs
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Active Tenants',
        metrics: [tenantCount],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Daily Analyses',
        metrics: [analysisCount],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Success Rate %',
        metrics: [analysisSuccessRate],
        width: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Quota Usage %',
        metrics: [quotaUsage],
        width: 6,
      })
    );
  }

  private createAlarms(
    api: appsync.GraphqlApi,
    functions: Record<string, lambda.Function>,
    config: EnvironmentConfig
  ) {
    // AppSync Error Rate Alarm
    const appSyncErrorAlarm = new cloudwatch.Alarm(this, 'AppSyncErrorAlarm', {
      alarmName: `CloudBPA-AppSync-ErrorRate-${config.environment}`,
      alarmDescription: 'AppSync API error rate is too high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/AppSync',
        metricName: '5XXError',
        dimensionsMap: {
          GraphQLAPIId: api.apiId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: config.environment === 'prod' ? 10 : 20,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    appSyncErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // Lambda Error Rate Alarms
    Object.entries(functions).forEach(([name, func]) => {
      const errorAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        alarmName: `CloudBPA-${name}-ErrorRate-${config.environment}`,
        alarmDescription: `${name} Lambda function error rate is too high`,
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5),
        }),
        threshold: config.environment === 'prod' ? 5 : 10,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

      // Duration Alarm for critical functions
      if (name.includes('Analysis') || name.includes('Report')) {
        const durationAlarm = new cloudwatch.Alarm(this, `${name}DurationAlarm`, {
          alarmName: `CloudBPA-${name}-Duration-${config.environment}`,
          alarmDescription: `${name} Lambda function duration is too high`,
          metric: func.metricDuration({
            period: cdk.Duration.minutes(5),
          }),
          threshold: config.lambdaConfig.timeout * 1000 * 0.8, // 80% of timeout
          evaluationPeriods: 3,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

        durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
      }
    });

    // Quota Usage Alarm
    const quotaAlarm = new cloudwatch.Alarm(this, 'QuotaUsageAlarm', {
      alarmName: `CloudBPA-QuotaUsage-${config.environment}`,
      alarmDescription: 'Monthly analysis quota usage is high',
      metric: new cloudwatch.Metric({
        namespace: CLOUDWATCH_METRICS.NAMESPACE,
        metricName: CLOUDWATCH_METRICS.QUOTA_USAGE,
        statistic: 'Maximum',
        period: cdk.Duration.hours(1),
      }),
      threshold: 80, // 80% of quota
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    quotaAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  private setupLogRetention(functions: Record<string, lambda.Function>, config: EnvironmentConfig) {
    // Set log retention for all Lambda functions
    Object.entries(functions).forEach(([name, func]) => {
      new logs.LogGroup(this, `${name}LogGroup`, {
        logGroupName: `/aws/lambda/${func.functionName}`,
        retention: this.getLogRetention(config.monitoringConfig.logRetentionDays),
        removalPolicy:
          config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    });
  }

  private getLogRetention(days: number): logs.RetentionDays {
    const retentionMap: Record<number, logs.RetentionDays> = {
      1: logs.RetentionDays.ONE_DAY,
      3: logs.RetentionDays.THREE_DAYS,
      5: logs.RetentionDays.FIVE_DAYS,
      7: logs.RetentionDays.ONE_WEEK,
      14: logs.RetentionDays.TWO_WEEKS,
      30: logs.RetentionDays.ONE_MONTH,
      60: logs.RetentionDays.TWO_MONTHS,
      90: logs.RetentionDays.THREE_MONTHS,
      120: logs.RetentionDays.FOUR_MONTHS,
      150: logs.RetentionDays.FIVE_MONTHS,
      180: logs.RetentionDays.SIX_MONTHS,
      365: logs.RetentionDays.ONE_YEAR,
      400: logs.RetentionDays.THIRTEEN_MONTHS,
      545: logs.RetentionDays.EIGHTEEN_MONTHS,
      731: logs.RetentionDays.TWO_YEARS,
      1827: logs.RetentionDays.FIVE_YEARS,
      3653: logs.RetentionDays.TEN_YEARS,
    };

    return retentionMap[days] || logs.RetentionDays.ONE_MONTH;
  }

  private createRumAppMonitor(config: EnvironmentConfig): rum.CfnAppMonitor {
    // Create IAM role for RUM to write to CloudWatch
    const rumRole = new iam.Role(this, 'RumRole', {
      assumedBy: new iam.ServicePrincipal('rum.amazonaws.com'),
      inlinePolicies: {
        RumServicePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:PutLogEvents',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
                'cognito-identity:*',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Create RUM App Monitor
    const rumMonitor = new rum.CfnAppMonitor(this, 'RumAppMonitor', {
      name: `cloud-bpa-${config.environment}`,
      domain: config.domainName || 'localhost',
      cwLogEnabled: true,
      sessionSampleRate: config.environment === 'prod' ? 0.1 : 1.0,
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: true,
        sessionSampleRate: config.environment === 'prod' ? 0.1 : 1.0,
        telemetries: ['errors', 'performance', 'http'],
        guestRoleArn: rumRole.roleArn,
      },
      customEvents: {
        status: 'ENABLED',
      },
      tags: [
        { key: 'Environment', value: config.environment },
        { key: 'Project', value: 'CloudBestPracticeAnalyzer' },
        { key: 'Service', value: 'Frontend' },
      ],
    });

    // Create CloudWatch Log Group for RUM
    new logs.LogGroup(this, 'RumLogGroup', {
      logGroupName: `/aws/rum/${config.environment}`,
      retention: this.getLogRetention(config.monitoringConfig.logRetentionDays),
      removalPolicy:
        config.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    return rumMonitor;
  }

  private createRumMetrics(config: EnvironmentConfig) {
    // RUM Error Rate
    const rumErrorRate = new cloudwatch.Metric({
      namespace: 'AWS/RUM',
      metricName: 'JsErrorCount',
      dimensionsMap: {
        application_name: `cloud-bpa-${config.environment}`,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // RUM Page Load Time
    const rumPageLoadTime = new cloudwatch.Metric({
      namespace: 'AWS/RUM',
      metricName: 'PageLoadTime',
      dimensionsMap: {
        application_name: `cloud-bpa-${config.environment}`,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // RUM Core Web Vitals - First Contentful Paint
    const rumFcp = new cloudwatch.Metric({
      namespace: 'AWS/RUM',
      metricName: 'FirstContentfulPaint',
      dimensionsMap: {
        application_name: `cloud-bpa-${config.environment}`,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // RUM Core Web Vitals - Largest Contentful Paint
    const rumLcp = new cloudwatch.Metric({
      namespace: 'AWS/RUM',
      metricName: 'LargestContentfulPaint',
      dimensionsMap: {
        application_name: `cloud-bpa-${config.environment}`,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // RUM Core Web Vitals - Cumulative Layout Shift
    const rumCls = new cloudwatch.Metric({
      namespace: 'AWS/RUM',
      metricName: 'CumulativeLayoutShift',
      dimensionsMap: {
        application_name: `cloud-bpa-${config.environment}`,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // RUM Session Count
    const rumSessionCount = new cloudwatch.Metric({
      namespace: 'AWS/RUM',
      metricName: 'SessionCount',
      dimensionsMap: {
        application_name: `cloud-bpa-${config.environment}`,
      },
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    // Add RUM widgets to dashboard
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Frontend Error Rate',
        left: [rumErrorRate],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Page Load Performance',
        left: [rumPageLoadTime],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Core Web Vitals',
        left: [rumFcp, rumLcp],
        right: [rumCls],
        width: 24,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Active Sessions',
        metrics: [rumSessionCount],
        width: 6,
      })
    );

    // RUM-specific alarms
    if (config.environment === 'prod') {
      // High error rate alarm
      const rumErrorAlarm = new cloudwatch.Alarm(this, 'RumErrorAlarm', {
        alarmName: `CloudBPA-RUM-ErrorRate-${config.environment}`,
        alarmDescription: 'Frontend error rate is too high',
        metric: rumErrorRate,
        threshold: 50,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      rumErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

      // Poor page load performance alarm
      const rumPerformanceAlarm = new cloudwatch.Alarm(this, 'RumPerformanceAlarm', {
        alarmName: `CloudBPA-RUM-Performance-${config.environment}`,
        alarmDescription: 'Page load time is too slow',
        metric: rumPageLoadTime,
        threshold: 3000, // 3 seconds
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      rumPerformanceAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    }
  }
}
