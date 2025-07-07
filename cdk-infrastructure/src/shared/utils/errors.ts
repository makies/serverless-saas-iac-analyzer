/**
 * Error Handling Utilities
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT_ERROR', 409, details);
    this.name = 'ConflictError';
  }
}

export class QuotaExceededError extends AppError {
  constructor(quotaType: string, limit: number) {
    super(`Quota exceeded for ${quotaType}. Limit: ${limit}`, 'QUOTA_EXCEEDED', 429);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Handle and format errors for GraphQL responses
 */
export function handleError(error: any, logger: any, context: any = {}): never {
  logger.error('Function error', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
    ...context,
  });

  if (error instanceof AppError) {
    throw error;
  }

  // DynamoDB specific errors
  if (error.name === 'ConditionalCheckFailedException') {
    throw new ConflictError('Resource conflict or version mismatch');
  }

  if (error.name === 'ResourceNotFoundException') {
    throw new NotFoundError('Resource');
  }

  if (error.name === 'ValidationException') {
    throw new ValidationError(error.message);
  }

  // Generic internal error
  throw new AppError('Internal server error', 'INTERNAL_ERROR', 500);
}

/**
 * Validate required fields
 */
export function validateRequired(fields: Record<string, any>, fieldNames: string[]): void {
  const missing = fieldNames.filter(field => {
    const value = fields[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}