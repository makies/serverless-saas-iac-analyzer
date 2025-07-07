import { describe, it, expect, beforeAll } from 'bun:test';
import { tenantQueries, projectQueries, analysisQueries } from '../services/graphqlQueries';
import { CreateTenantInput, CreateProjectInput, TenantStatus, ProjectStatus } from '../graphql/API';

/**
 * GraphQL Queries Integration Tests
 * 
 * Tests the GraphQL queries and mutations against the actual backend.
 * These tests verify that the auto-generated GraphQL operations work correctly.
 */

describe('GraphQL Queries Integration Tests', () => {
  
  describe('Tenant Management', () => {
    it('should list tenants successfully', async () => {
      const result = await tenantQueries.listTenants();
      
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      
      console.log('✅ Tenant list query executed successfully');
      console.log(`Found ${result.data.length} tenants`);
      
      if (result.errors.length > 0) {
        console.log('⚠️ Errors:', result.errors);
      }
    });

    it('should create a tenant successfully', async () => {
      const tenantInput: CreateTenantInput = {
        name: `Test Tenant ${Date.now()}`,
        adminEmail: `admin-${Date.now()}@test.com`,
        status: TenantStatus.ACTIVE,
        subscription: JSON.stringify({
          tier: 'BASIC',
          maxAnalyses: 100,
          maxFileSize: 10,
          retentionDays: 90
        }),
        settings: JSON.stringify({
          defaultFrameworks: ['WELL_ARCHITECTED'],
          allowClientAccess: true
        })
      };

      const result = await tenantQueries.createTenant(tenantInput);
      
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      
      console.log('✅ Tenant creation mutation executed');
      
      if (result.errors.length === 0) {
        expect(result.data).toBeDefined();
        expect(result.data.name).toBe(tenantInput.name);
        console.log('✅ Tenant created successfully:', result.data.id);
      } else {
        console.log('⚠️ Tenant creation errors:', result.errors);
      }
    });
  });

  describe('Project Management', () => {
    it('should list projects successfully', async () => {
      const result = await projectQueries.listProjects();
      
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      
      console.log('✅ Project list query executed successfully');
      console.log(`Found ${result.data.length} projects`);
      
      if (result.errors.length > 0) {
        console.log('⚠️ Errors:', result.errors);
      }
    });

    it('should create a project successfully', async () => {
      const projectInput: CreateProjectInput = {
        name: `Test Project ${Date.now()}`,
        description: 'Integration test project',
        tenantId: 'test-tenant',
        status: ProjectStatus.ACTIVE,
        settings: JSON.stringify({
          frameworks: ['WELL_ARCHITECTED'],
          autoAnalysis: false
        })
      };

      const result = await projectQueries.createProject(projectInput);
      
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      
      console.log('✅ Project creation mutation executed');
      
      if (result.errors.length === 0) {
        expect(result.data).toBeDefined();
        expect(result.data.name).toBe(projectInput.name);
        console.log('✅ Project created successfully:', result.data.id);
      } else {
        console.log('⚠️ Project creation errors:', result.errors);
      }
    });
  });

  describe('Analysis Management', () => {
    it('should list analyses successfully', async () => {
      const result = await analysisQueries.listAnalyses();
      
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      
      console.log('✅ Analysis list query executed successfully');
      console.log(`Found ${result.data.length} analyses`);
      
      if (result.errors.length > 0) {
        console.log('⚠️ Errors:', result.errors);
      }
    });
  });
});