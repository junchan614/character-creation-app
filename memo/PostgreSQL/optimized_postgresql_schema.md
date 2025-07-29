# 最適化されたPostgreSQLスキーマ設計

## 段階的実装方針

### Stage 1: 最低限動くレベル（Week1）
```sql
-- ユーザーテーブル（シンプル版）
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL可（Google認証時）
    google_id VARCHAR(255) UNIQUE, -- NULL可（従来認証時）
    display_name VARCHAR(255) NOT NULL,
    profile_image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- キャラクターテーブル（基본）
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    character_data JSON NOT NULL,
    ai_generated_image BYTEA,
    is_public BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- いいね機能（シンプル）
CREATE TABLE character_likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, character_id)
);
```

### Stage 2: 実用レベル（Week2-3）
```sql
-- 使用制限管理テーブル（統合版）
CREATE TABLE user_daily_usage (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ai_chat_count INTEGER DEFAULT 0,
    image_generation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, usage_date)
);

-- キャラクター数制限のための制約
CREATE OR REPLACE FUNCTION check_character_limit() 
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM characters WHERE user_id = NEW.user_id) >= 30 THEN
        RAISE EXCEPTION 'キャラクター作成上限（30体）に達しています';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER character_limit_trigger
    BEFORE INSERT ON characters
    FOR EACH ROW
    EXECUTE FUNCTION check_character_limit();
```

## JSON型キャラクター設定の最適構造

### 推奨JSON構造
```json
{
  "基本情報": {
    "名前": "キャラ名",
    "年齢": "20歳",
    "性別": "女性",
    "身長": "165cm",
    "誕生日": "3月15日"
  },
  "外見": {
    "髪色": "黒髪",
    "瞳色": "茶色",
    "体型": "普通",
    "特徴": "眼鏡をかけている",
    "服装": "制服"
  },
  "性格": {
    "基本性格": "内向的",
    "特徴1": "読書好き",
    "特徴2": "優しい",
    "口調": "丁寧語",
    "趣味": "読書、音楽鑑賞"
  },
  "背景": {
    "職業": "学生",
    "出身地": "東京",
    "家族構成": "両親と兄",
    "特技": "ピアノ",
    "好きなもの": "本、コーヒー"
  },
  "設定情報": {
    "作成日": "2024-01-15",
    "バージョン": "1.0",
    "公開設定": "public",
    "タグ": ["学生", "内向的", "読書好き"]
  }
}
```

### JSON型でのクエリ最適化
```sql
-- よく使用されるクエリパターン用のインデックス
CREATE INDEX idx_characters_public 
ON characters USING GIN ((character_data->'設定情報'->>'公開設定'));

CREATE INDEX idx_characters_name 
ON characters USING GIN ((character_data->'基本情報'->>'名前'));

CREATE INDEX idx_characters_tags 
ON characters USING GIN ((character_data->'設定情報'->'タグ'));
```

## BYTEA型画像格納の最適化

### 画像圧縮とサイズ管理
```sql
-- 画像メタデータを追加したテーブル設計
ALTER TABLE characters ADD COLUMN image_metadata JSON;

-- 画像メタデータ例
{
  "file_size": 524288,
  "width": 512,
  "height": 512,
  "format": "PNG",
  "compressed": true,
  "thumbnail_generated": true
}
```

### JavaScript側での画像処理
```javascript
// 画像圧縮処理
const sharp = require('sharp');

async function compressImage(imageBuffer) {
    return await sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside' })
        .png({ quality: 80 })
        .toBuffer();
}

// サムネイル生成
async function generateThumbnail(imageBuffer) {
    return await sharp(imageBuffer)
        .resize(150, 150, { fit: 'cover' })
        .png({ quality: 60 })
        .toBuffer();
}
```

## パフォーマンス最適化戦略

### 必須インデックス（Stage 1）
```sql
-- 基本的なインデックス
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_public ON characters(is_public) WHERE is_public = true;
CREATE INDEX idx_character_likes_character_id ON character_likes(character_id);
CREATE INDEX idx_user_daily_usage_date ON user_daily_usage(user_id, usage_date);
```

