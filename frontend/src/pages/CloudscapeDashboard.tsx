import React from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Grid,
  Box,
  Cards,
  Button,
  Table,
  Badge,
  ProgressBar,
  ColumnLayout,
  StatusIndicator,
  Link,
  Icon,
  KeyValuePairs,
} from '@cloudscape-design/components';
import dayjs from 'dayjs';
import {
  getUserProjects,
  mockAnalyses,
  mockUser,
} from '../services/mockData';
import type { Analysis, Project } from '../types';

export default function CloudscapeDashboard() {
  const userProjects = getUserProjects(mockUser.id);

  const getProjectAnalyses = (projectId: string): Analysis[] => {
    return mockAnalyses.filter((analysis) => analysis.projectId === projectId);
  };

  const getStatusIndicator = (status: string) => {
    const statusMap = {
      Active: 'success' as const,
      Inactive: 'warning' as const,
      Archived: 'stopped' as const,
    };
    return statusMap[status as keyof typeof statusMap] || 'pending';
  };

  const getAnalysisStatusIndicator = (status: string) => {
    const statusMap = {
      Completed: 'success' as const,
      Running: 'in-progress' as const,
      Pending: 'pending' as const,
      Failed: 'error' as const,
    };
    return statusMap[status as keyof typeof statusMap] || 'pending';
  };

  // プロジェクトサマリー統計
  const totalProjects = userProjects.length;
  const totalAnalyses = mockAnalyses.length;
  const completedAnalyses = mockAnalyses.filter(
    (a) => a.status === 'Completed'
  ).length;
  const avgScore =
    mockAnalyses
      .filter((a) => a.resultSummary)
      .reduce((sum, a) => sum + (a.resultSummary?.overallScore || 0), 0) /
    mockAnalyses.filter((a) => a.resultSummary).length;

  // プロジェクトテーブル用データ
  const projectTableData = userProjects.map((project) => {
    const analyses = getProjectAnalyses(project.id);
    const latestAnalysis = analyses.length > 0 ? analyses[0] : null;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      memberCount: project.memberCount,
      analysisCount: project.analysisCount,
      lastAnalysis: latestAnalysis?.createdAt,
      latestScore: latestAnalysis?.resultSummary?.overallScore,
    };
  });

  const projectColumns = [
    {
      id: 'name',
      header: 'プロジェクト名',
      cell: (item: any) => (
        <div>
          <Box fontWeight="bold">{item.name}</Box>
          <Box variant="small" color="text-body-secondary">
            {item.description || '説明なし'}
          </Box>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'ステータス',
      cell: (item: any) => (
        <StatusIndicator type={getStatusIndicator(item.status)}>
          {item.status}
        </StatusIndicator>
      ),
    },
    {
      id: 'stats',
      header: '統計',
      cell: (item: any) => (
        <div>
          <Box>
            <Icon name="user-profile" /> {item.memberCount} メンバー
          </Box>
          <Box>
            <Icon name="status-info" /> {item.analysisCount} 分析
          </Box>
        </div>
      ),
    },
    {
      id: 'score',
      header: '最新スコア',
      cell: (item: any) =>
        item.latestScore ? (
          <ProgressBar
            value={item.latestScore}
            description={`${item.latestScore}/100`}
          />
        ) : (
          <Box color="text-body-secondary">未実行</Box>
        ),
    },
    {
      id: 'lastAnalysis',
      header: '最終更新',
      cell: (item: any) =>
        item.lastAnalysis ? dayjs(item.lastAnalysis).format('YYYY/MM/DD') : '未実行',
    },
    {
      id: 'action',
      header: 'アクション',
      cell: () => (
        <Link>詳細</Link>
      ),
    },
  ];

  // 最新分析テーブル用データ
  const analysisTableData = mockAnalyses.slice(0, 6).map((analysis) => ({
    id: analysis.id,
    name: analysis.name,
    type: analysis.type,
    status: analysis.status,
    score: analysis.resultSummary?.overallScore,
    criticalFindings: analysis.resultSummary?.criticalFindings,
    highFindings: analysis.resultSummary?.highFindings,
    mediumFindings: analysis.resultSummary?.mediumFindings,
    lowFindings: analysis.resultSummary?.lowFindings,
    createdAt: analysis.createdAt,
  }));

  const analysisColumns = [
    {
      id: 'name',
      header: '分析名',
      cell: (item: any) => (
        <div>
          <Box fontWeight="bold">{item.name}</Box>
          <Badge color="blue">{item.type}</Badge>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'ステータス',
      cell: (item: any) => (
        <StatusIndicator type={getAnalysisStatusIndicator(item.status)}>
          {item.status}
        </StatusIndicator>
      ),
    },
    {
      id: 'score',
      header: '総合スコア',
      cell: (item: any) =>
        item.score ? (
          <Box fontWeight="bold" fontSize="heading-s">
            {item.score}/100
          </Box>
        ) : (
          <Box color="text-body-secondary">処理中</Box>
        ),
    },
    {
      id: 'findings',
      header: '検出事項',
      cell: (item: any) =>
        item.criticalFindings !== undefined ? (
          <SpaceBetween direction="horizontal" size="xs">
            <Badge color="red">{item.criticalFindings}</Badge>
            <Badge color="severity-high">{item.highFindings}</Badge>
            <Badge color="blue">{item.mediumFindings}</Badge>
            <Badge color="grey">{item.lowFindings}</Badge>
          </SpaceBetween>
        ) : (
          <Box color="text-body-secondary">未完了</Box>
        ),
    },
    {
      id: 'createdAt',
      header: '実行日時',
      cell: (item: any) => dayjs(item.createdAt).format('MM/DD HH:mm'),
    },
  ];

  const wellArchitectedData = [
    { name: '運用上の優秀性', score: 82 },
    { name: 'セキュリティ', score: 68 },
    { name: '信頼性', score: 85 },
    { name: 'パフォーマンス効率', score: 75 },
    { name: 'コスト最適化', score: 72 },
    { name: '持続可能性', score: 80 },
  ];

  return (
    <SpaceBetween direction="vertical" size="l">
      {/* ヘッダー統計 */}
      <Container>
        <ColumnLayout columns={4}>
          <div>
            <Box variant="awsui-key-label">総プロジェクト数</Box>
            <Box variant="awsui-value-large" color="text-status-info">
              {totalProjects}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">総分析数</Box>
            <Box variant="awsui-value-large" color="text-status-success">
              {totalAnalyses}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">完了分析</Box>
            <Box variant="awsui-value-large" color="text-status-warning">
              {completedAnalyses}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">平均スコア</Box>
            <Box variant="awsui-value-large">
              {Math.round(avgScore)}/100
            </Box>
          </div>
        </ColumnLayout>
      </Container>

      {/* プロジェクト一覧 */}
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <Button variant="primary" iconName="add-plus">
                新しい分析を開始
              </Button>
            }
          >
            プロジェクト一覧 ({userProjects.length})
          </Header>
        }
      >
        <Table
          columnDefinitions={projectColumns}
          items={projectTableData}
          variant="container"
          stickyHeader
          resizableColumns
        />
      </Container>

      {/* 最新分析結果 */}
      <Container
        header={
          <Header
            variant="h2"
            actions={<Link>すべて表示</Link>}
          >
            最新の分析結果
          </Header>
        }
      >
        <Table
          columnDefinitions={analysisColumns}
          items={analysisTableData}
          variant="container"
          stickyHeader
          resizableColumns
        />
      </Container>

      {/* Well-Architected柱の概要 */}
      <Container
        header={
          <Header variant="h2">
            Well-Architected Framework 分析概要
          </Header>
        }
      >
        <ColumnLayout columns={3}>
          {wellArchitectedData.map((pillar, index) => (
            <div key={index}>
              <Box variant="awsui-key-label">{pillar.name}</Box>
              <Box variant="awsui-value-large">
                {pillar.score}/100
              </Box>
              <ProgressBar
                value={pillar.score}
                description=""
              />
            </div>
          ))}
        </ColumnLayout>
      </Container>
    </SpaceBetween>
  );
}