const jwt = require('jsonwebtoken');

// JWT設定
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
  expiresIn: '24h', // トークンの有効期限
  issuer: 'character-creation-sns',
  audience: 'character-creation-app'
};

// リフレッシュトークン設定
const REFRESH_TOKEN_CONFIG = {
  secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
  expiresIn: '7d' // リフレッシュトークンの有効期限
};

/**
 * JWTトークンを生成
 * @param {Object} payload - トークンに含めるデータ
 * @param {Object} options - JWT生成オプション
 * @returns {string} JWT トークン
 */
const generateToken = (payload, options = {}) => {
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    username: payload.username,
    displayName: payload.displayName,
    authMethod: payload.authMethod, // 'email' or 'google'
    iat: Math.floor(Date.now() / 1000)
  };

  const signOptions = {
    expiresIn: options.expiresIn || JWT_CONFIG.expiresIn,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
    ...options
  };

  return jwt.sign(tokenPayload, JWT_CONFIG.secret, signOptions);
};

/**
 * リフレッシュトークンを生成
 * @param {Object} payload - トークンに含めるデータ
 * @returns {string} リフレッシュトークン
 */
const generateRefreshToken = (payload) => {
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    type: 'refresh'
  };

  return jwt.sign(tokenPayload, REFRESH_TOKEN_CONFIG.secret, {
    expiresIn: REFRESH_TOKEN_CONFIG.expiresIn,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience
  });
};

/**
 * JWTトークンを検証
 * @param {string} token - 検証するトークン
 * @returns {Object} デコードされたトークンデータ
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
    return { success: true, decoded };
  } catch (error) {
    console.log('🔴 JWT verification error:', error.message);
    return { 
      success: false, 
      error: error.message,
      expired: error.name === 'TokenExpiredError'
    };
  }
};

/**
 * リフレッシュトークンを検証
 * @param {string} refreshToken - 検証するリフレッシュトークン
 * @returns {Object} デコードされたトークンデータ
 */
const verifyRefreshToken = (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    });
    return { success: true, decoded };
  } catch (error) {
    console.log('🔴 Refresh token verification error:', error.message);
    return { 
      success: false, 
      error: error.message,
      expired: error.name === 'TokenExpiredError'
    };
  }
};

/**
 * Authorizationヘッダーからトークンを抽出
 * @param {string} authHeader - Authorization ヘッダー
 * @returns {string|null} トークン文字列
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
};

/**
 * トークンペイロード用のユーザーデータを準備
 * @param {Object} user - ユーザーデータ
 * @returns {Object} トークンペイロード
 */
const prepareTokenPayload = (user) => {
  return {
    userId: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    authMethod: user.google_id ? 'google' : 'email',
    profileImageUrl: user.profile_image_url
  };
};

module.exports = {
  JWT_CONFIG,
  REFRESH_TOKEN_CONFIG,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  prepareTokenPayload
};