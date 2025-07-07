/**
 * Unit tests for updateUserProfile resolver
 */

import { handler } from '../../../src/resolvers/mutation/updateUserProfile';

// Mock the DynamoDB client
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  UpdateCommand: jest.fn((params) => params),
  GetCommand: jest.fn((params) => params),
}));

describe('updateUserProfile resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should update user profile successfully', async () => {
    const updatedProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      email: 'updated@example.com',
      firstName: 'Updated',
      lastName: 'User',
      role: 'ProjectManager',
      tenantId: 'test-tenant-id',
      projectIds: ['project-1'],
      preferences: {
        theme: 'light',
        language: 'ja',
        notifications: false,
      },
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    // Mock update operation
    mockSend.mockResolvedValueOnce({
      Attributes: updatedProfile,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        firstName: 'Updated',
        lastName: 'User',
        email: 'updated@example.com',
        preferences: {
          theme: 'light',
          language: 'ja',
          notifications: false,
        },
      },
    });

    const result = await handler(event);

    expect(result).toMatchObject({
      id: 'test-user-id',
      email: 'updated@example.com',
      firstName: 'Updated',
      lastName: 'User',
      preferences: {
        theme: 'light',
        language: 'ja',
        notifications: false,
      },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        TableName: 'test-users-table',
        Key: {
          pk: 'USER#test-user-id',
          sk: '#METADATA',
        },
        UpdateExpression: expect.stringContaining('SET'),
        ExpressionAttributeNames: expect.any(Object),
        ExpressionAttributeValues: expect.any(Object),
        ReturnValues: 'ALL_NEW',
      })
    );
  });

  it('should handle partial updates', async () => {
    const updatedProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Updated',
      lastName: 'User',
      role: 'ProjectManager',
      tenantId: 'test-tenant-id',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    mockSend.mockResolvedValueOnce({
      Attributes: updatedProfile,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        firstName: 'Updated',
        // Only updating firstName
      },
    });

    const result = await handler(event);

    expect(result.firstName).toBe('Updated');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        UpdateExpression: 'SET #firstName = :firstName, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#firstName': 'firstName',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':firstName': 'Updated',
          ':updatedAt': expect.any(String),
        },
      })
    );
  });

  it('should prevent unauthorized updates to restricted fields', async () => {
    const event = global.testUtils.createMockAppSyncEvent(
      {
        updates: {
          id: 'malicious-id',
          tenantId: 'malicious-tenant',
          role: 'SystemAdmin', // User trying to escalate privileges
          projectIds: ['unauthorized-project'],
        },
      },
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'test-tenant-id',
          'custom:role': 'Analyst', // Regular user
          email: 'test@example.com',
        },
      }
    );

    await expect(handler(event)).rejects.toThrow('Cannot update restricted fields');
  });

  it('should allow SystemAdmin to update restricted fields', async () => {
    const updatedProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      role: 'ProjectManager',
      tenantId: 'test-tenant-id',
      projectIds: ['project-1', 'project-2'],
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    mockSend.mockResolvedValueOnce({
      Attributes: updatedProfile,
    });

    const event = global.testUtils.createMockAppSyncEvent(
      {
        updates: {
          role: 'ProjectManager',
          projectIds: ['project-1', 'project-2'],
        },
      },
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'test-tenant-id',
          'custom:role': 'SystemAdmin',
          email: 'admin@example.com',
        },
      }
    );

    const result = await handler(event);

    expect(result).toMatchObject({
      role: 'ProjectManager',
      projectIds: ['project-1', 'project-2'],
    });
  });

  it('should validate email format', async () => {
    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        email: 'invalid-email-format',
      },
    });

    await expect(handler(event)).rejects.toThrow('Invalid email format');
  });

  it('should validate required fields are not empty', async () => {
    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        firstName: '',
        lastName: '',
      },
    });

    await expect(handler(event)).rejects.toThrow('First name and last name cannot be empty');
  });

  it('should handle nested object updates (preferences)', async () => {
    const updatedProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true,
        timezone: 'UTC',
      },
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    mockSend.mockResolvedValueOnce({
      Attributes: updatedProfile,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: true,
          timezone: 'UTC',
        },
      },
    });

    const result = await handler(event);

    expect(result.preferences).toMatchObject({
      theme: 'dark',
      language: 'en',
      notifications: true,
      timezone: 'UTC',
    });
  });

  it('should handle missing identity gracefully', async () => {
    const event = {
      arguments: { updates: { firstName: 'Test' } },
      identity: null,
      source: {},
      request: { headers: {} },
      prev: null,
      info: { fieldName: 'updateUserProfile', parentTypeName: 'Mutation', variables: {} },
      stash: {},
    };

    await expect(handler(event)).rejects.toThrow('Authentication required');
  });

  it('should handle empty updates object', async () => {
    const event = global.testUtils.createMockAppSyncEvent({
      updates: {},
    });

    await expect(handler(event)).rejects.toThrow('No updates provided');
  });

  it('should handle DynamoDB errors gracefully', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB Error'));

    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        firstName: 'Test',
      },
    });

    await expect(handler(event)).rejects.toThrow('Failed to update user profile');
  });

  it('should set updatedAt timestamp automatically', async () => {
    const updatedProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      firstName: 'Test',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    mockSend.mockResolvedValueOnce({
      Attributes: updatedProfile,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        firstName: 'Test',
      },
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        ExpressionAttributeNames: expect.objectContaining({
          '#updatedAt': 'updatedAt',
        }),
        ExpressionAttributeValues: expect.objectContaining({
          ':updatedAt': expect.any(String),
        }),
      })
    );
  });

  it('should handle special characters in field values', async () => {
    const updatedProfile = {
      pk: 'USER#test-user-id',
      sk: '#METADATA',
      id: 'test-user-id',
      firstName: 'José',
      lastName: 'González-Smith',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };

    mockSend.mockResolvedValueOnce({
      Attributes: updatedProfile,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      updates: {
        firstName: 'José',
        lastName: 'González-Smith',
      },
    });

    const result = await handler(event);

    expect(result).toMatchObject({
      firstName: 'José',
      lastName: 'González-Smith',
    });
  });
});