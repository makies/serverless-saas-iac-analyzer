import type {
  Analysis,
  AnalysisResultSummary,
  Finding,
  Project,
  Report,
  Tenant,
  User,
} from '../types';

export const mockUser: User = {
  id: 'user-1',
  username: 'john.doe',
  email: 'john.doe@example.com',
  role: 'ProjectManager',
  tenantId: 'tenant-1',
  projectIds: ['project-1', 'project-2'],
};

export const mockTenants: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'アクメ株式会社',
    description: 'ITコンサルティング企業',
    createdAt: '2024-01-15T09:00:00Z',
    isActive: true,
  },
  {
    id: 'tenant-2',
    name: '株式会社テック',
    description: 'クラウドソリューション企業',
    createdAt: '2024-02-01T10:30:00Z',
    isActive: true,
  },
];

export const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Eコマースプラットフォーム',
    description: 'マイクロサービスアーキテクチャによるECサイト',
    tenantId: 'tenant-1',
    status: 'Active',
    createdAt: '2024-03-01T14:00:00Z',
    updatedAt: '2024-06-15T16:30:00Z',
    memberCount: 8,
    analysisCount: 12,
  },
  {
    id: 'project-2',
    name: 'データ分析基盤',
    description: 'リアルタイム分析システム',
    tenantId: 'tenant-1',
    status: 'Active',
    createdAt: '2024-04-10T11:00:00Z',
    updatedAt: '2024-06-20T09:15:00Z',
    memberCount: 5,
    analysisCount: 8,
  },
  {
    id: 'project-3',
    name: 'AIチャットボット',
    description: 'カスタマーサポート自動化',
    tenantId: 'tenant-2',
    status: 'Active',
    createdAt: '2024-05-01T13:00:00Z',
    updatedAt: '2024-06-25T14:00:00Z',
    memberCount: 4,
    analysisCount: 6,
  },
];

const mockResultSummary: AnalysisResultSummary = {
  overallScore: 78,
  pillars: {
    OperationalExcellence: { score: 82, findings: 3, recommendations: 5 },
    Security: { score: 68, findings: 8, recommendations: 12 },
    Reliability: { score: 85, findings: 2, recommendations: 4 },
    PerformanceEfficiency: { score: 75, findings: 4, recommendations: 6 },
    CostOptimization: { score: 72, findings: 5, recommendations: 8 },
    Sustainability: { score: 80, findings: 3, recommendations: 5 },
  },
  totalFindings: 25,
  criticalFindings: 2,
  highFindings: 6,
  mediumFindings: 12,
  lowFindings: 5,
};

export const mockAnalyses: Analysis[] = [
  {
    id: 'analysis-1',
    name: 'EC基盤 CloudFormation分析',
    projectId: 'project-1',
    type: 'CloudFormation',
    status: 'Completed',
    createdAt: '2024-06-20T10:00:00Z',
    updatedAt: '2024-06-20T10:45:00Z',
    fileSize: 2048000,
    resultSummary: mockResultSummary,
  },
  {
    id: 'analysis-2',
    name: 'データ基盤 Terraform分析',
    projectId: 'project-2',
    type: 'Terraform',
    status: 'Completed',
    createdAt: '2024-06-19T15:30:00Z',
    updatedAt: '2024-06-19T16:15:00Z',
    fileSize: 1536000,
    resultSummary: {
      ...mockResultSummary,
      overallScore: 84,
      criticalFindings: 1,
      highFindings: 3,
    },
  },
  {
    id: 'analysis-3',
    name: 'ライブスキャン実行中',
    projectId: 'project-1',
    type: 'LiveScan',
    status: 'Running',
    createdAt: '2024-06-28T09:00:00Z',
    updatedAt: '2024-06-28T09:00:00Z',
  },
];

export const mockFindings: Finding[] = [
  {
    id: 'finding-1',
    analysisId: 'analysis-1',
    pillar: 'Security',
    severity: 'Critical',
    title: 'S3バケットのパブリックアクセス許可',
    description:
      'S3バケットでパブリック読み取りアクセスが有効になっています。機密データが漏洩する可能性があります。',
    recommendation:
      'S3バケットのパブリックアクセスブロック設定を有効にし、必要最小限のアクセス権限のみを付与してください。',
    resource: 'AWS::S3::Bucket',
    line: 45,
  },
  {
    id: 'finding-2',
    analysisId: 'analysis-1',
    pillar: 'Security',
    severity: 'High',
    title: 'RDSインスタンスの暗号化未設定',
    description: 'RDSインスタンスで保存時暗号化が有効になっていません。',
    recommendation:
      'RDSインスタンスの暗号化を有効にし、KMSキーを使用して暗号化してください。',
    resource: 'AWS::RDS::DBInstance',
    line: 123,
  },
  {
    id: 'finding-3',
    analysisId: 'analysis-1',
    pillar: 'CostOptimization',
    severity: 'Medium',
    title: 'EC2インスタンスサイズの最適化',
    description:
      'EC2インスタンスが過剰にプロビジョニングされている可能性があります。',
    recommendation:
      'CloudWatchメトリクスを確認し、適切なインスタンスサイズに変更することを検討してください。',
    resource: 'AWS::EC2::Instance',
    line: 78,
  },
];

export const mockReports: Report[] = [
  {
    id: 'report-1',
    analysisId: 'analysis-1',
    projectId: 'project-1',
    type: 'Summary',
    format: 'PDF',
    status: 'Ready',
    createdAt: '2024-06-20T11:00:00Z',
    downloadUrl: '/mock-downloads/summary-report.pdf',
  },
  {
    id: 'report-2',
    analysisId: 'analysis-2',
    projectId: 'project-2',
    type: 'Detailed',
    format: 'Excel',
    status: 'Ready',
    createdAt: '2024-06-19T17:00:00Z',
    downloadUrl: '/mock-downloads/detailed-report.xlsx',
  },
  {
    id: 'report-3',
    analysisId: 'analysis-1',
    projectId: 'project-1',
    type: 'Executive',
    format: 'PDF',
    status: 'Generating',
    createdAt: '2024-06-28T09:30:00Z',
  },
];

export const getUserProjects = (_userId: string): Project[] => {
  const user = mockUser;
  return mockProjects.filter(
    (project) =>
      user.projectIds.includes(project.id) || user.role === 'SystemAdmin'
  );
};

export const getProjectAnalyses = (projectId: string): Analysis[] => {
  return mockAnalyses.filter((analysis) => analysis.projectId === projectId);
};

export const getAnalysisFindings = (analysisId: string): Finding[] => {
  return mockFindings.filter((finding) => finding.analysisId === analysisId);
};

export const getProjectReports = (projectId: string): Report[] => {
  return mockReports.filter((report) => report.projectId === projectId);
};
