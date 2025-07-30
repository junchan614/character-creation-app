const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { Pool } = require('pg');
const { authenticateToken } = require('../middleware/auth');

// OpenAI API設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// PostgreSQL接続設定
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * 20項目キャラクター設定の定義
 * CLAUDE.mdで定義された項目を構造化
 */
const CHARACTER_FIELDS = {
  basic: {
    name: { label: '名前', type: 'text', required: true },
    age: { label: '年齢', type: 'number', required: true },
    gender: { label: '性別', type: 'select', options: ['男性', '女性', 'その他', '秘密'], required: true },
    height: { label: '身長', type: 'text', required: true },
    birthday: { label: '誕生日', type: 'text', required: true }
  },
  appearance: {
    hairColor: { label: '髪色', type: 'text', required: true },
    eyeColor: { label: '瞳色', type: 'text', required: true },
    bodyType: { label: '体型', type: 'text', required: true },
    features: { label: '特徴', type: 'text', required: true },
    clothing: { label: '服装', type: 'text', required: true }
  },
  personality: {
    basicPersonality: { label: '基本性格', type: 'text', required: true },
    trait1: { label: '性格特徴1', type: 'text', required: true },
    trait2: { label: '性格特徴2', type: 'text', required: true },
    speechStyle: { label: '口調', type: 'text', required: true },
    hobbies: { label: '趣味', type: 'text', required: true }
  },
  background: {
    occupation: { label: '職業', type: 'text', required: true },
    birthplace: { label: '出身地', type: 'text', required: true },
    family: { label: '家族構成', type: 'text', required: true },
    skills: { label: '特技', type: 'text', required: true },
    favorites: { label: '好きなもの', type: 'text', required: true }
  }
};

/**
 * キャラクター設定の完了チェック
 * @param {Object} characterData - キャラクターデータ
 * @returns {Object} - { completed: boolean, remaining: string[], progress: number }
 */
function checkCharacterCompletion(characterData) {
  const allFields = Object.values(CHARACTER_FIELDS).flatMap(category => Object.keys(category));
  const completedFields = allFields.filter(field => characterData[field] && characterData[field].trim() !== '');
  const remaining = allFields.filter(field => !characterData[field] || characterData[field].trim() === '');
  
  return {
    completed: remaining.length === 0,
    remaining,
    progress: Math.round((completedFields.length / allFields.length) * 100),
    completedCount: completedFields.length,
    totalCount: allFields.length
  };
}

/**
 * 選択肢生成のためのプロンプト作成
 * @param {string} currentField - 現在の項目
 * @param {Object} characterData - これまでのキャラクターデータ
 * @param {Object} userHistory - ユーザーの過去選択履歴（パーソナライズ用）
 * @returns {string} - OpenAI用プロンプト
 */
function createChoicePrompt(currentField, characterData, userHistory = {}) {
  const fieldInfo = Object.values(CHARACTER_FIELDS)
    .flatMap(category => Object.entries(category))
    .find(([key]) => key === currentField)?.[1];
  
  if (!fieldInfo) {
    throw new Error(`Unknown field: ${currentField}`);
  }

  const context = Object.entries(characterData)
    .filter(([_, value]) => value && value.trim() !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  return `あなたは友達と一緒に妄想でキャラクターを作る楽しいアシスタントです。

現在決まっているキャラクター設定: ${context || 'まだ何も決まっていません'}

次に決める項目: ${fieldInfo.label} (${currentField})

以下の4つの選択肢を提案してください：
1. 王道パターン1: 安心感があって、とっつきやすい定番の設定
2. 王道パターン2: 別の角度からの定番パターン
3. ギャップ萌え: 「見た目と中身のギャップ」や「意外な一面」がある設定
4. パーソナライズ: これまでの設定から考えて、このキャラに最も似合いそうな設定

各選択肢は簡潔に（10-15文字程度）、魅力的に提案してください。
友達同士の会話のような、楽しくてワクワクする口調で話してください。

回答形式:
選択肢1: [具体的な内容]
選択肢2: [具体的な内容]
選択肢3: [具体的な内容]
選択肢4: [具体的な内容]
コメント: [選択肢についての楽しいコメント（1-2行）]`;
}

/**
 * API使用制限チェック
 * @param {number} userId - ユーザーID
 * @returns {Promise<Object>} - 使用可能かどうかの情報
 */
async function checkApiUsageLimit(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT ai_chat_count FROM user_daily_limits 
       WHERE user_id = $1 AND usage_date = $2`,
      [userId, today]
    );

    const currentUsage = result.rows.length > 0 ? result.rows[0].ai_chat_count : 0;
    const dailyLimit = 200; // GPT-4o 200回/日制限

    return {
      canUse: currentUsage < dailyLimit,
      currentUsage,
      dailyLimit,
      remaining: dailyLimit - currentUsage
    };
  } catch (error) {
    console.error('API usage check error:', error);
    throw error;
  }
}

/**
 * API使用回数を更新
 * @param {number} userId - ユーザーID
 */
async function updateApiUsage(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO user_daily_limits (user_id, usage_date, ai_chat_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, usage_date)
       DO UPDATE SET ai_chat_count = user_daily_limits.ai_chat_count + 1`,
      [userId, today]
    );
  } catch (error) {
    console.error('API usage update error:', error);
    throw error;
  }
}

