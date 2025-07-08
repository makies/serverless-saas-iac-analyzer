import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Input,
  TimePicker,
  Switch,
  Alert,
  Typography,
  Row,
  Col,
  Descriptions,
  Popconfirm,
  message,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface AwsAccount {
  id: string;
  accountId: string;
  accountName: string;
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT' | 'TEST' | 'SANDBOX';
  region: string;
  isActive: boolean;
}

interface ScanSchedule {
  id: string;
  name: string;
  description?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  cronExpression?: string;
  accountIds: string[];
  services: string[];
  regions: string[];
  frameworks: string[];
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  settings: {
    parallelExecution: boolean;
    maxConcurrentScans: number;
    failOnAccountError: boolean;
    notifyOnCompletion: boolean;
    notifyOnFailure: boolean;
    retentionDays: number;
  };
  notificationSettings: {
    emailAddresses: string[];
    slackWebhook?: string;
    includeDetailedReport: boolean;
  };
  createdAt: string;
  createdBy: string;
}

interface ScanScheduleManagerProps {
  projectId: string;
  tenantId: string;
  accounts: AwsAccount[];
  onScheduleCreated?: (schedule: ScanSchedule) => void;
  onScheduleUpdated?: (scheduleId: string, schedule: ScanSchedule) => void;
  onScheduleDeleted?: (scheduleId: string) => void;
}

