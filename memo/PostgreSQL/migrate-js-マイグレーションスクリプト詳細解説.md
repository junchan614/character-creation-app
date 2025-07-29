# PostgreSQLマイグレーションスクリプト詳細解説

## 📚 目次
1. [マイグレーションとは何か](#マイグレーションとは何か)
2. [スクリプトの設計思想](#スクリプトの設計思想)
3. [実行方法と使い方](#実行方法と使い方)
4. [各テーブルの詳細解説](#各テーブルの詳細解説)
5. [トラブルシューティング](#トラブルシューティング)
6. [Week 2・Week 3での拡張計画](#week-2week-3での拡張計画)

---

## マイグレーションとは何か

### 🔰 PostgreSQL初心者向け基礎知識

**マイグレーション**とは、データベースの構造（テーブル、カラム、インデックスなど）を段階的に変更・更新していく仕組みのことです。

#### なぜマイグレーションが必要？

```
❌ 悪い例：毎回手動でテーブル作成
1. 開発者Aがローカルでテーブル作成
2. 開発者Bも同じテーブルを手動作成
3. 本番環境でも手動作成
→ 構造がバラバラ、ミスが発生しやすい

✅ 良い例：マイグレーションスクリプト使用
1. スクリプト一つでどこでも同じ構造を作成
2. 変更履歴が残る
3. 自動化・確実性が向上
```

#### SQLiteとPostgreSQLの違い

| 項目 | SQLite | PostgreSQL |
|------|---------|------------|
| **ファイル** | 単一.dbファイル | サーバー型DB |
| **JSON型** | 限定的サポート | 高機能JSON操作 |
| **BLOB** | 簡単 | BYTEA型で高機能 |
| **制約** | 基本的 | 豊富な制約機能 |
| **インデックス** | 自動作成 | 手動作成が基本 |

---

## スクリプトの設計思想

### 🎯 学習重視・安全性重視の設計

#### 1. **段階的実装（Stage制）**
```javascript
// Week 1: Stage1 - 基本3テーブル
// Week 2: Stage2 - AI使用制限テーブル（予定）
// Week 3: Stage3 - 投稿管理テーブル（予定）
```

**なぜStage制？**
- 一度に全部作らず、学習しながら段階的に構築
- 各週の学習目標に合わせた実装
- エラー発生時の影響範囲を限定

#### 2. **トランザクション管理**
```javascript
await client.query('BEGIN');
// すべての処理
await client.query('COMMIT'); // 成功時
// または
await client.query('ROLLBACK'); // エラー時
```

**安全性のポイント：**
- 途中でエラーが起きても、すべて元に戻る
- 「半分だけテーブルができた」という状況を防ぐ
- 本番環境での安全な実行を保証

#### 3. **実行状況の記録**
```javascript
// migrationsテーブルで実行履歴を管理
CREATE TABLE migrations (
  version VARCHAR(255) UNIQUE NOT NULL, // 'stage1_basic_tables'
  applied_at TIMESTAMP DEFAULT NOW()
)
```

**重複実行の防止：**
- 同じマイグレーションを複数回実行しても安全
- 「既に適用済み」を判断して自動スキップ
- チーム開発での混乱を防ぐ

---

## 実行方法と使い方

### 🚀 基本的な実行コマンド

#### 1. **通常のマイグレーション実行**
```bash
# プロジェクトのルートディレクトリで実行
cd /home/junchan614/projects/character-creation-app
node scripts/migrate.js
```

**実行時の表示例：**
```
🚀 PostgreSQLマイグレーション開始
🔗 接続先: Railway PostgreSQL
────────────────────────────────────────────────────────────
📋 マイグレーション管理テーブルを作成中...
✅ migrationsテーブル作成完了
🆕 Stage1マイグレーションを実行します...
🏗️ Stage 1: 基本3テーブルを作成中...
👤 usersテーブル作成中...
✅ usersテーブル作成完了
🎭 charactersテーブル作成中...
✅ charactersテーブル作成完了
👍 character_likesテーブル作成中...
✅ character_likesテーブル作成完了
🎉 Stage 1テーブル作成完了！
📊 基本インデックスを作成中...
  🔍 idx_characters_user_id 作成中...
  ✅ idx_characters_user_id 作成完了
（以下、インデックス作成続く）
🎉 マイグレーション完了！
📋 作成されたテーブル:
  📄 character_likes
  📄 characters
  📄 migrations
  📄 users
```

#### 2. **テーブル構造確認**
```bash
node scripts/migrate.js show
```

**確認できる情報：**
- 各テーブルのカラム一覧
- データ型の詳細
- NOT NULL制約の状況
- デフォルト値の設定

#### 3. **実行前の準備**
```bash
# 1. .envファイルの確認
DATABASE_URL=postgresql://username:password@hostname:port/database

# 2. PostgreSQL接続テスト
node scripts/test-connection.js

# 3. マイグレーション実行
node scripts/migrate.js
```

---

## 各テーブルの詳細解説

### 👤 **usersテーブル（ユーザー管理）**

#### テーブル構造
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,              -- 自動増分ID
  username VARCHAR(255) UNIQUE NOT NULL,  -- ユーザー名（重複不可）
  email VARCHAR(255) UNIQUE NOT NULL,     -- メールアドレス（重複不可）
  password_hash VARCHAR(255),             -- パスワードハッシュ（NULL可）
  google_id VARCHAR(255) UNIQUE,          -- GoogleAuth ID（NULL可）
  display_name VARCHAR(255) NOT NULL,     -- 表示名
  profile_image_url TEXT,                 -- プロフィール画像URL
  created_at TIMESTAMP DEFAULT NOW(),     -- 作成日時
  updated_at TIMESTAMP DEFAULT NOW()      -- 更新日時
)
```

#### 🔑 **GoogleAuth + 従来認証の併用設計**
```javascript
// データ制約で認証方式を保証
CHECK (
  (password_hash IS NOT NULL AND google_id IS NULL) OR  // 従来認証
  (password_hash IS NULL AND google_id IS NOT NULL)     // Google認証
)
```

**認証パターン：**
1. **従来認証ユーザー**: `password_hash`あり、`google_id`なし
2. **Google認証ユーザー**: `password_hash`なし、`google_id`あり

**学習ポイント：**
- PostgreSQLの`CHECK制約`で業務ルールを強制
- 二つの認証システムを一つのテーブルで管理
- NULL許可とUNIQUE制約の組み合わせ技

### 🎭 **charactersテーブル（キャラクター管理）**

#### テーブル構造
```sql
CREATE TABLE characters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  character_data JSON NOT NULL,        -- 20項目キャラ設定（JSON型）
  ai_generated_image BYTEA,           -- DALL-E画像（BYTEA型）
  is_public BOOLEAN DEFAULT true,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### 📊 **JSON型の活用**
```json
// character_dataの構造例
{
  "基本情報": {
    "名前": "魔法少女リナ",
    "年齢": "16歳",
    "身長": "158cm"
  },
  "外見": {
    "髪色": "銀髪",
    "瞳色": "紫",
    "特徴": "小悪魔的な笑顔"
  },
  "性格": {
    "基本性格": "明るく元気",
    "ギャップ": "実は人見知り",
    "口癖": "だよね〜"
  },
  // ... 17項目続く
}
```

**JSON型の利点：**
- 20項目の複雑な設定を一つのカラムで管理
- 項目追加・削除が容易
- PostgreSQLの高機能JSON操作が使用可能

#### 💾 **BYTEA型での画像保存**
```javascript
// DALL-E画像をBLOBとして直接保存
ai_generated_image BYTEA  // Binary Large Object
```

**なぜBLOB保存？**
- ファイルサーバー不要でシンプル
- トランザクション整合性の保証
- 学習プロジェクトに適した構成

**実際の保存例：**
```javascript
// 画像バイナリデータの保存
await client.query(
  'UPDATE characters SET ai_generated_image = $1 WHERE id = $2',
  [imageBuffer, characterId]
);
```

#### 🔗 **外部キー制約**
```sql
user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```

**CASCADE削除の仕組み：**
- ユーザーが削除されると、そのユーザーの全キャラクターも自動削除
- データ整合性を自動的に保持
- 孤児レコード（親がないデータ）の発生を防ぐ

### 👍 **character_likesテーブル（いいね機能）**

#### テーブル構造
```sql
CREATE TABLE character_likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, character_id)  -- 複合主キー
)
```

#### 🔑 **複合主キー設計**
```javascript
PRIMARY KEY (user_id, character_id)
```

**なぜ複合主キー？**
- 同じユーザーが同じキャラクターに重複いいねを防ぐ
- 中間テーブルの標準的な設計パターン
- インデックスの自動作成による高速検索

**いいね機能の実装例：**
```javascript
// いいね追加
INSERT INTO character_likes (user_id, character_id) 
VALUES ($1, $2)
ON CONFLICT DO NOTHING;  -- 重複時は何もしない

// いいね削除
DELETE FROM character_likes 
WHERE user_id = $1 AND character_id = $2;

// いいね数カウント
SELECT COUNT(*) FROM character_likes 
WHERE character_id = $1;
```

---

## トラブルシューティング

### ⚠️ よくあるエラーと対処法

#### 1. **接続エラー**
```
エラー: connection to server at "hostname" failed
```

**原因と対処：**
```bash
# 1. .envファイルの確認
cat .env
# DATABASE_URLが正しく設定されているか

# 2. Railwayでのデータベース確認
# Railway Dashboard → PostgreSQL → Connect

# 3. 接続テスト実行
node scripts/test-connection.js
```

#### 2. **制約違反エラー**
```
エラー: duplicate key value violates unique constraint
```

**原因：**
- 同じusername/emailで複数ユーザー作成
- 同じuser_id + character_idでいいね追加

**対処法：**
```javascript
// エラーハンドリング付きの安全な実装
try {
  await client.query('INSERT INTO users ...');
} catch (error) {
  if (error.code === '23505') { // unique_violation
    console.log('既に存在するユーザーです');
  }
}
```

#### 3. **JSON型エラー**
```
エラー: invalid input syntax for type json
```

**原因：**
- 不正なJSON形式でデータ挿入

**対処法：**
```javascript
// JSON妥当性チェック
const characterData = {
  "基本情報": { "名前": "テストキャラ" }
};

// 安全なJSON挿入
await client.query(
  'INSERT INTO characters (character_data) VALUES ($1)',
  [JSON.stringify(characterData)]
);
```

#### 4. **マイグレーション重複実行**
```
🔄 既に適用済みです：stage1_basic_tables
```

**これは正常動作です：**
- マイグレーションが既に実行済み
- 二重実行を防ぐ安全機能
- 何度実行しても安全

#### 5. **権限エラー**
```
エラー: permission denied for relation users
```

**原因：**
- データベースユーザーの権限不足

**対処法：**
```sql
-- Railway管理画面から実行
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

### 🔧 デバッグ用コマンド

#### 1. **テーブル存在確認**
```bash
node scripts/migrate.js show
```

#### 2. **マイグレーション履歴確認**
```sql
-- Railwayのコンソールで実行
SELECT * FROM migrations ORDER BY applied_at;
```

#### 3. **テーブル削除（開発時のみ）**
```sql
-- ⚠️ 本番環境では絶対に実行しない
DROP TABLE IF EXISTS character_likes CASCADE;
DROP TABLE IF EXISTS characters CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;
```

---

## Week 2・Week 3での拡張計画

### 📅 **Week 2: AI使用制限テーブル（Stage2）**

#### 追加予定テーブル
```sql
-- ユーザーの日次API使用制限管理
CREATE TABLE user_daily_limits (
  user_id INTEGER REFERENCES users(id),
  usage_date DATE DEFAULT CURRENT_DATE,
  ai_chat_count INTEGER DEFAULT 0,        -- GPT-4o使用回数（200回/日）
  image_generation_count INTEGER DEFAULT 0, -- DALL-E使用回数（5回/日）
  last_reset_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);
```

#### 機能追加
- 日次制限のリセット機能
- 使用回数の自動カウント
- 制限超過時の警告システム

### 📅 **Week 3: 投稿管理テーブル（Stage3）**

#### 追加予定テーブル
```sql
-- キャラクター投稿の詳細管理
CREATE TABLE character_posts (
  id SERIAL PRIMARY KEY,
  character_id INTEGER REFERENCES characters(id),
  post_type VARCHAR(50) DEFAULT 'character_card', -- 投稿種別
  visibility VARCHAR(20) DEFAULT 'public',        -- 公開範囲
  featured BOOLEAN DEFAULT false,                 -- おすすめ表示
  reported_count INTEGER DEFAULT 0,               -- 報告回数
  created_at TIMESTAMP DEFAULT NOW()
);

-- 投稿の表示統計
CREATE TABLE post_views (
  post_id INTEGER REFERENCES character_posts(id),
  user_id INTEGER REFERENCES users(id),
  viewed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
```

#### 機能追加
- 投稿の公開/非公開管理
- 表示回数の統計
- おすすめ投稿システム

### 🔄 **マイグレーション拡張方法**

#### Stage2追加の実装例
```javascript
// scripts/migrate.jsに追加予定
const createStage2Tables = async (client) => {
  console.log('🏗️ Stage 2: AI使用制限テーブルを作成中...');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_daily_limits (
      user_id INTEGER REFERENCES users(id),
      usage_date DATE DEFAULT CURRENT_DATE,
      ai_chat_count INTEGER DEFAULT 0,
      image_generation_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, usage_date)
    )
  `);
};

// メイン関数での呼び出し
const stage2Applied = await checkMigrationStatus(client, 'stage2_usage_limits');
if (!stage2Applied) {
  await createStage2Tables(client);
  await recordMigration(client, 'stage2_usage_limits', 'Stage2: AI使用制限管理');
}
```

---

## 📚 学習のまとめ

### 🎯 **このスクリプトで学んだPostgreSQL技術**

1. **基本概念**
   - SERIAL型による自動増分ID
   - 外部キー制約とCASCADE削除
   - 複合主キーの設計

2. **高度な機能**
   - JSON型によるスキーマレス設計
   - BYTEA型でのバイナリデータ保存
   - CHECK制約による業務ルール強制

3. **運用面**
   - トランザクション管理
   - マイグレーション履歴管理
   - インデックス設計

4. **SQLiteとの違い**
   - サーバー型DBの接続管理
   - より豊富なデータ型
   - 高機能な制約システム

### 🚀 **次のステップ**

1. **Week 2での活用**
   - AI APIとの連携でuser_daily_limitsテーブル使用
   - JSON型データの高度な検索・更新操作

2. **Week 3での発展**
   - より複雑なJOIN操作
   - 統計データの集計クエリ
   - パフォーマンス最適化

3. **最終目標への接続**
   - ストーリー創作ツールでの世界設定管理
   - 複雑なデータ構造の効率的な管理
   - スケーラブルなDB設計の習得

このマイグレーションスクリプトは、PostgreSQL初挑戦から本格的なWebアプリ開発への確実なステップアップを提供します。

頑張って行こうね〜！PostgreSQLマスターへの道のりは着実に進んでるよ〜✨