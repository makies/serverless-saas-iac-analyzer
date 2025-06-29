# DuckDB-Wasm + OPFS ハイブリッドダッシュボード設計書

## 1. システム概要

### 1.1 ハイブリッドアーキテクチャ概要
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│            Data Access Orchestrator                         │
├─────────────────┬───────────────────────────────────────────┤
│   Central DB    │           DuckDB-Wasm Engine             │
│   (REST API)    │          + OPFS Storage                   │
│                 │                                           │
│ • Tenants       │ • Analysis Results                        │
│ • Users         │ • Analysis Findings                       │
│ • Projects      │ • Analysis Scores                         │
│ • Assignments   │ • Reports (Cached)                        │
│ • Permissions   │ • Metrics/Analytics                       │
└─────────────────┴───────────────────────────────────────────┘
```

### 1.2 技術スタック
- **フロントエンド**: React + TypeScript + Cloudscape Design
- **データベース**: DuckDB-Wasm
- **ストレージ**: OPFS (Origin Private File System)
- **データ同期**: Background Sync API + Service Worker
- **状態管理**: Zustand or Redux Toolkit

### 1.3 ハイブリッドアプローチのメリット
- **セキュリティ**: 権限管理は中央DBで厳密に制御
- **データ整合性**: マスターデータは一元管理
- **高速分析**: 分析結果データはローカルで高速クエリ
- **オフライン閲覧**: 過去の分析結果はオフラインで確認可能
- **スケーラビリティ**: 分析処理の負荷をクライアントサイドに分散

### 1.4 データ配置戦略
```
Central DB (PostgreSQL)        Local DB (DuckDB-Wasm + OPFS)
├── tenants                   ├── analyses_cache
├── users                     ├── analysis_scores
├── projects                  ├── analysis_findings
├── project_assignments       ├── analysis_metrics
└── analysis_metadata         └── reports_cache
```

## 2. データベース設計

### 2.1 中央DB (PostgreSQL) - マスターデータ管理

```sql
-- テナント管理 (中央DB)
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    domain VARCHAR NOT NULL,
    status VARCHAR CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ユーザー管理 (中央DB)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    email VARCHAR NOT NULL,
    username VARCHAR NOT NULL,
    role VARCHAR CHECK (role IN ('SystemAdmin', 'ClientAdmin', 'ProjectManager', 'Analyst', 'Viewer', 'ClientEngineer')),
    first_name VARCHAR,
    last_name VARCHAR,
    status VARCHAR CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- プロジェクト管理 (中央DB)
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR CHECK (status IN ('ACTIVE', 'ARCHIVED', 'SUSPENDED')),
    aws_account_id VARCHAR,
    region VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- プロジェクト割り当て (中央DB)
CREATE TABLE project_assignments (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    user_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    role VARCHAR CHECK (role IN ('MANAGER', 'ANALYST', 'VIEWER')),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id)
);

-- 分析メタデータ (中央DB - 軽量データのみ)
CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR NOT NULL,
    type VARCHAR CHECK (type IN ('CloudFormation', 'Terraform', 'CDK', 'LiveScan')),
    status VARCHAR CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    source_type VARCHAR CHECK (source_type IN ('FILE_UPLOAD', 'LIVE_SCAN')),
    source_location VARCHAR,
    file_size BIGINT,
    executed_by UUID REFERENCES users(id),
    executed_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 ローカルDB (DuckDB-Wasm) - 分析結果データ

