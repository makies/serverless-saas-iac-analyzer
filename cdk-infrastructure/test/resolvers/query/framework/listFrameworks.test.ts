/**
 * Unit tests for listFrameworks resolver
 */

import { handler } from '../../../../src/resolvers/query/framework/listFrameworks';

// Mock the DynamoDB client
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  ScanCommand: jest.fn((params) => params),
}));

describe('listFrameworks resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return all frameworks when no filter is provided', async () => {
    const mockFrameworks = [
      {
        pk: 'FRAMEWORK#well-architected',
        sk: '#METADATA',
        frameworkId: 'well-architected',
        name: 'AWS Well-Architected Framework',
        category: 'AWS_NATIVE',
        version: '2024.1',
        status: 'ACTIVE',
        description: 'AWS Well-Architected Framework',
      },
      {
        pk: 'FRAMEWORK#security-hub',
        sk: '#METADATA',
        frameworkId: 'security-hub',
        name: 'AWS Security Hub',
        category: 'SECURITY',
        version: '1.0',
        status: 'ACTIVE',
        description: 'AWS Security Hub compliance checks',
      },
    ];

    mockSend.mockResolvedValueOnce({
      Items: mockFrameworks,
      Count: 2,
    });

    const event = global.testUtils.createMockAppSyncEvent({});

    const result = await handler(event);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      frameworkId: 'well-architected',
      name: 'AWS Well-Architected Framework',
      category: 'AWS_NATIVE',
    });
    expect(result[1]).toMatchObject({
      frameworkId: 'security-hub',
      name: 'AWS Security Hub',
      category: 'SECURITY',
    });
  });

  it('should filter frameworks by category', async () => {
    const mockFrameworks = [
      {
        pk: 'FRAMEWORK#security-hub',
        sk: '#METADATA',
        frameworkId: 'security-hub',
        name: 'AWS Security Hub',
        category: 'SECURITY',
        version: '1.0',
        status: 'ACTIVE',
      },
    ];

    mockSend.mockResolvedValueOnce({
      Items: mockFrameworks,
      Count: 1,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      filter: { category: 'SECURITY' },
    });

    const result = await handler(event);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('SECURITY');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: '#category = :category',
        ExpressionAttributeNames: { '#category': 'category' },
        ExpressionAttributeValues: { ':category': 'SECURITY' },
      })
    );
  });

  it('should filter frameworks by status', async () => {
    const mockFrameworks = [
      {
        pk: 'FRAMEWORK#well-architected',
        sk: '#METADATA',
        frameworkId: 'well-architected',
        name: 'AWS Well-Architected Framework',
        category: 'AWS_NATIVE',
        version: '2024.1',
        status: 'ACTIVE',
      },
    ];

    mockSend.mockResolvedValueOnce({
      Items: mockFrameworks,
      Count: 1,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      filter: { status: 'ACTIVE' },
    });

    const result = await handler(event);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('ACTIVE');
  });

  it('should handle pagination with limit', async () => {
    const mockFrameworks = Array.from({ length: 25 }, (_, i) => ({
      pk: `FRAMEWORK#framework-${i}`,
      sk: '#METADATA',
      frameworkId: `framework-${i}`,
      name: `Framework ${i}`,
      category: 'CUSTOM',
      version: '1.0',
      status: 'ACTIVE',
    }));

    mockSend.mockResolvedValueOnce({
      Items: mockFrameworks,
      Count: 25,
      LastEvaluatedKey: { pk: 'FRAMEWORK#framework-24', sk: '#METADATA' },
    });

    const event = global.testUtils.createMockAppSyncEvent({
      limit: 25,
    });

    const result = await handler(event);

    expect(result).toHaveLength(25);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        Limit: 25,
      })
    );
  });

  it('should handle multiple filters', async () => {
    const mockFrameworks = [
      {
        pk: 'FRAMEWORK#custom-security',
        sk: '#METADATA',
        frameworkId: 'custom-security',
        name: 'Custom Security Framework',
        category: 'SECURITY',
        version: '1.0',
        status: 'ACTIVE',
      },
    ];

    mockSend.mockResolvedValueOnce({
      Items: mockFrameworks,
      Count: 1,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      filter: {
        category: 'SECURITY',
        status: 'ACTIVE',
      },
    });

    const result = await handler(event);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      category: 'SECURITY',
      status: 'ACTIVE',
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        FilterExpression: '#category = :category AND #status = :status',
        ExpressionAttributeNames: {
          '#category': 'category',
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':category': 'SECURITY',
          ':status': 'ACTIVE',
        },
      })
    );
  });

  it('should return empty array when no frameworks found', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [],
      Count: 0,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      filter: { category: 'NON_EXISTENT' },
    });

    const result = await handler(event);

    expect(result).toEqual([]);
  });

  it('should handle DynamoDB errors gracefully', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB Error'));

    const event = global.testUtils.createMockAppSyncEvent({});

    await expect(handler(event)).rejects.toThrow('Failed to list frameworks');
  });

  it('should handle nextToken for pagination', async () => {
    const mockFrameworks = [
      {
        pk: 'FRAMEWORK#framework-26',
        sk: '#METADATA',
        frameworkId: 'framework-26',
        name: 'Framework 26',
        category: 'CUSTOM',
        version: '1.0',
        status: 'ACTIVE',
      },
    ];

    mockSend.mockResolvedValueOnce({
      Items: mockFrameworks,
      Count: 1,
    });

    const event = global.testUtils.createMockAppSyncEvent({
      nextToken: 'eyJwayI6IkZSQU1FV09SSyNmcmFtZXdvcmstMjQifQ==', // base64 encoded pagination token
    });

    const result = await handler(event);

    expect(result).toHaveLength(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        ExclusiveStartKey: expect.any(Object),
      })
    );
  });

  it('should enforce maximum limit', async () => {
    const event = global.testUtils.createMockAppSyncEvent({
      limit: 200, // Above maximum
    });

    mockSend.mockResolvedValueOnce({
      Items: [],
      Count: 0,
    });

    await handler(event);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        Limit: 100, // Should be capped at 100
      })
    );
  });
});