export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  tenantId: string;
  projectIds: string[];
}

export type UserRole =
  | 'SystemAdmin'
  | 'ClientAdmin'
  | 'ProjectManager'
  | 'Analyst'
  | 'Viewer'
  | 'ClientEngineer';

export interface Tenant {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  analysisCount: number;
}

export type ProjectStatus = 'Active' | 'Inactive' | 'Archived';

export interface Analysis {
  id: string;
  name: string;
  projectId: string;
  type: AnalysisType;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  fileSize?: number;
  resultSummary?: AnalysisResultSummary;
}

export type AnalysisType = 'CloudFormation' | 'Terraform' | 'CDK' | 'LiveScan';
export type AnalysisStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface AnalysisResultSummary {
  overallScore: number;
  pillars: {
    [key in WellArchitectedPillar]: PillarResult;
  };
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
}

export type WellArchitectedPillar =
  | 'OperationalExcellence'
  | 'Security'
  | 'Reliability'
  | 'PerformanceEfficiency'
  | 'CostOptimization'
  | 'Sustainability';

export interface PillarResult {
  score: number;
  findings: number;
  recommendations: number;
}

export interface Finding {
  id: string;
  analysisId: string;
  pillar: WellArchitectedPillar;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation: string;
  resource?: string;
  line?: number;
}

export type FindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Report {
  id: string;
  analysisId: string;
  projectId: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  createdAt: string;
  downloadUrl?: string;
}

export type ReportType = 'Summary' | 'Detailed' | 'Executive';
export type ReportFormat = 'PDF' | 'Excel' | 'JSON';
export type ReportStatus = 'Generating' | 'Ready' | 'Failed';
