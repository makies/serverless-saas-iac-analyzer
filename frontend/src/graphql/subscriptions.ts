/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateAnalysis = /* GraphQL */ `subscription OnCreateAnalysis($filter: ModelSubscriptionAnalysisFilterInput) {
  onCreateAnalysis(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateAnalysisSubscriptionVariables,
  APITypes.OnCreateAnalysisSubscription
>;
export const onCreateFinding = /* GraphQL */ `subscription OnCreateFinding($filter: ModelSubscriptionFindingFilterInput) {
  onCreateFinding(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateFindingSubscriptionVariables,
  APITypes.OnCreateFindingSubscription
>;
export const onCreateProject = /* GraphQL */ `subscription OnCreateProject($filter: ModelSubscriptionProjectFilterInput) {
  onCreateProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateProjectSubscriptionVariables,
  APITypes.OnCreateProjectSubscription
>;
export const onCreateReport = /* GraphQL */ `subscription OnCreateReport($filter: ModelSubscriptionReportFilterInput) {
  onCreateReport(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateReportSubscriptionVariables,
  APITypes.OnCreateReportSubscription
>;
export const onCreateTenant = /* GraphQL */ `subscription OnCreateTenant($filter: ModelSubscriptionTenantFilterInput) {
  onCreateTenant(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateTenantSubscriptionVariables,
  APITypes.OnCreateTenantSubscription
>;
export const onCreateUser = /* GraphQL */ `subscription OnCreateUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onCreateUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserSubscriptionVariables,
  APITypes.OnCreateUserSubscription
>;
export const onDeleteAnalysis = /* GraphQL */ `subscription OnDeleteAnalysis($filter: ModelSubscriptionAnalysisFilterInput) {
  onDeleteAnalysis(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteAnalysisSubscriptionVariables,
  APITypes.OnDeleteAnalysisSubscription
>;
export const onDeleteFinding = /* GraphQL */ `subscription OnDeleteFinding($filter: ModelSubscriptionFindingFilterInput) {
  onDeleteFinding(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteFindingSubscriptionVariables,
  APITypes.OnDeleteFindingSubscription
>;
export const onDeleteProject = /* GraphQL */ `subscription OnDeleteProject($filter: ModelSubscriptionProjectFilterInput) {
  onDeleteProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteProjectSubscriptionVariables,
  APITypes.OnDeleteProjectSubscription
>;
export const onDeleteReport = /* GraphQL */ `subscription OnDeleteReport($filter: ModelSubscriptionReportFilterInput) {
  onDeleteReport(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteReportSubscriptionVariables,
  APITypes.OnDeleteReportSubscription
>;
export const onDeleteTenant = /* GraphQL */ `subscription OnDeleteTenant($filter: ModelSubscriptionTenantFilterInput) {
  onDeleteTenant(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteTenantSubscriptionVariables,
  APITypes.OnDeleteTenantSubscription
>;
export const onDeleteUser = /* GraphQL */ `subscription OnDeleteUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onDeleteUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserSubscriptionVariables,
  APITypes.OnDeleteUserSubscription
>;
export const onUpdateAnalysis = /* GraphQL */ `subscription OnUpdateAnalysis($filter: ModelSubscriptionAnalysisFilterInput) {
  onUpdateAnalysis(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateAnalysisSubscriptionVariables,
  APITypes.OnUpdateAnalysisSubscription
>;
export const onUpdateFinding = /* GraphQL */ `subscription OnUpdateFinding($filter: ModelSubscriptionFindingFilterInput) {
  onUpdateFinding(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateFindingSubscriptionVariables,
  APITypes.OnUpdateFindingSubscription
>;
export const onUpdateProject = /* GraphQL */ `subscription OnUpdateProject($filter: ModelSubscriptionProjectFilterInput) {
  onUpdateProject(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateProjectSubscriptionVariables,
  APITypes.OnUpdateProjectSubscription
>;
export const onUpdateReport = /* GraphQL */ `subscription OnUpdateReport($filter: ModelSubscriptionReportFilterInput) {
  onUpdateReport(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateReportSubscriptionVariables,
  APITypes.OnUpdateReportSubscription
>;
export const onUpdateTenant = /* GraphQL */ `subscription OnUpdateTenant($filter: ModelSubscriptionTenantFilterInput) {
  onUpdateTenant(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateTenantSubscriptionVariables,
  APITypes.OnUpdateTenantSubscription
>;
export const onUpdateUser = /* GraphQL */ `subscription OnUpdateUser(
  $filter: ModelSubscriptionUserFilterInput
  $owner: String
) {
  onUpdateUser(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserSubscriptionVariables,
  APITypes.OnUpdateUserSubscription
>;
