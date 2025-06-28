import { client } from './client';

export const projectQueries = {
  listProjects: async (tenantId: string) => {
    return await client.models.Project.list({
      filter: { tenantId: { eq: tenantId } }
    });
  },

  getProject: async (id: string) => {
    return await client.models.Project.get({ id });
  },

  createProject: async (input: {
    name: string;
    description?: string;
    tenantId: string;
    awsAccountId?: string;
    region?: string;
  }) => {
    return await client.models.Project.create({
      ...input,
      status: 'ACTIVE'
    });
  },

  updateProject: async (id: string, input: Partial<{
    name: string;
    description: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED';
    awsAccountId: string;
    region: string;
  }>) => {
    return await client.models.Project.update({ id, ...input });
  },

  deleteProject: async (id: string) => {
    return await client.models.Project.delete({ id });
  }
};

export const analysisQueries = {
  listAnalyses: async (projectId: string) => {
    return await client.models.Analysis.list({
      filter: { projectId: { eq: projectId } }
    });
  },

  getAnalysis: async (id: string) => {
    return await client.models.Analysis.get({ id });
  },

  createAnalysis: async (input: {
    projectId: string;
    tenantId: string;
    type: 'IAC_ANALYSIS' | 'LIVE_SCAN' | 'SECURITY_REVIEW' | 'COMPLIANCE_CHECK';
    sourceType: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK' | 'LIVE_ACCOUNT';
    sourceLocation: string;
  }) => {
    return await client.models.Analysis.create({
      ...input,
      status: 'PENDING',
      executedBy: 'current-user', // Will be populated by auth
      executedAt: new Date().toISOString()
    });
  }
};

export const reportQueries = {
  listReports: async (analysisId: string) => {
    return await client.models.Report.list({
      filter: { analysisId: { eq: analysisId } }
    });
  },

  getReport: async (id: string) => {
    return await client.models.Report.get({ id });
  },

  generateReport: async (input: {
    analysisId: string;
    tenantId: string;
    format: 'PDF' | 'EXCEL' | 'JSON';
  }) => {
    return await client.models.Report.create({
      ...input,
      status: 'GENERATING',
      fileName: `analysis-report-${input.analysisId}.${input.format.toLowerCase()}`,
      generatedBy: 'current-user', // Will be populated by auth
      generatedAt: new Date().toISOString()
    });
  }
};

export const userQueries = {
  getCurrentUser: async () => {
    // This would typically get the current user from Cognito
    // and return their tenant information
    return { data: null, errors: [] };
  },

  listUsers: async (tenantId: string) => {
    return await client.models.User.list({
      filter: { tenantId: { eq: tenantId } }
    });
  },

  createUser: async (input: {
    email: string;
    tenantId: string;
    role: 'SYSTEM_ADMIN' | 'CLIENT_ADMIN' | 'PROJECT_MANAGER' | 'ANALYST' | 'VIEWER' | 'CLIENT_ENGINEER';
    firstName: string;
    lastName: string;
  }) => {
    return await client.models.User.create({
      ...input,
      status: 'PENDING'
    });
  }
};

export const tenantQueries = {
  listTenants: async () => {
    return await client.models.Tenant.list();
  },

  getTenant: async (id: string) => {
    return await client.models.Tenant.get({ id });
  },

  createTenant: async (input: {
    name: string;
    domain: string;
  }) => {
    return await client.models.Tenant.create({
      ...input,
      status: 'ACTIVE'
    });
  }
};