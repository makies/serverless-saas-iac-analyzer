import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloudOutlined,
  SafetyOutlined,
  BankOutlined,
  SettingOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import {
  Card,
  Col,
  Row,
  Typography,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Descriptions,
  Alert,
  Statistic,
  Tabs,
  Empty,
  Tooltip,
  Badge,
  Popconfirm,
  message,
} from 'antd';
import { useState, useEffect } from 'react';

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
  organizationId?: string;
  masterAccountId?: string;
  isActive: boolean;
  lastScanDate?: string;
  nextScanDate?: string;
  credentials?: any;
  settings?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface AwsAccountManagementProps {
  projectId: string;
  tenantId: string;
  accounts: AwsAccount[];
  loading?: boolean;
  onAddAccount?: (account: Partial<AwsAccount>) => void;
  onUpdateAccount?: (accountId: string, updates: Partial<AwsAccount>) => void;
  onDeleteAccount?: (accountId: string) => void;
  onTestConnection?: (accountId: string) => Promise<boolean>;
  onScanAccount?: (accountId: string) => void;
}

export default function AwsAccountManagement({
  projectId,
  tenantId,
  accounts,
  loading = false,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onTestConnection,
  onScanAccount,
}: AwsAccountManagementProps) {
  const [activeTabKey, setActiveTabKey] = useState('overview');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AwsAccount | null>(null);
  const [form] = Form.useForm();
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const handleAddAccount = () => {
    setEditingAccount(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditAccount = (account: AwsAccount) => {
    setEditingAccount(account);
    form.setFieldsValue(account);
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingAccount) {
        onUpdateAccount?.(editingAccount.id, values);
      } else {
        onAddAccount?.({
          ...values,
          projectId,
          tenantId,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'current-user', // TODO: Get from auth context
        });
      }
      
      setIsModalVisible(false);
      form.resetFields();
      message.success(editingAccount ? 'アカウントを更新しました' : 'アカウントを追加しました');
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleTestConnection = async (accountId: string) => {
    if (!onTestConnection) return;

    setTestingConnection(accountId);
    try {
      const success = await onTestConnection(accountId);
      message[success ? 'success' : 'error'](
        success ? '接続テストに成功しました' : '接続テストに失敗しました'
      );
    } catch (error) {
      message.error('接続テストでエラーが発生しました');
    } finally {
      setTestingConnection(null);
    }
  };

  const getEnvironmentColor = (environment: string) => {
    const colorMap = {
      PRODUCTION: 'red',
      STAGING: 'orange',
      DEVELOPMENT: 'blue',
      TEST: 'green',
      SANDBOX: 'purple',
    };
    return colorMap[environment as keyof typeof colorMap] || 'default';
  };

  const getOwnerColor = (owner: string) => {
    return owner === 'CUSTOMER' ? 'blue' : 'green';
  };

  const getSupportPlanColor = (plan: string) => {
    const colorMap = {
      BASIC: 'default',
      DEVELOPER: 'blue',
      BUSINESS: 'orange',
      ENTERPRISE: 'red',
      UNKNOWN: 'gray',
    };
    return colorMap[plan as keyof typeof colorMap] || 'default';
  };

  const getAccountStats = () => {
    const total = accounts.length;
    const active = accounts.filter(acc => acc.isActive).length;
    const byEnvironment = accounts.reduce((acc, account) => {
      acc[account.environment] = (acc[account.environment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const byOwner = accounts.reduce((acc, account) => {
      acc[account.owner] = (acc[account.owner] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, active, byEnvironment, byOwner };
  };

  const accountColumns = [
    {
      title: 'アカウント名',
      dataIndex: 'accountName',
      key: 'accountName',
      width: 200,
      render: (name: string, record: AwsAccount) => (
        <Space direction="vertical" size="small">
          <Text strong>{name}</Text>
          <Text code style={{ fontSize: '12px' }}>{record.accountId}</Text>
        </Space>
      ),
    },
    {
      title: '環境',
      dataIndex: 'environment',
      key: 'environment',
      width: 120,
      render: (environment: string) => (
        <Tag color={getEnvironmentColor(environment)}>{environment}</Tag>
      ),
    },
    {
      title: '所有者',
      dataIndex: 'owner',
      key: 'owner',
      width: 100,
      render: (owner: string) => (
        <Tag color={getOwnerColor(owner)}>
          {owner === 'CUSTOMER' ? '顧客企業' : '弊社'}
        </Tag>
      ),
    },
    {
      title: 'サポートプラン',
      dataIndex: 'supportPlan',
      key: 'supportPlan',
      width: 120,
      render: (plan: string) => (
        <Tag color={getSupportPlanColor(plan)}>{plan}</Tag>
      ),
    },
    {
      title: 'リージョン',
      dataIndex: 'region',
      key: 'region',
      width: 120,
    },
    {
      title: 'ステータス',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'error'}
          text={isActive ? 'アクティブ' : '非アクティブ'}
        />
      ),
    },
    {
      title: '最終スキャン',
      dataIndex: 'lastScanDate',
      key: 'lastScanDate',
      width: 150,
      render: (date: string) => date ? new Date(date).toLocaleDateString('ja-JP') : '-',
    },
    {
      title: 'アクション',
      key: 'actions',
      width: 200,
      render: (_, record: AwsAccount) => (
        <Space>
          <Tooltip title="接続テスト">
            <Button
              size="small"
              icon={<SafetyOutlined />}
              loading={testingConnection === record.id}
              onClick={() => handleTestConnection(record.id)}
            />
          </Tooltip>
          <Tooltip title="スキャン実行">
            <Button
              size="small"
              icon={<ScanOutlined />}
              onClick={() => onScanAccount?.(record.id)}
            />
          </Tooltip>
          <Tooltip title="編集">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditAccount(record)}
            />
          </Tooltip>
          <Popconfirm
            title="このアカウントを削除しますか？"
            onConfirm={() => onDeleteAccount?.(record.id)}
            okText="削除"
            cancelText="キャンセル"
          >
            <Tooltip title="削除">
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stats = getAccountStats();

  const tabItems = [
    {
      key: 'overview',
      label: '概要',
      children: (
        <Row gutter={[24, 24]}>
          {/* 統計情報 */}
          <Col span={24}>
            <Card title="アカウント統計">
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="総アカウント数"
                    value={stats.total}
                    prefix={<CloudOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="アクティブアカウント"
                    value={stats.active}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="顧客企業アカウント"
                    value={stats.byOwner.CUSTOMER || 0}
                    prefix={<BankOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="弊社アカウント"
                    value={stats.byOwner.COMPANY || 0}
                    prefix={<SettingOutlined />}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 環境別分布 */}
          <Col span={12}>
            <Card title="環境別分布" size="small">
              <Row gutter={[8, 8]}>
                {Object.entries(stats.byEnvironment).map(([env, count]) => (
                  <Col span={24} key={env}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tag color={getEnvironmentColor(env)}>{env}</Tag>
                      <Text strong>{count}</Text>
                    </Space>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          {/* 推奨事項 */}
          <Col span={12}>
            <Card title="推奨事項" size="small">
              {stats.total === 0 ? (
                <Alert
                  message="AWSアカウントが設定されていません"
                  description="プロジェクトにAWSアカウントを追加して、ライブスキャン機能を有効化してください。"
                  type="info"
                  showIcon
                />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {!stats.byEnvironment.PRODUCTION && (
                    <Alert
                      message="本番環境のアカウントが設定されていません"
                      type="warning"
                      size="small"
                      showIcon
                    />
                  )}
                  {stats.active < stats.total && (
                    <Alert
                      message={`${stats.total - stats.active}個の非アクティブアカウントがあります`}
                      type="info"
                      size="small"
                      showIcon
                    />
                  )}
                </Space>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'accounts',
      label: `アカウント一覧 (${accounts.length})`,
      children: (
        <Card
          title="AWSアカウント一覧"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddAccount}
            >
              アカウント追加
            </Button>
          }
        >
          {accounts.length > 0 ? (
            <Table
              columns={accountColumns}
              dataSource={accounts.map(account => ({
                ...account,
                key: account.id,
              }))}
              pagination={{ pageSize: 10 }}
              loading={loading}
              size="middle"
            />
          ) : (
            <Empty
              description="AWSアカウントが設定されていません"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAccount}>
                最初のアカウントを追加
              </Button>
            </Empty>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTabKey}
        onChange={setActiveTabKey}
        items={tabItems}
        size="large"
      />

      {/* アカウント追加・編集モーダル */}
      <Modal
        title={editingAccount ? 'AWSアカウント編集' : 'AWSアカウント追加'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        okText={editingAccount ? '更新' : '追加'}
        cancelText="キャンセル"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            environment: 'DEVELOPMENT',
            region: 'ap-northeast-1',
            owner: 'CUSTOMER',
            supportPlan: 'UNKNOWN',
            isActive: true,
          }}
        >
          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                name="accountName"
                label="アカウント名"
                rules={[{ required: true, message: 'アカウント名を入力してください' }]}
              >
                <Input placeholder="例: MyCompany-Production" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="accountId"
                label="AWSアカウントID"
                rules={[
                  { required: true, message: 'AWSアカウントIDを入力してください' },
                  { pattern: /^\d{12}$/, message: '12桁の数字を入力してください' },
                ]}
              >
                <Input placeholder="123456789012" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                name="environment"
                label="環境"
                rules={[{ required: true, message: '環境を選択してください' }]}
              >
                <Select>
                  <Option value="PRODUCTION">本番環境</Option>
                  <Option value="STAGING">ステージング環境</Option>
                  <Option value="DEVELOPMENT">開発環境</Option>
                  <Option value="TEST">テスト環境</Option>
                  <Option value="SANDBOX">サンドボックス環境</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="owner"
                label="所有者"
                rules={[{ required: true, message: '所有者を選択してください' }]}
              >
                <Select>
                  <Option value="CUSTOMER">顧客企業</Option>
                  <Option value="COMPANY">弊社</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                name="region"
                label="メインリージョン"
                rules={[{ required: true, message: 'リージョンを選択してください' }]}
              >
                <Select>
                  <Option value="ap-northeast-1">Asia Pacific (Tokyo)</Option>
                  <Option value="us-east-1">US East (N. Virginia)</Option>
                  <Option value="us-west-2">US West (Oregon)</Option>
                  <Option value="eu-west-1">Europe (Ireland)</Option>
                  <Option value="ap-southeast-1">Asia Pacific (Singapore)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="supportPlan"
                label="サポートプラン"
              >
                <Select>
                  <Option value="BASIC">Basic</Option>
                  <Option value="DEVELOPER">Developer</Option>
                  <Option value="BUSINESS">Business</Option>
                  <Option value="ENTERPRISE">Enterprise</Option>
                  <Option value="UNKNOWN">不明</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="roleArn"
            label="IAMロールARN"
            rules={[
              { required: true, message: 'IAMロールARNを入力してください' },
              { pattern: /^arn:aws:iam::\d{12}:role\//, message: '正しいARN形式を入力してください' },
            ]}
          >
            <Input placeholder="arn:aws:iam::123456789012:role/CloudBPA-ReadOnlyRole" />
          </Form.Item>

          <Form.Item
            name="externalId"
            label="External ID（オプション）"
          >
            <Input placeholder="セキュリティ強化のためのExternal ID" />
          </Form.Item>

          <Row gutter={[16, 0]}>
            <Col span={12}>
              <Form.Item
                name="organizationId"
                label="AWS Organizations ID（オプション）"
              >
                <Input placeholder="o-example1234567" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="masterAccountId"
                label="マスターアカウントID（オプション）"
              >
                <Input placeholder="123456789012" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isActive"
            label="アクティブ"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}