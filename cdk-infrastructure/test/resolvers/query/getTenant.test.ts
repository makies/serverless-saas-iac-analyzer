/**
 * Unit tests for getTenant resolver
 */

import { handler } from '../../../src/resolvers/query/getTenant';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

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

describe('getTenant resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return tenant data for valid tenant ID', async () => {
    const mockTenant = testUtils.createMockTenant();
    mockSend.mockResolvedValueOnce({ Item: mockTenant });

    const event = testUtils.createMockAppSyncEvent({
      tenantId: 'test-tenant-id',
    });

    const context = testUtils.createMockLambdaContext();
    const result = await handler(event, context);

    expect(result).toEqual(mockTenant);
    expect(mockSend).toHaveBeenCalledWith({
      TableName: 'test-tenants-table',
      Key: {
        pk: 'TENANT#test-tenant-id',
        sk: '#METADATA',
      },
    });
  });

  it('should return null for non-existent tenant', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = testUtils.createMockAppSyncEvent({
      tenantId: 'non-existent-tenant',
    });

    const context = testUtils.createMockLambdaContext();
    const result = await handler(event, context);

    expect(result).toBeNull();
  });

  it('should throw error for unauthorized access to different tenant', async () => {
    const event = testUtils.createMockAppSyncEvent(
      { tenantId: 'different-tenant-id' },
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'user-tenant-id',
          'custom:role': 'ClientAdmin',
          email: 'test@example.com',
        },
      }
    );

    await expect(handler(event, testUtils.createMockLambdaContext())).rejects.toThrow('Access denied: Cannot access other tenant data');
  });

  it('should allow SystemAdmin to access any tenant', async () => {
    const mockTenant = testUtils.createMockTenant({
      tenantId: 'different-tenant-id',
    });
    mockSend.mockResolvedValueOnce({ Item: mockTenant });

    const event = testUtils.createMockAppSyncEvent(
      { tenantId: 'different-tenant-id' },
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'user-tenant-id',
          'custom:role': 'SystemAdmin',
          email: 'admin@example.com',
        },
      }
    );

    const context = testUtils.createMockLambdaContext();
    const result = await handler(event, context);

    expect(result).toEqual(mockTenant);
  });

  it('should handle DynamoDB errors gracefully', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB Error'));

    const event = testUtils.createMockAppSyncEvent({
      tenantId: 'test-tenant-id',
    });

    await expect(handler(event, testUtils.createMockLambdaContext())).rejects.toThrow('Failed to get tenant');
  });

  it('should validate required parameters', async () => {
    const event = testUtils.createMockAppSyncEvent({
      // Missing tenantId
    });

    await expect(handler(event, testUtils.createMockLambdaContext())).rejects.toThrow();
  });
});