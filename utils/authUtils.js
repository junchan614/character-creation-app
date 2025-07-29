const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { generateToken, generateRefreshToken, prepareTokenPayload } = require('../config/jwt');

/**
 * パスワードのハッシュ化
 * @param {string} password - ハッシュ化するパスワード
 * @returns {Promise<string>} ハッシュ化されたパスワード
 */
const hashPassword = async (password) => {
  const saltRounds = 12; // 強固なハッシュ化のため12ラウンド
  return await bcrypt.hash(password, saltRounds);
};

/**
 * パスワード検証
 * @param {string} password - 入力されたパスワード
 * @param {string} hashedPassword - ハッシュ化されたパスワード
 * @returns {Promise<boolean>} パスワードが一致するかどうか
 */
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * メールアドレスの重複チェック
 * @param {string} email - チェックするメールアドレス
 * @param {number} excludeUserId - 除外するユーザーID（更新時に使用）
 * @returns {Promise<boolean>} 重複している場合true
 */
const checkEmailExists = async (email, excludeUserId = null) => {
  let queryText = 'SELECT id FROM users WHERE email = $1';
  let params = [email];

  if (excludeUserId) {
    queryText += ' AND id != $2';
    params.push(excludeUserId);
  }

  const result = await query(queryText, params);
  return result.rows.length > 0;
};

/**
 * ユーザー名の重複チェック
 * @param {string} username - チェックするユーザー名
 * @param {number} excludeUserId - 除外するユーザーID（更新時に使用）
 * @returns {Promise<boolean>} 重複している場合true
 */
const checkUsernameExists = async (username, excludeUserId = null) => {
  let queryText = 'SELECT id FROM users WHERE username = $1';
  let params = [username];

  if (excludeUserId) {
    queryText += ' AND id != $2';
    params.push(excludeUserId);
  }

  const result = await query(queryText, params);
  return result.rows.length > 0;
};

/**
 * ユーザー作成（従来認証用）
 * @param {Object} userData - ユーザーデータ
 * @returns {Promise<Object>} 作成されたユーザー情報
 */
const createUser = async (userData) => {
  const { username, email, password, displayName } = userData;

  // 入力バリデーション
  if (!username || !email || !password || !displayName) {
    throw new Error('必須項目が不足しています');
  }

  // メールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('メールアドレスの形式が正しくありません');
  }

  // パスワード強度チェック
  if (password.length < 8) {
    throw new Error('パスワードは8文字以上で入力してください');
  }

  return await transaction(async (client) => {
    // 重複チェック
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      throw new Error('このメールアドレスは既に使用されています');
    }

    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      throw new Error('このユーザー名は既に使用されています');
    }

    // パスワードハッシュ化
    const hashedPassword = await hashPassword(password);

    // ユーザー作成
    const result = await client.query(
      `INSERT INTO users (username, email, password_hash, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, username, email, display_name, created_at`,
      [username, email, hashedPassword, displayName]
    );

    const newUser = result.rows[0];
    console.log(`✅ New user created: ${newUser.username} (${newUser.email})`);

    return newUser;
  });
};

/**
 * Google認証ユーザーの作成または更新
 * @param {Object} googleProfile - Google認証プロファイル
 * @returns {Promise<Object>} ユーザー情報
 */
