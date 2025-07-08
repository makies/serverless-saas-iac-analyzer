import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
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
  Progress,
  Radio,
  Input,
} from 'antd';
import {
  CompareOutlined,
  HistoryOutlined,
  TrendingUpOutlined,
  TrendingDownOutlined,
  MinusOutlined,
  PlusOutlined,
  DiffOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface ScanResult {
  scanId: string;
  accountId: string;
  accountName: string;
  environment: string;
  scanDate: string;
  totalResources: number;
  resourcesByService: Record<string, number>;
  resourcesByRegion: Record<string, number>;
  complianceScore: number;
  securityFindings: number;
  criticalFindings: number;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL';
}

interface ResourceDifference {
  resourceType: string;
  service: string;
  region: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED';
  oldValue?: any;
  newValue?: any;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

interface ComplianceDifference {
  ruleId: string;
  ruleName: string;
  changeType: 'NEW_VIOLATION' | 'RESOLVED' | 'STATUS_CHANGED';
  oldStatus?: string;
  newStatus?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impact: string;
}

interface DifferentialAnalysisResult {
  id: string;
  baselineScan: ScanResult;
  comparisonScan: ScanResult;
  analysisDate: string;
  totalChanges: number;
  resourceChanges: {
    added: number;
    removed: number;
    modified: number;
    differences: ResourceDifference[];
  };
  complianceChanges: {
    newViolations: number;
    resolvedViolations: number;
    statusChanges: number;
    differences: ComplianceDifference[];
  };
  securityImpact: {
    scoreChange: number;
    riskLevel: 'INCREASED' | 'DECREASED' | 'UNCHANGED';
    criticalChanges: number;
  };
  recommendations: string[];
}

interface DifferentialAnalysisProps {
  projectId: string;
  tenantId: string;
  accounts: Array<{
    id: string;
    accountId: string;
    accountName: string;
    environment: string;
  }>;
}

const DifferentialAnalysis: React.FC<DifferentialAnalysisProps> = ({
  projectId,
  tenantId,
  accounts,
}) => {
  const [activeTab, setActiveTab] = useState('compare');
  const [loading, setLoading] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [differentialResults, setDifferentialResults] = useState<DifferentialAnalysisResult[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<DifferentialAnalysisResult | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadScanHistory();
    loadDifferentialHistory();
  }, [projectId]);

  const loadScanHistory = async () => {
    try {
      setLoading(true);
      // Mock data for now - replace with actual API call
      const mockScanResults: ScanResult[] = [
        {
          scanId: 'scan-001',
          accountId: '123456789012',
          accountName: 'Production Account',
          environment: 'PRODUCTION',
          scanDate: '2024-01-15T08:00:00Z',
          totalResources: 127,
          resourcesByService: { EC2: 25, RDS: 8, S3: 15, Lambda: 32 },
          resourcesByRegion: { 'us-east-1': 45, 'ap-northeast-1': 82 },
          complianceScore: 78,
          securityFindings: 12,
          criticalFindings: 2,
          status: 'COMPLETED',
        },
        {
          scanId: 'scan-002',
          accountId: '123456789012',
          accountName: 'Production Account',
          environment: 'PRODUCTION',
          scanDate: '2024-01-16T08:00:00Z',
          totalResources: 131,
          resourcesByService: { EC2: 27, RDS: 8, S3: 16, Lambda: 35 },
          resourcesByRegion: { 'us-east-1': 46, 'ap-northeast-1': 85 },
          complianceScore: 82,
          securityFindings: 9,
          criticalFindings: 1,
          status: 'COMPLETED',
        },
        {
          scanId: 'scan-003',
          accountId: '234567890123',
          accountName: 'Development Account',
          environment: 'DEVELOPMENT',
          scanDate: '2024-01-15T08:00:00Z',
          totalResources: 45,
          resourcesByService: { EC2: 8, RDS: 2, S3: 5, Lambda: 15 },
          resourcesByRegion: { 'ap-northeast-1': 45 },
          complianceScore: 65,
          securityFindings: 8,
          criticalFindings: 3,
          status: 'COMPLETED',
        },
      ];
      setScanResults(mockScanResults);
    } catch (error) {
      console.error('Failed to load scan history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDifferentialHistory = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockDifferentialResults: DifferentialAnalysisResult[] = [
        {
          id: 'diff-001',
          baselineScan: scanResults[0] || {} as ScanResult,
          comparisonScan: scanResults[1] || {} as ScanResult,
          analysisDate: '2024-01-16T09:00:00Z',
          totalChanges: 15,
          resourceChanges: {
            added: 6,
            removed: 2,
            modified: 7,
            differences: [
              {
                resourceType: 'EC2Instance',
                service: 'EC2',
                region: 'us-east-1',
                changeType: 'ADDED',
                newValue: { instanceType: 't3.medium', count: 2 },
                impact: 'MEDIUM',
                description: '新しいEC2インスタンス2台が追加されました',
              },
              {
                resourceType: 'LambdaFunction',
                service: 'Lambda',
                region: 'ap-northeast-1',
                changeType: 'MODIFIED',
                oldValue: { memory: 128, timeout: 30 },
                newValue: { memory: 256, timeout: 60 },
                impact: 'LOW',
                description: 'Lambda関数の設定が変更されました',
              },
            ],
          },
          complianceChanges: {
            newViolations: 2,
            resolvedViolations: 5,
            statusChanges: 3,
            differences: [
              {
                ruleId: 'SEC-001',
                ruleName: 'S3バケット暗号化',
                changeType: 'RESOLVED',
                oldStatus: 'VIOLATION',
                newStatus: 'COMPLIANT',
                severity: 'HIGH',
                impact: 'セキュリティ向上',
              },
            ],
          },
          securityImpact: {
            scoreChange: 4,
            riskLevel: 'DECREASED',
            criticalChanges: -1,
          },
          recommendations: [
            'EC2インスタンスのセキュリティグループを確認してください',
            '新しく追加されたリソースのタグ付けを実施してください',
          ],
        },
      ];
      setDifferentialResults(mockDifferentialResults);
    } catch (error) {
      console.error('Failed to load differential history:', error);
    }
  };

  const startDifferentialAnalysis = async (values: any) => {
    try {
      setLoading(true);

      const { baselineScanId, comparisonScanId, analysisType } = values;
      
      console.log('Starting differential analysis:', {
        baselineScanId,
        comparisonScanId,
        analysisType,
      });

      // Mock differential analysis - replace with actual implementation
      const analysisId = `diff-${Date.now()}`;
      
      // Simulate analysis process
      await new Promise(resolve => setTimeout(resolve, 3000));

      setShowCompareModal(false);
      form.resetFields();
      
      // Reload differential history
      await loadDifferentialHistory();
      
    } catch (error) {
      console.error('Failed to start differential analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (changeType: string) => {
    const icons = {
      ADDED: <PlusOutlined style={{ color: '#52c41a' }} />,
      REMOVED: <MinusOutlined style={{ color: '#ff4d4f' }} />,
      MODIFIED: <DiffOutlined style={{ color: '#fa8c16' }} />,
    };
    return icons[changeType as keyof typeof icons] || <InfoCircleOutlined />;
  };

  const getRiskLevelColor = (riskLevel: string) => {
    const colors = {
      INCREASED: '#ff4d4f',
      DECREASED: '#52c41a',
      UNCHANGED: '#d9d9d9',
    };
    return colors[riskLevel as keyof typeof colors] || '#d9d9d9';
  };

  const scanColumns: ColumnsType<ScanResult> = [
    {
      title: 'Scan ID',
      dataIndex: 'scanId',
      key: 'scanId',
      render: (scanId) => <Text code>{scanId}</Text>,
    },
    {
      title: 'Account',
      key: 'account',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.accountName}</Text>
          <Text type="secondary">{record.accountId}</Text>
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
      title: 'Scan Date',
      dataIndex: 'scanDate',
      key: 'scanDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Resources',
      dataIndex: 'totalResources',
      key: 'totalResources',
    },
    {
      title: 'Compliance Score',
      dataIndex: 'complianceScore',
      key: 'complianceScore',
      render: (score) => (
        <Progress
          percent={score}
          size="small"
          strokeColor={score >= 80 ? '#52c41a' : score >= 60 ? '#fa8c16' : '#ff4d4f'}
        />
      ),
    },
    {
      title: 'Security Findings',
      key: 'securityFindings',
      render: (_, record) => (
        <Space>
          <Badge count={record.criticalFindings} showZero>
            <Tag color="red">Critical</Tag>
          </Badge>
          <Tag>{record.securityFindings} Total</Tag>
        </Space>
      ),
    },
  ];

  const resourceChangeColumns: ColumnsType<ResourceDifference> = [
    {
      title: 'Change',
      dataIndex: 'changeType',
      key: 'changeType',
      render: (changeType) => (
        <Space>
          {getChangeIcon(changeType)}
          <Tag color={
            changeType === 'ADDED' ? 'green' : 
            changeType === 'REMOVED' ? 'red' : 'orange'
          }>
            {changeType}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Resource Type',
      dataIndex: 'resourceType',
      key: 'resourceType',
    },
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
      render: (service) => <Tag>{service}</Tag>,
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
    },
    {
      title: 'Impact',
      dataIndex: 'impact',
      key: 'impact',
      render: (impact) => (
        <Tag color={
          impact === 'HIGH' ? 'red' : 
          impact === 'MEDIUM' ? 'orange' : 'green'
        }>
          {impact}
        </Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  const differentialColumns: ColumnsType<DifferentialAnalysisResult> = [
    {
      title: 'Analysis ID',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: 'Comparison Period',
      key: 'period',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text type="secondary">
            {dayjs(record.baselineScan.scanDate).format('MM-DD HH:mm')} → {dayjs(record.comparisonScan.scanDate).format('MM-DD HH:mm')}
          </Text>
          <Text strong>{record.baselineScan.accountName}</Text>
        </Space>
      ),
    },
    {
      title: 'Total Changes',
      dataIndex: 'totalChanges',
      key: 'totalChanges',
      render: (changes) => <Badge count={changes} showZero />,
    },
    {
      title: 'Resource Changes',
      key: 'resourceChanges',
      render: (_, record) => (
        <Space>
          <Tag color="green">+{record.resourceChanges.added}</Tag>
          <Tag color="red">-{record.resourceChanges.removed}</Tag>
          <Tag color="orange">~{record.resourceChanges.modified}</Tag>
        </Space>
      ),
    },
    {
      title: 'Security Impact',
      key: 'securityImpact',
      render: (_, record) => (
        <Space>
          <Tag color={getRiskLevelColor(record.securityImpact.riskLevel)}>
            {record.securityImpact.riskLevel}
          </Tag>
          <Text>
            {record.securityImpact.scoreChange > 0 ? '+' : ''}
            {record.securityImpact.scoreChange}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Analysis Date',
      dataIndex: 'analysisDate',
      key: 'analysisDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" onClick={() => setSelectedAnalysis(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const renderCompareInterface = () => (
    <Card
      title="Differential Analysis"
      extra={
        <Button
          type="primary"
          icon={<CompareOutlined />}
          onClick={() => setShowCompareModal(true)}
          disabled={loading}
        >
          Start New Analysis
        </Button>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Statistic
            title="Available Scans"
            value={scanResults.length}
            prefix={<HistoryOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Completed Analyses"
            value={differentialResults.length}
            prefix={<CompareOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Total Changes Detected"
            value={differentialResults.reduce((sum, r) => sum + r.totalChanges, 0)}
            prefix={<DiffOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Security Improvements"
            value={differentialResults.filter(r => r.securityImpact.riskLevel === 'DECREASED').length}
            prefix={<TrendingUpOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
      </Row>

      <Table
        columns={differentialColumns}
        dataSource={differentialResults}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderScanHistory = () => (
    <Card title="Scan History">
      <Table
        columns={scanColumns}
        dataSource={scanResults}
        rowKey="scanId"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );

  const renderAnalysisDetails = () => {
    if (!selectedAnalysis) {
      return (
        <Alert
          message="No Analysis Selected"
          description="Select a differential analysis from the list to view detailed results."
          type="info"
          showIcon
        />
      );
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Analysis Overview */}
        <Card title="Analysis Overview" size="small">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Total Changes"
                value={selectedAnalysis.totalChanges}
                prefix={<DiffOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Security Score Change"
                value={selectedAnalysis.securityImpact.scoreChange}
                precision={0}
                prefix={
                  selectedAnalysis.securityImpact.scoreChange > 0 ? 
                  <TrendingUpOutlined style={{ color: '#52c41a' }} /> : 
                  <TrendingDownOutlined style={{ color: '#ff4d4f' }} />
                }
                valueStyle={{ 
                  color: selectedAnalysis.securityImpact.scoreChange > 0 ? '#52c41a' : '#ff4d4f' 
                }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Risk Level"
                value={selectedAnalysis.securityImpact.riskLevel}
                valueStyle={{ 
                  color: getRiskLevelColor(selectedAnalysis.securityImpact.riskLevel) 
                }}
              />
            </Col>
          </Row>
        </Card>

        {/* Resource Changes */}
        <Card title="Resource Changes" size="small">
          <Tabs
            items={[
              {
                key: 'summary',
                label: 'Summary',
                children: (
                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Statistic
                        title="Added Resources"
                        value={selectedAnalysis.resourceChanges.added}
                        prefix={<PlusOutlined />}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="Removed Resources"
                        value={selectedAnalysis.resourceChanges.removed}
                        prefix={<MinusOutlined />}
                        valueStyle={{ color: '#ff4d4f' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="Modified Resources"
                        value={selectedAnalysis.resourceChanges.modified}
                        prefix={<DiffOutlined />}
                        valueStyle={{ color: '#fa8c16' }}
                      />
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'details',
                label: 'Detailed Changes',
                children: (
                  <Table
                    columns={resourceChangeColumns}
                    dataSource={selectedAnalysis.resourceChanges.differences}
                    rowKey={(record, index) => `${record.resourceType}-${index}`}
                    pagination={false}
                    size="small"
                  />
                ),
              },
            ]}
          />
        </Card>

        {/* Compliance Changes */}
        <Card title="Compliance Changes" size="small">
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="New Violations"
                value={selectedAnalysis.complianceChanges.newViolations}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Resolved Violations"
                value={selectedAnalysis.complianceChanges.resolvedViolations}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Status Changes"
                value={selectedAnalysis.complianceChanges.statusChanges}
                prefix={<InfoCircleOutlined />}
              />
            </Col>
          </Row>
        </Card>

        {/* Recommendations */}
        <Card title="Recommendations" size="small">
          <Timeline
            items={selectedAnalysis.recommendations.map((rec, index) => ({
              children: rec,
              dot: <InfoCircleOutlined />,
            }))}
          />
        </Card>
      </Space>
    );
  };

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'compare',
            label: 'Differential Analysis',
            children: renderCompareInterface(),
          },
          {
            key: 'history',
            label: 'Scan History',
            children: renderScanHistory(),
          },
          {
            key: 'details',
            label: 'Analysis Details',
            children: renderAnalysisDetails(),
          },
        ]}
      />

      {/* Compare Modal */}
      <Modal
        title="Start Differential Analysis"
        open={showCompareModal}
        onCancel={() => setShowCompareModal(false)}
        onOk={() => form.submit()}
        width={600}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={startDifferentialAnalysis}
        >
          <Form.Item
            name="baselineScanId"
            label="Baseline Scan"
            rules={[{ required: true, message: 'Please select a baseline scan' }]}
          >
            <Select placeholder="Select baseline scan">
              {scanResults.map(scan => (
                <Option key={scan.scanId} value={scan.scanId}>
                  {scan.accountName} - {dayjs(scan.scanDate).format('YYYY-MM-DD HH:mm')}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="comparisonScanId"
            label="Comparison Scan"
            rules={[{ required: true, message: 'Please select a comparison scan' }]}
          >
            <Select placeholder="Select comparison scan">
              {scanResults.map(scan => (
                <Option key={scan.scanId} value={scan.scanId}>
                  {scan.accountName} - {dayjs(scan.scanDate).format('YYYY-MM-DD HH:mm')}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="analysisType"
            label="Analysis Type"
            rules={[{ required: true, message: 'Please select analysis type' }]}
          >
            <Radio.Group>
              <Radio value="full">Full Analysis</Radio>
              <Radio value="security">Security Focus</Radio>
              <Radio value="compliance">Compliance Focus</Radio>
              <Radio value="resources">Resource Changes Only</Radio>
            </Radio.Group>
          </Form.Item>

          <Alert
            message="Analysis Information"
            description="Differential analysis will compare the selected scans and identify changes in resources, compliance status, and security posture. This process may take a few minutes."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default DifferentialAnalysis;