```sql
-- 分析結果キャッシュ (ローカルDB)
CREATE TABLE analyses_cache (
    id VARCHAR PRIMARY KEY,        -- UUIDをVARCHARで格納
    project_id VARCHAR NOT NULL,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    executed_by VARCHAR,
    executed_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    -- ローカル管理用
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分析結果スコア (ローカルDB)
CREATE TABLE analysis_scores (
    id VARCHAR PRIMARY KEY,
    analysis_id VARCHAR NOT NULL,
    overall_score INTEGER,
    operational_excellence_score INTEGER,
    security_score INTEGER,
    reliability_score INTEGER,
    performance_efficiency_score INTEGER,
    cost_optimization_score INTEGER,
    sustainability_score INTEGER,
    total_findings INTEGER,
    critical_findings INTEGER,
    high_findings INTEGER,
    medium_findings INTEGER,
    low_findings INTEGER,
    created_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 検出事項詳細 (ローカルDB)
CREATE TABLE analysis_findings (
    id VARCHAR PRIMARY KEY,
    analysis_id VARCHAR NOT NULL,
    pillar VARCHAR NOT NULL,
    severity VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    recommendation TEXT,
    resource_type VARCHAR,
    resource_name VARCHAR,
    line_number INTEGER,
    rule_id VARCHAR,
    created_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分析メトリクス (ローカルDB - 集計用)
CREATE TABLE analysis_metrics (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    project_id VARCHAR,
    metric_type VARCHAR NOT NULL, -- 'daily_score', 'pillar_trend', 'finding_count'
    metric_date DATE NOT NULL,
    metric_value DECIMAL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- レポートキャッシュ (ローカルDB)
CREATE TABLE reports_cache (
    id VARCHAR PRIMARY KEY,
    analysis_id VARCHAR NOT NULL,
    tenant_id VARCHAR NOT NULL,
    project_id VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    format VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    file_name VARCHAR,
    file_size BIGINT,
    file_data BLOB,  -- 小さなレポートはBLOBで保存
    generated_at TIMESTAMP,
    expires_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 インデックス設計

```sql
-- パフォーマンス最適化用インデックス
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_analyses_project_id ON analyses(project_id);
CREATE INDEX idx_analyses_tenant_id ON analyses(tenant_id);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_analyses_created_at ON analyses(created_at);
CREATE INDEX idx_analysis_findings_analysis_id ON analysis_findings(analysis_id);
CREATE INDEX idx_analysis_findings_pillar ON analysis_findings(pillar);
CREATE INDEX idx_analysis_findings_severity ON analysis_findings(severity);
CREATE INDEX idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_project_id ON project_assignments(project_id);
```

## 3. サービス層設計

### 3.1 Data Access Orchestrator - ハイブリッドデータアクセス

```typescript
class DataAccessOrchestrator {
  constructor(
    private centralAPI: CentralAPIService,
    private localDB: DuckDBService,
    private syncService: SyncService
  ) {}

  // マスターデータ (常に中央DBから)
  async getTenants(): Promise<Tenant[]> {
    return await this.centralAPI.get('/tenants');
  }

  async getProjects(tenantId: string): Promise<Project[]> {
    return await this.centralAPI.get(`/tenants/${tenantId}/projects`);
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return await this.centralAPI.get(`/users/${userId}/projects`);
  }

  // 分析データ (ローカルDB優先 + フォールバック)
  async getAnalyses(projectId: string): Promise<Analysis[]> {
    try {
      // 1. ローカルDBから取得を試行
      const localData = await this.localDB.execute(`
        SELECT * FROM analyses_cache 
        WHERE project_id = ? 
        ORDER BY created_at DESC
      `, [projectId]);

      // 2. データが古い場合は同期
      const needsSync = await this.shouldSync('analyses', projectId);
      if (needsSync) {
        await this.syncService.syncAnalysisData(projectId);
        return await this.localDB.execute(`
          SELECT * FROM analyses_cache 
          WHERE project_id = ? 
          ORDER BY created_at DESC
        `, [projectId]);
      }

      return localData;
    } catch (error) {
      // 3. フォールバック: 中央DBから取得
      console.warn('Local DB failed, falling back to central DB', error);
      return await this.centralAPI.get(`/projects/${projectId}/analyses`);
    }
  }

  // リアルタイム分析クエリ (ローカルDBのみ)
  async executeAnalyticsQuery(query: string, params: any[]): Promise<any[]> {
    return await this.localDB.execute(query, params);
  }

  private async shouldSync(table: string, entityId: string): Promise<boolean> {
    const lastSync = await this.syncService.getLastSyncTime(table, entityId);
    const now = new Date();
    const syncInterval = 5 * 60 * 1000; // 5分
    
    return !lastSync || (now.getTime() - lastSync.getTime()) > syncInterval;
  }
}
```

### 3.2 Central API Service - マスターデータ管理

```typescript
interface CentralAPIService {
  // 認証・認可
  authenticate(credentials: LoginCredentials): Promise<AuthResult>;
  refreshToken(): Promise<string>;
  
  // テナント・ユーザー管理
  getTenants(): Promise<Tenant[]>;
  getUsers(tenantId: string): Promise<User[]>;
  getCurrentUser(): Promise<User>;
  
