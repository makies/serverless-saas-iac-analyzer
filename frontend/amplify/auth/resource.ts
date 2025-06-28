import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: [
    'SystemAdmin',
    'ClientAdmin',
    'ProjectManager',
    'Analyst',
    'Viewer',
    'ClientEngineer',
  ],
  userAttributes: {
    'custom:tenantId': {
      dataType: 'String',
      mutable: true,
    },
    'custom:role': {
      dataType: 'String',
      mutable: true,
    },
    'custom:firstName': {
      dataType: 'String',
      mutable: true,
    },
    'custom:lastName': {
      dataType: 'String',
      mutable: true,
    },
  },
});
