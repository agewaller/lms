/* ============================================================
   LMS - AI Engine
   Multi-model AI integration (Claude, GPT-4o, Gemini)
   ============================================================ */
var AIEngine = {

  // ─── Model ID mapping: internal config key → actual API model ID ───
  // Update dates here when Anthropic/OpenAI rotate model identifiers.
  MODEL_MAP: {
    'claude-sonnet-4-6': 'claude-sonnet-4-6-20260101',
    'claude-opus-4-6':   'claude-opus-4-6-20260201',
    'claude-haiku-4-5':  'claude-haiku-4-5-20251001',
    'gpt-4o':            'gpt-4o-2025-12-17',
    'gemini-pro':        'gemini-2.0-flash'
  },

  // Resolve internal config model ID to API-ready model ID
  resolveModelId(model) {
    return this.MODEL_MAP[model] || model;
  },

  // ─── Main analysis entry point ───
  async analyze(domain, promptType, userData, options = {}) {
    const model = options.model || store.get('selectedModel') || 'claude-sonnet-4-6';
    const modelConfig = CONFIG.aiModels[model];
    if (!modelConfig) throw new Error('Unknown model: ' + model);

    store.set('isAnalyzing', true);

    try {
      // Build the prompt
      const systemPrompt = this.buildSystemPrompt(domain, promptType);
      const userMessage = this.buildUserMessage(domain, userData);

      const imageBase64 = options.imageBase64 || null;
      const imageMime = options.imageMime || 'image/jpeg';

      let result;
      switch (modelConfig.provider) {
        case 'anthropic':
          result = await this.callAnthropic(model, systemPrompt, userMessage, modelConfig.maxTokens, imageBase64, imageMime);
          break;
        case 'openai':
          result = await this.callOpenAI(model, systemPrompt, userMessage, modelConfig.maxTokens, imageBase64, imageMime);
          break;
        case 'google':
          result = await this.callGemini(model, systemPrompt, userMessage, modelConfig.maxTokens, imageBase64, imageMime);
          break;
        default:
          throw new Error('Unknown provider: ' + modelConfig.provider);
      }

      // Save to history
      const entry = {
        id: Date.now().toString(36),
        timestamp: new Date().toISOString(),
        domain,
        promptType,
        model,
        response: result,
        userData: userData
      };
      const history = [...(store.get('analysisHistory') || []), entry];
      store.set('analysisHistory', history);
      store.set('latestAnalysis', entry);

      return result;
    } finally {
      store.set('isAnalyzing', false);
    }
  },

  // ─── Build system prompt (未病ダイアリー準拠: flat key lookup) ───
  buildSystemPrompt(domain, promptType) {
    // Custom prompts override (from admin panel)
    const custom = store.get('customPrompts') || {};

    // Build the flat key: {domain}_{type}
    // Legacy aliases for backward compatibility
    let key;
    if (promptType === 'holistic') key = 'universal_holistic';
    else if (promptType === 'weekly') key = 'universal_weekly';
    else if (promptType === 'quickInput' || promptType === 'text_analysis') key = 'text_analysis';
    else if (promptType === 'imageAnalysis' || promptType === 'image_analysis') key = 'image_analysis';
    else if (promptType === 'transcript_analysis') key = 'consciousness_transcript';
    else if (promptType === 'stock_analysis') key = 'stock_analysis'; // short inline prompt
    else if (promptType === 'stock_full') key = 'assets_stock';      // full VM Hands-on
    else if (promptType === 'enrich_contact') key = 'relationship_enrich';
    else if (domain && promptType) key = `${domain}_${promptType}`;
    else if (domain) key = `${domain}_daily`;
    else key = 'universal_daily';

    // Custom admin-edited prompt
    if (custom[key]?.prompt) return custom[key].prompt;

    // Config prompts (object shape with .prompt)
    const p = CONFIG.prompts[key] || CONFIG.inlinePrompts[key];
    if (p && typeof p === 'object') return p.prompt || '';
    if (typeof p === 'string') return p;  // backward compat

    // Fallback to universal daily
    return CONFIG.prompts.universal_daily?.prompt || '';
  },

  // ─── Build user message with context ───
  buildUserMessage(domain, userData) {
    const profile = store.get('userProfile') || {};
    const lang = i18n.currentLang;

    let msg = `[ユーザー情報] 言語: ${lang}`;
    if (profile.age) msg += `、年齢: ${profile.age}歳`;
    if (profile.gender) msg += `、性別: ${{ male: '男性', female: '女性', other: 'その他' }[profile.gender] || profile.gender}`;
    if (profile.location) msg += `、居住地: ${profile.location}`;
    if (profile.householdComposition) msg += `、世帯: ${profile.householdComposition}`;
    if (profile.occupation) msg += `、職業: ${profile.occupation}`;
    msg += '\n';

    // Health-specific profile context
    if (domain === 'health' || domain === 'holistic' || !domain) {
      if (Array.isArray(profile.diseases) && profile.diseases.length > 0) {
        msg += `持病・既往症: ${profile.diseases.join('、')}\n`;
      }
      if (profile.medications) {
        msg += `服薬中: ${profile.medications}\n`;
      }
      if (profile.allergies) {
        msg += `アレルギー: ${profile.allergies}\n`;
      }
    }

    // Goals and concerns for holistic analysis
    if (domain === 'holistic' || !domain) {
      if (profile.lifeGoals) msg += `人生の目標: ${profile.lifeGoals}\n`;
      if (profile.concerns) msg += `現在の悩み: ${profile.concerns}\n`;
    }

    msg += '\n';

    if (domain === 'holistic' || !domain) {
      // Cross-domain: gather recent data from all domains
      Object.keys(CONFIG.domains).forEach(d => {
        const domainData = this.gatherDomainData(d, 7);
        if (domainData) msg += `[${i18n.t(d)}]\n${domainData}\n\n`;
      });
    } else {
      // Single domain
      const domainData = this.gatherDomainData(domain, 7);
      if (domainData) msg += `[${i18n.t(domain)} Data]\n${domainData}\n\n`;
    }

    // Append user's direct input if any
    if (userData?.text) msg += `[User Input]\n${userData.text}\n`;
    if (userData?.raw) msg += `\n${JSON.stringify(userData.raw, null, 2)}`;

    return msg;
  },

  // ─── Gather recent data for a domain ───
  gatherDomainData(domain, days) {
    const categories = CONFIG.domains[domain]?.categories || {};
    const parts = [];

    Object.keys(categories).forEach(cat => {
      const data = store.getDomainData(domain, cat, days);
      if (data.length > 0) {
        parts.push(`${i18n.t(categories[cat].label)}: ${JSON.stringify(data.slice(-10))}`);
      }
    });

    return parts.length > 0 ? parts.join('\n') : null;
  },

  // ─── API Calls ───

  async callAnthropic(model, system, userMsg, maxTokens, imageBase64 = null, imageMime = 'image/jpeg') {
    const apiKey = this.getApiKey('anthropic');
    if (!apiKey) throw new Error('Anthropic APIキーが設定されていません。管理者にご連絡ください。');

    const endpoint = CONFIG.endpoints.anthropic;

    // ─── Direct browser mode (no proxy) ───
    // Used when:
    //   - endpoint is empty / unset
    //   - endpoint is the literal "direct"
    //   - endpoint still contains placeholder "your-account"
    // Anthropic supports browser-direct calls via the
    // 'anthropic-dangerous-direct-browser-access' header.
    const isDirect = !endpoint
      || endpoint === 'direct'
      || endpoint.includes('your-account');

    const url = isDirect
      ? 'https://api.anthropic.com/v1/messages'
      : endpoint;

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
    if (isDirect) {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const apiModelId = this.resolveModelId(model);
    console.log('[LMS] Calling Anthropic', isDirect ? '(direct)' : 'via proxy:', url);
    console.log('[LMS] Model:', apiModelId, 'Max tokens:', maxTokens);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: apiModelId,
          max_tokens: maxTokens,
          system: system,
          messages: [{
            role: 'user',
            content: imageBase64 ? [
              { type: 'image', source: { type: 'base64', media_type: imageMime, data: imageBase64 } },
              { type: 'text', text: userMsg }
            ] : userMsg
          }]
        })
      });
    } catch (e) {
      console.error('[LMS] fetch failed:', e);
      throw new Error(
        (isDirect ? 'Anthropicに直接接続できません。' : 'プロキシに接続できません。') + '\n' +
        '原因: ' + (e.message || e.name || 'unknown') + '\n' +
        'URL: ' + url + '\n' +
        '\nブラウザのコンソールで詳細を確認してください。'
      );
    }

    console.log('[LMS] Anthropic responded with status:', res.status);

    if (!res.ok) {
      const err = await res.text();
      console.error('[LMS] Anthropic error body:', err);
      throw new Error('Claude APIエラー (HTTP ' + res.status + '): ' + err);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '';
  },

  async callOpenAI(model, system, userMsg, maxTokens, imageBase64 = null, imageMime = 'image/jpeg') {
    const apiKey = this.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not set');

    const userContent = imageBase64 ? [
      { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
      { type: 'text', text: userMsg }
    ] : userMsg;

    const res = await fetch(CONFIG.endpoints.openai, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: this.resolveModelId(model),
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('OpenAI API error: ' + err);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },

  async callGemini(model, system, userMsg, maxTokens, imageBase64 = null, imageMime = 'image/jpeg') {
    const apiKey = this.getApiKey('google');
    if (!apiKey) throw new Error('Google API key not set');

    const parts = imageBase64
      ? [{ inline_data: { mime_type: imageMime, data: imageBase64 } }, { text: userMsg }]
      : [{ text: userMsg }];

    const url = `${CONFIG.endpoints.google}/${this.resolveModelId(model)}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: maxTokens }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('Gemini API error: ' + err);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  // ─── API Key Management ───
  getApiKey(provider) {
    // Try Firebase-stored keys first, then localStorage
    const keys = store.get('_apiKeys') || {};
    return keys[provider] || localStorage.getItem(`lms_apikey_${provider}`) || '';
  },

  setApiKey(provider, key) {
    const keys = store.get('_apiKeys') || {};
    keys[provider] = key;
    store.state._apiKeys = keys;
    localStorage.setItem(`lms_apikey_${provider}`, key);
  },

  // ─── Quick Input Analysis ───
  async quickAnalyze(text) {
    return await this.analyze(null, 'quickInput', { text });
  },

  // ─── Conversation (chat) ───
  async chat(domain, userMessage) {
    const history = store.get('conversationHistory') || [];

    // Add user message
    history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      domain
    });

    // Get AI response
    const response = await this.analyze(domain, 'daily', { text: userMessage });

    // Add AI response
    history.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
      domain
    });

    store.set('conversationHistory', history);
    return response;
  }
};
