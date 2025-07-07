import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Modal,
  Form,
  Select,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Alert,
  Tabs,
  Badge,
  Tooltip
} from 'antd';
import { 
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  StopOutlined,
  FileTextOutlined,
  SettingOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { graphqlClient } from '../amplify-config';
import { useAuth } from '../hooks/useAuth';

const { Title } = Typography;
const { Search } = Input;
const { TabPane } = Tabs;

interface Framework {
  id: string;
  name: string;
  type: 'AWS_WELL_ARCHITECTED' | 'AWS_LENS' | 'SDP' | 'COMPETENCY' | 'SECURITY_HUB' | 'CUSTOM';
  version: string;
  status: 'ACTIVE' | 'DRAFT' | 'DEPRECATED';
  description: string;
  ruleCount: number;
  tenantCount: number;
  createdAt: string;
  updatedAt: string;
  author: string;
}

interface FrameworkRule {
  id: string;
  frameworkId: string;
  ruleId: string;
  title: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  tags: string[];
  enabled: boolean;
}

const FrameworkManagement: React.FC = () => {
  const { user } = useAuth();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [rules, setRules] = useState<FrameworkRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRulesModalVisible, setIsRulesModalVisible] = useState(false);
  const [editingFramework, setEditingFramework] = useState<Framework | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);
  const [activeTab, setActiveTab] = useState('1');
  const [form] = Form.useForm();

  useEffect(() => {
    loadFrameworks();
  }, []);

  const loadFrameworks = async () => {
    setLoading(true);
    try {
      // This would be replaced with actual GraphQL query
      const mockFrameworks: Framework[] = [
        {
          id: 'framework-1',
          name: 'AWS Well-Architected Framework',
          type: 'AWS_WELL_ARCHITECTED',
          version: '2023.10',
          status: 'ACTIVE',
          description: 'AWSの6つの柱に基づく設計原則とベストプラクティス',
          ruleCount: 156,
          tenantCount: 12,
          createdAt: '2023-10-01',
          updatedAt: '2023-12-15',
          author: 'AWS'
        },
        {
          id: 'framework-2',
          name: 'AWS Well-Architected SaaS Lens',
          type: 'AWS_LENS',
          version: '2023.04',
          status: 'ACTIVE',
          description: 'SaaSアプリケーション向けの設計ガイダンス',
          ruleCount: 89,
          tenantCount: 8,
          createdAt: '2023-04-15',
          updatedAt: '2023-11-20',
          author: 'AWS'
        },
        {
          id: 'framework-3',
          name: 'AWS Security Hub CSPM',
          type: 'SECURITY_HUB',
          version: '2024.01',
          status: 'ACTIVE',
          description: 'クラウドセキュリティポスチャ管理のための統合検証',
          ruleCount: 234,
          tenantCount: 15,
          createdAt: '2024-01-10',
          updatedAt: '2024-01-25',
          author: 'AWS'
        },
        {
          id: 'framework-4',
          name: 'カスタムセキュリティフレームワーク',
          type: 'CUSTOM',
          version: '1.2.0',
          status: 'DRAFT',
          description: '企業固有のセキュリティ要件に基づくカスタムルールセット',
          ruleCount: 45,
          tenantCount: 3,
          createdAt: '2024-02-01',
          updatedAt: '2024-02-15',
          author: 'Internal Team'
        }
      ];
      setFrameworks(mockFrameworks);
    } catch (error) {
      console.error('Failed to load frameworks:', error);
      message.error('フレームワーク情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadFrameworkRules = async (frameworkId: string) => {
    setRulesLoading(true);
    try {
      // This would be replaced with actual GraphQL query
      const mockRules: FrameworkRule[] = [
        {
          id: 'rule-1',
          frameworkId,
          ruleId: 'OPS01-01',
          title: '運用手順の文書化',
          description: 'システムの運用手順を明確に文書化し、チーム全体で共有する',
          severity: 'HIGH',
          category: 'Operational Excellence',
          tags: ['documentation', 'operations'],
          enabled: true
        },
        {
          id: 'rule-2',
          frameworkId,
          ruleId: 'SEC02-01',
          title: 'IAMロールの最小権限原則',
          description: 'IAMロールには必要最小限の権限のみを付与する',
          severity: 'HIGH',
          category: 'Security',
          tags: ['iam', 'security', 'permissions'],
          enabled: true
        },
        {
          id: 'rule-3',
          frameworkId,
          ruleId: 'REL03-01',
          title: 'マルチAZ構成',
          description: '可用性を向上させるためマルチAZ構成を採用する',
          severity: 'MEDIUM',
          category: 'Reliability',
          tags: ['availability', 'multi-az'],
          enabled: true
        }
      ];
      setRules(mockRules);
    } catch (error) {
      console.error('Failed to load framework rules:', error);
      message.error('ルール情報の取得に失敗しました');
    } finally {
      setRulesLoading(false);
    }
  };

  const handleCreateFramework = () => {
    setEditingFramework(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditFramework = (framework: Framework) => {
    setEditingFramework(framework);
    form.setFieldsValue(framework);
    setIsModalVisible(true);
  };

  const handleViewRules = (framework: Framework) => {
    setSelectedFramework(framework);
    loadFrameworkRules(framework.id);
    setIsRulesModalVisible(true);
  };

  const handleDeleteFramework = (framework: Framework) => {
    Modal.confirm({
      title: 'フレームワークを削除しますか？',
      content: `フレームワーク「${framework.name}」を削除しますか？この操作は取り消せません。`,
      okText: '削除',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          // This would be replaced with actual GraphQL mutation
          console.log('Deleting framework:', framework.id);
          message.success('フレームワークを削除しました');
          loadFrameworks();
        } catch (error) {
          console.error('Failed to delete framework:', error);
          message.error('フレームワークの削除に失敗しました');
        }
      }
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      // This would be replaced with actual GraphQL mutation
      if (editingFramework) {
        console.log('Updating framework:', editingFramework.id, values);
        message.success('フレームワークを更新しました');
      } else {
        console.log('Creating framework:', values);
        message.success('フレームワークを作成しました');
      }
      setIsModalVisible(false);
      loadFrameworks();
    } catch (error) {
      console.error('Failed to save framework:', error);
      message.error('フレームワークの保存に失敗しました');
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      'ACTIVE': { color: 'green', text: 'アクティブ', icon: <CheckCircleOutlined /> },
      'DRAFT': { color: 'orange', text: 'ドラフト', icon: <ExclamationCircleOutlined /> },
      'DEPRECATED': { color: 'red', text: '非推奨', icon: <StopOutlined /> }
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getTypeTag = (type: string) => {
    const typeConfig = {
      'AWS_WELL_ARCHITECTED': { color: 'blue', text: 'Well-Architected' },
      'AWS_LENS': { color: 'green', text: 'AWS Lens' },
      'SDP': { color: 'purple', text: 'SDP' },
      'COMPETENCY': { color: 'orange', text: 'Competency' },
      'SECURITY_HUB': { color: 'red', text: 'Security Hub' },
      'CUSTOM': { color: 'default', text: 'カスタム' }
    };
    const config = typeConfig[type as keyof typeof typeConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getSeverityTag = (severity: string) => {
    const severityConfig = {
      'HIGH': { color: 'red', text: '高' },
      'MEDIUM': { color: 'orange', text: '中' },
      'LOW': { color: 'default', text: '低' }
    };
    const config = severityConfig[severity as keyof typeof severityConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const frameworkColumns: ColumnsType<Framework> = [
    {
      title: 'フレームワーク名',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>v{record.version}</div>
        </div>
      )
    },
    {
      title: 'タイプ',
      dataIndex: 'type',
      key: 'type',
      render: getTypeTag,
      filters: [
        { text: 'Well-Architected', value: 'AWS_WELL_ARCHITECTED' },
        { text: 'AWS Lens', value: 'AWS_LENS' },
        { text: 'SDP', value: 'SDP' },
        { text: 'Competency', value: 'COMPETENCY' },
        { text: 'Security Hub', value: 'SECURITY_HUB' },
        { text: 'カスタム', value: 'CUSTOM' }
      ],
      onFilter: (value, record) => record.type === value
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
      filters: [
        { text: 'アクティブ', value: 'ACTIVE' },
        { text: 'ドラフト', value: 'DRAFT' },
        { text: '非推奨', value: 'DEPRECATED' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'ルール数',
      dataIndex: 'ruleCount',
      key: 'ruleCount',
      sorter: (a, b) => a.ruleCount - b.ruleCount,
      render: (count) => (
        <Badge count={count} showZero style={{ backgroundColor: '#52c41a' }} />
      )
    },
    {
      title: '利用テナント数',
      dataIndex: 'tenantCount',
      key: 'tenantCount',
      sorter: (a, b) => a.tenantCount - b.tenantCount,
      render: (count) => count.toLocaleString()
    },
    {
      title: '更新日',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      render: (date) => new Date(date).toLocaleDateString('ja-JP')
    },
    {
      title: 'アクション',
      key: 'actions',
      width: 250,
      render: (_, record) => (
        <Space>
          <Tooltip title="ルール確認">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewRules(record)}
            >
              ルール
            </Button>
          </Tooltip>
          <Tooltip title="編集">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEditFramework(record)}
            >
              編集
            </Button>
          </Tooltip>
          <Tooltip title="削除">
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteFramework(record)}
            >
              削除
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  const ruleColumns: ColumnsType<FrameworkRule> = [
    {
      title: 'ルールID',
      dataIndex: 'ruleId',
      key: 'ruleId',
      width: 120,
      render: (ruleId) => <code>{ruleId}</code>
    },
    {
      title: 'タイトル',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: 'カテゴリ',
      dataIndex: 'category',
      key: 'category',
      width: 150
    },
    {
      title: '重要度',
      dataIndex: 'severity',
      key: 'severity',
      width: 80,
      render: getSeverityTag
    },
    {
      title: 'ステータス',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled) => (
        <Tag color={enabled ? 'green' : 'default'}>
          {enabled ? '有効' : '無効'}
        </Tag>
      )
    }
  ];

  const filteredFrameworks = frameworks.filter(framework =>
    framework.name.toLowerCase().includes(searchText.toLowerCase()) ||
    framework.type.toLowerCase().includes(searchText.toLowerCase()) ||
    framework.description.toLowerCase().includes(searchText.toLowerCase())
  );

  const stats = {
    total: frameworks.length,
    active: frameworks.filter(f => f.status === 'ACTIVE').length,
    totalRules: frameworks.reduce((sum, f) => sum + f.ruleCount, 0),
    customFrameworks: frameworks.filter(f => f.type === 'CUSTOM').length
  };

  return (
    <div>
      <Title level={2}>フレームワーク管理</Title>
      
      <Alert
        message="分析フレームワークの定義と管理を行います。各フレームワークのルールセットを設定できます。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="フレームワーク一覧" key="1" icon={<FileTextOutlined />}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="総フレームワーク数"
                  value={stats.total}
                  prefix={<ToolOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="アクティブフレームワーク"
                  value={stats.active}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="総ルール数"
                  value={stats.totalRules}
                  prefix={<SettingOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="カスタムフレームワーク"
                  value={stats.customFrameworks}
                  prefix={<EditOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Search
                placeholder="フレームワーク名、タイプ、説明で検索"
                allowClear
                style={{ width: 300 }}
                onSearch={setSearchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={handleCreateFramework}
              >
                新規フレームワーク作成
              </Button>
            </div>

            <Table
              columns={frameworkColumns}
              dataSource={filteredFrameworks}
              rowKey="id"
              loading={loading}
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}件`
              }}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="統計情報" key="2" icon={<BarChartOutlined />}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="フレームワークタイプ別分布">
                {/* ここにチャートを実装 */}
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  チャートコンポーネントを実装予定
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="フレームワーク利用状況">
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  利用状況グラフを実装予定
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* フレームワーク作成/編集モーダル */}
      <Modal
        title={editingFramework ? 'フレームワーク編集' : '新規フレームワーク作成'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={700}
        okText={editingFramework ? '更新' : '作成'}
        cancelText="キャンセル"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="name"
            label="フレームワーク名"
            rules={[
              { required: true, message: 'フレームワーク名を入力してください' },
              { min: 2, message: 'フレームワーク名は2文字以上で入力してください' }
            ]}
          >
            <Input placeholder="フレームワーク名を入力" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="タイプ"
                rules={[{ required: true, message: 'タイプを選択してください' }]}
              >
                <Select placeholder="タイプを選択">
                  <Select.Option value="CUSTOM">カスタム</Select.Option>
                  <Select.Option value="AWS_WELL_ARCHITECTED">Well-Architected</Select.Option>
                  <Select.Option value="AWS_LENS">AWS Lens</Select.Option>
                  <Select.Option value="SDP">SDP</Select.Option>
                  <Select.Option value="COMPETENCY">Competency</Select.Option>
                  <Select.Option value="SECURITY_HUB">Security Hub</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="version"
                label="バージョン"
                rules={[{ required: true, message: 'バージョンを入力してください' }]}
              >
                <Input placeholder="1.0.0" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="説明"
            rules={[{ required: true, message: '説明を入力してください' }]}
          >
            <Input.TextArea
              placeholder="フレームワークの説明を入力"
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ルール確認モーダル */}
      <Modal
        title={
          <div>
            <ToolOutlined style={{ marginRight: 8 }} />
            フレームワークルール: {selectedFramework?.name}
          </div>
        }
        open={isRulesModalVisible}
        onCancel={() => setIsRulesModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setIsRulesModalVisible(false)}>
            閉じる
          </Button>
        ]}
      >
        <Alert
          message="このフレームワークに含まれるルールの一覧です。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={ruleColumns}
          dataSource={rules}
          rowKey="id"
          loading={rulesLoading}
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: false
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '8px 0' }}>
                <p><strong>説明:</strong> {record.description}</p>
                <p><strong>タグ:</strong> {record.tags.map(tag => (
                  <Tag key={tag}>{tag}</Tag>
                ))}</p>
              </div>
            ),
            rowExpandable: (record) => !!record.description,
          }}
        />
      </Modal>
    </div>
  );
};

export default FrameworkManagement;