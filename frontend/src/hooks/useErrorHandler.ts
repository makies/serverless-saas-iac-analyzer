import { useState, useCallback } from 'react';
import { ErrorHandler, RetryHandler, LoadingManager } from '../services/errorHandler';

interface UseErrorHandlerOptions {
  showErrorMessages?: boolean;
  enableRetry?: boolean;
  retryOptions?: {
    maxRetries?: number;
    delay?: number;
    backoff?: boolean;
  };
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const {
    showErrorMessages = true,
    enableRetry = false,
    retryOptions = {}
  } = options;

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string,
    loadingKey?: string
  ): Promise<T | null> => {
    setError(null);
    
    const startLoading = () => {
      setLoading(true);
      if (loadingKey) {
        LoadingManager.setLoading(loadingKey, true);
      }
    };

    const stopLoading = () => {
      setLoading(false);
      if (loadingKey) {
        LoadingManager.setLoading(loadingKey, false);
      }
    };

    try {
      startLoading();

      let result: T;
      
      if (enableRetry) {
        result = await RetryHandler.withRetry(operation, retryOptions);
      } else {
        result = await operation();
      }

      return result;
    } catch (err) {
      const appError = ErrorHandler.handle(err, context);
      setError(appError);

      if (showErrorMessages) {
        ErrorHandler.showError(err, context);
      }

      return null;
    } finally {
      stopLoading();
    }
  }, [showErrorMessages, enableRetry, retryOptions]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const showSuccess = useCallback((message: string) => {
    ErrorHandler.showSuccess(message);
  }, []);

  const showWarning = useCallback((message: string) => {
    ErrorHandler.showWarning(message);
  }, []);

  const showInfo = useCallback((message: string) => {
    ErrorHandler.showInfo(message);
  }, []);

  return {
    error,
    loading,
    executeWithErrorHandling,
    clearError,
    showSuccess,
    showWarning,
    showInfo
  };
}

// Hook for handling async operations with loading states
export function useAsyncOperation<T = any>(
  operation: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      const appError = ErrorHandler.handle(err);
      setError(appError);
      ErrorHandler.showError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, dependencies);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
}