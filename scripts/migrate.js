const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL接続設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// マイグレーション実行状況を記録するテーブル
const createMigrationsTable = async (client) => {
  console.log('📋 マイグレーション管理テーブルを作成中...');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW(),
      description TEXT
    )
  `);
  
  console.log('✅ migrationsテーブル作成完了');
};

// Stage 1: 基本3テーブル作成
const createStage1Tables = async (client) => {
  console.log('🏗️ Stage 1: 基本3テーブルを作成中...');
  
  // 1. ユーザーテーブル（GoogleAuth + 従来認証対応）
  console.log('👤 usersテーブル作成中...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255), -- NULL可（Google認証時）
      google_id VARCHAR(255) UNIQUE, -- NULL可（従来認証時）
      display_name VARCHAR(255) NOT NULL,
      profile_image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ usersテーブル作成完了');

  // 2. キャラクターテーブル（JSON型でキャラ設定格納）
  console.log('🎭 charactersテーブル作成中...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      character_data JSON NOT NULL,
      ai_generated_image BYTEA, -- DALL-E画像のBLOB格納
      is_public BOOLEAN DEFAULT true,
      likes_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ charactersテーブル作成完了');

  // 3. いいね機能テーブル（SNS要素）
  console.log('👍 character_likesテーブル作成中...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS character_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, character_id)
    )
  `);
  console.log('✅ character_likesテーブル作成完了');

  console.log('🎉 Stage 1テーブル作成完了！');
};

