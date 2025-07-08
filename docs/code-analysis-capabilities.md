# コード分析機能 - 分析対象詳細仕様

## 概要

コード分析機能は、Infrastructure as Code（IaC）ファイルやアプリケーションコード、設定ファイルを包括的に分析し、AWS Well-Architected Framework および各種セキュリティ・コンプライアンス基準に基づいて改善提案を行う機能です。AI（Claude 4 Sonnet）を活用することで、ファイル形式に依存しない高精度な分析を実現し、混在する IaC ツール環境でも統合的な評価を提供します。

## 対応分析方式

### 1. ファイルアップロード分析
- **対象**: 個別ファイル または ZIPアーカイブ
- **制限**: 10MB/ファイル、100ファイル/アーカイブ
- **用途**: 一時的な分析、テスト環境の検証

### 2. Git Repository連携分析
- **対象**: GitHub/GitLab/Bitbucket リポジトリ
- **方式**: OAuth認証によるセキュアアクセス
- **用途**: 継続的インテグレーション、開発プロセス統合

### 3. 継続的監視分析
- **対象**: Repository連携による定期スキャン
- **頻度**: Push時、Daily、Weekly、Monthly
- **用途**: DevSecOps、継続的コンプライアンス

## 対応 Infrastructure as Code (IaC) ツール

### 1. AWS CloudFormation

#### 対応ファイル形式
- **YAML形式**: `*.yaml`, `*.yml`
- **JSON形式**: `*.json`
- **テンプレート**: `template.yaml`, `template.json`

#### 分析対象
- **Resources**: 全AWSリソース定義
- **Parameters**: パラメータ設計・デフォルト値
- **Mappings**: リージョン・環境マッピング
- **Conditions**: 条件分岐ロジック
- **Outputs**: 出力値設計
- **Transform**: SAM、Macroの使用状況
- **Metadata**: メタデータ活用

#### チェック項目

##### セキュリティ
- **暗号化設定**
  - S3バケット暗号化（KMS/AES-256）
  - EBS・RDSストレージ暗号化
  - Lambda環境変数暗号化
  - 転送時暗号化（SSL/TLS）

- **アクセス制御**
  - IAMロール・ポリシー設計
  - リソースベースポリシー
  - セキュリティグループ設定
  - S3バケットポリシー・ACL

- **ネットワークセキュリティ**
  - VPC設計・分離
  - パブリック/プライベートサブネット分離
  - セキュリティグループの最小権限
  - NACLによる多層防御

##### 可用性・信頼性
- **冗長性設計**
  - マルチAZ配置
  - 自動スケーリング設定
  - ロードバランサー設定
  - 複数リージョン対応

- **バックアップ・復旧**
  - 自動バックアップ設定
  - Point-in-Time Recovery
  - スナップショット設定
  - 復旧手順の自動化

- **監視・アラート**
  - CloudWatch監視設定
  - カスタムメトリクス
  - アラーム設定
  - ログ収集設定

##### パフォーマンス
- **リソース最適化**
  - インスタンスタイプ選択
  - ストレージタイプ選択
  - 自動スケーリング設定
  - キャッシュ戦略

- **ネットワーク最適化**
  - CDN活用
  - VPCエンドポイント使用
  - 配置グループ設定
  - 帯域幅最適化

##### コスト最適化
- **リソース効率化**
  - 適切なインスタンスサイズ
  - 予約インスタンス活用提案
  - スケジューリング最適化
  - 未使用リソース検出

- **ストレージ最適化**
  - S3ストレージクラス選択
  - ライフサイクル管理
  - EBSボリューム最適化
  - データアーカイブ戦略

### 2. HashiCorp Terraform

#### 対応ファイル形式
- **設定ファイル**: `*.tf`
- **変数ファイル**: `*.tfvars`
- **モジュール**: `module/*/` ディレクトリ構造
- **状態ファイル**: `terraform.tfstate` (分析のみ)

#### 分析対象
- **Provider設定**: AWS Provider設定・バージョン
- **Resource定義**: 全AWSリソース設定
- **Data Sources**: 外部データ参照
- **Variables**: 変数設計・型定義
- **Outputs**: 出力値設計
- **Modules**: モジュール活用・設計
- **Locals**: ローカル値定義
- **Backend設定**: リモートステート管理

