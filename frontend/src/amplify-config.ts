import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import amplifyOutputs from '../amplify_outputs.json';

// Use the imported Amplify configuration
console.log('🚀 Loading Amplify Sandbox Configuration');

// Amplify Gen 2の設定形式に合わせる
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: amplifyOutputs.auth.user_pool_id,
      userPoolClientId: amplifyOutputs.auth.user_pool_client_id,
      identityPoolId: amplifyOutputs.auth.identity_pool_id,
      signUpVerificationMethod: 'email',
      loginWith: {
        oauth: {
          domain: amplifyOutputs.auth.oauth.domain,
          scopes: amplifyOutputs.auth.oauth.scopes,
          redirectSignIn: amplifyOutputs.auth.oauth.redirect_sign_in_uri,
          redirectSignOut: amplifyOutputs.auth.oauth.redirect_sign_out_uri,
          responseType: amplifyOutputs.auth.oauth.response_type,
          providers: amplifyOutputs.auth.oauth.identity_providers
        }
      }
    }
  },
  API: {
    GraphQL: {
      endpoint: amplifyOutputs.data.url,
      region: amplifyOutputs.data.aws_region,
      defaultAuthMode: 'userPool'
    }
  }
};

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
