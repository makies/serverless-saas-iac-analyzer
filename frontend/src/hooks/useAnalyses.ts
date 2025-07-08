import { useCallback, useEffect, useState } from 'react';
import { analysisQueries } from '../services/graphqlQueries';
import { useAuth } from './useAuth';

interface Analysis {
  id: string;
  projectId: string;
  tenantId: string;
  type: 'IAC_ANALYSIS' | 'LIVE_SCAN' | 'SECURITY_REVIEW' | 'COMPLIANCE_CHECK';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  sourceType: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK' | 'LIVE_ACCOUNT';
  sourceLocation: string;
  results?: Record<string, unknown>;
  scores?: Record<string, number>;
  recommendations?: Array<Record<string, unknown>>;
  executedBy: string;
  executedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function useAnalyses(projectId?: string) {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyses = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const response = await analysisQueries.listAnalyses(projectId);
      setAnalyses(Array.isArray(response.data) ? response.data as Analysis[] : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadAnalyses();
    }
  }, [projectId, loadAnalyses]);

  const createAnalysis = async (input: {
    name: string;
    type: 'IAC_ANALYSIS' | 'LIVE_SCAN' | 'SECURITY_REVIEW' | 'COMPLIANCE_CHECK';
    sourceType: 'CLOUDFORMATION' | 'TERRAFORM' | 'CDK' | 'LIVE_ACCOUNT';
    sourceLocation: string;
  }) => {
    if (!projectId || !user?.tenantId) {
      throw new Error('Project ID and tenant ID are required');
    }

    try {
      const response = await analysisQueries.createAnalysis({
        ...input,
        projectId,
        tenantId: user.tenantId,
        createdBy: user.id!,
      } as any);

      if (response.data && response.data !== null) {
        setAnalyses((prev) => [...prev, response.data as unknown as Analysis]);
      }

      return response;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create analysis'
      );
      throw err;
    }
  };

  const getAnalysis = async (id: string) => {
    try {
      const response = await analysisQueries.getAnalysis(id);
      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get analysis');
      throw err;
    }
  };

  const getAnalysisByStatus = (status: Analysis['status']) => {
    return analyses.filter((analysis) => analysis.status === status);
  };

  const getLatestAnalysis = () => {
    return analyses.sort(
      (a, b) =>
        new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    )[0];
  };

  return {
    analyses,
    loading,
    error,
    createAnalysis,
    getAnalysis,
    getAnalysisByStatus,
    getLatestAnalysis,
    refreshAnalyses: loadAnalyses,
  };
}