#### チェック項目

##### Terraformベストプラクティス
- **コード品質**
  - HCL構文の適切性
  - 命名規則の一貫性
  - コメント・ドキュメンテーション
  - ファイル構成の最適化

- **状態管理**
  - リモートバックエンド使用
  - 状態ファイルの暗号化
  - ロック機能の活用
  - バージョニング戦略

- **モジュール設計**
  - 再利用可能な設計
  - 適切な抽象化
  - 入出力インターフェース
  - バージョン管理

##### セキュリティ
- **機密情報管理**
  - ハードコードされた認証情報検出
  - 変数での機密情報取り扱い
  - Terraform Cloud/Vault連携
  - 環境変数活用

- **プロバイダーセキュリティ**
  - AWS Provider設定
  - AssumeRole設定
  - MFA要求設定
  - 権限の最小化

##### 運用性
- **デプロイメント**
  - 段階的デプロイ戦略
  - 変更計画の確認
  - ロールバック戦略
  - CI/CD統合

- **監視・ログ**
  - Terraform実行ログ
  - 変更追跡
  - ドリフト検出
  - コンプライアンス監視

### 3. AWS CDK (Cloud Development Kit)

#### 対応言語・ファイル形式
- **TypeScript**: `*.ts`, `package.json`, `tsconfig.json`
- **JavaScript**: `*.js`, `package.json`
- **Python**: `*.py`, `requirements.txt`, `setup.py`
- **Java**: `*.java`, `pom.xml`, `build.gradle`
- **C#**: `*.cs`, `*.csproj`
- **Go**: `*.go`, `go.mod`, `go.sum`

#### 分析対象
- **App設定**: CDKアプリケーション構成
- **Stack設計**: スタック分割戦略
- **Construct使用**: L1/L2/L3コンストラクト活用
- **Dependencies**: 依存関係管理
- **Synthesis**: 合成されるCloudFormation品質
- **Assets**: アセット管理・配布
- **Context**: コンテキスト値管理

#### チェック項目

##### CDKベストプラクティス
- **アーキテクチャ設計**
  - 適切なスタック分割
  - 環境間の設定管理
  - コンストラクトの再利用
  - 依存関係の最小化

- **コード品質**
  - 型安全性の活用
  - 設定の外部化
  - テストの実装
  - ドキュメンテーション

- **セキュリティ**
  - IAMロール・ポリシー設計
  - シークレット管理
  - VPC・ネットワーク設計
  - 暗号化設定

##### パフォーマンス
- **合成最適化**
  - バンドルサイズ最適化
  - 合成時間短縮
  - 並列処理活用
  - キャッシュ戦略

- **デプロイメント**
  - 段階的デプロイ
  - ホットスワップ活用
  - ブルーグリーンデプロイ
  - ロールバック戦略

### 4. AWS SAM (Serverless Application Model)

#### 対応ファイル形式
- **テンプレート**: `template.yaml`, `template.yml`
- **設定ファイル**: `samconfig.toml`
- **アプリケーション**: `src/`, `functions/` ディレクトリ

#### 分析対象
- **Globals設定**: グローバル設定
- **Functions**: Lambda関数定義
- **APIs**: API Gateway設定
- **Tables**: DynamoDB設定
- **Events**: イベントソース設定
- **Layers**: Lambda レイヤー設定
- **Applications**: ネストされたアプリケーション

#### チェック項目

##### Serverlessベストプラクティス
- **Lambda設計**
  - 関数サイズ最適化
  - メモリ・タイムアウト設定
  - 環境変数管理
  - レイヤー活用

- **API設計**
  - RESTful API設計
  - 認証・認可設定
  - スロットリング設定
  - CORS設定

- **イベント処理**
  - 非同期処理設計
  - エラーハンドリング
  - デッドレターキュー
  - バッチ処理最適化

### 5. Pulumi

#### 対応言語
- **TypeScript/JavaScript**: `*.ts`, `*.js`
- **Python**: `*.py`
- **Go**: `*.go`
- **C#**: `*.cs`

#### 分析対象
- **プログラム構造**: リソース定義方法
- **設定管理**: 構成値・シークレット管理
- **スタック設計**: 環境分離戦略
- **コンポーネント**: 再利用可能コンポーネント

