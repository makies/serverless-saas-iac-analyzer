import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

/**
 * Development utility to add current user to SystemAdmins group
 * This is typically done through AWS CLI or Lambda function in production
 */
export const addCurrentUserToSystemAdmins = async () => {
  try {
    console.log('🔧 Development utility: Adding current user to SystemAdmins group...');
    
    const currentUser = await getCurrentUser();
    const session = await fetchAuthSession();
    
    console.log('Current user info:', {
      userId: currentUser.userId,
      username: currentUser.username,
      groups: session.tokens?.accessToken?.payload['cognito:groups'] || []
    });
    
    // This would normally be handled by AWS CLI command:
    // aws cognito-idp admin-add-user-to-group --user-pool-id POOL_ID --username USERNAME --group-name SystemAdmins
    
    console.log('ℹ️  To add this user to SystemAdmins group, run the following AWS CLI command:');
    console.log(`aws cognito-idp admin-add-user-to-group \\`);
    console.log(`  --user-pool-id <YOUR_USER_POOL_ID> \\`);
    console.log(`  --username "${currentUser.username}" \\`);
    console.log(`  --group-name SystemAdmins`);
    
    return {
      userId: currentUser.userId,
      username: currentUser.username,
      needsGroupAssignment: true
    };
    
  } catch (error) {
    console.error('❌ Error accessing user information:', error);
    throw error;
  }
};

/**
 * Check if current user has required permissions for tenant creation
 */
export const checkUserPermissions = async () => {
  try {
    const session = await fetchAuthSession();
    const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] || [];
    
    const hasSystemAdminAccess = groups.includes('SystemAdmins');
    const hasClientAdminAccess = groups.includes('ClientAdmins');
    
    return {
      groups,
      canCreateTenant: hasSystemAdminAccess,
      canManageTenant: hasSystemAdminAccess || hasClientAdminAccess,
      recommendations: []
    };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      groups: [],
      canCreateTenant: false,
      canManageTenant: false,
      recommendations: ['Please ensure you are logged in']
    };
  }
};