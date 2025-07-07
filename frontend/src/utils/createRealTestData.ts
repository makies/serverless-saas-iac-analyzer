import { tenantQueries, projectQueries, analysisQueries } from '../services/graphqlQueries';
import { 
  CreateTenantInput, 
  CreateProjectInput, 
  CreateAnalysisInput,
  TenantStatus,
  ProjectStatus,
  AnalysisStatus,
  AnalysisType
} from '../graphql/API';

export const createRealTestData = async () => {
  try {
    console.log('🌱 Creating real test data via GraphQL...');
    
    // Debug: Check current auth session and user details
    const { getUserPoolInfo } = await import('./getUserPoolInfo');
    const { checkUserPermissions } = await import('./addUserToGroup');
    
    try {
      const userPoolInfo = await getUserPoolInfo();
      const permissions = await checkUserPermissions();
      
      if (!permissions.canCreateTenant) {
        console.warn('⚠️  Current user cannot create tenants. Missing SystemAdmins group membership.');
        console.log('🔄 Attempting to refresh authentication session...');
        
        // Force refresh authentication session
        try {
          const { signOut } = await import('aws-amplify/auth');
          console.log('🚪 Please log out and log back in to refresh your permissions');
          console.log('Or wait a moment for automatic session refresh...');
          
          // Wait a moment and check again
          await new Promise(resolve => setTimeout(resolve, 2000));
          const refreshedPermissions = await checkUserPermissions();
          
          if (!refreshedPermissions.canCreateTenant) {
            console.log('📋 Run the AWS CLI commands shown above to add user to SystemAdmins group, then log out and log back in.');
            return null;
          }
        } catch (refreshError) {
          console.error('Error refreshing session:', refreshError);
          return null;
        }
      }
      
    } catch (authError) {
      console.error('Auth debugging error:', authError);
    }
    
    // 1. Create test tenant
    const tenantInput: CreateTenantInput = {
      name: 'デモテナント',
      adminEmail: 'admin@demo-tenant.com',
      status: TenantStatus.ACTIVE,
      subscription: JSON.stringify({
        tier: 'BASIC',
        maxAnalyses: 100,
        maxProjects: 10
      }),
      settings: JSON.stringify({
        retentionDays: 90,
        allowedFrameworks: ['AWS_WELL_ARCHITECTED', 'AWS_LENS', 'SDP']
      })
    };

    console.log('Attempting to create tenant with input:', tenantInput);
    const { data: tenant, errors: tenantErrors } = await tenantQueries.createTenant(tenantInput);
    
    if (tenantErrors.length > 0) {
      console.error('❌ Failed to create tenant:', tenantErrors);
      
      // Log detailed error information
      tenantErrors.forEach((error, index) => {
        console.error(`Error ${index + 1}:`, {
          message: error.message || error,
          errorType: error.errorType,
          errorInfo: error.errorInfo,
          locations: error.locations,
          path: error.path
        });
      });
      return null;
    }

    console.log('✅ Tenant created:', tenant.id);

    // Update localStorage with tenant ID for useAuth hook
    localStorage.setItem('demo-tenant-id', tenant.id);

    // 2. Create test project
    const projectInput: CreateProjectInput = {
      tenantId: tenant.id,
      name: 'デモプロジェクト',
      description: 'デモ用のテストプロジェクト',
      status: ProjectStatus.ACTIVE,
      memberIds: ['current-user'],
      settings: JSON.stringify({
        autoAnalysis: true,
        notifications: true
      }),
      metrics: JSON.stringify({}),
      createdBy: 'current-user'
    };

    const { data: project, errors: projectErrors } = await projectQueries.createProject(projectInput);
    
    if (projectErrors.length > 0) {
      console.error('Failed to create project:', projectErrors);
      return { tenantId: tenant.id };
    }

    console.log('✅ Project created:', project.id);

    // 3. Create test analysis
    const analysisInput: CreateAnalysisInput = {
      projectId: project.id,
      tenantId: tenant.id,
      name: 'サンプル分析',
      type: AnalysisType.CLOUDFORMATION,
      status: AnalysisStatus.COMPLETED,
      inputFiles: JSON.stringify({
        'template.yaml': 'AWSTemplateFormatVersion: "2010-09-09"...'
      }),
      awsConfig: JSON.stringify({
        region: 'ap-northeast-1',
        accountId: '123456789012'
      }),
      resultSummary: JSON.stringify({
        totalFindings: 15,
        criticalFindings: 2,
        highFindings: 5,
        mediumFindings: 6,
        lowFindings: 2,
        score: 75,
        completedAt: new Date().toISOString()
      }),
      createdBy: 'current-user',
      completedAt: new Date().toISOString()
    };

    const { data: analysis, errors: analysisErrors } = await analysisQueries.createAnalysis(analysisInput);
    
    if (analysisErrors.length > 0) {
      console.error('Failed to create analysis:', analysisErrors);
      return { tenantId: tenant.id, projectId: project.id };
    }

    console.log('✅ Analysis created:', analysis.id);
    
    return {
      tenantId: tenant.id,
      projectId: project.id,
      analysisId: analysis.id
    };
    
  } catch (error) {
    console.error('❌ Error creating real test data:', error);
    throw error;
  }
};