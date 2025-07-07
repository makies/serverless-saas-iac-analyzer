/**
 * DynamoDB Utilities
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
export const ddbClient = new DynamoDBClient({});
export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export interface PaginationOptions {
  limit?: number;
  nextToken?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
  count: number;
}

/**
 * Get item by primary key
 */
export async function getItem<T>(
  tableName: string, 
  key: Record<string, any>,
  consistentRead: boolean = false
): Promise<T | null> {
  const command = new GetCommand({
    TableName: tableName,
    Key: key,
    ConsistentRead: consistentRead,
  });

  const result = await ddbDocClient.send(command);
  return result.Item as T || null;
}

/**
 * Put item with condition
 */
export async function putItem<T extends Record<string, any>>(
  tableName: string,
  item: T,
  condition?: string,
  expressionAttributeNames?: Record<string, string>,
  expressionAttributeValues?: Record<string, any>
): Promise<void> {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
    ConditionExpression: condition,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await ddbDocClient.send(command);
}

/**
 * Update item with atomic operations
 */
export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeNames?: Record<string, string>,
  expressionAttributeValues?: Record<string, any>,
  conditionExpression?: string
): Promise<any> {
  const command = new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ConditionExpression: conditionExpression,
    ReturnValues: 'ALL_NEW',
  });

  const result = await ddbDocClient.send(command);
  return result.Attributes;
}

/**
 * Delete item with condition
 */
export async function deleteItem(
  tableName: string,
  key: Record<string, any>,
  conditionExpression?: string,
  expressionAttributeNames?: Record<string, string>,
  expressionAttributeValues?: Record<string, any>
): Promise<void> {
  const command = new DeleteCommand({
    TableName: tableName,
    Key: key,
    ConditionExpression: conditionExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  });

  await ddbDocClient.send(command);
}

/**
 * Query items with pagination
 */
export async function queryItems<T>(
  tableName: string,
  keyConditionExpression: string,
  options: {
    indexName?: string;
    filterExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
    scanIndexForward?: boolean;
    pagination?: PaginationOptions;
  } = {}
): Promise<PaginatedResult<T>> {
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: options.indexName,
    KeyConditionExpression: keyConditionExpression,
    FilterExpression: options.filterExpression,
    ExpressionAttributeNames: options.expressionAttributeNames,
    ExpressionAttributeValues: options.expressionAttributeValues,
    ScanIndexForward: options.scanIndexForward,
    Limit: options.pagination?.limit,
    ExclusiveStartKey: options.pagination?.nextToken ? 
      JSON.parse(Buffer.from(options.pagination.nextToken, 'base64').toString()) : 
      undefined,
  });

  const result = await ddbDocClient.send(command);

  return {
    items: result.Items as T[],
    nextToken: result.LastEvaluatedKey ? 
      Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : 
      undefined,
    count: result.Count || 0,
  };
}

/**
 * Scan items with pagination (use sparingly)
 */
export async function scanItems<T>(
  tableName: string,
  options: {
    indexName?: string;
    filterExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
    pagination?: PaginationOptions;
  } = {}
): Promise<PaginatedResult<T>> {
  const command = new ScanCommand({
    TableName: tableName,
    IndexName: options.indexName,
    FilterExpression: options.filterExpression,
    ExpressionAttributeNames: options.expressionAttributeNames,
    ExpressionAttributeValues: options.expressionAttributeValues,
    Limit: options.pagination?.limit,
    ExclusiveStartKey: options.pagination?.nextToken ? 
      JSON.parse(Buffer.from(options.pagination.nextToken, 'base64').toString()) : 
      undefined,
  });

  const result = await ddbDocClient.send(command);

  return {
    items: result.Items as T[],
    nextToken: result.LastEvaluatedKey ? 
      Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : 
      undefined,
    count: result.Count || 0,
  };
}

/**
 * Generate timestamps for DynamoDB items
 */
export function generateTimestamps() {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update timestamp for existing items
 */
export function updateTimestamp() {
  return {
    updatedAt: new Date().toISOString(),
  };
}