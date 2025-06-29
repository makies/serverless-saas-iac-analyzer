import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import { AIConversation } from '@aws-amplify/backend-ai/conversation';

// Import auto-generated Amplify configuration
// This will be created when `amplify push` is run
let amplifyConfig: any = {};

try {
  // Try to import the auto-generated config
  amplifyConfig = require('../amplify_outputs.json');
} catch (error) {
  // Fallback configuration for development
  console.warn('Amplify config not found, using fallback configuration');
  amplifyConfig = {
    aws_project_region: 'ap-northeast-1',
    aws_cognito_identity_pool_id: 'ap-northeast-1:EXAMPLE-XXXX-XXXX-XXXX-EXAMPLE',
    aws_cognito_region: 'ap-northeast-1',
    aws_user_pools_id: 'ap-northeast-1_EXAMPLE',
    aws_user_pools_web_client_id: 'EXAMPLE',
    aws_cognito_username_attributes: ['EMAIL'],
    aws_cognito_mfa_configuration: 'OPTIONAL',
    aws_appsync_graphqlEndpoint: 'https://EXAMPLE.appsync-api.ap-northeast-1.amazonaws.com/graphql',
    aws_appsync_region: 'ap-northeast-1',
    aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
    aws_user_files_s3_bucket: 'cloudbpa-storage-EXAMPLE',
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

// Create AI conversation client for Bedrock integration
export const aiClient = new AIConversation({
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
});

// Export configuration for use in other parts of the app
export default amplifyConfig;
