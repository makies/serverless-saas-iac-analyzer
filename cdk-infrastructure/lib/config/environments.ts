export interface EnvironmentConfig {
  environment: string;
  account?: string;
  region: string;
  domainName?: string;
  certificateArn?: string;

  // Cognito設定
  cognitoConfig: {
    userPoolName: string;
    allowedOrigins: string[];
  };

  // AppSync設定
  appSyncConfig: {
    name: string;
    logLevel: 'NONE' | 'ERROR' | 'ALL';
    fieldLogLevel: 'NONE' | 'ERROR' | 'ALL';
  };

  // DynamoDB設定
  dynamoDbConfig: {
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
    pointInTimeRecovery: boolean;
    encryption: boolean;
  };

  // Lambda設定
  lambdaConfig: {
    runtime: string;
    timeout: number;
    memorySize: number;
    logLevel: string;
    environment: Record<string, string>;
  };

  // S3設定
  s3Config: {
    bucketName: string;
    versioning: boolean;
    encryption: boolean;
  };

  // Bedrock設定
  bedrockConfig: {
    modelId: string;
    region: string;
  };

  // SBT設定
  sbtConfig: {
    systemAdminEmail: string;
    controlPlaneName: string;
  };

  // SES設定
  sesConfig: {
    fromEmail: string;
    replyToEmail: string;
  };

  // GitHub統合設定
  githubConfig: {
    clientId: string;
    clientSecret: string;
    webhookSecret: string;
    appName: string;
  };

  // モニタリング設定
  monitoringConfig: {
    enableXRay: boolean;
    enableCloudWatch: boolean;
    logRetentionDays: number;
  };

  // RUM設定
  rumConfig?: {
    identityPoolId?: string;
    sessionSampleRate?: number;
  };
}

const baseConfig: Omit<EnvironmentConfig, 'environment' | 'account' | 'region'> = {
  cognitoConfig: {
    userPoolName: 'CloudBestPracticeAnalyzer',
    allowedOrigins: ['http://localhost:3000'],
  },

  appSyncConfig: {
    name: 'CloudBestPracticeAnalyzerAPI',
    logLevel: 'ERROR',
    fieldLogLevel: 'ERROR',
  },

  dynamoDbConfig: {
    billingMode: 'PAY_PER_REQUEST',
    pointInTimeRecovery: true,
    encryption: true,
  },

  lambdaConfig: {
    runtime: 'nodejs22.x',
    timeout: 30,
    memorySize: 512,
    logLevel: 'INFO',
    environment: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--enable-source-maps',
    },
  },

  s3Config: {
    bucketName: 'cloud-best-practice-analyzer',
    versioning: true,
    encryption: true,
  },

  bedrockConfig: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    region: 'ap-northeast-1',
  },

  sbtConfig: {
    systemAdminEmail: 'admin@cloudbpa.com',
    controlPlaneName: 'CloudBPA-ControlPlane',
  },

  githubConfig: {
    clientId: process.env.GITHUB_CLIENT_ID || 'your-github-client-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'your-webhook-secret',
    appName: 'CloudBPA-GitHub-Integration',
  },

  monitoringConfig: {
    enableXRay: true,
    enableCloudWatch: true,
    logRetentionDays: 30,
  },

  sesConfig: {
    fromEmail: 'noreply@cloudbpa.com',
    replyToEmail: 'support@cloudbpa.com',
  },
};

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    ...baseConfig,
    environment: 'dev',
    region: 'ap-northeast-1',
    cognitoConfig: {
      ...baseConfig.cognitoConfig,
      allowedOrigins: ['http://localhost:3000', 'https://dev.cloudbpa.com'],
    },
    sbtConfig: {
      systemAdminEmail: 'admin@dev.cloudbpa.com',
      controlPlaneName: 'CloudBPA-Dev-ControlPlane',
    },
    lambdaConfig: {
      ...baseConfig.lambdaConfig,
      logLevel: 'DEBUG',
      timeout: 60,
    },
    monitoringConfig: {
      ...baseConfig.monitoringConfig,
      logRetentionDays: 7,
    },
  },

  staging: {
    ...baseConfig,
    environment: 'staging',
    region: 'us-east-1',
    cognitoConfig: {
      ...baseConfig.cognitoConfig,
      allowedOrigins: ['https://staging.cloudbpa.com'],
    },
    sbtConfig: {
      systemAdminEmail: 'admin@staging.cloudbpa.com',
      controlPlaneName: 'CloudBPA-Staging-ControlPlane',
    },
    monitoringConfig: {
      ...baseConfig.monitoringConfig,
      logRetentionDays: 14,
    },
  },

  prod: {
    ...baseConfig,
    environment: 'prod',
    region: 'us-east-1',
    cognitoConfig: {
      ...baseConfig.cognitoConfig,
      allowedOrigins: ['https://app.cloudbpa.com'],
    },
    sbtConfig: {
      systemAdminEmail: 'admin@cloudbpa.com',
      controlPlaneName: 'CloudBPA-Prod-ControlPlane',
    },
    appSyncConfig: {
      ...baseConfig.appSyncConfig,
      logLevel: 'ERROR',
      fieldLogLevel: 'NONE',
    },
    lambdaConfig: {
      ...baseConfig.lambdaConfig,
      memorySize: 1024,
      timeout: 300,
    },
    monitoringConfig: {
      ...baseConfig.monitoringConfig,
      logRetentionDays: 90,
    },
  },
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) {
    throw new Error(`Environment configuration not found for: ${envName}`);
  }
  return config;
}
