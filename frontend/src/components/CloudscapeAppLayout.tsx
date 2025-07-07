import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppLayout,
  SideNavigation,
  TopNavigation,
  BreadcrumbGroup,
  ButtonDropdown,
  SpaceBetween,
  Badge,
} from '@cloudscape-design/components';

interface NavigationItem {
  type: 'link' | 'section';
  text: string;
  href?: string;
  items?: NavigationItem[];
}

interface CloudscapeAppLayoutProps {
  children: React.ReactNode;
  user?: any;
  onSignOut?: () => void;
  navigation: {
    items: NavigationItem[];
  };
}

const CloudscapeAppLayout: React.FC<CloudscapeAppLayoutProps> = ({ 
  children, 
  user, 
  onSignOut, 
  navigation 
}) => {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Convert navigation items for Cloudscape SideNavigation
  const sideNavigationItems = navigation.items.map(item => {
    if (item.type === 'section' && item.items) {
      return {
        type: 'section' as const,
        text: item.text,
        items: item.items.map(subItem => ({
          type: 'link' as const,
          text: subItem.text,
          href: subItem.href || '#',
        }))
      };
    } else {
      return {
        type: 'link' as const,
        text: item.text,
        href: item.href || '#',
      };
    }
  });

  const handleNavigate = (detail: any) => {
    if (detail.href && detail.href !== '#') {
      navigate(detail.href);
    }
  };

  const breadcrumbItems = getBreadcrumbItems(location.pathname);

  const userMenuItems = [
    {
      id: 'profile',
      text: 'プロフィール',
    },
    {
      id: 'settings', 
      text: '設定',
    },
    {
      id: 'signout',
      text: 'サインアウト',
    }
  ];

  const handleUserMenuSelect = (detail: any) => {
    if (detail.id === 'signout' && onSignOut) {
      onSignOut();
    }
  };

  return (
    <>
      <div id="header">
        <TopNavigation
          identity={{
            href: '/',
            title: 'Cloud Best Practice Analyzer',
            logo: {
              src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJMMjcgMTBWMjJMMTYgMzBMNSAyMlYxMEwxNiAyWiIgZmlsbD0iIzIzMmYzZSIvPgo8cGF0aCBkPSJNMTYgOEwyMiAxMlYyMEwxNiAyNEwxMCAyMFYxMkwxNiA4WiIgZmlsbD0iI2ZmOTkwMCIvPgo8L3N2Zz4K',
              alt: 'Cloud BPA'
            }
          }}
          utilities={[
            {
              type: 'menu-dropdown',
              text: user?.username || 'ユーザー',
              iconName: 'user-profile',
              items: userMenuItems,
              onItemClick: handleUserMenuSelect
            }
          ]}
        />
      </div>
      <AppLayout
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            header={{
              href: '/',
              text: 'Cloud BPA'
            }}
            items={sideNavigationItems}
            onFollow={handleNavigate}
          />
        }
        toolsHide
        content={
          <SpaceBetween direction="vertical" size="m">
            <BreadcrumbGroup items={breadcrumbItems} />
            {children}
          </SpaceBetween>
        }
        headerSelector="#header"
      />
    </>
  );
};

function getBreadcrumbItems(pathname: string) {
  const items = [{ text: 'ホーム', href: '/' }];
  
  switch (pathname) {
    case '/':
      items.push({ text: 'ダッシュボード', href: '#' });
      break;
    case '/projects':
      items.push({ text: 'プロジェクト一覧', href: '#' });
      break;
    case '/analysis/new':
      items.push({ text: '新規分析', href: '#' });
      break;
    case '/admin/tenants':
      items.push({ text: 'テナント管理', href: '#' });
      break;
    case '/admin/frameworks':
      items.push({ text: 'フレームワーク管理', href: '#' });
      break;
    default:
      if (pathname.includes('/analysis/')) {
        items.push({ text: '分析結果', href: '#' });
      } else if (pathname.includes('/projects/')) {
        items.push({ text: 'プロジェクト詳細', href: '#' });
      } else {
        items.push({ text: 'ページ', href: '#' });
      }
  }
  
  return items;
}

export default CloudscapeAppLayout;