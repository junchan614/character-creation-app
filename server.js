const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ヘルスチェック用エンドポイント
app.get('/', (req, res) => {
  res.json({
    message: 'キャラメイクSNS API Server 🎭',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API ステータス確認
app.get('/api/status', (req, res) => {
  res.json({
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
    google_auth: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not configured',
    jwt: process.env.JWT_SECRET ? 'configured' : 'not configured'
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

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 キャラメイクSNS Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'configured' : 'not configured'}`);
});

module.exports = app;