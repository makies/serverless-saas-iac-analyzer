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
  Alert
} from 'antd';
import { 
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  ProjectOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { graphqlClient } from '../amplify-config';
import { useAuth } from '../hooks/useAuth';

const { Title } = Typography;
const { Search } = Input;

interface Tenant {
  id: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM';
  createdAt: string;
  projectCount: number;
  analysisCount: number;
  adminEmail: string;
}

const TenantManagement: React.FC = () => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      // This would be replaced with actual GraphQL query
      const mockTenants: Tenant[] = [
        {
          id: 'tenant-1',
          name: 'サンプル企業A',
          status: 'ACTIVE',
          tier: 'STANDARD',
          createdAt: '2024-01-15',
          projectCount: 5,
          analysisCount: 23,
          adminEmail: 'admin@company-a.com'
        },
        {
          id: 'tenant-2',
          name: 'サンプル企業B',
          status: 'ACTIVE',
          tier: 'BASIC',
          createdAt: '2024-02-01',
          projectCount: 2,
          analysisCount: 8,
          adminEmail: 'admin@company-b.com'
        },
        {
          id: 'tenant-3',
          name: 'サンプル企業C',
          status: 'SUSPENDED',
          tier: 'PREMIUM',
          createdAt: '2023-12-10',
          projectCount: 12,
          analysisCount: 67,
          adminEmail: 'admin@company-c.com'
        },
        {
          id: 'tenant-4',
          name: 'サンプル企業D',
          status: 'PENDING',
          tier: 'BASIC',
          createdAt: '2024-02-15',
          projectCount: 0,
          analysisCount: 0,
          adminEmail: 'admin@company-d.com'
        }
      ];
      setTenants(mockTenants);
    } catch (error) {
      console.error('Failed to load tenants:', error);
      message.error('テナント情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = () => {
    setEditingTenant(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    form.setFieldsValue(tenant);
    setIsModalVisible(true);
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    Modal.confirm({
      title: 'テナントを削除しますか？',
      content: `テナント「${tenant.name}」を削除しますか？この操作は取り消せません。`,
      okText: '削除',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: async () => {
        try {
          // This would be replaced with actual GraphQL mutation
          console.log('Deleting tenant:', tenant.id);
          message.success('テナントを削除しました');
          loadTenants();
        } catch (error) {
          console.error('Failed to delete tenant:', error);
          message.error('テナントの削除に失敗しました');
        }
      }
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      // This would be replaced with actual GraphQL mutation
      if (editingTenant) {
        console.log('Updating tenant:', editingTenant.id, values);
        message.success('テナントを更新しました');
      } else {
        console.log('Creating tenant:', values);
        message.success('テナントを作成しました');
      }
      setIsModalVisible(false);
      loadTenants();
    } catch (error) {
      console.error('Failed to save tenant:', error);
      message.error('テナントの保存に失敗しました');
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      'ACTIVE': { color: 'green', text: 'アクティブ' },
      'SUSPENDED': { color: 'red', text: '停止中' },
      'PENDING': { color: 'orange', text: '承認待ち' }
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTierTag = (tier: string) => {
    const tierConfig = {
      'BASIC': { color: 'default', text: 'ベーシック' },
      'STANDARD': { color: 'blue', text: 'スタンダード' },
      'PREMIUM': { color: 'gold', text: 'プレミアム' }
    };
    const config = tierConfig[tier as keyof typeof tierConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ColumnsType<Tenant> = [
    {
      title: 'テナント名',
      dataIndex: 'name',
      key: 'name',
      filterable: true,
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: 'テナントID',
      dataIndex: 'id',
      key: 'id',
      render: (id) => <code>{id}</code>
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
      filters: [
        { text: 'アクティブ', value: 'ACTIVE' },
        { text: '停止中', value: 'SUSPENDED' },
        { text: '承認待ち', value: 'PENDING' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'ティア',
      dataIndex: 'tier',
      key: 'tier',
      render: getTierTag,
      filters: [
        { text: 'ベーシック', value: 'BASIC' },
        { text: 'スタンダード', value: 'STANDARD' },
        { text: 'プレミアム', value: 'PREMIUM' }
      ],
      onFilter: (value, record) => record.tier === value
    },
    {
      title: 'プロジェクト数',
      dataIndex: 'projectCount',
      key: 'projectCount',
      sorter: (a, b) => a.projectCount - b.projectCount,
      render: (count) => count.toLocaleString()
    },
    {
      title: '分析実行数',
      dataIndex: 'analysisCount',
      key: 'analysisCount',
      sorter: (a, b) => a.analysisCount - b.analysisCount,
      render: (count) => count.toLocaleString()
    },
    {
      title: '作成日',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (date) => new Date(date).toLocaleDateString('ja-JP')
    },
    {
      title: 'アクション',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEditTenant(record)}
          >
            編集
          </Button>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTenant(record)}
          >
            削除
          </Button>
        </Space>
      )
    }
  ];

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchText.toLowerCase()) ||
    tenant.id.toLowerCase().includes(searchText.toLowerCase()) ||
    tenant.adminEmail.toLowerCase().includes(searchText.toLowerCase())
  );

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'ACTIVE').length,
    totalProjects: tenants.reduce((sum, t) => sum + t.projectCount, 0),
    totalAnalyses: tenants.reduce((sum, t) => sum + t.analysisCount, 0)
  };

  return (
    <div>
      <Title level={2}>テナント管理</Title>
      
      <Alert
        message="システム管理者として全テナントの管理と監視を行うことができます。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="総テナント数"
              value={stats.total}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="アクティブテナント"
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="総プロジェクト数"
              value={stats.totalProjects}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="総分析実行数"
              value={stats.totalAnalyses}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Search
            placeholder="テナント名、ID、メールアドレスで検索"
            allowClear
            style={{ width: 300 }}
            onSearch={setSearchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreateTenant}
          >
            新規テナント作成
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredTenants}
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

      <Modal
        title={editingTenant ? 'テナント編集' : '新規テナント作成'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
        okText={editingTenant ? '更新' : '作成'}
        cancelText="キャンセル"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="name"
            label="テナント名"
            rules={[
              { required: true, message: 'テナント名を入力してください' },
              { min: 2, message: 'テナント名は2文字以上で入力してください' }
            ]}
          >
            <Input placeholder="テナント名を入力" />
          </Form.Item>

          <Form.Item
            name="adminEmail"
            label="管理者メールアドレス"
            rules={[
              { required: true, message: 'メールアドレスを入力してください' },
              { type: 'email', message: '正しいメールアドレスを入力してください' }
            ]}
          >
            <Input placeholder="admin@example.com" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tier"
                label="ティア"
                rules={[{ required: true, message: 'ティアを選択してください' }]}
              >
                <Select placeholder="ティアを選択">
                  <Select.Option value="BASIC">ベーシック</Select.Option>
                  <Select.Option value="STANDARD">スタンダード</Select.Option>
                  <Select.Option value="PREMIUM">プレミアム</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="ステータス"
                rules={[{ required: true, message: 'ステータスを選択してください' }]}
              >
                <Select placeholder="ステータスを選択">
                  <Select.Option value="ACTIVE">アクティブ</Select.Option>
                  <Select.Option value="SUSPENDED">停止中</Select.Option>
                  <Select.Option value="PENDING">承認待ち</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantManagement;