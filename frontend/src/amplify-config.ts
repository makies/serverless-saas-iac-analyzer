import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import amplifyOutputs from '../amplify_outputs.json';

// Use the imported Amplify configuration
console.log('🚀 Loading Amplify Sandbox Configuration');

// Configure Amplify with outputs directly
Amplify.configure(amplifyOutputs);

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
export default amplifyOutputs;
