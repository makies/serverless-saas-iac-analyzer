import {
  ArrowLeftOutlined,
  CloudOutlined,
  CodeOutlined,
  FileTextOutlined,
  SettingOutlined,
  TeamOutlined,
  BarChartOutlined,
  ScheduleOutlined,
  ScanOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import {
  Breadcrumb,
  Button,
  Card,
  Col,
  Row,
  Space,
  Tabs,
  Typography,
  Tag,
  Statistic,
  Alert,
} from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AwsAccountManagement from '../components/AwsAccountManagement';
import MultiAccountScanManager from '../components/MultiAccountScanManager';
import ScanScheduleManager from '../components/ScanScheduleManager';
import DifferentialAnalysis from '../components/DifferentialAnalysis';

const { Title, Text } = Typography;

interface Project {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  memberIds: string[];
  settings?: any;
  metrics?: any;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

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
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export default function ProjectDetails() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user } = useAuth();
  const [activeTabKey, setActiveTabKey] = useState('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [awsAccounts, setAwsAccounts] = useState<AwsAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    if (!projectId) {
      console.warn('No projectId provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading project data for ID:', projectId);

      // Mock data for now - replace with actual GraphQL queries
      const mockProject: Project = {
        id: projectId,
        tenantId: 'tenant-1',
        name: 'エンタープライズ基盤システム',
        description: '本社系システムのAWS基盤プロジェクト。本番、ステージング、開発環境を管理。',
        status: 'ACTIVE',
        memberIds: ['user-1', 'user-2', 'user-3'],
        settings: {
          defaultFramework: 'WELL_ARCHITECTED',
          notifications: true,
          autoScan: true,
        },
        metrics: {
          totalAnalyses: 45,
          lastAnalysis: '2024-01-15T10:30:00Z',
          avgScore: 78,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        createdBy: 'user-1',
      };

      const mockAwsAccounts: AwsAccount[] = [
        {
          id: 'acc-1',
          accountId: '123456789012',
          accountName: 'MyCompany-Production',
          environment: 'PRODUCTION',
          region: 'ap-northeast-1',
          roleArn: 'arn:aws:iam::123456789012:role/CloudBPA-ReadOnlyRole',
          externalId: 'external-id-prod',
          owner: 'CUSTOMER',
          supportPlan: 'BUSINESS',
          organizationId: 'o-example1234',
          masterAccountId: '123456789012',
          isActive: true,
          lastScanDate: '2024-01-15T08:00:00Z',
          nextScanDate: '2024-01-16T08:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T08:00:00Z',
          createdBy: 'user-1',
        },
        {
          id: 'acc-2',
          accountId: '234567890123',
          accountName: 'MyCompany-Staging',
          environment: 'STAGING',
          region: 'ap-northeast-1',
          roleArn: 'arn:aws:iam::234567890123:role/CloudBPA-ReadOnlyRole',
          owner: 'COMPANY',
          supportPlan: 'DEVELOPER',
          isActive: true,
          lastScanDate: '2024-01-15T08:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-15T08:00:00Z',
          createdBy: 'user-1',
        },
        {
          id: 'acc-3',
          accountId: '345678901234',
          accountName: 'MyCompany-Development',
          environment: 'DEVELOPMENT',
          region: 'ap-northeast-1',
          roleArn: 'arn:aws:iam::345678901234:role/CloudBPA-ReadOnlyRole',
          owner: 'COMPANY',
          supportPlan: 'BASIC',
          isActive: true,
          lastScanDate: '2024-01-14T20:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-14T20:00:00Z',
          createdBy: 'user-2',
        },
      ];

      setProject(mockProject);
      setAwsAccounts(mockAwsAccounts);
    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = (account: Partial<AwsAccount>) => {
    console.log('Adding account:', account);
    // TODO: Implement actual account creation
    const newAccount: AwsAccount = {
      ...account,
      id: `acc-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.sub || 'current-user',
    } as AwsAccount;
    
    setAwsAccounts(prev => [...prev, newAccount]);
  };

  const handleUpdateAccount = (accountId: string, updates: Partial<AwsAccount>) => {
    console.log('Updating account:', accountId, updates);
    // TODO: Implement actual account update
    setAwsAccounts(prev =>
      prev.map(account =>
        account.id === accountId
          ? { ...account, ...updates, updatedAt: new Date().toISOString() }
          : account
      )
    );
  };

  const handleDeleteAccount = (accountId: string) => {
    console.log('Deleting account:', accountId);
    // TODO: Implement actual account deletion
    setAwsAccounts(prev => prev.filter(account => account.id !== accountId));
  };

  const handleTestConnection = async (accountId: string): Promise<boolean> => {
    console.log('Testing connection for account:', accountId);
    // TODO: Implement actual connection test
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    return Math.random() > 0.3; // 70% success rate for demo
  };

  const handleScanAccount = (accountId: string) => {
    console.log('Starting scan for account:', accountId);
    // TODO: Implement actual scan initiation
    navigate(`/analysis/new?accountId=${accountId}&projectId=${projectId}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return <div>Project not found</div>;
  }

  const getStatusColor = (status: string) => {
    const colorMap = {
      ACTIVE: 'success',
      INACTIVE: 'warning',
      ARCHIVED: 'default',
    };
    return colorMap[status as keyof typeof colorMap] || 'default';
  };

  const getProjectStats = () => {
    const totalAccounts = awsAccounts.length;
    const activeAccounts = awsAccounts.filter(acc => acc.isActive).length;
    const productionAccounts = awsAccounts.filter(acc => acc.environment === 'PRODUCTION').length;
    const customerAccounts = awsAccounts.filter(acc => acc.owner === 'CUSTOMER').length;

    return { totalAccounts, activeAccounts, productionAccounts, customerAccounts };
  };

  const stats = getProjectStats();

  const tabItems = [
    {
      key: 'overview',
      label: 'プロジェクト概要',
      icon: <BarChartOutlined />,
      children: (
        <Row gutter={[24, 24]}>
          {/* プロジェクト基本情報 */}
          <Col span={24}>
            <Card title="プロジェクト情報">
              <Row gutter={[16, 16]}>
                <Col span={18}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">プロジェクト名</Text>
                      <br />
                      <Title level={4} style={{ margin: 0 }}>{project.name}</Title>
                    </div>
                    <div>
                      <Text type="secondary">説明</Text>
                      <br />
                      <Text>{project.description || 'プロジェクトの説明がありません'}</Text>
                    </div>
                    <div>
                      <Text type="secondary">ステータス</Text>
                      <br />
                      <Tag color={getStatusColor(project.status)} style={{ marginTop: 4 }}>
                        {project.status}
                      </Tag>
                    </div>
                  </Space>
                </Col>
                <Col span={6}>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">作成日</Text>
                      <br />
                      <Text>{new Date(project.createdAt).toLocaleDateString('ja-JP')}</Text>
                    </div>
                    <div>
                      <Text type="secondary">最終更新</Text>
                      <br />
                      <Text>{new Date(project.updatedAt).toLocaleDateString('ja-JP')}</Text>
                    </div>
                    <div>
                      <Text type="secondary">メンバー数</Text>
                      <br />
                      <Text>{project.memberIds.length}人</Text>
                    </div>
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 統計情報 */}
          <Col span={24}>
            <Card title="アカウント統計">
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="総AWSアカウント数"
                    value={stats.totalAccounts}
                    prefix={<CloudOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="アクティブアカウント"
                    value={stats.activeAccounts}
                    prefix={<CloudOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="本番環境アカウント"
                    value={stats.productionAccounts}
                    prefix={<CloudOutlined />}
                    valueStyle={{ color: '#fa541c' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="顧客企業アカウント"
                    value={stats.customerAccounts}
                    prefix={<CloudOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* アカウント概要 */}
          <Col span={24}>
            <Card title="AWSアカウント概要">
              {awsAccounts.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {awsAccounts.map(account => (
                    <Col span={8} key={account.id}>
                      <Card size="small" title={account.accountName}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div>
                            <Tag color={account.environment === 'PRODUCTION' ? 'red' : 'blue'}>
                              {account.environment}
                            </Tag>
                            <Tag color={account.owner === 'CUSTOMER' ? 'purple' : 'green'}>
                              {account.owner === 'CUSTOMER' ? '顧客企業' : '弊社'}
                            </Tag>
                          </div>
                          <Text code>{account.accountId}</Text>
                          <Text type="secondary">{account.region}</Text>
                          <Text type="secondary">
                            最終スキャン: {account.lastScanDate ? 
                              new Date(account.lastScanDate).toLocaleDateString('ja-JP') : 
                              'なし'
                            }
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Alert
                  message="AWSアカウントが設定されていません"
                  description="AWSアカウントタブからアカウントを追加してください。"
                  type="info"
                  showIcon
                />
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'aws-accounts',
      label: 'AWSアカウント',
      icon: <CloudOutlined />,
      children: (
        <AwsAccountManagement
          projectId={project.id}
          tenantId={project.tenantId}
          accounts={awsAccounts}
          loading={loading}
          onAddAccount={handleAddAccount}
          onUpdateAccount={handleUpdateAccount}
          onDeleteAccount={handleDeleteAccount}
          onTestConnection={handleTestConnection}
          onScanAccount={handleScanAccount}
        />
      ),
    },
    {
      key: 'multi-scan',
      label: '一括ライブスキャン',
      icon: <ScanOutlined />,
      children: (
        <MultiAccountScanManager
          projectId={project.id}
          tenantId={project.tenantId}
          accounts={awsAccounts}
          onScanStarted={(scanId) => {
            console.log('Multi-account scan started:', scanId);
          }}
          onScanCompleted={(scanId, results) => {
            console.log('Multi-account scan completed:', scanId, results);
          }}
        />
      ),
    },
    {
      key: 'differential',
      label: '差分分析',
      icon: <DiffOutlined />,
      children: (
        <DifferentialAnalysis
          projectId={project.id}
          tenantId={project.tenantId}
          accounts={awsAccounts.map(acc => ({
            id: acc.id,
            accountId: acc.accountId,
            accountName: acc.accountName,
            environment: acc.environment,
          }))}
        />
      ),
    },
    {
      key: 'repositories',
      label: 'リポジトリ',
      icon: <CodeOutlined />,
      children: (
        <Card title="Git リポジトリ管理">
          <Alert
            message="リポジトリ管理機能"
            description="Git リポジトリの連携と分析スケジュール設定機能は今後実装予定です。"
            type="info"
            showIcon
          />
        </Card>
      ),
    },
    {
      key: 'schedules',
      label: 'スケジュール',
      icon: <ScheduleOutlined />,
      children: (
        <ScanScheduleManager
          projectId={project.id}
          tenantId={project.tenantId}
          accounts={awsAccounts}
          onScheduleCreated={(schedule) => {
            console.log('Schedule created:', schedule);
          }}
          onScheduleUpdated={(scheduleId, schedule) => {
            console.log('Schedule updated:', scheduleId, schedule);
          }}
          onScheduleDeleted={(scheduleId) => {
            console.log('Schedule deleted:', scheduleId);
          }}
        />
      ),
    },
    {
      key: 'reports',
      label: 'レポート',
      icon: <FileTextOutlined />,
      children: (
        <Card title="プロジェクトレポート">
          <Alert
            message="レポート機能"
            description="プロジェクト横断レポート生成機能は今後実装予定です。"
            type="info"
            showIcon
          />
        </Card>
      ),
    },
    {
      key: 'members',
      label: 'メンバー',
      icon: <TeamOutlined />,
      children: (
        <Card title="プロジェクトメンバー管理">
          <Alert
            message="メンバー管理機能"
            description="プロジェクトメンバーの追加・削除・権限管理機能は今後実装予定です。"
            type="info"
            showIcon
          />
        </Card>
      ),
    },
    {
      key: 'settings',
      label: '設定',
      icon: <SettingOutlined />,
      children: (
        <Card title="プロジェクト設定">
          <Alert
            message="設定機能"
            description="プロジェクト設定（通知、デフォルトフレームワーク等）機能は今後実装予定です。"
            type="info"
            showIcon
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* ヘッダー */}
      <Row style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Space style={{ marginBottom: 16 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/projects')}
            >
              プロジェクト一覧に戻る
            </Button>
          </Space>
          
          <Breadcrumb style={{ marginBottom: 16 }}>
            <Breadcrumb.Item>
              <a onClick={() => navigate('/dashboard')}>ダッシュボード</a>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <a onClick={() => navigate('/projects')}>プロジェクト</a>
            </Breadcrumb.Item>
            <Breadcrumb.Item>{project.name}</Breadcrumb.Item>
          </Breadcrumb>
          
          <Title level={2}>{project.name}</Title>
        </Col>
      </Row>

      {/* メインコンテンツ */}
      <Tabs
        activeKey={activeTabKey}
        onChange={setActiveTabKey}
        items={tabItems}
        size="large"
      />
    </div>
  );
}