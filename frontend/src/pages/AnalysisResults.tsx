import {
  BarChartOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getAnalysisFindings,
  mockAnalyses,
  mockUser,
  getUserProjects,
} from '../services/mockData';
import type { Finding, WellArchitectedPillar } from '../types';

const { Title, Text } = Typography;

export default function AnalysisResults() {
  const navigate = useNavigate();
  const { analysisId } = useParams();
  const [activeTabKey, setActiveTabKey] = useState('overview');

  const analysis = mockAnalyses.find((a) => a.id === analysisId);
  const findings = getAnalysisFindings(analysisId || '');
  const userProjects = getUserProjects(mockUser.id);
  const currentProject = userProjects.find((p) => p.id === analysis?.projectId);

  if (!analysis) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="分析が見つかりません"
          description="指定された分析にアクセスできません。"
          type="error"
          showIcon
        />
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    const colorMap = {
      Critical: 'red',
      High: 'orange',
      Medium: 'blue',
      Low: 'default',
    };
    return colorMap[severity as keyof typeof colorMap] || 'default';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a'; // green
    if (score >= 60) return '#faad14'; // orange
    return '#ff4d4f'; // red
  };

  const getPillarScore = (pillar: WellArchitectedPillar) => {
    const score = analysis.resultSummary?.pillars[pillar]?.score || 0;
    return {
      score,
      color: getScoreColor(score),
    };
  };

  const getPillarFindings = (pillar: WellArchitectedPillar) => {
    return findings.filter((f) => f.pillar === pillar);
  };

  const pillarTabs = [
    {
      key: 'operational-excellence',
      label: '運用上の優秀性',
      pillar: 'OperationalExcellence' as WellArchitectedPillar,
    },
    {
      key: 'security',
      label: 'セキュリティ',
      pillar: 'Security' as WellArchitectedPillar,
    },
    {
      key: 'reliability',
      label: '信頼性',
      pillar: 'Reliability' as WellArchitectedPillar,
    },
    {
      key: 'performance',
      label: 'パフォーマンス効率',
      pillar: 'PerformanceEfficiency' as WellArchitectedPillar,
    },
    {
      key: 'cost',
      label: 'コスト最適化',
      pillar: 'CostOptimization' as WellArchitectedPillar,
    },
    {
      key: 'sustainability',
      label: '持続可能性',
      pillar: 'Sustainability' as WellArchitectedPillar,
    },
  ];

  const findingsColumns = [
    {
      title: '重要度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>{severity}</Tag>
      ),
    },
    {
      title: 'タイトル',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Finding) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: 'リソース',
      dataIndex: 'resource',
      key: 'resource',
      width: 150,
      render: (resource: string) => resource || '-',
    },
    {
      title: '行番号',
      dataIndex: 'line',
      key: 'line',
      width: 80,
      render: (line: number) => (line ? `L${line}` : '-'),
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
            title: (
              <Button
                type="link"
                onClick={() => navigate(`/projects/${currentProject.id}`)}
              >
                {currentProject.name}
              </Button>
            ),
          },
        ]
      : []),
    {
      title: analysis.name,
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: '概要',
      children: (
        <Row gutter={[24, 24]}>
          {/* 総合スコア */}
          <Col span={24}>
            <Card>
              <Row gutter={[24, 24]} align="middle">
                <Col span={8}>
                  <Statistic
                    title="総合スコア"
                    value={analysis.resultSummary?.overallScore}
                    suffix="/ 100"
                    valueStyle={{
                      color: getScoreColor(
                        analysis.resultSummary?.overallScore || 0
                      ),
                      fontSize: '48px',
                    }}
                    prefix={<SafetyOutlined />}
                  />
                </Col>
                <Col span={16}>
                  <Progress
                    percent={analysis.resultSummary?.overallScore}
                    strokeColor={getScoreColor(
                      analysis.resultSummary?.overallScore || 0
                    )}
                    strokeWidth={20}
                    format={(percent) => `${percent}%`}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 検出事項サマリー */}
          <Col span={24}>
            <Card title="検出事項サマリー">
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title="Critical"
                      value={analysis.resultSummary?.criticalFindings}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title="High"
                      value={analysis.resultSummary?.highFindings}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title="Medium"
                      value={analysis.resultSummary?.mediumFindings}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Statistic
                      title="Low"
                      value={analysis.resultSummary?.lowFindings}
                      valueStyle={{ color: '#d9d9d9' }}
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Well-Architected 柱別スコア */}
          <Col span={24}>
            <Card title="Well-Architected Framework 柱別スコア">
              <Row gutter={[16, 16]}>
                {pillarTabs.map((tab) => {
                  const { score, color } = getPillarScore(tab.pillar);
                  const pillarFindings = getPillarFindings(tab.pillar);
                  return (
                    <Col span={4} key={tab.key}>
                      <Card
                        size="small"
                        hoverable
                        onClick={() => setActiveTabKey(tab.key)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Text strong style={{ fontSize: '12px' }}>
                            {tab.label}
                          </Text>
                          <Statistic
                            value={score}
                            suffix="/ 100"
                            valueStyle={{ color, fontSize: '18px' }}
                          />
                          <Progress
                            percent={score}
                            strokeColor={color}
                            showInfo={false}
                            size="small"
                          />
                          <Badge
                            count={pillarFindings.length}
                            style={{
                              backgroundColor:
                                pillarFindings.length > 5
                                  ? '#ff4d4f'
                                  : pillarFindings.length > 2
                                    ? '#fa8c16'
                                    : '#52c41a',
                            }}
                          />
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          </Col>
        </Row>
      ),
    },
    ...pillarTabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 柱スコア */}
          <Card>
            <Row gutter={[24, 24]} align="middle">
              <Col span={8}>
                <Statistic
                  title={`${tab.label} スコア`}
                  value={getPillarScore(tab.pillar).score}
                  suffix="/ 100"
                  valueStyle={{
                    color: getPillarScore(tab.pillar).color,
                    fontSize: '36px',
                  }}
                />
              </Col>
              <Col span={16}>
                <Progress
                  percent={getPillarScore(tab.pillar).score}
                  strokeColor={getPillarScore(tab.pillar).color}
                  strokeWidth={12}
                />
              </Col>
            </Row>
          </Card>

          {/* 検出事項テーブル */}
          <Card
            title={`検出事項一覧 (${getPillarFindings(tab.pillar).length})`}
          >
            {getPillarFindings(tab.pillar).length > 0 ? (
              <Table
                columns={findingsColumns}
                dataSource={getPillarFindings(tab.pillar).map((finding) => ({
                  ...finding,
                  key: finding.id,
                }))}
                pagination={{ pageSize: 10 }}
                size="middle"
              />
            ) : (
              <Empty
                description="この柱では問題は検出されませんでした。"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Space>
      ),
    })),
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

      {/* ヘッダー */}
      <Card style={{ marginBottom: '24px' }}>
        <Row justify="space-between" align="top">
          <Col span={16}>
            <Space direction="vertical" size="small">
              <Title level={1} style={{ margin: 0 }}>
                {analysis.name}
              </Title>
              <Text type="secondary">
                {analysis.type} 分析 -{' '}
                {new Date(analysis.createdAt).toLocaleString('ja-JP')}
              </Text>
              <Tag
                color={
                  analysis.status === 'Completed'
                    ? 'success'
                    : analysis.status === 'Running'
                      ? 'processing'
                      : analysis.status === 'Failed'
                        ? 'error'
                        : 'default'
                }
              >
                {analysis.status}
              </Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<FileTextOutlined />}
                onClick={() =>
                  navigate(`/projects/${analysis.projectId}/reports`)
                }
              >
                レポート生成
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  navigate(`/projects/${analysis.projectId}/analysis/new`)
                }
              >
                新しい分析
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 実行中プログレス */}
      {analysis.status === 'Running' && (
        <Card style={{ marginBottom: '24px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>
              <ClockCircleOutlined /> 分析実行中...
            </Text>
            <Progress
              percent={Math.random() * 60 + 20} // モック進捗
              status="active"
              strokeColor="#1890ff"
            />
            <Text type="secondary">
              Well-Architected Framework に基づく分析を実行しています
            </Text>
          </Space>
        </Card>
      )}

      {/* 分析完了時のタブ表示 */}
      {analysis.status === 'Completed' && analysis.resultSummary && (
        <Card>
          <Tabs
            activeKey={activeTabKey}
            onChange={setActiveTabKey}
            items={tabItems}
            size="large"
          />
        </Card>
      )}

      {/* 分析失敗時のエラー表示 */}
      {analysis.status === 'Failed' && (
        <Alert
          message="分析に失敗しました"
          description="分析の実行中にエラーが発生しました。しばらく時間をおいて再度お試しください。"
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
        />
      )}
    </div>
  );
}