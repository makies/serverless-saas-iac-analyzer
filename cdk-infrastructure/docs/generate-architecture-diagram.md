# システムアーキテクチャ図の生成手順

## D2を使用したアーキテクチャ図の生成

### 前提条件
D2をインストールしてください：
```bash
# macOS
brew install d2

# または直接ダウンロード
curl -fsSL https://d2lang.com/install.sh | sh -s --
```

### 図の生成方法

1. **基本的な図の生成**
```bash
# SVG形式で生成
d2 docs/system-architecture.d2 docs/system-architecture.svg

# PNG形式で生成
d2 docs/system-architecture.d2 docs/system-architecture.png

# PDF形式で生成  
d2 docs/system-architecture.d2 docs/system-architecture.pdf
```

2. **高解像度版の生成**
```bash
# 高解像度PNG（プレゼンテーション用）
d2 --scale=2 docs/system-architecture.d2 docs/system-architecture-hd.png

# 超高解像度PNG（印刷用）
d2 --scale=4 docs/system-architecture.d2 docs/system-architecture-print.png
```

3. **テーマを適用した生成**
```bash
# ダークテーマ
d2 --theme=200 docs/system-architecture.d2 docs/system-architecture-dark.svg

# AWSテーマ風
d2 --theme=102 docs/system-architecture.d2 docs/system-architecture-aws.svg

# プロフェッショナルテーマ
d2 --theme=301 docs/system-architecture.d2 docs/system-architecture-professional.svg
```

## アーキテクチャ図の特徴

### 🎨 視覚的な特徴
- **色分けされたレイヤー**: 各層が異なる色で識別しやすい
- **AWSサービスアイコン**: 公式アイコンを使用した視認性
- **接続線の意味**: 色と太さでデータフローを表現
- **レジェンド**: フローの種類を明確に説明

### 📊 含まれるコンポーネント

#### Frontend Layer (青系)
- React Frontend
- Cloudscape Design System
- AWS Amplify

#### API Gateway & Authentication (オレンジ系)
- AWS AppSync (GraphQL)
- Amazon Cognito
- AWS WAF

#### Compute Layer (紫系)
- AWS Lambda Functions
- Step Functions Workflows
- Framework Analysis Engine

#### Storage Layer (緑系)
- Amazon DynamoDB
- Amazon S3
- S3 Glacier (アーカイブ)

#### AI/ML Layer (ピンク系)
- Amazon Bedrock
- Claude 4 Sonnet

#### Monitoring & Security (黄系)
- CloudWatch Metrics & Logs
- AWS X-Ray Tracing
- CloudWatch RUM
- SNS Notifications

#### Multi-Tenant Management (緑系)
- SaaS Builder Toolkit
- AWS IAM
- AWS Organizations

#### External Systems (グレー系)
- GitHub Integration
- Terraform Support
- CloudFormation Support

#### Data Processing Pipeline (水色系)
- Data Ingestion
- Stream Processing
- Analytics Engine

### 🔄 データフローの表現

#### 線の色と意味
- **青**: ユーザーフロー（HTTPS通信）
- **緑**: データフロー（CRUD操作）
- **オレンジ**: モニタリングフロー（メトリクス・ログ）
- **茶**: セキュリティフロー（アクセス制御）
- **紫**: 内部処理フロー（ワークフロー）
- **赤**: AI分析フロー
- **点線**: 非同期・アーカイブ処理

#### 線の太さ
- **太線**: 主要データフロー
- **中線**: 二次的フロー
- **細線**: 補助的・監視フロー

## 使用場面

### 📋 ドキュメント用途
- 技術設計書への埋め込み
- アーキテクチャレビュー資料
- 新メンバーへのオンボーディング資料

### 🎯 プレゼンテーション用途
- ステークホルダー向け説明
- 技術アーキテクチャレビュー
- AWS Well-Architected Review

### 📊 運用用途
- システム監視ダッシュボード参考
- 障害対応時の影響範囲把握
- キャパシティプランニング

## カスタマイズ方法

### アイコンの変更
```d2
# カスタムアイコンの使用例
custom_service: Custom Service {
  icon: https://your-domain.com/custom-icon.svg
  style.fill: "#YOUR_COLOR"
}
```

### 新しいコンポーネントの追加
```d2
# 新レイヤーの追加例
new_layer: New Layer {
  style.fill: "#F0F0F0"
  style.stroke: "#333333"
  style.stroke-width: 2
  
  new_service: New Service {
    icon: https://icons.terrastruct.com/aws/path/to/icon.svg
    style.fill: "#FF9900"
  }
}

# 接続の追加
existing_service -> new_layer.new_service: New Connection {
  style.stroke: "#4CAF50"
  style.stroke-width: 2
}
```

### レイアウトの調整
```d2
# 位置の指定
component: Component {
  near: top-left    # top-left, top-center, top-right
                   # center-left, center, center-right
                   # bottom-left, bottom-center, bottom-right
}
```

## トラブルシューティング

### よくある問題と解決方法

1. **アイコンが表示されない**
   - インターネット接続を確認
   - アイコンURLが正しいかチェック
   - ローカルアイコンファイルの使用を検討

2. **レイアウトが崩れる**
   - `near`属性でレイアウトヒントを追加
   - コンポーネントのサイズを明示的に指定

3. **生成に時間がかかる**
   - `--timeout`オプションで時間を延長
   - 複雑すぎる図を分割することを検討

### パフォーマンス最適化
```bash
# 軽量版の生成（アイコンなし）
d2 --theme=0 docs/system-architecture.d2 docs/system-architecture-light.svg

# 段階的生成（大きな図の場合）
d2 --layout=elk docs/system-architecture.d2 docs/system-architecture-elk.svg
```

この図により、CloudBestPracticeAnalyzerの全体アーキテクチャを視覚的に理解し、各コンポーネント間の関係性を明確に把握できます。