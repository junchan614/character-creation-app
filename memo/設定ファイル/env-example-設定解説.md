# .env.example ファイルの詳細解説

## 目的
キャラメイクSNSアプリで使用する環境変数のテンプレートファイル。
本番運用時の機密情報（APIキー、データベース認証情報）を安全に管理するための設定項目を定義している。

## ファイルの役割
- **環境変数テンプレート**: 実際の `.env` ファイル作成時の参考資料
- **設定項目のガイド**: 必要な設定項目とその形式を明示
- **チーム開発サポート**: 新メンバーが環境構築時に参照可能
- **セキュリティ対策**: 実際の機密情報をコードに含めない仕組み

## 主要な設定項目解説

### 1. PostgreSQL接続設定（Database Configuration）

```bash
# Railway PostgreSQL接続情報
DATABASE_URL=postgresql://username:password@host:port/database
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
```

**解説**:
- `DATABASE_URL`: RailwayのPostgreSQLサービスが提供する完全な接続文字列
- `DB_HOST`: PostgreSQLサーバーのホスト名（Railwayが自動割り当て）
- `DB_PORT`: PostgreSQLの標準ポート（通常5432）
- `DB_NAME`: 使用するデータベース名
- `DB_USER`: データベースユーザー名
- `DB_PASSWORD`: データベースパスワード

**学習ポイント**: 
PostgreSQLでは`DATABASE_URL`形式が一般的。Node.jsの`pg`ライブラリは自動的にこの形式を解析してくれる。

### 2. OpenAI API設定

```bash
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here
```

**解説**:
- GPT-4oでのキャラクター設定生成
- DALL-Eでの画像生成
- ChatGPT APIでの会話機能

**セキュリティ重要度**: 🔴 超重要
APIキーが漏洩すると料金が発生する可能性がある。

### 3. Google OAuth設定

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app-domain.railway.app/auth/google/callback
```

**解説**:
- `GOOGLE_CLIENT_ID`: Googleアプリの公開識別子
- `GOOGLE_CLIENT_SECRET`: Googleアプリの秘密鍵
- `GOOGLE_REDIRECT_URI`: OAuth認証後のリダイレクト先URL

**学習ポイント**: 
OAuth 2.0の仕組みで、ユーザーがGoogleアカウントでログインできる機能を実現。

### 4. JWT設定

```bash
# JWT
JWT_SECRET=your_jwt_secret_key_here
```

**解説**:
- JSON Web Tokenの署名・検証に使用する秘密鍵
- ユーザー認証状態の管理に使用

**セキュリティ重要度**: 🔴 超重要
この鍵が漏洩すると、偽の認証トークンが作成される可能性がある。

### 5. アプリケーション設定

```bash
# アプリケーション設定
NODE_ENV=development
PORT=3000
```

**解説**:
- `NODE_ENV`: 実行環境（development/production）
- `PORT`: アプリケーションが起動するポート番号

## 使用方法と実行手順

### 1. 環境変数ファイルの作成
```bash
# .env.exampleを参考に実際の.envファイルを作成
cp .env.example .env
```

### 2. 各項目の設定
1. **Railway PostgreSQL**: Railwayダッシュボードから接続情報をコピー
2. **OpenAI API**: OpenAIアカウントでAPIキー発行
3. **Google OAuth**: Google Cloud ConsoleでOAuthアプリ作成
4. **JWT Secret**: 複雑なランダム文字列を生成

### 3. 設定値の例
```bash
# 実際の設定例（機密情報は伏せてある）
DATABASE_URL=postgresql://postgres:****@containers-us-west-xx.railway.app:5432/railway
OPENAI_API_KEY=sk-proj-****
GOOGLE_CLIENT_ID=123456789-******.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-******
JWT_SECRET=super_secret_key_min_32_characters_****
```

## セキュリティ考慮事項

### 🔐 重要な安全対策

1. **`.env`ファイルをGitに含めない**
   ```bash
   # .gitignoreに追加済み
   .env
   ```

2. **環境変数の分離**
   - 開発環境: `.env.development`
   - 本番環境: Railway環境変数設定

3. **APIキーの権限制限**
   - OpenAI: 使用量制限設定
   - Google OAuth: 必要最小限のスコープ設定

4. **JWT Secretの強度**
   - 最低32文字以上
   - 英数字+記号の組み合わせ
   - 定期的な更新

## トラブルシューティング

### よくあるエラーと対処法

#### 1. PostgreSQL接続エラー
```
Error: connection refused
```
**対処法**:
- RailwayサービスのPostgreSQLが起動しているか確認
- `DATABASE_URL`の形式が正しいか確認
- ネットワーク接続を確認

#### 2. OpenAI API認証エラー
```
Error: Invalid API key
```
**対処法**:
- APIキーが正しくコピーされているか確認
- OpenAIアカウントの請求設定確認
- API使用量制限の確認

#### 3. Google OAuth設定エラー
```
Error: redirect_uri_mismatch
```
**対処法**:
- Google Cloud ConsoleでリダイレクトURIが正しく設定されているか確認
- 本番環境のドメインが正しく設定されているか確認

## 学習ポイント（PostgreSQL初挑戦者向け）

### 🌟 重要な概念

1. **環境変数の意義**
   - コードと設定の分離
   - セキュリティの向上
   - 環境ごとの設定変更の容易さ

2. **PostgreSQL接続文字列の理解**
   ```
   postgresql://[user]:[password]@[host]:[port]/[database]
   ```
   各部分の意味を理解することで、接続問題の解決が容易になる。

3. **OAuth 2.0の基本概念**
   - 認証と認可の違い
   - リダイレクトベースの認証フロー
   - セキュアな認証の実現方法

4. **JWTトークンの仕組み**
   - ステートレス認証
   - トークンベース認証の利点
   - セキュリティ考慮事項

### 📚 次のステップ

1. **実際の`.env`ファイル作成**
2. **各APIサービスのアカウント作成**
3. **接続テストスクリプトでの動作確認**
4. **PostgreSQL接続の理解深化**

このファイルは、キャラメイクSNSアプリの基盤となる重要な設定集です。
各項目の理解を深めることで、本格的なWebアプリケーション開発の基礎が身につきます✨

## 関連ファイル
- `/scripts/test-connection.js`: PostgreSQL接続テスト
- `/package.json`: 依存関係とスクリプト定義
- `/.gitignore`: セキュリティ設定