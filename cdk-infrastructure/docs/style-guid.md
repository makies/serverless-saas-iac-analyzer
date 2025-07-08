# D2で実践するAWSアーキテクチャ図 詳細スタイルガイド

このガイドは、D2でAWSアーキテクチャ図を作成する際に陥りがちなスタイルの違いを意識し、AWS公式の視覚言語に準拠するための詳細なルールを定めます。

***

### 1. アイコン: 図の主役は「画像」である

D2で最も陥りやすい間違いは、`rectangle`や`database`といった組み込みの`shape`を使い、それっぽく見せることです。AWSのアーキテクチャ図では、**公式アイコンを画像として使用することが絶対的なルール**です。

* **正しい実践 (`shape: image`)**
    * すべてのAWSサービスとリソースは、`shape: image` を使用し、公式アイコンのSVGファイルへのパスを指定してください。

    ```d2
    # 良い例
    EC2: {
      shape: image
      icon: "path/to/icons/Amazon-EC2_Instance.svg"
      label: "Amazon EC2 Instance"
      # サイズを固定値で指定
      width: 40
      height: 40
    }

    # 悪い例 (D2のデフォルト図形を使ってしまう)
    EC2: {
      shape: rectangle
      label: "Amazon EC2 Instance"
    }
    ```

* **厳守すべきルール**
    * **固定サイズの指定**: アイコンのサイズは一貫性を保つため、`width`と`height`で固定値を指定します。AWSの標準的なアイコンサイズは32x32または40x40ピクセルに相当するため、D2でもそれに準じた値を設定します。(例: `width: 40; height: 40;`)
    * **変形の禁止**: アイコンの反転、回転、トリミングは禁止です。
    * **色の変更禁止**: アイコンの色は規定色から変更してはいけません。

***

### 2. グループ（コンテナ）: 境界線の「スタイル」を使い分ける

D2のコンテナはデフォルトで実線ですが、AWSでは複数のグループ、特に**アベイラビリティゾーンやAuto Scalingグループは破線で表現**します。この違いを意識することが、公式図に近づける鍵です。

* **正しい実践 (`style.stroke-dash`)**
    * `style.stroke-dash` プロパティを使用して、実線と破線を明確に使い分けてください。

    ```d2
    # 例: アベイラビリティゾーンの表現
    AvailabilityZone1: {
      label: "Availability Zone 1"
      style: {
        stroke-dash: 3 # 破線を指定
        stroke: "#00A1C9"
      }
    }
    ```

* **主要なグループコンテナのスタイル**
    * **AWS Cloud**: 外枠全体を囲むコンテナ。グレーの破線で表現します。
        * `style: { stroke: "#232F3E", stroke-dash: 3 }`
    * **Virtual private cloud (VPC)**: 紫色の実線で表現します。
        * `style: { stroke: "#7B20A3" }`
    * **Auto Scaling group**: オレンジ色の破線で表現します。
        * `style: { stroke: "#DD6B20", stroke-dash: 3 }`

***

### 3. 矢印（接続）: 「太さ」と「先端の形」を意識する

D2のデフォルトの矢印は細く、先端もシンプルな三角形です。AWSのガイドラインでは、より明確なスタイルが指定されています。

* **正しい実践 (`stroke-width`, `arrowhead`)**
    * すべての接続線は、太さを **2pt** に指定します。
    * 矢印の先端は、AWSが推奨する「Open Arrow」に最も近い形状を選択します。

    ```d2
    # 例: サービス間の接続
    S3 -> Lambda: {
      style: {
        stroke-width: 2
        # D2のarrowheadは完全なOpen Arrowをサポートしないが、
        # スタイルを合わせる意識が重要
        arrowhead: {
          shape: triangle
        }
      }
    }
    ```

***

### 4. ラベルとテキスト: 「フォントサイズ」と「改行」をコントロールする

D2の自動改行やデフォルトのフォントサイズは、AWSの厳密なガイドラインから逸脱する可能性があります。

* **正しい実践 (`style.font-size`, `\n`)**
    * **フォントとサイズ**: ラベルのフォントサイズは **12pt** が公式ガイドラインです。D2では `style.font-size: 12` を明示的に指定します。フォントは「Arial」が推奨されていますが、D2の制約上、デフォルトのサンセリフ体で代用します。
    * **手動改行**: サービス名が長くなる場合は、必ず `\n` を使用して手動で改行位置を制御してください。ラベルは最大2行までです。

    ```d2
    # 良い例
    longServiceName: {
      shape: image
      icon: "path/to/icon.svg"
      # "Amazon" と "Route" は同じ行に、2行に収める
      label: "Amazon Route 53\nResolver"
      style: {
        font-size: 12
      }
    }

    # 悪い例 (D2の自動改行やデフォルトサイズに任せてしまう)
    longServiceName: {
      shape: image
      icon: "path/to/icon.svg"
      label: "Amazon Route 53 Resolver" # 改行位置やサイズが不定
    }
    ```

***

### 5. 色彩: カテゴリごとの「公式カラーパレット」を守る

D2で色を指定しない、あるいは直感で色を選ぶと、図全体の一貫性が失われます。AWSでは、サービスカテゴリごとに色が厳密に定められています。

* **正しい実践 (HEXコードの指定)**
    * グループコンテナの枠線や、カスタムグループを作成する際は、必ず公式カラーパレットを使用してください。

* **主要カテゴリカラー**
    * **Analytics, Networking**: `#5A228B` (紫系)
    * **Application Integration, Management & Governance**: `#225A2A` (緑系)
    * **Artificial Intelligence, Compute, Containers**: `#D35400` (オレンジ系)
    * **Storage**: `#34495E` (濃い青緑系)
    * **Database, Developer Tools**: `#2C3E50` (濃い青系)
    * **Security, Identity & Compliance**: `#B91C1C` (赤系)
