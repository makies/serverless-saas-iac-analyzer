/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getAnalysis = /* GraphQL */ `query GetAnalysis($id: ID!) {
  getAnalysis(id: $id) {
    awsConfig
    completedAt
    createdAt
    createdBy
    executionId
    findings {
      nextToken
      __typename
    }
    id
    inputFiles
    name
    project {
      createdAt
      createdBy
      description
      id
      memberIds
      metrics
      name
      settings
      status
      tenantId
      updatedAt
      __typename
    }
    projectId
    reports {
      nextToken
      __typename
    }
    resultSummary
    status
    tenant {
      adminEmail
      createdAt
      id
      name
      settings
      status
      subscription
      updatedAt
      __typename
    }
    tenantId
    type
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetAnalysisQueryVariables,
  APITypes.GetAnalysisQuery
>;
export const getFinding = /* GraphQL */ `query GetFinding($id: ID!) {
  getFinding(id: $id) {
    analysis {
      awsConfig
      completedAt
      createdAt
      createdBy
      executionId
      id
      inputFiles
      name
      projectId
      resultSummary
      status
      tenantId
      type
      updatedAt
      __typename
    }
    analysisId
    category
    createdAt
    description
    id
    line
    pillar
    recommendation
    resource
    ruleId
    severity
    tenantId
    title
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetFindingQueryVariables,
  APITypes.GetFindingQuery
>;
export const getProject = /* GraphQL */ `query GetProject($id: ID!) {
  getProject(id: $id) {
    analyses {
      nextToken
      __typename
    }
    createdAt
    createdBy
    description
    id
    memberIds
    metrics
    name
    reports {
      nextToken
      __typename
    }
    settings
    status
    tenant {
      adminEmail
      createdAt
      id
      name
      settings
      status
      subscription
      updatedAt
      __typename
    }
    tenantId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetProjectQueryVariables,
  APITypes.GetProjectQuery
>;
export const getReport = /* GraphQL */ `query GetReport($id: ID!) {
  getReport(id: $id) {
    analysis {
      awsConfig
      completedAt
      createdAt
      createdBy
      executionId
      id
      inputFiles
      name
      projectId
      resultSummary
      status
      tenantId
      type
      updatedAt
      __typename
    }
    analysisId
    createdAt
    format
    generatedBy
    id
    name
    project {
      createdAt
      createdBy
      description
      id
      memberIds
      metrics
      name
      settings
      status
      tenantId
      updatedAt
      __typename
    }
    projectId
    s3Location
    status
    tenant {
      adminEmail
      createdAt
      id
      name
      settings
      status
      subscription
      updatedAt
      __typename
    }
    tenantId
    type
    updatedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.GetReportQueryVariables, APITypes.GetReportQuery>;
export const getTenant = /* GraphQL */ `query GetTenant($id: ID!) {
  getTenant(id: $id) {
    adminEmail
    analyses {
      nextToken
      __typename
    }
    createdAt
    id
    name
    projects {
      nextToken
      __typename
    }
    reports {
      nextToken
      __typename
    }
    settings
    status
    subscription
    updatedAt
    users {
      nextToken
      __typename
    }
    __typename
  }
}
` as GeneratedQuery<APITypes.GetTenantQueryVariables, APITypes.GetTenantQuery>;
export const getUser = /* GraphQL */ `query GetUser($id: ID!) {
  getUser(id: $id) {
    cognitoId
    createdAt
    email
    firstName
    id
    lastLoginAt
    lastName
    owner
    preferences
    projectIds
    role
    status
    tenant {
      adminEmail
      createdAt
      id
      name
      settings
      status
      subscription
      updatedAt
      __typename
    }
    tenantId
    updatedAt
    __typename
  }
}
` as GeneratedQuery<APITypes.GetUserQueryVariables, APITypes.GetUserQuery>;
export const listAnalyses = /* GraphQL */ `query ListAnalyses(
  $filter: ModelAnalysisFilterInput
  $id: ID
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listAnalyses(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      awsConfig
      completedAt
      createdAt
      createdBy
      executionId
      id
      inputFiles
      name
      projectId
      resultSummary
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListAnalysesQueryVariables,
  APITypes.ListAnalysesQuery
>;
export const listAnalysisByProjectIdAndCreatedAt = /* GraphQL */ `query ListAnalysisByProjectIdAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelAnalysisFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  listAnalysisByProjectIdAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
    sortDirection: $sortDirection
  ) {
    items {
      awsConfig
      completedAt
      createdAt
      createdBy
      executionId
      id
      inputFiles
      name
      projectId
      resultSummary
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListAnalysisByProjectIdAndCreatedAtQueryVariables,
  APITypes.ListAnalysisByProjectIdAndCreatedAtQuery
>;
export const listAnalysisByStatusAndUpdatedAt = /* GraphQL */ `query ListAnalysisByStatusAndUpdatedAt(
  $filter: ModelAnalysisFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $status: AnalysisStatus!
  $updatedAt: ModelStringKeyConditionInput
) {
  listAnalysisByStatusAndUpdatedAt(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    status: $status
    updatedAt: $updatedAt
  ) {
    items {
      awsConfig
      completedAt
      createdAt
      createdBy
      executionId
      id
      inputFiles
      name
      projectId
      resultSummary
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListAnalysisByStatusAndUpdatedAtQueryVariables,
  APITypes.ListAnalysisByStatusAndUpdatedAtQuery
>;
export const listAnalysisByTenantIdAndCreatedAt = /* GraphQL */ `query ListAnalysisByTenantIdAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelAnalysisFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $tenantId: ID!
) {
  listAnalysisByTenantIdAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    tenantId: $tenantId
  ) {
    items {
      awsConfig
      completedAt
      createdAt
      createdBy
      executionId
      id
      inputFiles
      name
      projectId
      resultSummary
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListAnalysisByTenantIdAndCreatedAtQueryVariables,
  APITypes.ListAnalysisByTenantIdAndCreatedAtQuery
>;
export const listFindingByAnalysisIdAndSeverity = /* GraphQL */ `query ListFindingByAnalysisIdAndSeverity(
  $analysisId: ID!
  $filter: ModelFindingFilterInput
  $limit: Int
  $nextToken: String
  $severity: ModelStringKeyConditionInput
  $sortDirection: ModelSortDirection
) {
  listFindingByAnalysisIdAndSeverity(
    analysisId: $analysisId
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    severity: $severity
    sortDirection: $sortDirection
  ) {
    items {
      analysisId
      category
      createdAt
      description
      id
      line
      pillar
      recommendation
      resource
      ruleId
      severity
      tenantId
      title
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListFindingByAnalysisIdAndSeverityQueryVariables,
  APITypes.ListFindingByAnalysisIdAndSeverityQuery
>;
export const listFindingBySeverityAndCreatedAt = /* GraphQL */ `query ListFindingBySeverityAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelFindingFilterInput
  $limit: Int
  $nextToken: String
  $severity: FindingSeverity!
  $sortDirection: ModelSortDirection
) {
  listFindingBySeverityAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    severity: $severity
    sortDirection: $sortDirection
  ) {
    items {
      analysisId
      category
      createdAt
      description
      id
      line
      pillar
      recommendation
      resource
      ruleId
      severity
      tenantId
      title
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListFindingBySeverityAndCreatedAtQueryVariables,
  APITypes.ListFindingBySeverityAndCreatedAtQuery
>;
export const listFindingByTenantIdAndCreatedAt = /* GraphQL */ `query ListFindingByTenantIdAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelFindingFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $tenantId: ID!
) {
  listFindingByTenantIdAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    tenantId: $tenantId
  ) {
    items {
      analysisId
      category
      createdAt
      description
      id
      line
      pillar
      recommendation
      resource
      ruleId
      severity
      tenantId
      title
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListFindingByTenantIdAndCreatedAtQueryVariables,
  APITypes.ListFindingByTenantIdAndCreatedAtQuery
>;
export const listFindings = /* GraphQL */ `query ListFindings(
  $filter: ModelFindingFilterInput
  $id: ID
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listFindings(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      analysisId
      category
      createdAt
      description
      id
      line
      pillar
      recommendation
      resource
      ruleId
      severity
      tenantId
      title
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListFindingsQueryVariables,
  APITypes.ListFindingsQuery
>;
export const listProjectByStatusAndUpdatedAt = /* GraphQL */ `query ListProjectByStatusAndUpdatedAt(
  $filter: ModelProjectFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $status: ProjectStatus!
  $updatedAt: ModelStringKeyConditionInput
) {
  listProjectByStatusAndUpdatedAt(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    status: $status
    updatedAt: $updatedAt
  ) {
    items {
      createdAt
      createdBy
      description
      id
      memberIds
      metrics
      name
      settings
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListProjectByStatusAndUpdatedAtQueryVariables,
  APITypes.ListProjectByStatusAndUpdatedAtQuery
>;
export const listProjectByTenantIdAndCreatedAt = /* GraphQL */ `query ListProjectByTenantIdAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelProjectFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $tenantId: ID!
) {
  listProjectByTenantIdAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    tenantId: $tenantId
  ) {
    items {
      createdAt
      createdBy
      description
      id
      memberIds
      metrics
      name
      settings
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListProjectByTenantIdAndCreatedAtQueryVariables,
  APITypes.ListProjectByTenantIdAndCreatedAtQuery
>;
export const listProjects = /* GraphQL */ `query ListProjects(
  $filter: ModelProjectFilterInput
  $id: ID
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listProjects(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      createdBy
      description
      id
      memberIds
      metrics
      name
      settings
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListProjectsQueryVariables,
  APITypes.ListProjectsQuery
>;
export const listReportByAnalysisIdAndCreatedAt = /* GraphQL */ `query ListReportByAnalysisIdAndCreatedAt(
  $analysisId: ID!
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelReportFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listReportByAnalysisIdAndCreatedAt(
    analysisId: $analysisId
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      analysisId
      createdAt
      format
      generatedBy
      id
      name
      projectId
      s3Location
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListReportByAnalysisIdAndCreatedAtQueryVariables,
  APITypes.ListReportByAnalysisIdAndCreatedAtQuery
>;
export const listReportByProjectIdAndCreatedAt = /* GraphQL */ `query ListReportByProjectIdAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelReportFilterInput
  $limit: Int
  $nextToken: String
  $projectId: ID!
  $sortDirection: ModelSortDirection
) {
  listReportByProjectIdAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    projectId: $projectId
    sortDirection: $sortDirection
  ) {
    items {
      analysisId
      createdAt
      format
      generatedBy
      id
      name
      projectId
      s3Location
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListReportByProjectIdAndCreatedAtQueryVariables,
  APITypes.ListReportByProjectIdAndCreatedAtQuery
>;
export const listReportByTenantIdAndCreatedAt = /* GraphQL */ `query ListReportByTenantIdAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelReportFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $tenantId: ID!
) {
  listReportByTenantIdAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    tenantId: $tenantId
  ) {
    items {
      analysisId
      createdAt
      format
      generatedBy
      id
      name
      projectId
      s3Location
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListReportByTenantIdAndCreatedAtQueryVariables,
  APITypes.ListReportByTenantIdAndCreatedAtQuery
>;
export const listReports = /* GraphQL */ `query ListReports(
  $filter: ModelReportFilterInput
  $id: ID
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listReports(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      analysisId
      createdAt
      format
      generatedBy
      id
      name
      projectId
      s3Location
      status
      tenantId
      type
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListReportsQueryVariables,
  APITypes.ListReportsQuery
>;
export const listTenants = /* GraphQL */ `query ListTenants(
  $filter: ModelTenantFilterInput
  $id: ID
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listTenants(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      adminEmail
      createdAt
      id
      name
      settings
      status
      subscription
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListTenantsQueryVariables,
  APITypes.ListTenantsQuery
>;
export const listUserByCognitoId = /* GraphQL */ `query ListUserByCognitoId(
  $cognitoId: String!
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUserByCognitoId(
    cognitoId: $cognitoId
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      cognitoId
      createdAt
      email
      firstName
      id
      lastLoginAt
      lastName
      owner
      preferences
      projectIds
      role
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserByCognitoIdQueryVariables,
  APITypes.ListUserByCognitoIdQuery
>;
export const listUserByEmail = /* GraphQL */ `query ListUserByEmail(
  $email: AWSEmail!
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUserByEmail(
    email: $email
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      cognitoId
      createdAt
      email
      firstName
      id
      lastLoginAt
      lastName
      owner
      preferences
      projectIds
      role
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserByEmailQueryVariables,
  APITypes.ListUserByEmailQuery
>;
export const listUserByRoleAndLastLoginAt = /* GraphQL */ `query ListUserByRoleAndLastLoginAt(
  $filter: ModelUserFilterInput
  $lastLoginAt: ModelStringKeyConditionInput
  $limit: Int
  $nextToken: String
  $role: UserRole!
  $sortDirection: ModelSortDirection
) {
  listUserByRoleAndLastLoginAt(
    filter: $filter
    lastLoginAt: $lastLoginAt
    limit: $limit
    nextToken: $nextToken
    role: $role
    sortDirection: $sortDirection
  ) {
    items {
      cognitoId
      createdAt
      email
      firstName
      id
      lastLoginAt
      lastName
      owner
      preferences
      projectIds
      role
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserByRoleAndLastLoginAtQueryVariables,
  APITypes.ListUserByRoleAndLastLoginAtQuery
>;
export const listUserByTenantIdAndCreatedAt = /* GraphQL */ `query ListUserByTenantIdAndCreatedAt(
  $createdAt: ModelStringKeyConditionInput
  $filter: ModelUserFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $tenantId: ID!
) {
  listUserByTenantIdAndCreatedAt(
    createdAt: $createdAt
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    tenantId: $tenantId
  ) {
    items {
      cognitoId
      createdAt
      email
      firstName
      id
      lastLoginAt
      lastName
      owner
      preferences
      projectIds
      role
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserByTenantIdAndCreatedAtQueryVariables,
  APITypes.ListUserByTenantIdAndCreatedAtQuery
>;
export const listUsers = /* GraphQL */ `query ListUsers(
  $filter: ModelUserFilterInput
  $id: ID
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUsers(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      cognitoId
      createdAt
      email
      firstName
      id
      lastLoginAt
      lastName
      owner
      preferences
      projectIds
      role
      status
      tenantId
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<APITypes.ListUsersQueryVariables, APITypes.ListUsersQuery>;