const createOrUpdateGoogleUser = async (googleProfile) => {
  const { id: googleId, emails, displayName, photos } = googleProfile;
  const email = emails[0].value;
  const profileImageUrl = photos && photos[0] ? photos[0].value : null;

  return await transaction(async (client) => {
    // 既存ユーザーをGoogle IDで検索
    let result = await client.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );

    if (result.rows.length > 0) {
      // 既存ユーザーの情報を更新
      const updateResult = await client.query(
        `UPDATE users 
         SET display_name = $1, profile_image_url = $2, updated_at = NOW()
         WHERE google_id = $3
         RETURNING id, username, email, display_name, profile_image_url, google_id, created_at`,
        [displayName, profileImageUrl, googleId]
      );
      
      console.log(`✅ Google user updated: ${updateResult.rows[0].email}`);
      return updateResult.rows[0];
    }

    // メールアドレスで既存ユーザーを検索
    result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length > 0) {
      // 既存のメールアドレスのユーザーにGoogle IDを追加
      const updateResult = await client.query(
        `UPDATE users 
         SET google_id = $1, display_name = $2, profile_image_url = $3, updated_at = NOW()
         WHERE email = $4
         RETURNING id, username, email, display_name, profile_image_url, google_id, created_at`,
        [googleId, displayName, profileImageUrl, email]
      );
      
      console.log(`✅ Existing user linked with Google: ${updateResult.rows[0].email}`);
      return updateResult.rows[0];
    }

    // 新規ユーザー作成
    const username = `user_${googleId.slice(-8)}`; // Google IDの末尾8文字を使用
    const insertResult = await client.query(
      `INSERT INTO users (username, email, google_id, display_name, profile_image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, username, email, display_name, profile_image_url, google_id, created_at`,
      [username, email, googleId, displayName, profileImageUrl]
    );

    console.log(`✅ New Google user created: ${insertResult.rows[0].email}`);
    return insertResult.rows[0];
  });
};

/**
 * ユーザー認証（従来認証）
 * @param {string} email - メールアドレス
 * @param {string} password - パスワード
 * @returns {Promise<Object>} 認証結果とトークン
 */
const authenticateUser = async (email, password) => {
  if (!email || !password) {
    throw new Error('メールアドレスとパスワードが必要です');
  }

  // ユーザー検索
  const result = await query(
    'SELECT id, username, email, password_hash, display_name, profile_image_url, google_id FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('メールアドレスまたはパスワードが正しくありません');
  }

  const user = result.rows[0];

  // パスワードが設定されていない場合（Google認証のみのユーザー）
  if (!user.password_hash) {
    throw new Error('このアカウントはGoogleログインでのみ利用できます');
  }

  // パスワード検証
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('メールアドレスまたはパスワードが正しくありません');
  }

  // JWTトークン生成
  const tokenPayload = prepareTokenPayload({ ...user, authMethod: 'email' });
  const accessToken = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  console.log(`✅ User authenticated: ${user.email} (email)`);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url,
      authMethod: 'email'
    },
    accessToken,
    refreshToken
  };
};

/**
 * Google認証ユーザーのトークン生成
 * @param {Object} user - ユーザー情報
 * @returns {Object} トークン情報
 */
const generateGoogleAuthTokens = (user) => {
  const tokenPayload = prepareTokenPayload({ ...user, authMethod: 'google' });
  const accessToken = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  console.log(`✅ Google auth tokens generated: ${user.email}`);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url,
      authMethod: 'google'
    },
    accessToken,
    refreshToken
  };
};

/**
 * API使用回数を更新
 * @param {number} userId - ユーザーID
 * @param {string} apiType - API種別（'ai_chat' または 'image_generation'）
 * @returns {Promise<void>}
 */
const updateApiUsage = async (userId, apiType) => {
  const today = new Date().toISOString().split('T')[0];
  const columnName = apiType === 'ai_chat' ? 'ai_chat_count' : 'image_generation_count';

  await query(
    `INSERT INTO user_daily_limits (user_id, usage_date, ${columnName})
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, usage_date)
     DO UPDATE SET ${columnName} = user_daily_limits.${columnName} + 1`,
    [userId, today]
  );

  console.log(`📊 API usage updated: User ${userId}, ${apiType}, Date ${today}`);
};

module.exports = {
  hashPassword,
  verifyPassword,
  checkEmailExists,
  checkUsernameExists,
  createUser,
  createOrUpdateGoogleUser,
  authenticateUser,
  generateGoogleAuthTokens,
  updateApiUsage
};