/**
 * Unit tests for createProject resolver
 */

import { handler } from '../../../src/resolvers/mutation/createProject';

// Mock the DynamoDB client
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
  PutCommand: jest.fn((params) => params),
  GetCommand: jest.fn((params) => params),
}));

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-project-id'),
}));

describe('createProject resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a new project successfully', async () => {
    const mockTenant = global.testUtils.createMockTenant();
    
    // Mock tenant exists check
    mockSend.mockResolvedValueOnce({ Item: mockTenant });
    // Mock project creation
    mockSend.mockResolvedValueOnce({});

    const event = global.testUtils.createMockAppSyncEvent({
      tenantId: 'test-tenant-id',
      name: 'Test Project',
      description: 'Test project description',
      memberIds: ['test-user-id'],
      settings: {
        allowClientAccess: false,
        defaultAnalysisType: 'CLOUDFORMATION',
        autoDeleteAnalyses: false,
        retentionDays: 90,
      },
    });

    const result = await handler(event);

    expect(result).toMatchObject({
      projectId: 'test-project-id',
      tenantId: 'test-tenant-id',
      name: 'Test Project',
      description: 'Test project description',
      status: 'ACTIVE',
      memberIds: ['test-user-id'],
      createdBy: 'test-user-id',
    });

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should throw error for non-existent tenant', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = global.testUtils.createMockAppSyncEvent({
      tenantId: 'non-existent-tenant',
      name: 'Test Project',
      memberIds: ['test-user-id'],
    });

    await expect(handler(event)).rejects.toThrow("Tenant 'non-existent-tenant' not found");
  });

  it('should throw error for unauthorized tenant access', async () => {
    const event = global.testUtils.createMockAppSyncEvent(
      {
        tenantId: 'different-tenant-id',
        name: 'Test Project',
        memberIds: ['test-user-id'],
      },
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'user-tenant-id',
          'custom:role': 'ClientAdmin',
          email: 'test@example.com',
        },
      }
    );

    await expect(handler(event)).rejects.toThrow('Access denied: Cannot create project for different tenant');
  });

  it('should allow SystemAdmin to create projects for any tenant', async () => {
    const mockTenant = global.testUtils.createMockTenant({
      tenantId: 'different-tenant-id',
    });
    
    mockSend.mockResolvedValueOnce({ Item: mockTenant });
    mockSend.mockResolvedValueOnce({});

    const event = global.testUtils.createMockAppSyncEvent(
      {
        tenantId: 'different-tenant-id',
        name: 'Test Project',
        memberIds: ['test-user-id'],
      },
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'user-tenant-id',
          'custom:role': 'SystemAdmin',
          email: 'admin@example.com',
        },
      }
    );

    const result = await handler(event);

    expect(result).toMatchObject({
      tenantId: 'different-tenant-id',
      name: 'Test Project',
    });
  });

  it('should handle DynamoDB errors gracefully', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB Error'));

    const event = global.testUtils.createMockAppSyncEvent({
      tenantId: 'test-tenant-id',
      name: 'Test Project',
      memberIds: ['test-user-id'],
    });

    await expect(handler(event)).rejects.toThrow('Failed to create project');
  });

  it('should validate required parameters', async () => {
    const event = global.testUtils.createMockAppSyncEvent({
      tenantId: 'test-tenant-id',
      // Missing name and memberIds
    });

    await expect(handler(event)).rejects.toThrow();
  });

  it('should set default values for optional fields', async () => {
    const mockTenant = global.testUtils.createMockTenant();
    
    mockSend.mockResolvedValueOnce({ Item: mockTenant });
    mockSend.mockResolvedValueOnce({});

    const event = global.testUtils.createMockAppSyncEvent({
      tenantId: 'test-tenant-id',
      name: 'Test Project',
      memberIds: ['test-user-id'],
      // No settings provided
    });

    const result = await handler(event);

    expect(result.settings).toMatchObject({
      allowClientAccess: false,
      defaultAnalysisType: 'CLOUDFORMATION',
      autoDeleteAnalyses: false,
      retentionDays: 90,
    });
  });
});