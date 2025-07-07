/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type Analysis = {
  __typename: "Analysis",
  awsConfig?: string | null,
  completedAt?: string | null,
  createdAt: string,
  createdBy: string,
  executionId?: string | null,
  findings?: ModelFindingConnection | null,
  id: string,
  inputFiles?: string | null,
  name: string,
  project?: Project | null,
  projectId: string,
  reports?: ModelReportConnection | null,
  resultSummary?: string | null,
  status?: AnalysisStatus | null,
  tenant?: Tenant | null,
  tenantId: string,
  type?: AnalysisType | null,
  updatedAt: string,
};

export type ModelFindingConnection = {
  __typename: "ModelFindingConnection",
  items:  Array<Finding | null >,
  nextToken?: string | null,
};

export type Finding = {
  __typename: "Finding",
  analysis?: Analysis | null,
  analysisId: string,
  category?: string | null,
  createdAt: string,
  description: string,
  id: string,
  line?: number | null,
  pillar?: FindingPillar | null,
  recommendation: string,
  resource?: string | null,
  ruleId?: string | null,
  severity?: FindingSeverity | null,
  tenantId: string,
  title: string,
  updatedAt: string,
};

export enum FindingPillar {
  COST_OPTIMIZATION = "COST_OPTIMIZATION",
  OPERATIONAL_EXCELLENCE = "OPERATIONAL_EXCELLENCE",
  PERFORMANCE_EFFICIENCY = "PERFORMANCE_EFFICIENCY",
  RELIABILITY = "RELIABILITY",
  SECURITY = "SECURITY",
  SUSTAINABILITY = "SUSTAINABILITY",
}


export enum FindingSeverity {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  INFO = "INFO",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
}


export type Project = {
  __typename: "Project",
  analyses?: ModelAnalysisConnection | null,
  createdAt: string,
  createdBy: string,
  description?: string | null,
  id: string,
  memberIds: Array< string | null >,
  metrics?: string | null,
  name: string,
  reports?: ModelReportConnection | null,
  settings?: string | null,
  status?: ProjectStatus | null,
  tenant?: Tenant | null,
  tenantId: string,
  updatedAt: string,
};

export type ModelAnalysisConnection = {
  __typename: "ModelAnalysisConnection",
  items:  Array<Analysis | null >,
  nextToken?: string | null,
};

export type ModelReportConnection = {
  __typename: "ModelReportConnection",
  items:  Array<Report | null >,
  nextToken?: string | null,
};

export type Report = {
  __typename: "Report",
  analysis?: Analysis | null,
  analysisId?: string | null,
  createdAt: string,
  format?: ReportFormat | null,
  generatedBy: string,
  id: string,
  name: string,
  project?: Project | null,
  projectId: string,
  s3Location?: string | null,
  status?: ReportStatus | null,
  tenant?: Tenant | null,
  tenantId: string,
  type?: ReportType | null,
  updatedAt: string,
};

export enum ReportFormat {
  EXCEL = "EXCEL",
  HTML = "HTML",
  JSON = "JSON",
  PDF = "PDF",
}


export enum ReportStatus {
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  GENERATING = "GENERATING",
}


export type Tenant = {
  __typename: "Tenant",
  adminEmail: string,
  analyses?: ModelAnalysisConnection | null,
  createdAt: string,
  id: string,
  name: string,
  projects?: ModelProjectConnection | null,
  reports?: ModelReportConnection | null,
  settings?: string | null,
  status?: TenantStatus | null,
  subscription?: string | null,
  updatedAt: string,
  users?: ModelUserConnection | null,
};

export type ModelProjectConnection = {
  __typename: "ModelProjectConnection",
  items:  Array<Project | null >,
  nextToken?: string | null,
};

export enum TenantStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  SUSPENDED = "SUSPENDED",
}


export type ModelUserConnection = {
  __typename: "ModelUserConnection",
  items:  Array<User | null >,
  nextToken?: string | null,
};

export type User = {
  __typename: "User",
  cognitoId: string,
  createdAt: string,
  email: string,
  firstName: string,
  id: string,
  lastLoginAt?: string | null,
  lastName: string,
  owner?: string | null,
  preferences?: string | null,
  projectIds: Array< string | null >,
  role?: UserRole | null,
  status?: UserStatus | null,
  tenant?: Tenant | null,
  tenantId: string,
  updatedAt: string,
};

export enum UserRole {
  ANALYST = "ANALYST",
  CLIENT_ADMIN = "CLIENT_ADMIN",
  CLIENT_ENGINEER = "CLIENT_ENGINEER",
  PROJECT_MANAGER = "PROJECT_MANAGER",
  SYSTEM_ADMIN = "SYSTEM_ADMIN",
  VIEWER = "VIEWER",
}


export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING_INVITATION = "PENDING_INVITATION",
}


export enum ReportType {
  ANALYSIS_SUMMARY = "ANALYSIS_SUMMARY",
  COMPLIANCE_REPORT = "COMPLIANCE_REPORT",
  DETAILED_FINDINGS = "DETAILED_FINDINGS",
  EXECUTIVE_SUMMARY = "EXECUTIVE_SUMMARY",
}


export enum ProjectStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  INACTIVE = "INACTIVE",
}


export enum AnalysisStatus {
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  PENDING = "PENDING",
  RUNNING = "RUNNING",
}


export enum AnalysisType {
  CDK = "CDK",
  CLOUDFORMATION = "CLOUDFORMATION",
  LIVE_SCAN = "LIVE_SCAN",
  TERRAFORM = "TERRAFORM",
}


export type ModelAnalysisFilterInput = {
  and?: Array< ModelAnalysisFilterInput | null > | null,
  awsConfig?: ModelStringInput | null,
  completedAt?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  createdBy?: ModelStringInput | null,
  executionId?: ModelStringInput | null,
  id?: ModelIDInput | null,
  inputFiles?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelAnalysisFilterInput | null,
  or?: Array< ModelAnalysisFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  resultSummary?: ModelStringInput | null,
  status?: ModelAnalysisStatusInput | null,
  tenantId?: ModelIDInput | null,
  type?: ModelAnalysisTypeInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStringInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  _null = "_null",
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
}


export type ModelSizeInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelIDInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export type ModelAnalysisStatusInput = {
  eq?: AnalysisStatus | null,
  ne?: AnalysisStatus | null,
};

export type ModelAnalysisTypeInput = {
  eq?: AnalysisType | null,
  ne?: AnalysisType | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelStringKeyConditionInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
};

