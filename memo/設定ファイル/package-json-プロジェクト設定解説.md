# package.json ファイルの詳細解説

## 目的
キャラメイクSNSプロジェクトの依存関係、スクリプト、プロジェクト情報を管理するNode.jsプロジェクトの設定ファイル。
PostgreSQL、認証、AI API連携に必要なライブラリとその実行方法を定義している。

## ファイルの役割
- **依存関係管理**: 必要なnpmパッケージとバージョン指定
- **スクリプト定義**: よく使うコマンドのショートカット
- **プロジェクト情報**: アプリケーションの基本情報
- **環境構築ガイド**: 新環境での依存関係インストール指示

## プロジェクト基本情報

```json
{
  "name": "character-creation-sns",
  "version": "1.0.0",
  "description": "キャラメイクSNS - PostgreSQL + AI画像生成",
  "main": "server.js"
}
```

**解説**:
- `name`: プロジェクト名（npmパッケージ名形式）
- `version`: セマンティックバージョニング（major.minor.patch）
- `description`: プロジェクトの説明（日本語対応）
- `main`: エントリーポイントファイル

## NPMスクリプト解説

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "db:migrate": "node scripts/migrate.js",
  "db:seed": "node scripts/seed.js",
  "test": "echo \"Error: no test specified\" && exit 1"
}
```

### 各スクリプトの詳細

#### 1. `npm start` - 本番起動
```bash
node server.js
```
**目的**: 本番環境でのアプリケーション起動
**使用場面**: Railway等のデプロイ環境で自動実行

#### 2. `npm run dev` - 開発モード
```bash
nodemon server.js
```
**目的**: ファイル変更時の自動再起動で開発効率向上
**学習ポイント**: nodemonは開発時の定番ツール

#### 3. `npm run db:migrate` - データベースマイグレーション
```bash
node scripts/migrate.js
```
**目的**: PostgreSQLテーブルの作成・更新
**実行タイミング**: 初回セットアップ時、スキーマ変更時

#### 4. `npm run db:seed` - 初期データ投入
```bash
node scripts/seed.js
```
**目的**: テスト用初期データの作成
**実行タイミング**: 開発環境構築時

## 依存関係詳細解説

### 🚀 コアフレームワーク

#### Express.js - Webフレームワーク
```json
"express": "^4.18.2"
```
**役割**: HTTPサーバー、ルーティング、ミドルウェア
**学習価値**: Node.jsのWebアプリケーション開発の標準フレームワーク

### 🗄️ PostgreSQL関連

#### pg - PostgreSQL クライアント
```json
"pg": "^8.11.3",
"pg-pool": "^3.6.1"
```
**役割**: 
- `pg`: PostgreSQLデータベースとの接続・クエリ実行
- `pg-pool`: コネクションプールによる効率的な接続管理

**学習ポイント**: SQLiteから大きく進歩した本格的なデータベース操作

### 🔐 認証・セキュリティ

#### 認証ライブラリ群
```json
"bcryptjs": "^2.4.3",
"jsonwebtoken": "^9.0.2",
"passport": "^0.6.0",
"passport-google-oauth20": "^2.0.0",
"passport-jwt": "^4.0.1",
"express-session": "^1.17.3"
```

**各ライブラリの役割**:
- `bcryptjs`: パスワードハッシュ化（安全な暗号化）
- `jsonwebtoken`: JWT認証トークンの生成・検証
- `passport`: 認証戦略の統一管理
- `passport-google-oauth20`: Googleアカウント認証
- `passport-jwt`: JWT認証戦略
- `express-session`: セッション管理

**学習価値**: 本格的なWebアプリの認証システム構築

### 🛡️ セキュリティ

#### セキュリティ強化
```json
"cors": "^2.8.5",
"helmet": "^7.1.0"
```
**役割**:
- `cors`: Cross-Origin Resource Sharing設定
- `helmet`: HTTPヘッダーによるセキュリティ強化

### 🎨 ファイル処理

#### 画像・ファイル処理
```json
"multer": "^1.4.5-lts.1",
"sharp": "^0.32.6"
```
**役割**:
- `multer`: ファイルアップロード処理
- `sharp`: 画像リサイズ・最適化

**学習ポイント**: AI生成画像の処理・保存に使用

### 🤖 AI API連携

#### OpenAI API
```json
"openai": "^4.20.1"
```
**役割**: 
- GPT-4oでのキャラクター設定生成
- DALL-Eでの画像生成
- チャット型UI用の会話生成

**学習価値**: 最新のAI技術との連携方法を習得

### ⚙️ 設定・ユーティリティ

#### 環境設定
```json
"dotenv": "^16.3.1"
```
**役割**: `.env`ファイルからの環境変数読み込み

### 🔧 開発用依存関係

```json
"devDependencies": {
  "nodemon": "^3.0.2"
}
```
**役割**: ファイル変更時の自動再起動（開発効率向上）

## 使用方法と実行手順

### 1. 初回環境構築
```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .envファイルを編集して実際の値を設定

