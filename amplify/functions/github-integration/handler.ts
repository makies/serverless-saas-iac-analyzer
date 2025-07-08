import { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import middy from '@middy/core';
import { createHash } from 'crypto';
import archiver from 'archiver';
import { Readable } from 'stream';

const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics();

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

interface GitHubEvent {
  action: 'oauth_callback' | 'webhook' | 'fetch_repository' | 'list_repositories';
  tenantId: string;
  userId?: string;
  code?: string;
  state?: string;
  repositoryId?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  accessToken?: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  html_url: string;
  default_branch: string;
  private: boolean;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface RepositoryProvider {
  type: 'github' | 'gitlab' | 'bitbucket';
  authenticate(credentials: any): Promise<void>;
  listRepositories(owner?: string): Promise<GitHubRepository[]>;
  downloadRepository(owner: string, repo: string, branch: string): Promise<Buffer>;
  setupWebhook?(owner: string, repo: string, webhookUrl: string): Promise<any>;
}

class GitHubProvider implements RepositoryProvider {
  type: 'github' = 'github';
  private octokit: Octokit | null = null;

  async authenticate(credentials: { accessToken: string }): Promise<void> {
    this.octokit = new Octokit({
      auth: credentials.accessToken,
    });
    
    // Test the authentication
    try {
      await this.octokit.users.getAuthenticated();
      logger.info('GitHub authentication successful');
    } catch (error) {
      logger.error('GitHub authentication failed', { error });
      throw new Error('GitHub authentication failed');
    }
  }

  async listRepositories(owner?: string): Promise<GitHubRepository[]> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      let repositories: GitHubRepository[] = [];

      if (owner) {
        // List repositories for specific owner
        const { data } = await this.octokit.repos.listForUser({
          username: owner,
          per_page: 100,
          sort: 'updated',
        });
        repositories = data as any;
      } else {
        // List repositories for authenticated user
        const { data } = await this.octokit.repos.listForAuthenticatedUser({
          per_page: 100,
          sort: 'updated',
          affiliation: 'owner,collaborator,organization_member',
        });
        repositories = data as any;
      }

      logger.info(`Found ${repositories.length} repositories`);
      return repositories;
    } catch (error) {
      logger.error('Failed to list repositories', { error, owner });
      throw error;
    }
  }

  async downloadRepository(owner: string, repo: string, branch: string = 'main'): Promise<Buffer> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      // Get repository archive
      const { data } = await this.octokit.repos.downloadZipballArchive({
        owner,
        repo,
        ref: branch,
      });

      logger.info('Repository downloaded successfully', { owner, repo, branch });
      return Buffer.from(data as ArrayBuffer);
    } catch (error) {
      logger.error('Failed to download repository', { error, owner, repo, branch });
      throw error;
    }
  }

  async setupWebhook(owner: string, repo: string, webhookUrl: string): Promise<any> {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: process.env.GITHUB_WEBHOOK_SECRET,
        },
        events: ['push', 'pull_request'],
        active: true,
      });

      logger.info('Webhook created successfully', { owner, repo, webhookId: data.id });
      return data;
    } catch (error) {
      logger.error('Failed to create webhook', { error, owner, repo });
      throw error;
    }
  }
}

const githubProvider = new GitHubProvider();

async function handleOAuthCallback(event: GitHubEvent): Promise<any> {
  const { tenantId, userId, code, state } = event;
  
  if (!code || !state) {
    throw new Error('Missing OAuth parameters');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        state,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error_description}`);
    }

    // Get user information
    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: userInfo } = await octokit.users.getAuthenticated();

    // Encrypt access token
    const encryptedToken = encryptToken(tokenData.access_token);

    // Save connection to database
    const connectionId = `${tenantId}-${userInfo.login}-${Date.now()}`;
    
    await dynamoClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: `CONNECTION#${connectionId}`,
        GSI1PK: `TENANT#${tenantId}`,
        GSI1SK: `USER#${userId}`,
        id: connectionId,
        tenantId,
        provider: 'GITHUB',
        userId,
        username: userInfo.login,
        accessToken: encryptedToken,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : undefined,
        scopes: tokenData.scope?.split(',') || [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    logger.info('Git connection saved successfully', { connectionId, username: userInfo.login });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        connectionId,
        username: userInfo.login,
        scopes: tokenData.scope?.split(',') || [],
      }),
    };
  } catch (error) {
    logger.error('OAuth callback failed', { error });
    throw error;
  }
}