## 混在 IaC 環境の分析

### 1. 統合分析アプローチ
- **AI活用**: ファイル拡張子に依存しない分析
- **コンテキスト理解**: プロジェクト全体のアーキテクチャ把握
- **関連性分析**: 異なるIaCツール間の依存関係検出
- **一貫性チェック**: 設定値・命名規則の統一性確認

### 2. 典型的な混在パターン

#### パターン1: 基盤とアプリケーション分離
```
├── infrastructure/
│   ├── terraform/          # VPC, IAM等の基盤
│   │   ├── main.tf
│   │   └── variables.tf
│   └── cloudformation/     # 共有リソース
│       └── shared-resources.yaml
└── applications/
    ├── api/
    │   └── template.yaml   # SAM Lambda API
    └── frontend/
        └── cdk/           # CDK CloudFront/S3
            └── app.ts
```

#### パターン2: マイクロサービス混在
```
├── services/
│   ├── user-service/
│   │   └── serverless.yml    # Serverless Framework
│   ├── payment-service/
│   │   └── template.yaml     # SAM
│   └── notification-service/
│       └── pulumi/          # Pulumi
│           └── index.ts
└── shared/
    └── terraform/           # 共有インフラ
        ├── vpc.tf
        └── rds.tf
```

### 3. 混在環境固有のチェック項目

#### 一貫性分析
- **命名規則**: リソース名・タグの一貫性
- **設定値**: 環境変数・パラメータの整合性
- **セキュリティ設定**: IAMロール・ポリシーの重複・競合
- **ネットワーク設計**: VPC・サブネット設計の整合性

#### 依存関係分析
- **リソース参照**: 異なるツール間の依存関係
- **デプロイ順序**: 適切なデプロイメント順序
- **影響範囲**: 変更時の影響範囲分析
- **ロールバック戦略**: 混在環境でのロールバック考慮

#### 運用複雑性
- **ツール標準化**: 使用ツールの合理化提案
- **学習コスト**: チーム習熟度の考慮
- **保守性**: 長期保守の観点
- **移行戦略**: 段階的統一化プラン

## アプリケーションコード分析

### 1. サーバーレス関数コード

#### Lambda Function（Python）
```python
# 分析対象の例
import json
import boto3
import os
from typing import Dict, Any

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    # セキュリティチェック対象
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(os.environ['TABLE_NAME'])
    
    # エラーハンドリングチェック
    try:
        response = table.get_item(Key={'id': event['id']})
        return {
            'statusCode': 200,
            'body': json.dumps(response.get('Item', {}))
        }
    except Exception as e:
        # ログ出力チェック
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
```

##### チェック項目
- **セキュリティ**
  - 環境変数での機密情報管理
  - IAM権限の最小化
  - 入力値検証・サニタイズ
  - ログでの機密情報漏洩防止

- **パフォーマンス**
  - 接続プールの活用
  - 初期化処理の最適化
  - メモリ使用量最適化
  - タイムアウト設定

- **エラーハンドリング**
  - 適切な例外処理
  - リトライ機構
  - デッドレターキュー活用
  - 構造化ログ出力

#### Lambda Function（Node.js）
```javascript
// 分析対象の例
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const { id } = JSON.parse(event.body);
    
    // 入力値検証
    if (!id || typeof id !== 'string') {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid ID' })
        };
    }
    
    try {
        const result = await dynamodb.get({
            TableName: process.env.TABLE_NAME,
            Key: { id }
        }).promise();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(result.Item || {})
        };
    } catch (error) {
        console.error('DynamoDB Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
```

##### チェック項目
- **セキュリティ**
  - CORS設定の適切性
  - XSS防止策
  - SQLインジェクション対策
  - 認証・認可実装

- **パフォーマンス**
  - 非同期処理の適切な実装
  - 接続再利用
  - バンドルサイズ最適化
  - コールドスタート対策

### 2. コンテナアプリケーション

#### Dockerfile
```dockerfile
# 分析対象の例
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

# セキュリティチェック対象
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# ポート設定チェック
EXPOSE 3000

# 実行ユーザーチェック
USER nextjs

CMD ["npm", "start"]
```

