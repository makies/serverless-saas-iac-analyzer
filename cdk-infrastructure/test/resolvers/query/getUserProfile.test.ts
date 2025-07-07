/**
 * Unit tests for getUserProfile resolver
 */

import { handler } from '../../../src/resolvers/query/getUserProfile';

// Mock the DynamoDB client
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  GetCommand: jest.fn((params) => params),
}));

describe('getUserProfile resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return user profile from database when user exists', async () => {
    const mockUserProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'ProjectManager',
      tenantId: 'test-tenant-id',
      projectIds: ['project-1', 'project-2'],
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true,
      },
      lastLoginAt: '2024-01-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    mockSend.mockResolvedValueOnce({ Item: mockUserProfile });

    const event = global.testUtils.createMockAppSyncEvent({});

    const result = await handler(event);

    expect(result).toMatchObject({
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'ProjectManager',
      tenantId: 'test-tenant-id',
      projectIds: ['project-1', 'project-2'],
    });

    expect(mockSend).toHaveBeenCalledWith({
      TableName: 'test-users-table',
      Key: {
        pk: 'USER#test-user-id',
        sk: '#METADATA',
      },
    });
  });

  it('should create minimal profile from JWT claims when user not in database', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = global.testUtils.createMockAppSyncEvent(
      {},
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'test-tenant-id',
          'custom:role': 'Analyst',
          email: 'new-user@example.com',
          given_name: 'New',
          family_name: 'User',
        },
      }
    );

    const result = await handler(event);

    expect(result).toMatchObject({
      id: 'test-user-id',
      email: 'new-user@example.com',
      firstName: 'New',
      lastName: 'User',
      role: 'Analyst',
      tenantId: 'test-tenant-id',
      projectIds: [],
    });
  });

  it('should handle missing JWT claims gracefully', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = global.testUtils.createMockAppSyncEvent(
      {},
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'test-tenant-id',
          // Missing role, email, names
        },
      }
    );

    const result = await handler(event);

    expect(result).toMatchObject({
      id: 'test-user-id',
      email: '',
      firstName: '',
      lastName: '',
      role: 'VIEWER', // Default role
      tenantId: 'test-tenant-id',
      projectIds: [],
    });
  });

  it('should handle missing identity gracefully', async () => {
    const event = {
      arguments: {},
      identity: null,
      source: {},
      request: { headers: {} },
      prev: null,
      info: { fieldName: 'getUserProfile', parentTypeName: 'Query', variables: {} },
      stash: {},
    };

    await expect(handler(event)).rejects.toThrow('Authentication required');
  });

  it('should handle missing user ID in identity', async () => {
    const event = global.testUtils.createMockAppSyncEvent(
      {},
      {
        // Missing sub
        claims: {
          'custom:tenantId': 'test-tenant-id',
          'custom:role': 'Analyst',
        },
      }
    );

    await expect(handler(event)).rejects.toThrow('User ID not found in identity');
  });

  it('should handle DynamoDB errors gracefully', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB Error'));

    const event = global.testUtils.createMockAppSyncEvent({});

    await expect(handler(event)).rejects.toThrow('Failed to get user profile');
  });

  it('should handle nested claims object', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = global.testUtils.createMockAppSyncEvent(
      {},
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'test-tenant-id',
          'custom:role': 'ClientAdmin',
          email: 'admin@example.com',
          given_name: 'Admin',
          family_name: 'User',
          // Additional nested claims
          'custom:department': 'IT',
          'custom:location': 'US',
        },
      }
    );

    const result = await handler(event);

    expect(result).toMatchObject({
      id: 'test-user-id',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ClientAdmin',
      tenantId: 'test-tenant-id',
    });
  });

  it('should prefer database data over JWT claims when both exist', async () => {
    const mockUserProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      email: 'database@example.com',
      firstName: 'Database',
      lastName: 'User',
      role: 'SystemAdmin',
      tenantId: 'database-tenant-id',
      projectIds: ['project-1'],
    };

    mockSend.mockResolvedValueOnce({ Item: mockUserProfile });

    const event = global.testUtils.createMockAppSyncEvent(
      {},
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'jwt-tenant-id',
          'custom:role': 'Viewer',
          email: 'jwt@example.com',
          given_name: 'JWT',
          family_name: 'User',
        },
      }
    );

    const result = await handler(event);

    // Should return database data, not JWT claims
    expect(result).toMatchObject({
      id: 'test-user-id',
      email: 'database@example.com',
      firstName: 'Database',
      lastName: 'User',
      role: 'SystemAdmin',
      tenantId: 'database-tenant-id',
      projectIds: ['project-1'],
    });
  });

  it('should handle malformed JWT claims', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = global.testUtils.createMockAppSyncEvent(
      {},
      {
        sub: 'test-user-id',
        claims: null, // Malformed claims
      }
    );

    const result = await handler(event);

    expect(result).toMatchObject({
      id: 'test-user-id',
      email: '',
      firstName: '',
      lastName: '',
      role: 'VIEWER',
      tenantId: '',
      projectIds: [],
    });
  });
});