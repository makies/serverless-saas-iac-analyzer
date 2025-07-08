import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * GraphQL schema for Cloud Best Practice Analyzer
 * 
 * Features:
 * - Multi-tenant data isolation
 * - Real-time subscriptions
 * - Role-based access control
 * - DataStore offline support
 * - Custom business logic via Lambda resolvers
 */
const schema = a.schema({
  // Tenant Management
  Tenant: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      status: a.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
      adminEmail: a.email().required(),
      subscription: a.json(),
      settings: a.json(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      
      // Relations
      projects: a.hasMany('Project', 'tenantId'),
      users: a.hasMany('User', 'tenantId'),
      analyses: a.hasMany('Analysis', 'tenantId'),
      reports: a.hasMany('Report', 'tenantId'),
      awsAccounts: a.hasMany('AwsAccount', 'tenantId'),
      gitRepositories: a.hasMany('GitRepository', 'tenantId'),
      gitConnections: a.hasMany('GitConnection', 'tenantId'),
      analysisSchedules: a.hasMany('AnalysisSchedule', 'tenantId'),
      multiAccountScanSchedules: a.hasMany('MultiAccountScanSchedule', 'tenantId'),
      multiAccountScanResults: a.hasMany('MultiAccountScanResult', 'tenantId'),
      differentialAnalyses: a.hasMany('DifferentialAnalysis', 'tenantId'),
    })
    .authorization((allow) => [
      // Production authorization
      allow.groups(['SystemAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ClientAdmins']).to(['read', 'update']),
      // Development bypass - remove in production
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ]),

  // Project Management  
  Project: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      name: a.string().required(),
      description: a.string(),
      status: a.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
      memberIds: a.string().array().required(),
      settings: a.json(),
      metrics: a.json(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      awsAccounts: a.hasMany('AwsAccount', 'projectId'),
      analyses: a.hasMany('Analysis', 'projectId'),
      reports: a.hasMany('Report', 'projectId'),
      gitRepositories: a.hasMany('GitRepository', 'projectId'),
      analysisSchedules: a.hasMany('AnalysisSchedule', 'projectId'),
      multiAccountScanSchedules: a.hasMany('MultiAccountScanSchedule', 'projectId'),
      multiAccountScanResults: a.hasMany('MultiAccountScanResult', 'projectId'),
      differentialAnalyses: a.hasMany('DifferentialAnalysis', 'projectId'),
    })
    .authorization((allow) => [
      // Production authorization
      allow.groups(['SystemAdmins', 'ClientAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ProjectManagers']).to(['read', 'update']),
      allow.groups(['Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
      // Development bypass - remove in production
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('status').sortKeys(['updatedAt']).name('byStatus'),
    ]),

  // AWS Account Management
  AwsAccount: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      accountId: a.string().required(),
      accountName: a.string().required(),
      environment: a.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST', 'SANDBOX']),
      region: a.string().required(),
      roleArn: a.string().required(),
      externalId: a.string(),
      owner: a.enum(['CUSTOMER', 'COMPANY']), // 顧客企業 or 弊社
      supportPlan: a.enum(['BASIC', 'DEVELOPER', 'BUSINESS', 'ENTERPRISE', 'UNKNOWN']),
      organizationId: a.string(),
      masterAccountId: a.string(),
      isActive: a.boolean().required(),
      lastScanDate: a.datetime(),
      nextScanDate: a.datetime(),
      credentials: a.json(), // Encrypted AWS credentials metadata
      settings: a.json(),
      metadata: a.json(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      analyses: a.hasMany('Analysis', 'accountId'),
    })
    .authorization((allow) => [
      // Production authorization
      allow.groups(['SystemAdmins', 'ClientAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ProjectManagers']).to(['read', 'update']),
      allow.groups(['Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
      // Development bypass - remove in production
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['environment']).name('byProject'),
      index('accountId').name('byAccountId'),
      index('environment').sortKeys(['updatedAt']).name('byEnvironment'),
      index('owner').sortKeys(['environment']).name('byOwner'),
      index('environment').sortKeys(['lastScanDate']).name('byEnvironmentAndScanDate'),
    ]),

  // Analysis Management
  Analysis: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      accountId: a.id(), // Optional: for multi-account analysis
      name: a.string().required(),
      type: a.enum(['CLOUDFORMATION', 'TERRAFORM', 'CDK', 'LIVE_SCAN']),
      status: a.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
      strategy: a.enum(['REPOSITORY_INTEGRATION', 'LIVE_SCAN', 'FILE_UPLOAD']), // 分析戦略
      inputFiles: a.json(),
      awsConfig: a.json(),
      scanResults: a.json(), // ライブスキャン結果（organizations, support等）
      resultSummary: a.json(),
      executionId: a.string(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      completedAt: a.datetime(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      awsAccount: a.belongsTo('AwsAccount', 'accountId'),
      findings: a.hasMany('Finding', 'analysisId'),
      reports: a.hasMany('Report', 'analysisId'),
      baselineDifferentialAnalyses: a.hasMany('DifferentialAnalysis', 'baselineScanId'),
      comparisonDifferentialAnalyses: a.hasMany('DifferentialAnalysis', 'comparisonScanId'),
    })
    .authorization((allow) => [
      // Production authorization
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers', 'Analysts']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Viewers', 'ClientEngineers']).to(['read']),
      // Development bypass - remove in production
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('accountId').sortKeys(['createdAt']).name('byAccount'),
      index('status').sortKeys(['updatedAt']).name('byStatus'),
      index('strategy').sortKeys(['createdAt']).name('byStrategy'),
    ]),

  // Finding Management
  Finding: a
    .model({
      id: a.id().required(),
      analysisId: a.id().required(),
      tenantId: a.id().required(),
      title: a.string().required(),
      description: a.string().required(),
      severity: a.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']),
      pillar: a.enum([
        'OPERATIONAL_EXCELLENCE',
        'SECURITY', 
        'RELIABILITY',
        'PERFORMANCE_EFFICIENCY',
        'COST_OPTIMIZATION',
        'SUSTAINABILITY'
      ]),
      resource: a.string(),
      line: a.integer(),
      recommendation: a.string().required(),
      category: a.string(),
      ruleId: a.string(),
      createdAt: a.datetime().required(),
      
      // Relations
      analysis: a.belongsTo('Analysis', 'analysisId'),
    })
    .authorization((allow) => [
      // Production authorization
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers', 'Analysts']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Viewers', 'ClientEngineers']).to(['read']),
      // Development bypass - remove in production
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('analysisId').sortKeys(['severity']).name('byAnalysis'),
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('severity').sortKeys(['createdAt']).name('bySeverity'),
    ]),

  // Report Management
  Report: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      analysisId: a.id(),
      name: a.string().required(),
      type: a.enum(['ANALYSIS_SUMMARY', 'DETAILED_FINDINGS', 'EXECUTIVE_SUMMARY', 'COMPLIANCE_REPORT']),
      format: a.enum(['PDF', 'EXCEL', 'JSON', 'HTML']),
      status: a.enum(['GENERATING', 'COMPLETED', 'FAILED']),
      s3Location: a.json(),
      generatedBy: a.string().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      analysis: a.belongsTo('Analysis', 'analysisId'),
    })
    .authorization((allow) => [
      // Production authorization
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers', 'Analysts']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Viewers', 'ClientEngineers']).to(['read']),
      // Development bypass - remove in production
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('analysisId').sortKeys(['createdAt']).name('byAnalysis'),
    ]),

  // Git Repository Management
  GitRepository: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      connectionId: a.id().required(),
      provider: a.enum(['GITHUB', 'GITLAB', 'BITBUCKET']),
      owner: a.string().required(),
      name: a.string().required(),
      fullName: a.string().required(), // owner/repo
      url: a.url().required(),
      defaultBranch: a.string().required(),
      branches: a.string().array(),
      lastScanCommit: a.string(),
      lastScanDate: a.datetime(),
      isActive: a.boolean().required(),
      webhookId: a.string(),
      settings: a.json(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      gitConnection: a.belongsTo('GitConnection', 'connectionId'),
      schedules: a.hasMany('AnalysisSchedule', 'repositoryId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('provider').sortKeys(['updatedAt']).name('byProvider'),
      index('provider').sortKeys(['lastScanDate']).name('byProviderAndScanDate'),
    ]),

  // Git Connection Management (OAuth tokens)
  GitConnection: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      provider: a.enum(['GITHUB', 'GITLAB', 'BITBUCKET']),
      userId: a.string().required(),
      username: a.string().required(),
      accessToken: a.string().required(), // Encrypted
      refreshToken: a.string(),
      expiresAt: a.datetime(),
      scopes: a.string().array(),
      isActive: a.boolean().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      repositories: a.hasMany('GitRepository', 'connectionId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Analysts']).to(['read']),
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('provider').sortKeys(['expiresAt']).name('byProvider'),
      index('userId').name('byUser'),
    ]),

  // Analysis Schedule Management
  AnalysisSchedule: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      repositoryId: a.id().required(),
      name: a.string().required(),
      frequency: a.enum(['MANUAL', 'ON_PUSH', 'DAILY', 'WEEKLY', 'MONTHLY']),
      cronExpression: a.string(),
      branches: a.string().array().required(),
      frameworks: a.string().array().required(),
      isActive: a.boolean().required(),
      lastRun: a.datetime(),
      nextRun: a.datetime(),
      runCount: a.integer(),
      settings: a.json(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      repository: a.belongsTo('GitRepository', 'repositoryId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('repositoryId').sortKeys(['createdAt']).name('byRepository'),
      index('frequency').sortKeys(['nextRun']).name('byFrequencyAndNextRun'),
      index('frequency').sortKeys(['lastRun']).name('byFrequency'),
    ]),

  // Multi-Account Scan Schedule Management
  MultiAccountScanSchedule: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      name: a.string().required(),
      description: a.string(),
      accountIds: a.string().array().required(), // AWS Account IDs to scan
      frequency: a.enum(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']),
      cronExpression: a.string(),
      frameworks: a.string().array().required(),
      services: a.string().array().required(), // AWS services to scan
      regions: a.string().array().required(), // AWS regions to scan
      isActive: a.boolean().required(),
      lastRun: a.datetime(),
      nextRun: a.datetime(),
      runCount: a.integer(),
      settings: a.json(),
      notificationSettings: a.json(), // メール通知設定等
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      scanResults: a.hasMany('MultiAccountScanResult', 'scheduleId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('frequency').sortKeys(['nextRun']).name('byFrequencyAndNextRun'),
      index('frequency').sortKeys(['lastRun']).name('byFrequency'),
    ]),

  // Multi-Account Scan Results
  MultiAccountScanResult: a
    .model({
      id: a.id().required(),
      scanId: a.string().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      
      // Scan metadata
      status: a.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL']),
      totalAccounts: a.integer().required(),
      completedAccounts: a.integer().default(0),
      failedAccounts: a.integer().default(0),
      progress: a.integer().default(0),
      
      // Timing
      startTime: a.datetime(),
      endTime: a.datetime(),
      
      // Results
      accountResults: a.json(), // Array of AccountScanResult
      aggregatedSummary: a.json(), // AggregatedScanSummary
      
      // Schedule reference
      scheduleId: a.id(),
      triggeredBy: a.enum(['MANUAL', 'SCHEDULED', 'API']),
      
      // Metadata
      error: a.string(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      schedule: a.belongsTo('MultiAccountScanSchedule', 'scheduleId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ProjectManagers', 'Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('scanId').name('byScanId'),
      index('scheduleId').sortKeys(['createdAt']).name('bySchedule'),
      index('status').sortKeys(['startTime']).name('byStatus'),
      index('triggeredBy').sortKeys(['startTime']).name('byTrigger'),
    ]),

  // Differential Analysis Results
  DifferentialAnalysis: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      
      // Analysis metadata
      analysisType: a.enum(['FULL', 'SECURITY', 'COMPLIANCE', 'RESOURCES']),
      baselineScanId: a.string().required(),
      comparisonScanId: a.string().required(),
      
      // Results summary
      totalChanges: a.integer().required(),
      analysisDate: a.datetime().required(),
      
      // Resource changes
      resourceChangesAdded: a.integer().default(0),
      resourceChangesRemoved: a.integer().default(0),
      resourceChangesModified: a.integer().default(0),
      resourceChangeDetails: a.json(), // Array of ResourceDifference
      
      // Compliance changes
      complianceNewViolations: a.integer().default(0),
      complianceResolvedViolations: a.integer().default(0),
      complianceStatusChanges: a.integer().default(0),
      complianceChangeDetails: a.json(), // Array of ComplianceDifference
      
      // Security impact
      securityScoreChange: a.integer().default(0),
      securityRiskLevel: a.enum(['INCREASED', 'DECREASED', 'UNCHANGED']),
      securityCriticalChanges: a.integer().default(0),
      securityFindingsChange: a.integer().default(0),
      
      // Performance metrics
      executionTimeMs: a.integer(),
      resourcesCompared: a.integer(),
      findingsCompared: a.integer(),
      
      // Additional data
      recommendations: a.json(), // Array of strings
      analysisDetails: a.json(), // Full analysis result
      
      // Metadata
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      baselineAnalysis: a.belongsTo('Analysis', 'baselineScanId'),
      comparisonAnalysis: a.belongsTo('Analysis', 'comparisonScanId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ProjectManagers', 'Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
      allow.authenticated().to(['create', 'read', 'update', 'delete']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('analysisType').sortKeys(['analysisDate']).name('byAnalysisType'),
      index('baselineScanId').sortKeys(['createdAt']).name('byBaselineScan'),
      index('comparisonScanId').sortKeys(['createdAt']).name('byComparisonScan'),
      index('securityRiskLevel').sortKeys(['analysisDate']).name('bySecurityRisk'),
    ]),

  // User Management
  User: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      cognitoId: a.string().required(),
      email: a.email().required(),
      firstName: a.string().required(),
      lastName: a.string().required(),
      role: a.enum(['SYSTEM_ADMIN', 'CLIENT_ADMIN', 'PROJECT_MANAGER', 'ANALYST', 'VIEWER', 'CLIENT_ENGINEER']),
      status: a.enum(['ACTIVE', 'INACTIVE', 'PENDING_INVITATION']),
      projectIds: a.string().array().required(),
      preferences: a.json(),
      lastLoginAt: a.datetime(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ClientAdmins']).to(['read', 'update']),
      // Use cognitoId for owner-based access instead of generic owner field
      allow.ownerDefinedIn('cognitoId').to(['read', 'update']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('cognitoId').name('byCognitoId'),
      index('email').name('byEmail'),
      index('role').sortKeys(['lastLoginAt']).name('byRole'),
    ]),


});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});