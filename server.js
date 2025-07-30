const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('./config/passport');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定（テスト環境用CSP緩和）
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://accounts.google.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// セッション設定（Google OAuth用）
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  }
}));

// Passport初期化
app.use(passport.initialize());
app.use(passport.session());

// 静的ファイル配信（テスト用HTML）
app.use(express.static('public'));

// ヘルスチェック用エンドポイント
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

// Railway用ヘルスチェック
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ルート設定
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// API ステータス確認
app.get('/api/status', (req, res) => {
  res.json({
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
    google_auth: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not configured',
    jwt: process.env.JWT_SECRET ? 'configured' : 'not configured',
    session_secret: process.env.SESSION_SECRET ? 'configured' : 'not configured'
  });
});

// PostgreSQL接続テスト用エンドポイント
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

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `エンドポイント ${req.originalUrl} が見つかりません`
  });
});

// エラーハンドラー
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'サーバーエラーが発生しました',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// プロセス終了シグナルハンドリング
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, graceful shutdown starting');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, graceful shutdown starting');
  process.exit(0);
});

// keep-alive用の定期ping（より頻繁に）
setInterval(() => {
  console.log(`💓 Keep alive - ${new Date().toISOString()}`);
  // 自分自身にpingを送ってアクティブ状態を維持
  if (process.env.NODE_ENV === 'production') {
    console.log('🔄 Self-ping to maintain activity');
  }
}, 15000); // 15秒ごと

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

module.exports = app;