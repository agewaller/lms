/* ============================================================
   Broadcast - AI Engine
   LMS の AIEngine を再利用して、プラットフォーム最適化・翻訳を行う
   ============================================================ */
var BroadcastAI = {

  // ─── Get selected AI model ───
  getModel() {
    return broadcastStore.get('selectedModel') || 'claude-opus-4-6';
  },

  // ─── Get prompt (custom > config > default) ───
  getPrompt(key) {
    const custom = broadcastStore.get('customPrompts') || {};
    if (custom[key]?.prompt) return custom[key].prompt;
    const p = BROADCAST_CONFIG.prompts[key];
    return (p && typeof p === 'object') ? (p.prompt || '') : (p || '');
  },

  // ─── Core: call LMS AIEngine directly (same models, same endpoints) ───
  async callModel(system, userMessage, model) {
    model = model || this.getModel();
    const modelConfig = (CONFIG.aiModels && CONFIG.aiModels[model]) || BROADCAST_CONFIG.aiModels[model];
    if (!modelConfig) throw new Error('Unknown model: ' + model);

    // Reuse LMS AIEngine's per-provider callers so the same Worker proxy /
    // direct-browser-access logic applies.
    switch (modelConfig.provider) {
      case 'anthropic':
        return await AIEngine.callAnthropic(model, system, userMessage, modelConfig.maxTokens);
      case 'openai':
        return await AIEngine.callOpenAI(model, system, userMessage, modelConfig.maxTokens);
      case 'google':
        return await AIEngine.callGemini(model, system, userMessage, modelConfig.maxTokens);
      default:
        throw new Error('Unknown provider: ' + modelConfig.provider);
    }
  },

  // ─── Adapt draft to a specific platform ───
  // Returns { title, body, tags }
  async adaptForPlatform(draft, platformId, language) {
    const platform = BROADCAST_CONFIG.platforms[platformId];
    if (!platform) throw new Error('Unknown platform: ' + platformId);

    const system = this.getPrompt('broadcast_adapt');

    // Build user message with platform context
    const limits = platform.charLimit > 0 ? `${platform.charLimit}文字以内` : '文字数制限なし';
    const tagsGuide = platform.hashtags ? 'ハッシュタグ 2〜5 個を本文に自然に埋め込む' : 'ハッシュタグ不要';
    const lang = language || draft.language || 'ja';

    const userMsg = `【配信先プラットフォーム】
- ID: ${platform.id}
- 名称: ${platform.name}
- カテゴリ: ${platform.category}
- 文字数制限: ${limits}
- 語調ガイド: ${platform.tone}
- ハッシュタグ: ${tagsGuide}
- 出力言語: ${lang}

【元の原稿】
タイトル: ${draft.title || '(なし)'}

本文:
${draft.body || ''}

${draft.tags && draft.tags.length ? 'タグ: ' + draft.tags.join(', ') : ''}

上記の原稿を、上記プラットフォームの文化・字数・語調に合わせて書き直してください。
指定フォーマット（---TITLE--- / ---BODY--- / ---TAGS---）で出力してください。`;

    const response = await this.callModel(system, userMsg);
    return this.parseAdaptedResponse(response, platform);
  },

  // ─── Parse AI response into { title, body, tags } ───
  parseAdaptedResponse(response, platform) {
    if (!response) return { title: '', body: '', tags: [] };

    const titleMatch = response.match(/---TITLE---\s*\n([\s\S]*?)(?=---BODY---)/);
    const bodyMatch  = response.match(/---BODY---\s*\n([\s\S]*?)(?=---TAGS---|$)/);
    const tagsMatch  = response.match(/---TAGS---\s*\n([\s\S]*)$/);

    let title = (titleMatch?.[1] || '').trim();
    let body  = (bodyMatch?.[1]  || '').trim();
    let tagsText = (tagsMatch?.[1] || '').trim();

    // Fallback: if the model ignored the format, treat everything as body
    if (!body && response.length > 0 && !titleMatch && !bodyMatch) {
      body = response.trim();
    }

    const tags = tagsText
      ? tagsText.split(/[,、]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)
      : [];

    // Hard-enforce character limit
    if (platform.charLimit > 0 && body.length > platform.charLimit) {
      body = body.slice(0, platform.charLimit - 1) + '…';
    }

    return { title, body, tags };
  },

  // ─── Adapt to all selected platforms (parallel) ───
  async adaptForAll(draft, platformIds, language) {
    broadcastStore.set('isAdapting', true);
    try {
      const results = {};
      // Parallel with limited concurrency to avoid rate limits
      const concurrency = 3;
      const queue = [...platformIds];
      const workers = [];

      for (let i = 0; i < concurrency; i++) {
        workers.push((async () => {
          while (queue.length > 0) {
            const pid = queue.shift();
            try {
              const adapted = await this.adaptForPlatform(draft, pid, language);
              results[pid] = {
                ...adapted,
                language: language || draft.language || 'ja',
                charCount: (adapted.body || '').length,
                edited: false,
                adaptedAt: new Date().toISOString()
              };
            } catch (e) {
              results[pid] = { error: e.message, language };
            }
          }
        })());
      }

      await Promise.all(workers);

      // Save to store (merge with existing)
      const current = broadcastStore.get('adaptations') || {};
      broadcastStore.set('adaptations', { ...current, ...results });
      return results;
    } finally {
      broadcastStore.set('isAdapting', false);
    }
  },

  // ─── Translate a piece of text ───
  async translate(text, targetLang, charLimit) {
    const system = this.getPrompt('broadcast_translate');
    const userMsg = `【目標言語】${targetLang}
${charLimit ? `【文字数制限】${charLimit}文字以内` : ''}

【翻訳する原文】
${text}`;
    return await this.callModel(system, userMsg);
  },

  // ─── Generate title for blog-type content ───
  async generateTitle(body) {
    const system = this.getPrompt('broadcast_title');
    const userMsg = `【本文】\n${body}`;
    const result = await this.callModel(system, userMsg);
    return (result || '').trim().replace(/^[#\s]+/, '').split('\n')[0];
  },

  // ─── Generate hashtags ───
  async generateHashtags(body, platformId) {
    const platform = BROADCAST_CONFIG.platforms[platformId];
    const system = this.getPrompt('broadcast_hashtags');
    const userMsg = `【プラットフォーム】${platform?.name || platformId}\n\n【本文】\n${body}`;
    const result = await this.callModel(system, userMsg);
    return (result || '').split(/[,、]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
  },

  // ─── Summarize ───
  async summarize(text, maxChars) {
    const system = this.getPrompt('broadcast_summarize');
    const userMsg = `【最大文字数】${maxChars || 280}字\n\n【原文】\n${text}`;
    return await this.callModel(system, userMsg);
  },

  // ─── Post-distribution analysis ───
  async analyzeResults(broadcast) {
    const system = this.getPrompt('broadcast_analytics');
    const userMsg = `【配信データ】\n${JSON.stringify(broadcast, null, 2)}`;
    const result = await this.callModel(system, userMsg);

    // Save to history
    const entry = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      broadcastId: broadcast.id,
      response: result
    };
    const hist = broadcastStore.get('analysisHistory') || [];
    broadcastStore.set('analysisHistory', [...hist, entry]);
    broadcastStore.set('latestAnalysis', entry);
    return result;
  },

  // ─── Conversational chat (ask AI about broadcast strategy) ───
  async chat(userMessage) {
    const history = broadcastStore.get('conversationHistory') || [];
    history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    const system = `あなたはマルチプラットフォーム配信のコンサルタントです。
著者のコンテンツ戦略・配信計画・各プラットフォームの特性について、
やさしくわかりやすい日本語でアドバイスしてください。`;

    const response = await this.callModel(system, userMessage);

    history.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
    broadcastStore.set('conversationHistory', history);
    return response;
  }
};

if (typeof window !== 'undefined') window.BroadcastAI = BroadcastAI;
