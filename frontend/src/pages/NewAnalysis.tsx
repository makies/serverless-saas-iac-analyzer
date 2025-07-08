import {
  CloudOutlined,
  InboxOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
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
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/api';
import { getUserProjects, mockUser } from '../services/mockData';
import type { AnalysisType } from '../types';
import type { Schema } from '../../../amplify/data/resource';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function NewAnalysis() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const userProjects = getUserProjects(mockUser.id);
  const { message } = App.useApp();

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

    try {
      // Create GraphQL client
      const client = generateClient<Schema>();
      
      // Upload files to S3 first
      const uploadedFiles = [];
      
      if (analysisType && analysisType !== 'LiveScan' && files.length > 0) {
        message.info('ファイルをアップロード中...');
        
        for (const file of files) {
          try {
            // Generate unique file path with tenant isolation
            const tenantId = mockUser.tenantId; // Replace with actual tenant ID from auth
            const timestamp = Date.now();
            const fileName = `public/${timestamp}-${file.name}`;
            
            // Upload file to S3 using Amplify Gen 2 Storage
            const result = await uploadData({
              path: fileName, // Use 'path' instead of 'key' for Gen 2
              data: file.originFileObj,
              options: {
                contentType: file.type || 'application/octet-stream',
                metadata: {
                  originalName: file.name,
                  analysisType: analysisType as string,
                  tenantId: tenantId,
                }
              }
            }).result;
            
            uploadedFiles.push({
              key: result.path || fileName,
              name: file.name,
              size: file.size,
              type: file.type
            });
            
            console.log('File uploaded successfully:', result.path || fileName);
          } catch (uploadError) {
            console.error('File upload failed:', uploadError);
            message.error(`ファイル "${file.name}" のアップロードに失敗しました`);
            throw uploadError;
          }
        }
        
        message.success('ファイルのアップロードが完了しました');
      }

      // Create analysis record in GraphQL
      message.info('分析を作成中...');
      
      const analysisTypeForDB = (analysisType === 'CloudFormation' ? 'CLOUDFORMATION' : 
                                analysisType === 'Terraform' ? 'TERRAFORM' :
                                analysisType === 'CDK' ? 'CDK' :
                                analysisType === 'LiveScan' ? 'LIVE_SCAN' : 'CLOUDFORMATION');
      
      const analysisInput = {
        tenantId: mockUser.tenantId,
        projectId: values.projectId,
        name: values.analysisName,
        type: analysisTypeForDB,
        status: 'PENDING' as 'PENDING',
        inputFiles: analysisTypeForDB === 'LIVE_SCAN' ? null : JSON.stringify(uploadedFiles),
        awsConfig: analysisTypeForDB === 'LIVE_SCAN' ? JSON.stringify({
          region: values.awsRegion,
          accountId: values.awsAccountId
        }) : null,
        createdBy: mockUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const createResult = await client.models.Analysis.create(analysisInput);
      
      if (createResult.errors) {
        console.error('GraphQL errors:', createResult.errors);
        throw new Error('分析の作成に失敗しました');
      }

      const newAnalysisId = createResult.data?.id;
      
      if (!newAnalysisId) {
        throw new Error('分析IDが取得できませんでした');
      }

      console.log('Analysis created successfully:', {
        id: newAnalysisId,
        ...values,
        uploadedFiles,
      });

      message.success('分析が正常に作成されました');
      setIsSubmitting(false);

      // 分析結果ページへリダイレクト
      navigate(`/analysis/${newAnalysisId}`);
      
    } catch (error) {
      console.error('Analysis creation failed:', error);
      message.error(error instanceof Error ? error.message : '分析の作成に失敗しました');
      setIsSubmitting(false);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList: files,
    beforeUpload: (file: any) => {
      // Validate file size (10MB limit)
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('ファイルサイズは10MB未満にしてください');
        return false;
      }
      
      // Validate file type
      const acceptedTypes = getFileAccept(analysisType);
      if (acceptedTypes) {
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const acceptedExtensions = acceptedTypes.split(',');
        const isValidType = acceptedExtensions.some(ext => 
          ext.trim().toLowerCase() === fileExtension
        );
        
        if (!isValidType) {
          message.error(`許可されていないファイル形式です。対応形式: ${acceptedTypes}`);
          return false;
        }
      }
      
      // Store file without uploading yet (upload happens on form submit)
      return false;
    },
    onChange: (info: any) => {
      setFiles(info.fileList.filter((file: any) => file.status !== 'error'));
    },
    accept: getFileAccept(analysisType),
    onRemove: (file: any) => {
      setFiles(files.filter(f => f.uid !== file.uid));
    },
  };

  function getFileAccept(type: string) {
    switch (type) {
      case 'CloudFormation':
        return '.yaml,.yml,.json,.zip';
      case 'Terraform':
        return '.tf,.tfvars,.zip';
      case 'CDK':
        return '.ts,.js,.py,.zip';
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
                    { 
                      required: true, 
                      message: 'ファイルをアップロードしてください',
                      validator: (_, value) => {
                        if (analysisType !== '' && analysisType !== 'LiveScan' && files.length === 0) {
                          return Promise.reject(new Error('ファイルをアップロードしてください'));
                        }
                        return Promise.resolve();
                      }
                    },
                  ]}
                  extra={`${analysisType}ファイルまたはZIPアーカイブをアップロードしてください（最大10MB）`}
                >
                  <Dragger {...uploadProps} style={{ padding: '40px' }}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                    </p>
                    <p className="ant-upload-text">
                      ファイルをここにドラッグ&ドロップするか、クリックして選択
                    </p>
                    <p className="ant-upload-hint">
                      複数ファイルの同時アップロードとZIPファイルに対応しています。
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