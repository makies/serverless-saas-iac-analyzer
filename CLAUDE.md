あなたはAWSのServerless SaaSアプリケーション開発の専門家です。
以下の要件に基づいて、Serverless SaaS IaC Analyzerを開発してください。

## プロジェクト概要
- 既存のWell-Architected IaC Analyzerをマルチテナント対応のSaaSとして再構築
- AWS SaaS Builder Toolkit (Basic Tier) を使用
- コンサルティング案件ごとのデータ分離とアクセス制御を実現
- Minimum Startアプローチでコスト効率的な運用

## 技術スタック
- Frontend: React + AWS Amplify + Cloudscape Design System
- Backend: AWS Lambda (Node.js 22.x TypeScript) ← 最新ランタイム使用
- Infrastructure: AWS CDK (TypeScript) + eslint-cdk-plugin
- AI Engine: Amazon Bedrock (Claude 4 Sonnet)
- Multi-tenancy: AWS SaaS Builder Toolkit (Basic Tier、課金機能は使用しない)
- Database: DynamoDB (Pool Model)
- Storage: S3 (Tenant-based prefix)
- API: API Gateway (REST)

## 開発要件
- **Lambda Runtime**: Node.js 20.x（最新の安定版）
- **TypeScript**: 5.x系最新
- **CDK**: v2最新
- **Linting**: ESLint + eslint-cdk-plugin + Prettier
- **テスト**: Jest + AWS CDK Testing

## 重要な要件
1. **完全なテナント分離**: 他の顧客企業データへのアクセスは絶対に禁止
2. **プロジェクトベースアクセス制御**: 案件アサインメンバーのみアクセス可能
3. **顧客エンジニアアクセス**: 必要に応じて顧客側エンジニアも特定案件のみアクセス可能
4. **管理者機能**: 複数顧客企業の複数システム・複数AWSアカウント情報の横断集計表示

## ユーザーロール
- **SystemAdmin**: 全テナント管理権限、フレームワークマスター管理
- **FrameworkAdmin**: フレームワーク定義・ルール管理権限
- **ClientAdmin**: 自社テナント管理権限、フレームワーク設定
- **ProjectManager**: 担当案件の管理権限、分析フレームワーク選択
- **Analyst**: 担当案件の分析実行権限
- **Viewer**: 担当案件の閲覧のみ権限
- **ClientEngineer**: 顧客側エンジニア（特定案件のみ）

## 機能要件
1. IaC分析機能（CloudFormation, Terraform, CDK対応）
2. **マルチフレームワーク分析システム**
   - AWS Well-Architected Framework 6つの柱による分析
   - AWS Well-Architected Lenses（Serverless, SaaS, IoT, ML等）
   - AWS Service Delivery Service (SDP) ベストプラクティス
   - AWS Competency チェック項目
   - AWS Security Hub CSPM 適合状況分析
3. **中央マスター管理システム**
   - フレームワーク定義の中央管理
   - ルール定義とバージョン管理
   - テナント別フレームワーク設定
4. ライブAWSアカウントスキャン機能
5. レポート生成（PDF、Excel出力）
6. プロジェクト切り替え機能
7. **管理者向け横断分析機能**
   - テナント横断メトリクス分析
   - フレームワーク採用状況分析
   - 業界別・ティア別ベンチマーク
   - チャーンリスク予測
   - カスタムレポート生成

## 制約事項
- Basic Tier制約: 月100回分析、10MBファイル制限、90日保存
- 完全なテナント分離必須
- セキュリティ重視（MFA必須、暗号化、監査ログ）

CLAUDE.mdファイルに詳細要件が記載されているので、それを参照して段階的に開発を進めてください。
まずはプロジェクト構造の作成から始めて、CDKインフラストラクチャ、Lambda関数、React フロントエンドの順で開発を進めてください。

開発は以下の順序で進めてください：
1. プロジェクト構造とセットアップ（最新のNode.js 20.x対応）
2. CDK Infrastructure（SBT統合含む、eslint-cdk-plugin設定済み）
3. Lambda Functions（Node.js 20.x TypeScript、テナント分離ロジック含む）
4. React Frontend（Amplify統合）
5. テスト実装
6. デプロイメント設定

各段階で、セキュリティベストプラクティスとテナント分離を確実に実装してください。
また、最新のAWS SDKとベストプラクティスを使用してください。


## プラグイン機構詳細要件

### プラグイン実行セキュリティ
- サンドボックス環境での実行
- リソース使用量制限
- タイムアウト制御
- 悪意あるコード検出

### プラグイン品質管理
- プラグイン認証システム
- コード署名検証
- 自動脆弱性スキャン
- 品質評価システム

### パフォーマンス要件
- プラグイン並列実行: 最大5個同時
- プラグイン実行時間: 最大15分
- メモリ使用量: プラグインあたり最大1GB
- 結果統合処理: 30秒以内

### モニタリング要件
- プラグイン実行メトリクス
- エラー率追跡
- パフォーマンス監視
- 使用量統計
