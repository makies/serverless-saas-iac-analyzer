# Amplify Gen 2 S3 アクセス権限トラブルシューティング

## 問題の概要

Amplify Gen 2環境でCognitoユーザーグループ（SystemAdmins等）に所属するユーザーがS3ストレージにファイルをアップロードしようとした際に、以下のエラーが発生する：

```
User: arn:aws:sts::ACCOUNT_ID:assumed-role/amplify-APP_NAME-amplifyAuthSystemAdminsGr-XXXXX/CognitoIdentityCredentials is not authorized to perform: s3:PutObject on resource: "arn:aws:s3:::BUCKET_NAME/public/FILENAME" because no identity-based policy allows the s3:PutObject action
```

## 根本原因

### 1. ロール分離の仕組み
Amplify Gen 2では、Cognitoユーザーグループごとに専用のIAMロールが自動作成される：
- 基本認証ユーザー: `amplify-APP_NAME-amplifyAuthauthenticatedU-XXXXX`
- SystemAdminsグループ: `amplify-APP_NAME-amplifyAuthSystemAdminsGr-XXXXX`
- その他各グループ: 同様の命名規則

### 2. ストレージアクセス権限の付与先
- `defineStorage()`で定義されたアクセス権限は、基本的な認証ユーザーロールにのみ適用される
- グループ専用ロールには自動的に継承されない

### 3. 問題の特定方法

#### 現在のユーザーが使用中のロールを確認
```bash
# ブラウザのデベロッパーツールでエラーメッセージからロール名を確認
# または以下のコマンドでCognito Identity Poolの設定を確認
aws cognito-identity get-identity-pool-roles --identity-pool-id POOL_ID
```

#### 各ロールのポリシーを確認
```bash
# 基本認証ユーザーロールのポリシー確認
aws iam list-role-policies --role-name amplify-APP_NAME-amplifyAuthauthenticatedU-XXXXX

# グループロールのポリシー確認
aws iam list-role-policies --role-name amplify-APP_NAME-amplifyAuthSystemAdminsGr-XXXXX
```

## 解決策

### 方法1: 手動でグループロールにS3アクセス権限を追加（推奨）

#### 1. S3アクセスポリシーの作成
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::BUCKET_NAME/uploads/*",
                "arn:aws:s3:::BUCKET_NAME/public/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::BUCKET_NAME",
            "Condition": {
                "StringLike": {
                    "s3:prefix": [
                        "uploads/*",
                        "uploads/",
                        "public/*",
                        "public/"
                    ]
                }
            }
        }
    ]
}
```

#### 2. ポリシーをグループロールに適用
```bash
# ファイルに保存
cat > /tmp/s3-access-policy.json << 'EOF'
{上記のJSONポリシー}
EOF

# 各グループロールに適用
aws iam put-role-policy \
  --role-name amplify-APP_NAME-amplifyAuthSystemAdminsGr-XXXXX \
  --policy-name S3StorageAccess \
  --policy-document file:///tmp/s3-access-policy.json

# 他のグループも同様に適用
aws iam put-role-policy \
  --role-name amplify-APP_NAME-amplifyAuthClientAdminsGr-XXXXX \
  --policy-name S3StorageAccess \
  --policy-document file:///tmp/s3-access-policy.json
```

### 方法2: バックエンドコードでの自動化（循環依存回避が必要）

現在のところ、`amplify/backend.ts`で直接グループロールにポリシーを追加すると循環依存エラーが発生するため、以下の手順が必要：

1. 基本的なバックエンドを先にデプロイ
2. 後から手動でポリシーを追加

将来的には以下のようなコードが動作する可能性：

```typescript
// amplify/backend.ts（現在は循環依存のため使用不可）
groupsWithStorageAccess.forEach(groupName => {
  const groupRole = backend.auth.resources.groups[groupName]?.role;
  if (groupRole) {
    const role = groupRole as Role;
    role.addToPolicy(new PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [
        `${backend.storage.resources.bucket.bucketArn}/uploads/*`,
        `${backend.storage.resources.bucket.bucketArn}/public/*`
      ]
    }));
  }
});
```

## 予防策

### 1. デプロイ後の権限確認スクリプト
```bash
#!/bin/bash
# scripts/check-s3-permissions.sh

GROUPS=("SystemAdmins" "ClientAdmins" "ProjectManagers" "Analysts")
BUCKET_NAME="amplify-cloudbestpractice-cloudbpastoragebucketa53-aygbtipxtqel"

for group in "${GROUPS[@]}"; do
  ROLE_NAME=$(aws iam list-roles --query "Roles[?contains(RoleName, '$group')].RoleName" --output text)
  if [ -n "$ROLE_NAME" ]; then
    echo "Checking $group role: $ROLE_NAME"
    aws iam list-role-policies --role-name "$ROLE_NAME"
  fi
done
```

### 2. 自動修復スクリプト
```bash
#!/bin/bash
# scripts/fix-s3-permissions.sh

GROUPS=("SystemAdmins" "ClientAdmins" "ProjectManagers" "Analysts")
BUCKET_NAME=$(cat amplify_outputs.json | jq -r '.storage.bucket_name')

for group in "${GROUPS[@]}"; do
  ROLE_NAME=$(aws iam list-roles --query "Roles[?contains(RoleName, '$group')].RoleName" --output text)
  if [ -n "$ROLE_NAME" ]; then
    echo "Adding S3 permissions to $group role: $ROLE_NAME"
    aws iam put-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-name S3StorageAccess \
      --policy-document file://s3-access-policy.json
  fi
done
```

## 注意事項

1. **手動設定の永続性**: 手動で追加したポリシーは、Amplifyの完全な再デプロイ時に削除される可能性がある
2. **セキュリティ**: 最小権限の原則に従い、必要最小限のS3アクセス権限のみを付与する
3. **テナント分離**: マルチテナントアプリケーションでは、パス制限を適切に設定する
4. **モニタリング**: CloudTrailでS3アクセスログを監視し、不正アクセスを検出する

## 関連リソース

- [Amplify Gen 2 Storage Documentation](https://docs.amplify.aws/react/build-a-backend/storage/)
- [Cognito Identity Pool Role Mapping](https://docs.aws.amazon.com/cognito/latest/developerguide/role-based-access-control.html)
- [AWS IAM Policy Reference](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies.html)