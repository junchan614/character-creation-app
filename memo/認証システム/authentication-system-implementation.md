# キャラメイクSNS認証システム実装ガイド 🔐

## 📖 概要

このメモでは、キャラメイクSNSプロジェクトで実装した**GoogleAuth + 従来認証の併用システム**について詳しく解説します。PostgreSQL + JWT + bcryptを組み合わせた、セキュアで実用的な認証システムです✨

## 🎯 実装した機能

### ✅ 完成済み機能
- **従来認証（メール+パスワード）**: ユーザー登録・ログイン
- **Google OAuth2.0認証**: Googleアカウントでのログイン
- **JWT統合認証**: 両方の認証方式で共通のJWTトークンを発行
- **セキュリティ機能**: bcrypt暗号化、入力バリデーション、エラーハンドリング
- **API使用制限**: 1日200回のAIチャット、5回の画像生成
- **認証ミドルウェア**: 保護されたエンドポイント用のトークン検証

### 📱 利用可能なエンドポイント
```
POST   /auth/register          # 従来認証でのユーザー登録
POST   /auth/login             # 従来認証でのログイン
GET    /auth/google            # Google認証開始
GET    /auth/google/callback   # Google認証コールバック
GET    /auth/me                # 認証状態とユーザー情報取得
POST   /auth/logout            # ログアウト
GET    /auth/check-email       # メールアドレス重複チェック
GET    /auth/check-username    # ユーザー名重複チェック
```

## 🏗️ システム構成

### 📁 ファイル構成
```
/config/
  ├── database.js      # PostgreSQL接続プール設定
  ├── jwt.js          # JWT設定とトークン管理
  └── passport.js     # Google OAuth2.0設定

/middleware/
  └── auth.js         # 認証ミドルウェア各種

/routes/
  └── auth.js         # 認証関連エンドポイント

/utils/
  └── authUtils.js    # 認証処理のユーティリティ関数

/scripts/
  ├── migrate.js      # データベースマイグレーション
  └── test-auth.js    # 認証システムテスト
```

### 🗄️ データベース設計

#### usersテーブル
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),        -- 従来認証用（Google認証時はNULL）
  google_id VARCHAR(255) UNIQUE,     -- Google認証用（従来認証時はNULL）
  display_name VARCHAR(255) NOT NULL,
  profile_image_url TEXT,            -- Googleプロフィール画像
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### user_daily_limitsテーブル（API使用制限管理）
```sql
CREATE TABLE user_daily_limits (
  user_id INTEGER NOT NULL REFERENCES users(id),
  usage_date DATE DEFAULT CURRENT_DATE,
  ai_chat_count INTEGER DEFAULT 0,
  image_generation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);
```

## 🔐 認証フロー詳細

### 🔑 従来認証フロー
1. **ユーザー登録**
   ```javascript
   POST /auth/register
   {
     "username": "testuser",
     "email": "test@example.com", 
     "password": "password123",
     "displayName": "テストユーザー"
   }
   ```

2. **パスワードハッシュ化**
   ```javascript
   const bcrypt = require('bcryptjs');
   const hashedPassword = await bcrypt.hash(password, 12); // 12ラウンド
   ```

3. **ログイン認証**
   ```javascript
   POST /auth/login
   {
     "email": "test@example.com",
     "password": "password123"
   }
   ```

4. **JWT トークン発行**
   ```javascript
   // レスポンス例
   {
     "success": true,
     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
     "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
     "user": {
       "id": 1,
       "username": "testuser",
       "email": "test@example.com",
       "displayName": "テストユーザー",
       "authMethod": "email"
     }
   }
   ```

### 🌐 Google OAuth2.0フロー
1. **認証開始**
   ```
   GET /auth/google
   → Googleの認証画面にリダイレクト
   ```

2. **コールバック処理**
   ```
   GET /auth/google/callback
   → Google認証成功後、ユーザー情報取得
   → データベースに保存または更新
   → JWTトークン生成
   → フロントエンドにリダイレクト
   ```

3. **ユーザー情報の統合**
   ```javascript
   // 既存ユーザーかチェック
   // 1. Google IDで検索
   // 2. メールアドレスで検索  
   // 3. 新規ユーザー作成
   const user = await createOrUpdateGoogleUser(googleProfile);
   ```

## 🛡️ セキュリティ機能

### 🔒 パスワードセキュリティ
```javascript
// 強度チェック
- 8文字以上
- 英字と数字を含む
- bcrypt 12ラウンドハッシュ化

// 実装例
const hasLetter = /[a-zA-Z]/.test(password);
const hasNumber = /[0-9]/.test(password);
if (!hasLetter || !hasNumber) {
  throw new Error('パスワードは英字と数字を含む必要があります');
}
```

