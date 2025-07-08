import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as yaml from 'js-yaml';
import AdmZip from 'adm-zip';

export interface InfrastructureResource {
  type: string;
  name: string;
  properties: Record<string, any>;
  metadata?: Record<string, any>;
  dependencies?: string[];
  tags?: Record<string, string>;
  location?: {
    file: string;
    line?: number;
    block?: string;
    zipEntry?: string;
  };
}

export interface InfrastructureData {
  resources: InfrastructureResource[];
  metadata: {
    fileName: string;
    fileType: string;
    analysisType: string;
    resourceCount: number;
    parameters?: Record<string, any>;
    outputs?: Record<string, any>;
    variables?: Record<string, any>;
    zipContents?: {
      totalFiles: number;
      processedFiles: string[];
    };
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

      // Check if file is a ZIP archive
      if (fileKey.toLowerCase().endsWith('.zip')) {
        return this.processZipFile(result.Body, fileKey, analysisType);
      }

      const fileContent = await result.Body.transformToString();
      
      // Auto-detect format if not explicitly specified
      const detectedType = this.detectFileFormat(fileKey, fileContent, analysisType);
      
      // Parse based on detected/specified type
      switch (detectedType) {
        case 'CLOUDFORMATION':
          return this.parseCloudFormation(fileContent, fileKey);
        case 'TERRAFORM':
          return this.parseTerraform(fileContent, fileKey);
        case 'CDK':
          return this.parseCDK(fileContent, fileKey);
        case 'LIVE_SCAN':
          return this.processLiveScan(fileContent, fileKey);
        default:
          throw new Error(`Unsupported analysis type: ${detectedType}`);
      }
    } catch (error) {
      console.error('Error processing infrastructure file:', error);
      throw error;
    }
  }

  /**
   * Auto-detect file format based on extension and content
   */
  private detectFileFormat(fileName: string, content: string, providedType?: string): string {
    if (providedType && providedType !== 'AUTO') {
      return providedType;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Check file extension first
    switch (extension) {
      case 'tf':
      case 'tfvars':
        return 'TERRAFORM';
      case 'ts':
      case 'js':
        if (content.includes('@aws-cdk/') || content.includes('aws-cdk-lib')) {
          return 'CDK';
        }
        break;
      case 'yaml':
      case 'yml':
      case 'json':
        if (content.includes('AWSTemplateFormatVersion') || 
            content.includes('Resources:') || 
            content.includes('"Resources"')) {
          return 'CLOUDFORMATION';
        }
        break;
    }

    // Content-based detection
    if (content.includes('resource "aws_') || content.includes('provider "aws"')) {
      return 'TERRAFORM';
    }
    
    if (content.includes('AWSTemplateFormatVersion') || 
        (content.includes('Resources') && (content.includes('Type:') || content.includes('"Type"')))) {
      return 'CLOUDFORMATION';
    }
    
    if (content.includes('@aws-cdk/') || content.includes('aws-cdk-lib') || content.includes('Construct')) {
      return 'CDK';
    }

    // Default to CloudFormation for JSON/YAML files
    return 'CLOUDFORMATION';
  }

  private parseCloudFormation(content: string, fileName: string): InfrastructureData {
    try {
      let template: any;
      
      // Try to parse as YAML first, then JSON
      try {
        template = yaml.load(content);
      } catch (yamlError) {
        try {
          template = JSON.parse(content);
        } catch (jsonError) {
          throw new Error('Invalid CloudFormation template format (not valid JSON or YAML)');
        }
      }

      const resources: InfrastructureResource[] = [];
      const parameters = template.Parameters || {};
      const outputs = template.Outputs || {};

      if (template.Resources) {
        for (const [resourceName, resourceData] of Object.entries(template.Resources as Record<string, any>)) {
          const resource: InfrastructureResource = {
            type: resourceData.Type,
            name: resourceName,
            properties: resourceData.Properties || {},
            metadata: {
              dependsOn: resourceData.DependsOn,
              condition: resourceData.Condition,
              deletionPolicy: resourceData.DeletionPolicy,
              updateReplacePolicy: resourceData.UpdateReplacePolicy,
            },
            dependencies: Array.isArray(resourceData.DependsOn) 
              ? resourceData.DependsOn 
              : resourceData.DependsOn 
                ? [resourceData.DependsOn] 
                : [],
            location: {
              file: fileName,
              block: resourceName,
            },
          };

          // Extract tags if present
          if (resourceData.Properties?.Tags) {
            resource.tags = {};
            if (Array.isArray(resourceData.Properties.Tags)) {
              for (const tag of resourceData.Properties.Tags) {
                if (tag.Key && tag.Value) {
                  resource.tags[tag.Key] = tag.Value;
                }
              }
            }
          }

          resources.push(resource);
        }
      }

      return {
        resources,
        metadata: {
          fileName,
          fileType: 'CloudFormation',
          analysisType: 'CLOUDFORMATION',
          resourceCount: resources.length,
          parameters,
          outputs,
        },
      };
    } catch (error) {
      console.error('Error parsing CloudFormation template:', error);
      throw new Error(`Invalid CloudFormation template format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseTerraform(content: string, fileName: string): InfrastructureData {
    const resources: InfrastructureResource[] = [];
    const variables: Record<string, any> = {};
    
    try {
      // Extract variables
      const variableMatches = content.matchAll(/variable\s+"([^"]+)"\s*{([^}]*)}/gs);
      for (const match of variableMatches) {
        const [, varName, varBody] = match;
        variables[varName] = this.parseHCLBlock(varBody);
      }

      // Extract resources with improved parsing
      const resourceMatches = content.matchAll(/resource\s+"([^"]+)"\s+"([^"]+)"\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/gs);
      
      for (const match of resourceMatches) {
        const [fullMatch, resourceType, resourceName, resourceBody] = match;
        
        const properties = this.parseHCLBlock(resourceBody);
        
        // Extract dependencies from resource body
        const dependencies: string[] = [];
        const dependsOnMatch = resourceBody.match(/depends_on\s*=\s*\[([^\]]*)\]/);
        if (dependsOnMatch) {
          const depsList = dependsOnMatch[1];
          const depMatches = depsList.matchAll(/"?([^",\s]+)"?/g);
          for (const depMatch of depMatches) {
            dependencies.push(depMatch[1]);
          }
        }

        // Extract references to other resources
        const refMatches = resourceBody.matchAll(/(?:aws_\w+\.)?(\w+)\.(\w+)/g);
        for (const refMatch of refMatches) {
          const [, refType, refName] = refMatch;
          if (refType !== resourceName) {
            dependencies.push(`${refType}.${refName}`);
          }
        }

        // Extract tags
        const tags: Record<string, string> = {};
        const tagsMatch = resourceBody.match(/tags\s*=\s*{([^}]*)}/s);
        if (tagsMatch) {
          const tagsBody = tagsMatch[1];
          const tagMatches = tagsBody.matchAll(/(\w+)\s*=\s*"([^"]*)"/g);
          for (const tagMatch of tagMatches) {
            tags[tagMatch[1]] = tagMatch[2];
          }
        }

        const resource: InfrastructureResource = {
          type: resourceType,
          name: `${resourceType}.${resourceName}`,
          properties,
          metadata: {
            terraformName: resourceName,
            terraformType: resourceType,
          },
          dependencies: [...new Set(dependencies)], // Remove duplicates
          tags,
          location: {
            file: fileName,
            block: `${resourceType}.${resourceName}`,
          },
        };

        resources.push(resource);
      }

      return {
        resources,
        metadata: {
          fileName,
          fileType: 'Terraform',
          analysisType: 'TERRAFORM',
          resourceCount: resources.length,
          variables,
        },
      };
    } catch (error) {
      console.error('Error parsing Terraform file:', error);
      throw new Error(`Invalid Terraform file format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse HCL block content into key-value pairs
   */
  private parseHCLBlock(content: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Remove comments
    content = content.replace(/#.*$/gm, '').replace(/\/\/.*$/gm, '');
    
    // Parse simple key-value pairs
    const kvMatches = content.matchAll(/(\w+)\s*=\s*([^=\n]+)/g);
    for (const match of kvMatches) {
      const [, key, value] = match;
      result[key] = this.parseHCLValue(value.trim());
    }
    
    // Parse nested blocks
    const blockMatches = content.matchAll(/(\w+)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/gs);
    for (const match of blockMatches) {
      const [, key, blockContent] = match;
      result[key] = this.parseHCLBlock(blockContent);
    }
    
    return result;
  }

  /**
   * Parse HCL value (string, number, boolean, list, etc.)
   */
  private parseHCLValue(value: string): any {
    value = value.trim();
    
    // Remove trailing comma or newline
    value = value.replace(/[,\n\r]+$/, '');
    
    // String values
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    
    // Boolean values
    if (value === 'true' || value === 'false') {
      return value === 'true';
    }
    
    // Number values
    if (/^\d+\.?\d*$/.test(value)) {
      return value.includes('.') ? parseFloat(value) : parseInt(value, 10);
    }
    
    // List values
    if (value.startsWith('[') && value.endsWith(']')) {
      const listContent = value.slice(1, -1).trim();
      if (!listContent) return [];
      
      const items = listContent.split(',').map(item => this.parseHCLValue(item.trim()));
      return items;
    }
    
    // Object values (simplified)
    if (value.startsWith('{') && value.endsWith('}')) {
      return this.parseHCLBlock(value.slice(1, -1));
    }
    
    // Variable or function references
    return value;
  }

  private parseCDK(content: string, fileName: string): InfrastructureData {
    const resources: InfrastructureResource[] = [];
    
    try {
      // Extract imports to understand CDK version and constructs
      const imports = this.extractCDKImports(content);
      
      // Extract AWS construct instantiations
      const constructMatches = content.matchAll(/new\s+([\w.]+)\s*\(\s*([^,)]+),?\s*([^,)]*),?\s*({[^}]*}|\([^)]*\))?/g);
      
      for (const match of constructMatches) {
        const [fullMatch, constructType, scope, id, propsMatch] = match;
        
        // Skip if it's not an AWS construct
        if (!this.isAWSConstruct(constructType, imports)) {
          continue;
        }

        const props = propsMatch ? this.parseCDKProps(propsMatch) : {};
        
        // Extract resource type from construct
        const resourceType = this.mapCDKConstructToResourceType(constructType);
        
        // Extract dependencies by looking for references
        const dependencies: string[] = [];
        const refMatches = propsMatch?.matchAll(/(\w+)\.(\w+)/g) || [];
        for (const refMatch of refMatches) {
          const [, refVar, refProp] = refMatch;
          if (refVar !== 'this' && refVar !== 'props') {
            dependencies.push(refVar);
          }
        }

        // Extract tags from props
        const tags: Record<string, string> = {};
        if (props.tags) {
          if (typeof props.tags === 'object') {
            Object.assign(tags, props.tags);
          }
        }

        const resource: InfrastructureResource = {
          type: resourceType,
          name: id?.replace(/['"]/g, '') || constructType,
          properties: props,
          metadata: {
            cdkConstruct: constructType,
            cdkVersion: this.detectCDKVersion(imports),
          },
          dependencies,
          tags,
          location: {
            file: fileName,
            block: constructType,
          },
        };

        resources.push(resource);
      }

      return {
        resources,
        metadata: {
          fileName,
          fileType: 'CDK',
          analysisType: 'CDK',
          resourceCount: resources.length,
        },
      };
    } catch (error) {
      console.error('Error parsing CDK file:', error);
      // Return partial results instead of throwing
      return {
        resources,
        metadata: {
          fileName,
          fileType: 'CDK',
          analysisType: 'CDK',
          resourceCount: resources.length,
        },
      };
    }
  }

  /**
   * Extract CDK imports from file content
   */
  private extractCDKImports(content: string): Record<string, string> {
    const imports: Record<string, string> = {};
    
    // Match import statements
    const importMatches = content.matchAll(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g);
    
    for (const match of importMatches) {
      const [, namedImports, namespaceImport, defaultImport, moduleName] = match;
      
      if (moduleName.includes('@aws-cdk/') || moduleName.includes('aws-cdk-lib')) {
        if (namedImports) {
          // Handle named imports like { Bucket, BucketProps }
          const names = namedImports.split(',').map(name => name.trim());
          for (const name of names) {
            imports[name] = moduleName;
          }
        } else if (namespaceImport) {
          // Handle namespace imports like * as s3
          imports[namespaceImport] = moduleName;
        } else if (defaultImport) {
          // Handle default imports
          imports[defaultImport] = moduleName;
        }
      }
    }
    
    return imports;
  }

  /**
   * Check if a construct type is an AWS construct
   */
  private isAWSConstruct(constructType: string, imports: Record<string, string>): boolean {
    // Direct AWS construct names
    const awsConstructs = [
      'Bucket', 'Function', 'Table', 'Queue', 'Topic', 'RestApi', 'Distribution',
      'LoadBalancer', 'AutoScalingGroup', 'Instance', 'Vpc', 'Subnet', 'SecurityGroup',
      'Role', 'Policy', 'User', 'Group', 'Pipeline', 'Repository', 'Cluster',
    ];
    
    // Check if it's a known AWS construct
    if (awsConstructs.some(construct => constructType.includes(construct))) {
      return true;
    }
    
    // Check if it's imported from an AWS CDK module
    const baseName = constructType.split('.').pop() || constructType;
    return imports[baseName]?.includes('@aws-cdk/') || imports[baseName]?.includes('aws-cdk-lib') || false;
  }

  /**
   * Map CDK construct to CloudFormation resource type
   */
  private mapCDKConstructToResourceType(constructType: string): string {
    const mapping: Record<string, string> = {
      'Bucket': 'AWS::S3::Bucket',
      'Function': 'AWS::Lambda::Function',
      'Table': 'AWS::DynamoDB::Table',
      'Queue': 'AWS::SQS::Queue',
      'Topic': 'AWS::SNS::Topic',
      'RestApi': 'AWS::ApiGateway::RestApi',
      'Distribution': 'AWS::CloudFront::Distribution',
      'LoadBalancer': 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      'AutoScalingGroup': 'AWS::AutoScaling::AutoScalingGroup',
      'Instance': 'AWS::EC2::Instance',
      'Vpc': 'AWS::EC2::VPC',
      'Subnet': 'AWS::EC2::Subnet',
      'SecurityGroup': 'AWS::EC2::SecurityGroup',
      'Role': 'AWS::IAM::Role',
      'Policy': 'AWS::IAM::Policy',
      'User': 'AWS::IAM::User',
      'Group': 'AWS::IAM::Group',
      'Pipeline': 'AWS::CodePipeline::Pipeline',
      'Repository': 'AWS::CodeCommit::Repository',
      'Cluster': 'AWS::ECS::Cluster',
    };
    
    const baseName = constructType.split('.').pop() || constructType;
    return mapping[baseName] || `CDK::${constructType}`;
  }

  /**
   * Parse CDK props object (simplified)
   */
  private parseCDKProps(propsString: string): Record<string, any> {
    const props: Record<string, any> = {};
    
    // Remove outer braces or parentheses
    let content = propsString.trim();
    if ((content.startsWith('{') && content.endsWith('}')) || 
        (content.startsWith('(') && content.endsWith(')'))) {
      content = content.slice(1, -1);
    }
    
    // Simple key-value extraction (would need proper AST parsing for complex cases)
    const propMatches = content.matchAll(/(\w+):\s*([^,}]+)/g);
    
    for (const match of propMatches) {
      const [, key, value] = match;
      props[key] = value.trim();
    }
    
    return props;
  }

  /**
   * Detect CDK version from imports
   */
  private detectCDKVersion(imports: Record<string, string>): string {
    for (const moduleName of Object.values(imports)) {
      if (moduleName.includes('aws-cdk-lib')) {
        return 'v2';
      } else if (moduleName.includes('@aws-cdk/')) {
        return 'v1';
      }
    }
    return 'unknown';
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

  /**
   * Process ZIP file and extract infrastructure files
   */
  private async processZipFile(
    zipData: any, 
    fileName: string, 
    analysisType: string
  ): Promise<InfrastructureData> {
    try {
      // Convert stream to buffer
      const zipBuffer = await this.streamToBuffer(zipData);
      
      // Create ZIP reader
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();
      
      // Security checks
      this.validateZipFile(zipEntries, fileName);
      
      const allResources: InfrastructureResource[] = [];
      const processedFiles: string[] = [];
      let totalResourceCount = 0;
      
      // Process each file in the ZIP
      for (const entry of zipEntries) {
        // Skip directories and hidden files
        if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('__MACOSX')) {
          continue;
        }
        
        // Check if it's a valid infrastructure file
        if (!this.isValidInfrastructureFile(entry.entryName)) {
          continue;
        }
        
        try {
          const fileContent = entry.getData().toString('utf8');
          const detectedType = this.detectFileFormat(entry.entryName, fileContent, analysisType);
          
          let fileData: InfrastructureData;
          
          // Parse based on detected type
          switch (detectedType) {
            case 'CLOUDFORMATION':
              fileData = this.parseCloudFormation(fileContent, entry.entryName);
              break;
            case 'TERRAFORM':
              fileData = this.parseTerraform(fileContent, entry.entryName);
              break;
            case 'CDK':
              fileData = this.parseCDK(fileContent, entry.entryName);
              break;
            default:
              continue; // Skip unsupported files
          }
          
          // Update resource locations to include ZIP context
          fileData.resources.forEach(resource => {
            resource.location = {
              ...resource.location,
              file: `${fileName}/${entry.entryName}`,
              zipEntry: entry.entryName,
            };
          });
          
          allResources.push(...fileData.resources);
          processedFiles.push(entry.entryName);
          totalResourceCount += fileData.resources.length;
          
        } catch (fileError) {
          console.warn(`Error processing file ${entry.entryName} in ZIP:`, fileError);
          // Continue processing other files
        }
      }
      
      if (allResources.length === 0) {
        throw new Error('No valid infrastructure files found in ZIP archive');
      }
      
      return {
        resources: allResources,
        metadata: {
          fileName,
          fileType: 'ZIP Archive',
          analysisType: 'ZIP',
          resourceCount: totalResourceCount,
          zipContents: {
            totalFiles: processedFiles.length,
            processedFiles,
          },
        },
      };
      
    } catch (error) {
      console.error('Error processing ZIP file:', error);
      throw new Error(`Failed to process ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    if (Buffer.isBuffer(stream)) {
      return stream;
    }
    
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    return Buffer.from(buffer);
  }
  
  /**
   * Validate ZIP file for security
   */
  private validateZipFile(entries: AdmZip.IZipEntry[], fileName: string): void {
    const maxEntries = 100; // Limit number of entries
    const maxEntrySize = 50 * 1024 * 1024; // 50MB per entry
    const maxTotalSize = 100 * 1024 * 1024; // 100MB total uncompressed
    
    if (entries.length > maxEntries) {
      throw new Error(`ZIP file contains too many entries (${entries.length} > ${maxEntries})`);
    }
    
    let totalUncompressedSize = 0;
    
    for (const entry of entries) {
      // Check for directory traversal attacks
      if (entry.entryName.includes('..') || entry.entryName.startsWith('/')) {
        throw new Error(`Suspicious file path detected: ${entry.entryName}`);
      }
      
      // Check individual file size
      if (entry.header.size > maxEntrySize) {
        throw new Error(`File ${entry.entryName} is too large (${entry.header.size} bytes)`);
      }
      
      totalUncompressedSize += entry.header.size;
    }
    
    // Check total uncompressed size
    if (totalUncompressedSize > maxTotalSize) {
      throw new Error(`ZIP archive too large when uncompressed (${totalUncompressedSize} bytes)`);
    }
  }
  
  /**
   * Check if file is a valid infrastructure file
   */
  private isValidInfrastructureFile(fileName: string): boolean {
    const validExtensions = [
      '.yaml', '.yml', '.json',  // CloudFormation
      '.tf', '.tfvars',          // Terraform
      '.ts', '.js', '.py',       // CDK
    ];
    
    const extension = '.' + fileName.split('.').pop()?.toLowerCase();
    return validExtensions.includes(extension);
  }
}