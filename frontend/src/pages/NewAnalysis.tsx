import {
  CloudOutlined,
  InboxOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Typography,
  Upload,
} from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserProjects, mockUser } from '../services/mockData';
import type { AnalysisType } from '../types';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function NewAnalysis() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const userProjects = getUserProjects(mockUser.id);

  const [form] = Form.useForm();
  const [analysisType, setAnalysisType] = useState<AnalysisType | ''>('');
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  const [files, setFiles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentProject = userProjects.find((p) => p.id === selectedProject);

  const projectOptions = userProjects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const analysisTypeOptions = [
    { value: 'CloudFormation', label: 'CloudFormation テンプレート' },
    { value: 'Terraform', label: 'Terraform 設定' },
    { value: 'CDK', label: 'AWS CDK コード' },
    { value: 'LiveScan', label: 'ライブAWSアカウントスキャン' },
  ];

  const awsRegionOptions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  ];

  const handleSubmit = async (values: any) => {
    setIsSubmitting(true);

    // モックの分析開始処理
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 新しい分析のIDを生成（実際は backend から返される）
    const newAnalysisId = `analysis-${Date.now()}`;

    console.log('Analysis started:', {
      id: newAnalysisId,
      ...values,
      files: files.map((f) => f.name),
    });

    setIsSubmitting(false);

    // 分析結果ページへリダイレクト
    navigate(`/analysis/${newAnalysisId}`);
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList: files,
    beforeUpload: () => false, // ファイルアップロードを防ぐ（後でhandleする）
    onChange: (info: any) => {
      setFiles(info.fileList);
    },
    accept: getFileAccept(analysisType),
  };

  function getFileAccept(type: string) {
    switch (type) {
      case 'CloudFormation':
        return '.yaml,.yml,.json';
      case 'Terraform':
        return '.tf,.tfvars';
      case 'CDK':
        return '.ts,.js,.py';
      default:
        return undefined;
    }
  }

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
      title: '新しい分析',
    },
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
        <Space direction="vertical" size="small">
          <Title level={1} style={{ margin: 0 }}>
            <PlayCircleOutlined style={{ marginRight: '12px' }} />
            新しい分析を作成
          </Title>
          <Text type="secondary">
            IaCファイルまたはライブAWSアカウントの分析を開始します
          </Text>
        </Space>
      </Card>

      {/* フォーム */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            projectId: selectedProject,
          }}
        >
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Form.Item
                label="分析名"
                name="analysisName"
                rules={[
                  { required: true, message: '分析名を入力してください' },
                ]}
                extra="この分析を識別するための名前を入力してください"
              >
                <Input
                  placeholder="例: 本番環境 CloudFormation 分析"
                  size="large"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="プロジェクト"
                name="projectId"
                rules={[
                  { required: true, message: 'プロジェクトを選択してください' },
                ]}
                extra="分析を実行するプロジェクトを選択してください"
              >
                <Select
                  placeholder="プロジェクトを選択"
                  options={projectOptions}
                  size="large"
                  value={selectedProject}
                  onChange={setSelectedProject}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="分析タイプ"
                name="analysisType"
                rules={[
                  { required: true, message: '分析タイプを選択してください' },
                ]}
                extra="分析するリソースのタイプを選択してください"
              >
                <Radio.Group
                  options={analysisTypeOptions}
                  value={analysisType}
                  onChange={(e) => {
                    setAnalysisType(e.target.value);
                    setFiles([]); // ファイルリストをクリア
                  }}
                  size="large"
                />
              </Form.Item>
            </Col>

            {analysisType && analysisType !== 'LiveScan' && (
              <Col span={24}>
                <Form.Item
                  label="ファイルアップロード"
                  name="files"
                  rules={[
                    { required: true, message: 'ファイルをアップロードしてください' },
                  ]}
                  extra={`${analysisType}ファイルをアップロードしてください（最大10MB）`}
                >
                  <Dragger {...uploadProps} style={{ padding: '40px' }}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                    </p>
                    <p className="ant-upload-text">
                      ファイルをここにドラッグ&ドロップするか、クリックして選択
                    </p>
                    <p className="ant-upload-hint">
                      複数ファイルの同時アップロードに対応しています。
                      ファイルサイズは10MB以下にしてください。
                    </p>
                  </Dragger>
                </Form.Item>
              </Col>
            )}

            {analysisType === 'LiveScan' && (
              <>
                <Col span={12}>
                  <Form.Item
                    label="AWSリージョン"
                    name="awsRegion"
                    rules={[
                      { required: true, message: 'AWSリージョンを選択してください' },
                    ]}
                    extra="スキャンするAWSリージョンを選択してください"
                  >
                    <Select
                      placeholder="リージョンを選択"
                      options={awsRegionOptions}
                      size="large"
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    label="AWSアカウントID"
                    name="awsAccountId"
                    rules={[
                      { required: true, message: 'AWSアカウントIDを入力してください' },
                      { pattern: /^\d{12}$/, message: '12桁の数字を入力してください' },
                    ]}
                    extra="スキャンするAWSアカウントの12桁のIDを入力してください"
                  >
                    <Input
                      placeholder="123456789012"
                      size="large"
                      maxLength={12}
                    />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Alert
                    message="ライブスキャンについて"
                    description="ライブスキャンを実行するには、対象のAWSアカウントに適切なIAMロールが設定されている必要があります。詳細は設定ガイドをご確認ください。"
                    type="info"
                    showIcon
                    icon={<CloudOutlined />}
                  />
                </Col>
              </>
            )}

            <Col span={24}>
              <Form.Item style={{ marginTop: '32px' }}>
                <Space>
                  <Button
                    size="large"
                    onClick={() =>
                      navigate(
                        currentProject ? `/projects/${currentProject.id}` : '/'
                      )
                    }
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isSubmitting}
                    size="large"
                    icon={<PlayCircleOutlined />}
                  >
                    分析を開始
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
}