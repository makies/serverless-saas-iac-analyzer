import { generateClient } from 'aws-amplify/api';

// Type definition for our GraphQL schema
interface Schema {
  // Will be populated when actual schema is available
}

export const client = generateClient();

export type Client = typeof client;
