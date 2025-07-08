import {
  SafetyOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  BugOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Card,
  Col,
  Row,
  Typography,
  Table,
  Tag,
  Space,
  Descriptions,
  Alert,
  Statistic,
  Tabs,
  Progress,
  Empty,
  List,
  Tooltip,
} from 'antd';
import { useState } from 'react';

const { Title, Text } = Typography;

interface SupportPlan {
  planName: string;
  planType: 'BASIC' | 'DEVELOPER' | 'BUSINESS' | 'ENTERPRISE' | 'UNKNOWN';
  trustedAdvisorAccess: boolean;
  caseManagementAccess: boolean;
  checksAvailable: number;
  features: {
    trustedAdvisor: boolean;
    caseManagement: boolean;
    phoneSupport: boolean;
    chatSupport: boolean;
    architecturalGuidance: boolean;
    infrastructureEventManagement: boolean;
  };
  error?: string;
}

interface TrustedAdvisorCheck {
  id: string;
  name: string;
  category: string;
  status: 'ok' | 'warning' | 'error' | 'info';
  description: string;
}

interface SupportData {
  plan: SupportPlan;
  trustedAdvisorChecks?: TrustedAdvisorCheck[];
}

interface SupportViewProps {
  data: SupportData;
  loading?: boolean;
}

