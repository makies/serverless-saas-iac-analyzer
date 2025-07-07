#!/usr/bin/env node

/**
 * テストデータ作成スクリプト
 * 開発・テスト用のサンプルデータをDynamoDBに投入します
 */

const { DynamoDBClient, PutItemCommand, BatchWriteItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

// AWS設定
const client = new DynamoDBClient({
  region: 'ap-northeast-1',
  credentials: {
    // Amplify Sandboxを使用しているため、デフォルトの認証情報を使用
  }
});

// テーブル名（実際のAmplify環境に応じて調整）
const TABLE_PREFIX = 'amplify-cloudbestpracticeanalyzer-mfujiwara-sandbox-ee20d5a906';

const TABLES = {
  TENANT: `${TABLE_PREFIX}-Tenant-YZKQCQQ46RGJPFYXUQSKDWKJIQ`,
  PROJECT: `${TABLE_PREFIX}-Project-YZKQCQQ46RGJPFYXUQSKDWKJIQ`,
  ANALYSIS: `${TABLE_PREFIX}-Analysis-YZKQCQQ46RGJPFYXUQSKDWKJIQ`,
  FINDING: `${TABLE_PREFIX}-Finding-YZKQCQQ46RGJPFYXUQSKDWKJIQ`,
  USER: `${TABLE_PREFIX}-User-YZKQCQQ46RGJPFYXUQSKDWKJIQ`,
  FRAMEWORK: `${TABLE_PREFIX}-Framework-YZKQCQQ46RGJPFYXUQSKDWKJIQ`,
  FRAMEWORK_RULE: `${TABLE_PREFIX}-FrameworkRule-YZKQCQQ46RGJPFYXUQSKDWKJIQ`
};

// テストデータ定義
const TEST_DATA = {
  tenants: [
    {
      id: 'tenant-demo-001',
      name: 'デモテナント株式会社',
      status: 'ACTIVE',
      adminEmail: 'admin@demo-tenant.com',
      subscription: {
        tier: 'BASIC',
        startDate: '2024-01-01',
        maxProjects: 10,
        maxAnalyses: 100
      },
      settings: {
        timezone: 'Asia/Tokyo',
        language: 'ja',
        notifications: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'tenant-sample-002',
      name: 'サンプル企業',
      status: 'ACTIVE',
      adminEmail: 'admin@sample-corp.com',
      subscription: {
        tier: 'STANDARD',
        startDate: '2024-01-15',
        maxProjects: 25,
        maxAnalyses: 250
      },
      settings: {
        timezone: 'Asia/Tokyo',
        language: 'ja',
        notifications: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  projects: [
    {
      id: 'project-web-app-001',
      tenantId: 'tenant-demo-001',
      name: 'ECサイトシステム',
      description: 'オンラインショッピングサイトのAWSインフラストラクチャ',
      status: 'ACTIVE',
      memberIds: ['user-001', 'user-002'],
      settings: {
        frameworks: ['AWS_WELL_ARCHITECTED', 'SECURITY_HUB'],
        analysisFrequency: 'WEEKLY'
      },
      metrics: {
        totalAnalyses: 5,
        lastAnalysisScore: 78,
        averageScore: 82
      },
      createdBy: 'user-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'project-api-backend-002',
      tenantId: 'tenant-demo-001',
      name: 'マイクロサービスAPI',
      description: 'RESTful APIバックエンドシステム',
      status: 'ACTIVE',
      memberIds: ['user-001', 'user-003'],
      settings: {
        frameworks: ['AWS_WELL_ARCHITECTED', 'AWS_LENS'],
        analysisFrequency: 'MONTHLY'
      },
      metrics: {
        totalAnalyses: 3,
        lastAnalysisScore: 85,
        averageScore: 83
      },
      createdBy: 'user-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],

  analyses: [
    {
      id: 'analysis-001',
      tenantId: 'tenant-demo-001',
      projectId: 'project-web-app-001',
      name: 'ECサイト初回分析',
      type: 'CLOUDFORMATION',
      status: 'COMPLETED',
      inputFiles: {
        templateUrl: 's3://demo-bucket/ec-site-template.yaml',
        parametersFile: 's3://demo-bucket/parameters.json'
      },
      awsConfig: {
        region: 'ap-northeast-1',
        accountId: '123456789012'
      },
      resultSummary: {
        overallScore: 78,
        criticalFindings: 2,
        highFindings: 5,
        mediumFindings: 12,
        lowFindings: 8,
        pillarScores: {
          'OPERATIONAL_EXCELLENCE': 82,
          'SECURITY': 68,
          'RELIABILITY': 85,
          'PERFORMANCE_EFFICIENCY': 75,
          'COST_OPTIMIZATION': 72,
          'SUSTAINABILITY': 80
        }
      },
      executionId: 'exec-001',
      createdBy: 'user-001',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1日前
      updatedAt: new Date(Date.now() - 82800000).toISOString(), // 23時間前
      completedAt: new Date(Date.now() - 82800000).toISOString()
    }
  ],

  findings: [
    {
      id: 'finding-001',
      analysisId: 'analysis-001',
      tenantId: 'tenant-demo-001',
      title: 'RDSインスタンスの暗号化が無効',
      description: 'RDSインスタンスで保存時暗号化が有効になっていません。機密データが暗号化されずに保存される可能性があります。',
      severity: 'HIGH',
      pillar: 'SECURITY',
      resource: 'AWS::RDS::DBInstance',
      line: 45,
      recommendation: 'RDSインスタンスのStorageEncryptedプロパティをtrueに設定してください。また、KMSキーを指定してより強固な暗号化を実装することを推奨します。',
      category: 'データ保護',
      ruleId: 'SEC-RDS-001',
      createdAt: new Date().toISOString()
    },
    {
      id: 'finding-002',
      analysisId: 'analysis-001',
      tenantId: 'tenant-demo-001',
      title: 'S3バケットのパブリックアクセスブロック未設定',
      description: 'S3バケットでパブリックアクセスブロックが設定されていません。意図しない公開リスクがあります。',
      severity: 'CRITICAL',
      pillar: 'SECURITY',
      resource: 'AWS::S3::Bucket',
      line: 23,
      recommendation: 'S3バケットのPublicAccessBlockConfigurationを設定し、すべてのパブリックアクセスをブロックしてください。',
      category: 'アクセス制御',
      ruleId: 'SEC-S3-001',
      createdAt: new Date().toISOString()
    }
  ],

  users: [
    {
      id: 'user-001',
      tenantId: 'tenant-demo-001',
      cognitoId: 'demo-user-cognito-id-001',
      email: 'demo-admin@example.com',
      firstName: 'デモ',
      lastName: '管理者',
      role: 'CLIENT_ADMIN',
      status: 'ACTIVE',
      projectIds: ['project-web-app-001', 'project-api-backend-002'],
      preferences: {
        theme: 'light',
        language: 'ja',
        notifications: {
          email: true,
          analysis: true,
          reports: true
        }
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

// データ投入関数
async function putItem(tableName, item) {
  try {
    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshall(item, {
        removeUndefinedValues: true,
        convertEmptyValues: true
      })
    });
    
    await client.send(command);
    console.log(`✅ Created ${item.id || item.name} in ${tableName}`);
  } catch (error) {
    console.error(`❌ Error creating item in ${tableName}:`, error.message);
  }
}

// メイン実行関数
async function createTestData() {
  console.log('🚀 Starting test data creation...\n');

  try {
    // テナント作成
    console.log('📋 Creating tenants...');
    for (const tenant of TEST_DATA.tenants) {
      await putItem(TABLES.TENANT, tenant);
    }

    // ユーザー作成
    console.log('\n👥 Creating users...');
    for (const user of TEST_DATA.users) {
      await putItem(TABLES.USER, user);
    }

    // プロジェクト作成
    console.log('\n📁 Creating projects...');
    for (const project of TEST_DATA.projects) {
      await putItem(TABLES.PROJECT, project);
    }

    // 分析作成
    console.log('\n🔍 Creating analyses...');
    for (const analysis of TEST_DATA.analyses) {
      await putItem(TABLES.ANALYSIS, analysis);
    }

    // 検出結果作成
    console.log('\n🚨 Creating findings...');
    for (const finding of TEST_DATA.findings) {
      await putItem(TABLES.FINDING, finding);
    }

    console.log('\n🎉 Test data creation completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Tenants: ${TEST_DATA.tenants.length}`);
    console.log(`- Users: ${TEST_DATA.users.length}`);
    console.log(`- Projects: ${TEST_DATA.projects.length}`);
    console.log(`- Analyses: ${TEST_DATA.analyses.length}`);
    console.log(`- Findings: ${TEST_DATA.findings.length}`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  createTestData();
}

module.exports = { createTestData, TEST_DATA };