const { Pool } = require('pg');

// PostgreSQL接続プールの設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // 最大接続数
  idleTimeoutMillis: 30000, // アイドルタイムアウト
  connectionTimeoutMillis: 2000, // 接続タイムアウト
});

// 接続プールのイベントリスナー
pool.on('connect', () => {
  console.log('📗 PostgreSQL接続プールから新しい接続を取得');
});

pool.on('error', (err) => {
  console.error('🔴 PostgreSQL接続プールエラー:', err);
  process.exit(-1);
});

// データベース接続テスト
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    console.log('✅ PostgreSQL接続テスト成功:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL接続テストエラー:', error.message);
    return false;
  }
};

// クエリ実行ヘルパー関数
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Executed query', { text: text.slice(0, 50) + '...', duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('🔴 Query error:', error.message);
    console.error('📝 Query:', text);
    console.error('📊 Params:', params);
    throw error;
  }
};

// トランザクション実行ヘルパー関数
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// プロセス終了時にプールを閉じる
process.on('SIGINT', () => {
  console.log('🛑 PostgreSQL接続プールを閉じます...');
  pool.end();
});

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};