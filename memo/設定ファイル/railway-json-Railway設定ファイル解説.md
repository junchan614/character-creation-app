# railway.json - Railway設定ファイル解説

## 目的
**railway.json**は、Railway（クラウドホスティングサービス）でのアプリケーションデプロイ設定を定義するファイルです。
PostgreSQL + SSL自動設定という、今回のプロジェクトに最適な本番環境を構築するための重要な設定書です🚀

## Railwayとは？

### なぜRailwayを選んだのか
```
従来の選択肢:
❌ Heroku: 無料プランが廃止、PostgreSQL制限あり
❌ AWS/GCP: 設定が複雑、学習コストが高い
❌ Vercel: 静的サイトメイン、データベース連携が複雑

✅ Railway: 
- PostgreSQL標準搭載
- SSL証明書自動生成
- 簡単設定で本番環境構築
- 学習重視プロジェクトに最適
```

### プロジェクトでの位置づけ
- **Week 1目標**: PostgreSQL基盤構築
- **Railway**: クラウドPostgreSQLの提供
- **SSL/セキュリティ**: 本番レベルの安全性
- **AI API**: 安定したAPIアクセス環境

## ファイル内容の詳細解説

### 現在の設定内容
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 各設定項目の解説

#### 1. スキーマ定義
```json
"$schema": "https://railway.app/railway.schema.json"
```
**役割**: 設定ファイルの構造チェック
**効果**: VSCodeなどでの自動補完、エラー検出
**学習ポイント**: JSON Schemaの活用方法

#### 2. ビルド設定
```json
"build": {
  "builder": "NIXPACKS"
}
```

**NIXPACKS**とは？
- Railway標準のビルドシステム
- Node.js環境を自動検出
- package.jsonから依存関係を解析
- 最適化されたDockerイメージを自動生成

**従来のDockerfile方式との違い**:
```dockerfile
# Dockerfileを書く必要がない❗
# 以前はこんな設定が必要だった：
FROM node:18
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

# NIXPACKSなら自動で上記を生成✨
```

#### 3. デプロイ設定（重要）
```json
"deploy": {
  "healthcheckPath": "/health",
  "healthcheckTimeout": 30,
  "restartPolicyType": "ON_FAILURE",
  "restartPolicyMaxRetries": 3
}
```

##### ヘルスチェック機能
```json
"healthcheckPath": "/health"
```
**対応するserver.jsのコード**:
```javascript
// Railway用ヘルスチェック
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});
```

**動作の流れ**:
1. Railwayが定期的に`/health`にアクセス
2. アプリが正常なら`200 OK`を返す
3. エラーなら自動的に再起動実行
4. **PostgreSQL接続エラーも自動復旧**

##### タイムアウト設定
```json
"healthcheckTimeout": 30
```
- 30秒以内にレスポンスがない場合はエラー判定
- PostgreSQL接続が重い場合も考慮した設定
- AI API呼び出し中でも安全な時間設定

##### 再起動ポリシー
```json
"restartPolicyType": "ON_FAILURE",
"restartPolicyMaxRetries": 3
```

**再起動の動作パターン**:
```
🔄 アプリクラッシュ → 自動再起動（1回目）
🔄 また失敗 → 自動再起動（2回目）
🔄 また失敗 → 自動再起動（3回目）
❌ 3回失敗 → サービス停止（運用者に通知）
```

**よくある再起動理由**:
- PostgreSQL接続タイムアウト
- OpenAI API制限エラー
- メモリ不足
- ネットワーク一時的切断

## プロジェクトでの重要性

### PostgreSQL初挑戦での安全装置
```javascript
// server.jsでの接続テスト
app.get('/api/db-test', async (req, res) => {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    // 接続テスト実行
  } catch (error) {
    // エラー時は/healthでも検知され、自動再起動
  }
});
```

### AI API連携での安定性
- **OpenAI API制限**: 一時的な制限でアプリが落ちても自動復旧
- **DALL-E画像生成**: 重い処理中のタイムアウト対策
- **使用量制限システム**: エラー時でも制限管理を維持

