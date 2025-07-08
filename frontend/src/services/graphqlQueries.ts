import { generateClient } from 'aws-amplify/api';
import { ErrorHandler } from '../services/errorHandler';
import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
import type { 
  CreateTenantInput, 
  CreateProjectInput, 
  CreateAnalysisInput 
} from '../graphql/API';

const client = generateClient();

// Helper function to handle GraphQL responses
const handleGraphQLResponse = (result: any, context: string) => {
  if (result.errors && result.errors.length > 0) {
    const error = new Error(result.errors[0].message);
    (error as any).errors = result.errors;
    throw error;
  }
  return { data: result.data, errors: result.errors || [] };
};

export const tenantQueries = {
  listTenants: async () => {
    try {
      const result = await client.graphql({
        query: queries.listTenants
      });
      return { data: result.data.listTenants.items, errors: [] };
    } catch (error) {
      console.error('Error listing tenants:', error);
      return { data: [], errors: [error] };
    }
  },

  getTenant: async (id: string) => {
    try {
      const result = await client.graphql({
        query: queries.getTenant,
        variables: { id }
      });
      return { data: result.data.getTenant, errors: [] };
    } catch (error) {
      console.error('Error getting tenant:', error);
      return { data: null, errors: [error] };
    }
  },

  createTenant: async (input: CreateTenantInput) => {
    try {
      const result = await client.graphql({
        query: mutations.createTenant,
        variables: { input }
      });
      return { data: result.data.createTenant, errors: [] };
    } catch (error) {
      console.error('Error creating tenant:', error);
      return { data: null, errors: [error] };
    }
  }
};

export const projectQueries = {
  listProjects: async (tenantId: string) => {
    try {
      const result = await client.graphql({
        query: queries.listProjectByTenantIdAndCreatedAt,
        variables: { tenantId }
      });
      return { data: result.data.listProjectByTenantIdAndCreatedAt.items, errors: [] };
    } catch (error) {
      ErrorHandler.handle(error, 'listProjects');
      return { data: [], errors: [error] };
    }
  },

  getProject: async (id: string) => {
    try {
      const result = await client.graphql({
        query: queries.getProject,
        variables: { id }
      });
      return { data: result.data.getProject, errors: [] };
    } catch (error) {
      ErrorHandler.handle(error, 'getProject');
      return { data: null, errors: [error] };
    }
  },

  createProject: async (input: CreateProjectInput) => {
    try {
      const result = await client.graphql({
        query: mutations.createProject,
        variables: { input }
      });
      return { data: result.data.createProject, errors: [] };
    } catch (error) {
      ErrorHandler.handle(error, 'createProject');
      return { data: null, errors: [error] };
    }
  },

  updateProject: async (id: string, input: any) => {
    try {
      const result = await client.graphql({
        query: mutations.updateProject,
        variables: { input: { id, ...input } }
      });
      return { data: result.data.updateProject, errors: [] };
    } catch (error) {
      ErrorHandler.handle(error, 'updateProject');
      return { data: null, errors: [error] };
    }
  },

  deleteProject: async (id: string) => {
    try {
      const result = await client.graphql({
        query: mutations.deleteProject,
        variables: { input: { id } }
      });
      return { data: result.data.deleteProject, errors: [] };
    } catch (error) {
      ErrorHandler.handle(error, 'deleteProject');
      return { data: null, errors: [error] };
    }
  }
};

export const analysisQueries = {
  listAnalyses: async (projectId: string) => {
    try {
      const result = await client.graphql({
        query: queries.listAnalysisByProjectIdAndCreatedAt,
        variables: { projectId }
      });
      return { data: result.data.listAnalysisByProjectIdAndCreatedAt.items, errors: [] };
    } catch (error) {
      console.error('Error listing analyses:', error);
      return { data: [], errors: [error] };
    }
  },

  getAnalysis: async (id: string) => {
    try {
      const result = await client.graphql({
        query: queries.getAnalysis,
        variables: { id }
      });
      return { data: result.data.getAnalysis, errors: [] };
    } catch (error) {
      console.error('Error getting analysis:', error);
      return { data: null, errors: [error] };
    }
  },

  createAnalysis: async (input: CreateAnalysisInput) => {
    try {
      const result = await client.graphql({
        query: mutations.createAnalysis,
        variables: { input }
      });
      return { data: result.data.createAnalysis, errors: [] };
    } catch (error) {
      console.error('Error creating analysis:', error);
      return { data: null, errors: [error] };
    }
  },

  listFindings: async (analysisId: string) => {
    try {
      const result = await client.graphql({
        query: queries.listFindingByAnalysisIdAndSeverity,
        variables: { analysisId }
      });
      return { data: result.data.listFindingByAnalysisIdAndSeverity.items, errors: [] };
    } catch (error) {
      console.error('Error listing findings:', error);
      return { data: [], errors: [error] };
    }
  }
};

export const reportQueries = {
  listReports: async (analysisId: string) => {
    try {
      const result = await client.graphql({
        query: queries.listReportByAnalysisIdAndCreatedAt,
        variables: { analysisId }
      });
      return { data: result.data.listReportByAnalysisIdAndCreatedAt.items, errors: [] };
    } catch (error) {
      console.error('Error listing reports:', error);
      return { data: [], errors: [error] };
    }
  }
};

// Framework queries (mocked for now since Framework model might not be in schema yet)
export const frameworkQueries = {
  listFrameworks: async () => {
    try {
      // Return mock framework data for now
      return {
        data: [
          {
            id: 'framework-1',
            name: 'AWS Well-Architected Framework',
            type: 'AWS_WELL_ARCHITECTED',
            version: '2023.10',
            description: 'AWS Well-Architected Framework 6 pillars',
            status: 'ACTIVE'
          }
        ],
        errors: []
      };
    } catch (error) {
      console.error('Error listing frameworks:', error);
      return { data: [], errors: [error] };
    }
  }
};