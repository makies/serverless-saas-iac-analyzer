import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export interface InfrastructureData {
  resources: Array<{
    type: string;
    name: string;
    properties: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
  metadata: {
    fileName: string;
    fileType: string;
    analysisType: string;
    resourceCount: number;
  };
}

export interface InfrastructureAnalyzerConfig {
  s3Client: S3Client;
  bucketName: string;
  tenantId: string;
}

/**
 * InfrastructureAnalyzer processes infrastructure files and extracts resource information
 */
export class InfrastructureAnalyzer {
  constructor(private config: InfrastructureAnalyzerConfig) {}

  /**
   * Process infrastructure file and extract resources
   */
  async processFile(fileKey: string, analysisType: string): Promise<InfrastructureData> {
    try {
      // Download file from S3
      const result = await this.config.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: `${this.config.tenantId}/${fileKey}`,
        })
      );

      if (!result.Body) {
        throw new Error('File not found or empty');
      }

      const fileContent = await result.Body.transformToString();
      
      // Parse based on analysis type
      switch (analysisType) {
        case 'CLOUDFORMATION':
          return this.parseCloudFormation(fileContent, fileKey);
        case 'TERRAFORM':
          return this.parseTerraform(fileContent, fileKey);
        case 'CDK':
          return this.parseCDK(fileContent, fileKey);
        case 'LIVE_SCAN':
          return this.processLiveScan(fileContent, fileKey);
        default:
          throw new Error(`Unsupported analysis type: ${analysisType}`);
      }
    } catch (error) {
      console.error('Error processing infrastructure file:', error);
      throw error;
    }
  }

  private parseCloudFormation(content: string, fileName: string): InfrastructureData {
    try {
      const template = JSON.parse(content);
      const resources = [];

      if (template.Resources) {
        for (const [resourceName, resourceData] of Object.entries(template.Resources as Record<string, any>)) {
          resources.push({
            type: resourceData.Type,
            name: resourceName,
            properties: resourceData.Properties || {},
            metadata: {
              dependsOn: resourceData.DependsOn,
              condition: resourceData.Condition,
            },
          });
        }
      }

      return {
        resources,
        metadata: {
          fileName,
          fileType: 'CloudFormation',
          analysisType: 'CLOUDFORMATION',
          resourceCount: resources.length,
        },
      };
    } catch (error) {
      console.error('Error parsing CloudFormation template:', error);
      throw new Error('Invalid CloudFormation template format');
    }
  }

  private parseTerraform(content: string, fileName: string): InfrastructureData {
    // Basic Terraform parsing - would need HCL parser for production
    const resources: any[] = [];
    
    // Simple regex-based parsing for demo purposes
    const resourceMatches = content.matchAll(/resource\s+"([^"]+)"\s+"([^"]+)"\s*{([^}]*)}/g);
    
    for (const match of resourceMatches) {
      const [, resourceType, resourceName, resourceBody] = match;
      
      // Parse properties from resource body (simplified)
      const properties: Record<string, any> = {};
      const propertyMatches = resourceBody.matchAll(/(\w+)\s*=\s*"([^"]*)"/g);
      
      for (const propMatch of propertyMatches) {
        const [, propName, propValue] = propMatch;
        properties[propName] = propValue;
      }

      resources.push({
        type: resourceType,
        name: resourceName,
        properties,
        metadata: {},
      });
    }

    return {
      resources,
      metadata: {
        fileName,
        fileType: 'Terraform',
        analysisType: 'TERRAFORM',
        resourceCount: resources.length,
      },
    };
  }

  private parseCDK(content: string, fileName: string): InfrastructureData {
    // CDK analysis would require TypeScript AST parsing
    // For now, return empty structure
    return {
      resources: [],
      metadata: {
        fileName,
        fileType: 'CDK',
        analysisType: 'CDK',
        resourceCount: 0,
      },
    };
  }

  private processLiveScan(content: string, fileName: string): InfrastructureData {
    // Process live AWS account scan results
    try {
      const scanResults = JSON.parse(content);
      const resources = [];

      if (scanResults.resources && Array.isArray(scanResults.resources)) {
        for (const resource of scanResults.resources) {
          resources.push({
            type: resource.ResourceType || resource.type,
            name: resource.ResourceId || resource.name || resource.id,
            properties: resource.Configuration || resource.properties || {},
            metadata: {
              region: resource.Region,
              accountId: resource.AccountId,
              arn: resource.ResourceARN,
            },
          });
        }
      }

      return {
        resources,
        metadata: {
          fileName,
          fileType: 'Live Scan',
          analysisType: 'LIVE_SCAN',
          resourceCount: resources.length,
        },
      };
    } catch (error) {
      console.error('Error parsing live scan results:', error);
      throw new Error('Invalid live scan results format');
    }
  }
}