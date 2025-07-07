// Mock test data for development/testing
export const mockTenants = [
  {
    id: 'tenant-demo-001',
    name: 'デモテナント',
    status: 'ACTIVE',
    adminEmail: 'admin@demo-tenant.com',
    subscription: { tier: 'BASIC', maxAnalyses: 100 },
    settings: { retentionDays: 90 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const mockProjects = [
  {
    id: 'project-demo-001',
    tenantId: 'tenant-demo-001',
    name: 'デモプロジェクト',
    description: 'デモ用のテストプロジェクト',
    status: 'ACTIVE',
    memberIds: ['user-demo-001'],
    settings: {},
    metrics: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-demo-001'
  }
];

export const mockAnalyses = [
  {
    id: 'analysis-demo-001',
    projectId: 'project-demo-001',
    tenantId: 'tenant-demo-001',
    name: 'サンプル分析',
    type: 'CLOUDFORMATION',
    status: 'COMPLETED',
    framework: 'AWS_WELL_ARCHITECTED',
    resultSummary: {
      totalFindings: 15,
      criticalFindings: 2,
      highFindings: 5,
      mediumFindings: 6,
      lowFindings: 2,
      score: 75
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date().toISOString(),
    createdBy: 'user-demo-001'
  }
];

export const getTestData = () => ({
  tenants: mockTenants,
  projects: mockProjects, 
  analyses: mockAnalyses
});