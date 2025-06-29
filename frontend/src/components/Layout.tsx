import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CloudOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  Layout as AntLayout,
  Menu,
  Modal,
  Select,
  Space,
  Typography,
  theme,
} from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUserProjects, mockUser } from '../services/mockData';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('project-1');
  
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const userProjects = getUserProjects(mockUser.id);
  const currentProject = userProjects.find(p => p.id === selectedProject);
  
  const projectOptions = userProjects.map(project => ({
    value: project.id,
    label: project.name,
  }));

  const handleSignOut = () => {
    console.log('サインアウト（モック）');
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'dashboard':
        navigate('/');
        break;
      case 'new-analysis':
        navigate('/analysis/new');
        break;
      case 'new-analysis-global':
        navigate('/analysis/new');
        break;
      case 'current-project':
        if (currentProject) {
          navigate(`/projects/${currentProject.id}`);
        }
        break;
      case 'reports':
        if (currentProject) {
          navigate(`/projects/${currentProject.id}/reports`);
        }
        break;
      case 'analysis-history':
        navigate('/analysis');
        break;
      case 'user-management':
        navigate('/admin/users');
        break;
      case 'tenant-management':
        navigate('/admin/tenants');
        break;
      default:
        break;
    }
  };

  // ユーザーメニュー
  const userMenuItems = [
    {
      key: 'profile',
      label: (
        <Space>
          <UserOutlined />
          プロフィール
        </Space>
      ),
    },
    {
      key: 'settings',
      label: (
        <Space>
          <SettingOutlined />
          設定
        </Space>
      ),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: (
        <Space>
          <LogoutOutlined />
          サインアウト
        </Space>
      ),
      onClick: handleSignOut,
    },
  ];

  // サイドバーメニュー
  const sidebarItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'ダッシュボード',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'projects',
      label: 'プロジェクト',
      icon: <AppstoreOutlined />,
      children: [
        {
          key: 'project-switch',
          icon: <SwapOutlined />,
          label: 'プロジェクト切り替え',
          onClick: () => setShowProjectModal(true),
        },
        ...(currentProject ? [
          {
            key: 'current-project',
            icon: <CloudOutlined />,
            label: currentProject.name,
          },
          {
            key: 'new-analysis',
            icon: <BarChartOutlined />,
            label: '新しい分析',
          },
          {
            key: 'reports',
            icon: <FileTextOutlined />,
            label: 'レポート',
          },
        ] : []),
      ],
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'analysis',
      label: '分析',
      icon: <BarChartOutlined />,
      children: [
        {
          key: 'analysis-history',
          label: '分析履歴',
        },
        {
          key: 'new-analysis-global',
          label: '新しい分析',
        },
      ],
    },
    ...(mockUser.role === 'SystemAdmin' || mockUser.role === 'ClientAdmin' ? [
      {
        type: 'divider' as const,
      },
      {
        key: 'admin',
        label: '管理',
        icon: <SettingOutlined />,
        children: [
          {
            key: 'user-management',
            icon: <TeamOutlined />,
            label: 'ユーザー管理',
          },
          ...(mockUser.role === 'SystemAdmin' ? [
            {
              key: 'tenant-management',
              icon: <AppstoreOutlined />,
              label: 'テナント管理',
            },
          ] : []),
        ],
      },
    ] : []),
  ];

  const handleProjectSwitch = () => {
    setShowProjectModal(false);
    // ここで実際のプロジェクト切り替え処理
  };

  // 現在のパスに基づいてselectedKeysを決定
  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path === '/') return ['dashboard'];
    if (path.includes('/analysis/new')) return ['new-analysis'];
    if (path.includes('/projects/')) return ['current-project'];
    return ['dashboard'];
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* サイドバー */}
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: colorBgContainer,
          borderRight: '1px solid #f0f0f0',
        }}
        width={256}
      >
        {/* ロゴエリア */}
        <div style={{ 
          height: 64, 
          padding: '16px', 
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start'
        }}>
          <CloudOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          {!collapsed && (
            <Text strong style={{ marginLeft: '12px', fontSize: '16px' }}>
              Best Practice Analyzer
            </Text>
          )}
        </div>

        {/* メニュー */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          style={{ borderRight: 0, background: 'transparent' }}
          items={sidebarItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <AntLayout>
        {/* ヘッダー */}
        <Header 
          style={{ 
            padding: '0 24px', 
            background: colorBgContainer,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* 左側: ハンバーガーメニュー */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          {/* 右側: 通知・ユーザーメニュー */}
          <Space size="large">
            {/* 通知 */}
            <Badge count={3}>
              <Button type="text" icon={<BellOutlined />} size="large" />
            </Badge>

            {/* ユーザーメニュー */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <Text>{mockUser.username}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* メインコンテンツ */}
        <Content>
          {children}
        </Content>
      </AntLayout>

      {/* プロジェクト切り替えモーダル */}
      <Modal
        title="プロジェクト切り替え"
        open={showProjectModal}
        onOk={handleProjectSwitch}
        onCancel={() => setShowProjectModal(false)}
        okText="切り替え"
        cancelText="キャンセル"
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">
            アクセス可能なプロジェクトから選択してください。
          </Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="プロジェクトを選択"
          value={selectedProject}
          onChange={setSelectedProject}
          options={projectOptions}
        />
      </Modal>
    </AntLayout>
  );
}