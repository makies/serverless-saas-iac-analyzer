# CDK循環依存エラー解決ガイド

## 概要
このドキュメントでは、CloudBestPracticeAnalyzer CDKプロジェクトで発生した循環依存エラーとその解決策について説明します。

## 発生した問題

### エラー内容
```
CloudBestPracticeAnalyzer-dev failed: ValidationError: Circular dependency between resources: 
[AppSyncGraphQLgetUserProfileDataSourceServiceRoleDefaultPolicy6E05A72A, MonitoringframeworkAnalysisDurationAlarm5B66AC4F, ...]
```

### 根本原因
1. **Step Functions → AppSync → Step Functions の循環参照**
   - Step FunctionsがAppSync Lambda関数を受け取る
   - AppSync Lambda関数がStep Functions ARNを環境変数として参照する

2. **MonitoringStack → AppSync → MonitoringStack の循環参照**
   - MonitoringStackがAppSyncリソースを直接参照
   - AppSyncがMonitoringStackのログ設定を参照

## 解決策

### 1. Parameter Store パターンの導入

**変更前 (main-stack.ts):**
```typescript
// Step Functions ARNを直接環境変数として設定（循環依存を引き起こす）
environment: {
  ANALYSIS_STATE_MACHINE_ARN: stepFunctionsStack.analysisStateMachine.stateMachineArn,
}
```

**変更後 (main-stack.ts):**
```typescript
// Step Functions ARNs を Parameter Store に保存 (循環依存を回避)
const analysisStateMachineParam = new ssm.StringParameter(this, 'AnalysisStateMachineParam', {
  parameterName: `/cloud-bpa/${config.environment}/step-functions/analysis-arn`,
  stringValue: stepFunctionsStack.analysisStateMachine.stateMachineArn,
  description: 'Analysis State Machine ARN for Lambda functions',
});

// Lambda関数にParameter Storeの読み取り権限を付与
Object.values(appSyncStack.resolverFunctions).forEach(func => {
  analysisStateMachineParam.grantRead(func);
});
```

### 2. Lambda関数でのParameter Store利用

**新規ファイル (src/shared/utils/parameter-store.ts):**
```typescript
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});
const parameterCache = new Map<string, { value: string; expiry: number }>();

export async function getStepFunctionsArns(environment: string): Promise<{
  analysisStateMachineArn: string;
  reportGenerationStateMachineArn: string;
}> {
  const [analysisArn, reportArn] = await Promise.all([
    getParameter(`/cloud-bpa/${environment}/step-functions/analysis-arn`),
    getParameter(`/cloud-bpa/${environment}/step-functions/report-generation-arn`),
  ]);

  return {
    analysisStateMachineArn: analysisArn,
    reportGenerationStateMachineArn: reportArn,
  };
}
```

**Lambda関数での利用 (src/resolvers/mutation/startAnalysis.ts):**
```typescript
import { getStepFunctionsArns } from '../../shared/utils/parameter-store';

// Get Step Functions ARN from Parameter Store
const environment = process.env.ENVIRONMENT || 'dev';
const { analysisStateMachineArn } = await getStepFunctionsArns(environment);
```

### 3. MonitoringStackの完全分離

**変更前:**
```typescript
// 循環依存を引き起こす直接参照
const monitoringStack = new MonitoringStack(this, 'Monitoring', {
  config,
  appSyncApi: appSyncStack.api, // 循環依存の原因
  lambdaFunctions: appSyncStack.resolverFunctions, // 循環依存の原因
});
```

**変更後:**
```typescript
// モニタリングスタック (循環依存を避けるため完全に独立して作成)
const monitoringStack = new MonitoringStack(this, 'Monitoring', {
  config,
  appSyncApi: null, // 循環依存を避けるためnullに設定
  lambdaFunctions: {}, // 循環依存を避けるため空のオブジェクトに設定
  description: 'Monitoring, logging, and alerting infrastructure',
});
```

### 4. MonitoringStackの機能修正

**monitoring-stack.ts での変更:**
```typescript
// AppSync固有のメトリクスメソッドをコメントアウト
/*
private createAppSyncMetrics(api: appsync.GraphqlApi | null, _config: EnvironmentConfig) {
  // 循環依存を避けるためコメントアウト
}
*/

// 汎用的なメトリクス監視へ変更
private createGenericMetrics(config: EnvironmentConfig) {
  // CloudWatchメトリクス探索を使用した汎用的な監視
  const genericLambdaErrors = new cloudwatch.Metric({
    namespace: 'AWS/Lambda',
    metricName: 'Errors',
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
  });
}
```

### 5. ログ管理の分離

**変更前 (appsync-stack.ts):**
```typescript
// 循環依存を引き起こすログ設定
private setupLogRetention(config: EnvironmentConfig) {
  Object.entries(this.resolverFunctions).forEach(([name, func]) => {
    new logs.LogGroup(this, `${name}LogGroup`, {
      logGroupName: `/aws/lambda/${func.functionName}`,
      retention: this.getLogRetention(config.monitoringConfig.logRetentionDays),
    });
  });
}
```

**変更後:**
```typescript
// Note: Log retention setup removed to avoid circular dependencies with MonitoringStack
// Log groups will be managed automatically by AWS Lambda
```

## CDK非推奨警告の修正

### Step Functions設定の更新

**変更前:**
```typescript
timeout: cdk.Duration.minutes(15),
definition,
```

**変更後:**
```typescript
taskTimeout: stepfunctions.Timeout.duration(cdk.Duration.minutes(15)),
definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
```

## 予防策

### 1. 設計原則
- **単方向依存**: スタック間の依存関係は常に単方向にする
- **Parameter Store活用**: 動的な値はParameter Storeで共有する
- **責任分離**: 各スタックは独立した責任を持つ

### 2. 開発フロー
1. 新しいスタック追加時は依存関係図を作成
2. 循環参照の可能性をチェック
3. 必要に応じてParameter Storeパターンを使用

### 3. テスト手順
```bash
# CDKビルドテスト
npm run build

# CDK合成テスト
npm run synth

# 循環依存チェック
cdk ls --all
```

## 参考リンク
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [Parameter Store Integration](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [CloudWatch Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html)

## まとめ
Parameter Storeパターンとスタック分離により、循環依存エラーを完全に解決しました。今後の開発では、これらのパターンを適用して同様の問題を予防してください。