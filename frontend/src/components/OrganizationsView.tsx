import {
  ApartmentOutlined,
  BankOutlined,
  SettingOutlined,
  TeamOutlined,
  FileProtectOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  Card,
  Col,
  Row,
  Typography,
  Tree,
  Table,
  Tag,
  Space,
  Descriptions,
  Alert,
  Statistic,
  Tabs,
  Empty,
  Tooltip,
} from 'antd';
import { useState } from 'react';

const { Title, Text } = Typography;

interface OrganizationData {
  organization?: {
    id: string;
    masterAccountId: string;
    masterAccountEmail: string;
    featureSet: 'ALL_FEATURES' | 'CONSOLIDATED_BILLING';
    arn: string;
  };
  accounts: Array<{
    id: string;
    name: string;
    email: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_CLOSURE';
    joinedMethod: 'INVITED' | 'CREATED';
    joinedTimestamp: string;
  }>;
  organizationalUnits: Array<{
    id: string;
    name: string;
    parentId?: string;
    type: 'ROOT' | 'ORGANIZATIONAL_UNIT';
    accounts?: string[];
  }>;
  policies: Array<{
    id: string;
    name: string;
    type: 'SERVICE_CONTROL_POLICY' | 'TAG_POLICY' | 'BACKUP_POLICY' | 'AISERVICES_OPT_OUT_POLICY';
    awsManaged: boolean;
    description?: string;
    content?: string;
  }>;
}

interface OrganizationsViewProps {
  data: OrganizationData;
  loading?: boolean;
}