### SNS機能での可用性
- **いいね機能**: ユーザーアクション中のエラー防止
- **画像アップロード**: PostgreSQL BLOB処理での安定性
- **チャット型UI**: 長時間セッション中の接続維持

## Railway環境での実際の動作

### デプロイフロー
```
1. git push → Railwayが自動検知
2. NIXPACKS → Node.js環境を自動構築
3. npm install → package-lock.jsonに基づいてインストール
4. PORT環境変数 → Railwayが自動設定
5. /health → ヘルスチェック開始
6. SSL証明書 → 自動生成・適用

🎉 https://your-app.railway.app でアクセス可能
```

### 環境変数の自動設定
```bash
# Railwayが自動で設定してくれる環境変数
PORT=3000                    # 自動割り当て
DATABASE_URL=postgresql://... # PostgreSQL接続URL
NODE_ENV=production          # 本番環境フラグ

# 手動で設定が必要な環境変数
OPENAI_API_KEY=sk-...       # OpenAI APIキー
GOOGLE_CLIENT_ID=...        # Google認証設定
JWT_SECRET=...              # JWT暗号化キー
```

## トラブルシューティング

### よくある問題と対処法

#### 1. ヘルスチェック失敗
```bash
# エラーログ例
Health check failed: timeout after 30s

# 対処法：server.jsでの/healthエンドポイント確認
app.get('/health', (req, res) => {
  // このエンドポイントが軽量で高速であることを確認
  res.status(200).json({ status: 'ok' });
});
```

#### 2. PostgreSQL接続エラー
```bash
# エラーログ例
Database connection failed: ECONNREFUSED

# railway.jsonでの対応
"restartPolicyMaxRetries": 3  // 自動で3回まで再試行
```

#### 3. ビルドエラー
```bash
# NIXPACKSビルド失敗時
# package.jsonの依存関係を確認
# node.jsバージョンの互換性チェック
```

### デバッグ用の拡張設定
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "experimental": {
    "configPrecedence": "railway.json"  // 将来的な拡張設定
  }
}
```

## セキュリティ考慮事項

### SSL/TLS自動設定
- Railway → Let's Encrypt証明書自動取得
- HTTPS強制リダイレクト自動設定
- **PostgreSQL接続もSSL暗号化**

### 環境変数の安全管理
```javascript
// server.jsでの確認
app.get('/api/status', (req, res) => {
  res.json({
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
    // 実際の値は返さない（セキュリティ配慮）
  });
});
```

## 学習ポイント

### インフラストラクチャ as Code
- **設定のコード化**: railway.jsonで設定を管理
- **バージョン管理**: Git でインフラ設定も管理
- **再現可能性**: 同じ設定で何度でもデプロイ可能

### クラウドネイティブ設計
- **ヘルスチェック**: 分散システムでの基本パターン
- **自動復旧**: 障害を前提とした設計思想
- **スケーラビリティ**: 将来の負荷増加に対応可能

### 本番環境運用
- **監視**: アプリケーションの健全性自動チェック
- **障害対応**: 人手を介さない自動復旧
- **運用負荷軽減**: 初心者でも安定運用可能

## 次回プロジェクトへの応用

### 最終目標（ストーリー創作補助ツール）での拡張
```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60,        // 重い処理に対応
    "restartPolicyMaxRetries": 5,    // より安定した運用
    "replicas": 2                    // 冗長化（将来的）
  }
}
```

### 学習継続のメリット
- **Railway運用ノウハウ**: 次回プロジェクトでも活用
- **PostgreSQL本番運用**: より複雑なDB設計でも安心
- **API制限管理**: 大規模なAI連携システムでも対応可能

## まとめ

**railway.json**は「本番環境の安心・安全装置」🛡️

**重要な機能**:
- 自動ヘルスチェック → 障害の早期発見
- 自動再起動 → 人手不要の復旧
- SSL自動設定 → セキュアな通信
- PostgreSQL統合 → データベース環境の簡単構築

**学習価値**:
- クラウド運用の基本パターン習得
- インフラ as Code の体験
- 本番環境でのトラブル対応能力

3週間プロジェクトでPostgreSQL + AI API を安定運用するための、
**縁の下の力持ち**的存在です💪✨