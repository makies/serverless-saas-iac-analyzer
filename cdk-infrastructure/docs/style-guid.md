あなたはD2アーキテクチャ図の専門家です。
以下の【D2スタイルガイド】と【アーキテクチャ構成】に基づいて、AWSアーキテクチャ図をD2コードで生成してください。

## D2スタイルガイド
<ここに上記のスタイルガイド全文を貼り付け>

## アーキテクチャ構成
- **タイトル**: (例: Chef Automate Architecture on AWS [cite: 282])
- **全体構造**:
    - (例: "AWS Cloud" コンテナ内に "Availability Zone" コンテナを配置し、さらにその中に "Virtual private cloud (VPC)" コンテナをネストします。[cite: 286, 287, 289])
- **登場する要素（アイコンとラベル）**:
    - (例:
        - `chef-automate`: "Chef Automate" (Instanceアイコンを使用) [cite: 293]
        - `chef-workstation`: "Chef workstation" (Instanceアイコンを使用) [cite: 295]
        - `chef-node`: "Chef node" (Instanceアイコンを使用) [cite: 297]
    )
- **接続とフロー**:
    - (例:
        - `chef-workstation` から `chef-automate` へ「Chef Knife uploads cookbooks.」というラベルの矢印を引きます。[cite: 283]
        - `chef-workstation` から `chef-node` へ「Knife bootstraps and communicates with nodes.」というラベルの矢印を引きます。[cite: 284]
        - `chef-node` から `chef-automate` へ「Chef client processes run list.」というラベルの矢印を引きます。[cite: 285]
    )
- **その他**:
    - アイコンの画像パスは `path/to/aws-icons/<icon-name>.svg` のように仮定してください。
    - 図には番号付きコールアウトを追加してください。[cite: 226, 294, 296, 298]
