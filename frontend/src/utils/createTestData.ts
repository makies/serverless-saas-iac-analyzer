import { generateClient } from 'aws-amplify/api';

const client = generateClient();

const CREATE_TENANT = `
  mutation CreateTenant($input: CreateTenantInput!) {
    createTenant(input: $input) {
      id
      name
      description
      domain
      status
      tier
      settings
      createdAt
      updatedAt
    }
  }
`;

const CREATE_PROJECT = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      description
      tenantId
      status
      settings
      createdAt
      updatedAt
    }
  }
`;

export const createTestData = async () => {
  try {
    console.log('🌱 Creating test tenant...');
    
    // テストテナントを作成
    const tenantResult = await client.graphql({
      query: CREATE_TENANT,
      variables: {
        input: {
          name: 'デモテナント',
          description: 'デモ用のテストテナント',
          domain: 'demo-tenant.com',
          status: 'ACTIVE',
          tier: 'BASIC',
          settings: {
            maxAnalyses: 100,
            retentionDays: 90
          }
        }
      }
    });

    const tenantId = tenantResult.data.createTenant.id;
    console.log('✅ Test tenant created:', tenantId);

    // テストプロジェクトを作成
    const projectResult = await client.graphql({
      query: CREATE_PROJECT,
      variables: {
        input: {
          name: 'デモプロジェクト',
          description: 'デモ用のテストプロジェクト',
          tenantId: tenantId,
          status: 'ACTIVE',
          settings: {}
        }
      }
    });

    console.log('✅ Test project created:', projectResult.data.createProject.id);
    
    return {
      tenantId,
      projectId: projectResult.data.createProject.id
    };
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  }
};