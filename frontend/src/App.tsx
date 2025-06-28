import { useAuthenticator } from '@aws-amplify/ui-react';
import {
  AppLayout,
  Header,
  TopNavigation,
} from '@cloudscape-design/components';
import React from 'react';

function App() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);

  return (
    <>
      <TopNavigation
        identity={{
          href: '/',
          title: 'Cloud Best Practice Analyzer',
        }}
        utilities={[
          {
            type: 'menu-dropdown',
            text: user?.username || 'User',
            items: [
              { id: 'profile', text: 'Profile' },
              { id: 'preferences', text: 'Preferences' },
              { id: 'signout', text: 'Sign out' },
            ],
            onItemClick: ({ detail }) => {
              if (detail.id === 'signout') {
                signOut();
              }
            },
          },
        ]}
      />
      <AppLayout
        headerSelector="#header"
        navigationHide
        content={
          <div style={{ padding: '20px' }}>
            <Header variant="h1">Welcome to Cloud Best Practice Analyzer</Header>
            <p>Hello, {user?.username}! Your application is now running.</p>
          </div>
        }
      />
    </>
  );
}

export default App;
