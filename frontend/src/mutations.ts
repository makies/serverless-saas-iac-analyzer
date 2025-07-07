/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createAnalysis = /* GraphQL */ `mutation CreateAnalysis(
  $condition: ModelAnalysisConditionInput
  $input: CreateAnalysisInput!
) {
  createAnalysis(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateAnalysisMutationVariables,
  APITypes.CreateAnalysisMutation
>;
export const createFinding = /* GraphQL */ `mutation CreateFinding(
  $condition: ModelFindingConditionInput
  $input: CreateFindingInput!
) {
  createFinding(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateFindingMutationVariables,
  APITypes.CreateFindingMutation
>;
export const createProject = /* GraphQL */ `mutation CreateProject(
  $condition: ModelProjectConditionInput
  $input: CreateProjectInput!
) {
  createProject(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateProjectMutationVariables,
  APITypes.CreateProjectMutation
>;
export const createReport = /* GraphQL */ `mutation CreateReport(
  $condition: ModelReportConditionInput
  $input: CreateReportInput!
) {
  createReport(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateReportMutationVariables,
  APITypes.CreateReportMutation
>;
export const createTenant = /* GraphQL */ `mutation CreateTenant(
  $condition: ModelTenantConditionInput
  $input: CreateTenantInput!
) {
  createTenant(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateTenantMutationVariables,
  APITypes.CreateTenantMutation
>;
export const createUser = /* GraphQL */ `mutation CreateUser(
  $condition: ModelUserConditionInput
  $input: CreateUserInput!
) {
  createUser(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.CreateUserMutationVariables,
  APITypes.CreateUserMutation
>;
export const deleteAnalysis = /* GraphQL */ `mutation DeleteAnalysis(
  $condition: ModelAnalysisConditionInput
  $input: DeleteAnalysisInput!
) {
  deleteAnalysis(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteAnalysisMutationVariables,
  APITypes.DeleteAnalysisMutation
>;
export const deleteFinding = /* GraphQL */ `mutation DeleteFinding(
  $condition: ModelFindingConditionInput
  $input: DeleteFindingInput!
) {
  deleteFinding(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteFindingMutationVariables,
  APITypes.DeleteFindingMutation
>;
export const deleteProject = /* GraphQL */ `mutation DeleteProject(
  $condition: ModelProjectConditionInput
  $input: DeleteProjectInput!
) {
  deleteProject(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteProjectMutationVariables,
  APITypes.DeleteProjectMutation
>;
export const deleteReport = /* GraphQL */ `mutation DeleteReport(
  $condition: ModelReportConditionInput
  $input: DeleteReportInput!
) {
  deleteReport(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteReportMutationVariables,
  APITypes.DeleteReportMutation
>;
export const deleteTenant = /* GraphQL */ `mutation DeleteTenant(
  $condition: ModelTenantConditionInput
  $input: DeleteTenantInput!
) {
  deleteTenant(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteTenantMutationVariables,
  APITypes.DeleteTenantMutation
>;
export const deleteUser = /* GraphQL */ `mutation DeleteUser(
  $condition: ModelUserConditionInput
  $input: DeleteUserInput!
) {
  deleteUser(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.DeleteUserMutationVariables,
  APITypes.DeleteUserMutation
>;
export const updateAnalysis = /* GraphQL */ `mutation UpdateAnalysis(
  $condition: ModelAnalysisConditionInput
  $input: UpdateAnalysisInput!
) {
  updateAnalysis(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateAnalysisMutationVariables,
  APITypes.UpdateAnalysisMutation
>;
export const updateFinding = /* GraphQL */ `mutation UpdateFinding(
  $condition: ModelFindingConditionInput
  $input: UpdateFindingInput!
) {
  updateFinding(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateFindingMutationVariables,
  APITypes.UpdateFindingMutation
>;
export const updateProject = /* GraphQL */ `mutation UpdateProject(
  $condition: ModelProjectConditionInput
  $input: UpdateProjectInput!
) {
  updateProject(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateProjectMutationVariables,
  APITypes.UpdateProjectMutation
>;
export const updateReport = /* GraphQL */ `mutation UpdateReport(
  $condition: ModelReportConditionInput
  $input: UpdateReportInput!
) {
  updateReport(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateReportMutationVariables,
  APITypes.UpdateReportMutation
>;
export const updateTenant = /* GraphQL */ `mutation UpdateTenant(
  $condition: ModelTenantConditionInput
  $input: UpdateTenantInput!
) {
  updateTenant(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateTenantMutationVariables,
  APITypes.UpdateTenantMutation
>;
export const updateUser = /* GraphQL */ `mutation UpdateUser(
  $condition: ModelUserConditionInput
  $input: UpdateUserInput!
) {
  updateUser(condition: $condition, input: $input) {
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
` as GeneratedMutation<
  APITypes.UpdateUserMutationVariables,
  APITypes.UpdateUserMutation
>;
