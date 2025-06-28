import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { analysisFunction, reportFunction } from './functions/resource';

export const backend = defineBackend({
  auth,
  data,
  analysisFunction,
  reportFunction,
});
