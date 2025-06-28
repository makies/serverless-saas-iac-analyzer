import { useState, useEffect } from 'react';
import { projectQueries } from '../graphql/queries';
import { useAuth } from './useAuth';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  tenantId: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED';
  awsAccountId?: string | null;
  region?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.tenantId) {
      loadProjects();
    }
  }, [user?.tenantId]);

  const loadProjects = async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const response = await projectQueries.listProjects(user.tenantId);
      setProjects((response.data as Project[]) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (input: {
    name: string;
    description?: string;
    awsAccountId?: string;
    region?: string;
  }) => {
    if (!user?.tenantId) throw new Error('No tenant ID');

    try {
      const response = await projectQueries.createProject({
        ...input,
        tenantId: user.tenantId
      });

      if (response.data) {
        setProjects(prev => [...prev, response.data as Project]);
      }

      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      throw err;
    }
  };

  const updateProject = async (id: string, input: Partial<{
    name: string;
    description: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED';
    awsAccountId: string;
    region: string;
  }>) => {
    try {
      const response = await projectQueries.updateProject(id, input);

      if (response.data) {
        setProjects(prev =>
          prev.map(p => p.id === id ? { ...p, ...(response.data as Partial<Project>) } : p)
        );
      }

      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
      throw err;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await projectQueries.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      throw err;
    }
  };

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refreshProjects: loadProjects
  };
}