const ScanScheduleManager: React.FC<ScanScheduleManagerProps> = ({
  projectId,
  tenantId,
  accounts,
  onScheduleCreated,
  onScheduleUpdated,
  onScheduleDeleted,
}) => {
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScanSchedule | null>(null);
  const [form] = Form.useForm();

  // Available options
  const frequencyOptions = [
    { value: 'DAILY', label: '毎日' },
    { value: 'WEEKLY', label: '毎週' },
    { value: 'MONTHLY', label: '毎月' },
    { value: 'CUSTOM', label: 'カスタム（Cron式）' },
  ];

  const availableServices = [
    'ECS',
    'Lambda',
    'S3',
    'RDS',
    'CloudFormation',
    'IAM',
    'Organizations',
    'Support',
    'Config',
  ];

  const availableRegions = [
    'us-east-1',
    'us-west-2',
    'ap-northeast-1',
    'eu-west-1',
    'eu-central-1',
  ];

  const availableFrameworks = [
    { value: 'well-architected', label: 'AWS Well-Architected Framework' },
    { value: 'security-hub', label: 'AWS Security Hub' },
    { value: 'serverless-lens', label: 'Serverless Lens' },
    { value: 'saas-lens', label: 'SaaS Lens' },
  ];

  useEffect(() => {
    loadSchedules();
  }, [projectId]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      // Mock data for now - replace with actual API call
      const mockSchedules: ScanSchedule[] = [
        {
          id: 'schedule-1',
          name: '本番環境週次スキャン',
          description: '本番環境アカウントの週次スキャン',
          frequency: 'WEEKLY',
          cronExpression: '0 2 * * 1', // Every Monday at 2 AM
          accountIds: accounts.filter(acc => acc.environment === 'PRODUCTION').map(acc => acc.id),
          services: ['ECS', 'Lambda', 'S3', 'RDS'],
          regions: ['ap-northeast-1', 'us-east-1'],
          frameworks: ['well-architected', 'security-hub'],
          isActive: true,
          lastRun: '2024-01-15T02:00:00Z',
          nextRun: '2024-01-22T02:00:00Z',
          runCount: 8,
          settings: {
            parallelExecution: true,
            maxConcurrentScans: 2,
            failOnAccountError: false,
            notifyOnCompletion: true,
            notifyOnFailure: true,
            retentionDays: 90,
          },
          notificationSettings: {
            emailAddresses: ['admin@company.com'],
            includeDetailedReport: true,
          },
          createdAt: '2024-01-01T00:00:00Z',
          createdBy: 'user-1',
        },
        {
          id: 'schedule-2',
          name: '開発環境日次スキャン',
          description: '開発環境アカウントの日次スキャン',
          frequency: 'DAILY',
          cronExpression: '0 1 * * *', // Every day at 1 AM
          accountIds: accounts.filter(acc => acc.environment === 'DEVELOPMENT').map(acc => acc.id),
          services: ['ECS', 'Lambda'],
          regions: ['ap-northeast-1'],
          frameworks: ['well-architected'],
          isActive: false,
          lastRun: '2024-01-14T01:00:00Z',
          nextRun: undefined,
          runCount: 14,
          settings: {
            parallelExecution: false,
            maxConcurrentScans: 1,
            failOnAccountError: true,
            notifyOnCompletion: false,
            notifyOnFailure: true,
            retentionDays: 30,
          },
          notificationSettings: {
            emailAddresses: ['dev@company.com'],
            includeDetailedReport: false,
          },
          createdAt: '2024-01-01T00:00:00Z',
          createdBy: 'user-2',
        },
      ];
      setSchedules(mockSchedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      message.error('スケジュールの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async (values: any) => {
    try {
      setLoading(true);

      // Generate cron expression if needed
      let cronExpression = values.cronExpression;
      if (values.frequency !== 'CUSTOM') {
        cronExpression = generateCronExpression(values.frequency, values.time);
      }

      const schedule: ScanSchedule = {
        id: `schedule-${Date.now()}`,
        name: values.name,
        description: values.description,
        frequency: values.frequency,
        cronExpression,
        accountIds: values.accountIds || accounts.map(acc => acc.id),
        services: values.services,
        regions: values.regions,
        frameworks: values.frameworks,
        isActive: values.isActive ?? true,
        runCount: 0,
        settings: {
          parallelExecution: values.parallelExecution ?? true,
          maxConcurrentScans: values.maxConcurrentScans ?? 3,
          failOnAccountError: values.failOnAccountError ?? false,
          notifyOnCompletion: values.notifyOnCompletion ?? true,
          notifyOnFailure: values.notifyOnFailure ?? true,
          retentionDays: values.retentionDays ?? 90,
        },
        notificationSettings: {
          emailAddresses: values.emailAddresses || [],
          slackWebhook: values.slackWebhook,
          includeDetailedReport: values.includeDetailedReport ?? true,
        },
        createdAt: new Date().toISOString(),
        createdBy: 'current-user',
      };

      console.log('Creating schedule:', schedule);

      // TODO: Implement actual API call
      setSchedules(prev => [...prev, schedule]);
      setShowScheduleModal(false);
      form.resetFields();
      message.success('スケジュールが作成されました');

      if (onScheduleCreated) {
        onScheduleCreated(schedule);
      }
    } catch (error) {
      console.error('Failed to create schedule:', error);
      message.error('スケジュールの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (scheduleId: string, values: any) => {
    try {
      setLoading(true);

      // Generate cron expression if needed
      let cronExpression = values.cronExpression;
      if (values.frequency !== 'CUSTOM') {
        cronExpression = generateCronExpression(values.frequency, values.time);
      }

      const updatedSchedule: ScanSchedule = {
        ...editingSchedule!,
        name: values.name,
        description: values.description,
        frequency: values.frequency,
        cronExpression,
        accountIds: values.accountIds || accounts.map(acc => acc.id),
        services: values.services,
        regions: values.regions,
        frameworks: values.frameworks,
        isActive: values.isActive,
        settings: {
          parallelExecution: values.parallelExecution ?? true,
          maxConcurrentScans: values.maxConcurrentScans ?? 3,
          failOnAccountError: values.failOnAccountError ?? false,
          notifyOnCompletion: values.notifyOnCompletion ?? true,
          notifyOnFailure: values.notifyOnFailure ?? true,
          retentionDays: values.retentionDays ?? 90,
        },
        notificationSettings: {
          emailAddresses: values.emailAddresses || [],
          slackWebhook: values.slackWebhook,
          includeDetailedReport: values.includeDetailedReport ?? true,
        },
      };

      console.log('Updating schedule:', updatedSchedule);

      // TODO: Implement actual API call
      setSchedules(prev => 
        prev.map(schedule => 
          schedule.id === scheduleId ? updatedSchedule : schedule
        )
      );
      setShowScheduleModal(false);
      setEditingSchedule(null);
      form.resetFields();
      message.success('スケジュールが更新されました');

      if (onScheduleUpdated) {
        onScheduleUpdated(scheduleId, updatedSchedule);
      }
    } catch (error) {
      console.error('Failed to update schedule:', error);
      message.error('スケジュールの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      setLoading(true);
      console.log('Deleting schedule:', scheduleId);

      // TODO: Implement actual API call
      setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId));
      message.success('スケジュールが削除されました');

      if (onScheduleDeleted) {
        onScheduleDeleted(scheduleId);
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      message.error('スケジュールの削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleScheduleStatus = async (scheduleId: string, isActive: boolean) => {
    try {
      console.log('Toggling schedule status:', scheduleId, isActive);

      // TODO: Implement actual API call
      setSchedules(prev => 
        prev.map(schedule => 
          schedule.id === scheduleId ? { ...schedule, isActive } : schedule
        )
      );
      message.success(`スケジュールが${isActive ? '有効' : '無効'}になりました`);
    } catch (error) {
      console.error('Failed to toggle schedule status:', error);
      message.error('スケジュールの状態変更に失敗しました');
    }
  };

  const runScheduleNow = async (scheduleId: string) => {
    try {
      console.log('Running schedule immediately:', scheduleId);

      // TODO: Implement actual API call to trigger immediate execution
      message.success('スケジュールの即座実行を開始しました');
    } catch (error) {
      console.error('Failed to run schedule:', error);
      message.error('スケジュールの実行に失敗しました');
    }
  };

  const generateCronExpression = (frequency: string, time?: Dayjs): string => {
    if (!time) {
      time = dayjs().hour(2).minute(0); // Default to 2:00 AM
    }

    const minute = time.minute();
    const hour = time.hour();

    switch (frequency) {
      case 'DAILY':
        return `${minute} ${hour} * * *`;
      case 'WEEKLY':
        return `${minute} ${hour} * * 1`; // Monday
      case 'MONTHLY':
        return `${minute} ${hour} 1 * *`; // 1st of month
      default:
        return `${minute} ${hour} * * *`;
    }
  };

  const openEditModal = (schedule: ScanSchedule) => {
    setEditingSchedule(schedule);
    
    // Parse cron expression to extract time
    let time = dayjs().hour(2).minute(0);
    if (schedule.cronExpression) {
      const parts = schedule.cronExpression.split(' ');
      if (parts.length >= 2) {
        const minute = parseInt(parts[0]);
        const hour = parseInt(parts[1]);
        if (!isNaN(minute) && !isNaN(hour)) {
          time = dayjs().hour(hour).minute(minute);
        }
      }
    }

    form.setFieldsValue({
      name: schedule.name,
      description: schedule.description,
      frequency: schedule.frequency,
      time: schedule.frequency !== 'CUSTOM' ? time : undefined,
      cronExpression: schedule.frequency === 'CUSTOM' ? schedule.cronExpression : undefined,
      accountIds: schedule.accountIds,
      services: schedule.services,
      regions: schedule.regions,
      frameworks: schedule.frameworks,
      isActive: schedule.isActive,
      parallelExecution: schedule.settings.parallelExecution,
      maxConcurrentScans: schedule.settings.maxConcurrentScans,
      failOnAccountError: schedule.settings.failOnAccountError,
      notifyOnCompletion: schedule.settings.notifyOnCompletion,
      notifyOnFailure: schedule.settings.notifyOnFailure,
      retentionDays: schedule.settings.retentionDays,
      emailAddresses: schedule.notificationSettings.emailAddresses,
      slackWebhook: schedule.notificationSettings.slackWebhook,
      includeDetailedReport: schedule.notificationSettings.includeDetailedReport,
    });
    setShowScheduleModal(true);
  };

  const getStatusIcon = (schedule: ScanSchedule) => {
    if (!schedule.isActive) {
      return <PauseCircleOutlined style={{ color: '#faad14' }} />;
    }
    if (schedule.runCount === 0) {
      return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
    }
    return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  };

  const getNextRunDisplay = (schedule: ScanSchedule) => {
    if (!schedule.isActive) {
      return <Tag color="default">無効</Tag>;
    }
    if (!schedule.nextRun) {
      return <Tag color="default">未設定</Tag>;
    }
    const nextRun = dayjs(schedule.nextRun);
    const now = dayjs();
    const diff = nextRun.diff(now, 'hour');
    
    if (diff < 0) {
      return <Tag color="warning">期限切れ</Tag>;
    } else if (diff < 24) {
      return <Tag color="processing">{diff}時間後</Tag>;
    } else {
      return <Tag color="default">{nextRun.format('YYYY-MM-DD HH:mm')}</Tag>;
    }
  };

  const columns: ColumnsType<ScanSchedule> = [
    {
      title: 'スケジュール名',
      key: 'name',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            {getStatusIcon(record)}
            <Text strong>{record.name}</Text>
          </Space>
          {record.description && <Text type="secondary">{record.description}</Text>}
        </Space>
      ),
    },
    {
      title: '頻度',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (frequency) => {
        const option = frequencyOptions.find(opt => opt.value === frequency);
        return <Tag>{option?.label || frequency}</Tag>;
      },
    },
    {
      title: 'アカウント数',
      key: 'accountCount',
      render: (_, record) => record.accountIds.length,
    },
    {
      title: '次回実行',
      key: 'nextRun',
      render: (_, record) => getNextRunDisplay(record),
    },
    {
      title: '実行回数',
      dataIndex: 'runCount',
      key: 'runCount',
    },
    {
      title: 'ステータス',
      key: 'status',
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? 'アクティブ' : '無効'}
        </Tag>
      ),
    },
    {
      title: 'アクション',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => runScheduleNow(record.id)}
            disabled={loading}
          >
            即座実行
          </Button>
          <Button
            size="small"
            icon={record.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => toggleScheduleStatus(record.id, !record.isActive)}
            disabled={loading}
          >
            {record.isActive ? '無効化' : '有効化'}
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            編集
          </Button>
          <Popconfirm
            title="このスケジュールを削除しますか？"
            onConfirm={() => deleteSchedule(record.id)}
            okText="削除"
            cancelText="キャンセル"
          >
            <Button
              size="small"
              icon={<DeleteOutlined />}
              danger
              disabled={loading}
            >
              削除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card 
        title="スキャンスケジュール管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowScheduleModal(true)}
          >
            新規スケジュール作成
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Schedule Creation/Edit Modal */}
      <Modal
        title={editingSchedule ? 'スケジュール編集' : '新規スケジュール作成'}
        open={showScheduleModal}
        onCancel={() => {
          setShowScheduleModal(false);
          setEditingSchedule(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={800}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (editingSchedule) {
              updateSchedule(editingSchedule.id, values);
            } else {
              createSchedule(values);
            }
          }}
          initialValues={{
            isActive: true,
            parallelExecution: true,
            maxConcurrentScans: 3,
            failOnAccountError: false,
            notifyOnCompletion: true,
            notifyOnFailure: true,
            retentionDays: 90,
            includeDetailedReport: true,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="スケジュール名"
                rules={[{ required: true, message: 'スケジュール名を入力してください' }]}
              >
                <Input placeholder="例: 本番環境週次スキャン" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isActive" label="ステータス" valuePropName="checked">
                <Switch checkedChildren="有効" unCheckedChildren="無効" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="説明">
            <TextArea placeholder="スケジュールの説明（オプション）" rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="frequency"
                label="実行頻度"
                rules={[{ required: true, message: '実行頻度を選択してください' }]}
              >
                <Select placeholder="頻度を選択">
                  {frequencyOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => 
                  prevValues.frequency !== currentValues.frequency
                }
              >
                {({ getFieldValue }) => {
                  const frequency = getFieldValue('frequency');
                  return frequency && frequency !== 'CUSTOM' ? (
                    <Form.Item name="time" label="実行時刻">
                      <TimePicker format="HH:mm" placeholder="時刻を選択" />
                    </Form.Item>
                  ) : null;
                }}
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => 
                  prevValues.frequency !== currentValues.frequency
                }
              >
                {({ getFieldValue }) => {
                  const frequency = getFieldValue('frequency');
                  return frequency === 'CUSTOM' ? (
                    <Form.Item
                      name="cronExpression"
                      label="Cron式"
                      rules={[{ required: true, message: 'Cron式を入力してください' }]}
                    >
                      <Input placeholder="0 2 * * 1" />
                    </Form.Item>
                  ) : null;
                }}
              </Form.Item>
            </Col>
          </Row>

          <Divider>スキャン設定</Divider>

          <Form.Item
            name="accountIds"
            label="対象AWSアカウント"
            tooltip="選択しない場合、全てのプロジェクトアカウントが対象になります"
          >
            <Select
              mode="multiple"
              placeholder="アカウントを選択（空の場合は全アカウント）"
              allowClear
            >
              {accounts.map(account => (
                <Option key={account.id} value={account.id}>
                  {account.accountName} ({account.accountId}) - {account.environment}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="services"
                label="スキャン対象サービス"
                rules={[{ required: true, message: 'サービスを選択してください' }]}
              >
                <Select mode="multiple" placeholder="AWSサービスを選択">
                  {availableServices.map(service => (
                    <Option key={service} value={service}>{service}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="regions"
                label="スキャン対象リージョン"
                rules={[{ required: true, message: 'リージョンを選択してください' }]}
              >
                <Select mode="multiple" placeholder="AWSリージョンを選択">
                  {availableRegions.map(region => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="frameworks"
                label="分析フレームワーク"
                rules={[{ required: true, message: 'フレームワークを選択してください' }]}
              >
                <Select mode="multiple" placeholder="フレームワークを選択">
                  {availableFrameworks.map(framework => (
                    <Option key={framework.value} value={framework.value}>
                      {framework.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider>実行オプション</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="parallelExecution" label="並列実行" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxConcurrentScans" label="最大同時実行数">
                <Select placeholder="同時実行数">
                  {[1, 2, 3, 4, 5].map(num => (
                    <Option key={num} value={num}>{num}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="retentionDays" label="結果保持期間（日）">
                <Select placeholder="保持期間">
                  <Option value={30}>30日</Option>
                  <Option value={60}>60日</Option>
                  <Option value={90}>90日</Option>
                  <Option value={180}>180日</Option>
                  <Option value={365}>1年</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="failOnAccountError" label="アカウントエラー時停止" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notifyOnCompletion" label="完了時通知" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notifyOnFailure" label="失敗時通知" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider>通知設定</Divider>

          <Form.Item name="emailAddresses" label="通知先メールアドレス">
            <Select
              mode="tags"
              placeholder="メールアドレスを入力"
              tokenSeparators={[',', ';']}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="slackWebhook" label="Slack Webhook URL（オプション）">
                <Input placeholder="https://hooks.slack.com/services/..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="includeDetailedReport" label="詳細レポート添付" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default ScanScheduleManager;