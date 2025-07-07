import {
  AppstoreOutlined,
  BarChartOutlined,
  CloudOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PlusOutlined,
  RightOutlined,
  SafetyOutlined,
  SettingOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Layout,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectQueries, analysisQueries, tenantQueries } from '../services/graphqlQueries';
import { createRealTestData } from '../utils/createRealTestData';
import { useAuth } from '../hooks/useAuth';
import type { Analysis, Project } from '../types';

const { Content } = Layout;
const { Title, Text } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);

      // Load tenant data
      const { data: tenantsData, errors: tenantsErrors } = await tenantQueries.listTenants();
      
      // If no tenants exist, create test data
      if (tenantsData.length === 0) {
        console.log('No tenants found, creating real test data...');
        await createRealTestData();
        // Retry loading after creating test data
        const { data: retryTenantsData } = await tenantQueries.listTenants();
        setTenants(retryTenantsData || []);
      } else {
        setTenants(tenantsData || []);
      }

      // Load projects for current tenant
      const { data: projectsData, errors: projectsErrors } = await projectQueries.listProjects(user.tenantId);
      if (projectsErrors.length === 0) {
        setProjects(projectsData);
      }

      // Load recent analyses for current tenant
      const allAnalyses: any[] = [];
      for (const project of projectsData) {
        const { data: projectAnalyses, errors: analysesErrors } = await analysisQueries.listAnalyses(project.id);
        if (analysesErrors.length === 0) {
          allAnalyses.push(...projectAnalyses);
        }
      }
      setAnalyses(allAnalyses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProjectAnalyses = (projectId: string): any[] => {
    return analyses.filter((analysis) => analysis.projectId === projectId);
  };

  const getStatusColor = (status: string) => {
    const colorMap = {
      ACTIVE: 'success',
      INACTIVE: 'warning', 
      ARCHIVED: 'default',
    };
    return colorMap[status as keyof typeof colorMap] || 'default';
  };

  const getAnalysisStatusColor = (status: string) => {
    const colorMap = {
      COMPLETED: 'success',
      RUNNING: 'processing',
      PENDING: 'default',
      FAILED: 'error',
      CANCELLED: 'default',
    };
    return colorMap[status as keyof typeof colorMap] || 'default';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a'; // green
    if (score >= 60) return '#faad14'; // orange
    return '#ff4d4f'; // red
  };

  // プロジェクトサマリー統計
  const totalProjects = projects.length;
  const totalAnalyses = analyses.length;
  const completedAnalyses = analyses.filter(
    (a) => a.status === 'COMPLETED'
  ).length;
  const avgScore = analyses.length > 0 ? 
    analyses
      .filter((a) => a.resultSummary)
      .reduce((sum, a) => sum + (a.resultSummary?.overallScore || 0), 0) /
    Math.max(analyses.filter((a) => a.resultSummary).length, 1) : 0;

  // プロジェクトテーブル用データ
  const projectTableData = projects.map((project) => {
    const projectAnalyses = getProjectAnalyses(project.id);
    const latestAnalysis = projectAnalyses.length > 0 ? 
      projectAnalyses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;

    return {
      key: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      memberCount: project.memberIds?.length || 0,
      analysisCount: projectAnalyses.length,
      lastAnalysis: latestAnalysis?.createdAt,
      latestScore: latestAnalysis?.resultSummary?.overallScore,
    };
  });

  const projectColumns = [
    {
      title: 'プロジェクト名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description || '説明なし'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '統計',
      key: 'stats',
      render: (record: any) => (
        <Space direction="vertical" size={0}>
          <Text>
            <TeamOutlined /> {record.memberCount} メンバー
          </Text>
          <Text>
            <BarChartOutlined /> {record.analysisCount} 分析
          </Text>
        </Space>
      ),
    },
    {
      title: '最新スコア',
      dataIndex: 'latestScore',
      key: 'latestScore',
      render: (score: number) =>
        score ? (
          <Progress
            type="circle"
            size={40}
            percent={score}
            strokeColor={getScoreColor(score)}
            format={(percent) => `${percent}`}
          />
        ) : (
          <Text type="secondary">未実行</Text>
        ),
    },
    {
      title: '最終更新',
      dataIndex: 'lastAnalysis',
      key: 'lastAnalysis',
      render: (date: string) =>
        date ? dayjs(date).format('YYYY/MM/DD') : '未実行',
    },
    {
      title: 'アクション',
      key: 'action',
      render: (record: any) => (
        <Button 
          type="link" 
          icon={<RightOutlined />}
          onClick={() => navigate(`/projects/${record.key}`)}
        >
          詳細
        </Button>
      ),
    },
  ];

  // 最新分析テーブル用データ
  const analysisTableData = analyses.slice(0, 6).map((analysis) => ({
    key: analysis.id,
    name: analysis.name,
    type: analysis.type,
    status: analysis.status,
    score: analysis.resultSummary?.overallScore,
    criticalFindings: analysis.resultSummary?.criticalFindings || 0,
    highFindings: analysis.resultSummary?.highFindings || 0,
    mediumFindings: analysis.resultSummary?.mediumFindings || 0,
    lowFindings: analysis.resultSummary?.lowFindings || 0,
    createdAt: analysis.createdAt,
  }));

  const analysisColumns = [
    {
      title: '分析名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Tag>{record.type}</Tag>
        </Space>
      ),
    },
    {
      title: 'ステータス',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getAnalysisStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '総合スコア',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) =>
        score ? (
          <Statistic
            value={score}
            suffix="/ 100"
            valueStyle={{
              color: getScoreColor(score),
              fontSize: '16px',
            }}
          />
        ) : (
          <Text type="secondary">処理中</Text>
        ),
    },
    {
      title: '検出事項',
      key: 'findings',
      render: (record: any) =>
        record.criticalFindings !== undefined ? (
          <Space>
            <Badge
              count={record.criticalFindings}
              style={{ backgroundColor: '#ff4d4f' }}
            />
            <Badge
              count={record.highFindings}
              style={{ backgroundColor: '#fa8c16' }}
            />
            <Badge
              count={record.mediumFindings}
              style={{ backgroundColor: '#1890ff' }}
            />
            <Badge
              count={record.lowFindings}
              style={{ backgroundColor: '#d9d9d9' }}
            />
          </Space>
        ) : (
          <Text type="secondary">未完了</Text>
        ),
    },
    {
      title: '実行日時',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MM/DD HH:mm'),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Space direction="vertical">
          <Progress type="circle" />
          <Text>ダッシュボードデータを読み込んでいます...</Text>
        </Space>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      {/* ヘッダー統計 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="総プロジェクト数"
              value={totalProjects}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="総分析数"
              value={totalAnalyses}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="完了分析"
              value={completedAnalyses}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均スコア"
              value={Math.round(avgScore)}
              suffix="/ 100"
              prefix={<SafetyOutlined />}
              valueStyle={{ color: getScoreColor(avgScore) }}
            />
          </Card>
        </Col>
      </Row>

      {/* メインコンテンツ */}
      <Row gutter={[16, 16]}>
        {/* プロジェクト一覧 */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <AppstoreOutlined />
                <span>プロジェクト一覧 ({projects.length})</span>
              </Space>
            }
            extra={
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => navigate('/analysis/new')}
              >
                新しい分析を開始
              </Button>
            }
          >
            <Table
              columns={projectColumns}
              dataSource={projectTableData}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>

        {/* 最新分析結果 */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>最新の分析結果</span>
              </Space>
            }
            extra={<Button type="link" onClick={() => navigate('/analysis')}>すべて表示</Button>}
          >
            <Table
              columns={analysisColumns}
              dataSource={analysisTableData}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>

      {/* Well-Architected柱の概要 */}
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card title="Well-Architected Framework 分析概要">
            <Row gutter={[16, 16]}>
              <Col span={4}>
                <Card size="small">
                  <Statistic
                    title="運用上の優秀性"
                    value={82}
                    suffix="/ 100"
                    valueStyle={{ color: getScoreColor(82), fontSize: '18px' }}
                  />
                  <Progress
                    percent={82}
                    strokeColor={getScoreColor(82)}
                    showInfo={false}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic
                    title="セキュリティ"
                    value={68}
                    suffix="/ 100"
                    valueStyle={{ color: getScoreColor(68), fontSize: '18px' }}
                  />
                  <Progress
                    percent={68}
                    strokeColor={getScoreColor(68)}
                    showInfo={false}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic
                    title="信頼性"
                    value={85}
                    suffix="/ 100"
                    valueStyle={{ color: getScoreColor(85), fontSize: '18px' }}
                  />
                  <Progress
                    percent={85}
                    strokeColor={getScoreColor(85)}
                    showInfo={false}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic
                    title="パフォーマンス効率"
                    value={75}
                    suffix="/ 100"
                    valueStyle={{ color: getScoreColor(75), fontSize: '18px' }}
                  />
                  <Progress
                    percent={75}
                    strokeColor={getScoreColor(75)}
                    showInfo={false}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic
                    title="コスト最適化"
                    value={72}
                    suffix="/ 100"
                    valueStyle={{ color: getScoreColor(72), fontSize: '18px' }}
                  />
                  <Progress
                    percent={72}
                    strokeColor={getScoreColor(72)}
                    showInfo={false}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic
                    title="持続可能性"
                    value={80}
                    suffix="/ 100"
                    valueStyle={{ color: getScoreColor(80), fontSize: '18px' }}
                  />
                  <Progress
                    percent={80}
                    strokeColor={getScoreColor(80)}
                    showInfo={false}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}