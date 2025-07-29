# キャラクター創作SNSアプリ - プロジェクト指南書

## 💕 プロジェクト概要

**プロジェクト名**: キャラメイクSNS✨
**期間**: 3週間（学習重視・スピード優先）
**目的**: PostgreSQL + SNS機能 + AI画像生成の習得で、最終目標への技術基盤をゲット🎯

## 🎭 学習目標（超重要❗）

### 主な習得技術
- PostgreSQL（SQLiteからのレベルアップ💪）
- SNS機能（いいね・コメント・共有機能）
- 画像生成API（DALL-E連携でキャラを視覚化🎨）
- チャット型UI（友達と妄想するみたいな体験✨）
- 選択肢生成システム（王道2 + ギャップ萌え1 + パーソナライズ1）

### 学習戦略における位置づけ
**最終目標**: ストーリー作成補助ツール💖
**前回**: JWT認証 + AI API基礎 ✅
**今回**: PostgreSQL + SNS + 画像生成
**次回**: 本格的な世界設定管理システム

## 🚀 開発方針（絶対守る❗）

### 最優先事項
1. **学習 > 完成度** - 新技術をサクッと体験することが一番大事💡
2. **スピード > 品質** - 最低限動けばOK、細かいことは気にしない⚡
3. **体験 > 機能** - ユーザー体験の核心部分だけ実装🎯

### やらない事リスト（重要❗）
- 複雑なUI/UXアニメーション
- リアルタイム通信（WebSocket）


## 🎯 MVP機能（これだけで完成❗）

### 必須機能
- 🔐 **ユーザー認証**: GoogleAuth + 従来認証の併用（JWT）
- 💬 **AIチャット**: キャラ設定を友達みたいに作成（ChatGPT風UI）
- 🎨 **画像生成**: ユーザー操作でDALL-E画像生成（5回/日制限）
- 📱 **投稿機能**: 縦長キャラカード形式での投稿
- 👍 **いいね機能**: 親指上げマーク + 数字表示

### 除外機能（今回はパス）
- コメント機能（いいねだけでOK）
- フォロー機能
- 通知機能
- 検索・タグ機能
- 高度な画像編集

## 🛠️ 技術仕様

### 技術スタック
```
Frontend: HTML + CSS + バニラJS（前回の経験活用）
Backend: Express.js + PostgreSQL + JWT + GoogleAuth
AI: OpenAI API（GPT-4o 200回/日 + DALL-E 5回/日）
Storage: PostgreSQL BLOB（画像データ直接格納）
Deploy: Railway（SSL自動設定、クラウドPostgreSQL）
```

### データベース設計（PostgreSQL初挑戦💪）
```sql
-- ユーザーテーブル（GoogleAuth対応）
users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255), -- 従来認証用（Google認証時はNULL）
    google_id VARCHAR(255), -- Google認証用
    profile_image_url TEXT, -- Googleプロフィール画像
    display_name VARCHAR(255), -- Google表示名
    created_at TIMESTAMP DEFAULT NOW(),
    daily_ai_usage INTEGER DEFAULT 0,
    daily_image_usage INTEGER DEFAULT 0,
    last_usage_reset DATE DEFAULT CURRENT_DATE
)

-- キャラクターテーブル（20項目のJSON格納）
characters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    character_data JSON NOT NULL, -- 20項目すべてのキャラ設定
    ai_generated_image BYTEA, -- PostgreSQL BLOB画像格納
    is_public BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
)

-- いいね機能テーブル（SNS要素）
character_likes (
    user_id INTEGER REFERENCES users(id),
    character_id INTEGER REFERENCES characters(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, character_id)
)

-- 使用制限管理テーブル
user_daily_limits (
    user_id INTEGER REFERENCES users(id),
    usage_date DATE DEFAULT CURRENT_DATE,
    ai_chat_count INTEGER DEFAULT 0,
    image_generation_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
)
```

## 💖 核心機能：AIチャット型キャラメイク

### 友達との妄想体験の再現
```
目標体験:
「友達と一緒に妄想を膨らませて、気づいたら超詳細なキャラ設定が完成してる✨」

実装方針:
- 自然な会話口調のAI（ChatGPT風UI）
- リスト形式での選択肢表示
- ギャップ萌え要素の積極的提案
- 20項目完了で自動終了（ユーザー確認あり）
- 一つ前の状態に戻る機能（やり直し不可）
```

### 選択肢生成パターン
```
[王道パターン1] - 安心感・とっつきやすさ
[王道パターン2] - 別の定番パターン  
[ギャップ萌え] - 「怖そうだけど実は優しい」系💕
[パーソナライズ] - ユーザーの過去選択から学習
```

## 📅 3週間実装計画

### Week 1: PostgreSQL基盤構築（1週間）
**目標**: SQLiteからPostgreSQLへの移行体験
- PostgreSQL環境構築（Railway）
- 基本的なテーブル設計（4テーブル）
- GoogleAuth + 従来認証の併用システム
- BLOB画像ストレージの実装
- 使用制限機能の実装

**完了基準**: GoogleAuthとメール認証両方でログインができる

### Week 2: AIチャット機能（1週間）  
**目標**: チャット型UI + 選択肢生成システム
- ChatGPT風チャット画面のUI実装
- OpenAI APIでの会話生成（200回/日制限）
- リスト形式での選択肢表示
- 20項目キャラクター設定の構造化
- 自動切断機能（長時間放置対応）

**完了基準**: AIとの会話で20項目キャラ設定ができる