export type ModelFindingFilterInput = {
  analysisId?: ModelIDInput | null,
  and?: Array< ModelFindingFilterInput | null > | null,
  category?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  description?: ModelStringInput | null,
  id?: ModelIDInput | null,
  line?: ModelIntInput | null,
  not?: ModelFindingFilterInput | null,
  or?: Array< ModelFindingFilterInput | null > | null,
  pillar?: ModelFindingPillarInput | null,
  recommendation?: ModelStringInput | null,
  resource?: ModelStringInput | null,
  ruleId?: ModelStringInput | null,
  severity?: ModelFindingSeverityInput | null,
  tenantId?: ModelIDInput | null,
  title?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelIntInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelFindingPillarInput = {
  eq?: FindingPillar | null,
  ne?: FindingPillar | null,
};

export type ModelFindingSeverityInput = {
  eq?: FindingSeverity | null,
  ne?: FindingSeverity | null,
};

export type ModelProjectFilterInput = {
  and?: Array< ModelProjectFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  createdBy?: ModelStringInput | null,
  description?: ModelStringInput | null,
  id?: ModelIDInput | null,
  memberIds?: ModelStringInput | null,
  metrics?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelProjectFilterInput | null,
  or?: Array< ModelProjectFilterInput | null > | null,
  settings?: ModelStringInput | null,
  status?: ModelProjectStatusInput | null,
  tenantId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelProjectStatusInput = {
  eq?: ProjectStatus | null,
  ne?: ProjectStatus | null,
};

export type ModelReportFilterInput = {
  analysisId?: ModelIDInput | null,
  and?: Array< ModelReportFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  format?: ModelReportFormatInput | null,
  generatedBy?: ModelStringInput | null,
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelReportFilterInput | null,
  or?: Array< ModelReportFilterInput | null > | null,
  projectId?: ModelIDInput | null,
  s3Location?: ModelStringInput | null,
  status?: ModelReportStatusInput | null,
  tenantId?: ModelIDInput | null,
  type?: ModelReportTypeInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelReportFormatInput = {
  eq?: ReportFormat | null,
  ne?: ReportFormat | null,
};

export type ModelReportStatusInput = {
  eq?: ReportStatus | null,
  ne?: ReportStatus | null,
};

export type ModelReportTypeInput = {
  eq?: ReportType | null,
  ne?: ReportType | null,
};

export type ModelTenantFilterInput = {
  adminEmail?: ModelStringInput | null,
  and?: Array< ModelTenantFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  name?: ModelStringInput | null,
  not?: ModelTenantFilterInput | null,
  or?: Array< ModelTenantFilterInput | null > | null,
  settings?: ModelStringInput | null,
  status?: ModelTenantStatusInput | null,
  subscription?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelTenantStatusInput = {
  eq?: TenantStatus | null,
  ne?: TenantStatus | null,
};

export type ModelTenantConnection = {
  __typename: "ModelTenantConnection",
  items:  Array<Tenant | null >,
  nextToken?: string | null,
};

export type ModelUserFilterInput = {
  and?: Array< ModelUserFilterInput | null > | null,
  cognitoId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  email?: ModelStringInput | null,
  firstName?: ModelStringInput | null,
  id?: ModelIDInput | null,
  lastLoginAt?: ModelStringInput | null,
  lastName?: ModelStringInput | null,
  not?: ModelUserFilterInput | null,
  or?: Array< ModelUserFilterInput | null > | null,
  owner?: ModelStringInput | null,
  preferences?: ModelStringInput | null,
  projectIds?: ModelStringInput | null,
  role?: ModelUserRoleInput | null,
  status?: ModelUserStatusInput | null,
  tenantId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelUserRoleInput = {
  eq?: UserRole | null,
  ne?: UserRole | null,
};

export type ModelUserStatusInput = {
  eq?: UserStatus | null,
  ne?: UserStatus | null,
};

export type ModelAnalysisConditionInput = {
  and?: Array< ModelAnalysisConditionInput | null > | null,
  awsConfig?: ModelStringInput | null,
  completedAt?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  createdBy?: ModelStringInput | null,
  executionId?: ModelStringInput | null,
  inputFiles?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelAnalysisConditionInput | null,
  or?: Array< ModelAnalysisConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  resultSummary?: ModelStringInput | null,
  status?: ModelAnalysisStatusInput | null,
  tenantId?: ModelIDInput | null,
  type?: ModelAnalysisTypeInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateAnalysisInput = {
  awsConfig?: string | null,
  completedAt?: string | null,
  createdAt?: string | null,
  createdBy: string,
  executionId?: string | null,
  id?: string | null,
  inputFiles?: string | null,
  name: string,
  projectId: string,
  resultSummary?: string | null,
  status?: AnalysisStatus | null,
  tenantId: string,
  type?: AnalysisType | null,
  updatedAt?: string | null,
};

export type ModelFindingConditionInput = {
  analysisId?: ModelIDInput | null,
  and?: Array< ModelFindingConditionInput | null > | null,
  category?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  description?: ModelStringInput | null,
  line?: ModelIntInput | null,
  not?: ModelFindingConditionInput | null,
  or?: Array< ModelFindingConditionInput | null > | null,
  pillar?: ModelFindingPillarInput | null,
  recommendation?: ModelStringInput | null,
  resource?: ModelStringInput | null,
  ruleId?: ModelStringInput | null,
  severity?: ModelFindingSeverityInput | null,
  tenantId?: ModelIDInput | null,
  title?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateFindingInput = {
  analysisId: string,
  category?: string | null,
  createdAt?: string | null,
  description: string,
  id?: string | null,
  line?: number | null,
  pillar?: FindingPillar | null,
  recommendation: string,
  resource?: string | null,
  ruleId?: string | null,
  severity?: FindingSeverity | null,
  tenantId: string,
  title: string,
};

export type ModelProjectConditionInput = {
  and?: Array< ModelProjectConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  createdBy?: ModelStringInput | null,
  description?: ModelStringInput | null,
  memberIds?: ModelStringInput | null,
  metrics?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelProjectConditionInput | null,
  or?: Array< ModelProjectConditionInput | null > | null,
  settings?: ModelStringInput | null,
  status?: ModelProjectStatusInput | null,
  tenantId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateProjectInput = {
  createdAt?: string | null,
  createdBy: string,
  description?: string | null,
  id?: string | null,
  memberIds: Array< string | null >,
  metrics?: string | null,
  name: string,
  settings?: string | null,
  status?: ProjectStatus | null,
  tenantId: string,
  updatedAt?: string | null,
};

export type ModelReportConditionInput = {
  analysisId?: ModelIDInput | null,
  and?: Array< ModelReportConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  format?: ModelReportFormatInput | null,
  generatedBy?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelReportConditionInput | null,
  or?: Array< ModelReportConditionInput | null > | null,
  projectId?: ModelIDInput | null,
  s3Location?: ModelStringInput | null,
  status?: ModelReportStatusInput | null,
  tenantId?: ModelIDInput | null,
  type?: ModelReportTypeInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateReportInput = {
  analysisId?: string | null,
  createdAt?: string | null,
  format?: ReportFormat | null,
  generatedBy: string,
  id?: string | null,
  name: string,
  projectId: string,
  s3Location?: string | null,
  status?: ReportStatus | null,
  tenantId: string,
  type?: ReportType | null,
  updatedAt?: string | null,
};

export type ModelTenantConditionInput = {
  adminEmail?: ModelStringInput | null,
  and?: Array< ModelTenantConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  name?: ModelStringInput | null,
  not?: ModelTenantConditionInput | null,
  or?: Array< ModelTenantConditionInput | null > | null,
  settings?: ModelStringInput | null,
  status?: ModelTenantStatusInput | null,
  subscription?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateTenantInput = {
  adminEmail: string,
  createdAt?: string | null,
  id?: string | null,
  name: string,
  settings?: string | null,
  status?: TenantStatus | null,
  subscription?: string | null,
  updatedAt?: string | null,
};

export type ModelUserConditionInput = {
  and?: Array< ModelUserConditionInput | null > | null,
  cognitoId?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  email?: ModelStringInput | null,
  firstName?: ModelStringInput | null,
  lastLoginAt?: ModelStringInput | null,
  lastName?: ModelStringInput | null,
  not?: ModelUserConditionInput | null,
  or?: Array< ModelUserConditionInput | null > | null,
  owner?: ModelStringInput | null,
  preferences?: ModelStringInput | null,
  projectIds?: ModelStringInput | null,
  role?: ModelUserRoleInput | null,
  status?: ModelUserStatusInput | null,
  tenantId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateUserInput = {
  cognitoId: string,
  createdAt?: string | null,
  email: string,
  firstName: string,
  id?: string | null,
  lastLoginAt?: string | null,
  lastName: string,
  preferences?: string | null,
  projectIds: Array< string | null >,
  role?: UserRole | null,
  status?: UserStatus | null,
  tenantId: string,
  updatedAt?: string | null,
};

export type DeleteAnalysisInput = {
  id: string,
};

export type DeleteFindingInput = {
  id: string,
};

export type DeleteProjectInput = {
  id: string,
};

export type DeleteReportInput = {
  id: string,
};

export type DeleteTenantInput = {
  id: string,
};

export type DeleteUserInput = {
  id: string,
};

export type UpdateAnalysisInput = {
  awsConfig?: string | null,
  completedAt?: string | null,
  createdAt?: string | null,
  createdBy?: string | null,
  executionId?: string | null,
  id: string,
  inputFiles?: string | null,
  name?: string | null,
  projectId?: string | null,
  resultSummary?: string | null,
  status?: AnalysisStatus | null,
  tenantId?: string | null,
  type?: AnalysisType | null,
  updatedAt?: string | null,
};

export type UpdateFindingInput = {
  analysisId?: string | null,
  category?: string | null,
  createdAt?: string | null,
  description?: string | null,
  id: string,
  line?: number | null,
  pillar?: FindingPillar | null,
  recommendation?: string | null,
  resource?: string | null,
  ruleId?: string | null,
  severity?: FindingSeverity | null,
  tenantId?: string | null,
  title?: string | null,
};

export type UpdateProjectInput = {
  createdAt?: string | null,
  createdBy?: string | null,
  description?: string | null,
  id: string,
  memberIds?: Array< string | null > | null,
  metrics?: string | null,
  name?: string | null,
  settings?: string | null,
  status?: ProjectStatus | null,
  tenantId?: string | null,
  updatedAt?: string | null,
};

export type UpdateReportInput = {
  analysisId?: string | null,
  createdAt?: string | null,
  format?: ReportFormat | null,
  generatedBy?: string | null,
  id: string,
  name?: string | null,
  projectId?: string | null,
  s3Location?: string | null,
  status?: ReportStatus | null,
  tenantId?: string | null,
  type?: ReportType | null,
  updatedAt?: string | null,
};

export type UpdateTenantInput = {
  adminEmail?: string | null,
  createdAt?: string | null,
  id: string,
  name?: string | null,
  settings?: string | null,
  status?: TenantStatus | null,
  subscription?: string | null,
  updatedAt?: string | null,
};

export type UpdateUserInput = {
  cognitoId?: string | null,
  createdAt?: string | null,
  email?: string | null,
  firstName?: string | null,
  id: string,
  lastLoginAt?: string | null,
  lastName?: string | null,
  preferences?: string | null,
  projectIds?: Array< string | null > | null,
  role?: UserRole | null,
  status?: UserStatus | null,
  tenantId?: string | null,
  updatedAt?: string | null,
};

export type ModelSubscriptionAnalysisFilterInput = {
  and?: Array< ModelSubscriptionAnalysisFilterInput | null > | null,
  awsConfig?: ModelSubscriptionStringInput | null,
  completedAt?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  createdBy?: ModelSubscriptionStringInput | null,
  executionId?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  inputFiles?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionAnalysisFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  resultSummary?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  tenantId?: ModelSubscriptionIDInput | null,
  type?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionStringInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIDInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionFindingFilterInput = {
  analysisId?: ModelSubscriptionIDInput | null,
  and?: Array< ModelSubscriptionFindingFilterInput | null > | null,
  category?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  line?: ModelSubscriptionIntInput | null,
  or?: Array< ModelSubscriptionFindingFilterInput | null > | null,
  pillar?: ModelSubscriptionStringInput | null,
  recommendation?: ModelSubscriptionStringInput | null,
  resource?: ModelSubscriptionStringInput | null,
  ruleId?: ModelSubscriptionStringInput | null,
  severity?: ModelSubscriptionStringInput | null,
  tenantId?: ModelSubscriptionIDInput | null,
  title?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionIntInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  in?: Array< number | null > | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionProjectFilterInput = {
  and?: Array< ModelSubscriptionProjectFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  createdBy?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  memberIds?: ModelSubscriptionStringInput | null,
  metrics?: ModelSubscriptionStringInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionProjectFilterInput | null > | null,
  settings?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  tenantId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionReportFilterInput = {
  analysisId?: ModelSubscriptionIDInput | null,
  and?: Array< ModelSubscriptionReportFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  format?: ModelSubscriptionStringInput | null,
  generatedBy?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionReportFilterInput | null > | null,
  projectId?: ModelSubscriptionIDInput | null,
  s3Location?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  tenantId?: ModelSubscriptionIDInput | null,
  type?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionTenantFilterInput = {
  adminEmail?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionTenantFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  name?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionTenantFilterInput | null > | null,
  settings?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  subscription?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionUserFilterInput = {
  and?: Array< ModelSubscriptionUserFilterInput | null > | null,
  cognitoId?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  email?: ModelSubscriptionStringInput | null,
  firstName?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  lastLoginAt?: ModelSubscriptionStringInput | null,
  lastName?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionUserFilterInput | null > | null,
  owner?: ModelStringInput | null,
  preferences?: ModelSubscriptionStringInput | null,
  projectIds?: ModelSubscriptionStringInput | null,
  role?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  tenantId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type GetAnalysisQueryVariables = {
  id: string,
};

export type GetAnalysisQuery = {
  getAnalysis?:  {
    __typename: "Analysis",
    awsConfig?: string | null,
    completedAt?: string | null,
    createdAt: string,
    createdBy: string,
    executionId?: string | null,
    findings?:  {
      __typename: "ModelFindingConnection",
      nextToken?: string | null,
    } | null,
    id: string,
    inputFiles?: string | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    resultSummary?: string | null,
    status?: AnalysisStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: AnalysisType | null,
    updatedAt: string,
  } | null,
};

export type GetFindingQueryVariables = {
  id: string,
};

export type GetFindingQuery = {
  getFinding?:  {
    __typename: "Finding",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId: string,
    category?: string | null,
    createdAt: string,
    description: string,
    id: string,
    line?: number | null,
    pillar?: FindingPillar | null,
    recommendation: string,
    resource?: string | null,
    ruleId?: string | null,
    severity?: FindingSeverity | null,
    tenantId: string,
    title: string,
    updatedAt: string,
  } | null,
};

export type GetProjectQueryVariables = {
  id: string,
};

export type GetProjectQuery = {
  getProject?:  {
    __typename: "Project",
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    createdBy: string,
    description?: string | null,
    id: string,
    memberIds: Array< string | null >,
    metrics?: string | null,
    name: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: ProjectStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type GetReportQueryVariables = {
  id: string,
};

export type GetReportQuery = {
  getReport?:  {
    __typename: "Report",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId?: string | null,
    createdAt: string,
    format?: ReportFormat | null,
    generatedBy: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    s3Location?: string | null,
    status?: ReportStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: ReportType | null,
    updatedAt: string,
  } | null,
};

export type GetTenantQueryVariables = {
  id: string,
};

export type GetTenantQuery = {
  getTenant?:  {
    __typename: "Tenant",
    adminEmail: string,
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    projects?:  {
      __typename: "ModelProjectConnection",
      nextToken?: string | null,
    } | null,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: TenantStatus | null,
    subscription?: string | null,
    updatedAt: string,
    users?:  {
      __typename: "ModelUserConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type GetUserQueryVariables = {
  id: string,
};

export type GetUserQuery = {
  getUser?:  {
    __typename: "User",
    cognitoId: string,
    createdAt: string,
    email: string,
    firstName: string,
    id: string,
    lastLoginAt?: string | null,
    lastName: string,
    owner?: string | null,
    preferences?: string | null,
    projectIds: Array< string | null >,
    role?: UserRole | null,
    status?: UserStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type ListAnalysesQueryVariables = {
  filter?: ModelAnalysisFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListAnalysesQuery = {
  listAnalyses?:  {
    __typename: "ModelAnalysisConnection",
    items:  Array< {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListAnalysisByProjectIdAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelAnalysisFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type ListAnalysisByProjectIdAndCreatedAtQuery = {
  listAnalysisByProjectIdAndCreatedAt?:  {
    __typename: "ModelAnalysisConnection",
    items:  Array< {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListAnalysisByStatusAndUpdatedAtQueryVariables = {
  filter?: ModelAnalysisFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  status: AnalysisStatus,
  updatedAt?: ModelStringKeyConditionInput | null,
};

export type ListAnalysisByStatusAndUpdatedAtQuery = {
  listAnalysisByStatusAndUpdatedAt?:  {
    __typename: "ModelAnalysisConnection",
    items:  Array< {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListAnalysisByTenantIdAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelAnalysisFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  tenantId: string,
};

export type ListAnalysisByTenantIdAndCreatedAtQuery = {
  listAnalysisByTenantIdAndCreatedAt?:  {
    __typename: "ModelAnalysisConnection",
    items:  Array< {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListFindingByAnalysisIdAndSeverityQueryVariables = {
  analysisId: string,
  filter?: ModelFindingFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  severity?: ModelStringKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListFindingByAnalysisIdAndSeverityQuery = {
  listFindingByAnalysisIdAndSeverity?:  {
    __typename: "ModelFindingConnection",
    items:  Array< {
      __typename: "Finding",
      analysisId: string,
      category?: string | null,
      createdAt: string,
      description: string,
      id: string,
      line?: number | null,
      pillar?: FindingPillar | null,
      recommendation: string,
      resource?: string | null,
      ruleId?: string | null,
      severity?: FindingSeverity | null,
      tenantId: string,
      title: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListFindingBySeverityAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelFindingFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  severity: FindingSeverity,
  sortDirection?: ModelSortDirection | null,
};

export type ListFindingBySeverityAndCreatedAtQuery = {
  listFindingBySeverityAndCreatedAt?:  {
    __typename: "ModelFindingConnection",
    items:  Array< {
      __typename: "Finding",
      analysisId: string,
      category?: string | null,
      createdAt: string,
      description: string,
      id: string,
      line?: number | null,
      pillar?: FindingPillar | null,
      recommendation: string,
      resource?: string | null,
      ruleId?: string | null,
      severity?: FindingSeverity | null,
      tenantId: string,
      title: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListFindingByTenantIdAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelFindingFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  tenantId: string,
};

export type ListFindingByTenantIdAndCreatedAtQuery = {
  listFindingByTenantIdAndCreatedAt?:  {
    __typename: "ModelFindingConnection",
    items:  Array< {
      __typename: "Finding",
      analysisId: string,
      category?: string | null,
      createdAt: string,
      description: string,
      id: string,
      line?: number | null,
      pillar?: FindingPillar | null,
      recommendation: string,
      resource?: string | null,
      ruleId?: string | null,
      severity?: FindingSeverity | null,
      tenantId: string,
      title: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListFindingsQueryVariables = {
  filter?: ModelFindingFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListFindingsQuery = {
  listFindings?:  {
    __typename: "ModelFindingConnection",
    items:  Array< {
      __typename: "Finding",
      analysisId: string,
      category?: string | null,
      createdAt: string,
      description: string,
      id: string,
      line?: number | null,
      pillar?: FindingPillar | null,
      recommendation: string,
      resource?: string | null,
      ruleId?: string | null,
      severity?: FindingSeverity | null,
      tenantId: string,
      title: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListProjectByStatusAndUpdatedAtQueryVariables = {
  filter?: ModelProjectFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  status: ProjectStatus,
  updatedAt?: ModelStringKeyConditionInput | null,
};

export type ListProjectByStatusAndUpdatedAtQuery = {
  listProjectByStatusAndUpdatedAt?:  {
    __typename: "ModelProjectConnection",
    items:  Array< {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListProjectByTenantIdAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelProjectFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  tenantId: string,
};

export type ListProjectByTenantIdAndCreatedAtQuery = {
  listProjectByTenantIdAndCreatedAt?:  {
    __typename: "ModelProjectConnection",
    items:  Array< {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListProjectsQueryVariables = {
  filter?: ModelProjectFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListProjectsQuery = {
  listProjects?:  {
    __typename: "ModelProjectConnection",
    items:  Array< {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListReportByAnalysisIdAndCreatedAtQueryVariables = {
  analysisId: string,
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelReportFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListReportByAnalysisIdAndCreatedAtQuery = {
  listReportByAnalysisIdAndCreatedAt?:  {
    __typename: "ModelReportConnection",
    items:  Array< {
      __typename: "Report",
      analysisId?: string | null,
      createdAt: string,
      format?: ReportFormat | null,
      generatedBy: string,
      id: string,
      name: string,
      projectId: string,
      s3Location?: string | null,
      status?: ReportStatus | null,
      tenantId: string,
      type?: ReportType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListReportByProjectIdAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelReportFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  projectId: string,
  sortDirection?: ModelSortDirection | null,
};

export type ListReportByProjectIdAndCreatedAtQuery = {
  listReportByProjectIdAndCreatedAt?:  {
    __typename: "ModelReportConnection",
    items:  Array< {
      __typename: "Report",
      analysisId?: string | null,
      createdAt: string,
      format?: ReportFormat | null,
      generatedBy: string,
      id: string,
      name: string,
      projectId: string,
      s3Location?: string | null,
      status?: ReportStatus | null,
      tenantId: string,
      type?: ReportType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListReportByTenantIdAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelReportFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  tenantId: string,
};

export type ListReportByTenantIdAndCreatedAtQuery = {
  listReportByTenantIdAndCreatedAt?:  {
    __typename: "ModelReportConnection",
    items:  Array< {
      __typename: "Report",
      analysisId?: string | null,
      createdAt: string,
      format?: ReportFormat | null,
      generatedBy: string,
      id: string,
      name: string,
      projectId: string,
      s3Location?: string | null,
      status?: ReportStatus | null,
      tenantId: string,
      type?: ReportType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListReportsQueryVariables = {
  filter?: ModelReportFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListReportsQuery = {
  listReports?:  {
    __typename: "ModelReportConnection",
    items:  Array< {
      __typename: "Report",
      analysisId?: string | null,
      createdAt: string,
      format?: ReportFormat | null,
      generatedBy: string,
      id: string,
      name: string,
      projectId: string,
      s3Location?: string | null,
      status?: ReportStatus | null,
      tenantId: string,
      type?: ReportType | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListTenantsQueryVariables = {
  filter?: ModelTenantFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListTenantsQuery = {
  listTenants?:  {
    __typename: "ModelTenantConnection",
    items:  Array< {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserByCognitoIdQueryVariables = {
  cognitoId: string,
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserByCognitoIdQuery = {
  listUserByCognitoId?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      cognitoId: string,
      createdAt: string,
      email: string,
      firstName: string,
      id: string,
      lastLoginAt?: string | null,
      lastName: string,
      owner?: string | null,
      preferences?: string | null,
      projectIds: Array< string | null >,
      role?: UserRole | null,
      status?: UserStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserByEmailQueryVariables = {
  email: string,
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserByEmailQuery = {
  listUserByEmail?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      cognitoId: string,
      createdAt: string,
      email: string,
      firstName: string,
      id: string,
      lastLoginAt?: string | null,
      lastName: string,
      owner?: string | null,
      preferences?: string | null,
      projectIds: Array< string | null >,
      role?: UserRole | null,
      status?: UserStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserByRoleAndLastLoginAtQueryVariables = {
  filter?: ModelUserFilterInput | null,
  lastLoginAt?: ModelStringKeyConditionInput | null,
  limit?: number | null,
  nextToken?: string | null,
  role: UserRole,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserByRoleAndLastLoginAtQuery = {
  listUserByRoleAndLastLoginAt?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      cognitoId: string,
      createdAt: string,
      email: string,
      firstName: string,
      id: string,
      lastLoginAt?: string | null,
      lastName: string,
      owner?: string | null,
      preferences?: string | null,
      projectIds: Array< string | null >,
      role?: UserRole | null,
      status?: UserStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserByTenantIdAndCreatedAtQueryVariables = {
  createdAt?: ModelStringKeyConditionInput | null,
  filter?: ModelUserFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  tenantId: string,
};

export type ListUserByTenantIdAndCreatedAtQuery = {
  listUserByTenantIdAndCreatedAt?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      cognitoId: string,
      createdAt: string,
      email: string,
      firstName: string,
      id: string,
      lastLoginAt?: string | null,
      lastName: string,
      owner?: string | null,
      preferences?: string | null,
      projectIds: Array< string | null >,
      role?: UserRole | null,
      status?: UserStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUsersQueryVariables = {
  filter?: ModelUserFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUsersQuery = {
  listUsers?:  {
    __typename: "ModelUserConnection",
    items:  Array< {
      __typename: "User",
      cognitoId: string,
      createdAt: string,
      email: string,
      firstName: string,
      id: string,
      lastLoginAt?: string | null,
      lastName: string,
      owner?: string | null,
      preferences?: string | null,
      projectIds: Array< string | null >,
      role?: UserRole | null,
      status?: UserStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type CreateAnalysisMutationVariables = {
  condition?: ModelAnalysisConditionInput | null,
  input: CreateAnalysisInput,
};

export type CreateAnalysisMutation = {
  createAnalysis?:  {
    __typename: "Analysis",
    awsConfig?: string | null,
    completedAt?: string | null,
    createdAt: string,
    createdBy: string,
    executionId?: string | null,
    findings?:  {
      __typename: "ModelFindingConnection",
      nextToken?: string | null,
    } | null,
    id: string,
    inputFiles?: string | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    resultSummary?: string | null,
    status?: AnalysisStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: AnalysisType | null,
    updatedAt: string,
  } | null,
};

export type CreateFindingMutationVariables = {
  condition?: ModelFindingConditionInput | null,
  input: CreateFindingInput,
};

export type CreateFindingMutation = {
  createFinding?:  {
    __typename: "Finding",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId: string,
    category?: string | null,
    createdAt: string,
    description: string,
    id: string,
    line?: number | null,
    pillar?: FindingPillar | null,
    recommendation: string,
    resource?: string | null,
    ruleId?: string | null,
    severity?: FindingSeverity | null,
    tenantId: string,
    title: string,
    updatedAt: string,
  } | null,
};

export type CreateProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: CreateProjectInput,
};

export type CreateProjectMutation = {
  createProject?:  {
    __typename: "Project",
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    createdBy: string,
    description?: string | null,
    id: string,
    memberIds: Array< string | null >,
    metrics?: string | null,
    name: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: ProjectStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type CreateReportMutationVariables = {
  condition?: ModelReportConditionInput | null,
  input: CreateReportInput,
};

export type CreateReportMutation = {
  createReport?:  {
    __typename: "Report",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId?: string | null,
    createdAt: string,
    format?: ReportFormat | null,
    generatedBy: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    s3Location?: string | null,
    status?: ReportStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: ReportType | null,
    updatedAt: string,
  } | null,
};

export type CreateTenantMutationVariables = {
  condition?: ModelTenantConditionInput | null,
  input: CreateTenantInput,
};

export type CreateTenantMutation = {
  createTenant?:  {
    __typename: "Tenant",
    adminEmail: string,
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    projects?:  {
      __typename: "ModelProjectConnection",
      nextToken?: string | null,
    } | null,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: TenantStatus | null,
    subscription?: string | null,
    updatedAt: string,
    users?:  {
      __typename: "ModelUserConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type CreateUserMutationVariables = {
  condition?: ModelUserConditionInput | null,
  input: CreateUserInput,
};

export type CreateUserMutation = {
  createUser?:  {
    __typename: "User",
    cognitoId: string,
    createdAt: string,
    email: string,
    firstName: string,
    id: string,
    lastLoginAt?: string | null,
    lastName: string,
    owner?: string | null,
    preferences?: string | null,
    projectIds: Array< string | null >,
    role?: UserRole | null,
    status?: UserStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type DeleteAnalysisMutationVariables = {
  condition?: ModelAnalysisConditionInput | null,
  input: DeleteAnalysisInput,
};

export type DeleteAnalysisMutation = {
  deleteAnalysis?:  {
    __typename: "Analysis",
    awsConfig?: string | null,
    completedAt?: string | null,
    createdAt: string,
    createdBy: string,
    executionId?: string | null,
    findings?:  {
      __typename: "ModelFindingConnection",
      nextToken?: string | null,
    } | null,
    id: string,
    inputFiles?: string | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    resultSummary?: string | null,
    status?: AnalysisStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: AnalysisType | null,
    updatedAt: string,
  } | null,
};

export type DeleteFindingMutationVariables = {
  condition?: ModelFindingConditionInput | null,
  input: DeleteFindingInput,
};

export type DeleteFindingMutation = {
  deleteFinding?:  {
    __typename: "Finding",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId: string,
    category?: string | null,
    createdAt: string,
    description: string,
    id: string,
    line?: number | null,
    pillar?: FindingPillar | null,
    recommendation: string,
    resource?: string | null,
    ruleId?: string | null,
    severity?: FindingSeverity | null,
    tenantId: string,
    title: string,
    updatedAt: string,
  } | null,
};

export type DeleteProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: DeleteProjectInput,
};

export type DeleteProjectMutation = {
  deleteProject?:  {
    __typename: "Project",
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    createdBy: string,
    description?: string | null,
    id: string,
    memberIds: Array< string | null >,
    metrics?: string | null,
    name: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: ProjectStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type DeleteReportMutationVariables = {
  condition?: ModelReportConditionInput | null,
  input: DeleteReportInput,
};

export type DeleteReportMutation = {
  deleteReport?:  {
    __typename: "Report",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId?: string | null,
    createdAt: string,
    format?: ReportFormat | null,
    generatedBy: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    s3Location?: string | null,
    status?: ReportStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: ReportType | null,
    updatedAt: string,
  } | null,
};

export type DeleteTenantMutationVariables = {
  condition?: ModelTenantConditionInput | null,
  input: DeleteTenantInput,
};

export type DeleteTenantMutation = {
  deleteTenant?:  {
    __typename: "Tenant",
    adminEmail: string,
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    projects?:  {
      __typename: "ModelProjectConnection",
      nextToken?: string | null,
    } | null,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: TenantStatus | null,
    subscription?: string | null,
    updatedAt: string,
    users?:  {
      __typename: "ModelUserConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type DeleteUserMutationVariables = {
  condition?: ModelUserConditionInput | null,
  input: DeleteUserInput,
};

export type DeleteUserMutation = {
  deleteUser?:  {
    __typename: "User",
    cognitoId: string,
    createdAt: string,
    email: string,
    firstName: string,
    id: string,
    lastLoginAt?: string | null,
    lastName: string,
    owner?: string | null,
    preferences?: string | null,
    projectIds: Array< string | null >,
    role?: UserRole | null,
    status?: UserStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type UpdateAnalysisMutationVariables = {
  condition?: ModelAnalysisConditionInput | null,
  input: UpdateAnalysisInput,
};

export type UpdateAnalysisMutation = {
  updateAnalysis?:  {
    __typename: "Analysis",
    awsConfig?: string | null,
    completedAt?: string | null,
    createdAt: string,
    createdBy: string,
    executionId?: string | null,
    findings?:  {
      __typename: "ModelFindingConnection",
      nextToken?: string | null,
    } | null,
    id: string,
    inputFiles?: string | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    resultSummary?: string | null,
    status?: AnalysisStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: AnalysisType | null,
    updatedAt: string,
  } | null,
};

export type UpdateFindingMutationVariables = {
  condition?: ModelFindingConditionInput | null,
  input: UpdateFindingInput,
};

export type UpdateFindingMutation = {
  updateFinding?:  {
    __typename: "Finding",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId: string,
    category?: string | null,
    createdAt: string,
    description: string,
    id: string,
    line?: number | null,
    pillar?: FindingPillar | null,
    recommendation: string,
    resource?: string | null,
    ruleId?: string | null,
    severity?: FindingSeverity | null,
    tenantId: string,
    title: string,
    updatedAt: string,
  } | null,
};

export type UpdateProjectMutationVariables = {
  condition?: ModelProjectConditionInput | null,
  input: UpdateProjectInput,
};

export type UpdateProjectMutation = {
  updateProject?:  {
    __typename: "Project",
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    createdBy: string,
    description?: string | null,
    id: string,
    memberIds: Array< string | null >,
    metrics?: string | null,
    name: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: ProjectStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type UpdateReportMutationVariables = {
  condition?: ModelReportConditionInput | null,
  input: UpdateReportInput,
};

export type UpdateReportMutation = {
  updateReport?:  {
    __typename: "Report",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId?: string | null,
    createdAt: string,
    format?: ReportFormat | null,
    generatedBy: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    s3Location?: string | null,
    status?: ReportStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: ReportType | null,
    updatedAt: string,
  } | null,
};

export type UpdateTenantMutationVariables = {
  condition?: ModelTenantConditionInput | null,
  input: UpdateTenantInput,
};

export type UpdateTenantMutation = {
  updateTenant?:  {
    __typename: "Tenant",
    adminEmail: string,
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    projects?:  {
      __typename: "ModelProjectConnection",
      nextToken?: string | null,
    } | null,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: TenantStatus | null,
    subscription?: string | null,
    updatedAt: string,
    users?:  {
      __typename: "ModelUserConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type UpdateUserMutationVariables = {
  condition?: ModelUserConditionInput | null,
  input: UpdateUserInput,
};

export type UpdateUserMutation = {
  updateUser?:  {
    __typename: "User",
    cognitoId: string,
    createdAt: string,
    email: string,
    firstName: string,
    id: string,
    lastLoginAt?: string | null,
    lastName: string,
    owner?: string | null,
    preferences?: string | null,
    projectIds: Array< string | null >,
    role?: UserRole | null,
    status?: UserStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateAnalysisSubscriptionVariables = {
  filter?: ModelSubscriptionAnalysisFilterInput | null,
};

export type OnCreateAnalysisSubscription = {
  onCreateAnalysis?:  {
    __typename: "Analysis",
    awsConfig?: string | null,
    completedAt?: string | null,
    createdAt: string,
    createdBy: string,
    executionId?: string | null,
    findings?:  {
      __typename: "ModelFindingConnection",
      nextToken?: string | null,
    } | null,
    id: string,
    inputFiles?: string | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    resultSummary?: string | null,
    status?: AnalysisStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: AnalysisType | null,
    updatedAt: string,
  } | null,
};

export type OnCreateFindingSubscriptionVariables = {
  filter?: ModelSubscriptionFindingFilterInput | null,
};

export type OnCreateFindingSubscription = {
  onCreateFinding?:  {
    __typename: "Finding",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId: string,
    category?: string | null,
    createdAt: string,
    description: string,
    id: string,
    line?: number | null,
    pillar?: FindingPillar | null,
    recommendation: string,
    resource?: string | null,
    ruleId?: string | null,
    severity?: FindingSeverity | null,
    tenantId: string,
    title: string,
    updatedAt: string,
  } | null,
};

export type OnCreateProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnCreateProjectSubscription = {
  onCreateProject?:  {
    __typename: "Project",
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    createdBy: string,
    description?: string | null,
    id: string,
    memberIds: Array< string | null >,
    metrics?: string | null,
    name: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: ProjectStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateReportSubscriptionVariables = {
  filter?: ModelSubscriptionReportFilterInput | null,
};

export type OnCreateReportSubscription = {
  onCreateReport?:  {
    __typename: "Report",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId?: string | null,
    createdAt: string,
    format?: ReportFormat | null,
    generatedBy: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    s3Location?: string | null,
    status?: ReportStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: ReportType | null,
    updatedAt: string,
  } | null,
};

export type OnCreateTenantSubscriptionVariables = {
  filter?: ModelSubscriptionTenantFilterInput | null,
};

export type OnCreateTenantSubscription = {
  onCreateTenant?:  {
    __typename: "Tenant",
    adminEmail: string,
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    projects?:  {
      __typename: "ModelProjectConnection",
      nextToken?: string | null,
    } | null,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: TenantStatus | null,
    subscription?: string | null,
    updatedAt: string,
    users?:  {
      __typename: "ModelUserConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type OnCreateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnCreateUserSubscription = {
  onCreateUser?:  {
    __typename: "User",
    cognitoId: string,
    createdAt: string,
    email: string,
    firstName: string,
    id: string,
    lastLoginAt?: string | null,
    lastName: string,
    owner?: string | null,
    preferences?: string | null,
    projectIds: Array< string | null >,
    role?: UserRole | null,
    status?: UserStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteAnalysisSubscriptionVariables = {
  filter?: ModelSubscriptionAnalysisFilterInput | null,
};

export type OnDeleteAnalysisSubscription = {
  onDeleteAnalysis?:  {
    __typename: "Analysis",
    awsConfig?: string | null,
    completedAt?: string | null,
    createdAt: string,
    createdBy: string,
    executionId?: string | null,
    findings?:  {
      __typename: "ModelFindingConnection",
      nextToken?: string | null,
    } | null,
    id: string,
    inputFiles?: string | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    resultSummary?: string | null,
    status?: AnalysisStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: AnalysisType | null,
    updatedAt: string,
  } | null,
};

export type OnDeleteFindingSubscriptionVariables = {
  filter?: ModelSubscriptionFindingFilterInput | null,
};

export type OnDeleteFindingSubscription = {
  onDeleteFinding?:  {
    __typename: "Finding",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId: string,
    category?: string | null,
    createdAt: string,
    description: string,
    id: string,
    line?: number | null,
    pillar?: FindingPillar | null,
    recommendation: string,
    resource?: string | null,
    ruleId?: string | null,
    severity?: FindingSeverity | null,
    tenantId: string,
    title: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnDeleteProjectSubscription = {
  onDeleteProject?:  {
    __typename: "Project",
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    createdBy: string,
    description?: string | null,
    id: string,
    memberIds: Array< string | null >,
    metrics?: string | null,
    name: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: ProjectStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteReportSubscriptionVariables = {
  filter?: ModelSubscriptionReportFilterInput | null,
};

export type OnDeleteReportSubscription = {
  onDeleteReport?:  {
    __typename: "Report",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId?: string | null,
    createdAt: string,
    format?: ReportFormat | null,
    generatedBy: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    s3Location?: string | null,
    status?: ReportStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: ReportType | null,
    updatedAt: string,
  } | null,
};

export type OnDeleteTenantSubscriptionVariables = {
  filter?: ModelSubscriptionTenantFilterInput | null,
};

export type OnDeleteTenantSubscription = {
  onDeleteTenant?:  {
    __typename: "Tenant",
    adminEmail: string,
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    projects?:  {
      __typename: "ModelProjectConnection",
      nextToken?: string | null,
    } | null,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: TenantStatus | null,
    subscription?: string | null,
    updatedAt: string,
    users?:  {
      __typename: "ModelUserConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type OnDeleteUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnDeleteUserSubscription = {
  onDeleteUser?:  {
    __typename: "User",
    cognitoId: string,
    createdAt: string,
    email: string,
    firstName: string,
    id: string,
    lastLoginAt?: string | null,
    lastName: string,
    owner?: string | null,
    preferences?: string | null,
    projectIds: Array< string | null >,
    role?: UserRole | null,
    status?: UserStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateAnalysisSubscriptionVariables = {
  filter?: ModelSubscriptionAnalysisFilterInput | null,
};

export type OnUpdateAnalysisSubscription = {
  onUpdateAnalysis?:  {
    __typename: "Analysis",
    awsConfig?: string | null,
    completedAt?: string | null,
    createdAt: string,
    createdBy: string,
    executionId?: string | null,
    findings?:  {
      __typename: "ModelFindingConnection",
      nextToken?: string | null,
    } | null,
    id: string,
    inputFiles?: string | null,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    resultSummary?: string | null,
    status?: AnalysisStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: AnalysisType | null,
    updatedAt: string,
  } | null,
};

export type OnUpdateFindingSubscriptionVariables = {
  filter?: ModelSubscriptionFindingFilterInput | null,
};

export type OnUpdateFindingSubscription = {
  onUpdateFinding?:  {
    __typename: "Finding",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId: string,
    category?: string | null,
    createdAt: string,
    description: string,
    id: string,
    line?: number | null,
    pillar?: FindingPillar | null,
    recommendation: string,
    resource?: string | null,
    ruleId?: string | null,
    severity?: FindingSeverity | null,
    tenantId: string,
    title: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateProjectSubscriptionVariables = {
  filter?: ModelSubscriptionProjectFilterInput | null,
};

export type OnUpdateProjectSubscription = {
  onUpdateProject?:  {
    __typename: "Project",
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    createdBy: string,
    description?: string | null,
    id: string,
    memberIds: Array< string | null >,
    metrics?: string | null,
    name: string,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: ProjectStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateReportSubscriptionVariables = {
  filter?: ModelSubscriptionReportFilterInput | null,
};

export type OnUpdateReportSubscription = {
  onUpdateReport?:  {
    __typename: "Report",
    analysis?:  {
      __typename: "Analysis",
      awsConfig?: string | null,
      completedAt?: string | null,
      createdAt: string,
      createdBy: string,
      executionId?: string | null,
      id: string,
      inputFiles?: string | null,
      name: string,
      projectId: string,
      resultSummary?: string | null,
      status?: AnalysisStatus | null,
      tenantId: string,
      type?: AnalysisType | null,
      updatedAt: string,
    } | null,
    analysisId?: string | null,
    createdAt: string,
    format?: ReportFormat | null,
    generatedBy: string,
    id: string,
    name: string,
    project?:  {
      __typename: "Project",
      createdAt: string,
      createdBy: string,
      description?: string | null,
      id: string,
      memberIds: Array< string | null >,
      metrics?: string | null,
      name: string,
      settings?: string | null,
      status?: ProjectStatus | null,
      tenantId: string,
      updatedAt: string,
    } | null,
    projectId: string,
    s3Location?: string | null,
    status?: ReportStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    type?: ReportType | null,
    updatedAt: string,
  } | null,
};

export type OnUpdateTenantSubscriptionVariables = {
  filter?: ModelSubscriptionTenantFilterInput | null,
};

export type OnUpdateTenantSubscription = {
  onUpdateTenant?:  {
    __typename: "Tenant",
    adminEmail: string,
    analyses?:  {
      __typename: "ModelAnalysisConnection",
      nextToken?: string | null,
    } | null,
    createdAt: string,
    id: string,
    name: string,
    projects?:  {
      __typename: "ModelProjectConnection",
      nextToken?: string | null,
    } | null,
    reports?:  {
      __typename: "ModelReportConnection",
      nextToken?: string | null,
    } | null,
    settings?: string | null,
    status?: TenantStatus | null,
    subscription?: string | null,
    updatedAt: string,
    users?:  {
      __typename: "ModelUserConnection",
      nextToken?: string | null,
    } | null,
  } | null,
};

export type OnUpdateUserSubscriptionVariables = {
  filter?: ModelSubscriptionUserFilterInput | null,
  owner?: string | null,
};

export type OnUpdateUserSubscription = {
  onUpdateUser?:  {
    __typename: "User",
    cognitoId: string,
    createdAt: string,
    email: string,
    firstName: string,
    id: string,
    lastLoginAt?: string | null,
    lastName: string,
    owner?: string | null,
    preferences?: string | null,
    projectIds: Array< string | null >,
    role?: UserRole | null,
    status?: UserStatus | null,
    tenant?:  {
      __typename: "Tenant",
      adminEmail: string,
      createdAt: string,
      id: string,
      name: string,
      settings?: string | null,
      status?: TenantStatus | null,
      subscription?: string | null,
      updatedAt: string,
    } | null,
    tenantId: string,
    updatedAt: string,
  } | null,
};
