# server.js - メインアプリケーションファイル解説

## 目的
**server.js**は、キャラメイクSNSアプリケーションの**心臓部**となるメインサーバーファイルです。
Express.js + PostgreSQL + AI API連携の基盤を提供し、3週間プロジェクトの核となる機能を統合します🚀

## アーキテクチャ概要

### 技術スタック統合
```
🌐 HTTP Server (Express.js)
├── 🛡️ Security (Helmet + CORS)
├── 🗄️ Database (PostgreSQL)  
├── 🤖 AI Services (OpenAI API)
├── 🔐 Authentication (JWT + Google OAuth)
└── 📊 Monitoring (Health Check + Keep-Alive)
```

### プロジェクト段階での位置づけ
- **Week 1**: PostgreSQL基盤 → server.jsで接続テスト実装
- **Week 2**: AIチャット機能 → AI APIエンドポイント追加
- **Week 3**: SNS機能 → いいね・投稿APIの実装
- **現在**: 基本サーバー + PostgreSQL接続テスト段階

## コード構造の詳細解説

### 1. 基本設定とミドルウェア
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
```

**重要ポイント**:
- **dotenv**: 環境変数の読み込み（DATABASE_URL、OPENAI_API_KEY等）
- **PORT**: Railway環境では自動設定、ローカルでは3000番

### 2. セキュリティミドルウェア設定
```javascript
// ミドルウェア設定
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
```

#### helmet() - セキュリティ強化
```javascript
// helmetが自動で設定するHTTPヘッダー例
{
  "X-Content-Type-Options": "nosniff",      // MIME タイプスニッフィング防止
  "X-Frame-Options": "DENY",                // clickjacking攻撃防止
  "X-XSS-Protection": "1; mode=block",      // XSS攻撃防止
  "Strict-Transport-Security": "max-age=...", // HTTPS強制
}
```

#### cors() - クロスオリジン許可
```javascript
// フロントエンドからのAPIアクセスを許可
// 将来的にはオリジン制限を追加予定
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',  // 本番では制限必要
  credentials: true
}));
```

#### JSON処理設定
```javascript
app.use(express.json({ limit: '10mb' }));
```
**重要**: DALL-E画像データ（Base64）の処理に必要
- 画像データは数MBになることがある
- PostgreSQL BLOBストレージでの画像保存に対応

### 3. ヘルスチェック機能（Railway連携）

#### ルートエンドポイント
```javascript
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'キャラメイクSNS API Server 🎭',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});
```

**活用場面**:
- 開発中の動作確認
- アプリの基本情報表示
- デバッグ時のサーバー状態確認

#### Railway専用ヘルスチェック
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});
```

**railway.jsonとの連携**:
```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```
- Railway → 定期的に`/health`にアクセス
- レスポンスなし → 自動再起動実行

### 4. API設定状況確認機能
```javascript
app.get('/api/status', (req, res) => {
  res.json({
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
    google_auth: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not configured',
    jwt: process.env.JWT_SECRET ? 'configured' : 'not configured'
  });
});
```

**開発時の活用**:
```bash
# 環境変数設定確認
curl https://your-app.railway.app/api/status

# レスポンス例
{
  "database": "configured",
  "openai": "not configured",  // ←設定不足を発見
  "google_auth": "configured",
  "jwt": "configured"
}
```

### 5. PostgreSQL接続テスト（重要機能）
```javascript
app.get('/api/db-test', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: 'DATABASE_URL not configured',
        message: 'PostgreSQL接続情報が設定されていません'
      });
    }

    // PostgreSQL接続テスト（動的import）
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version()');
    client.release();
    await pool.end();

    res.json({
      status: 'success',
      message: 'PostgreSQL接続成功！',
      current_time: result.rows[0].current_time,
      database_version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
    });

  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'PostgreSQL接続エラー',
      error: error.message
    });
  }
});
```

#### SSL設定の重要性
```javascript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
```
- **本番環境（Railway）**: SSL必須、証明書検証は緩和
- **開発環境（ローカル）**: SSL不要
- **セキュリティ**: 接続データの暗号化

#### プール接続パターン
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 将来的な最適化設定
  max: 20,          // 最大接続数
  idleTimeoutMillis: 30000,  // アイドルタイムアウト
  connectionTimeoutMillis: 2000,  // 接続タイムアウト
});
```

### 6. エラーハンドリング

#### 404ハンドラー
```javascript
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `エンドポイント ${req.originalUrl} が見つかりません`
  });
});
```

#### グローバルエラーハンドラー
```javascript
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'サーバーエラーが発生しました',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
```

**セキュリティ考慮**:
- 本番環境ではスタックトレース非表示
- 開発環境では詳細エラー情報表示
- ログ出力でデバッグ支援

### 7. プロセス管理とシグナルハンドリング
```javascript
// プロセス終了シグナルハンドリング
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, graceful shutdown starting');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, graceful shutdown starting');
  process.exit(0);
});
```

**Railway環境での重要性**:
- デプロイ時の古いプロセス終了
- メモリリーク防止
- データベース接続の適切なクローズ

### 8. Keep-Alive機能（Railway対策）
```javascript
// keep-alive用の定期ping（より頻繁に）
setInterval(() => {
  console.log(`💓 Keep alive - ${new Date().toISOString()}`);
  // 自分自身にpingを送ってアクティブ状態を維持
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Self-ping to maintain activity');
  }
}, 15000); // 15秒ごと
```

**無料プランでの問題対策**:
- アクセスがないとサーバーがスリープ
- 定期的な自己ping で常時起動維持
- PostgreSQL接続プールの維持

### 9. サーバー起動とエラーハンドリング
```javascript
// サーバー起動
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 キャラメイクSNS Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'configured' : 'not configured'}`);
  console.log(`🌐 Server listening on 0.0.0.0:${PORT}`);
});

// サーバーエラーハンドリング
server.on('error', (error) => {
  console.error('❌ Server Error:', error);
});
```