### Week 3: 画像生成 + SNS機能（1週間）
**目標**: DALL-E連携 + 投稿・いいね機能
- DALL-E APIでの画像生成（5回/日制限、再生成可能）
- PostgreSQL BLOBでの画像保存
- 縦長キャラカード投稿機能（公開/非公開選択）
- 親指上げマーク + 数字でのいいね機能
- 新着順での投稿一覧表示
- 自分のキャラ一覧ページ（30体上限）

**完了基準**: キャラを作って画像付きで投稿、いいねができる

## 📚 学習戦略

### memoファイル学習法の継続
1. **新技術ごとに解説memo作成**
2. **実装時間の7割を学習に充当**
3. **理解度60%で次へ進む勇気**

### 重点学習項目
- **PostgreSQL基礎**: SQLとの違い、JSON型活用、BLOBストレージ
- **GoogleAuth連携**: OAuth2.0の仕組み、従来認証との併用
- **チャット型UI設計**: ChatGPT風UI、ユーザー体験の設計思想
- **画像生成API**: DALL-E活用とコスト管理、使用制限システム
- **SNS機能設計**: いいね機能の実装パターン、投稿管理

## 🎯 成功指標

### 技術的成功指標
- [ ] PostgreSQL基本操作習得（JSON型、BLOB活用）
- [ ] GoogleAuth + 従来認証の併用システム実装
- [ ] ChatGPT風AIチャット機能の実装
- [ ] DALL-E画像生成APIの連携成功
- [ ] 縦長キャラカードSNS機能の基本実装

### 学習成功指標
- [ ] 新技術3つ以上の体験完了
- [ ] 前回より複雑なDB設計の理解
- [ ] API連携パターンの習得

### プロダクト成功指標
- [ ] GoogleAuthとメール認証両方でログインできる
- [ ] 20項目の詳細なキャラが作成できる
- [ ] DALL-E画像付きで投稿できる
- [ ] 他ユーザーの投稿にいいね（親指上げ）できる
- [ ] 自分のキャラ一覧ページで管理できる

## 💡 重要な方針転換

### 前回からの学び活用
- **段階的開発**: 認証→チャット→画像→SNSの順序
- **背伸びしない技術選択**: PostgreSQLは「SQLiteの次のステップ」として適切
- **ClaudeCodeとの相棒関係**: 前回確立したスタイルを継続

### 新しい挑戦ポイント
- **データベースの本格化**: SQLite → PostgreSQL（BLOB活用）
- **認証システムの複合化**: JWT → GoogleAuth + JWT併用
- **AI活用の幅拡大**: テキスト生成 + 画像生成（使用制限付き）
- **ユーザー体験設計**: ChatGPT風チャット型UIの新体験

## 🌟 最終的な成果物イメージ

**アプリケーション**: 友達と妄想するみたいにキャラを作れるSNS✨
**技術基盤**: PostgreSQL + GoogleAuth + AI連携の実用スキル
**学習成果**: 最終目標に向けた確実なステップアップ
**楽しさ**: 20項目詳細設定 + DALL-E画像でギャップ萌えキャラがどんどん生まれる体験💕

## 🔥 重要な心構え

### 学習最優先マインド
「完璧なアプリより、新技術を体験すること」
「動けばOK、細かいことは次回以降」
「スピード重視で、とにかく最後まで完成させる」

### モチベーション維持
- **小さな成功を積み重ねる**
- **毎日少しずつでも進捗を感じる**
- **ClaudeCodeとの相棒感を楽しむ**
- **最終目標への距離が縮まる実感**

### トラブル時の対処
- **立ち止まらない**: 理解できなくても先に進む
- **遠慮しない**: ClaudeCodeに何度でも質問する
- **完璧を求めない**: 60%理解で次のステップへ

---

このプロジェクトを通じて、「PostgreSQL + GoogleAuth + SNS + AI画像生成」の技術基盤を獲得し、
最終目標「ストーリー創作補助ツール」への確実な前進を達成する💪✨

頑張って行こうね〜❗ ClaudeCodeがついてるから絶対大丈夫だよ〜💕

# 重要な指示

## ClaudeCodeへの指示

### 基本姿勢
- **学習最優先**: 完成度より新技術の体験を重視
- **スピード重視**: 最低限動けばOK、細かい最適化は後回し
- **ギャル語対応**: モチベーション維持のため、親しみやすい口調で対応
- **段階的実装**: 無理をせず、確実にステップアップ

### 技術実装方針
- **PostgreSQL**: 基本操作を重視、JSON型・BLOB活用、高度な最適化は不要
- **GoogleAuth**: OAuth2.0基礎習得、従来認証との併用パターン
- **チャット型UI**: ChatGPT風シンプル実装、リアルタイム性は不要
- **画像生成**: DALL-E基本連携のみ、使用制限システム重視
- **SNS機能**: いいね機能のみ、コメントやフォローは次回以降

### memoファイル作成指針
- **新技術ごとに詳細解説**: PostgreSQL、GoogleAuth、DALL-E、ChatGPT風UI
- **初心者向けの表現**: 専門用語は分かりやすく説明
- **実装理由の説明**: なぜその技術を選んだか、どう活用するか
- **制限システムの解説**: API使用制限、キャラ数制限の実装方法
- **次回への接続**: 最終目標にどう繋がるかを明記

### モチベーション維持サポート
- **成功体験の積み重ね**: 小さな機能でも動いたら一緒に喜ぶ
- **前向きな励まし**: 困難な時も「絶対できる」という姿勢
- **学習価値の強調**: 新技術習得の意義を常に伝える
- **進捗の可視化**: どこまで来たか、あと何が残っているかを明確に