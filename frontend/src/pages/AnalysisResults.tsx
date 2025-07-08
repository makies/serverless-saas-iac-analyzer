import {
  BarChartOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  LinkOutlined,
  PlusOutlined,
  SafetyOutlined,
  BankOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
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
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { analysisQueries, projectQueries } from '../services/graphqlQueries';
import { useAuth } from '../hooks/useAuth';
import type { Finding, WellArchitectedPillar } from '../types';
import OrganizationsView from '../components/OrganizationsView';
import SupportView from '../components/SupportView';

const { Title, Text } = Typography;

export default function AnalysisResults() {
  const navigate = useNavigate();
  const { analysisId } = useParams();
  const { user } = useAuth();
  const [activeTabKey, setActiveTabKey] = useState('overview');
  const [analysis, setAnalysis] = useState<any>(null);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

  useEffect(() => {
    loadAnalysisData();
  }, [analysisId]);

  const loadAnalysisData = async () => {
    if (!analysisId) {
      console.warn('No analysisId provided');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('Loading analysis data for ID:', analysisId);
      
      // For now, use mock data for the analysis detail page
      // Later this will be replaced with actual GraphQL queries
      const mockAnalysisData = {
        id: analysisId,
        name: 'サンプルライブスキャン分析',
        type: 'LIVE_SCAN',
        status: 'COMPLETED',
        projectId: 'project-1',
        tenantId: 'tenant-1',
        strategy: 'LIVE_SCAN',
        inputFiles: {
          'template.yaml': 'AWSTemplateFormatVersion: "2010-09-09"...'
        },
        awsConfig: {
          region: 'ap-northeast-1',
          accountId: '123456789012'
        },
        resultSummary: {
          overallScore: 68,
          criticalFindings: 1,
          highFindings: 2,
          mediumFindings: 5,
          lowFindings: 2,
          totalFindings: 10,
          completedAt: new Date().toISOString()
        },
        scanResults: {
          organizations: {
            organization: {
              id: 'o-example1234',
              masterAccountId: '123456789012',
              masterAccountEmail: 'admin@example.com',
              featureSet: 'ALL_FEATURES',
              arn: 'arn:aws:organizations::123456789012:organization/o-example1234'
            },
            accounts: [
              {
                id: '123456789012',
                name: 'Master Account',
                email: 'admin@example.com',
                status: 'ACTIVE',
                joinedMethod: 'INVITED',
                joinedTimestamp: '2023-01-15T10:30:00Z'
              },
              {
                id: '234567890123',
                name: 'Production Account',
                email: 'prod@example.com',
                status: 'ACTIVE',
                joinedMethod: 'CREATED',
                joinedTimestamp: '2023-02-20T14:15:00Z'
              },
              {
                id: '345678901234',
                name: 'Development Account',
                email: 'dev@example.com',
                status: 'ACTIVE',
                joinedMethod: 'CREATED',
                joinedTimestamp: '2023-03-10T09:45:00Z'
              },
              {
                id: '456789012345',
                name: 'Staging Account',
                email: 'staging@example.com',
                status: 'ACTIVE',
                joinedMethod: 'CREATED',
                joinedTimestamp: '2023-04-05T16:20:00Z'
              }
            ],
            organizationalUnits: [
              {
                id: 'ou-root-123456',
                name: 'Root OU',
                type: 'ROOT'
              },
              {
                id: 'ou-prod-789012',
                name: 'Production OU',
                parentId: 'ou-root-123456',
                type: 'ORGANIZATIONAL_UNIT'
              },
              {
                id: 'ou-dev-345678',
                name: 'Development OU',
                parentId: 'ou-root-123456',
                type: 'ORGANIZATIONAL_UNIT'
              }
            ],
            policies: [
              {
                id: 'p-fullaccess',
                name: 'FullAWSAccess',
                type: 'SERVICE_CONTROL_POLICY',
                awsManaged: true,
                description: 'Allows full access to AWS services and resources.',
                content: '{\n  "Version": "2012-10-17",\n  "Statement": {\n    "Effect": "Allow",\n    "Action": "*",\n    "Resource": "*"\n  }\n}'
              },
              {
                id: 'p-deny-root',
                name: 'DenyRootAccess',
                type: 'SERVICE_CONTROL_POLICY',
                awsManaged: false,
                description: 'Prevents root user access in member accounts.',
                content: '{\n  "Version": "2012-10-17",\n  "Statement": {\n    "Effect": "Deny",\n    "Principal": {\n      "AWS": "*"\n    },\n    "Action": "*",\n    "Resource": "*",\n    "Condition": {\n      "StringEquals": {\n        "aws:RequestedRegion": "us-east-1"\n      }\n    }\n  }\n}'
              },
              {
                id: 'p-tag-policy',
                name: 'RequiredTags',
                type: 'TAG_POLICY',
                awsManaged: false,
                description: 'Enforces required tags on resources.',
                content: '{\n  "tags": {\n    "Environment": {\n      "tag_key": {\n        "@@assign": "Environment"\n      },\n      "tag_value": {\n        "@@assign": ["Production", "Development", "Staging"]\n      },\n      "enforced_for": {\n        "@@assign": ["ec2:instance", "s3:bucket"]\n      }\n    }\n  }\n}'
              }
            ]
          },
          support: {
            plan: {
              planName: 'Business',
              planType: 'BUSINESS',
              trustedAdvisorAccess: true,
              caseManagementAccess: true,
              checksAvailable: 115,
              features: {
                trustedAdvisor: true,
                caseManagement: true,
                phoneSupport: false,
                chatSupport: true,
                architecturalGuidance: false,
                infrastructureEventManagement: false,
              }
            },
            trustedAdvisorChecks: [
              {
                id: 'check-001',
                name: 'Security Groups - Unrestricted Access',
                category: 'Security',
                status: 'warning',
                description: 'Checks for security groups that allow unrestricted access (0.0.0.0/0) on specific ports.'
              },
              {
                id: 'check-002', 
                name: 'MFA on Root Account',
                category: 'Security',
                status: 'ok',
                description: 'Checks whether MFA is enabled for the root account.'
              },
              {
                id: 'check-003',
                name: 'Low Utilization Amazon EC2 Instances',
                category: 'Cost Optimization',
                status: 'warning',
                description: 'Checks for EC2 instances that appear to be underutilized.'
              }
            ]
          }
        },
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        createdBy: 'current-user'
      };
      
      const mockProjectData = {
        id: 'project-1',
        name: 'デモプロジェクト',
        description: 'デモ用のテストプロジェクト',
        status: 'ACTIVE'
      };
      
      const mockFindings = [
        {
          id: 'finding-1',
          title: 'S3バケットのパブリックアクセスが有効',
          description: 'S3バケットがパブリックアクセスを許可しています。機密データが漏洩する可能性があります。',
          severity: 'CRITICAL',
          pillar: 'SECURITY',
          resource: 'AWS::S3::Bucket',
          line: 15,
          recommendation: 'S3バケットのパブリックアクセスをブロックし、必要に応じてIAMポリシーでアクセスを制御してください。',
          category: 'Security',
          ruleId: 'S3-001',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html'
        },
        {
          id: 'finding-2', 
          title: 'Lambda関数のタイムアウト設定が不適切',
          description: 'Lambda関数のタイムアウトが3秒に設定されており、処理が完了しない可能性があります。',
          severity: 'HIGH',
          pillar: 'RELIABILITY',
          resource: 'AWS::Lambda::Function',
          line: 28,
          recommendation: 'Lambda関数のタイムアウトを30秒以上に設定することを推奨します。処理時間に応じて適切な値を設定してください。',
          category: 'Configuration',
          ruleId: 'LAMBDA-002',
          documentationUrl: 'https://docs.aws.amazon.com/lambda/latest/dg/configuration-function-common.html#configuration-timeout-console'
        },
        {
          id: 'finding-3',
          title: 'RDSインスタンスのマルチAZ配置が無効',
          description: 'RDSインスタンスがシングルAZ配置されており、可用性が低い状態です。',
          severity: 'MEDIUM',
          pillar: 'RELIABILITY',
          resource: 'AWS::RDS::DBInstance',
          line: 45,
          recommendation: 'RDSインスタンスでマルチAZ配置を有効にしてください。CloudFormationテンプレートでMultiAZ: trueを設定し、自動フェイルオーバー機能を有効化することで、AZ障害時の可用性を向上させます。',
          category: 'Availability',
          ruleId: 'RDS-003',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html'
        },
        {
          id: 'finding-4',
          title: 'CloudWatch Logsの保持期間が無制限',
          description: 'CloudWatch Logsの保持期間が設定されておらず、ログが無期限に保存されコストが増大します。',
          severity: 'LOW',
          pillar: 'COST_OPTIMIZATION',
          resource: 'AWS::Logs::LogGroup',
          line: 62,
          recommendation: 'RetentionInDaysプロパティを設定してログの保持期間を制限してください。一般的には7日、30日、90日などビジネス要件に応じて設定します。',
          category: 'Cost Management',
          ruleId: 'LOGS-001',
          documentationUrl: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html#SettingLogRetention'
        },
        {
          id: 'finding-5',
          title: 'Lambda関数にDead Letter Queueが未設定',
          description: 'Lambda関数で処理に失敗した場合の例外処理機構が設定されていません。',
          severity: 'MEDIUM',
          pillar: 'RELIABILITY',
          resource: 'AWS::Lambda::Function',
          line: 35,
          recommendation: 'DeadLetterConfigプロパティでSQSキューまたはSNSトピックを指定し、処理失敗時のメッセージを確実に捕捉できるようにしてください。',
          category: 'Error Handling',
          ruleId: 'LAMBDA-003',
          documentationUrl: 'https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-dlq'
        },
        {
          id: 'finding-6',
          title: 'EC2インスタンスにdetailed monitoringが無効',
          description: 'EC2インスタンスの詳細監視が無効になっており、パフォーマンス分析が困難です。',
          severity: 'LOW',
          pillar: 'PERFORMANCE_EFFICIENCY',
          resource: 'AWS::EC2::Instance',
          line: 78,
          recommendation: 'Monitoring: trueを設定してCloudWatchの詳細監視を有効にし、1分間隔でのメトリクス収集を行ってください。',
          category: 'Monitoring',
          ruleId: 'EC2-004',
          documentationUrl: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-cloudwatch-new.html'
        },
        {
          id: 'finding-7',
          title: 'Service Control Policy (SCP)で過度な権限が許可',
          description: 'FullAWSAccessポリシーがすべてのアカウントに適用されており、最小権限原則に反しています。',
          severity: 'HIGH',
          pillar: 'SECURITY',
          resource: 'AWS::Organizations::Policy',
          recommendation: 'FullAWSAccessポリシーを削除し、各OUの用途に応じた制限的なSCPを作成してください。本番環境では特に厳格な制限を設定することを推奨します。',
          category: 'Identity & Access Management',
          ruleId: 'ORG-001',
          documentationUrl: 'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html'
        },
        {
          id: 'finding-8',
          title: 'Organizationsのタグポリシーが部分的にしか適用されていない',
          description: 'タグポリシーがEnvironmentタグのみに限定されており、Cost Centerやプロジェクト識別タグが不足しています。',
          severity: 'MEDIUM',
          pillar: 'OPERATIONAL_EXCELLENCE',
          resource: 'AWS::Organizations::Policy',
          recommendation: 'CostCenter、Project、Owner等の追加のタグを必須化し、リソースの管理責任とコスト配分を明確化してください。',
          category: 'Resource Management',
          ruleId: 'ORG-002',
          documentationUrl: 'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies.html'
        },
        {
          id: 'finding-9',
          title: 'マルチアカウント戦略でのワークロード分離が不十分',
          description: '本番、開発、ステージング環境が適切なOUで分離されていますが、セキュリティアカウント(Security OU)とログアカウント(Logging OU)が不足しています。',
          severity: 'MEDIUM',
          pillar: 'SECURITY',
          resource: 'AWS::Organizations::Organization',
          recommendation: 'セキュリティ統制用のSecurity OUとログ集約用のLogging OUを作成し、各々に専用アカウントを配置してください。これによりセキュリティの責任分離とコンプライアンス要件への対応が向上します。',
          category: 'Multi-Account Architecture',
          ruleId: 'ORG-003',
          documentationUrl: 'https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html'
        },
        {
          id: 'finding-10',
          title: 'Basicサポートプランでは高可用性要件に対応困難',
          description: 'Basic Support Planでは、Trusted Advisorの完全機能やケース管理が利用できず、本番環境での障害対応時間が長期化する可能性があります。',
          severity: 'HIGH',
          pillar: 'RELIABILITY',
          resource: 'AWS::Support::Plan',
          recommendation: 'Business Support以上のプランへのアップグレードを検討してください。特に本番環境では、24時間サポートとTrusted Advisorの完全機能が障害対応とパフォーマンス最適化に重要です。',
          category: 'Support & Maintenance',
          ruleId: 'SUPPORT-001',
          documentationUrl: 'https://aws.amazon.com/support/plans/'
        },
        {
          id: 'finding-11',
          title: 'Trusted Advisorの推奨事項が未実装',
          description: 'Trusted Advisorでセキュリティグループの制限なしアクセスとEC2インスタンスの低使用率に関する警告が出ていますが、対応が行われていません。',
          severity: 'MEDIUM',
          pillar: 'COST_OPTIMIZATION',
          resource: 'AWS::Support::TrustedAdvisorCheck',
          recommendation: 'Trusted Advisorの推奨事項を定期的にレビューし、セキュリティ向上とコスト最適化のために対応計画を策定してください。',
          category: 'Advisory Management',
          ruleId: 'SUPPORT-002',
          documentationUrl: 'https://docs.aws.amazon.com/support/latest/user/trusted-advisor.html'
        }
      ];
      
      setAnalysis(mockAnalysisData);
      setCurrentProject(mockProjectData);
      setFindings(mockFindings);
      
      console.log('✅ Mock analysis data loaded successfully');
      
    } catch (error) {
      console.error('Failed to load analysis data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Space direction="vertical">
          <Progress type="circle" />
          <Text>分析データを読み込んでいます...</Text>
        </Space>
      </div>
    );
  }

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
      CRITICAL: '#ff4d4f',
      HIGH: '#fa8c16', 
      MEDIUM: '#1890ff',
      LOW: '#8c8c8c',
      INFO: '#8c8c8c',
    };
    return colorMap[severity as keyof typeof colorMap] || '#8c8c8c';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a'; // green
    if (score >= 60) return '#faad14'; // orange
    return '#ff4d4f'; // red
  };

  const getPillarScore = (pillar: WellArchitectedPillar) => {
    const score = analysis.resultSummary?.pillars?.[pillar]?.score || 0;
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
      pillar: 'OPERATIONAL_EXCELLENCE' as WellArchitectedPillar,
    },
    {
      key: 'security',
      label: 'セキュリティ',
      pillar: 'SECURITY' as WellArchitectedPillar,
    },
    {
      key: 'reliability',
      label: '信頼性',
      pillar: 'RELIABILITY' as WellArchitectedPillar,
    },
    {
      key: 'performance',
      label: 'パフォーマンス効率',
      pillar: 'PERFORMANCE_EFFICIENCY' as WellArchitectedPillar,
    },
    {
      key: 'cost',
      label: 'コスト最適化',
      pillar: 'COST_OPTIMIZATION' as WellArchitectedPillar,
    },
    {
      key: 'sustainability',
      label: '持続可能性',
      pillar: 'SUSTAINABILITY' as WellArchitectedPillar,
    },
  ];

  const findingsColumns = [
    {
      title: '重要度',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>{severity}</Tag>
      ),
    },
    {
      title: 'タイトル・説明',
      dataIndex: 'title',
      key: 'title',
      width: 280,
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
      width: 160,
      render: (resource: string) => resource || '-',
    },
    {
      title: '行',
      dataIndex: 'line',
      key: 'line',
      width: 60,
      render: (line: number) => (line ? `L${line}` : '-'),
    },
    {
      title: '推奨対処方法・ドキュメント',
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 400,
      render: (recommendation: string, record: Finding) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text style={{ fontSize: '12px' }}>
            {recommendation || '対処方法を確認中...'}
          </Text>
          {record.documentationUrl && (
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              href={record.documentationUrl}
              target="_blank"
              style={{ padding: 0, fontSize: '11px', height: 'auto' }}
            >
              AWS公式ドキュメント
            </Button>
          )}
        </Space>
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

  const getSeverityFindings = (severity: string) => {
    return findings.filter((f) => f.severity === severity);
  };

  const getFilteredFindings = (targetFindings: Finding[]) => {
    return targetFindings.filter((f) => selectedSeverities.includes(f.severity));
  };

  const getSeverityFilterComponent = () => {
    const severityOptions = [
      { label: 'Critical', value: 'CRITICAL', color: '#ff4d4f' },
      { label: 'High', value: 'HIGH', color: '#fa8c16' },
      { label: 'Medium', value: 'MEDIUM', color: '#1890ff' },
      { label: 'Low', value: 'LOW', color: '#d9d9d9' },
    ];

    return (
      <Card size="small" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text strong>重要度でフィルタ：</Text>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px'
          }}>
            {severityOptions.map((option) => {
              const isSelected = selectedSeverities.includes(option.value);
              const baseColor = getSeverityColor(option.value);
              
              // 選択時の背景色と文字色を調整
              const getSelectedStyles = (color: string) => {
                switch (color) {
                  case '#ff4d4f': // Critical (red)
                    return { bg: '#ff4d4f', text: '#fff' };
                  case '#fa8c16': // High (orange)
                    return { bg: '#fa8c16', text: '#fff' };
                  case '#1890ff': // Medium (blue)
                    return { bg: '#1890ff', text: '#fff' };
                  case '#8c8c8c': // Low (gray)
                    return { bg: '#8c8c8c', text: '#fff' }; // 中くらいのグレーで可読性向上
                  default:
                    return { bg: color, text: '#fff' };
                }
              };
              
              const selectedStyles = getSelectedStyles(baseColor);
              
              return (
                <div
                  key={option.value}
                  onClick={() => {
                    const newSelected = isSelected 
                      ? selectedSeverities.filter(s => s !== option.value)
                      : [...selectedSeverities, option.value];
                    setSelectedSeverities(newSelected);
                  }}
                  style={{
                    backgroundColor: isSelected ? selectedStyles.bg : '#fff',
                    border: `2px solid ${isSelected ? selectedStyles.bg : baseColor}`,
                    borderRadius: '6px',
                    color: isSelected ? selectedStyles.text : baseColor,
                    fontWeight: isSelected ? '600' : 'normal',
                    height: '32px',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#fff';
                    }
                  }}
                >
                  {option.label}
                </div>
              );
            })}
          </div>
        </Space>
      </Card>
    );
  };

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
                    size={20}
                    format={(percent) => (
                      <span
                        style={{
                          color: getScoreColor(analysis.resultSummary?.overallScore || 0),
                          fontSize: '48px',
                          fontWeight: '600',
                        }}
                      >
                        {percent}%
                      </span>
                    )}
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
                  <Card 
                    size="small" 
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    hoverable
                    onClick={() => {
                      setActiveTabKey('all');
                      setSelectedSeverities(['CRITICAL']);
                    }}
                  >
                    <Statistic
                      title="Critical"
                      value={analysis.resultSummary?.criticalFindings}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card 
                    size="small" 
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    hoverable
                    onClick={() => {
                      setActiveTabKey('all');
                      setSelectedSeverities(['HIGH']);
                    }}
                  >
                    <Statistic
                      title="High"
                      value={analysis.resultSummary?.highFindings}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card 
                    size="small" 
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    hoverable
                    onClick={() => {
                      setActiveTabKey('all');
                      setSelectedSeverities(['MEDIUM']);
                    }}
                  >
                    <Statistic
                      title="Medium"
                      value={analysis.resultSummary?.mediumFindings}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card 
                    size="small" 
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    hoverable
                    onClick={() => {
                      setActiveTabKey('all');
                      setSelectedSeverities(['LOW']);
                    }}
                  >
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
    // 全ての検出事項を表示するタブを追加
    {
      key: 'all',
      label: (
        <Space>
          全て
          <Badge count={findings.length} style={{ backgroundColor: '#722ed1' }} />
        </Space>
      ),
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {getSeverityFilterComponent()}
          <Card
            title={`全検出事項一覧 (${getFilteredFindings(findings).length})`}
          >
            {getFilteredFindings(findings).length > 0 ? (
              <Table
                columns={findingsColumns}
                dataSource={getFilteredFindings(findings).map((finding) => ({
                  ...finding,
                  key: finding.id,
                }))}
                pagination={{ pageSize: 10 }}
                size="middle"
              />
            ) : (
              <Empty
                description="選択した重要度の検出事項はありません。"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Space>
      ),
    },
    // Organizations tab - only show for Live Scan analyses
    ...(analysis.strategy === 'LIVE_SCAN' && analysis.scanResults?.organizations ? [{
      key: 'organizations',
      label: (
        <Space>
          <BankOutlined />
          Organizations
          <Badge count={analysis.scanResults.organizations.accounts?.length || 0} style={{ backgroundColor: '#52c41a' }} />
        </Space>
      ),
      children: (
        <OrganizationsView 
          data={analysis.scanResults.organizations}
          loading={false}
        />
      ),
    }] : []),
    // Support tab - only show for Live Scan analyses
    ...(analysis.strategy === 'LIVE_SCAN' && analysis.scanResults?.support ? [{
      key: 'support',
      label: (
        <Space>
          <SafetyOutlined />
          サポートプラン
          <Badge 
            count={analysis.scanResults.support.plan?.planType} 
            style={{ backgroundColor: analysis.scanResults.support.plan?.planType === 'BASIC' ? '#ff4d4f' : '#52c41a' }} 
          />
        </Space>
      ),
      children: (
        <SupportView 
          data={analysis.scanResults.support}
          loading={false}
        />
      ),
    }] : []),
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
                  size={12}
                  format={(percent) => (
                    <span
                      style={{
                        color: getPillarScore(tab.pillar).color,
                        fontSize: '24px',
                        fontWeight: '600',
                      }}
                    >
                      {percent}%
                    </span>
                  )}
                />
              </Col>
            </Row>
          </Card>

          {/* 重要度フィルタ */}
          {getSeverityFilterComponent()}

          {/* 検出事項テーブル */}
          <Card
            title={`検出事項一覧 (${getFilteredFindings(getPillarFindings(tab.pillar)).length})`}
          >
            {getFilteredFindings(getPillarFindings(tab.pillar)).length > 0 ? (
              <Table
                columns={findingsColumns}
                dataSource={getFilteredFindings(getPillarFindings(tab.pillar)).map((finding) => ({
                  ...finding,
                  key: finding.id,
                }))}
                pagination={{ pageSize: 10 }}
                size="middle"
              />
            ) : (
              <Empty
                description="選択した重要度の検出事項はありません。"
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
                  analysis.status === 'COMPLETED'
                    ? 'success'
                    : analysis.status === 'RUNNING'
                      ? 'processing'
                      : analysis.status === 'FAILED'
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
      {analysis.status === 'RUNNING' && (
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
      {analysis.status === 'COMPLETED' && analysis.resultSummary && (
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
      {analysis.status === 'FAILED' && (
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