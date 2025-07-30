# /auth/meエンドポイント詳細解説

## 📋 概要

`/auth/me`エンドポイントは、現在ログインしているユーザーの認証状態と基本情報を取得するためのAPIエンドポイントです。JWT認証システムにおいて、「今ログインしているのは誰か？」を確認する重要な役割を担っています。

## 🎯 基本概念：なぜ/auth/meが必要なのか

### Web認証の基本的な流れ
1. **ログイン**: ユーザーがメール/パスワードでログインし、JWTトークンを受け取る
2. **トークン保存**: ブラウザのlocalStorageにトークンを保存
3. **認証確認**: ページをリロードした時、「まだログイン中？」を確認する必要がある
4. **/auth/me呼び出し**: 保存されたトークンが有効か、ユーザー情報を取得

### なぜ必要？
- **ページリロード対応**: ブラウザを更新しても、ログイン状態を維持したい
- **セキュリティ確認**: トークンが期限切れや無効になっていないかチェック
- **ユーザー情報取得**: プロフィール表示やUI制御に必要な情報を取得
- **アクセス制御**: ログイン必須ページで認証状態を確認

## 🔄 JWT認証における役割

### 認証フローでの位置づけ
```
1. ログイン → JWTトークン発行
2. トークンをlocalStorageに保存
3. ページアクセス時 → /auth/meでトークン検証
4. 有効なら → ユーザー情報取得・画面表示
5. 無効なら → ログイン画面にリダイレクト
```

### 他のエンドポイントとの違い
- **POST /auth/login**: 認証情報でログインし、トークンを発行
- **GET /auth/me**: 既存のトークンで認証状態を確認
- **POST /auth/logout**: ログアウト処理（トークン削除）

## ⚙️ 具体的な動作フロー

### 1. リクエスト段階
```javascript
// フロントエンドからのリクエスト例
fetch('/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  }
})
```

### 2. ミドルウェア処理（middleware/auth.js）
```javascript
const authenticateToken = async (req, res, next) => {
  // 1. Authorizationヘッダーからトークン抽出
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  // 2. トークンが存在するかチェック
  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      message: 'アクセストークンが必要です'
    });
  }

  // 3. JWTトークンの署名・期限を検証
  const verification = verifyToken(token);
  
  // 4. PostgreSQLからユーザー情報を取得
  const userResult = await query(
    'SELECT id, username, email, display_name, profile_image_url, google_id, created_at FROM users WHERE id = $1',
    [verification.decoded.userId]
  );

  // 5. req.userにユーザー情報を設定
  req.user = {
    ...userResult.rows[0],
    authMethod: verification.decoded.authMethod
  };

  next(); // 次の処理（routes/auth.js）に進む
};
```

### 3. エンドポイント処理（routes/auth.js）
```javascript
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // ミドルウェアで設定されたreq.userを返す
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        displayName: req.user.display_name,
        profileImageUrl: req.user.profile_image_url,
        authMethod: req.user.authMethod,
        createdAt: req.user.created_at
      }
    });
  } catch (error) {
    console.error('🔴 User info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'ユーザー情報取得中にエラーが発生しました'
    });
  }
});
```

## 📤 レスポンスパターン

### 成功時（ログイン済み）
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "displayName": "テストユーザー",
    "profileImageUrl": null,
    "authMethod": "traditional",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### 失敗時（未ログイン・トークンなし）
```json
{
  "error": "Access token required",
  "message": "アクセストークンが必要です"
}
```

### 失敗時（トークン無効・期限切れ）
```json
{
  "error": "Invalid token",
  "message": "トークンの期限が切れています",
  "expired": true
}
```

### 失敗時（ユーザーが存在しない）
```json
{
  "error": "User not found",
  "message": "ユーザーが見つかりません"
}
```

### 失敗時（サーバーエラー）
```json
{
  "error": "Internal server error",
  "message": "ユーザー情報取得中にエラーが発生しました"
}
```

## 💻 実装コードの詳細解説

### middleware/auth.js の重要ポイント

#### 1. トークン抽出処理
```javascript
const authHeader = req.headers.authorization;
const token = extractTokenFromHeader(authHeader);
```
- `Authorization: Bearer <token>`形式からトークン部分だけを抽出
- 大文字小文字の区別やスペースの処理も考慮

#### 2. JWT検証処理
```javascript
const verification = verifyToken(token);
if (!verification.success) {
  // トークンが無効または期限切れ
  return res.status(401).json({...});
}
```
- JWT署名の検証（改ざんチェック）
- 有効期限の確認
- ペイロードの復号化

