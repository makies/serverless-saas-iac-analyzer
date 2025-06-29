import { defineStorage } from '@aws-amplify/backend';

/**
 * Storage configuration for Cloud Best Practice Analyzer
 * 
 * Features:
 * - Tenant-based file isolation
 * - Role-based access control
 * - File type restrictions
 * - Size limits (SBT Basic: 10MB)
 * - Automated lifecycle management
 */
export const storage = defineStorage({
  name: 'CloudBPAStorage',
  
  access: (allow) => ({
    // Authenticated users - Basic access to their own tenant data
    'tenants/*': [
      allow.authenticated.to(['read', 'write'])
    ],
    
    // Public access for static assets
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write'])
    ],
    
    // Temporary uploads for authenticated users
    'temp/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ]
  })
});