// Stage 2: API使用制限テーブル追加
const createStage2Tables = async (client) => {
  console.log('🏗️ Stage 2: API使用制限テーブルを作成中...');
  
  // 4. API使用制限管理テーブル
  console.log('📊 user_daily_limitsテーブル作成中...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_daily_limits (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      usage_date DATE DEFAULT CURRENT_DATE,
      ai_chat_count INTEGER DEFAULT 0,
      image_generation_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, usage_date)
    )
  `);
  console.log('✅ user_daily_limitsテーブル作成完了');

  // Stage2用インデックス追加
  console.log('📊 Stage2インデックスを作成中...');
  await client.query('CREATE INDEX IF NOT EXISTS idx_user_daily_limits_date ON user_daily_limits(usage_date)');
  console.log('✅ Stage2インデックス作成完了');

  console.log('🎉 Stage 2テーブル作成完了！');
};

// 基本インデックス作成
const createBasicIndexes = async (client) => {
  console.log('📊 基本インデックスを作成中...');
  
  // パフォーマンス向上のための基本インデックス
  const indexes = [
    {
      name: 'idx_characters_user_id',
      query: 'CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id)'
    },
    {
      name: 'idx_characters_public',
      query: 'CREATE INDEX IF NOT EXISTS idx_characters_public ON characters(is_public) WHERE is_public = true'
    },
    {
      name: 'idx_character_likes_character_id',
      query: 'CREATE INDEX IF NOT EXISTS idx_character_likes_character_id ON character_likes(character_id)'
    },
    {
      name: 'idx_characters_created_at',
      query: 'CREATE INDEX IF NOT EXISTS idx_characters_created_at ON characters(created_at DESC)'
    }
  ];

  for (const index of indexes) {
    console.log(`  🔍 ${index.name} 作成中...`);
    await client.query(index.query);
    console.log(`  ✅ ${index.name} 作成完了`);
  }

  console.log('🎉 基本インデックス作成完了！');
};

// データ制約追加
const addConstraints = async (client) => {
  console.log('🔒 データ制約を設定中...');
  
  try {
    // ユーザー認証方式の制約（GoogleAuth OR 従来認証）
    console.log('  🔐 認証方式制約を追加中...');
    
    // 既存制約チェック
    const existingConstraint = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'users' AND constraint_name = 'check_auth_method'
    `);
    
    if (existingConstraint.rows.length === 0) {
      await client.query(`
        ALTER TABLE users 
        ADD CONSTRAINT check_auth_method 
        CHECK (
          (password_hash IS NOT NULL AND google_id IS NULL) OR 
          (password_hash IS NULL AND google_id IS NOT NULL)
        )
      `);
      console.log('  ✅ 認証方式制約追加完了');
    } else {
      console.log('  ✅ 認証方式制約は既に存在');
    }

    // JSON必須フィールド検証
    console.log('  📝 JSON必須フィールド制約を追加中...');
    
    const existingJsonConstraint = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'characters' AND constraint_name = 'check_character_data_required'
    `);
    
    if (existingJsonConstraint.rows.length === 0) {
      await client.query(`
        ALTER TABLE characters 
        ADD CONSTRAINT check_character_data_required 
        CHECK (
          character_data ? '基本情報' AND 
          character_data->'基本情報' ? '名前'
        )
      `);
      console.log('  ✅ JSON必須フィールド制約追加完了');
    } else {
      console.log('  ✅ JSON必須フィールド制約は既に存在');
    }

    console.log('🎉 データ制約設定完了！');
    
  } catch (error) {
    // 制約エラーは警告レベルで処理（既存データがある場合）
    console.warn('⚠️ 制約追加でエラー（既存データが原因の可能性）:', error.message);
  }
};

// マイグレーション実行状況をチェック
const checkMigrationStatus = async (client, version) => {
  const result = await client.query(
    'SELECT * FROM migrations WHERE version = $1',
    [version]
  );
  return result.rows.length > 0;
};

// マイグレーション記録
const recordMigration = async (client, version, description) => {
  await client.query(
    'INSERT INTO migrations (version, description) VALUES ($1, $2)',
    [version, description]
  );
  console.log(`📝 マイグレーション記録完了: ${version}`);
};

// メインマイグレーション実行
const runMigration = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 PostgreSQLマイグレーション開始');
    console.log(`🔗 接続先: ${process.env.DATABASE_URL ? 'Railway PostgreSQL' : 'ローカル'}`);
    console.log('─'.repeat(60));

    // トランザクション開始
    await client.query('BEGIN');

    // 1. マイグレーション管理テーブル作成
    await createMigrationsTable(client);

    // 2. Stage1マイグレーション実行チェック
    const stage1Applied = await checkMigrationStatus(client, 'stage1_basic_tables');
    
    if (!stage1Applied) {
      console.log('🆕 Stage1マイグレーションを実行します...');
      
      // Stage1テーブル作成
      await createStage1Tables(client);
      
      // 基本インデックス作成
      await createBasicIndexes(client);
      
      console.log('⚠️ データ制約は後のStageで追加予定（Week 2-3）');
      
      // マイグレーション記録
      await recordMigration(
        client, 
        'stage1_basic_tables', 
        'Stage1: 基本3テーブル + インデックス + 制約作成'
      );
      
    } else {
      console.log('✅ Stage1マイグレーションは既に適用済みです');
    }

    // 3. Stage2マイグレーション実行チェック（認証システム用）
    const stage2Applied = await checkMigrationStatus(client, 'stage2_auth_limits');
    
    if (!stage2Applied) {
      console.log('🆕 Stage2マイグレーション（認証システム用）を実行します...');
      
      // Stage2テーブル作成
      await createStage2Tables(client);
      
      // マイグレーション記録
      await recordMigration(
        client, 
        'stage2_auth_limits', 
        'Stage2: API使用制限テーブル追加（認証システム対応）'
      );
      
    } else {
      console.log('✅ Stage2マイグレーションは既に適用済みです');
    }

    // トランザクションコミット
    await client.query('COMMIT');
    
    console.log('─'.repeat(60));
    console.log('🎉 マイグレーション完了！');
    
    // テーブル一覧表示
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 作成されたテーブル:');
    tables.rows.forEach(table => {
      console.log(`  📄 ${table.table_name}`);
    });

  } catch (error) {
    // エラー時はロールバック
    await client.query('ROLLBACK');
    console.error('❌ マイグレーションエラー:', error.message);
    console.error('🔄 変更をロールバックしました');
    throw error;
    
  } finally {
    client.release();
    await pool.end();
  }
};

// テーブル構造確認用関数
const showTableStructure = async () => {
  const client = await pool.connect();
  
  try {
    console.log('📊 テーブル構造確認');
    console.log('─'.repeat(60));
    
    const tables = ['users', 'characters', 'character_likes', 'user_daily_limits', 'migrations'];
    
    for (const table of tables) {
      console.log(`\n📄 ${table}テーブル:`);
      
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      
      if (columns.rows.length > 0) {
        columns.rows.forEach(col => {
          console.log(`  ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
        });
      } else {
        console.log('  テーブルが存在しません');
      }
    }
    
  } catch (error) {
    console.error('❌ テーブル構造確認エラー:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
};

// コマンドライン引数による実行分岐
const command = process.argv[2];

if (command === 'show') {
  // テーブル構造確認
  showTableStructure().catch(console.error);
} else {
  // マイグレーション実行
  runMigration().catch((error) => {
    console.error('💥 マイグレーション失敗');
    console.error('❌ エラー詳細:', error.message);
    console.error('🔍 スタックトレース:', error.stack);
    process.exit(1);
  });
}

module.exports = { runMigration, showTableStructure };