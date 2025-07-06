# フロントエンド相関ID統合ガイド

## 概要
ブラウザからバックエンドまでの完全なend-to-endトレースを可能にするため、フロントエンドで相関IDを生成し、AppSyncリクエストに含める設定方法を説明します。

## 1. CloudWatch RUM統合

### RUM SDK セットアップ

```typescript
// src/utils/rum.ts
import { AwsRum } from 'aws-rum-web';

const rumConfig = {
  sessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  guestRoleArn: process.env.REACT_APP_RUM_GUEST_ROLE_ARN,
  identityPoolId: process.env.REACT_APP_RUM_IDENTITY_POOL_ID,
  endpoint: `https://dataplane.rum.${process.env.REACT_APP_AWS_REGION}.amazonaws.com`,
  telemetries: ['performance', 'errors', 'http'],
  allowCookies: true,
  enableXRay: true,
};

export const awsRum = AwsRum.init({
  config: rumConfig,
});
```

### 環境変数設定

```bash
# .env
REACT_APP_RUM_GUEST_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT:role/CloudBPA-RUM-GuestRole-ENV
REACT_APP_RUM_IDENTITY_POOL_ID=us-east-1:your-identity-pool-id
REACT_APP_AWS_REGION=ap-northeast-1
```

## 2. 相関ID生成とContext管理

### 相関IDコンテキスト

```typescript
// src/context/CorrelationContext.tsx
import React, { createContext, useContext, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface CorrelationContextType {
  generateCorrelationId: () => string;
  getCurrentCorrelationId: () => string | null;
  setCorrelationId: (id: string) => void;
  getTraceHeaders: () => Record<string, string>;
}

const CorrelationContext = createContext<CorrelationContextType | null>(null);

export const CorrelationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCorrelationId, setCurrentCorrelationId] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(uuidv4());

  const generateCorrelationId = (): string => {
    const correlationId = `${sessionIdRef.current}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentCorrelationId(correlationId);
    return correlationId;
  };

  const getCurrentCorrelationId = (): string | null => {
    return currentCorrelationId;
  };

  const setCorrelationId = (id: string): void => {
    setCurrentCorrelationId(id);
  };

  const getTraceHeaders = (): Record<string, string> => {
    const correlationId = currentCorrelationId || generateCorrelationId();
    
    return {
      'X-Correlation-Id': correlationId,
      'X-Session-Id': sessionIdRef.current,
      'X-Timestamp': new Date().toISOString(),
      'X-Source': 'Frontend',
      'X-User-Agent': navigator.userAgent,
    };
  };

  return (
    <CorrelationContext.Provider
      value={{
        generateCorrelationId,
        getCurrentCorrelationId,
        setCorrelationId,
        getTraceHeaders,
      }}
    >
      {children}
    </CorrelationContext.Provider>
  );
};

export const useCorrelation = (): CorrelationContextType => {
  const context = useContext(CorrelationContext);
  if (!context) {
    throw new Error('useCorrelation must be used within a CorrelationProvider');
  }
  return context;
};
```

## 3. Apollo Client 統合

### AppSync クライアント設定

```typescript
// src/graphql/client.ts
import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { useCorrelation } from '../context/CorrelationContext';

const httpLink = createHttpLink({
  uri: process.env.REACT_APP_APPSYNC_GRAPHQL_ENDPOINT,
});

// 相関IDヘッダーを追加するリンク
const correlationLink = setContext((_, { headers }) => {
  const { getTraceHeaders } = useCorrelation();
  
  return {
    headers: {
      ...headers,
      ...getTraceHeaders(),
    },
  };
});

// 認証ヘッダーを追加するリンク
const authLink = setContext(async (_, { headers }) => {
  const token = await Auth.currentSession().then((session) => 
    session.getIdToken().getJwtToken()
  );

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// エラーハンドリングリンク（相関ID付きログ）
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  const { getCurrentCorrelationId } = useCorrelation();
  const correlationId = getCurrentCorrelationId();

  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error('GraphQL error:', {
        message,
        locations,
        path,
        correlationId,
        operation: operation.operationName,
      });
      
      // CloudWatch RUMでエラーを記録
      awsRum.recordError(new Error(`GraphQL Error: ${message}`), {
        correlationId,
        operation: operation.operationName,
        path: path?.join('.'),
      });
    });
  }

  if (networkError) {
    console.error('Network error:', {
      error: networkError,
      correlationId,
      operation: operation.operationName,
    });

    // CloudWatch RUMでネットワークエラーを記録
    awsRum.recordError(networkError, {
      correlationId,
      operation: operation.operationName,
      type: 'NetworkError',
    });
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, correlationLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});
```

## 4. React Hooks統合

### GraphQL Mutation Hook with Correlation

```typescript
// src/hooks/useTrackedMutation.ts
import { useMutation, MutationHookOptions } from '@apollo/client';
import { useCorrelation } from '../context/CorrelationContext';
import { awsRum } from '../utils/rum';

export function useTrackedMutation<TData, TVariables>(
  mutation: any,
  options?: MutationHookOptions<TData, TVariables>
) {
  const { generateCorrelationId, getCurrentCorrelationId } = useCorrelation();
  
  return useMutation<TData, TVariables>(mutation, {
    ...options,
    onCompleted: (data) => {
      const correlationId = getCurrentCorrelationId();
      
      // 成功メトリクスをRUMに送信
      awsRum.recordEvent('MutationSuccess', {
        correlationId,
        mutationName: mutation.definitions[0]?.name?.value,
      });
      
      options?.onCompleted?.(data);
    },
    onError: (error) => {
      const correlationId = getCurrentCorrelationId();
      
      // エラーメトリクスをRUMに送信
      awsRum.recordError(error, {
        correlationId,
        mutationName: mutation.definitions[0]?.name?.value,
        type: 'MutationError',
      });
      
      options?.onError?.(error);
    },
    context: {
      ...options?.context,
      correlationId: generateCorrelationId(),
    },
  });
}
```

### Query Hook with Correlation

```typescript
// src/hooks/useTrackedQuery.ts
import { useQuery, QueryHookOptions } from '@apollo/client';
import { useCorrelation } from '../context/CorrelationContext';
import { awsRum } from '../utils/rum';

export function useTrackedQuery<TData, TVariables>(
  query: any,
  options?: QueryHookOptions<TData, TVariables>
) {
  const { generateCorrelationId, getCurrentCorrelationId } = useCorrelation();
  
  return useQuery<TData, TVariables>(query, {
    ...options,
    onCompleted: (data) => {
      const correlationId = getCurrentCorrelationId();
      
      // 成功メトリクスをRUMに送信
      awsRum.recordEvent('QuerySuccess', {
        correlationId,
        queryName: query.definitions[0]?.name?.value,
      });
      
      options?.onCompleted?.(data);
    },
    onError: (error) => {
      const correlationId = getCurrentCorrelationId();
      
      // エラーメトリクスをRUMに送信
      awsRum.recordError(error, {
        correlationId,
        queryName: query.definitions[0]?.name?.value,
        type: 'QueryError',
      });
      
      options?.onError?.(error);
    },
    context: {
      ...options?.context,
      correlationId: generateCorrelationId(),
    },
  });
}
```

## 5. ページレベル追跡

### 分析開始ページの例

```typescript
// src/pages/StartAnalysisPage.tsx
import React, { useEffect } from 'react';
import { useTrackedMutation } from '../hooks/useTrackedMutation';
import { useCorrelation } from '../context/CorrelationContext';
import { START_ANALYSIS } from '../graphql/mutations';
import { awsRum } from '../utils/rum';

export const StartAnalysisPage: React.FC = () => {
  const { generateCorrelationId, getCurrentCorrelationId } = useCorrelation();
  const [startAnalysis, { loading, error, data }] = useTrackedMutation(START_ANALYSIS);

  useEffect(() => {
    // ページ読み込み時に新しい相関IDを生成
    const correlationId = generateCorrelationId();
    
    // ページビューをRUMに記録
    awsRum.recordPageView('StartAnalysisPage', {
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }, [generateCorrelationId]);

  const handleStartAnalysis = async (analysisInput: any) => {
    const correlationId = getCurrentCorrelationId();
    
    // ユーザーアクションを記録
    awsRum.recordEvent('StartAnalysisClicked', {
      correlationId,
      projectId: analysisInput.projectId,
    });

    try {
      await startAnalysis({
        variables: { input: analysisInput },
      });
    } catch (err) {
      // エラーは既にuseTrackedMutationで処理される
    }
  };

  return (
    <div>
      {/* UI Components */}
      <button onClick={() => handleStartAnalysis(analysisData)}>
        分析開始
      </button>
    </div>
  );
};
```

## 6. App.tsx 統合

```typescript
// src/App.tsx
import React from 'react';
import { ApolloProvider } from '@apollo/client';
import { CorrelationProvider } from './context/CorrelationContext';
import { apolloClient } from './graphql/client';
import { awsRum } from './utils/rum';

function App() {
  useEffect(() => {
    // アプリケーション開始時にRUMセッションを初期化
    awsRum.recordEvent('AppStarted', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }, []);

  return (
    <CorrelationProvider>
      <ApolloProvider client={apolloClient}>
        {/* Your app components */}
      </ApolloProvider>
    </CorrelationProvider>
  );
}

export default App;
```

## 7. 必要な依存関係

```json
{
  "dependencies": {
    "@apollo/client": "^3.7.0",
    "aws-rum-web": "^1.15.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0"
  }
}
```

## 8. トレース確認方法

### CloudWatch Logs での確認
```bash
# 相関IDでログをフィルタリング
aws logs filter-log-events \
  --log-group-name /aws/lambda/YourLambdaFunction \
  --filter-pattern '{ $.correlationId = "your-correlation-id" }'
```

### X-Ray での確認
- X-Ray コンソールで相関IDをアノテーションとして検索
- トレースマップでフロントエンドからバックエンドまでの流れを確認

### CloudWatch RUM での確認
- RUMダッシュボードでユーザージャーニー確認
- 相関IDごとのエラー率・パフォーマンス分析

この設定により、ブラウザでのユーザー操作からAppSync、Lambda、DynamoDB、Bedrockまでの完全なend-to-endトレースが可能になります。