#### 3. PostgreSQL連携
```javascript
const userResult = await query(
  'SELECT id, username, email, display_name, profile_image_url, google_id, created_at FROM users WHERE id = $1',
  [verification.decoded.userId]
);
```
- JWTに含まれるuserIdでデータベース検索
- パスワードハッシュは除外（セキュリティ）
- Google認証情報も取得

### routes/auth.js の重要ポイント

#### 1. ミドルウェア連携
```javascript
router.get('/me', authenticateToken, async (req, res) => {
```
- `authenticateToken`ミドルウェアが先に実行される
- ミドルウェアで認証が成功した場合のみ、このコードが実行される

#### 2. レスポンス整形
```javascript
res.json({
  success: true,
  user: {
    id: req.user.id,
    username: req.user.username,
    // ...必要な情報だけを選択
  }
});
```
- フロントエンドが使いやすい形式に整形
- 機密情報（パスワード等）は除外
- 一貫性のあるレスポンス形式

## 🌐 フロントエンドでの活用方法

### 基本的な使用例
```javascript
// ページ読み込み時の認証チェック
async function checkAuthStatus() {
  const token = localStorage.getItem('accessToken');
  
  if (!token) {
    // トークンがない場合はログイン画面へ
    window.location.href = '/login';
    return;
  }

  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      // ユーザー情報を画面に表示
      displayUserInfo(data.user);
    } else {
      // 認証失敗の場合
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('認証チェックエラー:', error);
    window.location.href = '/login';
  }
}

// ユーザー情報表示関数
function displayUserInfo(user) {
  document.getElementById('username').textContent = user.displayName;
  document.getElementById('email').textContent = user.email;
  
  // Google認証の場合はプロフィール画像を表示
  if (user.profileImageUrl) {
    document.getElementById('avatar').src = user.profileImageUrl;
  }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', checkAuthStatus);
```

### エラーハンドリング付きの実装
```javascript
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  // 401エラーの場合は認証切れ
  if (response.status === 401) {
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
    return;
  }

  return response;
}

// 使用例
async function getUserProfile() {
  try {
    const response = await fetchWithAuth('/auth/me');
    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('プロフィール取得エラー:', error);
  }
}
```

### React/Vue.jsでの活用例
```javascript
// React Hook例
import { useState, useEffect } from 'react';

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('accessToken');
      }
    } catch (error) {
      console.error('認証チェックエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  return { user, loading, checkAuth };
}

// コンポーネントでの使用
function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginPage />;
  
  return <Dashboard user={user} />;
}
```

## 🔐 セキュリティ面での重要性

### なぜ重要なのか？

#### 1. トークン有効性の確認
- JWTトークンは期限があるため、定期的な確認が必要
- 無効なトークンでのアクセスを防止
- セキュリティ違反の早期発見

#### 2. ユーザー情報の最新化
- データベースから最新のユーザー情報を取得
- アカウント停止や権限変更の反映
- プロフィール変更の即座な反映

#### 3. 不正アクセスの防止
- 改ざんされたトークンの検出
- 他人のトークンを使った不正アクセスの防止
- セッションハイジャック対策

### セキュリティ対策の実装

#### 1. トークン検証の徹底
```javascript
// JWT署名検証（改ざんチェック）
const verification = verifyToken(token);
if (!verification.success) {
  return res.status(401).json({
    error: 'Invalid token',
    message: 'トークンが無効です'
  });
}
```

#### 2. データベース連携による最新情報確認
```javascript
// JWTのuserIdでDB検索
const userResult = await query(
  'SELECT ... FROM users WHERE id = $1',
  [verification.decoded.userId]
);

// ユーザーが存在しない場合（削除された等）
if (userResult.rows.length === 0) {
  return res.status(401).json({
    error: 'User not found',
    message: 'ユーザーが見つかりません'
  });
}
```

#### 3. 適切なエラーレスポンス
```javascript
// セキュリティ情報の漏洩を防ぐため、詳細すぎる情報は返さない
if (!verification.success) {
  const statusCode = verification.expired ? 401 : 401;
  return res.status(statusCode).json({
    error: 'Invalid token',
    message: verification.expired ? 
      'トークンの期限が切れています' : 
      'トークンが無効です',
    expired: verification.expired
  });
}
```

## 🔧 トラブルシューティング

### よくあるエラーと対処法

#### 1. "Access token required"エラー
**原因**: Authorizationヘッダーが設定されていない
```javascript
// ❌ 間違った例
fetch('/auth/me')

// ✅ 正しい例
fetch('/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
})
```