export default function SupportView({ data, loading }: SupportViewProps) {
  const [activeTabKey, setActiveTabKey] = useState('plan');

  if (loading) {
    return (
      <Card loading={true}>
        <div style={{ height: '200px' }} />
      </Card>
    );
  }

  if (!data.plan) {
    return (
      <Alert
        message="サポートプラン情報が取得できません"
        description="AWSサポートプランの情報を取得することができませんでした。IAM権限またはサポートプランの設定を確認してください。"
        type="error"
        showIcon
        icon={<ExclamationCircleOutlined />}
      />
    );
  }

  const getPlanColor = (planType: string) => {
    const colorMap = {
      BASIC: 'default',
      DEVELOPER: 'blue',
      BUSINESS: 'orange',
      ENTERPRISE: 'red',
      UNKNOWN: 'default',
    };
    return colorMap[planType as keyof typeof colorMap] || 'default';
  };

  const getFeatureIcon = (enabled: boolean) => {
    return enabled ? (
      <CheckCircleOutlined style={{ color: '#52c41a' }} />
    ) : (
      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    );
  };

  const getCheckStatusIcon = (status: string) => {
    const iconMap = {
      ok: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      warning: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
      error: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      info: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
    };
    return iconMap[status as keyof typeof iconMap] || <InfoCircleOutlined />;
  };

  const getCheckStatusColor = (status: string) => {
    const colorMap = {
      ok: 'success',
      warning: 'warning',
      error: 'error',
      info: 'default',
    };
    return colorMap[status as keyof typeof colorMap] || 'default';
  };

  const checkColumns = [
    {
      title: 'チェック名',
      dataIndex: 'name',
      key: 'name',
      width: 300,
    },
    {
      title: 'カテゴリ',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category: string) => (
        <Tag color="blue">{category}</Tag>
      ),
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Space>
          {getCheckStatusIcon(status)}
          <Tag color={getCheckStatusColor(status)}>
            {status.toUpperCase()}
          </Tag>
        </Space>
      ),
    },
    {
      title: '説明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  const getCheckCategoryStats = () => {
    if (!data.trustedAdvisorChecks) return {};
    
    return data.trustedAdvisorChecks.reduce((acc, check) => {
      acc[check.category] = (acc[check.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const getCheckStatusStats = () => {
    if (!data.trustedAdvisorChecks) return {};
    
    return data.trustedAdvisorChecks.reduce((acc, check) => {
      acc[check.status] = (acc[check.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const getSupportRecommendations = () => {
    const recommendations: string[] = [];
    
    if (data.plan.planType === 'BASIC') {
      recommendations.push('本番環境では最低でもDeveloper Support以上のプランを推奨します');
      recommendations.push('ケース管理機能を利用するためにDeveloper Support以上にアップグレードしてください');
    }
    
    if (data.plan.planType === 'DEVELOPER') {
      recommendations.push('Trusted Advisorの完全機能を利用するためにBusiness Support以上にアップグレードしてください');
      recommendations.push('24時間サポートが必要な場合はBusiness Support以上を検討してください');
    }
    
    if (data.plan.planType === 'BUSINESS') {
      recommendations.push('アーキテクチャレビューやインフラ管理が必要な場合はEnterprise Supportを検討してください');
      recommendations.push('専任のTechnical Account Manager (TAM)が必要な場合はEnterprise Supportにアップグレードしてください');
    }
    
    if (!data.plan.trustedAdvisorAccess) {
      recommendations.push('コスト最適化とセキュリティ向上のためにTrusted Advisor機能を有効化してください');
    }
    
    return recommendations;
  };

  const tabItems = [
    {
      key: 'plan',
      label: 'サポートプラン',
      children: (
        <Row gutter={[24, 24]}>
          {/* プラン基本情報 */}
          <Col span={24}>
            <Card title="サポートプラン基本情報">
              <Descriptions column={2}>
                <Descriptions.Item label="プラン名">
                  <Space>
                    <Tag color={getPlanColor(data.plan.planType)} style={{ fontSize: '14px', padding: '4px 8px' }}>
                      {data.plan.planName}
                    </Tag>
                    {data.plan.planType === 'BASIC' && (
                      <Tooltip title="無料プランですが、機能が制限されています">
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                      </Tooltip>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Trusted Advisorアクセス">
                  <Space>
                    {getFeatureIcon(data.plan.trustedAdvisorAccess)}
                    <Text>{data.plan.trustedAdvisorAccess ? '利用可能' : '制限あり'}</Text>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="ケース管理">
                  <Space>
                    {getFeatureIcon(data.plan.caseManagementAccess)}
                    <Text>{data.plan.caseManagementAccess ? '利用可能' : '利用不可'}</Text>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="利用可能チェック数">
                  <Text strong style={{ fontSize: '16px' }}>{data.plan.checksAvailable}</Text>
                </Descriptions.Item>
              </Descriptions>
              
              {data.plan.error && (
                <Alert
                  message="情報取得エラー"
                  description={data.plan.error}
                  type="warning"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          </Col>

          {/* 機能詳細 */}
          <Col span={12}>
            <Card title="利用可能な機能" size="small">
              <List
                size="small"
                dataSource={[
                  { key: 'trustedAdvisor', label: 'Trusted Advisor', enabled: data.plan.features.trustedAdvisor, icon: <SafetyOutlined /> },
                  { key: 'caseManagement', label: 'ケース管理', enabled: data.plan.features.caseManagement, icon: <BugOutlined /> },
                  { key: 'phoneSupport', label: '電話サポート', enabled: data.plan.features.phoneSupport, icon: <PhoneOutlined /> },
                  { key: 'chatSupport', label: 'チャットサポート', enabled: data.plan.features.chatSupport, icon: <MessageOutlined /> },
                  { key: 'architecturalGuidance', label: 'アーキテクチャガイダンス', enabled: data.plan.features.architecturalGuidance, icon: <ToolOutlined /> },
                  { key: 'infrastructureEventManagement', label: 'インフライベント管理', enabled: data.plan.features.infrastructureEventManagement, icon: <TeamOutlined /> },
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      {item.icon}
                      <Text style={{ color: item.enabled ? '#000' : '#999' }}>
                        {item.label}
                      </Text>
                      {getFeatureIcon(item.enabled)}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* 推奨事項 */}
          <Col span={12}>
            <Card title="推奨改善事項" size="small">
              {getSupportRecommendations().length > 0 ? (
                <List
                  size="small"
                  dataSource={getSupportRecommendations()}
                  renderItem={(item) => (
                    <List.Item>
                      <Space align="start">
                        <ExclamationCircleOutlined style={{ color: '#faad14', marginTop: '4px' }} />
                        <Text>{item}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty 
                  description="現在のサポートプランは適切に設定されています"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Col>

          {/* サポートレベル比較 */}
          <Col span={24}>
            <Card title="サポートプラン比較">
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Card size="small" title="Basic" style={{ textAlign: 'center' }}>
                    <Space direction="vertical">
                      <Text>$0/月</Text>
                      <Text type="secondary">無料</Text>
                      <Tag color="default">現在選択中</Tag>
                    </Space>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" title="Developer" style={{ textAlign: 'center' }}>
                    <Space direction="vertical">
                      <Text>$29/月</Text>
                      <Text type="secondary">または3%課金</Text>
                      <Tag color="blue">ケース管理</Tag>
                    </Space>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" title="Business" style={{ textAlign: 'center' }}>
                    <Space direction="vertical">
                      <Text>$100/月</Text>
                      <Text type="secondary">または10%課金</Text>
                      <Tag color="orange">Trusted Advisor</Tag>
                    </Space>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" title="Enterprise" style={{ textAlign: 'center' }}>
                    <Space direction="vertical">
                      <Text>$15,000/月</Text>
                      <Text type="secondary">または10%課金</Text>
                      <Tag color="red">TAM付き</Tag>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'trustedadvisor',
      label: `Trusted Advisor (${data.trustedAdvisorChecks?.length || 0})`,
      disabled: !data.plan.trustedAdvisorAccess,
      children: (
        <Row gutter={[24, 24]}>
          {/* 統計情報 */}
          <Col span={24}>
            <Card title="チェック統計">
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="総チェック数"
                    value={data.trustedAdvisorChecks?.length || 0}
                    prefix={<SafetyOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="OK"
                    value={getCheckStatusStats().ok || 0}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="警告"
                    value={getCheckStatusStats().warning || 0}
                    prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="エラー"
                    value={getCheckStatusStats().error || 0}
                    prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* カテゴリ分布 */}
          <Col span={12}>
            <Card title="カテゴリ分布" size="small">
              <Row gutter={[8, 8]}>
                {Object.entries(getCheckCategoryStats()).map(([category, count]) => (
                  <Col span={24} key={category}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tag color="blue">{category}</Tag>
                      <Text strong>{count}</Text>
                    </Space>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          {/* 健全性スコア */}
          <Col span={12}>
            <Card title="健全性スコア" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Progress
                  type="circle"
                  percent={Math.round(((getCheckStatusStats().ok || 0) / (data.trustedAdvisorChecks?.length || 1)) * 100)}
                  format={(percent) => `${percent}%`}
                  strokeColor={{
                    '0%': '#ff4d4f',
                    '50%': '#faad14',
                    '100%': '#52c41a',
                  }}
                />
                <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                  正常なチェックの割合
                </Text>
              </Space>
            </Card>
          </Col>

          {/* チェック一覧 */}
          <Col span={24}>
            <Card title="Trusted Advisorチェック一覧">
              {data.trustedAdvisorChecks && data.trustedAdvisorChecks.length > 0 ? (
                <Table
                  columns={checkColumns}
                  dataSource={data.trustedAdvisorChecks.map(check => ({
                    ...check,
                    key: check.id,
                  }))}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                />
              ) : (
                <Empty description="Trusted Advisorチェックデータがありません" />
              )}
            </Card>
          </Col>
        </Row>
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
    </div>
  );
}