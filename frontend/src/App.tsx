import { ConfigProvider, App as AntApp } from 'antd';
import locale from 'antd/locale/ja_JP';
import 'dayjs/locale/ja';
import dayjs from 'dayjs';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import NewAnalysis from './pages/NewAnalysis';
import AnalysisResults from './pages/AnalysisResults';

// 日本語設定
dayjs.locale('ja');

function App() {
  return (
    <ConfigProvider
      locale={locale}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          colorBgLayout: '#f5f5f5',
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            siderBg: '#ffffff',
          },
          Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
          },
        },
      }}
    >
      <AntApp>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects/:projectId" element={<Projects />} />
              <Route path="/analysis/new" element={<NewAnalysis />} />
              <Route
                path="/projects/:projectId/analysis/new"
                element={<NewAnalysis />}
              />
              <Route path="/analysis/:analysisId" element={<AnalysisResults />} />
            </Routes>
          </Layout>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
