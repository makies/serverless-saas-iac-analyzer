import { DynamoDBClient, GetItemCommand, UpdateItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export interface TenantContextConfig {
  tenantTableName: string;
  projectTableName: string;
}

export interface AnalysisData {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  resultSummary?: {
    totalResources: number;
    totalFindings: number;
    findingsBySeverity: Record<string, number>;
    findingsByPillar: Record<string, number>;
  };
  tenant: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
    description?: string;
  };
  findings: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    pillar: string;
    resource?: string;
    recommendation: string;
    category?: string;
    ruleId?: string;
    line?: number;
  }>;
}

export interface ReportData {
  id: string;
  tenantId: string;
  projectId: string;
  analysisId?: string;
  name: string;
  type: string;
  format: string;
  status: string;
  s3Location?: {
    bucket: string;
    key: string;
    region: string;
  };
  generatedBy: string;
  createdAt: string;
  updatedAt?: string;
  error?: string;
}

export interface FindingsFilter {
  severityFilter?: string[];
  pillarFilter?: string[];
  maxFindings?: number;
}

/**
 * TenantContext provides multi-tenant data access and isolation
 */
export class TenantContext {
  constructor(
    private dynamoClient: DynamoDBClient,
    private config: TenantContextConfig
  ) {}

  /**
   * Validate tenant access to a project
   */
  async validateTenantAccess(tenantId: string, projectId: string): Promise<boolean> {
    try {
      const result = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.config.projectTableName,
          Key: marshall({ id: projectId }),
        })
      );

      if (!result.Item) {
        return false;
      }

      const project = unmarshall(result.Item);
      return project.tenantId === tenantId;
    } catch (error) {
      console.error('Error validating tenant access:', error);
      return false;
    }
  }

  /**
   * Update analysis status
   */
  async updateAnalysisStatus(
    analysisId: string,
    status: string,
    additionalData: Record<string, any> = {}
  ): Promise<void> {
    const updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
    const expressionAttributeNames = { '#status': 'status' };
    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    };

    // Add additional data to update expression
    Object.entries(additionalData).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression += `, ${attrName} = ${attrValue}`;
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: process.env.ANALYSIS_TABLE_NAME!,
        Key: marshall({ id: analysisId }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
      })
    );
  }

  /**
   * Get analysis data with findings
   */
  async getAnalysisWithFindings(
    analysisId: string,
    filter: FindingsFilter = {}
  ): Promise<AnalysisData | null> {
    try {
      // Get analysis record
      const analysisResult = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: process.env.ANALYSIS_TABLE_NAME!,
          Key: marshall({ id: analysisId }),
        })
      );

      if (!analysisResult.Item) {
        return null;
      }

      const analysis = unmarshall(analysisResult.Item);

      // Get tenant info
      const tenantResult = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.config.tenantTableName,
          Key: marshall({ id: analysis.tenantId }),
        })
      );

      // Get project info
      const projectResult = await this.dynamoClient.send(
        new GetItemCommand({
          TableName: this.config.projectTableName,
          Key: marshall({ id: analysis.projectId }),
        })
      );

      // Get findings
      const findingsResult = await this.dynamoClient.send(
        new QueryCommand({
          TableName: process.env.FINDING_TABLE_NAME!,
          IndexName: 'byAnalysis',
          KeyConditionExpression: 'analysisId = :analysisId',
          ExpressionAttributeValues: marshall({
            ':analysisId': analysisId,
          }),
          Limit: filter.maxFindings || 1000,
        })
      );

      let findings = findingsResult.Items?.map(item => unmarshall(item)) || [];

      // Apply filters
      if (filter.severityFilter?.length) {
        findings = findings.filter(f => filter.severityFilter!.includes(f.severity));
      }

      if (filter.pillarFilter?.length) {
        findings = findings.filter(f => filter.pillarFilter!.includes(f.pillar));
      }

      const tenant = tenantResult.Item ? unmarshall(tenantResult.Item) : { id: analysis.tenantId, name: 'Unknown' };
      const project = projectResult.Item ? unmarshall(projectResult.Item) : { id: analysis.projectId, name: 'Unknown' };

      return {
        ...analysis,
        tenant: {
          id: tenant.id,
          name: tenant.name,
        },
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
        },
        findings,
      };
    } catch (error) {
      console.error('Error getting analysis with findings:', error);
      return null;
    }
  }

  /**
   * Create a new report record
   */
  async createReport(reportData: Omit<ReportData, 'updatedAt'>): Promise<void> {
    await this.dynamoClient.send(
      new PutItemCommand({
        TableName: process.env.REPORT_TABLE_NAME!,
        Item: marshall(reportData),
      })
    );
  }

  /**
   * Update report record
   */
  async updateReport(reportId: string, updates: Partial<ReportData>): Promise<void> {
    const updateExpression = 'SET ' + Object.keys(updates).map((key, index) => `#attr${index} = :val${index}`).join(', ');
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = value;
    });

    await this.dynamoClient.send(
      new UpdateItemCommand({
        TableName: process.env.REPORT_TABLE_NAME!,
        Key: marshall({ id: reportId }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
      })
    );
  }
}