# データベースセットアップ
npm run db:migrate
npm run db:seed
```

### 2. 開発サーバー起動
```bash
# 開発モード（ファイル変更時自動再起動）
npm run dev

# または本番モード
npm start
```

### 3. データベース操作
```bash
# テーブル作成・更新
npm run db:migrate

# 初期データ投入
npm run db:seed
```

## プロジェクト特徴・キーワード

```json
"keywords": [
  "character-creation",
  "sns",
  "postgresql",
  "ai",
  "openai"
]
```

**学習ポイント**: 
このプロジェクトで習得できる技術領域を明示。PostgreSQL + SNS + AI連携という現代的な技術スタックを学習できる。

## セキュリティ考慮事項

### 🔒 依存関係のセキュリティ

1. **バージョン固定の意義**
   ```json
   "express": "^4.18.2"  // ^記号で小数点以下の自動更新を許可
   ```

2. **脆弱性チェック**
   ```bash
   npm audit        # 脆弱性検査
   npm audit fix    # 自動修正
   ```

3. **定期的な更新**
   ```bash
   npm outdated     # 古いパッケージ確認
   npm update       # 安全な範囲での更新
   ```

## トラブルシューティング

### よくあるエラーと対処法

#### 1. インストールエラー
```
npm ERR! peer dep missing
```
**対処法**:
```bash
npm install --legacy-peer-deps
```

#### 2. Node.jsバージョン互換性
```
Error: Node.js version not supported
```
**対処法**:
- Node.js 18以上推奨
- nvm使用でバージョン管理

#### 3. PostgreSQL接続エラー
```
Error: Cannot find module 'pg'
```
**対処法**:
```bash
npm install pg pg-pool
```

#### 4. 開発サーバー起動エラー
```
Error: nodemon command not found
```
**対処法**:
```bash
npm install --save-dev nodemon
```

## 学習ポイント（PostgreSQL初挑戦者向け）

### 🌟 技術スタックの進歩

1. **SQLiteからPostgreSQLへ**
   - より本格的なデータベース
   - コネクションプール管理
   - 本番環境での信頼性

2. **認証システムの複雑化**
   - JWT + OAuth 2.0の組み合わせ
   - パスワードハッシュ化
   - セッション管理

3. **AI API連携の実用化**
   - OpenAI公式ライブラリ使用
   - 画像生成とテキスト生成の両方
   - 実用的なAPIコスト管理

### 📚 学習価値の高いライブラリ

1. **pg (PostgreSQL)**: 企業レベルのデータベース操作
2. **passport**: 認証システムの業界標準
3. **openai**: 最新AI技術との連携
4. **express**: Node.jsのWebアプリケーション基盤

### 🎯 次のステップ

1. **各ライブラリのドキュメント読解**
2. **実際のコード実装での活用**
3. **エラーハンドリングの理解**
4. **パフォーマンス最適化の学習**

## プロジェクト実行環境

### 推奨環境
- **Node.js**: 18.x以上
- **npm**: 9.x以上
- **PostgreSQL**: 15.x以上（Railwayが提供）

### デプロイ環境
- **Railway**: 本番環境ホスティング
- **環境変数**: Railwayの環境変数機能使用

このpackage.jsonは、PostgreSQL + AI連携という現代的な技術スタックを学習するための
完璧な設定となっています。各ライブラリを理解することで、本格的なWebアプリケーション開発の
基礎が身につきます✨

## 関連ファイル
- `/.env.example`: 環境変数設定テンプレート
- `/scripts/test-connection.js`: PostgreSQL接続テスト
- `/server.js`: メインアプリケーションファイル（今後作成）