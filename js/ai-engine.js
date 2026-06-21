/* ============================================================
   LMS - AI Engine
   Multi-model AI integration (Claude, GPT-4o, Gemini)
   ============================================================ */
var AIEngine = {

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

      let result;
      switch (modelConfig.provider) {
        case 'anthropic':
          result = await this.callAnthropic(model, systemPrompt, userMessage, modelConfig.maxTokens, options);
          break;
        case 'openai':
          result = await this.callOpenAI(model, systemPrompt, userMessage, modelConfig.maxTokens, options);
          break;
        case 'google':
          result = await this.callGemini(model, systemPrompt, userMessage, modelConfig.maxTokens, options);
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

    let msg = `[User Profile] Language: ${lang}`;
    if (profile.age) msg += `, Age: ${profile.age}`;
    if (profile.gender) msg += `, Gender: ${profile.gender}`;
    if (profile.location) msg += `, Location: ${profile.location}`;
    if (profile.displayName || profile.name) msg += `, Name: ${profile.displayName || profile.name}`;

    // Medical context (critical for 65+ users)
    const diseases = Array.isArray(profile.diseases) && profile.diseases.length > 0
      ? profile.diseases : null;
    if (diseases) msg += `\n[Existing Conditions] ${diseases.join(', ')}`;
    if (profile.medications) msg += `\n[Current Medications] ${profile.medications}`;
    if (profile.allergies) msg += `\n[Allergies] ${profile.allergies}`;

    // User's concerns and goals (entered during onboarding)
    if (profile.concerns) msg += `\n[Primary Concern] ${profile.concerns}`;
    if (profile.lifeGoals) msg += `\n[Life Goals] ${profile.lifeGoals}`;

    msg += '\n\n';

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

  // ─── Model ID translation (update here when Anthropic/OpenAI rotate IDs) ───
  MODEL_MAP: {
    'claude-sonnet-4-6': 'claude-sonnet-4-6-20260101',
    'claude-opus-4-6':   'claude-opus-4-6-20260201',
    'claude-haiku-4-5':  'claude-haiku-4-5-20251001',
    'gpt-4o':            'gpt-4o-2025-12-17',
    'gemini-pro':        'gemini-2.0-flash'
  },

  // ─── API Calls ───

  async callAnthropic(model, system, userMsg, maxTokens, options = {}) {
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

    console.log('[LMS] Calling Anthropic', isDirect ? '(direct)' : 'via proxy:', url);
    console.log('[LMS] Model:', model, 'Max tokens:', maxTokens);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.MODEL_MAP[model] || model,
          max_tokens: maxTokens,
          system: system,
          messages: [{ role: 'user', content: options.imageBase64
            ? [
                { type: 'image', source: { type: 'base64', media_type: options.imageMimeType || 'image/jpeg', data: options.imageBase64 } },
                { type: 'text', text: userMsg }
              ]
            : userMsg
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

  // ─── Anthropic streaming (SSE) ───
  async callAnthropicStream(model, system, userMsg, maxTokens, options = {}, onChunk) {
    const apiKey = this.getApiKey('anthropic');
    if (!apiKey) throw new Error('Anthropic APIキーが設定されていません。管理者にご連絡ください。');

    const endpoint = CONFIG.endpoints.anthropic;
    const isDirect = !endpoint || endpoint === 'direct' || endpoint.includes('your-account');
    const url = isDirect ? 'https://api.anthropic.com/v1/messages' : endpoint;

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
    if (isDirect) headers['anthropic-dangerous-direct-browser-access'] = 'true';

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.MODEL_MAP[model] || model,
        max_tokens: maxTokens,
        stream: true,
        system,
        messages: [{ role: 'user', content: options.imageBase64
          ? [
              { type: 'image', source: { type: 'base64', media_type: options.imageMimeType || 'image/jpeg', data: options.imageBase64 } },
              { type: 'text', text: userMsg }
            ]
          : userMsg
        }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('Claude APIエラー (HTTP ' + res.status + '): ' + err);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text;
            onChunk(evt.delta.text, fullText);
          }
        } catch (_) {}
      }
    }

    return fullText;
  },

  // ─── OpenAI streaming (SSE) ───
  async callOpenAIStream(model, system, userMsg, maxTokens, options = {}, onChunk) {
    const apiKey = this.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not set');

    const res = await fetch(CONFIG.endpoints.openai, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: this.MODEL_MAP[model] || model,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: options.imageBase64
            ? [
                { type: 'text', text: userMsg },
                { type: 'image_url', image_url: { url: `data:${options.imageMimeType || 'image/jpeg'};base64,${options.imageBase64}` } }
              ]
            : userMsg
          }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('OpenAI API error: ' + err);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          const delta = evt.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(delta, fullText);
          }
        } catch (_) {}
      }
    }

    return fullText;
  },

  async callOpenAI(model, system, userMsg, maxTokens, options = {}) {
    const apiKey = this.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not set');

    const res = await fetch(CONFIG.endpoints.openai, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: this.MODEL_MAP[model] || model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: options.imageBase64
            ? [
                { type: 'text', text: userMsg },
                { type: 'image_url', image_url: { url: `data:${options.imageMimeType || 'image/jpeg'};base64,${options.imageBase64}` } }
              ]
            : userMsg
          }
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

  async callGemini(model, system, userMsg, maxTokens, options = {}) {
    const apiKey = this.getApiKey('google');
    if (!apiKey) throw new Error('Google API key not set');

    const apiModel = this.MODEL_MAP[model] || model;
    const url = `${CONFIG.endpoints.google}/${apiModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: options.imageBase64
          ? [
              { inline_data: { mime_type: options.imageMimeType || 'image/jpeg', data: options.imageBase64 } },
              { text: userMsg }
            ]
          : [{ text: userMsg }]
        }],
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

  // ─── Gemini streaming (SSE via streamGenerateContent) ───
  async callGeminiStream(model, system, userMsg, maxTokens, options = {}, onChunk) {
    const apiKey = this.getApiKey('google');
    if (!apiKey) throw new Error('Google API key not set');

    const apiModel = this.MODEL_MAP[model] || model;
    const url = `${CONFIG.endpoints.google}/${apiModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: options.imageBase64
          ? [
              { inline_data: { mime_type: options.imageMimeType || 'image/jpeg', data: options.imageBase64 } },
              { text: userMsg }
            ]
          : [{ text: userMsg }]
        }],
        generationConfig: { maxOutputTokens: maxTokens }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('Gemini API error: ' + err);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          const text = evt.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
            onChunk(text, fullText);
          }
        } catch (_) {}
      }
    }

    return fullText;
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
