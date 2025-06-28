# データストア設計

```typescript
// 現在の設計
interface CurrentDataStorage {
  primary_database: 'DynamoDB';
  model: 'Pool Model';
  isolation_strategy: 'tenant_id partition key';
  
  table_structure: {
    tenant_data_table: {
      partition_key: 'tenant_id';
      sort_key: 'item_id';
      purpose: '全テナントデータの統合管理';
    };
    
    files_metadata_table: {
      partition_key: 'tenant_id';
      sort_key: 'file_id';
      purpose: 'アップロードファイル情報';
    };
  };
  
  storage_complement: {
    s3_buckets: 'ファイル実体とレポート保存';
    bedrock: 'AI分析エンジン';
  };
}
```
