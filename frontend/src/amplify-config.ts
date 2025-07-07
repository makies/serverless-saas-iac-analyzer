import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';

// Import actual Amplify configuration from deployed environment
let amplifyConfig: any = {};

try {
  // Try to import the auto-generated config
  amplifyConfig = require('../amplify_outputs.json');
  
  // Convert to legacy format for compatibility
  amplifyConfig = {
    aws_project_region: amplifyConfig.auth?.aws_region || 'ap-northeast-1',
    aws_cognito_identity_pool_id: amplifyConfig.auth?.identity_pool_id || 'ap-northeast-1:3485d120-2059-401a-9a26-1634a14bd4dc',
    aws_cognito_region: amplifyConfig.auth?.aws_region || 'ap-northeast-1',
    aws_user_pools_id: amplifyConfig.auth?.user_pool_id || 'ap-northeast-1_5oHfMvBsx',
    aws_user_pools_web_client_id: amplifyConfig.auth?.user_pool_client_id || '1nf22amnbu533h768hodnpkd66',
    aws_cognito_username_attributes: amplifyConfig.auth?.username_attributes || ['email'],
    aws_cognito_mfa_configuration: amplifyConfig.auth?.mfa_configuration || 'OPTIONAL',
    aws_appsync_graphqlEndpoint: amplifyConfig.data?.url || 'https://77cdk652f5hvberzvflde6w26y.appsync-api.ap-northeast-1.amazonaws.com/graphql',
    aws_appsync_region: amplifyConfig.data?.aws_region || 'ap-northeast-1',
    aws_appsync_authenticationType: amplifyConfig.data?.default_authorization_type || 'AMAZON_COGNITO_USER_POOLS',
    aws_user_files_s3_bucket: amplifyConfig.storage?.bucket_name || 'cloudbpa-app-dev-780258880044',
    aws_user_files_s3_bucket_region: amplifyConfig.storage?.aws_region || 'ap-northeast-1',
    // AI configuration for Bedrock integration
    ai: {
      bedrock: {
        region: 'ap-northeast-1',
        models: {
          'claude-3-5-sonnet': {
            modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            providerName: 'Bedrock'
          }
        }
      }
    }
  };
} catch (error) {
  // Fallback configuration using deployed values
  console.warn('Amplify config not found, using deployed environment configuration');
  amplifyConfig = {
    aws_project_region: 'ap-northeast-1',
    aws_cognito_identity_pool_id: 'ap-northeast-1:3485d120-2059-401a-9a26-1634a14bd4dc',
    aws_cognito_region: 'ap-northeast-1',
    aws_user_pools_id: 'ap-northeast-1_5oHfMvBsx',
    aws_user_pools_web_client_id: '1nf22amnbu533h768hodnpkd66',
    aws_cognito_username_attributes: ['email'],
    aws_cognito_mfa_configuration: 'OPTIONAL',
    aws_appsync_graphqlEndpoint: 'https://77cdk652f5hvberzvflde6w26y.appsync-api.ap-northeast-1.amazonaws.com/graphql',
    aws_appsync_region: 'ap-northeast-1',
    aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
    aws_user_files_s3_bucket: 'cloudbpa-app-dev-780258880044',
    aws_user_files_s3_bucket_region: 'ap-northeast-1',
    // AI configuration for Bedrock integration
    ai: {
      bedrock: {
        region: 'ap-northeast-1',
        models: {
          'claude-3-5-sonnet': {
            modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            providerName: 'Bedrock'
          }
        }
      }
    }
  };
}

// Configure Amplify
Amplify.configure(amplifyConfig);

// Create GraphQL client
export const graphqlClient = generateClient();

// AI client configuration placeholder - will be implemented with actual Bedrock integration
export const aiClient = {
  model: 'claude-3-5-sonnet',
  systemPrompt: `
You are an AWS Well-Architected Framework expert helping with cloud infrastructure analysis.
Provide detailed, actionable recommendations based on the 6 pillars:
1. Operational Excellence
2. Security
3. Reliability
4. Performance Efficiency
5. Cost Optimization
6. Sustainability

Always respond in Japanese and provide specific, technical recommendations.
  `
};

// Export configuration for use in other parts of the app
export default amplifyConfig;
