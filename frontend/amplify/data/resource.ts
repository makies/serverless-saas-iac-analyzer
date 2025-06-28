import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Tenant: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      domain: a.string().required(),
      status: a.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      projects: a.hasMany('Project', 'tenantId'),
      users: a.hasMany('User', 'tenantId'),
    })
    .authorization(allow => [
      allow.groups(['SystemAdmin']),
    ]),

  User: a
    .model({
      id: a.id().required(),
      email: a.string().required(),
      tenantId: a.id().required(),
      role: a.enum(['SYSTEM_ADMIN', 'CLIENT_ADMIN', 'PROJECT_MANAGER', 'ANALYST', 'VIEWER', 'CLIENT_ENGINEER']),
      firstName: a.string().required(),
      lastName: a.string().required(),
      status: a.enum(['ACTIVE', 'INACTIVE', 'PENDING']),
      lastLoginAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      tenant: a.belongsTo('Tenant', 'tenantId'),
      projectAssignments: a.hasMany('ProjectAssignment', 'userId'),
    })
    .authorization(allow => [
      allow.owner().to(['read', 'update']),
      allow.groups(['SystemAdmin', 'ClientAdmin']),
    ]),

  Project: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      description: a.string(),
      tenantId: a.id().required(),
      status: a.enum(['ACTIVE', 'ARCHIVED', 'SUSPENDED']),
      awsAccountId: a.string(),
      region: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      tenant: a.belongsTo('Tenant', 'tenantId'),
      assignments: a.hasMany('ProjectAssignment', 'projectId'),
      analyses: a.hasMany('Analysis', 'projectId'),
    })
    .authorization(allow => [
      allow.groups(['SystemAdmin']),
      allow.ownerDefinedIn('tenantId'),
    ]),

  ProjectAssignment: a
    .model({
      id: a.id().required(),
      projectId: a.id().required(),
      userId: a.id().required(),
      tenantId: a.id().required(),
      role: a.enum(['MANAGER', 'ANALYST', 'VIEWER']),
      assignedAt: a.datetime(),
      assignedBy: a.id(),
      project: a.belongsTo('Project', 'projectId'),
      user: a.belongsTo('User', 'userId'),
    })
    .authorization(allow => [
      allow.groups(['SystemAdmin', 'ClientAdmin', 'ProjectManager']),
      allow.ownerDefinedIn('tenantId').to(['read']),
    ]),

  Analysis: a
    .model({
      id: a.id().required(),
      projectId: a.id().required(),
      tenantId: a.id().required(),
      type: a.enum(['IAC_ANALYSIS', 'LIVE_SCAN', 'SECURITY_REVIEW', 'COMPLIANCE_CHECK']),
      status: a.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
      sourceType: a.enum(['CLOUDFORMATION', 'TERRAFORM', 'CDK', 'LIVE_ACCOUNT']),
      sourceLocation: a.string().required(),
      results: a.json(),
      scores: a.json(),
      recommendations: a.json(),
      executedBy: a.id(),
      executedAt: a.datetime(),
      completedAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      project: a.belongsTo('Project', 'projectId'),
      reports: a.hasMany('Report', 'analysisId'),
    })
    .authorization(allow => [
      allow.groups(['SystemAdmin']),
      allow.ownerDefinedIn('tenantId'),
    ]),

  Report: a
    .model({
      id: a.id().required(),
      analysisId: a.id().required(),
      tenantId: a.id().required(),
      format: a.enum(['PDF', 'EXCEL', 'JSON']),
      status: a.enum(['GENERATING', 'COMPLETED', 'FAILED']),
      s3Key: a.string(),
      fileName: a.string().required(),
      generatedBy: a.id(),
      generatedAt: a.datetime(),
      expiresAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      analysis: a.belongsTo('Analysis', 'analysisId'),
    })
    .authorization(allow => [
      allow.groups(['SystemAdmin']),
      allow.ownerDefinedIn('tenantId'),
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