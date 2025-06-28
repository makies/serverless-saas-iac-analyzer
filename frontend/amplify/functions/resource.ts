import { defineFunction } from '@aws-amplify/backend';

export const analysisFunction = defineFunction({
  name: 'analysisHandler',
  entry: './analysis-handler/index.ts',
  environment: {
    BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
}); 

export const reportFunction = defineFunction({
  name: 'reportGenerator',
  entry: './report-generator/index.ts',
});