const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL接続設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    console.log('🔗 PostgreSQL接続テストを開始...');
    
    // 接続テスト
    const client = await pool.connect();
    console.log('✅ PostgreSQL接続成功！');
    
    // バージョン確認
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:', versionResult.rows[0].version);
    
    // 現在のデータベース情報
    const dbInfoResult = await client.query('SELECT current_database(), current_user');
    console.log('🗄️ Database:', dbInfoResult.rows[0].current_database);
    console.log('👤 User:', dbInfoResult.rows[0].current_user);
    
    // 既存テーブル確認
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📋 既存テーブル:', tablesResult.rows.map(row => row.table_name));
    
    client.release();
    console.log('🎉 接続テスト完了！');
    
  } catch (error) {
    console.error('❌ PostgreSQL接続エラー:', error.message);
    console.error('💡 確認項目:');
    console.error('  - .envファイルのDATABASE_URLが正しいか');
    console.error('  - Railway PostgreSQLサービスが起動しているか');
    console.error('  - ネットワーク接続が正常か');
  } finally {
    await pool.end();
  }
}

// スクリプト実行
if (require.main === module) {
  testConnection();
}

module.exports = { pool, testConnection };