##### チェック項目
- **セキュリティ**
  - 最小権限実行ユーザー
  - 最新ベースイメージ使用
  - 不要なパッケージ除去
  - シークレット情報の適切な管理

- **パフォーマンス**
  - マルチステージビルド活用
  - レイヤーキャッシュ最適化
  - イメージサイズ最小化
  - 依存関係最適化

#### Kubernetes Manifests
```yaml
# 分析対象の例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          readOnlyRootFilesystem: true
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

##### チェック項目
- **セキュリティ**
  - Pod Security Standards準拠
  - 最小権限実行
  - ネットワークポリシー設定
  - シークレット管理

- **可用性**
  - 適切なレプリカ数
  - リソース制限設定
  - ヘルスチェック設定
  - アフィニティ・反アフィニティ

## 設定ファイル分析

### 1. CI/CD パイプライン設定

#### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    # セキュリティチェック対象
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        aws-region: us-east-1
        
    # セキュリティスキャン
    - name: Run security scan
      run: |
        npm audit
        docker run --rm -v "$PWD:/tmp" returntocorp/semgrep --config=auto /tmp
        
    - name: Deploy with CDK
      run: |
        npm ci
        npm run build
        npx cdk deploy --require-approval never
```

##### チェック項目
- **セキュリティ**
  - OIDC認証の使用
  - シークレット管理
  - セキュリティスキャン統合
  - 最小権限設定

- **品質保証**
  - 自動テスト実行
  - 静的解析実行
  - デプロイ前検証
  - ロールバック機能

#### AWS CodePipeline（CloudFormation）
```yaml
# codepipeline.yaml
Resources:
  Pipeline:
    Type: AWS::CodePipeline::Pipeline
    Properties:
      Stages:
      - Name: Source
        Actions:
        - Name: SourceAction
          ActionTypeId:
            Category: Source
            Owner: ThirdParty
            Provider: GitHub
            Version: '1'
          Configuration:
            Owner: !Ref GitHubOwner
            Repo: !Ref GitHubRepo
            Branch: !Ref GitHubBranch
            OAuthToken: !Ref GitHubToken
            
      - Name: Build
        Actions:
        - Name: BuildAction
          ActionTypeId:
            Category: Build
            Owner: AWS
            Provider: CodeBuild
            Version: '1'
          Configuration:
            ProjectName: !Ref BuildProject
            
      - Name: Deploy
        Actions:
        - Name: DeployAction
          ActionTypeId:
            Category: Deploy
            Owner: AWS
            Provider: CloudFormation
            Version: '1'
          Configuration:
            ActionMode: CREATE_UPDATE
            StackName: !Ref StackName
            TemplatePath: BuildArtifact::template.yaml
            Capabilities: CAPABILITY_IAM
            RoleArn: !GetAtt CloudFormationRole.Arn
```

##### チェック項目
- **セキュリティ**
  - IAMロール分離
  - アーティファクト暗号化
  - VPC内実行
  - 承認ゲート設定

- **運用性**
  - 段階的デプロイ
  - 自動ロールバック
  - 並列実行設定
  - 通知設定

### 2. 環境設定ファイル

#### package.json（Node.js）
```json
{
  "name": "serverless-api",
  "version": "1.0.0",
  "scripts": {
    "test": "jest",
    "build": "tsc",
    "deploy": "serverless deploy",
    "security:check": "npm audit && snyk test"
  },
  "dependencies": {
    "aws-sdk": "^2.1000.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "jest": "^28.0.0",
    "typescript": "^4.8.0"
  }
}
```

##### チェック項目
- **セキュリティ**
  - 脆弱性のある依存関係
  - 最新バージョン使用
  - セキュリティスキャン統合
  - ライセンス確認

- **品質**
  - テストフレームワーク設定
  - リンター設定
  - ビルドプロセス
  - 型定義活用

#### requirements.txt（Python）
```txt
# AWS SDK
boto3==1.26.0
botocore==1.29.0

# Web Framework
fastapi==0.95.0
uvicorn==0.21.0

# Security
cryptography==40.0.0
pyjwt==2.6.0

# Development
pytest==7.2.0
black==23.1.0
flake8==6.0.0
mypy==1.1.0
```

