import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

/**
 * Development utility to get User Pool information for CLI commands
 */
export const getUserPoolInfo = async () => {
  try {
    const currentUser = await getCurrentUser();
    const session = await fetchAuthSession();
    
    // Extract User Pool ID from the access token
    const accessToken = session.tokens?.accessToken;
    if (!accessToken) {
      throw new Error('No access token found');
    }
    
    // User Pool ID is part of the token issuer URL
    const issuer = accessToken.payload.iss as string;
    const userPoolId = issuer.split('/').pop();
    
    const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] || [];
    
    console.log('🔍 User Pool Information:');
    console.log('User Pool ID:', userPoolId);
    console.log('Username:', currentUser.username);
    console.log('User ID:', currentUser.userId);
    console.log('Current Groups:', groups);
    console.log('Region:', issuer.split('.')[2]); // Extract region from issuer URL
    
    console.log('\n📋 AWS CLI Commands to add user to groups:');
    console.log(`# Add to SystemAdmins group (for tenant creation):`);
    console.log(`aws cognito-idp admin-add-user-to-group \\`);
    console.log(`  --user-pool-id ${userPoolId} \\`);
    console.log(`  --username "${currentUser.username}" \\`);
    console.log(`  --group-name SystemAdmins \\`);
    console.log(`  --region ${issuer.split('.')[2]}`);
    
    console.log(`\n# Verify group membership:`);
    console.log(`aws cognito-idp admin-list-groups-for-user \\`);
    console.log(`  --user-pool-id ${userPoolId} \\`);
    console.log(`  --username "${currentUser.username}" \\`);
    console.log(`  --region ${issuer.split('.')[2]}`);
    
    return {
      userPoolId,
      username: currentUser.username,
      userId: currentUser.userId,
      region: issuer.split('.')[2],
      currentGroups: groups,
      needsSystemAdminGroup: !groups.includes('SystemAdmins')
    };
    
  } catch (error) {
    console.error('❌ Error getting user pool info:', error);
    throw error;
  }
};