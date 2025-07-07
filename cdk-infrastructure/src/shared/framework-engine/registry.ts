/**
 * Framework Registry - Central management of analysis frameworks
 */

import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { 
  Framework, 
  FrameworkType, 
  FrameworkStatus, 
  Rule, 
  TenantFrameworkConfig,
  FrameworkSettings 
} from './types';
import { RuleTemplates } from './rule-templates';

export class FrameworkRegistry {
  private readonly dynamodb: DynamoDBDocumentClient;
  private readonly logger: Logger;
  private readonly frameworkTable: string;
  private readonly ruleTable: string;
  private readonly tenantConfigTable: string;

  constructor(logger: Logger) {
    this.dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.logger = logger;
    this.frameworkTable = process.env.FRAMEWORK_REGISTRY_TABLE!;
    this.ruleTable = process.env.RULE_DEFINITIONS_TABLE!;
    this.tenantConfigTable = process.env.TENANT_FRAMEWORK_CONFIG_TABLE!;
  }

  /**
   * Get all available frameworks with optional filtering
   */
  async listFrameworks(options: {
    type?: FrameworkType;
    status?: FrameworkStatus;
    limit?: number;
    nextToken?: string;
  } = {}): Promise<{ frameworks: Framework[], nextToken?: string }> {
    try {
      this.logger.info('Listing frameworks', { options });

      const scanParams: any = {
        TableName: this.frameworkTable,
        FilterExpression: '#status = :activeStatus',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':activeStatus': options.status || FrameworkStatus.ACTIVE,
        },
        Limit: options.limit || 50,
      };

      if (options.type) {
        scanParams.FilterExpression += ' AND #type = :type';
        scanParams.ExpressionAttributeNames['#type'] = 'type';
        scanParams.ExpressionAttributeValues[':type'] = options.type;
      }

      if (options.nextToken) {
        scanParams.ExclusiveStartKey = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
      }

      const result = await this.dynamodb.send(new ScanCommand(scanParams));

      const frameworks = (result.Items || []).map(item => this.mapItemToFramework(item));

      const nextToken = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      return { frameworks, nextToken };
    } catch (error) {
      this.logger.error('Failed to list frameworks', { error });
      throw new Error('Failed to list frameworks');
    }
  }

  /**
   * Get a specific framework by ID
   */
  async getFramework(frameworkId: string): Promise<Framework | null> {
    try {
      this.logger.info('Getting framework', { frameworkId });

      const result = await this.dynamodb.send(new GetCommand({
        TableName: this.frameworkTable,
        Key: {
          pk: `FRAMEWORK#${frameworkId}`,
          sk: '#METADATA',
        },
      }));

      return result.Item ? this.mapItemToFramework(result.Item) : null;
    } catch (error) {
      this.logger.error('Failed to get framework', { frameworkId, error });
      throw new Error(`Failed to get framework: ${frameworkId}`);
    }
  }

  /**
   * Get framework rules with optional filtering
   */
  async getFrameworkRules(frameworkId: string, options: {
    category?: string;
    severity?: string;
    limit?: number;
    nextToken?: string;
  } = {}): Promise<{ rules: Rule[], nextToken?: string }> {
    try {
      this.logger.info('Getting framework rules', { frameworkId, options });

      const queryParams: any = {
        TableName: this.ruleTable,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `FRAMEWORK#${frameworkId}`,
          ':sk': 'RULE#',
        },
        Limit: options.limit || 100,
      };

      if (options.category || options.severity) {
        const filterExpressions = [];
        if (options.category) {
          filterExpressions.push('#category = :category');
          queryParams.ExpressionAttributeNames = { '#category': 'category' };
          queryParams.ExpressionAttributeValues[':category'] = options.category;
        }
        if (options.severity) {
          filterExpressions.push('#severity = :severity');
          if (!queryParams.ExpressionAttributeNames) queryParams.ExpressionAttributeNames = {};
          queryParams.ExpressionAttributeNames['#severity'] = 'severity';
          queryParams.ExpressionAttributeValues[':severity'] = options.severity;
        }
        queryParams.FilterExpression = filterExpressions.join(' AND ');
      }

      if (options.nextToken) {
        queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(options.nextToken, 'base64').toString());
      }

      const result = await this.dynamodb.send(new QueryCommand(queryParams));

      const rules = (result.Items || []).map(item => this.mapItemToRule(item));

      const nextToken = result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      return { rules, nextToken };
    } catch (error) {
      this.logger.error('Failed to get framework rules', { frameworkId, error });
      throw new Error(`Failed to get framework rules: ${frameworkId}`);
    }
  }

  /**
   * Get tenant framework configuration
   */
  async getTenantFrameworkConfig(tenantId: string, frameworkId: string): Promise<TenantFrameworkConfig | null> {
    try {
      this.logger.info('Getting tenant framework config', { tenantId, frameworkId });

      const result = await this.dynamodb.send(new GetCommand({
        TableName: this.tenantConfigTable,
        Key: {
          pk: `TENANT#${tenantId}`,
          sk: `FRAMEWORK#${frameworkId}`,
        },
      }));

      return result.Item ? this.mapItemToTenantFrameworkConfig(result.Item) : null;
    } catch (error) {
      this.logger.error('Failed to get tenant framework config', { tenantId, frameworkId, error });
      throw new Error(`Failed to get tenant framework config: ${tenantId}/${frameworkId}`);
    }
  }

  /**
   * Create or update tenant framework configuration
   */
  async saveTenantFrameworkConfig(config: TenantFrameworkConfig): Promise<TenantFrameworkConfig> {
    try {
      this.logger.info('Saving tenant framework config', { 
        tenantId: config.tenantId, 
        frameworkId: config.frameworkId 
      });

      const item = {
        pk: `TENANT#${config.tenantId}`,
        sk: `FRAMEWORK#${config.frameworkId}`,
        tenantId: config.tenantId,
        frameworkId: config.frameworkId,
        name: config.name,
        description: config.description,
        isDefault: config.isDefault,
        enabledRules: config.enabledRules,
        customRules: config.customRules,
        ruleOverrides: config.ruleOverrides,
        settings: config.settings,
        createdAt: config.createdAt,
        updatedAt: new Date().toISOString(),
      };

      await this.dynamodb.send(new PutCommand({
        TableName: this.tenantConfigTable,
        Item: item,
      }));

      return this.mapItemToTenantFrameworkConfig(item);
    } catch (error) {
      this.logger.error('Failed to save tenant framework config', { config, error });
      throw new Error('Failed to save tenant framework config');
    }
  }

  /**
   * Get default frameworks for a tenant
   */
  async getDefaultFrameworksForTenant(tenantId: string): Promise<Framework[]> {
    try {
      this.logger.info('Getting default frameworks for tenant', { tenantId });

      // Query tenant framework configs that are marked as default
      const result = await this.dynamodb.send(new QueryCommand({
        TableName: this.tenantConfigTable,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: 'isDefault = :isDefault',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':isDefault': true,
        },
      }));

      const frameworkIds = (result.Items || []).map(item => item.frameworkId);

      // Get the actual framework definitions
      const frameworks: Framework[] = [];
      for (const frameworkId of frameworkIds) {
        const framework = await this.getFramework(frameworkId);
        if (framework) {
          frameworks.push(framework);
        }
      }

      return frameworks;
    } catch (error) {
      this.logger.error('Failed to get default frameworks for tenant', { tenantId, error });
      throw new Error(`Failed to get default frameworks for tenant: ${tenantId}`);
    }
  }

  /**
   * Initialize default frameworks
   */
  async initializeDefaultFrameworks(): Promise<void> {
    try {
      this.logger.info('Initializing default frameworks');

      const defaultFrameworks = this.getBuiltInFrameworks();

      for (const framework of defaultFrameworks) {
        await this.saveFramework(framework);
        
        // Get rules for each framework from templates
        const rules = this.getFrameworkRulesFromTemplates(framework.id);
        
        // Save rules for each framework
        for (const rule of rules) {
          await this.saveRule(framework.id, rule);
        }

        this.logger.info('Framework initialized', { 
          frameworkId: framework.id, 
          rulesCount: rules.length 
        });
      }

      this.logger.info('Default frameworks initialized successfully', {
        frameworksCount: defaultFrameworks.length
      });
    } catch (error) {
      this.logger.error('Failed to initialize default frameworks', { error });
      throw new Error('Failed to initialize default frameworks');
    }
  }

  private async saveFramework(framework: Framework): Promise<void> {
    const item = {
      pk: `FRAMEWORK#${framework.id}`,
      sk: '#METADATA',
      id: framework.id,
      type: framework.type,
      name: framework.name,
      description: framework.description,
      version: framework.version,
      status: framework.status,
      categories: framework.categories,
      metadata: framework.metadata,
      createdAt: framework.createdAt,
      updatedAt: framework.updatedAt,
    };

    await this.dynamodb.send(new PutCommand({
      TableName: this.frameworkTable,
      Item: item,
    }));
  }

  private async saveRule(frameworkId: string, rule: Rule): Promise<void> {
    const item = {
      pk: `FRAMEWORK#${frameworkId}`,
      sk: `RULE#${rule.ruleId}`,
      id: rule.id,
      frameworkId: rule.frameworkId,
      ruleId: rule.ruleId,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      pillar: rule.pillar,
      category: rule.category,
      tags: rule.tags,
      implementation: rule.implementation,
      conditions: rule.conditions,
      parameters: rule.parameters,
      remediation: rule.remediation,
    };

    await this.dynamodb.send(new PutCommand({
      TableName: this.ruleTable,
      Item: item,
    }));
  }

  private getBuiltInFrameworks(): Framework[] {
    const now = new Date().toISOString();
    
    return [
      {
        id: 'aws-well-architected-framework',
        type: FrameworkType.WA_FRAMEWORK,
        name: 'AWS Well-Architected Framework',
        description: 'AWS Well-Architected Framework helps you understand the pros and cons of decisions you make while building systems on AWS.',
        version: '2024.1',
        status: FrameworkStatus.ACTIVE,
        rules: [], // Will be populated separately
        categories: ['Security', 'Reliability', 'Performance Efficiency', 'Cost Optimization', 'Operational Excellence', 'Sustainability'],
        metadata: {
          source: 'aws',
          pillars: ['operational_excellence', 'security', 'reliability', 'performance_efficiency', 'cost_optimization', 'sustainability'],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'aws-security-hub-cspm',
        type: FrameworkType.CSPM,
        name: 'AWS Security Hub CSPM',
        description: 'Cloud Security Posture Management checks based on AWS Security Hub standards.',
        version: '1.0',
        status: FrameworkStatus.ACTIVE,
        rules: [], // Will be populated separately
        categories: ['Security', 'Compliance', 'Data Protection', 'Access Control'],
        metadata: {
          source: 'aws',
          standards: ['aws-foundational-security-standard', 'cis-aws-foundations', 'pci-dss'],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'aws-service-delivery-practices',
        type: FrameworkType.SDP,
        name: 'AWS Service Delivery Practices',
        description: 'Best practices for AWS service delivery and operational excellence.',
        version: '1.0',
        status: FrameworkStatus.ACTIVE,
        rules: [], // Will be populated separately
        categories: ['Service Delivery', 'Operations', 'Monitoring', 'Automation'],
        metadata: {
          source: 'aws',
          focus: 'service_delivery',
        },
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private getFrameworkRulesFromTemplates(frameworkId: string): Rule[] {
    switch (frameworkId) {
      case 'aws-well-architected-framework':
        return RuleTemplates.getWellArchitectedRules();
      
      case 'aws-security-hub-cspm':
        return RuleTemplates.getSecurityHubRules();
      
      case 'aws-service-delivery-practices':
        return RuleTemplates.getServiceDeliveryRules();
      
      default:
        this.logger.warn('No rules template found for framework', { frameworkId });
        return [];
    }
  }

  private mapItemToFramework(item: any): Framework {
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      description: item.description,
      version: item.version,
      status: item.status,
      rules: [], // Rules are loaded separately
      categories: item.categories || [],
      metadata: item.metadata || {},
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private mapItemToRule(item: any): Rule {
    return {
      id: item.id,
      frameworkId: item.frameworkId,
      ruleId: item.ruleId,
      name: item.name,
      description: item.description,
      severity: item.severity,
      pillar: item.pillar,
      category: item.category,
      tags: item.tags || [],
      implementation: item.implementation,
      conditions: item.conditions,
      parameters: item.parameters,
      remediation: item.remediation,
    };
  }

  private mapItemToTenantFrameworkConfig(item: any): TenantFrameworkConfig {
    return {
      tenantId: item.tenantId,
      frameworkId: item.frameworkId,
      name: item.name,
      description: item.description,
      isDefault: item.isDefault,
      enabledRules: item.enabledRules || [],
      customRules: item.customRules || [],
      ruleOverrides: item.ruleOverrides || {},
      settings: item.settings || {
        strictMode: false,
        includeInformational: true,
        customSeverityLevels: {},
        notificationSettings: {},
      },
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}