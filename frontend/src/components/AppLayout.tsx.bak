import React, { useState } from 'react';
import { 
  Layout,
  Menu,
  Button,
  Dropdown,
  Avatar,
  Breadcrumb,
  theme
} from 'antd';
import { 
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  DashboardOutlined,
  ProjectOutlined,
  AnalysisOutlined,
  UsergroupAddOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

interface NavigationItem {
  type: 'link' | 'section';
  text: string;
  href?: string;
  items?: NavigationItem[];
}

interface AppLayoutProps {
  children: React.ReactNode;
  user?: any;
  onSignOut?: () => void;
  navigation: {
    items: NavigationItem[];
  };
}

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  user, 
  onSignOut, 
  navigation 
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const iconMap: { [key: string]: React.ReactNode } = {
    'ダッシュボード': <DashboardOutlined />,
    'プロジェクト一覧': <ProjectOutlined />,
    '新規分析': <AnalysisOutlined />,
    'テナント管理': <UsergroupAddOutlined />,
    'フレームワーク管理': <ToolOutlined />
  };

  // Convert navigation items for Ant Design Menu
  const menuItems = navigation.items.map(item => {
    if (item.type === 'section' && item.items) {
      return {
        key: item.text,
        label: item.text,
        type: 'group',
        children: item.items.map(subItem => ({
          key: subItem.href || subItem.text,
          label: subItem.text,
          icon: iconMap[subItem.text],
          onClick: () => subItem.href && navigate(subItem.href)
        }))
      };
    } else {
      return {
        key: item.href || item.text,
        label: item.text,
        icon: iconMap[item.text],
        onClick: () => item.href && navigate(item.href)
      };
    }
  });

  const userMenuItems = [
    {
      key: 'profile',
      label: 'プロフィール',
      icon: <UserOutlined />
    },
    {
      key: 'settings',
      label: '設定',
      icon: <SettingOutlined />
    },
    {
      type: 'divider' as const
    },
    {
      key: 'logout',
      label: 'サインアウト',
      icon: <LogoutOutlined />,
      onClick: onSignOut
    }
  ];

  const breadcrumbItems = getBreadcrumbItems(location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ 
          height: 32, 
          margin: 16, 
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold'
        }}>
          {collapsed ? 'CBPA' : 'Cloud BPA'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header 
          style={{ 
            padding: 0, 
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: 24
          }}
        >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#666' }}>
              Cloud Best Practice Analyzer
            </span>
            <Dropdown 
              menu={{ items: userMenuItems }}
              placement="bottomRight"
            >
              <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{user?.username || 'ユーザー'}</span>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Breadcrumb 
            style={{ marginBottom: 16 }}
            items={breadcrumbItems}
          />
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

function getBreadcrumbItems(pathname: string) {
  const items = [{ title: 'ホーム' }];
  
  switch (pathname) {
    case '/':
      items.push({ title: 'ダッシュボード' });
      break;
    case '/projects':
      items.push({ title: 'プロジェクト一覧' });
      break;
    case '/analysis/new':
      items.push({ title: '新規分析' });
      break;
    case '/admin/tenants':
      items.push({ title: 'テナント管理' });
      break;
    case '/admin/frameworks':
      items.push({ title: 'フレームワーク管理' });
      break;
    default:
      if (pathname.includes('/analysis/')) {
        items.push({ title: '分析結果' });
      } else if (pathname.includes('/projects/')) {
        items.push({ title: 'プロジェクト詳細' });
      } else {
        items.push({ title: 'ページ' });
      }
  }
  
  return items;
}

export default AppLayout;