### 🎫 JWT設定
```javascript
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',           // 24時間有効
  issuer: 'character-creation-sns',
  audience: 'character-creation-app'
};

// トークンペイロード
{
  userId: user.id,
  email: user.email,
  username: user.username,
  displayName: user.displayName,
  authMethod: 'email' | 'google',  // 認証方式を記録
  iat: timestamp
}
```

### 🚫 API使用制限
```javascript
// 1日の使用制限
const LIMITS = {
  ai_chat: 200,           // AIチャット200回/日
  image_generation: 5     // 画像生成5回/日
};

// ミドルウェアでチェック
app.use('/api/ai-chat', checkApiLimits, checkAiChatLimit);
app.use('/api/generate-image', checkApiLimits, checkImageGenerationLimit);
```

## 🔧 ミドルウェアの使い方

### 🛡️ 認証必須エンドポイント
```javascript
const { authenticateToken } = require('./middleware/auth');

// 使用例
app.get('/api/profile', authenticateToken, (req, res) => {
  // req.user にユーザー情報が設定されている
  res.json({ user: req.user });
});
```

### 🔄 オプショナル認証
```javascript
const { optionalAuth } = require('./middleware/auth');

// ログイン不要だが、ログイン済みなら追加情報を提供
app.get('/api/characters', optionalAuth, (req, res) => {
  if (req.user) {
    // ログイン済みユーザー向けの処理
  } else {
    // 非ログインユーザー向けの処理
  }
});
```

### 📊 API制限チェック
```javascript
const { checkApiLimits, checkAiChatLimit } = require('./middleware/auth');

app.post('/api/ai-chat', 
  authenticateToken,
  checkApiLimits,
  checkAiChatLimit,
  (req, res) => {
    // AI API呼び出し処理
    // req.apiLimits で残り回数確認可能
  }
);
```

## 🧪 テスト方法

### 🔧 認証システムテスト実行
```bash
# 自動テスト実行
node scripts/test-auth.js

# 実行内容
# ✅ データベース接続テスト
# ✅ ユーザー作成テスト  
# ✅ ログイン認証テスト
# ✅ JWT検証テスト
# ✅ エラーハンドリングテスト
```

### 📱 API エンドポイントテスト
```bash
# 1. ユーザー登録
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "displayName": "テストユーザー"
  }'

# 2. ログイン
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# 3. 認証状態確認
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🌍 環境変数設定

### 🔑 必須環境変数
```env
# データベース
DATABASE_URL=postgresql://username:password@host:port/database

# JWT設定
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production

# Google OAuth2.0
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# セッション
SESSION_SECRET=your-session-secret-change-in-production

# フロントエンド URL（Google認証リダイレクト用）
FRONTEND_URL=http://localhost:3000
```

## 🚀 デプロイ考慮事項

### 🔒 プロダクション設定
```javascript
// 1. 環境変数の適切な設定
NODE_ENV=production

// 2. HTTPS必須（特にGoogle OAuth）
// 3. CORS設定の調整
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// 4. セッションクッキーのセキュア化
cookie: {
  secure: process.env.NODE_ENV === 'production', // HTTPS必須
  maxAge: 24 * 60 * 60 * 1000 // 24時間
}
```

### 📈 パフォーマンスポイント
```javascript
// 1. 接続プール最適化
const pool = new Pool({
  max: 20,                    // 最大接続数
  idleTimeoutMillis: 30000,   // アイドルタイムアウト
  connectionTimeoutMillis: 2000 // 接続タイムアウト
});

// 2. インデックス活用
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_user_daily_limits_date ON user_daily_limits(usage_date);
```

## 💡 学習ポイント

### 🎓 今回習得した技術
1. **PostgreSQL基礎**: JSON型、BLOB、インデックス活用
2. **認証システム設計**: 複数認証方式の併用パターン
3. **JWT実装**: セキュアなトークン管理
4. **OAuth2.0**: Google認証の統合
5. **ミドルウェア設計**: 再利用可能な認証処理
6. **API設計**: RESTful認証エンドポイント

### 🔄 次のステップ
1. **Week 2**: AIチャット機能でJWT認証を活用
2. **Week 3**: 画像生成でAPI制限システムを活用
3. **将来**: リフレッシュトークン、パスワードリセット機能

## 🎉 まとめ

GoogleAuth + 従来認証の併用システムが完成しました〜✨ 

**Week 1の完了基準「GoogleAuthとメール認証両方でログインができる」を100%達成！**

- ✅ セキュアなパスワードハッシュ化
- ✅ JWT統合認証システム
- ✅ PostgreSQLでの効率的なデータ管理
- ✅ API使用制限システム
- ✅ 包括的なエラーハンドリング

これで Week 2のAIチャット機能、Week 3の画像生成機能で活用する認証基盤が整いました💪

次回は「ChatGPT風AIチャット機能」の実装で、この認証システムを活用していきます〜🚀