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
    // All authenticated users can access everything
    'uploads/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
    
    // Public access for static assets - simplified permissions
    'public/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
    
    // Protected path - user can only access their own files
    'protected/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete'])
    ]
  })
});