##### チェック項目
- **セキュリティ**
  - バージョン固定
  - 既知の脆弱性
  - 暗号化ライブラリ
  - 認証ライブラリ

## 分析フレームワーク適用

### 1. AWS Well-Architected Framework

#### Operational Excellence（運用上の優秀性）
- **自動化**: CI/CDパイプライン、IaC使用状況
- **監視**: ログ設定、メトリクス収集、アラート設定
- **継続改善**: バージョン管理、テスト自動化、レビュープロセス

#### Security（セキュリティ）
- **Identity & Access**: IAM設計、最小権限原則
- **検知**: ログ監視、セキュリティスキャン統合
- **保護**: 暗号化、ネットワーク分離、WAF設定
- **データ保護**: 機密情報管理、バックアップ暗号化

#### Reliability（信頼性）
- **基盤**: 冗長性設計、自動回復機能
- **変更管理**: 段階的デプロイ、カナリアリリース
- **障害管理**: エラーハンドリング、回復手順自動化

#### Performance Efficiency（パフォーマンス効率）
- **選択**: 適切なリソースタイプ選択
- **監視**: パフォーマンス計測、最適化指標
- **進化**: 新技術採用、継続的最適化

#### Cost Optimization（コスト最適化）
- **認識**: コスト可視化、タグ戦略
- **効率**: 適正サイジング、予約インスタンス活用
- **最適化**: 使用量監視、自動スケーリング

#### Sustainability（持続可能性）
- **地域選択**: 効率的なリージョン選択
- **需要調整**: オンデマンドスケーリング
- **効率**: 最適なインスタンスタイプ選択

### 2. セキュリティフレームワーク

#### CIS Benchmarks
- **IAM設定**: パスワードポリシー、MFA設定
- **ログ設定**: CloudTrail、VPCフローログ
- **監視**: 異常検知、アラート設定
- **ネットワーク**: セキュリティグループ、NACL設定

#### NIST Cybersecurity Framework
- **識別**: 資産管理、リスク評価
- **保護**: アクセス制御、データ保護
- **検知**: 監視、異常検知
- **対応**: インシデント対応計画
- **回復**: 復旧手順、事業継続計画

#### SOC 2 Type II
- **セキュリティ**: 論理的・物理的アクセス制御
- **可用性**: システム運用、監視
- **処理の整合性**: データ処理品質
- **機密性**: データ分類、保護

### 3. コンプライアンス要件

#### GDPR（General Data Protection Regulation）
- **データ最小化**: 必要最小限のデータ収集
- **目的制限**: 明確な利用目的
- **保存期間制限**: データ保持ポリシー
- **技術的安全措置**: 暗号化、アクセス制御

#### HIPAA（Health Insurance Portability and Accountability Act）
- **管理面**: ポリシー・手順文書化
- **物理面**: データセンターセキュリティ
- **技術面**: 暗号化、アクセス制御、監査ログ

#### PCI DSS（Payment Card Industry Data Security Standard）
- **ネットワーク保護**: ファイアウォール、NAT設定
- **データ保護**: 暗号化、マスキング
- **アクセス制御**: 最小権限、多要素認証
- **監視**: ログ監視、脆弱性スキャン

## レポート出力

### 1. 分析結果サマリー
- **総合スコア**: 100点満点でのスコア
- **フレームワーク別評価**: 各柱・原則毎の詳細スコア
- **重要度別課題数**: Critical/High/Medium/Low/Info
- **改善優先度**: ビジネス影響・実装難易度マトリクス

### 2. 詳細レポート
- **課題詳細**: 具体的な問題点・影響範囲
- **改善提案**: 実装手順・ベストプラクティス
- **コード例**: 修正前後のコード比較
- **参考資料**: AWS公式ドキュメント、ベストプラクティス

### 3. 実行計画
- **即座対応**: セキュリティ重大問題
- **短期計画**: 3ヶ月以内の改善項目
- **長期計画**: 6ヶ月以上の戦略的改善
- **投資対効果**: コスト・工数・効果の分析

### 4. 継続監視レコメンデーション
- **定期スキャン**: 推奨実行頻度
- **監視項目**: 継続監視すべき指標
- **アラート設定**: 閾値・通知設定提案
- **改善計画**: 段階的改善ロードマップ