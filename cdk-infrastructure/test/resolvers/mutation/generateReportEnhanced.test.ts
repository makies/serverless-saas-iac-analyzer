/**
 * Unit tests for generateReportEnhanced resolver
 */

import { handler } from '../../../src/resolvers/mutation/generateReportEnhanced';

// Mock the DynamoDB client
const mockDynamoSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockDynamoSend,
    })),
  },
  GetCommand: jest.fn((params) => params),
  PutCommand: jest.fn((params) => params),
}));

// Mock the Step Functions client
const mockSfnSend = jest.fn();
jest.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn(() => ({
    send: mockSfnSend,
  })),
  StartExecutionCommand: jest.fn((params) => params),
}));

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-report-id'),
}));

describe('generateReportEnhanced resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REPORT_GENERATION_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-report-generation';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate enhanced report successfully', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis({
      analysisId: 'test-analysis-id',
      tenantId: 'test-tenant-id',
      projectId: 'test-project-id',
      status: 'COMPLETED',
    });

    // Mock analysis exists check
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    // Mock report creation
    mockDynamoSend.mockResolvedValueOnce({});
    // Mock Step Functions execution
    mockSfnSend.mockResolvedValueOnce({
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-report-generation:test-execution',
      startDate: new Date(),
    });

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'COMPREHENSIVE',
      format: 'PDF',
      customOptions: {
        includeCharts: true,
        includeCostEstimates: true,
        complianceFrameworks: ['SOC2', 'ISO27001'],
        sections: ['EXECUTIVE_SUMMARY', 'DETAILED_FINDINGS', 'RECOMMENDATIONS'],
        branding: {
          logo: 'https://example.com/logo.png',
          colors: ['#1f2937', '#3b82f6'],
        },
      },
    });

    const result = await handler(event);

    expect(result).toMatchObject({
      reportId: 'test-report-id',
      tenantId: 'test-tenant-id',
      projectId: 'test-project-id',
      analysisId: 'test-analysis-id',
      type: 'COMPREHENSIVE',
      format: 'PDF',
      status: 'GENERATING',
      customOptions: {
        includeCharts: true,
        includeCostEstimates: true,
        complianceFrameworks: ['SOC2', 'ISO27001'],
      },
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-report-generation:test-execution',
    });

    expect(mockSfnSend).toHaveBeenCalledWith(
      expect.objectContaining({
        stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:test-report-generation',
        input: expect.stringContaining('"reportType":"COMPREHENSIVE"'),
      })
    );
  });

  it('should handle Excel format report generation', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis();
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    mockDynamoSend.mockResolvedValueOnce({});
    mockSfnSend.mockResolvedValueOnce(global.testUtils.mockStepFunctionsResponse);

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'SUMMARY',
      format: 'EXCEL',
      customOptions: {
        includeRawData: true,
        worksheetNames: ['Summary', 'Findings', 'Recommendations'],
      },
    });

    const result = await handler(event);

    expect(result.format).toBe('EXCEL');
    expect(result.customOptions.includeRawData).toBe(true);
  });

  it('should handle HTML format with custom styling', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis();
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    mockDynamoSend.mockResolvedValueOnce({});
    mockSfnSend.mockResolvedValueOnce(global.testUtils.mockStepFunctionsResponse);

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'DETAILED',
      format: 'HTML',
      customOptions: {
        theme: 'modern',
        interactive: true,
        embedCharts: true,
        customCSS: '.header { color: blue; }',
      },
    });

    const result = await handler(event);

    expect(result.format).toBe('HTML');
    expect(result.customOptions.interactive).toBe(true);
  });

  it('should handle JSON format for API consumption', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis();
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    mockDynamoSend.mockResolvedValueOnce({});
    mockSfnSend.mockResolvedValueOnce(global.testUtils.mockStepFunctionsResponse);

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'RAW_DATA',
      format: 'JSON',
      customOptions: {
        includeMetadata: true,
        formatVersion: '2.0',
        compression: 'gzip',
      },
    });

    const result = await handler(event);

    expect(result.format).toBe('JSON');
    expect(result.customOptions.formatVersion).toBe('2.0');
  });

  it('should throw error for non-existent analysis', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'non-existent-analysis',
      type: 'SUMMARY',
      format: 'PDF',
    });

    await expect(handler(event)).rejects.toThrow("Analysis 'non-existent-analysis' not found");
  });

  it('should throw error for analysis not in completed state', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis({
      status: 'RUNNING',
    });
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'SUMMARY',
      format: 'PDF',
    });

    await expect(handler(event)).rejects.toThrow('Analysis must be in COMPLETED state to generate reports');
  });

  it('should enforce tenant isolation', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis({
      tenantId: 'different-tenant-id',
    });
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });

    const event = global.testUtils.createMockAppSyncEvent(
      {
        analysisId: 'test-analysis-id',
        type: 'SUMMARY',
        format: 'PDF',
      },
      {
        sub: 'test-user-id',
        claims: {
          'custom:tenantId': 'user-tenant-id',
          'custom:role': 'Analyst',
          email: 'test@example.com',
        },
      }
    );

    await expect(handler(event)).rejects.toThrow('Access denied: Cannot generate report for different tenant');
  });

  it('should allow SystemAdmin to generate reports for any tenant', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis({
      tenantId: 'different-tenant-id',
    });
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    mockDynamoSend.mockResolvedValueOnce({});
    mockSfnSend.mockResolvedValueOnce(global.testUtils.mockStepFunctionsResponse);

    const event = global.testUtils.createMockAppSyncEvent(
      {
        analysisId: 'test-analysis-id',
        type: 'SUMMARY',
        format: 'PDF',
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

    expect(result.tenantId).toBe('different-tenant-id');
  });

  it('should validate required parameters', async () => {
    const event = global.testUtils.createMockAppSyncEvent({
      // Missing analysisId, type, and format
    });

    await expect(handler(event)).rejects.toThrow();
  });

  it('should handle Step Functions execution errors', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis();
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    mockDynamoSend.mockResolvedValueOnce({});
    mockSfnSend.mockRejectedValueOnce(new Error('Step Functions Error'));

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'SUMMARY',
      format: 'PDF',
    });

    await expect(handler(event)).rejects.toThrow('Failed to start report generation workflow');
  });

  it('should handle DynamoDB errors gracefully', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB Error'));

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'SUMMARY',
      format: 'PDF',
    });

    await expect(handler(event)).rejects.toThrow('Failed to generate enhanced report');
  });

  it('should set default custom options when none provided', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis();
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    mockDynamoSend.mockResolvedValueOnce({});
    mockSfnSend.mockResolvedValueOnce(global.testUtils.mockStepFunctionsResponse);

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'SUMMARY',
      format: 'PDF',
      // No customOptions provided
    });

    const result = await handler(event);

    expect(result.customOptions).toEqual({});
  });

  it('should handle complex custom options', async () => {
    const mockAnalysis = global.testUtils.createMockAnalysis();
    mockDynamoSend.mockResolvedValueOnce({ Item: mockAnalysis });
    mockDynamoSend.mockResolvedValueOnce({});
    mockSfnSend.mockResolvedValueOnce(global.testUtils.mockStepFunctionsResponse);

    const complexOptions = {
      includeCharts: true,
      includeCostEstimates: true,
      complianceFrameworks: ['SOC2', 'ISO27001', 'PCI-DSS'],
      sections: ['EXECUTIVE_SUMMARY', 'DETAILED_FINDINGS', 'RECOMMENDATIONS', 'APPENDIX'],
      filters: {
        severity: ['HIGH', 'CRITICAL'],
        categories: ['SECURITY', 'PERFORMANCE'],
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
      },
      formatting: {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: 20, bottom: 20, left: 15, right: 15 },
      },
      branding: {
        logo: 'https://example.com/logo.png',
        colors: ['#1f2937', '#3b82f6', '#ef4444'],
        fontFamily: 'Arial',
      },
    };

    const event = global.testUtils.createMockAppSyncEvent({
      analysisId: 'test-analysis-id',
      type: 'COMPREHENSIVE',
      format: 'PDF',
      customOptions: complexOptions,
    });

    const result = await handler(event);

    expect(result.customOptions).toEqual(complexOptions);
  });
});