/**
 * POST /chat/start-character-creation
 * キャラクター作成を開始
 */
router.post('/start-character-creation', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // API使用制限チェック
    const usageInfo = await checkApiUsageLimit(userId);
    if (!usageInfo.canUse) {
      return res.status(429).json({
        error: 'API limit exceeded',
        message: `本日のAI使用制限（${usageInfo.dailyLimit}回）に達しました。明日またお試しください。`,
        usage: usageInfo
      });
    }

    // 新しいキャラクター作成セッションを開始
    const sessionData = {
      userId,
      characterData: {},
      currentStep: 0,
      currentField: 'name', // 最初は名前から
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // セッションをDBに保存（簡易実装：後でセッション管理を改善）
    await pool.query(
      `INSERT INTO character_creation_sessions (user_id, session_data, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET session_data = $2, updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(sessionData), new Date()]
    );

    res.json({
      success: true,
      message: 'キャラクター作成を開始しました！まずは名前から決めていきましょう〜✨',
      sessionData,
      currentField: CHARACTER_FIELDS.basic.name,
      progress: checkCharacterCompletion({}),
      apiUsage: usageInfo
    });

  } catch (error) {
    console.error('🔴 Character creation start error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'キャラクター作成開始中にエラーが発生しました'
    });
  }
});

/**
 * POST /chat/get-choices
 * 現在の項目に対する選択肢を取得
 */
router.post('/get-choices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentField, characterData } = req.body;

    // API使用制限チェック
    const usageInfo = await checkApiUsageLimit(userId);
    if (!usageInfo.canUse) {
      return res.status(429).json({
        error: 'API limit exceeded',
        message: `本日のAI使用制限（${usageInfo.dailyLimit}回）に達しました。`,
        usage: usageInfo
      });
    }

    // 選択肢生成プロンプト作成
    const prompt = createChoicePrompt(currentField, characterData || {});

    // OpenAI API呼び出し
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは創作キャラクターを一緒に作る楽しいアシスタントです。ユーザーと友達のような親しみやすい関係で、魅力的なキャラクター設定を提案してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.9 // 創作的な回答のために高めに設定
    });

    // API使用回数を更新
    await updateApiUsage(userId);

    const aiResponse = completion.choices[0].message.content;

    // レスポンスをパース（簡易実装）
    const lines = aiResponse.split('\n').filter(line => line.trim());
    const choices = [];
    let comment = '';

    for (const line of lines) {
      if (line.startsWith('選択肢') && line.includes(':')) {
        const choice = line.split(':')[1].trim();
        choices.push(choice);
      } else if (line.startsWith('コメント:')) {
        comment = line.split(':')[1].trim();
      }
    }

    // セッション更新
    const updatedUsage = await checkApiUsageLimit(userId);

    res.json({
      success: true,
      currentField,
      fieldInfo: Object.values(CHARACTER_FIELDS)
        .flatMap(category => Object.entries(category))
        .find(([key]) => key === currentField)?.[1],
      choices: choices.length >= 4 ? choices.slice(0, 4) : choices,
      comment,
      progress: checkCharacterCompletion(characterData || {}),
      apiUsage: updatedUsage,
      rawResponse: aiResponse // デバッグ用
    });

  } catch (error) {
    console.error('🔴 Get choices error:', error);
    
    if (error.code === 'insufficient_quota' || error.status === 429) {
      return res.status(429).json({
        error: 'OpenAI API quota exceeded',
        message: 'OpenAI APIの使用制限に達しました。しばらく時間をおいてからお試しください。'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: '選択肢生成中にエラーが発生しました',
      details: error.message
    });
  }
});

/**
 * POST /chat/select-choice
 * 選択肢を選択してキャラクター設定を更新
 */
router.post('/select-choice', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentField, selectedChoice, characterData } = req.body;

    if (!currentField || !selectedChoice) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: '選択項目と選択肢が必要です'
      });
    }

    // キャラクターデータを更新
    const updatedCharacterData = {
      ...characterData,
      [currentField]: selectedChoice
    };

    // 次の項目を決定
    const allFields = Object.values(CHARACTER_FIELDS).flatMap(category => Object.keys(category));
    const currentIndex = allFields.indexOf(currentField);
    const nextField = currentIndex < allFields.length - 1 ? allFields[currentIndex + 1] : null;

    // 完了チェック
    const progress = checkCharacterCompletion(updatedCharacterData);

    // セッション更新
    const sessionData = {
      userId,
      characterData: updatedCharacterData,
      currentStep: currentIndex + 1,
      currentField: nextField,
      lastUpdated: new Date().toISOString()
    };

    await pool.query(
      `UPDATE character_creation_sessions 
       SET session_data = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [JSON.stringify(sessionData), userId]
    );

    // AIを使って選択に対する気の利いた反応を生成
    let message;
    
    if (progress.completed) {
      message = await generateCompletionMessage(updatedCharacterData);
      // 完成したキャラクターをcharactersテーブルに保存
      await pool.query(
        `INSERT INTO characters (user_id, name, character_data, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [userId, updatedCharacterData.name || '名無し', JSON.stringify(updatedCharacterData)]
      );
    } else if (nextField) {
      const currentFieldInfo = Object.values(CHARACTER_FIELDS)
        .flatMap(category => Object.entries(category))
        .find(([key]) => key === currentField)?.[1];
      const nextFieldInfo = Object.values(CHARACTER_FIELDS)
        .flatMap(category => Object.entries(category))
        .find(([key]) => key === nextField)?.[1];
      
      message = await generateReactionMessage(
        currentFieldInfo?.label,
        selectedChoice,
        nextFieldInfo?.label,
        updatedCharacterData
      );
    } else {
      message = `「${selectedChoice}」素敵な選択ですね✨`;
    }

    res.json({
      success: true,
      message,
      characterData: updatedCharacterData,
      nextField,
      nextFieldInfo: nextField ? Object.values(CHARACTER_FIELDS)
        .flatMap(category => Object.entries(category))
        .find(([key]) => key === nextField)?.[1] : null,
      progress,
      completed: progress.completed
    });

  } catch (error) {
    console.error('🔴 Select choice error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: '選択処理中にエラーが発生しました'
    });
  }
});

/**
 * GET /chat/session
 * 現在のセッション状態を取得
 */
router.get('/session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT session_data, created_at, updated_at 
       FROM character_creation_sessions 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        hasSession: false,
        message: 'セッションが見つかりません。新しいキャラクター作成を開始してください。'
      });
    }

    const sessionData = JSON.parse(result.rows[0].session_data);
    const progress = checkCharacterCompletion(sessionData.characterData);

    res.json({
      success: true,
      hasSession: true,
      sessionData,
      progress,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    });

  } catch (error) {
    console.error('🔴 Get session error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'セッション取得中にエラーが発生しました'
    });
  }
});

/**
 * DELETE /chat/session
 * セッションをリセット（新しいキャラクター作成のため）
 */
router.delete('/session', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      `DELETE FROM character_creation_sessions WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      message: 'セッションをリセットしました。新しいキャラクター作成を開始できます。'
    });

  } catch (error) {
    console.error('🔴 Reset session error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'セッションリセット中にエラーが発生しました'
    });
  }
});

