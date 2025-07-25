import {
  BarChartOutlined,
  FileTextOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Alert,
  Progress,
} from 'antd';
import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectQueries, analysisQueries } from '../services/graphqlQueries';
import { useAuth } from '../hooks/useAuth';
import type { Analysis } from '../types';

const { Title, Text } = Typography;

export default function Projects() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user } = useAuth();
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [projectAnalyses, setProjectAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectData();
  }, [projectId, user]);

  const loadProjectData = async () => {
    if (!projectId || !user?.tenantId) return;

    try {
      setLoading(true);

      // Load project details
      const { data: projectData, errors: projectErrors } = await projectQueries.getProject(projectId);
      if (projectErrors.length > 0) {
        console.error('Error loading project:', projectErrors);
        return;
      }

      setCurrentProject(projectData);

      // Load analyses for this project
      const { data: analysesData, errors: analysesErrors } = await analysisQueries.listAnalyses(projectId);
      if (analysesErrors.length === 0) {
        setProjectAnalyses(analysesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }

    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Space direction="vertical">
          <Progress type="circle" />
          <Text>プロジェクトデータを読み込んでいます...</Text>
        </Space>
      </div>
    );
  }

  if (projectId && !currentProject) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="プロジェクトが見つかりません"
          description="指定されたプロジェクトにアクセスできません。"
          type="error"
          showIcon
        />
      </div>
    );
  }

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

  // 分析履歴テーブル用データ
  const analysisTableData = projectAnalyses.map((analysis) => ({
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
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/analysis/${record.key}`)}
          >
            <Text strong>{text}</Text>
          </Button>
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
          <Text type="secondary">未完了</Text>
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
      render: (date: string) => dayjs(date).format('YYYY/MM/DD HH:mm'),
    },
    {
      title: 'アクション',
      key: 'action',
      render: (record: any) => (
        <Button
          type="link"
          icon={<RightOutlined />}
          onClick={() => navigate(`/analysis/${record.key}`)}
        >
          詳細
        </Button>
      ),
    },
  ];

  const breadcrumbItems = [
    {
      title: (
        <Button type="link" onClick={() => navigate('/')}>
          ダッシュボード
        </Button>
      ),
    },
    ...(currentProject
      ? [
          {
            title: currentProject.name,
          },
        ]
      : []),
  ];

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      {/* パンくずリスト */}
      <Breadcrumb items={breadcrumbItems} style={{ marginBottom: '24px' }} />

      {currentProject ? (
        <>
          {/* プロジェクトヘッダー */}
          <Card style={{ marginBottom: '24px' }}>
            <Row justify="space-between" align="top">
              <Col span={16}>
                <Space direction="vertical" size="small">
                  <Title level={1} style={{ margin: 0 }}>
                    {currentProject.name}
                  </Title>
                  <Text type="secondary">{currentProject.description}</Text>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() =>
                      navigate(`/projects/${currentProject.id}/analysis/new`)
                    }
                  >
                    新しい分析
                  </Button>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() =>
                      navigate(`/projects/${currentProject.id}/reports`)
                    }
                  >
                    レポート管理
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* プロジェクト統計 */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="総分析数"
                  value={projectAnalyses.length}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="完了分析"
                  value={
                    projectAnalyses.filter((a) => a.status === 'COMPLETED')
                      .length
                  }
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="実行中分析"
                  value={
                    projectAnalyses.filter((a) => a.status === 'RUNNING').length
                  }
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均スコア"
                  value={
                    projectAnalyses.filter((a) => a.resultSummary).length > 0
                      ? Math.round(
                          projectAnalyses
                            .filter((a) => a.resultSummary)
                            .reduce(
                              (sum, a) =>
                                sum + (a.resultSummary?.overallScore || 0),
                              0
                            ) /
                            Math.max(projectAnalyses.filter((a) => a.resultSummary).length, 1)
                        )
                      : 0
                  }
                  suffix="/ 100"
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 分析履歴 */}
          <Card
            title={
              <Space>
                <BarChartOutlined />
                <span>分析履歴 ({projectAnalyses.length})</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  navigate(`/projects/${currentProject.id}/analysis/new`)
                }
              >
                新しい分析を開始
              </Button>
            }
          >
            {projectAnalyses.length > 0 ? (
              <Table
                columns={analysisColumns}
                dataSource={analysisTableData}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                size="middle"
              />
            ) : (
              <Empty
                description={
                  <Space direction="vertical">
                    <Text>このプロジェクトではまだ分析が実行されていません。</Text>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        navigate(`/projects/${currentProject.id}/analysis/new`)
                      }
                    >
                      最初の分析を開始
                    </Button>
                  </Space>
                }
              />
            )}
          </Card>
        </>
      ) : (
        <Title level={1}>プロジェクト一覧</Title>
      )}
    </div>
  );
}