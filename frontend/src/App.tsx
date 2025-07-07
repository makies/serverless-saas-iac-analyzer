import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

// Import Amplify configuration
import amplifyConfig from './amplify-config';
import CloudscapeAppLayout from './components/CloudscapeAppLayout';
import CloudscapeDashboard from './pages/CloudscapeDashboard';
// Temporarily disabled until migrated to Cloudscape
// import Projects from './pages/Projects';
// import NewAnalysis from './pages/NewAnalysis';
// import AnalysisResults from './pages/AnalysisResults';
// import TenantManagement from './pages/TenantManagement';
// import FrameworkManagement from './pages/FrameworkManagement';

// Configure Amplify
Amplify.configure(amplifyConfig);

interface AppProps {
  signOut?: () => void;
  user?: any;
}

function App({ signOut, user }: AppProps) {
  return (
    <Router>
      <CloudscapeAppLayout 
        user={user} 
        onSignOut={signOut}
        navigation={{
          items: [
            { type: 'link', text: 'ダッシュボード', href: '/' },
            { 
              type: 'section', 
              text: 'プロジェクト管理',
              items: [
                { type: 'link', text: 'プロジェクト一覧', href: '/projects' },
                { type: 'link', text: '新規分析', href: '/analysis/new' }
              ]
            },
            {
              type: 'section',
              text: '管理機能',
              items: [
                { type: 'link', text: 'テナント管理', href: '/admin/tenants' },
                { type: 'link', text: 'フレームワーク管理', href: '/admin/frameworks' }
              ]
            }
          ]
        }}
      >
        <Routes>
          <Route path="/" element={<CloudscapeDashboard />} />
          {/* Temporarily disabled until migrated to Cloudscape */}
          {/* <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<Projects />} />
          <Route path="/analysis/new" element={<NewAnalysis />} />
          <Route path="/projects/:projectId/analysis/new" element={<NewAnalysis />} />
          <Route path="/analysis/:analysisId" element={<AnalysisResults />} />
          <Route path="/admin/tenants" element={<TenantManagement />} />
          <Route path="/admin/frameworks" element={<FrameworkManagement />} /> */}
        </Routes>
      </CloudscapeAppLayout>
    </Router>
  );
}

// Export the app with authentication
export default withAuthenticator(App, {
  hideSignUp: true, // Only allow sign-in, no self-registration
  components: {
    Header() {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #ddd'
        }}>
          <h1 style={{ 
            color: '#232f3e',
            margin: 0,
            fontSize: '1.8rem'
          }}>
            Cloud Best Practice Analyzer
          </h1>
          <p style={{ 
            color: '#546e7a',
            margin: '0.5rem 0 0 0',
            fontSize: '1rem'
          }}>
            AWS インフラストラクチャのベストプラクティス分析
          </p>
        </div>
      );
    }
  }
});