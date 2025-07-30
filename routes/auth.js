const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { 
  createUser, 
  authenticateUser, 
  checkEmailExists, 
  checkUsernameExists,
  generateGoogleAuthTokens
} = require('../utils/authUtils');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /auth/register
 * 従来認証でのユーザー登録
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    // 入力バリデーション
    if (!username || !email || !password || !displayName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'ユーザー名、メールアドレス、パスワード、表示名は必須です'
      });
    }

    // 詳細バリデーション
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        error: 'Invalid username',
        message: 'ユーザー名は3文字以上20文字以下で入力してください'
      });
    }

    if (displayName.length < 1 || displayName.length > 50) {
      return res.status(400).json({
        error: 'Invalid display name',
        message: '表示名は1文字以上50文字以下で入力してください'
      });
    }

    // パスワード強度チェック
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'パスワードは8文字以上で入力してください'
      });
    }

    // 英数字を含むかチェック
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'パスワードは英字と数字を含む必要があります'
      });
    }

    // ユーザー作成
    const newUser = await createUser({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName.trim()
    });

    console.log(`🎉 User registered successfully: ${newUser.email}`);

    res.status(201).json({
      success: true,
      message: 'ユーザー登録が完了しました',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        displayName: newUser.display_name,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('🔴 Registration error:', error.message);
    
    // エラーメッセージの分類
    if (error.message.includes('既に使用されています') || 
        error.message.includes('必須項目') ||
        error.message.includes('メールアドレスの形式') ||
        error.message.includes('パスワードは8文字以上')) {
      return res.status(400).json({
        error: 'Registration failed',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'ユーザー登録中にエラーが発生しました'
    });
  }
});

/**
 * POST /auth/login
 * 従来認証でのログイン
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 入力バリデーション
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'メールアドレスとパスワードが必要です'
      });
    }

    // ユーザー認証
    const authResult = await authenticateUser(email.trim().toLowerCase(), password);

    console.log(`🎉 User logged in successfully: ${authResult.user.email}`);

    res.json({
      success: true,
      message: 'ログインに成功しました',
      ...authResult
    });

  } catch (error) {
    console.error('🔴 Login error:', error.message);
    
    // セキュリティのため、詳細なエラー情報は返さない
    if (error.message.includes('正しくありません') ||
        error.message.includes('Googleログイン')) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'ログイン処理中にエラーが発生しました'
    });
  }
});

/**
 * GET /auth/me
 * 認証状態とユーザー情報を取得
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
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

/**
 * POST /auth/logout
 * ログアウト（現在はトークンのクライアント側削除を推奨）
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    console.log(`🚪 User logged out: ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'ログアウトしました'
    });
  } catch (error) {
    console.error('🔴 Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'ログアウト処理中にエラーが発生しました'
    });
  }
});

/**
 * GET /auth/check-email
 * メールアドレスの重複チェック
 */
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'メールアドレスが必要です'
      });
    }

    const exists = await checkEmailExists(email.trim().toLowerCase());
    
    res.json({
      exists,
      message: exists ? 'このメールアドレスは既に使用されています' : 'このメールアドレスは使用可能です'
    });

  } catch (error) {
    console.error('🔴 Email check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'メールアドレスチェック中にエラーが発生しました'
    });
  }
});

/**
 * GET /auth/check-username
 * ユーザー名の重複チェック
 */
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({
        error: 'Missing username',
        message: 'ユーザー名が必要です'
      });
    }

    const exists = await checkUsernameExists(username.trim());
    
    res.json({
      exists,
      message: exists ? 'このユーザー名は既に使用されています' : 'このユーザー名は使用可能です'
    });

  } catch (error) {
    console.error('🔴 Username check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'ユーザー名チェック中にエラーが発生しました'
    });
  }
});

/**
 * GET /auth/google
 * Google OAuth認証開始
 */
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

/**
 * GET /auth/google/callback
 * Google OAuth認証コールバック
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login?error=google_auth_failed',
    session: false 
  }),
  async (req, res) => {
    try {
      // Google認証成功後、JWTトークンを生成
      const tokenData = generateGoogleAuthTokens(req.user);
      
      console.log(`🎉 Google OAuth Success: ${req.user.email}`);
      
      // フロントエンドにリダイレクト（トークンをクエリパラメータで渡す）
      const redirectUrl = process.env.FRONTEND_URL || `https://${req.get('host')}`;
      const tokenParams = new URLSearchParams({
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
        user: JSON.stringify(tokenData.user)
      });
      
      res.redirect(`${redirectUrl}/test-auth.html?${tokenParams.toString()}`);
      
    } catch (error) {
      console.error('🔴 Google OAuth callback error:', error);
      res.redirect('/login?error=token_generation_failed');
    }
  }
);

/**
 * POST /auth/google/token
 * Google認証後のトークン取得（SPA用）
 */
router.post('/google/token', async (req, res) => {
  try {
    const { googleToken } = req.body;
    
    if (!googleToken) {
      return res.status(400).json({
        error: 'Missing google token',
        message: 'Googleトークンが必要です'
      });
    }

    // Google tokenの検証は省略（実際のプロダクションでは実装が必要）
    // ここでは簡単な実装として、フロントエンドからの認証情報を信頼する
    
    res.json({
      success: true,
      message: 'Google認証APIエンドポイント（実装予定）'
    });
    
  } catch (error) {
    console.error('🔴 Google token verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Google認証処理中にエラーが発生しました'
    });
  }
});

module.exports = router;