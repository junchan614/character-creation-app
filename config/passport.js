const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { createOrUpdateGoogleUser } = require('../utils/authUtils');

// Google OAuth Strategy設定
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔍 Google OAuth Profile:', {
      id: profile.id,
      email: profile.emails[0].value,
      displayName: profile.displayName
    });

    // Google認証ユーザーの作成または更新
    const user = await createOrUpdateGoogleUser(profile);
    
    console.log('✅ Google OAuth Success:', user.email);
    return done(null, user);
    
  } catch (error) {
    console.error('🔴 Google OAuth Error:', error);
    return done(error, null);
  }
}));

// セッション設定（軽量化）
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { query } = require('./database');
    const result = await query(
      'SELECT id, username, email, display_name, profile_image_url, google_id FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;