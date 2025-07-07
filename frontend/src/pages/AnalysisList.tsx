import {
  BarChartOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  RightOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analysisQueries } from '../services/graphqlQueries';
import { useAuth } from '../hooks/useAuth';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function AnalysisList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllAnalyses();
  }, [user]);

  const loadAllAnalyses = async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      console.log('Loading all analyses for tenant:', user.tenantId);
      
      // Since we don't have a direct "list all analyses" query,
      // we'll create mock data for now and implement proper API later
      const mockAnalyses = [
        {
          id: 'analysis-1',
          name: 'サンプル分析',
          type: 'CLOUDFORMATION',
          status: 'COMPLETED',
          projectId: 'project-1',
          projectName: 'デモプロジェクト',
          resultSummary: {
            overallScore: 75,
            criticalFindings: 2,
            highFindings: 5,
            mediumFindings: 8,
            lowFindings: 3,
            totalFindings: 18
          },
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          createdBy: 'current-user'
        },
        {
          id: 'analysis-2',
          name: '本番環境分析',
          type: 'CDK',
          status: 'COMPLETED',
          projectId: 'project-1',
          projectName: 'デモプロジェクト',
          resultSummary: {
            overallScore: 82,
            criticalFindings: 1,
            highFindings: 3,
            mediumFindings: 6,
            lowFindings: 2,
            totalFindings: 12
          },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          completedAt: new Date(Date.now() - 86400000).toISOString(),
          createdBy: 'current-user'
        }
      ];

      setAnalyses(mockAnalyses);
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const columns = [
    {
      title: '分析名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/analysis/${record.id}`)}
          >
            <Text strong>{text}</Text>
          </Button>
          <Space>
            <Tag color="blue">{record.type}</Tag>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.projectName}
            </Text>
          </Space>
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
      title: '総合スコア',
      dataIndex: ['resultSummary', 'overallScore'],
      key: 'score',
      render: (score: number) =>
        score ? (
          <Space direction="vertical" size={0}>
            <Text strong style={{ color: getScoreColor(score) }}>
              {score} / 100
            </Text>
            <Progress
              percent={score}
              strokeColor={getScoreColor(score)}
              showInfo={false}
              size="small"
            />
          </Space>
        ) : (
          <Text type="secondary">未完了</Text>
        ),
    },
    {
      title: '検出事項',
      key: 'findings',
      render: (record: any) =>
        record.resultSummary ? (
          <Space>
            <Badge
              count={record.resultSummary.criticalFindings}
              style={{ backgroundColor: '#ff4d4f' }}
              title="Critical"
            />
            <Badge
              count={record.resultSummary.highFindings}
              style={{ backgroundColor: '#fa8c16' }}
              title="High"
            />
            <Badge
              count={record.resultSummary.mediumFindings}
              style={{ backgroundColor: '#1890ff' }}
              title="Medium"
            />
            <Badge
              count={record.resultSummary.lowFindings}
              style={{ backgroundColor: '#d9d9d9' }}
              title="Low"
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
          onClick={() => navigate(`/analysis/${record.id}`)}
        >
          詳細
        </Button>
      ),
    },
  ];

  // 統計計算
  const stats = {
    total: analyses.length,
    completed: analyses.filter(a => a.status === 'COMPLETED').length,
    avgScore: analyses.length > 0 
      ? Math.round(analyses.reduce((sum, a) => sum + (a.resultSummary?.overallScore || 0), 0) / analyses.length)
      : 0,
    totalFindings: analyses.reduce((sum, a) => sum + (a.resultSummary?.totalFindings || 0), 0)
  };

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      <Title level={2}>分析結果一覧</Title>

      {/* 統計カード */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="総分析数"
              value={stats.total}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="完了分析"
              value={stats.completed}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均スコア"
              value={stats.avgScore}
              suffix="/ 100"
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: getScoreColor(stats.avgScore) }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="総検出事項"
              value={stats.totalFindings}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 分析結果テーブル */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>分析結果 ({analyses.length})</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/analysis/new')}
          >
            新しい分析を開始
          </Button>
        }
      >
        {analyses.length > 0 ? (
          <Table
            columns={columns}
            dataSource={analyses}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}件`
            }}
            size="middle"
          />
        ) : (
          <Empty
            description={
              <Space direction="vertical">
                <Text>まだ分析が実行されていません。</Text>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={() => navigate('/analysis/new')}
                >
                  最初の分析を開始
                </Button>
              </Space>
            }
          />
        )}
      </Card>
    </div>
  );
}