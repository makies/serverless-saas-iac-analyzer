import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Tag,
  Progress,
  Modal,
  Form,
  Select,
  Checkbox,
  InputNumber,
  Alert,
  Typography,
  Row,
  Col,
  Statistic,
  Tabs,
  Timeline,
  Badge,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  CloudOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { Option } = Select;

interface AwsAccount {
  id: string;
  accountId: string;
  accountName: string;
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT' | 'TEST' | 'SANDBOX';
  region: string;
  roleArn: string;
  externalId?: string;
  owner: 'CUSTOMER' | 'COMPANY';
  supportPlan: 'BASIC' | 'DEVELOPER' | 'BUSINESS' | 'ENTERPRISE' | 'UNKNOWN';
  isActive: boolean;
  lastScanDate?: string;
}

interface MultiAccountScanRequest {
  tenantId: string;
  projectId: string;
  accountIds?: string[];
  scanScope: {
    services: string[];
    regions: string[];
    resourceTypes?: string[];
  };
  frameworks: string[];
  scanOptions: {
    parallelExecution: boolean;
    maxConcurrentScans: number;
    failOnAccountError: boolean;
    aggregateResults: boolean;
  };
}

interface AccountScanResult {
  accountId: string;
  accountName: string;
  environment: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  analysisId?: string;
  startTime?: string;
  endTime?: string;
  totalResources?: number;
  scannedServices?: number;
  scannedRegions?: number;
  errors?: string[];
  supportPlan?: string;
}

interface MultiAccountScanStatus {
  scanId: string;
  tenantId: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  totalAccounts: number;
  completedAccounts: number;
  failedAccounts: number;
  progress: number;
  startTime: string;
  endTime?: string;
  accountResults: AccountScanResult[];
  aggregatedSummary?: {
    totalResources: number;
    resourcesByAccount: Record<string, number>;
    resourcesByEnvironment: Record<string, number>;
    supportPlanDistribution: Record<string, number>;
    errors: string[];
    recommendations: string[];
  };
}

interface MultiAccountScanManagerProps {
  projectId: string;
  tenantId: string;
  accounts: AwsAccount[];
  onScanStarted?: (scanId: string) => void;
  onScanCompleted?: (scanId: string, results: MultiAccountScanStatus) => void;
}