async function handleListRepositories(event: GitHubEvent): Promise<any> {
  const { tenantId, userId, owner } = event;
  
  try {
    // Get user's GitHub connection
    const connection = await getUserConnection(tenantId, userId!, 'GITHUB');
    
    if (!connection) {
      throw new Error('GitHub connection not found');
    }

    // Decrypt access token and authenticate
    const accessToken = decryptToken(connection.accessToken);
    await githubProvider.authenticate({ accessToken });

    // List repositories
    const repositories = await githubProvider.listRepositories(owner);

    logger.info('Repositories listed successfully', { count: repositories.length });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        repositories: repositories.map(repo => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: repo.owner.login,
          url: repo.html_url,
          defaultBranch: repo.default_branch,
          private: repo.private,
          permissions: repo.permissions,
        })),
      }),
    };
  } catch (error) {
    logger.error('List repositories failed', { error });
    throw error;
  }
}

async function handleFetchRepository(event: GitHubEvent): Promise<any> {
  const { tenantId, userId, repositoryId, owner, repo, branch = 'main' } = event;
  
  if (!owner || !repo) {
    throw new Error('Missing repository parameters');
  }

  try {
    // Get user's GitHub connection
    const connection = await getUserConnection(tenantId, userId!, 'GITHUB');
    
    if (!connection) {
      throw new Error('GitHub connection not found');
    }

    // Decrypt access token and authenticate
    const accessToken = decryptToken(connection.accessToken);
    await githubProvider.authenticate({ accessToken });

    // Download repository
    const repoBuffer = await githubProvider.downloadRepository(owner, repo, branch);

    // Generate S3 key with tenant isolation
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const s3Key = `repositories/${tenantId}/${owner}/${repo}/${branch}/${timestamp}.zip`;

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: repoBuffer,
      ContentType: 'application/zip',
      Metadata: {
        tenantId,
        owner,
        repo,
        branch,
        timestamp,
      },
    }));

    // Update repository record if provided
    if (repositoryId) {
      await dynamoClient.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}`,
          SK: `REPOSITORY#${repositoryId}`,
        },
        UpdateExpression: 'SET lastScanDate = :date, lastScanCommit = :commit, #s3Location = :location',
        ExpressionAttributeNames: {
          '#s3Location': 's3Location',
        },
        ExpressionAttributeValues: {
          ':date': new Date().toISOString(),
          ':commit': 'latest', // Would need to get actual commit SHA
          ':location': {
            bucket: process.env.S3_BUCKET_NAME,
            key: s3Key,
          },
        },
      }));
    }

    logger.info('Repository fetched and stored successfully', { s3Key });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        s3Location: {
          bucket: process.env.S3_BUCKET_NAME,
          key: s3Key,
        },
        size: repoBuffer.length,
      }),
    };
  } catch (error) {
    logger.error('Fetch repository failed', { error });
    throw error;
  }
}

async function getUserConnection(tenantId: string, userId: string, provider: string): Promise<any> {
  try {
    const { Item } = await dynamoClient.send(new GetCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        GSI1PK: `TENANT#${tenantId}`,
        GSI1SK: `USER#${userId}`,
      },
    }));

    return Item?.provider === provider ? Item : null;
  } catch (error) {
    logger.error('Failed to get user connection', { error, tenantId, userId, provider });
    throw error;
  }
}

function encryptToken(token: string): string {
  // In production, use AWS KMS or similar for encryption
  // For now, simple base64 encoding (NOT secure for production)
  return Buffer.from(token).toString('base64');
}

function decryptToken(encryptedToken: string): string {
  // In production, use AWS KMS or similar for decryption
  // For now, simple base64 decoding (NOT secure for production)
  return Buffer.from(encryptedToken, 'base64').toString();
}

const lambdaHandler: Handler = async (event: GitHubEvent, context) => {
  logger.addContext(context);
  
  try {
    metrics.addMetric('GitHubIntegrationInvocation', 'Count', 1);
    
    switch (event.action) {
      case 'oauth_callback':
        return await handleOAuthCallback(event);
      case 'list_repositories':
        return await handleListRepositories(event);
      case 'fetch_repository':
        return await handleFetchRepository(event);
      default:
        throw new Error(`Unknown action: ${event.action}`);
    }
  } catch (error) {
    logger.error('Lambda execution failed', { error });
    metrics.addMetric('GitHubIntegrationError', 'Count', 1);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

export const handler = middy(lambdaHandler)
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics))
  .use(injectLambdaContext(logger));