/**
 * 選択に対するAIの気の利いた反応を生成
 */
async function generateReactionMessage(currentFieldLabel, selectedChoice, nextFieldLabel, characterData) {
  try {
    const contextSummary = Object.entries(characterData)
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const fieldInfo = Object.values(CHARACTER_FIELDS)
          .flatMap(category => Object.entries(category))
          .find(([k]) => k === key)?.[1];
        return fieldInfo ? `${fieldInfo.label}: ${value}` : null;
      })
      .filter(Boolean)
      .join(', ');

    const prompt = `あなたは友達と一緒にキャラクターを妄想して作る楽しいアシスタントです。

現在のキャラクター設定: ${contextSummary || 'まだ何も決まっていません'}

ユーザーが「${currentFieldLabel}」に「${selectedChoice}」を選択しました。

以下の要求に従って、自然で気の利いた反応をしてください：

1. 選択した内容（${selectedChoice}）に対して、具体的で個性的なコメントをする
2. そのキャラクターの魅力や面白さを表現する
3. 既存の設定との組み合わせで生まれる面白さがあれば触れる
4. ${nextFieldLabel}への自然な話題転換を含める
5. 友達同士の楽しい会話のような口調で
6. 絵文字を適度に使って親しみやすく

150文字以内で、ワンパターンにならない自然な反応を生成してください。`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.8
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error('🔴 Reaction message generation error:', error);
    // フォールバック：シンプルなメッセージ
    return `「${selectedChoice}」いいですね✨ 次は「${nextFieldLabel}」を決めましょう！`;
  }
}

/**
 * キャラクター完成時の祝福メッセージを生成
 */
async function generateCompletionMessage(characterData) {
  try {
    const characterSummary = Object.entries(characterData)
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const fieldInfo = Object.values(CHARACTER_FIELDS)
          .flatMap(category => Object.entries(category))
          .find(([k]) => k === key)?.[1];
        return fieldInfo ? `${fieldInfo.label}: ${value}` : null;
      })
      .filter(Boolean)
      .join(', ');

    const prompt = `素晴らしいキャラクターが完成しました！

完成したキャラクター：
${characterSummary}

このキャラクターの魅力的な点や面白い組み合わせを指摘しながら、完成を祝福するメッセージを150文字以内で作成してください。

要求：
1. キャラクターの個性や魅力を具体的に褒める
2. 設定の組み合わせから生まれる面白さや意外性を表現
3. 完成への達成感を共有する
4. 友達同士の楽しい会話口調で
5. 適度に絵文字を使って親しみやすく`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.9
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error('🔴 Completion message generation error:', error);
    // フォールバック：シンプルな祝福メッセージ
    return `🎉 キャラクター設定が完成しました！素敵なキャラクターができましたね✨`;
  }
}

module.exports = router;