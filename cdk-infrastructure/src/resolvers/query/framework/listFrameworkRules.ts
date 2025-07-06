/**
 * List Framework Rules Query Resolver
 * Returns rules for a specific framework with optional filtering
 */

import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import middy from '@middy/core';
import { RuleDefinitionItem } from '../../../../lib/config/multi-framework-types';

// Initialize PowerTools
const logger = new Logger({ serviceName: 'FrameworkService' });
const tracer = new Tracer({ serviceName: 'FrameworkService' });

// Initialize DynamoDB
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

interface ListFrameworkRulesArgs {
  frameworkId: string;
  pillar?: string;
  severity?: string;
  category?: string;
  limit?: number;
  nextToken?: string;
}

interface ListFrameworkRulesResult {
  items: RuleDefinitionItem[];
  nextToken?: string;
}

const listFrameworkRules: AppSyncResolverHandler<
  ListFrameworkRulesArgs,
  ListFrameworkRulesResult
> = async (event) => {
  const { arguments: args, identity } = event;
  const { frameworkId, pillar, severity, category, limit = 50, nextToken } = args;

  logger.info('ListFrameworkRules query started', {
    userId: (identity as any)?.sub,
    arguments: args,
  });

  try {
    let queryParams: any;

    if (pillar && severity) {
      // Query by framework, pillar, and severity using GSI
      queryParams = {
        TableName: process.env.RULE_DEFINITIONS_TABLE!,
        IndexName: 'ByFramework',
        KeyConditionExpression: 'GSI1PK = :frameworkPK AND GSI1SK = :pillarSeverity',
        ExpressionAttributeValues: {
          ':frameworkPK': `FRAMEWORK#${frameworkId}`,
          ':pillarSeverity': `PILLAR#${pillar}#SEVERITY#${severity}`,
        },
        Limit: limit,
        ScanIndexForward: true,
      };
    } else if (pillar) {
      // Query by framework and pillar using GSI
      queryParams = {
        TableName: process.env.RULE_DEFINITIONS_TABLE!,
        IndexName: 'ByFramework',
        KeyConditionExpression: 'GSI1PK = :frameworkPK AND begins_with(GSI1SK, :pillarPrefix)',
        ExpressionAttributeValues: {
          ':frameworkPK': `FRAMEWORK#${frameworkId}`,
          ':pillarPrefix': `PILLAR#${pillar}#`,
        },
        Limit: limit,
        ScanIndexForward: true,
      };
    } else {
      // Query by framework only using GSI
      queryParams = {
        TableName: process.env.RULE_DEFINITIONS_TABLE!,
        IndexName: 'ByFramework',
        KeyConditionExpression: 'GSI1PK = :frameworkPK',
        ExpressionAttributeValues: {
          ':frameworkPK': `FRAMEWORK#${frameworkId}`,
        },
        Limit: limit,
        ScanIndexForward: true,
      };
    }

    // Add category filter if specified
    if (category) {
      queryParams.FilterExpression = 'category = :category';
      if (!queryParams.ExpressionAttributeValues) {
        queryParams.ExpressionAttributeValues = {};
      }
      queryParams.ExpressionAttributeValues[':category'] = category;
    }

    // Add pagination
    if (nextToken) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const command = new QueryCommand(queryParams);
    const result = await ddbDocClient.send(command);

    const items = (result.Items || []) as RuleDefinitionItem[];

    // Create next token if there are more items
    const responseNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    logger.info('ListFrameworkRules query completed', {
      frameworkId,
      itemCount: items.length,
      hasNextToken: !!responseNextToken,
    });

    return {
      items,
      nextToken: responseNextToken,
    };
  } catch (error) {
    logger.error('Error listing framework rules', { error, frameworkId });
    throw new Error('Failed to list framework rules');
  }
};

// Export the handler with middleware
export const handler = middy(listFrameworkRules)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer));