  // プロジェクト管理
  getProjects(tenantId: string): Promise<Project[]>;
  createProject(project: CreateProjectRequest): Promise<Project>;
  updateProject(id: string, updates: UpdateProjectRequest): Promise<Project>;
  
  // プロジェクト割り当て
  getProjectAssignments(projectId: string): Promise<ProjectAssignment[]>;
  assignUserToProject(assignment: CreateAssignmentRequest): Promise<ProjectAssignment>;
  
  // 分析メタデータ
  getAnalysisMetadata(projectId: string): Promise<AnalysisMetadata[]>;
  createAnalysis(request: CreateAnalysisRequest): Promise<Analysis>;
  updateAnalysisStatus(id: string, status: AnalysisStatus): Promise<void>;
}
```

### 3.3 DuckDB Service - 分析データ処理

```typescript
interface DuckDBService {
  // データベース管理
  initialize(): Promise<void>;
  getConnection(): Promise<DuckDBConnection>;
  close(): Promise<void>;
  
  // 分析データ操作
  execute(query: string, params?: any[]): Promise<any[]>;
  executeTransaction(queries: string[]): Promise<void>;
  
  // 高速分析クエリ
  getAnalysisTrends(projectId: string, period: string): Promise<TrendData[]>;
  getFindingsByPillar(analysisId: string): Promise<PillarFindings[]>;
  getScoreComparison(projectIds: string[]): Promise<ScoreComparison[]>;
  
  // データ同期
  syncAnalysisData(data: AnalysisData[]): Promise<void>;
  syncFindings(findings: Finding[]): Promise<void>;
  syncScores(scores: AnalysisScore[]): Promise<void>;
  
  // スキーマ管理
  createTables(): Promise<void>;
  migrateSchema(version: number): Promise<void>;
  
  // キャッシュ管理
  clearOldCache(olderThanDays: number): Promise<void>;
  getStorageUsage(): Promise<StorageInfo>;
}
```

### 3.2 OPFS Storage Service

```typescript
interface OPFSStorageService {
  // ファイル操作
  writeFile(path: string, data: ArrayBuffer): Promise<void>;
  readFile(path: string): Promise<ArrayBuffer>;
  deleteFile(path: string): Promise<void>;
  listFiles(directory: string): Promise<string[]>;
  
  // データベースファイル管理
  saveDatabaseFile(): Promise<void>;
  loadDatabaseFile(): Promise<ArrayBuffer | null>;
  
  // 一時ファイル管理
  createTempFile(data: ArrayBuffer): Promise<string>;
  cleanupTempFiles(): Promise<void>;
}
```

### 3.3 同期サービス

```typescript
interface SyncService {
  // データ同期
  syncToServer(): Promise<void>;
  syncFromServer(): Promise<void>;
  getLastSyncTime(): Promise<Date | null>;
  
  // 競合解決
  resolveConflicts(conflicts: ConflictItem[]): Promise<void>;
  
  // オフライン管理
  queueOfflineChanges(changes: OfflineChange[]): Promise<void>;
  applyOfflineChanges(): Promise<void>;
}
```

## 4. ハイブリッドデータ同期戦略

### 4.1 同期パターン - 分離された同期戦略

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Browser   │    │   Server    │    │  Database   │
│ DuckDB-Wasm │    │     API     │    │ PostgreSQL  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
   ┌───┴───┐               │                   │
   │ Local │               │                   │
   │   DB  │               │                   │
   └───┬───┘               │                   │
       │                   │                   │
       │ ═══ マスターデータ (リアルタイム) ═══ │
       │ 1. Auth Request   │                   │
       │ ──────────────────▶                   │
       │ 2. Projects List  │ 3. Query Master   │
       │ ──────────────────▶ ──────────────────▶
       │ 4. Return Projects│ 5. Master Data    │
       │ ◀────────────────── ◀──────────────────
       │                   │                   │
       │ ═══ 分析データ (バッチ同期) ═══════   │
       │ 6. Sync Analysis  │                   │
       │ ──────────────────▶                   │
       │                   │ 7. Query Results  │
       │                   │ ──────────────────▶
       │                   │ 8. Bulk Data      │
       │                   │ ◀──────────────────
       │ 9. Local Insert   │                   │
       │ ◀──────────────────                   │
       │                   │                   │
       │ ═══ 高速分析 (ローカルのみ) ═══════   │
       │ 10. SQL Analytics │                   │
       │ ─────────┐        │                   │
       │         │        │                   │
       │ ◀───────┘        │                   │
```

