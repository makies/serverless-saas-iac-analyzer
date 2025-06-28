import { defineBackend } from '@aws-amplify/backend';
import { defineAuth } from '@aws-amplify/backend';
import { defineFunction } from '@aws-amplify/backend';
import { data } from './data/resource';

const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst', 'Viewer', 'ClientEngineer'],
});

const analysisFunction = defineFunction({
  name: 'analysisHandler',
  entry: './functions/analysis-handler/index.ts',
  environment: {
    BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
}); 

const reportFunction = defineFunction({
  name: 'reportGenerator',
  entry: './functions/report-generator/index.ts',
});

export const backend = defineBackend({
  auth,
  data,
  analysisFunction,
  reportFunction,
});

