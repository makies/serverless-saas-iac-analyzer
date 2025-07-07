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
import type { TabsProps } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { frameworkQueries } from '../services/graphqlQueries';

const { Title } = Typography;
const { Search } = Input;

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
      const { data, errors } = await frameworkQueries.listFrameworks();
      if (errors.length > 0) {
        console.error('GraphQL errors:', errors);
        message.error('フレームワーク情報の取得に失敗しました');
        return;
      }

      // Transform the GraphQL data to match the Framework interface
      const transformedFrameworks: Framework[] = data.map((framework: any) => ({
        id: framework.id,
        name: framework.name,
        type: framework.type,
        version: framework.version,
        status: framework.status,
        description: framework.description,
        ruleCount: framework.rules ? Object.keys(framework.rules).length : 0,
        tenantCount: 0, // TODO: Implement tenant count calculation
        createdAt: framework.createdAt,
        updatedAt: framework.updatedAt,
        author: framework.author
      }));

      setFrameworks(transformedFrameworks);
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
      const { data, errors } = await frameworkQueries.listFrameworkRules(frameworkId);
      if (errors.length > 0) {
        console.error('GraphQL errors:', errors);
        message.error('ルール情報の取得に失敗しました');
        return;
      }

      // Transform the GraphQL data to match the FrameworkRule interface
      const transformedRules: FrameworkRule[] = data.map((rule: any) => ({
        id: rule.id,
        frameworkId: rule.frameworkId,
        ruleId: rule.ruleId,
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        category: rule.category,
        tags: rule.tags || [],
        enabled: rule.enabled !== false // Default to true if not specified
      }));

      setRules(transformedRules);
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
          const { data, errors } = await frameworkQueries.deleteFramework(framework.id);
          if (errors.length > 0) {
            console.error('GraphQL errors:', errors);
            message.error('フレームワークの削除に失敗しました');
            return;
          }
          
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
      
      if (editingFramework) {
        // Update existing framework
        const { data, errors } = await frameworkQueries.updateFramework(editingFramework.id, {
          name: values.name,
          type: values.type,
          version: values.version,
          description: values.description,
          status: values.status || editingFramework.status
        });
        
        if (errors.length > 0) {
          console.error('GraphQL errors:', errors);
          message.error('フレームワークの更新に失敗しました');
          return;
        }
        
        message.success('フレームワークを更新しました');
      } else {
        // Create new framework
        const { data, errors } = await frameworkQueries.createFramework({
          name: values.name,
          type: values.type,
          version: values.version,
          description: values.description,
          status: values.status || 'DRAFT'
        });
        
        if (errors.length > 0) {
          console.error('GraphQL errors:', errors);
          message.error('フレームワークの作成に失敗しました');
          return;
        }
        
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

  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: (
        <span>
          <FileTextOutlined />
          フレームワーク一覧
        </span>
      ),
      children: (
        <>
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
        </>
      )
    },
    {
      key: '2',
      label: (
        <span>
          <BarChartOutlined />
          統計情報
        </span>
      ),
      children: (
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
      )
    }
  ];

  return (
    <div>
      <Title level={2}>フレームワーク管理</Title>
      
      <Alert
        message="分析フレームワークの定義と管理を行います。各フレームワークのルールセットを設定できます。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

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