**起動時診断機能**:
- 環境変数設定状況の確認
- データベース接続準備状況
- AI API設定状況
- ポート競合エラーの検出

## 将来の機能拡張計画

### Week 2: AIチャット機能追加
```javascript
// 追加予定のエンドポイント
app.post('/api/chat', async (req, res) => {
  // OpenAI API呼び出し
  // チャット履歴管理
  // 選択肢生成ロジック
});

app.get('/api/chat/history/:userId', async (req, res) => {
  // PostgreSQLからチャット履歴取得
});
```

### Week 3: SNS機能追加
```javascript
// 追加予定のエンドポイント
app.post('/api/characters', async (req, res) => {
  // キャラクター投稿
  // DALL-E画像生成
  // PostgreSQL BLOB保存
});

app.post('/api/characters/:id/like', async (req, res) => {
  // いいね機能
  // ユーザー認証チェック
  // 重複いいね防止
});

app.get('/api/characters', async (req, res) => {
  // 投稿一覧取得
  // ページネーション
  // 新着順ソート
});
```

### 認証機能統合
```javascript
// JWT + Google OAuth統合
const passport = require('passport');
const JwtStrategy = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20');

// ミドルウェア追加
app.use(passport.initialize());

// 認証が必要なエンドポイントの保護
app.use('/api/characters', passport.authenticate('jwt', { session: false }));
```

## デバッグとトラブルシューティング

### 開発環境での確認方法
```bash
# サーバー起動
npm start

# 基本動作確認
curl http://localhost:3000/

# PostgreSQL接続テスト
curl http://localhost:3000/api/db-test

# API設定確認
curl http://localhost:3000/api/status
```

### よくある問題と対処法

#### 1. PostgreSQL接続エラー
```bash
# エラー例
Database connection error: ECONNREFUSED

# 確認ポイント
- DATABASE_URL環境変数の設定
- PostgreSQLサーバーの起動状況
- SSL設定の適合性
```

#### 2. ポート競合エラー
```bash
# エラー例
Error: listen EADDRINUSE: address already in use :::3000

# 対処法
lsof -ti:3000 | xargs kill -9  # プロセス強制終了
npm start  # 再起動
```

#### 3. 環境変数設定漏れ
```bash
# /api/statusでの確認
{
  "database": "not configured"  // ←設定不足
}

# .envファイルの確認
DATABASE_URL=postgresql://...
```

## セキュリティ考慮事項

### HTTPSと環境変数管理
- **本番環境**: Railway が SSL 自動設定
- **API キー**: 環境変数での安全管理
- **データベース**: SSL暗号化接続

### リクエスト制限（将来実装）
```javascript
// 予定している制限機能
- AI API呼び出し: 200回/日
- 画像生成: 5回/日
- いいね機能: スパム防止
- 投稿機能: 30体上限
```

## 学習ポイント

### Express.js アプリケーション設計
- **ミドルウェア**: セキュリティ、CORS、JSON処理
- **ルーティング**: RESTful API設計の基本
- **エラーハンドリング**: 堅牢なサーバー構築

### PostgreSQL連携
- **接続プール**: 効率的なDB接続管理
- **SSL設定**: 本番環境での安全な通信
- **エラー処理**: DB接続失敗時の適切な対応

### クラウド環境運用
- **ヘルスチェック**: 自動監視システム
- **環境変数**: 設定の外部化
- **プロセス管理**: 安定したサービス運用

## まとめ

**server.js**は「全機能を統合する司令塔」🎯

**現在実装済み機能**:
- ✅ 基本サーバー機能（Express.js）
- ✅ セキュリティ設定（Helmet + CORS）
- ✅ PostgreSQL接続テスト
- ✅ Railway連携（ヘルスチェック）
- ✅ 環境変数管理
- ✅ エラーハンドリング

**今後追加予定機能**:
- 🔄 AIチャット機能（Week 2）
- 🔄 SNS機能（Week 3）
- 🔄 認証システム統合
- 🔄 画像生成API連携

**学習価値**:
- Node.js/Express.js の実践的な使い方
- PostgreSQL との連携パターン
- クラウド環境での運用ノウハウ
- セキュアなAPI設計の基礎

3週間プロジェクトの技術基盤として、
確実に動作する「安心できる土台」を提供します💪✨