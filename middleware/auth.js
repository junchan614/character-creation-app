const { verifyToken, extractTokenFromHeader } = require('../config/jwt');
const { query } = require('../config/database');

/**
 * JWT認証ミドルウェア
 * トークンを検証し、ユーザー情報をreq.userに設定
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'アクセストークンが必要です'
      });
    }

    const verification = verifyToken(token);
    
    if (!verification.success) {
      const statusCode = verification.expired ? 401 : 401;
      return res.status(statusCode).json({
        error: 'Invalid token',
        message: verification.expired ? 'トークンの期限が切れています' : 'トークンが無効です',
        expired: verification.expired
      });
    }

    // データベースからユーザー情報を取得
    const userResult = await query(
      'SELECT id, username, email, display_name, profile_image_url, google_id, created_at FROM users WHERE id = $1',
      [verification.decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found',
        message: 'ユーザーが見つかりません'
      });
    }

    // req.userにユーザー情報を設定
    req.user = {
      ...userResult.rows[0],
      authMethod: verification.decoded.authMethod
    };

    console.log(`✅ Authenticated user: ${req.user.username} (${req.user.authMethod})`);
    next();

  } catch (error) {
    console.error('🔴 Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: '認証処理中にエラーが発生しました'
    });
  }
};

/**
 * オプショナル認証ミドルウェア
 * トークンがある場合は認証、ない場合はreq.userをnullにして続行
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      req.user = null;
      return next();
    }

    const verification = verifyToken(token);
    
    if (!verification.success) {
      req.user = null;
      return next();
    }

    // データベースからユーザー情報を取得
    const userResult = await query(
      'SELECT id, username, email, display_name, profile_image_url, google_id, created_at FROM users WHERE id = $1',
      [verification.decoded.userId]
    );

    if (userResult.rows.length === 0) {
      req.user = null;
      return next();
    }

    req.user = {
      ...userResult.rows[0],
      authMethod: verification.decoded.authMethod
    };

    console.log(`✅ Optional auth - user: ${req.user.username}`);
    next();

  } catch (error) {
    console.error('🔴 Optional authentication error:', error);
    req.user = null;
    next();
  }
};

/**
 * 管理者権限チェックミドルウェア
 * (将来の拡張用 - 現在は使用しない)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: '認証が必要です'
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({
      error: 'Admin access required',
      message: '管理者権限が必要です'
    });
  }

  next();
};

/**
 * レート制限チェックミドルウェア
 * API使用制限をチェック
 */
const checkApiLimits = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: '認証が必要です'
      });
    }

    // 今日の使用回数をチェック
    const today = new Date().toISOString().split('T')[0];
    const limitsResult = await query(
      `SELECT ai_chat_count, image_generation_count 
       FROM user_daily_limits 
       WHERE user_id = $1 AND usage_date = $2`,
      [req.user.id, today]
    );

    let limits = { ai_chat_count: 0, image_generation_count: 0 };
    if (limitsResult.rows.length > 0) {
      limits = limitsResult.rows[0];
    }

    // API制限設定
    const LIMITS = {
      ai_chat: 200,
      image_generation: 5
    };

    req.apiLimits = {
      aiChat: {
        used: limits.ai_chat_count,
        limit: LIMITS.ai_chat,
        remaining: LIMITS.ai_chat - limits.ai_chat_count
      },
      imageGeneration: {
        used: limits.image_generation_count,
        limit: LIMITS.image_generation,
        remaining: LIMITS.image_generation - limits.image_generation_count
      }
    };

    next();

  } catch (error) {
    console.error('🔴 API limits check error:', error);
    res.status(500).json({
      error: 'Limits check failed',
      message: 'API制限チェック中にエラーが発生しました'
    });
  }
};

/**
 * AI API使用制限チェック
 */
const checkAiChatLimit = (req, res, next) => {
  if (!req.apiLimits || req.apiLimits.aiChat.remaining <= 0) {
    return res.status(429).json({
      error: 'AI chat limit exceeded',
      message: 'AIチャットの1日の使用制限に達しました',
      limits: req.apiLimits?.aiChat
    });
  }
  next();
};

/**
 * 画像生成API使用制限チェック
 */
const checkImageGenerationLimit = (req, res, next) => {
  if (!req.apiLimits || req.apiLimits.imageGeneration.remaining <= 0) {
    return res.status(429).json({
      error: 'Image generation limit exceeded',
      message: '画像生成の1日の使用制限に達しました',
      limits: req.apiLimits?.imageGeneration
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  checkApiLimits,
  checkAiChatLimit,
  checkImageGenerationLimit
};