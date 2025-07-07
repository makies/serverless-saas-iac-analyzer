import { defineAuth } from '@aws-amplify/backend';
import { secret } from '@aws-amplify/backend';

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
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
          givenName: 'given_name',
          familyName: 'family_name',
        }
      },
      callbackUrls: [
        'http://localhost:3000/',
        'http://localhost:5173/',
        'https://localhost:3000/',
        'https://localhost:5173/'
      ],
      logoutUrls: [
        'http://localhost:3000/',
        'http://localhost:5173/',
        'https://localhost:3000/',
        'https://localhost:5173/'
      ]
    }
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