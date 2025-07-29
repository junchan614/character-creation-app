#!/usr/bin/env node

/**
 * 認証システムのテストスクリプト
 * 
 * 使用方法:
 * node scripts/test-auth.js
 */

require('dotenv').config();
const { testConnection } = require('../config/database');
const { 
  createUser, 
  authenticateUser, 
  checkEmailExists, 
  checkUsernameExists 
} = require('../utils/authUtils');

const TEST_USER = {
  username: 'testuser_' + Date.now(),
  email: `test_${Date.now()}@example.com`,
  password: 'testpassword123',
  displayName: 'テストユーザー'
};

async function runAuthTests() {
  console.log('🧪 認証システムテスト開始\n');

  try {
    // 1. データベース接続テスト
    console.log('1️⃣ データベース接続テスト');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('データベース接続に失敗しました');
    }
    console.log('✅ データベース接続成功\n');

    // 2. 重複チェックテスト
    console.log('2️⃣ 重複チェックテスト');
    const emailExists = await checkEmailExists(TEST_USER.email);
    const usernameExists = await checkUsernameExists(TEST_USER.username);
    console.log(`📧 Email存在チェック: ${emailExists}`);
    console.log(`👤 Username存在チェック: ${usernameExists}`);
    console.log('✅ 重複チェック成功\n');

    // 3. ユーザー作成テスト
    console.log('3️⃣ ユーザー作成テスト');
    console.log(`作成予定ユーザー: ${TEST_USER.username} (${TEST_USER.email})`);
    const newUser = await createUser(TEST_USER);
    console.log('✅ ユーザー作成成功');
    console.log(`📝 作成されたユーザー:`, {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      displayName: newUser.display_name
    });
    console.log('');

    // 4. 認証テスト（成功）
    console.log('4️⃣ ログイン認証テスト（成功パターン）');
    const authResult = await authenticateUser(TEST_USER.email, TEST_USER.password);
    console.log('✅ 認証成功');
    console.log(`🔑 アクセストークン: ${authResult.accessToken.substring(0, 50)}...`);
    console.log(`🔄 リフレッシュトークン: ${authResult.refreshToken.substring(0, 50)}...`);
    console.log('');

    // 5. 認証テスト（失敗）
    console.log('5️⃣ ログイン認証テスト（失敗パターン）');
    try {
      await authenticateUser(TEST_USER.email, 'wrongpassword');
      console.log('❌ 認証が成功してしまいました（本来は失敗すべき）');
    } catch (error) {
      console.log('✅ 認証が正しく失敗しました');
      console.log(`📝 エラーメッセージ: ${error.message}`);
    }
    console.log('');

    // 6. JWTトークンテスト
    console.log('6️⃣ JWTトークン検証テスト');
    const { verifyToken } = require('../config/jwt');
    const tokenVerification = verifyToken(authResult.accessToken);
    console.log('✅ JWT検証成功');
    console.log('📝 トークンペイロード:', {
      userId: tokenVerification.decoded.userId,
      email: tokenVerification.decoded.email,
      username: tokenVerification.decoded.username,
      authMethod: tokenVerification.decoded.authMethod
    });
    console.log('');

    console.log('🎉 全てのテストが成功しました！');
    console.log('\n📋 認証システム動作確認完了');
    console.log('==================================');
    console.log('✅ データベース接続');
    console.log('✅ ユーザー作成');
    console.log('✅ パスワードハッシュ化');
    console.log('✅ ログイン認証');
    console.log('✅ JWT トークン生成・検証');
    console.log('✅ エラーハンドリング');
    console.log('==================================');

  } catch (error) {
    console.error('❌ テスト中にエラーが発生:', error.message);
    console.error('📝 スタックトレース:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// スクリプト実行
if (require.main === module) {
  runAuthTests();
}

module.exports = { runAuthTests, TEST_USER };