#### 2. "Invalid token"エラー
**原因**: トークンが無効または期限切れ
```javascript
// 対処法：ログイン画面にリダイレクト
if (response.status === 401) {
  localStorage.removeItem('accessToken');
  window.location.href = '/login';
}
```

#### 3. "User not found"エラー
**原因**: JWTのuserIdに対応するユーザーがDBに存在しない
```javascript
// 対処法：データ整合性の確認
// - ユーザーが削除されている可能性
// - データベースの問題
// - JWTペイロードの改ざん
```

#### 4. CORSエラー
**原因**: フロントエンドとバックエンドのドメインが異なる
```javascript
// server.js で CORS 設定
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

#### 5. ネットワークエラー
**原因**: サーバーが起動していない、URLが間違っている
```javascript
// デバッグ用のログ出力
try {
  const response = await fetch('/auth/me', { ... });
  console.log('Response status:', response.status);
} catch (error) {
  console.error('Network error:', error);
  // フォールバック処理
}
```

### デバッグのコツ

#### 1. ブラウザの開発者ツール活用
```javascript
// Network タブでリクエスト・レスポンスを確認
// Console タブでエラーメッセージを確認
// Application タブでlocalStorageの内容を確認
```

#### 2. サーバーサイドのログ確認
```javascript
// middleware/auth.js に詳細ログを追加
console.log('Token:', token);
console.log('Verification result:', verification);
console.log('User query result:', userResult);
```

#### 3. 段階的なテスト
```javascript
// 1. トークンの存在確認
console.log('Token exists:', !!localStorage.getItem('accessToken'));

// 2. リクエストヘッダー確認
console.log('Headers:', {
  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
});

// 3. レスポンス詳細確認
const response = await fetch('/auth/me', { ... });
console.log('Status:', response.status);
console.log('Response:', await response.json());
```

## 🎓 学習のポイント

### PostgreSQL初心者向けのポイント

#### 1. SQLクエリの理解
```sql
-- ユーザー情報取得クエリ
SELECT id, username, email, display_name, profile_image_url, google_id, created_at 
FROM users 
WHERE id = $1
```
- `$1`はプレースホルダー（SQLインジェクション対策）
- パスワードハッシュは除外（セキュリティ）
- 必要な項目のみを選択（効率化）

#### 2. データベース連携パターン
```javascript
// 基本的なクエリ実行パターン
const { query } = require('../config/database');

const userResult = await query(
  'SELECT ... FROM users WHERE id = $1',
  [userId] // パラメータ配列
);

// 結果の取得
if (userResult.rows.length > 0) {
  const user = userResult.rows[0];
  // ユーザーデータの処理
}
```

#### 3. エラーハンドリング
```javascript
try {
  const userResult = await query(...);
  // 成功時の処理
} catch (error) {
  console.error('Database error:', error);
  // エラー時の処理
}
```

### Web開発パターンの習得

#### 1. ミドルウェアの概念
```javascript
// ミドルウェアの流れ
app.get('/auth/me', 
  authenticateToken,  // 1. 認証チェック
  (req, res) => {     // 2. メイン処理
    // req.user が使用可能
  }
);
```

#### 2. RESTful API設計
```
GET /auth/me      - 現在のユーザー情報取得
POST /auth/login  - ログイン処理
POST /auth/logout - ログアウト処理
```

#### 3. エラーレスポンスの統一
```javascript
// 一貫性のあるエラー形式
{
  "error": "Error type",
  "message": "ユーザー向けメッセージ",
  "details": "詳細情報（開発用）"
}
```

## 📚 まとめ

`/auth/me`エンドポイントは、JWT認証システムの中核を担う重要なAPIです。

### 主な役割
1. **認証状態の確認**: ログイン済みかどうかの判定
2. **ユーザー情報の取得**: プロフィール表示に必要な情報提供
3. **セキュリティの維持**: トークンの有効性確認

### 技術的なポイント
1. **ミドルウェアパターン**: 認証ロジックの再利用
2. **PostgreSQL連携**: 最新ユーザー情報の取得
3. **エラーハンドリング**: 適切なレスポンス返却

### 実用的な価値
1. **SPAでの必須機能**: ページリロード時の状態維持
2. **セキュリティ強化**: 不正アクセスの防止
3. **ユーザー体験向上**: シームレスなログイン状態の維持

PostgreSQL初挑戦の方にとって、このエンドポイントはデータベース連携とWeb認証の実用的なパターンを学ぶ絶好の教材です。JWT認証の理解を深めながら、実際のWebアプリケーションでの活用方法を習得していきましょう💪✨