const MultiAccountScanManager: React.FC<MultiAccountScanManagerProps> = ({
  projectId,
  tenantId,
  accounts,
  onScanStarted,
  onScanCompleted,
}) => {
  const [activeTab, setActiveTab] = useState('scan');
  const [scanning, setScanning] = useState(false);
  const [currentScan, setCurrentScan] = useState<MultiAccountScanStatus | null>(null);
  const [scanHistory, setScanHistory] = useState<MultiAccountScanStatus[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [form] = Form.useForm();

  // Available services and regions
  const availableServices = [
    'ECS',
    'Lambda',
    'S3',
    'RDS',
    'CloudFormation',
    'IAM',
    'Organizations',
    'Support',
    'Config',
  ];

  const availableRegions = [
    'us-east-1',
    'us-west-2',
    'ap-northeast-1',
    'eu-west-1',
    'eu-central-1',
  ];

  const availableFrameworks = [
    { value: 'well-architected', label: 'AWS Well-Architected Framework' },
    { value: 'security-hub', label: 'AWS Security Hub' },
    { value: 'serverless-lens', label: 'Serverless Lens' },
    { value: 'saas-lens', label: 'SaaS Lens' },
  ];

  useEffect(() => {
    loadScanHistory();
  }, [projectId]);

  useEffect(() => {
    if (currentScan && currentScan.status === 'RUNNING') {
      const pollInterval = setInterval(() => {
        refreshScanStatus(currentScan.scanId);
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(pollInterval);
    }
  }, [currentScan]);

  const loadScanHistory = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockHistory: MultiAccountScanStatus[] = [
        {
          scanId: 'scan-001',
          tenantId,
          projectId,
          status: 'COMPLETED',
          totalAccounts: 3,
          completedAccounts: 3,
          failedAccounts: 0,
          progress: 100,
          startTime: '2024-01-15T08:00:00Z',
          endTime: '2024-01-15T08:15:00Z',
          accountResults: [],
          aggregatedSummary: {
            totalResources: 127,
            resourcesByAccount: {},
            resourcesByEnvironment: {},
            supportPlanDistribution: { BUSINESS: 1, DEVELOPER: 2 },
            errors: [],
            recommendations: [],
          },
        },
      ];
      setScanHistory(mockHistory);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    }
  };

  const startMultiAccountScan = async (values: any) => {
    try {
      setScanning(true);

      const scanRequest: MultiAccountScanRequest = {
        tenantId,
        projectId,
        accountIds: values.accountIds,
        scanScope: {
          services: values.services,
          regions: values.regions,
          resourceTypes: values.resourceTypes,
        },
        frameworks: values.frameworks,
        scanOptions: {
          parallelExecution: values.parallelExecution || false,
          maxConcurrentScans: values.maxConcurrentScans || 3,
          failOnAccountError: values.failOnAccountError || false,
          aggregateResults: true,
        },
      };

      console.log('Starting multi-account scan:', scanRequest);

      // Mock API call - replace with actual implementation
      const scanId = `scan-${Date.now()}`;
      const mockScanStatus: MultiAccountScanStatus = {
        scanId,
        tenantId,
        projectId,
        status: 'RUNNING',
        totalAccounts: (values.accountIds || accounts.map(a => a.id)).length,
        completedAccounts: 0,
        failedAccounts: 0,
        progress: 0,
        startTime: new Date().toISOString(),
        accountResults: (values.accountIds || accounts.map(a => a.id)).map((id: string) => {
          const account = accounts.find(a => a.id === id) || accounts[0];
          return {
            accountId: account.accountId,
            accountName: account.accountName,
            environment: account.environment,
            status: 'PENDING' as const,
            supportPlan: account.supportPlan,
          };
        }),
      };

      setCurrentScan(mockScanStatus);
      setShowScanModal(false);
      form.resetFields();

      if (onScanStarted) {
        onScanStarted(scanId);
      }

      // Simulate scan progress
      simulateScanProgress(mockScanStatus);
    } catch (error) {
      console.error('Failed to start multi-account scan:', error);
    } finally {
      setScanning(false);
    }
  };

  const simulateScanProgress = async (initialStatus: MultiAccountScanStatus) => {
    // This simulates the scan progress - replace with actual polling
    let progress = 0;
    const totalAccounts = initialStatus.totalAccounts;
    
    const progressInterval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        
        const completedStatus: MultiAccountScanStatus = {
          ...initialStatus,
          status: 'COMPLETED',
          progress: 100,
          completedAccounts: totalAccounts,
          endTime: new Date().toISOString(),
          accountResults: initialStatus.accountResults.map(result => ({
            ...result,
            status: 'COMPLETED' as const,
            totalResources: Math.floor(Math.random() * 50) + 10,
            scannedServices: 5,
            scannedRegions: 2,
            endTime: new Date().toISOString(),
          })),
          aggregatedSummary: {
            totalResources: Math.floor(Math.random() * 200) + 100,
            resourcesByAccount: {},
            resourcesByEnvironment: {},
            supportPlanDistribution: {},
            errors: [],
            recommendations: [
              'Consider upgrading support plan for production environments',
              'Enable AWS Config for better compliance monitoring',
            ],
          },
        };
        
        setCurrentScan(completedStatus);
        if (onScanCompleted) {
          onScanCompleted(completedStatus.scanId, completedStatus);
        }
      } else {
        setCurrentScan(prev => prev ? {
          ...prev,
          progress: Math.round(progress),
          completedAccounts: Math.floor((progress / 100) * totalAccounts),
        } : null);
      }
    }, 2000);
  };

  const refreshScanStatus = async (scanId: string) => {
    try {
      // TODO: Implement actual API call to get scan status
      console.log('Refreshing scan status for:', scanId);
    } catch (error) {
      console.error('Failed to refresh scan status:', error);
    }
  };

  const stopScan = async () => {
    if (currentScan) {
      // TODO: Implement actual scan cancellation
      console.log('Stopping scan:', currentScan.scanId);
      setCurrentScan(prev => prev ? { ...prev, status: 'FAILED' } : null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'default',
      RUNNING: 'processing',
      COMPLETED: 'success',
      FAILED: 'error',
      PARTIAL: 'warning',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      PENDING: <ClockCircleOutlined />,
      RUNNING: <PlayCircleOutlined />,
      COMPLETED: <CheckCircleOutlined />,
      FAILED: <CloseCircleOutlined />,
      PARTIAL: <WarningOutlined />,
    };
    return icons[status as keyof typeof icons] || <InfoCircleOutlined />;
  };

  const accountColumns: ColumnsType<AccountScanResult> = [
    {
      title: 'Account',
      key: 'account',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.accountName}</Text>
          <Text code>{record.accountId}</Text>
        </Space>
      ),
    },
    {
      title: 'Environment',
      dataIndex: 'environment',
      key: 'environment',
      render: (environment) => (
        <Tag color={environment === 'PRODUCTION' ? 'red' : 'blue'}>
          {environment}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Resources',
      dataIndex: 'totalResources',
      key: 'totalResources',
      render: (resources) => resources || '-',
    },
    {
      title: 'Services',
      dataIndex: 'scannedServices',
      key: 'scannedServices',
      render: (services) => services || '-',
    },
    {
      title: 'Support Plan',
      dataIndex: 'supportPlan',
      key: 'supportPlan',
      render: (plan) => plan ? <Tag>{plan}</Tag> : '-',
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record) => {
        if (record.startTime && record.endTime) {
          const duration = Math.round(
            (new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 1000
          );
          return `${duration}s`;
        }
        return '-';
      },
    },
  ];

  const scanHistoryColumns: ColumnsType<MultiAccountScanStatus> = [
    {
      title: 'Scan ID',
      dataIndex: 'scanId',
      key: 'scanId',
      render: (scanId) => <Text code>{scanId}</Text>,
    },
    {
      title: 'Started',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time) => new Date(time).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Accounts',
      key: 'accounts',
      render: (_, record) => `${record.completedAccounts}/${record.totalAccounts}`,
    },
    {
      title: 'Resources',
      key: 'resources',
      render: (_, record) => record.aggregatedSummary?.totalResources || '-',
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record) => {
        if (record.startTime && record.endTime) {
          const duration = Math.round(
            (new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 60000
          );
          return `${duration}m`;
        }
        return record.status === 'RUNNING' ? 'Running...' : '-';
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" onClick={() => setCurrentScan(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const renderScanInterface = () => (
    <Card title="Multi-Account Scan" extra={
      <Space>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => setShowScanModal(true)}
          disabled={scanning || (currentScan && currentScan.status === 'RUNNING')}
        >
          Start New Scan
        </Button>
        {currentScan && currentScan.status === 'RUNNING' && (
          <Button
            danger
            icon={<StopOutlined />}
            onClick={stopScan}
          >
            Stop Scan
          </Button>
        )}
      </Space>
    }>
      {currentScan ? (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Scan Progress */}
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Statistic
                title="Overall Progress"
                value={currentScan.progress}
                suffix="%"
                prefix={getStatusIcon(currentScan.status)}
              />
              <Progress
                percent={currentScan.progress}
                status={currentScan.status === 'FAILED' ? 'exception' : undefined}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Completed Accounts"
                value={currentScan.completedAccounts}
                suffix={`/ ${currentScan.totalAccounts}`}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Failed Accounts"
                value={currentScan.failedAccounts}
                valueStyle={{ color: currentScan.failedAccounts > 0 ? '#cf1322' : undefined }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Total Resources"
                value={currentScan.aggregatedSummary?.totalResources || 0}
                prefix={<CloudOutlined />}
              />
            </Col>
          </Row>

          {/* Account Details */}
          <Card title="Account Scan Progress" size="small">
            <Table
              columns={accountColumns}
              dataSource={currentScan.accountResults}
              rowKey="accountId"
              pagination={false}
              size="small"
            />
          </Card>

          {/* Aggregated Results */}
          {currentScan.aggregatedSummary && (
            <Card title="Scan Summary" size="small">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="Support Plan Distribution" size="small">
                    {Object.entries(currentScan.aggregatedSummary.supportPlanDistribution).map(([plan, count]) => (
                      <div key={plan} style={{ marginBottom: 8 }}>
                        <Badge count={count} showZero>
                          <Tag>{plan}</Tag>
                        </Badge>
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Recommendations" size="small">
                    {currentScan.aggregatedSummary.recommendations.map((rec, index) => (
                      <Alert
                        key={index}
                        message={rec}
                        type="info"
                        showIcon
                        style={{ marginBottom: 8 }}
                      />
                    ))}
                  </Card>
                </Col>
              </Row>
            </Card>
          )}
        </Space>
      ) : (
        <Alert
          message="No Active Scan"
          description="Start a new multi-account scan to monitor AWS resources across all project accounts."
          type="info"
          showIcon
        />
      )}
    </Card>
  );

  const renderScanHistory = () => (
    <Card title="Scan History">
      <Table
        columns={scanHistoryColumns}
        dataSource={scanHistory}
        rowKey="scanId"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'scan',
            label: 'Active Scan',
            children: renderScanInterface(),
          },
          {
            key: 'history',
            label: 'Scan History',
            children: renderScanHistory(),
          },
        ]}
      />

      {/* Scan Configuration Modal */}
      <Modal
        title="Configure Multi-Account Scan"
        open={showScanModal}
        onCancel={() => setShowScanModal(false)}
        onOk={() => form.submit()}
        width={800}
        confirmLoading={scanning}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={startMultiAccountScan}
          initialValues={{
            services: ['ECS', 'Lambda', 'S3'],
            regions: ['us-east-1', 'ap-northeast-1'],
            frameworks: ['well-architected'],
            maxConcurrentScans: 3,
            parallelExecution: true,
            aggregateResults: true,
          }}
        >
          <Form.Item
            name="accountIds"
            label="AWS Accounts"
            tooltip="Select specific accounts to scan, or leave empty to scan all project accounts"
          >
            <Select
              mode="multiple"
              placeholder="Select accounts (leave empty for all accounts)"
              allowClear
            >
              {accounts.map(account => (
                <Option key={account.id} value={account.id}>
                  {account.accountName} ({account.accountId}) - {account.environment}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="services"
                label="Services to Scan"
                rules={[{ required: true, message: 'Please select at least one service' }]}
              >
                <Select mode="multiple" placeholder="Select AWS services">
                  {availableServices.map(service => (
                    <Option key={service} value={service}>{service}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="regions"
                label="Regions to Scan"
                rules={[{ required: true, message: 'Please select at least one region' }]}
              >
                <Select mode="multiple" placeholder="Select AWS regions">
                  {availableRegions.map(region => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="frameworks"
            label="Analysis Frameworks"
            rules={[{ required: true, message: 'Please select at least one framework' }]}
          >
            <Select mode="multiple" placeholder="Select analysis frameworks">
              {availableFrameworks.map(framework => (
                <Option key={framework.value} value={framework.value}>
                  {framework.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Scan Options">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="parallelExecution" valuePropName="checked" noStyle>
                <Checkbox>Enable parallel execution</Checkbox>
              </Form.Item>
              <Form.Item name="aggregateResults" valuePropName="checked" noStyle>
                <Checkbox>Aggregate results across accounts</Checkbox>
              </Form.Item>
              <Form.Item name="failOnAccountError" valuePropName="checked" noStyle>
                <Checkbox>Fail entire scan if any account fails</Checkbox>
              </Form.Item>
              <Row>
                <Col span={12}>
                  <Form.Item
                    name="maxConcurrentScans"
                    label="Max Concurrent Scans"
                  >
                    <InputNumber min={1} max={10} />
                  </Form.Item>
                </Col>
              </Row>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MultiAccountScanManager;