### 高度なインデックス（Stage 2）
```sql
-- JSON型の部分インデックス
CREATE INDEX idx_characters_public_json 
ON characters USING GIN ((character_data->'設定情報')) 
WHERE is_public = true;

-- 複合インデックス
CREATE INDEX idx_characters_user_public_created 
ON characters(user_id, is_public, created_at DESC);
```

## データ制約設計

### 基本制約
```sql
-- ユーザー認証方式の制約
ALTER TABLE users ADD CONSTRAINT check_auth_method 
CHECK (
    (password_hash IS NOT NULL AND google_id IS NULL) OR 
    (password_hash IS NULL AND google_id IS NOT NULL)
);

-- 画像サイズ制限（10MB）
ALTER TABLE characters ADD CONSTRAINT check_image_size 
CHECK (octet_length(ai_generated_image) <= 10485760);

-- JSON必須フィールド検証
ALTER TABLE characters ADD CONSTRAINT check_character_data_required 
CHECK (
    character_data ? '基本情報' AND 
    character_data->'基本情報' ? '名前'
);
```

### 使用制限制約
```sql
-- 日次制限チェック
ALTER TABLE user_daily_usage ADD CONSTRAINT check_daily_limits 
CHECK (
    ai_chat_count >= 0 AND ai_chat_count <= 200 AND
    image_generation_count >= 0 AND image_generation_count <= 5
);
```

## 実装手順

### Week 1: 基盤構築
1. 基本4テーブルの作成
2. 基本インデックスの設定
3. 簡単なCRUD操作の実装
4. ユーザー認証の動作確認

### Week 2: 機能拡張
1. JSON型での詳細キャラ設定
2. 画像圧縮・サムネイル機能
3. いいね機能の実装
4. 使用制限管理の実装

### Week 3: 最適化
1. パフォーマンス調整
2. 高度なインデックス追加
3. エラーハンドリング強化
4. データ整合性チェック

## 想定される使用パターンとボトルネック対策

### よくあるクエリパターン
```sql
-- 1. 公開キャラ一覧取得（最もヘビー）
SELECT id, name, character_data->'基本情報'->>'名前' as display_name, 
       likes_count, created_at
FROM characters 
WHERE is_public = true 
ORDER BY created_at DESC 
LIMIT 20;

-- 2. ユーザーのキャラ一覧
SELECT id, name, is_public, likes_count 
FROM characters 
WHERE user_id = $1 
ORDER BY created_at DESC;

-- 3. キャラ詳細とユーザー情報
SELECT c.*, u.display_name as creator_name
FROM characters c
JOIN users u ON c.user_id = u.id
WHERE c.id = $1;
```

### ボトルネック対策
1. **画像取得の分離**: 一覧表示時は画像データを除外
2. **ページネーション**: LIMIT/OFFSETでの効率的な分割
3. **キャッシュ戦略**: Redis併用でよく見られるキャラのキャッシュ
4. **接続プール**: pg-poolでの接続管理

## セキュリティ考慮事項

### SQLインジェクション対策
```javascript
// パラメータ化クエリの徹底
const result = await pool.query(
    'SELECT * FROM characters WHERE user_id = $1 AND name = $2',
    [userId, characterName]
);
```

### JSON型のセキュリティ
```javascript
// JSON入力のサニタイズ
const sanitizeCharacterData = (data) => {
    // 危険なフィールドの除去
    delete data.admin;
    delete data.system;
    
    // データサイズ制限
    if (JSON.stringify(data).length > 10000) {
        throw new Error('キャラクターデータが大きすぎます');
    }
    
    return data;
};
```

## まとめ

この設計により、学習重視・スピード優先の3週間プロジェクトで：
- PostgreSQL初挑戦でも段階的に習得可能
- JSON型とBYTEA型の実用的な活用体験
- SNS機能の基本実装
- 将来の拡張性を保持した設計

を実現できます！💪✨