### 4.2 データ同期スケジュール

```typescript
interface SyncSchedule {
  // マスターデータ: リアルタイム
  masterData: {
    projects: 'on-demand',      // ページロード時
    users: 'on-demand',         // 権限チェック時
    assignments: 'on-demand'    // プロジェクト変更時
  };
  
  // 分析データ: 定期同期
  analysisData: {
    recentAnalyses: '5min',     // 最新30日分
    historicalData: '1hour',    // 過去データ
    findings: '10min',          // 検出事項詳細
    metrics: '30min'            // 集計メトリクス
  };
  
  // レポート: オンデマンド
  reports: {
    generation: 'on-demand',    // レポート要求時
    cache: '1day'              // キャッシュ有効期限
  };
}
```

### 4.2 同期プロトコル

```typescript
interface SyncProtocol {
  // 初期同期
  initialSync: {
    lastSyncTime: null;
    requestFull: true;
    tables: string[];
  };
  
  // 差分同期
  deltaSync: {
    lastSyncTime: Date;
    requestDelta: true;
    tables: string[];
    checksum?: string;
  };
  
  // 競合解決
  conflictResolution: {
    strategy: 'server-wins' | 'client-wins' | 'manual';
    conflicts: ConflictItem[];
  };
}
```

## 5. 実装計画

### 5.1 Phase 1: 基盤構築 (Week 1-2)
```typescript
// 1. DuckDB-Wasm セットアップ
bun add @duckdb/duckdb-wasm

// 2. OPFS サポート検証
const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;

// 3. 基本サービス実装
class DuckDBManager {
  private db: DuckDB | null = null;
  private connection: DuckDBConnection | null = null;
  
  async initialize() {
    const bundle = await import('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.wasm');
    this.db = new DuckDB(bundle);
    this.connection = await this.db.connect();
  }
}
```

### 5.2 Phase 2: データモデル実装 (Week 3-4)
```typescript
// スキーマ作成とマイグレーション
class SchemaManager {
  async createInitialSchema() {
    const schemas = [
      CREATE_TENANTS_TABLE,
      CREATE_USERS_TABLE,
      CREATE_PROJECTS_TABLE,
      // ... 他のテーブル
    ];
    
    for (const schema of schemas) {
      await this.duckdb.execute(schema);
    }
  }
}
```

### 5.3 Phase 3: UI統合 (Week 5-6)
```typescript
// React Hooks for DuckDB
const useAnalysisData = (projectId: string) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      const result = await duckdbService.execute(`
        SELECT a.*, s.overall_score, s.total_findings
        FROM analyses a
        LEFT JOIN analysis_scores s ON a.id = s.analysis_id
        WHERE a.project_id = ?
        ORDER BY a.created_at DESC
      `, [projectId]);
      
      setData(result);
      setLoading(false);
    };
    
    fetchData();
  }, [projectId]);
  
  return { data, loading };
};
```

### 5.4 Phase 4: 同期機能 (Week 7-8)
```typescript
// Background Sync with Service Worker
class BackgroundSyncManager {
  async registerSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('background-sync');
    }
  }
}
```

## 6. パフォーマンス最適化

### 6.1 初期ロード最適化
```typescript
// 段階的データロード
class DataLoader {
  async loadEssentialData() {
    // 1. ユーザー情報とテナント情報
    await this.loadUserData();
    
    // 2. 現在のプロジェクト情報
    await this.loadCurrentProjects();
    
    // 3. 最新の分析結果 (最新30日分)
    await this.loadRecentAnalyses(30);
  }
  
  async loadHistoricalData() {
    // 4. 履歴データ (バックグラウンドで)
    await this.loadHistoricalAnalyses();
  }
}
```

### 6.2 クエリ最適化
```typescript
// 分析ダッシュボード用の最適化クエリ
const DASHBOARD_QUERIES = {
  projectSummary: `
    SELECT 
      p.id,
      p.name,
      COUNT(a.id) as analysis_count,
      AVG(s.overall_score) as avg_score,
      MAX(a.created_at) as last_analysis
    FROM projects p
    LEFT JOIN analyses a ON p.id = a.project_id
    LEFT JOIN analysis_scores s ON a.id = s.analysis_id
    WHERE p.tenant_id = ?
    GROUP BY p.id, p.name
    ORDER BY last_analysis DESC NULLS LAST
  `,
  
  findingsByPillar: `
    SELECT 
      pillar,
      severity,
      COUNT(*) as count
    FROM analysis_findings f
    JOIN analyses a ON f.analysis_id = a.id
    WHERE a.tenant_id = ? AND a.created_at >= ?
    GROUP BY pillar, severity
    ORDER BY pillar, 
      CASE severity 
        WHEN 'Critical' THEN 1 
        WHEN 'High' THEN 2 
        WHEN 'Medium' THEN 3 
        WHEN 'Low' THEN 4 
      END
  `
};
```

