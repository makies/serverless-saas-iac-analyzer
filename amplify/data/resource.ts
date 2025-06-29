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
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ClientAdmins']).to(['read', 'update']),
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
      analyses: a.hasMany('Analysis', 'projectId'),
      reports: a.hasMany('Report', 'projectId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['ProjectManagers']).to(['read', 'update']),
      allow.groups(['Analysts', 'Viewers', 'ClientEngineers']).to(['read']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('status').sortKeys(['updatedAt']).name('byStatus'),
    ]),

  // Analysis Management
  Analysis: a
    .model({
      id: a.id().required(),
      tenantId: a.id().required(),
      projectId: a.id().required(),
      name: a.string().required(),
      type: a.enum(['CLOUDFORMATION', 'TERRAFORM', 'CDK', 'LIVE_SCAN']),
      status: a.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
      inputFiles: a.json(),
      awsConfig: a.json(),
      resultSummary: a.json(),
      executionId: a.string(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      completedAt: a.datetime(),
      createdBy: a.string().required(),
      
      // Relations
      tenant: a.belongsTo('Tenant', 'tenantId'),
      project: a.belongsTo('Project', 'projectId'),
      findings: a.hasMany('Finding', 'analysisId'),
      reports: a.hasMany('Report', 'analysisId'),
    })
    .authorization((allow) => [
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers', 'Analysts']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Viewers', 'ClientEngineers']).to(['read']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('status').sortKeys(['updatedAt']).name('byStatus'),
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
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers', 'Analysts']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Viewers', 'ClientEngineers']).to(['read']),
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
      allow.groups(['SystemAdmins', 'ClientAdmins', 'ProjectManagers', 'Analysts']).to(['create', 'read', 'update', 'delete']),
      allow.groups(['Viewers', 'ClientEngineers']).to(['read']),
    ])
    .secondaryIndexes((index) => [
      index('tenantId').sortKeys(['createdAt']).name('byTenant'),
      index('projectId').sortKeys(['createdAt']).name('byProject'),
      index('analysisId').sortKeys(['createdAt']).name('byAnalysis'),
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
      allow.owner().to(['read', 'update']),
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