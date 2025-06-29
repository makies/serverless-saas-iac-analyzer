import { defineAuth } from '@aws-amplify/backend';

/**
 * Authentication configuration for Cloud Best Practice Analyzer
 * 
 * Features:
 * - Multi-tenant user management
 * - Role-based access control (RBAC)
 * - MFA support
 * - Custom attributes for tenant isolation
 * - User groups for different permission levels
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  
  userAttributes: {
    // Standard attributes
    email: {
      required: true,
      mutable: true,
    },
    givenName: {
      required: true,
      mutable: true,
    },
    familyName: {
      required: true,
      mutable: true,
    },
    
    // Custom attributes for multi-tenancy
    'custom:tenantId': {
      dataType: 'String',
      mutable: true,
    },
    'custom:role': {
      dataType: 'String',
      mutable: true,
    },
    'custom:projectIds': {
      dataType: 'String',
      mutable: true,
    },
  },
  
  groups: [
    'SystemAdmins',
    'ClientAdmins', 
    'ProjectManagers',
    'Analysts',
    'Viewers',
    'ClientEngineers'
  ],
  
  // Note: Auth access configuration is handled at the resource level
  // Groups are defined for use in other resources (data, storage, etc.)
});