## 7. セキュリティ考慮事項

### 7.1 テナント分離
```typescript
class TenantSecurityManager {
  private currentTenantId: string;
  
  async executeQuery(query: string, params: any[]): Promise<any[]> {
    // すべてのクエリにテナントID制約を追加
    const secureQuery = this.addTenantFilter(query);
    const secureParams = [this.currentTenantId, ...params];
    
    return await this.duckdb.execute(secureQuery, secureParams);
  }
  
  private addTenantFilter(query: string): string {
    // クエリ解析してWHERE句にtenant_id制約を追加
    return query.replace(
      /WHERE/i, 
      `WHERE tenant_id = ? AND`
    );
  }
}
```

### 7.2 データ暗号化
```typescript
class DataEncryption {
  async encryptSensitiveData(data: any): Promise<string> {
    const key = await this.getEncryptionKey();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) },
      key,
      new TextEncoder().encode(JSON.stringify(data))
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }
}
```

## 8. エラーハンドリングと監視

### 8.1 エラーハンドリング
```typescript
class DuckDBErrorHandler {
  async executeWithRetry(query: string, params: any[], maxRetries = 3): Promise<any[]> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.duckdb.execute(query, params);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        if (this.isRecoverableError(error)) {
          await this.wait(Math.pow(2, i) * 1000); // Exponential backoff
          continue;
        }
        
        throw error;
      }
    }
  }
}
```

### 8.2 パフォーマンス監視
```typescript
class PerformanceMonitor {
  async measureQuery(query: string, params: any[]): Promise<{ result: any[], duration: number }> {
    const start = performance.now();
    const result = await this.duckdb.execute(query, params);
    const duration = performance.now() - start;
    
    // 遅いクエリをログ
    if (duration > 1000) {
      console.warn(`Slow query detected: ${duration}ms`, { query, params });
    }
    
    return { result, duration };
  }
}
```

## 9. ハイブリッド実装ロードマップ

### Week 1-2: 段階的移行基盤
- [ ] Data Orchestrator 実装 (既存モックデータ活用)
- [ ] DuckDB-Wasm 基本セットアップ
- [ ] OPFS 動作確認・フォールバック実装
- [ ] 既存UIとの統合テスト

### Week 3-4: ローカルDB構築
- [ ] ローカルDB スキーマ実装 (分析データのみ)
- [ ] 分析結果データの同期機能
- [ ] 検出事項の高速クエリ実装
- [ ] キャッシュ管理機能

### Week 5-6: 中央API統合
- [ ] Central API Service 実装
- [ ] 認証・認可機能
- [ ] マスターデータのリアルタイム取得
- [ ] 権限ベースアクセス制御

### Week 7-8: 高度な分析機能
- [ ] DuckDBでの高速分析クエリ
- [ ] リアルタイムメトリクス計算
- [ ] トレンド分析・比較機能
- [ ] ダッシュボード最適化

### Week 9-10: 同期・最適化
- [ ] インクリメンタル同期
- [ ] オフライン対応強化
- [ ] パフォーマンス最適化
- [ ] プロダクション対応

## 10. 実装優先度

### 🔥 高優先度 (現在のモックデータから移行)
1. **Data Orchestrator** - 既存コードへの影響を最小化
2. **分析結果のローカルDB** - 大量データの高速表示
3. **基本的な同期機能** - データの一貫性確保

### 🔸 中優先度 (機能拡張)
4. **リアルタイム分析** - 複雑なSQLクエリ実行
5. **オフライン対応** - ネットワーク不安定時の動作
6. **レポート機能** - PDF/Excel生成

### 🔹 低優先度 (最適化)
7. **高度な同期制御** - 競合解決、差分同期
8. **パフォーマンス監視** - メトリクス収集
9. **エラーハンドリング** - 復旧機能

この設計により、既存のReactアプリケーションを段階的に高性能なハイブリッドアーキテクチャに移行できます。