export default function OrganizationsView({ data, loading }: OrganizationsViewProps) {
  const [selectedOU, setSelectedOU] = useState<string | null>(null);
  const [activeTabKey, setActiveTabKey] = useState('overview');

  if (loading) {
    return (
      <Card loading={true}>
        <div style={{ height: '200px' }} />
      </Card>
    );
  }

  if (!data.organization && data.accounts.length === 0) {
    return (
      <Alert
        message="AWS Organizations未設定"
        description="このAWSアカウントはAWS Organizationsに参加していません。マルチアカウント管理のため、AWS Organizationsの設定を推奨します。"
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
      />
    );
  }

  // Build tree data for organizational structure
  const buildTreeData = () => {
    const treeData: any[] = [];
    
    if (data.organization) {
      // Add root organization
      const rootNode = {
        title: (
          <Space>
            <BankOutlined />
            <Text strong>組織ルート</Text>
            <Tag color="blue">{data.organization.featureSet}</Tag>
          </Space>
        ),
        key: 'root',
        icon: <BankOutlined />,
        children: [],
      };

      // Add organizational units
      const ouMap = new Map();
      data.organizationalUnits.forEach(ou => {
        ouMap.set(ou.id, {
          title: (
            <Space>
              <ApartmentOutlined />
              <Text>{ou.name}</Text>
              <Tag color="green">{ou.type}</Tag>
            </Space>
          ),
          key: ou.id,
          icon: <ApartmentOutlined />,
          children: [],
        });
      });

      // Build hierarchy
      data.organizationalUnits.forEach(ou => {
        const node = ouMap.get(ou.id);
        if (ou.parentId && ouMap.has(ou.parentId)) {
          ouMap.get(ou.parentId).children.push(node);
        } else {
          rootNode.children.push(node);
        }
      });

      treeData.push(rootNode);
    }

    return treeData;
  };

  const accountColumns = [
    {
      title: 'アカウントID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <Text code>{id}</Text>,
    },
    {
      title: 'アカウント名',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'メールアドレス',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap = {
          ACTIVE: 'success',
          SUSPENDED: 'error',
          PENDING_CLOSURE: 'warning',
        };
        return <Tag color={colorMap[status as keyof typeof colorMap]}>{status}</Tag>;
      },
    },
    {
      title: '参加方法',
      dataIndex: 'joinedMethod',
      key: 'joinedMethod',
      width: 100,
      render: (method: string) => (
        <Tag color={method === 'CREATED' ? 'blue' : 'orange'}>{method}</Tag>
      ),
    },
    {
      title: '参加日時',
      dataIndex: 'joinedTimestamp',
      key: 'joinedTimestamp',
      width: 150,
      render: (timestamp: string) => 
        new Date(timestamp).toLocaleDateString('ja-JP'),
    },
  ];

  const policyColumns = [
    {
      title: 'ポリシー名',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'タイプ',
      dataIndex: 'type',
      key: 'type',
      width: 180,
      render: (type: string) => {
        const colorMap = {
          SERVICE_CONTROL_POLICY: 'red',
          TAG_POLICY: 'blue',
          BACKUP_POLICY: 'green',
          AISERVICES_OPT_OUT_POLICY: 'orange',
        };
        return <Tag color={colorMap[type as keyof typeof colorMap]}>{type}</Tag>;
      },
    },
    {
      title: '管理者',
      dataIndex: 'awsManaged',
      key: 'awsManaged',
      width: 100,
      render: (awsManaged: boolean) => (
        <Tag color={awsManaged ? 'purple' : 'cyan'}>
          {awsManaged ? 'AWS管理' : '顧客管理'}
        </Tag>
      ),
    },
    {
      title: '説明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description: string) => description || '-',
    },
  ];

  const getAccountStatusStats = () => {
    const stats = data.accounts.reduce((acc, account) => {
      acc[account.status] = (acc[account.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return stats;
  };

  const getPolicyTypeStats = () => {
    const stats = data.policies.reduce((acc, policy) => {
      acc[policy.type] = (acc[policy.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return stats;
  };

  const tabItems = [
    {
      key: 'overview',
      label: '概要',
      children: (
        <Row gutter={[24, 24]}>
          {/* 組織基本情報 */}
          {data.organization && (
            <Col span={24}>
              <Card title="組織基本情報">
                <Descriptions column={2}>
                  <Descriptions.Item label="組織ID">
                    <Text code>{data.organization.id}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="機能セット">
                    <Tag color={data.organization.featureSet === 'ALL_FEATURES' ? 'green' : 'orange'}>
                      {data.organization.featureSet}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="マスターアカウントID">
                    <Text code>{data.organization.masterAccountId}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="マスターアカウントメール">
                    <Text>{data.organization.masterAccountEmail}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="組織ARN" span={2}>
                    <Text code style={{ fontSize: '12px' }}>{data.organization.arn}</Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          )}

          {/* 統計情報 */}
          <Col span={24}>
            <Card title="統計情報">
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="総アカウント数"
                    value={data.accounts.length}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="組織単位(OU)数"
                    value={data.organizationalUnits.length}
                    prefix={<ApartmentOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="アクティブアカウント"
                    value={getAccountStatusStats().ACTIVE || 0}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="ポリシー数"
                    value={data.policies.length}
                    prefix={<FileProtectOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* アカウントステータス分布 */}
          <Col span={12}>
            <Card title="アカウントステータス分布">
              <Row gutter={[8, 8]}>
                {Object.entries(getAccountStatusStats()).map(([status, count]) => (
                  <Col span={24} key={status}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tag color={
                        status === 'ACTIVE' ? 'success' : 
                        status === 'SUSPENDED' ? 'error' : 'warning'
                      }>
                        {status}
                      </Tag>
                      <Text strong>{count}</Text>
                    </Space>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          {/* ポリシータイプ分布 */}
          <Col span={12}>
            <Card title="ポリシータイプ分布">
              <Row gutter={[8, 8]}>
                {Object.entries(getPolicyTypeStats()).map(([type, count]) => (
                  <Col span={24} key={type}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Tag color={
                        type === 'SERVICE_CONTROL_POLICY' ? 'red' :
                        type === 'TAG_POLICY' ? 'blue' :
                        type === 'BACKUP_POLICY' ? 'green' : 'orange'
                      }>
                        {type.replace(/_/g, ' ')}
                      </Tag>
                      <Text strong>{count}</Text>
                    </Space>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'structure',
      label: '組織構造',
      children: (
        <Row gutter={[24, 24]}>
          <Col span={12}>
            <Card title="組織階層" size="small">
              {buildTreeData().length > 0 ? (
                <Tree
                  showIcon
                  treeData={buildTreeData()}
                  onSelect={(selectedKeys) => {
                    setSelectedOU(selectedKeys[0] as string);
                  }}
                  defaultExpandAll
                />
              ) : (
                <Empty description="組織構造が設定されていません" />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="選択した組織単位の詳細" size="small">
              {selectedOU ? (
                <div>
                  <Text>組織単位ID: <Text code>{selectedOU}</Text></Text>
                  {/* Additional details can be added here */}
                </div>
              ) : (
                <Text type="secondary">組織単位を選択してください</Text>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'accounts',
      label: `アカウント (${data.accounts.length})`,
      children: (
        <Card title="アカウント一覧">
          <Table
            columns={accountColumns}
            dataSource={data.accounts.map(account => ({
              ...account,
              key: account.id,
            }))}
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        </Card>
      ),
    },
    {
      key: 'policies',
      label: `ポリシー (${data.policies.length})`,
      children: (
        <Card title="組織ポリシー一覧">
          <Table
            columns={policyColumns}
            dataSource={data.policies.map(policy => ({
              ...policy,
              key: policy.id,
            }))}
            pagination={{ pageSize: 10 }}
            size="middle"
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ margin: 0 }}>
                  <Title level={5}>ポリシー内容:</Title>
                  <pre style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: '8px', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '300px'
                  }}>
                    {record.content || 'ポリシー内容を取得できませんでした'}
                  </pre>
                </div>
              ),
              rowExpandable: (record) => !!record.content,
            }}
          />
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
    </div>
  );
}