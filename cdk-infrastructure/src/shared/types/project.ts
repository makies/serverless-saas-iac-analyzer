/**
 * Project Type Definitions
 */

export interface Project {
  id: string; // Primary Key (UUID)
  tenantId: string; // GSI1 PK
  name: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  awsAccountIds: string[]; // Related AWS Account IDs
  members: ProjectMember[]; // Project members list
  createdAt: string; // ISO 8601, GSI1 SK
  updatedAt: string; // ISO 8601, GSI2 SK
  createdBy: string; // Creator user ID
  settings?: ProjectSettings;
  tags?: { [key: string]: string };
}

export interface ProjectMember {
  userId: string;
  role: 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';
  addedAt: string;
  addedBy: string;
  permissions?: string[];
}

export interface ProjectSettings {
  defaultFrameworks: string[];
  autoScanEnabled: boolean;
  notificationSettings: {
    emailOnCompletion: boolean;
    emailOnError: boolean;
    slackWebhook?: string;
  };
  analysisSettings: {
    maxFileSize: number; // in MB
    includedFileTypes: string[];
    excludedPaths: string[];
  };
}

export interface GetProjectArgs {
  projectId: string;
}

export interface ListProjectsByTenantArgs {
  tenantId: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  limit?: number;
  nextToken?: string;
}

export interface CreateProjectArgs {
  tenantId: string;
  name: string;
  description?: string;
  awsAccountIds?: string[];
  members?: Omit<ProjectMember, 'addedAt' | 'addedBy'>[];
  settings?: ProjectSettings;
  tags?: { [key: string]: string };
}

export interface UpdateProjectArgs {
  projectId: string;
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  awsAccountIds?: string[];
  settings?: ProjectSettings;
  tags?: { [key: string]: string };
}

export interface AddProjectMemberArgs {
  projectId: string;
  userId: string;
  role: 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';
  permissions?: string[];
}

export interface RemoveProjectMemberArgs {
  projectId: string;
  userId: string;
}

export interface UpdateProjectMemberArgs {
  projectId: string;
  userId: string;
  role?: 'ADMIN' | 'MANAGER' | 'ANALYST' | 'VIEWER';
  permissions?: string[];
}