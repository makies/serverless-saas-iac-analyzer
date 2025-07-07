import React from 'react';
import { Alert, Button, Card, Typography, Space, Collapse } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined, BugOutlined, HomeOutlined } from '@ant-design/icons';
import { ErrorHandler } from '../services/errorHandler';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId?: string;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const appError = ErrorHandler.handle(error, 'ErrorBoundary');
    
    this.setState({ errorInfo });

    // Call custom onError handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service if configured
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
      console.error('Production Error Boundary:', {
        error: appError,
        errorInfo,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  getErrorType = (error: Error): string => {
    if (error.name === 'ChunkLoadError') return 'チャンクロードエラー';
    if (error.message.includes('Loading chunk')) return 'チャンクロードエラー';
    if (error.name === 'NetworkError') return 'ネットワークエラー';
    if (error.message.includes('fetch')) return 'ネットワークエラー';
    return 'アプリケーションエラー';
  };

  getErrorMessage = (error: Error): string => {
    const errorType = this.getErrorType(error);
    
    switch (errorType) {
      case 'チャンクロードエラー':
        return 'アプリケーションの更新が検出されました。ページをリロードしてください。';
      case 'ネットワークエラー':
        return 'ネットワーク接続に問題があります。接続を確認してリトライしてください。';
      default:
        return '予期しないエラーが発生しました。ページをリロードしてもう一度お試しください。';
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.handleRetry} />;
      }

      const errorType = this.state.error ? this.getErrorType(this.state.error) : 'アプリケーションエラー';
      const errorMessage = this.state.error ? this.getErrorMessage(this.state.error) : '予期しないエラーが発生しました。';

      return (
        <div style={{ 
          padding: '50px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '50vh',
          backgroundColor: '#f5f5f5'
        }}>
          <Card style={{ maxWidth: 700, textAlign: 'center' }}>
            <ExclamationCircleOutlined 
              style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '24px' }} 
            />
            
            <Title level={3}>{errorType}</Title>
            <Paragraph type="secondary" style={{ fontSize: '16px' }}>
              {errorMessage}
            </Paragraph>

            {this.state.errorId && (
              <Alert
                message="エラー ID"
                description={
                  <Text code copyable>
                    {this.state.errorId}
                  </Text>
                }
                type="info"
                style={{ marginBottom: '24px' }}
              />
            )}
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Collapse 
                style={{ marginTop: '24px', marginBottom: '24px', textAlign: 'left' }}
                size="small"
              >
                <Panel 
                  header={
                    <Space>
                      <BugOutlined />
                      <span>開発モード - エラー詳細</span>
                    </Space>
                  } 
                  key="1"
                >
                  <Alert
                    message="Error Details"
                    description={
                      <div>
                        <p><strong>Message:</strong> {this.state.error.message}</p>
                        <p><strong>Name:</strong> {this.state.error.name}</p>
                        {this.state.error.stack && (
                          <div>
                            <strong>Stack Trace:</strong>
                            <pre style={{ 
                              fontSize: '11px', 
                              marginTop: '8px', 
                              padding: '8px',
                              backgroundColor: '#f6f6f6',
                              borderRadius: '4px',
                              overflow: 'auto',
                              maxHeight: '200px'
                            }}>
                              {this.state.error.stack}
                            </pre>
                          </div>
                        )}
                        {this.state.errorInfo && (
                          <div style={{ marginTop: '16px' }}>
                            <strong>Component Stack:</strong>
                            <pre style={{ 
                              fontSize: '11px', 
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: '#f6f6f6',
                              borderRadius: '4px',
                              overflow: 'auto',
                              maxHeight: '200px'
                            }}>
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    }
                    type="error"
                  />
                </Panel>
              </Collapse>
            )}
            
            <Space>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
                size="large"
              >
                ページをリロード
              </Button>
              
              <Button 
                icon={<HomeOutlined />}
                onClick={this.handleGoHome}
                size="large"
              >
                ホームに戻る
              </Button>

              <Button 
                onClick={this.handleRetry}
                size="large"
              >
                リトライ
              </Button>
            </Space>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;