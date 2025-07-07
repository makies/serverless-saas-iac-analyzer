import { message } from 'antd';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export class ErrorHandler {
  static handle(error: any, context?: string): AppError {
    const timestamp = new Date();
    let appError: AppError;

    // GraphQL errors
    if (error.errors && Array.isArray(error.errors)) {
      const firstError = error.errors[0];
      appError = {
        code: firstError.extensions?.code || 'GRAPHQL_ERROR',
        message: firstError.message || 'GraphQLエラーが発生しました',
        details: error.errors,
        timestamp
      };
    }
    // Network errors
    else if (error.networkError) {
      appError = {
        code: 'NETWORK_ERROR',
        message: 'ネットワークエラーが発生しました。接続を確認してください。',
        details: error.networkError,
        timestamp
      };
    }
    // Authentication errors
    else if (error.name === 'AuthError' || error.code?.includes('Auth')) {
      appError = {
        code: 'AUTH_ERROR',
        message: '認証エラーが発生しました。再度ログインしてください。',
        details: error,
        timestamp
      };
    }
    // Validation errors
    else if (error.name === 'ValidationError') {
      appError = {
        code: 'VALIDATION_ERROR',
        message: '入力データに問題があります。',
        details: error,
        timestamp
      };
    }
    // Permission errors
    else if (error.code === 'FORBIDDEN' || error.status === 403) {
      appError = {
        code: 'PERMISSION_ERROR',
        message: 'この操作を実行する権限がありません。',
        details: error,
        timestamp
      };
    }
    // Generic errors
    else {
      appError = {
        code: 'UNKNOWN_ERROR',
        message: error.message || '予期しないエラーが発生しました。',
        details: error,
        timestamp
      };
    }

    // Log error with context
    console.error(`[ErrorHandler${context ? ` - ${context}` : ''}]:`, {
      error: appError,
      originalError: error
    });

    return appError;
  }

  static showError(error: any, context?: string): void {
    const appError = this.handle(error, context);
    
    // Show user-friendly message
    switch (appError.code) {
      case 'NETWORK_ERROR':
        message.error('ネットワークエラーが発生しました。接続を確認してください。');
        break;
      case 'AUTH_ERROR':
        message.error('認証エラーが発生しました。再度ログインしてください。');
        break;
      case 'PERMISSION_ERROR':
        message.error('この操作を実行する権限がありません。');
        break;
      case 'VALIDATION_ERROR':
        message.error('入力データに問題があります。');
        break;
      default:
        message.error(appError.message);
    }
  }

  static showSuccess(messageText: string): void {
    message.success(messageText);
  }

  static showWarning(messageText: string): void {
    message.warning(messageText);
  }

  static showInfo(messageText: string): void {
    message.info(messageText);
  }
}

// Retry logic for failed operations
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: boolean;
      retryCondition?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = true,
      retryCondition = (error) => 
        error.code === 'NETWORK_ERROR' || 
        error.name === 'NetworkError' ||
        (error.status >= 500 && error.status < 600)
    } = options;

    let lastError: any;
    let currentDelay = delay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on last attempt or if retry condition not met
        if (attempt === maxRetries || !retryCondition(error)) {
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        // Exponential backoff
        if (backoff) {
          currentDelay *= 2;
        }
      }
    }

    throw lastError;
  }
}

// Loading state management
export class LoadingManager {
  private static loadingStates: Map<string, boolean> = new Map();
  private static callbacks: Map<string, (loading: boolean) => void> = new Map();

  static setLoading(key: string, loading: boolean): void {
    this.loadingStates.set(key, loading);
    const callback = this.callbacks.get(key);
    if (callback) {
      callback(loading);
    }
  }

  static isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  static subscribe(key: string, callback: (loading: boolean) => void): void {
    this.callbacks.set(key, callback);
  }

  static unsubscribe(key: string): void {
    this.callbacks.delete(key);
    this.loadingStates.delete(key);
  }

  // Helper for wrapping async operations with loading state
  static async withLoading<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.setLoading(key, true);
    try {
      return await operation();
    } finally {
      this.setLoading(key, false);
    }
  }
}