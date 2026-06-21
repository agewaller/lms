/* ============================================================
   LMS - Main Application Controller
   ============================================================ */
var App = class App {
  constructor() {
    this.entryDomain = null;
    this._pwaPrompt = null;
    // Capture beforeinstallprompt early so we can trigger it later
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._pwaPrompt = e;
    });
  }

  // ─── Initialize ───
  async init(entryDomain, entryPage) {
    this.entryDomain = entryDomain || null;
    this.entryPage = entryPage || null;
    this._applyTextSize(localStorage.getItem('lms_textSize') || 'normal');
    this._applyTheme(localStorage.getItem('lms_theme') || 'light');
    this.checkOAuthCallbacks();

    // Initialize Firebase
    await FirebaseBackend.init();

    // Check if already authenticated
    if (store.get('isAuthenticated') && store.get('user')) {
      store.set('currentDomain', entryDomain || store.get('currentDomain') || 'health');
      store.set('currentPage', entryPage || 'home');
      this.renderApp();
      this.startInboxPolling();
      setTimeout(() => this.checkFirstRun(), 1200);
      setTimeout(() => this.runScheduledPrompts(), 5000);
      setTimeout(() => this._checkPwaInstallOffer(), 10000);
      setTimeout(() => this._checkDailyReminder(), 3000);
    }

    // Listen for auth changes
    store.on('isAuthenticated', (val) => {
      if (val) {
        store.set('currentDomain', this.entryDomain || store.get('currentDomain') || 'health');
        store.set('currentPage', this.entryPage || 'home');
        this.renderApp();
        this.startInboxPolling();
        setTimeout(() => this.checkFirstRun(), 1200);
        setTimeout(() => this.runScheduledPrompts(), 5000);
        setTimeout(() => this._checkPwaInstallOffer(), 10000);
        setTimeout(() => this._checkDailyReminder(), 3000);
      } else {
        this.stopInboxPolling();
      }
    });

    // Listen for navigation changes
    store.on('currentPage', () => this.renderApp());
    store.on('currentDomain', () => this.renderApp());
  }

  // ─── Inbox polling: fetch Plaud auto-sent transcripts ───
  startInboxPolling() {
    if (this._inboxPollTimer) return;

    // Poll immediately, then every 2 minutes
    this.pollPlaudInbox();
    this._inboxPollTimer = setInterval(() => this.pollPlaudInbox(), 2 * 60 * 1000);
  }

  stopInboxPolling() {
    if (this._inboxPollTimer) {
      clearInterval(this._inboxPollTimer);
      this._inboxPollTimer = null;
    }
  }

  // ─── Scheduled prompt runner: fires once per day on app load ───
  async runScheduledPrompts() {
    const today = new Date().toISOString().split('T')[0];
    const lastRun = localStorage.getItem('lms_lastScheduledRun');
    if (lastRun === today) return;

    // Need some data before running
    const domain = store.get('currentDomain') || 'health';
    const categories = Object.keys(CONFIG.domains[domain]?.categories || {});
    let entryCount = 0;
    categories.forEach(cat => { entryCount += store.getDomainData(domain, cat, 7).length; });
    if (entryCount < 2) return;

    // Find active daily prompt for current domain
    const prompts = store.get('customPrompts') || {};
    const allPrompts = { ...CONFIG.prompts, ...prompts };
    const dailyKey = `${domain}_daily`;
    const promptObj = allPrompts[dailyKey] || allPrompts['universal_daily'];
    if (!promptObj || promptObj.active === false) return;

    try {
      await AIEngine.analyze(domain, dailyKey.replace(`${domain}_`, '') || 'daily', {});
      localStorage.setItem('lms_lastScheduledRun', today);
      Components.showToast('今日の分析が完了しました。ホームをご確認ください。', 'info');
      if (store.get('currentPage') === 'home') this.renderApp();
    } catch (e) {
      console.warn('Scheduled prompt error:', e);
    }
  }

  async pollPlaudInbox() {
    if (typeof plaud === 'undefined' || !plaud.pollInbox) return;
    try {
      const result = await plaud.pollInbox();
      if (result?.processed > 0) {
        Components.showToast(
          `Plaudから${result.processed}件の文字起こしを取り込みました`,
          'success'
        );
        // Re-render if on consciousness domain or integrations page
        const page = store.get('currentPage');
        const domain = store.get('currentDomain');
        if (domain === 'consciousness' || page === 'integrations') {
          this.renderApp();
        }
      }
    } catch (e) {
      console.warn('Inbox poll error:', e);
    }
  }

  // ─── Login Methods ───
  async loginWithGoogle() {
    await FirebaseBackend.signInWithGoogle();
  }

  async loginWithEmail() {
    const email = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!email) {
      Components.showToast('メールアドレスを入力してください', 'error');
      return;
    }
    if (!password) {
      Components.showToast('パスワードを入力してください', 'error');
      return;
    }
    try {
      await FirebaseBackend.signInWithEmail(email, password);
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
  }

  async registerWithEmail() {
    const name = document.getElementById('registerName')?.value?.trim();
    const email = document.getElementById('registerEmail')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    const confirm = document.getElementById('registerPasswordConfirm')?.value;

    if (!email) {
      Components.showToast('メールアドレスを入力してください', 'error');
      return;
    }
    if (!password) {
      Components.showToast('パスワードを入力してください', 'error');
      return;
    }
    if (password.length < 6) {
      Components.showToast('パスワードは6文字以上にしてください', 'error');
      return;
    }
    if (password !== confirm) {
      Components.showToast('パスワードが一致しません', 'error');
      return;
    }
    try {
      await FirebaseBackend.registerWithEmail(email, password, name);
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
  }

  async resetPassword() {
    const email = document.getElementById('loginEmail')?.value?.trim() ||
                  document.getElementById('resetEmail')?.value?.trim();
    if (!email) {
      Components.showToast('メールアドレスを入力してください', 'error');
      return;
    }
    try {
      await FirebaseBackend.sendPasswordReset(email);
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
  }

  toggleAuthMode(mode) {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('auth-' + mode);
    if (panel) panel.classList.add('active');
  }

  async logout() {
    await FirebaseBackend.signOut();
    // Redirect to appropriate landing page
    if (this.entryDomain) {
      window.location.href = this.entryDomain + '.html';
    } else {
      window.location.href = 'index.html';
    }
  }

  // ─── Navigation ───
  switchDomain(domain) {
    store.set('currentDomain', domain);
    store.set('currentPage', 'home');
  }

  navigate(page) {
    store.set('currentPage', page);
  }

  // ─── Main Render (未病ダイアリー方式) ───
  renderApp() {
    const page = store.get('currentPage');
    const domain = store.get('currentDomain');

    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    // Update top bar title
    const titleEl = document.getElementById('top-bar-title');
    const domainConfig = CONFIG.domains[domain];
    const pageNames = { home: 'ホーム', record: '記録する', data: 'データ', actions: 'アクション', ask_ai: '相談する', settings: '設定', admin: '管理', doctor_report: '受診準備レポート', integrations: '連携' };
    if (titleEl) titleEl.textContent = page === 'doctor_report'
      ? '受診準備レポート'
      : `${domainConfig?.icon || ''} ${i18n.t(domain)} - ${pageNames[page] || page}`;

    // Update sidebar nav active states
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    document.querySelectorAll('.domain-nav').forEach(el => {
      el.classList.toggle('active', el.dataset.domain === domain);
    });

    // Update sidebar user info
    this.updateSidebar();

    // Render page content
    mainContent.innerHTML = Pages.render(page, domain);

    // Auto-close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    }

    // Scroll chat to bottom
    if (page === 'ask_ai') {
      setTimeout(() => {
        const chat = document.getElementById('chatContainer');
        if (chat) chat.scrollTop = chat.scrollHeight;
      }, 50);
    }

    // Initialize PayPal
    if (page === 'settings') {
      setTimeout(() => {
        Object.keys(CONFIG.paypal.plans).forEach(key => {
          PayPalManager.renderButtons('paypal-btn-' + key, key);
        });
      }, 100);
    }

    // Auto-calculate NISA on assets home
    if (domain === 'assets' && page === 'home') {
      setTimeout(() => {
        if (typeof AssetsFeatures !== 'undefined') AssetsFeatures.calculateNISA();
      }, 100);
    }

    // Initialize trend chart on home page
    if (page === 'home') {
      setTimeout(() => Pages.initTrendChart(domain), 150);
    }
  }

  updateSidebar() {
    const user = store.get('user');
    const nameEl = document.getElementById('userName');
    const avatarEl = document.getElementById('userAvatar');
    const domainLabel = document.getElementById('currentDomainLabel');

    if (nameEl) nameEl.textContent = user?.displayName || user?.email || 'ゲスト';
    if (avatarEl) {
      if (user?.photoURL && /^https?:\/\//i.test(user.photoURL)) {
        const img = document.createElement('img');
        img.src = user.photoURL;
        img.alt = '';
        avatarEl.textContent = '';
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = (user?.displayName || user?.email || '?').charAt(0).toUpperCase();
      }
    }
    if (domainLabel) {
      const d = store.get('currentDomain');
      domainLabel.textContent = i18n.t(d);
    }

    // Admin mode: show admin nav items via body class only.
    // We avoid setting inline style because CSS `.admin-only { display: none }`
    // and `body.is-admin .admin-only { display: flex }` already handles this,
    // and inline style would override the CSS class toggling.
    const isAdmin = FirebaseBackend.isAdmin();
    document.body.classList.toggle('is-admin', isAdmin);
  }

  // ─── Voice Input (Web Speech API) ───
  startVoiceInput(targetId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Components.showToast('このブラウザは音声入力に対応していません', 'error');
      return;
    }
    const btn = document.getElementById('voiceBtn_' + targetId);
    if (this._recognition) {
      this._recognition.stop();
      this._recognition = null;
      if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; }
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this._recognition = rec;
    if (btn) { btn.classList.add('recording'); btn.textContent = '⏹'; }
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      const el = document.getElementById(targetId);
      if (el) el.value = transcript;
    };
    rec.onend = () => {
      this._recognition = null;
      if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; }
    };
    rec.onerror = (e) => {
      this._recognition = null;
      if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; }
      if (e.error !== 'aborted') Components.showToast('音声認識エラー: ' + e.error, 'error');
    };
    rec.start();
    Components.showToast('話しかけてください...', 'info');
  }

  // ─── Quick Input ───
  async quickInput() {
    const input = document.getElementById('quickInput');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    const domain = store.get('currentDomain');
    const responseEl = document.getElementById('quickResponse');

    if (responseEl) responseEl.innerHTML = Components.loading(i18n.t('analyzing'));

    try {
      const result = await AIEngine.analyze(domain, 'quickInput', { text });

      // Extract JSON from the response. The model may wrap it in a
      // markdown code fence (```json ... ```) or return plain JSON,
      // or return a raw string when it ignores the format instruction.
      let parsed = null;
      const cleaned = this.extractJsonFromResponse(result);
      if (cleaned) {
        try { parsed = JSON.parse(cleaned); } catch (e) { parsed = null; }
      }

      // Save to conversation history so user can review in 相談する page
      const ts = new Date().toISOString();
      const history = store.get('conversationHistory') || [];
      const responseText = parsed?.response || result;
      if (responseText) {
        history.push({ role: 'user', content: text, timestamp: ts, domain, source: 'quickInput' });
        history.push({ role: 'assistant', content: responseText, timestamp: ts, domain, source: 'quickInput' });
        store.set('conversationHistory', history.slice(-200));
      }

      if (parsed && (parsed.response || parsed.actions)) {
        let html = '<div class="quick-response">';
        if (parsed.response) {
          html += `<div class="qr-body">${Components.formatMarkdown(parsed.response)}</div>`;
        }
        if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
          html += '<div class="qr-actions"><strong>おすすめの行動</strong><ul>';
          parsed.actions.forEach(a => {
            const label = typeof a === 'string' ? a : (a.text || JSON.stringify(a));
            html += `<li>${Components.formatMarkdown(label)}</li>`;
          });
          html += '</ul></div>';
        }
        html += `<div class="qr-footer"><button class="btn btn-sm btn-secondary" onclick="app.navigate('ask_ai')">続きを相談する →</button></div>`;
        html += '</div>';
        if (responseEl) responseEl.innerHTML = html;
      } else {
        // Fallback: strip code fences and display as markdown
        const stripped = (result || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
        if (responseEl) responseEl.innerHTML = `<div class="quick-response">${Components.formatMarkdown(stripped)}<div class="qr-footer"><button class="btn btn-sm btn-secondary" onclick="app.navigate('ask_ai')">続きを相談する →</button></div></div>`;
      }

      input.value = '';
    } catch (e) {
      if (responseEl) responseEl.innerHTML = `<div class="error-msg">${Components.escapeHtml(e.message)}</div>`;
    }
  }

  // Extract a JSON object from the model's response.
  // Handles: raw JSON, ```json fenced blocks, ``` fenced blocks, or
  // JSON embedded in surrounding prose.
  extractJsonFromResponse(text) {
    if (!text) return null;
    // 1. Try fenced code block
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
    // 2. Try finding a JSON object in the text
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1).trim();
    }
    return text.trim();
  }

  // ─── Record Save ───
  saveRecord(domain, category) {
    const form = document.querySelector(`form[data-domain="${domain}"][data-category="${category}"]`);
    if (!form) return;

    const data = {};
    const formData = new FormData(form);
    formData.forEach((value, key) => {
      if (value !== '' && value !== undefined) {
        data[key] = isNaN(value) ? value : Number(value);
      }
    });

    // Handle checkboxes (toggles)
    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      data[cb.name] = cb.checked;
    });

    // Capture pain location selections (health symptoms only)
    if (domain === 'health' && category === 'symptoms') {
      const selectedParts = Array.from(document.querySelectorAll('.pain-part-btn.selected'))
        .map(b => b.dataset.label);
      if (selectedParts.length > 0) data.pain_location = selectedParts.join('・');
      document.querySelectorAll('.pain-part-btn').forEach(b => b.classList.remove('selected'));
    }

    store.addDomainEntry(domain, category, data);
    Components.showToast(i18n.t('saved'), 'success');
    form.reset();
    // Sync slider display spans after reset (oninput won't fire on programmatic reset)
    form.querySelectorAll('input[type="range"]').forEach(r => {
      const span = r.nextElementSibling;
      if (span && span.classList.contains('slider-val')) span.textContent = r.value;
    });
  }

  async saveAndAnalyze(domain, category) {
    this.saveRecord(domain, category);
    const data = store.getDomainData(domain, category, 1);
    try {
      await AIEngine.analyze(domain, 'daily', { raw: data[data.length - 1] });
      Components.showToast(i18n.t('ai_analysis') + ' ✓', 'success');
      this.renderApp();
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
  }

  // ─── Diary Save ───
  saveDiary(domain) {
    const textarea = document.getElementById('diaryText');
    if (!textarea || !textarea.value.trim()) return;

    store.addDomainEntry(domain, 'entries', {
      type: 'diary',
      text: textarea.value.trim()
    });

    Components.showToast(i18n.t('saved'), 'success');
    textarea.value = '';
  }

  async saveDiaryAndAnalyze(domain) {
    const textarea = document.getElementById('diaryText');
    if (!textarea || !textarea.value.trim()) return;

    const text = textarea.value.trim();
    this.saveDiary(domain);

    try {
      await AIEngine.analyze(domain, 'daily', { text });
      Components.showToast(i18n.t('ai_analysis') + ' ✓', 'success');
      this.renderApp();
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
  }

  // ─── Daily Prompt Reply: navigate to chat with question pre-filled ───
  replyToPrompt(question) {
    const domain = store.get('currentDomain') || 'health';
    store.set('currentPage', 'ask_ai');
    setTimeout(() => {
      const input = document.getElementById('chatInput');
      if (input) {
        input.value = question;
        input.focus();
      }
    }, 100);
  }

  // ─── Clear conversation for a domain ───
  clearChat(domain) {
    Components.confirmModal('この会話の履歴をすべて消去しますか？', () => {
      const history = store.get('conversationHistory') || [];
      const filtered = history.filter(m => m.domain !== domain);
      store.set('conversationHistory', filtered);
      this.renderApp();
    }, '消去する', true);
  }

  // ─── AI Chat ───
  async sendChat(domain) {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    const container = document.getElementById('chatContainer');
    const ts = new Date().toISOString();

    // Save user message and append immediately
    const history = store.get('conversationHistory') || [];
    const userMsg = { role: 'user', content: text, timestamp: ts, domain };
    history.push(userMsg);
    store.set('conversationHistory', history);

    if (container) {
      if (container.querySelector('.empty-state')) container.innerHTML = '';
      container.innerHTML += Components.chatMessage(userMsg);
    }

    // Create a placeholder element for the streaming assistant response
    const streamId = 'stream-' + Date.now();
    if (container) {
      container.insertAdjacentHTML('beforeend',
        `<div class="chat-msg chat-ai" id="${streamId}">
          <div class="chat-icon">◈</div>
          <div class="chat-content" id="${streamId}-c">${Components.loading('')}</div>
        </div>`
      );
      container.scrollTop = container.scrollHeight;
    }

    try {
      const model = store.get('selectedModel') || 'claude-sonnet-4-6';
      const modelConfig = CONFIG.aiModels[model];
      const systemPrompt = AIEngine.buildSystemPrompt(domain, 'daily');
      const userMessage = AIEngine.buildUserMessage(domain, { text });

      let fullResponse = '';
      const contentEl = () => document.getElementById(streamId + '-c');

      const onChunk = (_delta, full) => {
        fullResponse = full;
        const el = contentEl();
        if (el) {
          el.innerHTML = Components.formatMarkdown(full) + '<span class="stream-cursor">▋</span>';
          if (container) container.scrollTop = container.scrollHeight;
        }
      };

      if (modelConfig?.provider === 'anthropic') {
        fullResponse = await AIEngine.callAnthropicStream(
          model, systemPrompt, userMessage, modelConfig.maxTokens, {}, onChunk
        );
      } else if (modelConfig?.provider === 'openai') {
        fullResponse = await AIEngine.callOpenAIStream(
          model, systemPrompt, userMessage, modelConfig.maxTokens, {}, onChunk
        );
      } else if (modelConfig?.provider === 'google') {
        fullResponse = await AIEngine.callGeminiStream(
          model, systemPrompt, userMessage, modelConfig.maxTokens, {}, onChunk
        );
      } else {
        fullResponse = await AIEngine.analyze(domain, 'daily', { text });
        onChunk(fullResponse, fullResponse);
      }

      // Finalize: remove cursor
      const el = contentEl();
      if (el) el.innerHTML = Components.formatMarkdown(fullResponse);

      // Save assistant message to history
      const updated = store.get('conversationHistory') || [];
      updated.push({ role: 'assistant', content: fullResponse, timestamp: new Date().toISOString(), domain });
      store.set('conversationHistory', updated);

    } catch (e) {
      const msgEl = document.getElementById(streamId);
      if (msgEl) msgEl.outerHTML = Components.chatMessage({
        role: 'assistant',
        content: '申し訳ありません。エラーが発生しました: ' + Components.escapeHtml(e.message || ''),
        timestamp: new Date().toISOString()
      });
    }
  }

  // ─── Generate AI Recommendations ───
  async generateRecommendations(domain) {
    try {
      const isHolistic = domain === 'holistic';
      const result = await AIEngine.analyze(
        isHolistic ? null : domain,
        isHolistic ? 'holistic' : 'daily',
        {}
      );

      // Parse recommendations from AI response
      const recs = [{
        domain: isHolistic ? 'all' : domain,
        text: result,
        priority: 'medium',
        timestamp: new Date().toISOString()
      }];

      const existing = store.get('recommendations') || [];
      store.set('recommendations', [...recs, ...existing].slice(0, 50));

      this.renderApp();
      Components.showToast('分析が完了しました。アクションページをご確認ください', 'success');
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
  }

  // ─── Action Items ───
  toggleAction(index) {
    const actions = store.get('actionItems') || [];
    if (actions[index]) {
      actions[index].done = !actions[index].done;
      store.set('actionItems', [...actions]);
    }
  }

  executeAction(type, data) {
    // Placeholder for action execution (e.g., open affiliate link, book appointment)
    console.log('Execute action:', type, data);
    Components.showToast('Action: ' + type, 'info');
  }

  // ─── Delete a single domain entry (localStorage + Firestore) ───
  deleteEntry(domain, category, id) {
    Components.confirmModal('この記録を削除しますか？', () => {
      const key = `${domain}_${category}`;
      const entries = (store.get(key) || []).filter(e => e.id !== id);
      store.set(key, entries);

      const uid = store.get('user')?.uid;
      if (uid && FirebaseBackend.db) {
        FirebaseBackend.db.collection('users').doc(uid)
          .collection(key).doc(id)
          .delete()
          .catch(e => console.warn('Delete sync error:', e));
      }

      Components.showToast('削除しました', 'info');
      this.renderApp();
    }, '削除する', true);
  }

  // ─── Medication taken log (health domain) ───
  logMedicationTaken() {
    store.addDomainEntry('health', 'symptoms', {
      medications_taken: true,
      notes: '薬を服用しました'
    });
    Components.showToast('薬の服用を記録しました ✓', 'success');
    this.renderApp();
  }

  // ─── Stock Analysis (Assets domain) ───
  // Uses the VM Hands-on prompt (assets_stock) configured by admin.
  // The prompt is loaded via AIEngine.buildSystemPrompt which maps
  // promptType 'stock_analysis' to the flat key 'assets_stock'.
  async analyzeStock() {
    const input = document.getElementById('stockTicker');
    const ticker = input?.value?.trim();
    if (!ticker) {
      Components.showToast('銘柄名またはティッカーを入力してください', 'info');
      return;
    }

    const resultEl = document.getElementById('stockResult');
    if (resultEl) resultEl.innerHTML = Components.loading(`${Components.escapeHtml(ticker)} を分析中です...`);

    // Pre-check: admin must have configured an API key
    if (!AIEngine.getApiKey('anthropic') && !AIEngine.getApiKey('openai') && !AIEngine.getApiKey('google')) {
      if (resultEl) {
        resultEl.innerHTML = `<div class="error-msg">
          <strong>分析できません</strong><br>
          管理者がAIキーを設定していないため、分析を実行できません。管理者にご連絡ください。
        </div>`;
      }
      return;
    }

    try {
      // promptType='stock_analysis' is mapped to config key 'assets_stock'
      // (VM Hands-on prompt) via ai-engine's buildSystemPrompt legacy alias.
      const result = await AIEngine.analyze('assets', 'stock_analysis', {
        text: `COMPANY: ${ticker}\nTIME_NOW: ${new Date().toISOString().slice(0, 10)}`
      });

      if (!result || !result.trim()) {
        throw new Error('分析結果が空でした。プロンプト設定をご確認ください。');
      }

      if (resultEl) {
        resultEl.innerHTML = `<div class="stock-result">
          <h3>${ticker} の分析結果</h3>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
          <div class="disclaimer">${i18n.t('disclaimer_assets')}</div>
        </div>`;
      }
    } catch (e) {
      console.error('Stock analysis error:', e);
      if (resultEl) {
        resultEl.innerHTML = `<div class="error-msg">
          <strong>分析できませんでした</strong><br>
          ${Components.escapeHtml(e.message || 'もう一度お試しください')}
        </div>`;
      }
    }
  }

  // ─── Contact Import (Trust domain) ───
  async importContacts(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      let contacts = [];

      if (file.name.endsWith('.csv')) {
        contacts = this.parseCSVContacts(content);
      } else if (file.name.endsWith('.vcf')) {
        contacts = this.parseVCardContacts(content);
      } else if (file.name.endsWith('.json')) {
        try { contacts = JSON.parse(content); } catch (err) { /* ignore */ }
      }

      if (contacts.length > 0) {
        contacts.forEach(c => {
          store.addDomainEntry('relationship', 'contacts', {
            name: c.name || c.Name || '',
            furigana: c.furigana || c.Furigana || '',
            phone: c.phone || c.Phone || c.TEL || '',
            email: c.email || c.Email || '',
            address: c.address || c.Address || '',
            company: c.company || c.Company || c.Organization || '',
            title: c.title || c.Title || '',
            birthday: c.birthday || c.Birthday || '',
            distance: c.distance || '4',
            relationship: c.relationship || 'other',
            notes: c.notes || ''
          });
        });
        Components.showToast(`${contacts.length}件の連絡先を取り込みました`, 'success');
        this.renderApp();
      } else {
        Components.showToast('取り込める連絡先が見つかりませんでした', 'error');
      }
    };
    reader.readAsText(file);
  }

  parseCSVContacts(csv) {
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
  }

  parseVCardContacts(vcf) {
    const contacts = [];
    const cards = vcf.split('BEGIN:VCARD');

    cards.forEach(card => {
      if (!card.trim()) return;
      const contact = {};
      const lines = card.split('\n');
      lines.forEach(line => {
        const l = line.trim();
        if (l.startsWith('FN:') || l.startsWith('FN;')) contact.name = l.split(':').slice(1).join(':');
        else if (l.startsWith('TEL')) contact.phone = l.split(':').slice(1).join(':');
        else if (l.startsWith('EMAIL')) contact.email = l.split(':').slice(1).join(':');
        else if (l.startsWith('ADR')) contact.address = l.split(':').slice(1).join(':').replace(/;/g, ' ');
        else if (l.startsWith('ORG')) contact.company = l.split(':').slice(1).join(':');
        else if (l.startsWith('TITLE')) contact.title = l.split(':').slice(1).join(':');
        else if (l.startsWith('BDAY')) contact.birthday = l.split(':').slice(1).join(':');
      });
      if (contact.name) contacts.push(contact);
    });
    return contacts;
  }

  // ─── Enrich Contacts via AI ───
  async enrichContacts() {
    const contacts = store.get('relationship_contacts') || [];
    if (contacts.length === 0) {
      Components.showToast('まだ連絡先がありません', 'info');
      return;
    }

    const unenriched = contacts.filter(c => !c._enriched).slice(0, 5);
    if (unenriched.length === 0) {
      Components.showToast('すべての連絡先の情報は最新です', 'info');
      return;
    }

    Components.showToast(`${unenriched.length}名の情報を調べています...`, 'info');

    for (const contact of unenriched) {
      try {
        const info = `名前: ${contact.name}, 会社: ${contact.company || '不明'}, 役職: ${contact.title || '不明'}, 住所: ${contact.address || '不明'}`;
        const result = await AIEngine.analyze('relationship', 'enrich_contact', { text: info });
        contact._enriched = true;
        contact._enrichData = result;
        contact._enrichedAt = new Date().toISOString();
      } catch (e) {
        console.warn('Enrich failed for', contact.name, e);
      }
    }

    store.set('relationship_contacts', [...contacts]);
    Components.showToast('情報を更新しました', 'success');
    this.renderApp();
  }

  // ─── Integration Handlers (未病ダイアリー方式) ───

  importCalendarFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof CalendarIntegration !== 'undefined') {
        CalendarIntegration.importICS(e.target.result);
        this.renderApp();
      }
    };
    reader.readAsText(file);
  }

  async importPlaud() {
    const text = document.getElementById('plaudText')?.value?.trim();
    const date = document.getElementById('plaudDate')?.value || new Date().toISOString().slice(0, 10);
    if (!text) {
      Components.showToast('文字起こしの内容を貼り付けてください', 'info');
      return;
    }

    // Use integrations.js plaud module
    const parsed = typeof plaud !== 'undefined' ? plaud.parseTranscript(text) : { entries: [{ text }], wordCount: 0 };
    if (typeof plaud !== 'undefined') {
      await plaud.saveTranscript(parsed, { date });
    } else {
      store.addDomainEntry('consciousness', 'transcript', {
        source: 'plaud', content: text, date
      });
    }

    Components.showToast('取り込みました。分析を開始します...', 'success');

    // Auto-analyze with Zen Track
    try {
      const result = await AIEngine.analyze('consciousness', 'transcript_analysis', {
        text: `<<<TRANSCRIPT_START\n${text}\nTRANSCRIPT_END>>>`
      });
      this.parseAndSaveObservation(result);
      this.openModal('分析結果', `<div class="analysis-content">${Components.formatMarkdown(result)}</div>`);
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
    const textarea = document.getElementById('plaudText');
    if (textarea) textarea.value = '';
  }

  // ─── Data Browser ───
  filterDataBrowser(key, value) {
    const filter = store.get('dataBrowserFilter') || { category: '', search: '', sort: 'desc' };
    filter[key] = value;
    store.set('dataBrowserFilter', filter);
    this.renderApp();
  }

  clearDataFilter() {
    store.set('dataBrowserFilter', { category: '', search: '', sort: 'desc' });
    this.renderApp();
  }

  editDataEntry(domain, category, id) {
    const key = `${domain}_${category}`;
    const entries = store.get(key) || [];
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    const fields = Object.entries(entry)
      .filter(([k]) => !k.startsWith('_') && k !== 'timestamp' && k !== 'id' && k !== 'domain' && k !== 'category');

    const formHtml = `<form id="editForm">
      ${fields.map(([k, v]) => `
        <div class="form-group">
          <label>${Components.escapeHtml(i18n.t(k) || k)}</label>
          ${typeof v === 'string' && v.length > 50
            ? `<textarea name="${Components.escapeHtml(k)}" class="form-input" rows="3">${Components.escapeHtml(v)}</textarea>`
            : `<input type="${typeof v === 'number' ? 'number' : 'text'}" name="${Components.escapeHtml(k)}" class="form-input" value="${Components.escapeHtml(String(v))}">`}
        </div>
      `).join('')}
      <div class="form-actions">
        <button type="button" class="btn btn-primary" onclick="app.saveDataEntryEdit('${Components.escapeHtml(domain)}','${Components.escapeHtml(category)}','${Components.escapeHtml(id)}')">保存</button>
        <button type="button" class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
      </div>
    </form>`;

    this.openModal('記録を編集', formHtml);
  }

  saveDataEntryEdit(domain, category, id) {
    const form = document.getElementById('editForm');
    if (!form) return;
    const key = `${domain}_${category}`;
    const entries = store.get(key) || [];
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return;

    const data = new FormData(form);
    data.forEach((value, name) => {
      entries[idx][name] = isNaN(value) ? value : Number(value);
    });
    entries[idx]._synced = false; // trigger re-sync
    entries[idx].updatedAt = new Date().toISOString();
    store.set(key, [...entries]);

    this.closeModal();
    Components.showToast('保存しました', 'success');
    this.renderApp();
  }

  deleteDataEntry(domain, category, id) {
    Components.confirmModal('この記録を削除しますか？', () => {
      const key = `${domain}_${category}`;
      const entries = (store.get(key) || []).filter(e => e.id !== id);
      store.set(key, entries);
      if (typeof FirebaseBackend !== 'undefined' && FirebaseBackend.db) {
        const uid = store.get('user')?.uid;
        if (uid) {
          FirebaseBackend.db.collection('users').doc(uid).collection(key).doc(id).delete().catch(e => console.warn(e));
        }
      }
      Components.showToast('削除しました', 'info');
      this.renderApp();
    }, '削除する', true);
  }

  exportDomainData(domain) {
    const domainConfig = CONFIG.domains[domain];
    const categories = Object.keys(domainConfig?.categories || {});
    const data = {};
    categories.forEach(cat => {
      data[cat] = store.get(`${domain}_${cat}`) || [];
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lms-${domain}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Fitbit ───
  fitbitConnect() {
    const clientId = document.getElementById('fitbitClientId')?.value?.trim();
    if (!clientId) {
      Components.showToast('Client IDを入力してください', 'info');
      return;
    }
    if (typeof fitbit !== 'undefined') {
      fitbit.setClientId(clientId);
      fitbit.connect();
    }
  }

  // ─── One-click OAuth connect methods ───
  // Used when admin has pre-configured the Client ID in admin/config.
  // No per-user input required; go straight to the provider's consent screen.
  gcalConnectOneClick() {
    if (typeof googleCalendar === 'undefined' || !googleCalendar.getClientId()) {
      Components.showToast('管理者がGoogle OAuth設定を行っていません', 'error');
      return;
    }
    googleCalendar.connect();
  }

  outlookConnectOneClick() {
    if (typeof outlookCalendar === 'undefined' || !outlookCalendar.getClientId()) {
      Components.showToast('管理者がMicrosoft OAuth設定を行っていません', 'error');
      return;
    }
    outlookCalendar.connect();
  }

  fitbitConnectOneClick() {
    if (typeof fitbit === 'undefined' || !fitbit.getClientId()) {
      Components.showToast('管理者がFitbit OAuth設定を行っていません', 'error');
      return;
    }
    fitbit.connect();
  }

  gmailConnectOneClick() {
    if (typeof gmailIntegration === 'undefined' || !gmailIntegration.getClientId()) {
      Components.showToast('管理者がGoogle OAuth設定を行っていません', 'error');
      return;
    }
    gmailIntegration.connect();
  }

  fitbitDisconnect() {
    Components.confirmModal('Fitbit接続を解除しますか？', () => {
      if (typeof fitbit !== 'undefined') fitbit.disconnect();
      Components.showToast('接続を解除しました', 'info');
      this.renderApp();
    }, '解除する');
  }

  async fitbitImportToday() {
    if (typeof fitbit === 'undefined' || !fitbit.isConnected()) {
      Components.showToast('Fitbitに接続してください', 'info');
      return;
    }
    Components.showToast('今日のデータを取り込み中...', 'info');
    try {
      const count = await fitbit.importToday();
      Components.showToast(`${count}件のデータを取り込みました`, 'success');
      this.renderApp();
    } catch (e) {
      Components.showToast('取り込みに失敗しました: ' + e.message, 'error');
    }
  }

  async fitbitImportHistory() {
    if (typeof fitbit === 'undefined' || !fitbit.isConnected()) {
      Components.showToast('Fitbitに接続してください', 'info');
      return;
    }
    Components.showToast('過去7日分を取り込み中...', 'info');
    try {
      const count = await fitbit.importHistory(7);
      Components.showToast(`${count}件のデータを取り込みました`, 'success');
      this.renderApp();
    } catch (e) {
      Components.showToast('取り込みに失敗しました: ' + e.message, 'error');
    }
  }

  // ─── Google Calendar ───
  gcalConnect() {
    const clientId = document.getElementById('gcalClientId')?.value?.trim();
    if (!clientId) {
      Components.showToast('Client IDを入力してください', 'info');
      return;
    }
    if (typeof googleCalendar !== 'undefined') {
      googleCalendar.setClientId(clientId);
      googleCalendar.connect();
    }
  }

  gcalDisconnect() {
    Components.confirmModal('Googleカレンダー接続を解除しますか？', () => {
      if (typeof googleCalendar !== 'undefined') googleCalendar.disconnect();
      Components.showToast('接続を解除しました', 'info');
      this.renderApp();
    }, '解除する');
  }

  async gcalSync() {
    if (typeof googleCalendar === 'undefined' || !googleCalendar.isConnected()) {
      Components.showToast('Googleカレンダーに接続してください', 'info');
      return;
    }
    Components.showToast('カレンダーを同期中...', 'info');
    try {
      const count = await googleCalendar.sync();
      Components.showToast(`${count}件の予定を取り込みました`, 'success');
      this.renderApp();
    } catch (e) {
      Components.showToast('同期に失敗しました: ' + e.message, 'error');
    }
  }

  // ─── Outlook Calendar ───
  outlookConnect() {
    const clientId = document.getElementById('outlookClientId')?.value?.trim();
    if (!clientId) {
      Components.showToast('Microsoft Client IDを入力してください', 'info');
      return;
    }
    if (typeof outlookCalendar !== 'undefined') {
      outlookCalendar.setClientId(clientId);
      outlookCalendar.connect();
    }
  }

  outlookDisconnect() {
    Components.confirmModal('Outlook接続を解除しますか？', () => {
      if (typeof outlookCalendar !== 'undefined') outlookCalendar.disconnect();
      Components.showToast('接続を解除しました', 'info');
      this.renderApp();
    }, '解除する');
  }

  async outlookSync() {
    if (typeof outlookCalendar === 'undefined' || !outlookCalendar.isConnected()) {
      Components.showToast('Outlookに接続してください', 'info');
      return;
    }
    Components.showToast('Outlookカレンダーを同期中...', 'info');
    try {
      const count = await outlookCalendar.sync();
      Components.showToast(`${count}件の予定を取り込みました`, 'success');
      this.renderApp();
    } catch (e) {
      Components.showToast('同期に失敗しました: ' + e.message, 'error');
    }
  }

  // ─── Gmail ───
  gmailConnect() {
    const clientId = document.getElementById('gmailClientId')?.value?.trim();
    if (!clientId) {
      Components.showToast('Google Client IDを入力してください', 'info');
      return;
    }
    if (typeof gmailIntegration !== 'undefined') {
      gmailIntegration.setClientId(clientId);
      gmailIntegration.connect();
    }
  }

  gmailDisconnect() {
    Components.confirmModal('Gmail接続を解除しますか？', () => {
      if (typeof gmailIntegration !== 'undefined') gmailIntegration.disconnect();
      Components.showToast('接続を解除しました', 'info');
      this.renderApp();
    }, '解除する');
  }

  async gmailImportContacts() {
    if (typeof gmailIntegration === 'undefined' || !gmailIntegration.isConnected()) {
      Components.showToast('Gmailに接続してください', 'info');
      return;
    }
    Components.showToast('Gmailから連絡先を抽出中...(数分かかる場合があります)', 'info');
    try {
      const result = await gmailIntegration.importFrequentContacts(6);
      Components.showToast(
        `${result.added}件の連絡先を追加しました（${result.total}件中${result.skipped}件は既に登録済み）`,
        'success'
      );
      this.renderApp();
    } catch (e) {
      Components.showToast('連絡先取得に失敗: ' + e.message, 'error');
    }
  }

  // ─── SNS Export File Import (Facebook/Instagram/X/LinkedIn) ───
  async importSnsFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (typeof snsImport === 'undefined') {
      Components.showToast('SNSモジュールが読み込まれていません', 'error');
      return;
    }
    Components.showToast(`${file.name} を解析中...`, 'info');
    try {
      const result = await snsImport.importFile(file);
      if (result.total === 0) {
        Components.showToast('認識できるデータが見つかりませんでした。ファイル形式をご確認ください。', 'info');
      } else {
        Components.showToast(
          `${result.source}から${result.added}件の連絡先を追加しました（${result.total}件中）`,
          'success'
        );
        this.renderApp();
      }
    } catch (e) {
      Components.showToast('取り込みに失敗: ' + e.message, 'error');
    }
  }

  // ─── Garmin / Oura / Whoop (CSV import) ───
  importGarmin(event) {
    this.importWearableCSV(event, 'garmin');
  }

  importOura(event) {
    this.importWearableCSV(event, 'oura');
  }

  importWhoop(event) {
    this.importWearableCSV(event, 'whoop');
  }

  // Generic CSV wearable importer: maps common columns to health data
  importWearableCSV(event, source) {
    const file = event.target.files[0];
    if (!file) return;

    Components.showToast(`${source} データを読み込み中...`, 'info');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = (typeof fileImport !== 'undefined' && fileImport.parseCSV)
          ? fileImport.parseCSV(e.target.result)
          : [];

        let count = 0;
        rows.forEach(row => {
          const lower = {};
          Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k]; });

          const date = lower['date'] || lower['day'] || lower['timestamp'] || lower['start_time'] || '';
          const steps = parseFloat(lower['steps'] || lower['total steps'] || 0);
          const hr = parseFloat(lower['average heart rate'] || lower['heart rate'] || lower['resting_hr'] || 0);
          const sleep = parseFloat(lower['sleep duration'] || lower['total sleep'] || lower['asleep time'] || 0);
          const calories = parseFloat(lower['calories'] || lower['total calories'] || lower['calories burned'] || 0);
          const readiness = parseFloat(lower['readiness'] || lower['readiness score'] || lower['recovery'] || 0);

          if (steps > 0) {
            store.addDomainEntry('health', 'activityData', {
              activity_type: 'walking', source, steps, calories_burned: calories, date
            });
            count++;
          }
          if (hr > 0) {
            store.addDomainEntry('health', 'vitals', { heart_rate: hr, source, date });
            count++;
          }
          if (sleep > 0) {
            store.addDomainEntry('health', 'sleepData', {
              source, duration_minutes: sleep,
              quality: readiness > 0 ? Math.round(readiness / 10) : null, date
            });
            count++;
          }
        });

        Components.showToast(`${source}から${count}件のデータを取り込みました`, 'success');
        this.renderApp();
      } catch (err) {
        Components.showToast('取り込みに失敗: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  importAppleHealth(event) {
    const file = event.target.files[0];
    if (!file) return;
    Components.showToast('Apple Healthデータを読み込み中...', 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let count = 0;
        if (typeof appleHealth !== 'undefined') {
          const parsed = appleHealth.parseExport(e.target.result);
          count = appleHealth.importData(parsed);
        }

        Components.showToast(`${count}件のデータを取り込みました`, 'success');
        this.renderApp();
      } catch (err) {
        Components.showToast('ファイルの読み込みに失敗しました', 'error');
      }
    };
    reader.readAsText(file);
  }

  handleFileDrop(event) {
    event.preventDefault();
    document.getElementById('fileDropArea')?.classList.remove('dragover');
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFileUpload({ target: { files: [file] } }, store.get('currentDomain'));
  }

  // Check all OAuth callbacks (Google Calendar, Fitbit) on page load.
  // Each module's checkCallback() checks the state parameter strictly
  // so they don't steal each other's tokens.
  checkOAuthCallbacks() {
    if (typeof googleCalendar !== 'undefined' && googleCalendar.checkCallback) {
      googleCalendar.checkCallback();
    }
    if (typeof fitbit !== 'undefined' && fitbit.checkCallback) {
      fitbit.checkCallback();
    }
  }

  // ─── Consciousness Transcript Analysis ───
  async analyzeTranscript() {
    const textarea = document.getElementById('transcriptText');
    const source = document.getElementById('transcriptSource')?.value || 'manual';
    if (!textarea || !textarea.value.trim()) {
      Components.showToast('文字起こしの��容を入力してください', 'info');
      return;
    }

    const text = textarea.value.trim();
    const resultEl = document.getElementById('transcriptResult');

    // Save transcript entry
    store.addDomainEntry('consciousness', 'transcript', {
      source,
      content: text,
      duration: Math.round(text.length / 200) // rough estimate
    });

    if (resultEl) resultEl.innerHTML = Components.loading('七つのレイヤーで分析中...');

    try {
      const prompt = CONFIG.prompts.consciousness.transcript_analysis || CONFIG.prompts.consciousness.daily;
      const result = await AIEngine.analyze('consciousness', 'transcript_analysis', {
        text: `<<<TRANSCRIPT_START\n${text}\nTRANSCRIPT_END>>>`
      });

      // Try to extract JSON from response for auto-populating observation
      this.parseAndSaveObservation(result);

      if (resultEl) {
        resultEl.innerHTML = `<div class="transcript-result">
          <h3>分析結果</h3>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
        </div>`;
      }

      textarea.value = '';
      Components.showToast('分析が完了しました', 'success');
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${Components.escapeHtml(e.message)}</div>`;
    }
  }

  parseAndSaveObservation(aiResponse) {
    // Try to extract JSON from AI response to auto-populate observation
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*"conscious_focus"[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        const dims = data.conscious_focus?.dims_pct || {};
        const signals = data.signals || {};

        store.addDomainEntry('consciousness', 'observation', {
          layer_1: dims['1'] || 0,
          layer_2: dims['2'] || 0,
          layer_3: dims['3'] || 0,
          layer_35: dims['3.5'] || 0,
          layer_4: dims['4'] || 0,
          layer_5: dims['5'] || 0,
          layer_6: dims['6'] || 0,
          layer_7: dims['7'] || 0,
          desire_count: signals.desire_count || 0,
          virtue_count: signals.virtue_count || 0,
          energy_count: signals.energy_count || 0,
          net_value: data.summary?.net_value?.value || 0,
          auto_generated: true
        });
      }
    } catch (e) {
      // JSON parsing failed, observation can be entered manually
      console.warn('Auto-observation parse failed:', e);
    }
  }

  loadTranscriptFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const textarea = document.getElementById('transcriptText');
      if (textarea) textarea.value = e.target.result;
      Components.showToast('ファイルを読み込みました', 'success');
    };
    reader.readAsText(file);
  }

  // ─── Resume Management (Contribution domain) ───
  saveResume() {
    const resume = {
      name: document.getElementById('resumeName')?.value || '',
      summary: document.getElementById('resumeSummary')?.value || '',
      skills: (document.getElementById('resumeSkills')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      history: document.getElementById('resumeHistory')?.value || '',
      workStyle: document.getElementById('resumeWorkStyle')?.value || '',
      updatedAt: new Date().toISOString()
    };
    store.set('userResume', resume);
    Components.showToast(i18n.t('saved'), 'success');
  }

  sendResumeToPortals() {
    const resume = store.get('userResume');
    if (!resume || !resume.name) {
      Components.showToast('まずレジュメを登録してください', 'info');
      return;
    }

    // Generate resume text for clipboard
    const text = `【レジュメ】
氏名: ${resume.name}
職務要約: ${resume.summary}
スキル・資格: ${(resume.skills || []).join(', ')}
職務経歴: ${resume.history}
希望する働き方: ${resume.workStyle}`;

    navigator.clipboard.writeText(text).then(() => {
      Components.showToast('レジュメをコピーしました。求人サイトに貼り付けてください。', 'success');
    }).catch(() => {
      // Fallback: show in a textarea
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      const ta = document.createElement('textarea');
      ta.className = 'form-input';
      ta.rows = 10;
      ta.readOnly = true;
      ta.value = text; // safe: textContent via .value, not innerHTML
      modal.innerHTML = `<div class="modal-content">
        <h3>レジュメをコピー</h3>
        <p>上のテキストをコピーして、求人サイトに貼り付けてください。</p>
        <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">閉じる</button>
      </div>`;
      modal.querySelector('.modal-content').insertBefore(ta, modal.querySelector('p'));
      document.body.appendChild(modal);
    });
  }

  // ─── Time Marketplace Settings ───
  saveMarketplaceSettings() {
    if (typeof TimeMarketplace === 'undefined') return;

    const days = [];
    document.querySelectorAll('input[name="mpDays"]:checked').forEach(cb => {
      days.push(parseInt(cb.value));
    });

    const skillsStr = document.getElementById('mpSkills')?.value || '';
    const skills = skillsStr.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name }));

    const settings = {
      enabled: document.getElementById('mpEnabled')?.checked || false,
      skills,
      location: {
        type: document.getElementById('mpLocationType')?.value || 'remote',
        address: document.getElementById('mpAddress')?.value || '',
        canTravel: false
      },
      rate: {
        amount: parseInt(document.getElementById('mpRate')?.value) || 3000,
        currency: 'JPY',
        minimumMinutes: parseInt(document.getElementById('mpMinTime')?.value) || 30
      },
      availability: {
        daysOfWeek: days,
        startHour: parseInt(document.getElementById('mpStartHour')?.value) || 9,
        endHour: parseInt(document.getElementById('mpEndHour')?.value) || 17,
        bufferMinutes: 30
      },
      paypal: {
        email: document.getElementById('mpPaypal')?.value || ''
      },
      profile: {
        displayName: document.getElementById('mpDisplayName')?.value || '',
        bio: document.getElementById('mpBio')?.value || '',
        experience: ''
      }
    };

    TimeMarketplace.saveSettings(settings);
    Components.showToast(i18n.t('saved'), 'success');
  }

  // ─── Category Tab Switching ───
  showCategory(category, btn) {
    // Update tab active state
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Show/hide forms
    document.querySelectorAll('.category-form').forEach(f => f.classList.remove('active'));
    const form = document.querySelector(`.category-form[data-category="${category}"]`);
    if (form) form.classList.add('active');
  }

  // ─── File Upload (Firebase Storage + Firestore metadata) ───
  async handleFileUpload(event, domain) {
    const file = event.target.files[0];
    if (!file) return;

    Components.showToast('ファイルをアップロード中...', 'info');

    // Upload to Firebase Storage (server-side storage, not localStorage)
    let url = null;
    if (typeof FirebaseBackend !== 'undefined' && FirebaseBackend.uploadFile) {
      url = await FirebaseBackend.uploadFile(file, `${domain}/files`);
    }

    // Determine target category
    const categories = CONFIG.domains[domain]?.categories || {};
    const targetCat = 'photos' in categories ? 'photos' : Object.keys(categories)[0] || 'entries';

    if (url) {
      // File uploaded to Firebase Storage; save URL as metadata only
      store.addDomainEntry(domain, targetCat, {
        type: file.type.startsWith('image/') ? 'image' : 'file',
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: url // Firebase Storage URL
      });
      Components.showToast('アップロードしました', 'success');
    } else {
      // Fallback: read content locally (used if Firebase Storage unavailable)
      const reader = new FileReader();
      reader.onload = (e) => {
        store.addDomainEntry(domain, targetCat, {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          data: e.target.result
        });
        Components.showToast('保存しました', 'success');
      };
      if (file.type.startsWith('image/')) reader.readAsDataURL(file);
      else reader.readAsText(file);
    }
  }

  // ─── Settings ───
  // Collects all schema fields from the settings form and the
  // disease checkboxes. Preserves any pre-existing fields that
  // are not in the current form (e.g. email, displayName from Auth).
  saveProfile() {
    const current = store.get('userProfile') || {};
    const profile = { ...current };
    const schema = CONFIG.profileSchema || {};

    // Collect all schema fields across all sections
    Object.values(schema).forEach(section => {
      section.forEach(field => {
        const el = document.getElementById('profile_' + field.key);
        if (!el) return;
        let val = el.value;
        if (field.type === 'number') val = val === '' ? '' : Number(val);
        profile[field.key] = val;
      });
    });

    // Collect disease checkboxes
    const diseases = [];
    document.querySelectorAll('input[name="disease"]:checked').forEach(cb => {
      diseases.push(cb.value);
    });
    profile.diseases = diseases;

    // Language (kept separate since it's also in i18n)
    const lang = document.getElementById('profileLang')?.value;
    if (lang) profile.language = lang;

    store.set('userProfile', profile);
    Components.showToast(i18n.t('saved'), 'success');
  }

  changeLanguage(lang) {
    i18n.setLang(lang);
    this.renderApp();
  }

  saveApiKeys() {
    const keys = {};
    const anthropic = document.getElementById('apiKeyAnthropic')?.value;
    const openai = document.getElementById('apiKeyOpenAI')?.value;
    const google = document.getElementById('apiKeyGoogle')?.value;

    if (anthropic && !anthropic.includes('•')) { AIEngine.setApiKey('anthropic', anthropic); keys.anthropic = anthropic; }
    if (openai && !openai.includes('•')) { AIEngine.setApiKey('openai', openai); keys.openai = openai; }
    if (google && !google.includes('•')) { AIEngine.setApiKey('google', google); keys.google = google; }

    // Save to Firestore if available
    if (Object.keys(keys).length > 0) {
      FirebaseBackend.saveApiKeys({ ...AIEngine.getApiKey, ...keys });
    }

    Components.showToast(i18n.t('saved'), 'success');
  }

  // ─── Data Export/Import ───
  exportData() {
    const data = {};
    store.persistKeys.forEach(key => {
      data[key] = store.get(key);
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lms-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        Object.entries(data).forEach(([key, value]) => {
          if (store.persistKeys.includes(key)) {
            store.set(key, value);
          }
        });
        Components.showToast(i18n.t('saved'), 'success');
        this.renderApp();
      } catch (err) {
        Components.showToast(i18n.t('error') + ': ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  // ─── Admin Methods (未病ダイアリー準拠: tabbed) ───

  setAdminTab(tab) {
    store.set('adminTab', tab);
    this.renderApp();
  }

  filterPrompts() {
    const search = document.getElementById('promptSearch')?.value || '';
    const domain = document.getElementById('promptDomainFilter')?.value || '';
    store.set('adminPromptFilter', { search, domain });
    this.renderApp();
  }

  editPrompt(key) {
    const el = document.getElementById('edit-' + key);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  cancelPromptEdit(key) {
    const el = document.getElementById('edit-' + key);
    if (el) el.style.display = 'none';
  }

  savePrompt(key) {
    const editEl = document.getElementById('edit-' + key);
    if (!editEl) return;

    const fields = editEl.querySelectorAll('[data-field]');
    const current = CONFIG.prompts[key] || {};
    const updated = { ...current };
    fields.forEach(f => { updated[f.dataset.field] = f.value; });
    updated.active = current.active !== false;

    // Update in-memory CONFIG
    CONFIG.prompts[key] = updated;

    // Save as custom (overrides)
    const custom = store.get('customPrompts') || {};
    custom[key] = updated;
    store.set('customPrompts', custom);

    Components.showToast('保存しました', 'success');
    editEl.style.display = 'none';
    this.renderApp();
  }

  deletePrompt(key) {
    Components.confirmModal('このプロンプトを削除しますか？', () => {
      delete CONFIG.prompts[key];
      const custom = store.get('customPrompts') || {};
      delete custom[key];
      store.set('customPrompts', custom);
      Components.showToast('削除しました', 'info');
      this.renderApp();
    }, '削除する', true);
  }

  addNewPrompt() {
    Components.promptModal('プロンプトのキー名を入力（例: work_custom）', 'work_custom', (key) => {
      if (CONFIG.prompts[key]) {
        Components.showToast('そのキーは既に存在します', 'error');
        return;
      }
      CONFIG.prompts[key] = {
        name: '新しいプロンプト',
        domain: 'universal',
        description: '',
        schedule: 'manual',
        active: true,
        prompt: ''
      };
      this.renderApp();
    });
  }

  selectModel(modelId) {
    store.set('selectedModel', modelId);
    Components.showToast('モデルを変更しました', 'success');
    this.renderApp();
  }

  async testConnection() {
    const resultEl = document.getElementById('connectionResult');
    if (resultEl) resultEl.innerHTML = '<div style="padding:10px;">接続テスト中...</div>';
    try {
      const result = await AIEngine.analyze(null, 'text_analysis', { text: 'テスト' });
      if (resultEl) resultEl.innerHTML = '<div class="toast toast-success" style="position:static;opacity:1;margin-top:10px;">✓ 接続成功</div>';
    } catch (e) {
      if (resultEl) resultEl.innerHTML = '<div class="toast toast-error" style="position:static;opacity:1;margin-top:10px;">✗ ' + Components.escapeHtml(e.message) + '</div>';
    }
  }

  clearApiKeys() {
    Components.confirmModal('すべてのAPIキーを削除しますか？', () => {
      ['anthropic', 'openai', 'google'].forEach(p => {
        localStorage.removeItem('lms_apikey_' + p);
      });
      store.state._apiKeys = {};
      Components.showToast('削除しました', 'info');
      this.renderApp();
    }, '削除する', true);
  }

  saveAffiliateConfig() {
    Object.keys(CONFIG.affiliate).forEach(store_name => {
      const input = document.getElementById('aff_' + store_name);
      if (input) {
        const val = input.value;
        if (CONFIG.affiliate[store_name].tag !== undefined) CONFIG.affiliate[store_name].tag = val;
        else if (CONFIG.affiliate[store_name].id !== undefined) CONFIG.affiliate[store_name].id = val;
        else if (CONFIG.affiliate[store_name].code !== undefined) CONFIG.affiliate[store_name].code = val;
      }
    });
    store.set('affiliateConfig', CONFIG.affiliate);
    Components.showToast('保存しました', 'success');
  }

  saveFirebaseConfig() {
    CONFIG.firebase.apiKey = document.getElementById('fbApiKey')?.value || '';
    CONFIG.firebase.authDomain = document.getElementById('fbAuthDomain')?.value || '';
    CONFIG.firebase.projectId = document.getElementById('fbProjectId')?.value || '';
    CONFIG.firebase.storageBucket = document.getElementById('fbStorageBucket')?.value || '';
    CONFIG.firebase.messagingSenderId = document.getElementById('fbMessagingSenderId')?.value || '';
    CONFIG.firebase.appId = document.getElementById('fbAppId')?.value || '';
    localStorage.setItem('lms_firebaseConfig', JSON.stringify(CONFIG.firebase));
    Components.showToast('保存しました（再読み込みが必要です）', 'success');
  }

  clearFirebaseConfig() {
    Components.confirmModal('Firebase設定を削除しますか？', () => {
      localStorage.removeItem('lms_firebaseConfig');
      Components.showToast('削除しました（再読み込みが必要です）', 'info');
    }, '削除する', true);
  }

  saveWorkerUrl() {
    let url = (document.getElementById('workerUrl')?.value || '').trim();
    // Normalize: strip trailing slash(es), strip whitespace
    url = url.replace(/\/+$/, '');
    CONFIG.endpoints.anthropic = url;
    localStorage.setItem('lms_workerUrl', url);

    // Sync to Firestore so all users inherit the admin's Worker URL
    if (FirebaseBackend.isAdmin() && FirebaseBackend.db) {
      FirebaseBackend.db.collection('admin').doc('config').set(
        {
          anthropicProxyUrl: url,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      ).catch(e => console.warn('Worker URL sync error:', e));
    }

    Components.showToast('保存しました: ' + url, 'success');
  }

  // ─── Save admin-shared OAuth Client IDs ───
  // Stores OAuth Client IDs (Google/Microsoft/Fitbit/Withings) in
  // admin/config.oauthClientIds so all users inherit them and see
  // a one-click Connect button in their integration page.
  saveOAuthClientIds() {
    const ids = {
      google: (document.getElementById('oauthGoogle')?.value || '').trim(),
      microsoft: (document.getElementById('oauthMicrosoft')?.value || '').trim(),
      fitbit: (document.getElementById('oauthFitbit')?.value || '').trim(),
      withings: (document.getElementById('oauthWithings')?.value || '').trim()
    };

    // Update runtime config immediately
    CONFIG.oauthClientIds = { ...CONFIG.oauthClientIds, ...ids };

    // Sync to Firestore admin/config for all users
    if (FirebaseBackend.isAdmin() && FirebaseBackend.db) {
      FirebaseBackend.db.collection('admin').doc('config').set(
        {
          oauthClientIds: ids,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      ).catch(e => console.warn('OAuth IDs sync error:', e));
    } else {
      // Non-admin: save locally only
      localStorage.setItem('lms_oauthClientIds', JSON.stringify(ids));
    }

    const count = Object.values(ids).filter(Boolean).length;
    Components.showToast(`${count}件のOAuth Client IDを保存しました`, 'success');
    this.renderApp();
  }

  // ─── Direct mode toggle (Plan B - no proxy needed) ───
  useDirectMode() {
    CONFIG.endpoints.anthropic = 'direct';
    localStorage.setItem('lms_workerUrl', 'direct');

    if (FirebaseBackend.isAdmin() && FirebaseBackend.db) {
      FirebaseBackend.db.collection('admin').doc('config').set(
        {
          anthropicProxyUrl: 'direct',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      ).catch(e => console.warn('Direct mode sync error:', e));
    }

    Components.showToast('直接モードに切り替えました', 'success');
    this.renderApp();
  }

  useProxyMode() {
    // Restore the last known proxy URL or clear to placeholder
    const last = localStorage.getItem('lms_workerUrl_backup') || '';
    CONFIG.endpoints.anthropic = last;
    localStorage.setItem('lms_workerUrl', last);
    Components.showToast('プロキシ経由モードに戻しました。URLを入力してください。', 'info');
    this.renderApp();
  }

  // ─── Admin User Management ───
  addAdminEmail() {
    Components.promptModal('管理者として追加するメールアドレスを入力してください', 'example@email.com', async (email) => {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(trimmed)) {
        Components.showToast('有効なメールアドレスを入力してください', 'error');
        return;
      }
      const list = store.get('adminEmails') || ['agewaller@gmail.com'];
      if (list.includes(trimmed)) {
        Components.showToast('すでに管理者です', 'info');
        return;
      }
      list.push(trimmed);
      store.set('adminEmails', list);
      if (FirebaseBackend.db) {
        await FirebaseBackend.db.collection('admin').doc('config').set(
          { adminEmails: list, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        ).catch(e => console.warn(e));
      }
      Components.showToast(`${trimmed} を管理者に追加しました`, 'success');
      this.renderApp();
    });
  }

  removeAdminEmail(email) {
    if (email === 'agewaller@gmail.com') {
      Components.showToast('オーナーアカウントは削除できません', 'error');
      return;
    }
    Components.confirmModal(`${email} を管理者から外しますか？`, async () => {
      const list = (store.get('adminEmails') || ['agewaller@gmail.com']).filter(e => e !== email);
      store.set('adminEmails', list);
      if (FirebaseBackend.db) {
        await FirebaseBackend.db.collection('admin').doc('config').set(
          { adminEmails: list, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        ).catch(e => console.warn(e));
      }
      Components.showToast('管理者から削除しました', 'info');
      this.renderApp();
    }, '外す', true);
  }

  async loadAllUsers() {
    if (!FirebaseBackend.db) {
      Components.showToast('Firebaseに接続してください', 'error');
      return;
    }

    Components.showToast('ユーザー一覧を読み込み中...', 'info');
    try {
      const snap = await FirebaseBackend.db.collection('users').limit(100).get();
      const users = [];
      snap.forEach(doc => {
        const data = doc.data();
        const profile = data.userProfile || {};
        users.push({
          uid: doc.id,
          email: profile.email || '',
          displayName: profile.displayName || profile.name || '',
          age: profile.age || null,
          gender: profile.gender || '',
          location: profile.location || '',
          occupation: profile.occupation || '',
          diseases: Array.isArray(profile.diseases) ? profile.diseases : [],
          medications: profile.medications || '',
          monthlyIncome: profile.monthlyIncome || '',
          savings: profile.savings || '',
          lifeGoals: profile.lifeGoals || '',
          concerns: profile.concerns || '',
          subscription: data.subscription?.plan || 'free',
          lastActive: data.updatedAt?.toDate?.()?.toISOString() || null,
          domainScores: data.domainScores || {}
        });
      });

      // Sort: most recently active first
      users.sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''));

      store.set('_allUsers', users);
      store.set('_allUsersCount', users.length);
      Components.showToast(`${users.length}人のユーザーを読み込みました`, 'success');
      this.renderApp();
    } catch (e) {
      Components.showToast('読み込みに失敗しました: ' + e.message, 'error');
    }
  }

  // User list filter (admin users tab)
  filterUsers(key, value) {
    const filter = store.get('_userFilter') || { search: '', type: 'all' };
    filter[key] = value;
    store.set('_userFilter', filter);
    this.renderApp();
  }

  clearUserFilter() {
    store.set('_userFilter', { search: '', type: 'all' });
    this.renderApp();
  }

  // ─── ZIP bulk import ───
  async importZipFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (typeof zipImport === 'undefined' || typeof JSZip === 'undefined') {
      Components.showToast('ZIPライブラリが読み込まれていません', 'error');
      return;
    }

    Components.showToast(`${file.name} を解凍中...`, 'info');
    try {
      const result = await zipImport.importZip(file);
      const summary = [
        `処理ファイル: ${result.processed}`,
        `連絡先追加: ${result.contactsAdded}`,
        `予定追加: ${result.calendarEvents}`,
        `健康データ: ${result.healthRecords}`
      ].join(' / ');
      Components.showToast('取り込み完了: ' + summary, 'success');

      // Also show details in a modal
      this.openModal('ZIP取込結果', `
        <div style="font-size:14px;line-height:1.8;">
          <p><strong>ファイル:</strong> ${file.name}</p>
          <p><strong>処理成功:</strong> ${result.processed}件</p>
          <p><strong>スキップ:</strong> ${result.skipped}件</p>
          <hr>
          <p><strong>連絡先追加:</strong> ${result.contactsAdded}件</p>
          <p><strong>カレンダー予定:</strong> ${result.calendarEvents}件</p>
          <p><strong>健康記録:</strong> ${result.healthRecords}件</p>
          <hr>
          <details>
            <summary>含まれていたファイル (${result.files.length}件)</summary>
            <ul style="font-size:0.8rem;color:var(--text-muted);max-height:200px;overflow-y:auto;">
              ${result.files.slice(0, 100).map(f => `<li>${f}</li>`).join('')}
              ${result.files.length > 100 ? `<li>...他${result.files.length - 100}件</li>` : ''}
            </ul>
          </details>
        </div>
      `);
      this.renderApp();
    } catch (e) {
      Components.showToast('ZIP取込失敗: ' + e.message, 'error');
    }
  }

  // ─── Withings ───
  withingsConnect() {
    const clientId = document.getElementById('withingsClientId')?.value?.trim();
    if (!clientId) {
      Components.showToast('Withings Client IDを入力してください', 'info');
      return;
    }
    if (typeof withings !== 'undefined') {
      withings.setClientId(clientId);
      withings.startAuth();
    }
  }

  importWithingsCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const count = typeof withings !== 'undefined' ? withings.parseCSV(e.target.result) : 0;
      Components.showToast(`Withingsから${count}件のデータを取り込みました`, 'success');
      this.renderApp();
    };
    reader.readAsText(file);
  }

  // ─── Muse ───
  importMuseCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const count = typeof muse !== 'undefined' ? muse.parseCSV(e.target.result) : 0;
      Components.showToast(`Museから${count}件のセッションを取り込みました`, 'success');
      this.renderApp();
    };
    reader.readAsText(file);
  }

  // Show a modal with detailed profile info for one user
  showUserDetail(uid) {
    const users = store.get('_allUsers') || [];
    const user = users.find(u => u.uid === uid);
    if (!user) return;

    const scores = user.domainScores || {};
    const scoreHtml = Object.entries(scores).map(([d, s]) =>
      `<div class="user-score-item"><span>${i18n.t(d)}</span><strong>${s}</strong></div>`
    ).join('');

    const esc = Components.escapeHtml;
    const body = `
      <div class="user-detail">
        <div class="user-detail-section">
          <h4>基本情報</h4>
          <p><strong>お名前:</strong> ${esc(user.displayName || '-')}</p>
          <p><strong>メール:</strong> ${esc(user.email || '-')}</p>
          <p><strong>年齢:</strong> ${esc(String(user.age || '-'))}</p>
          <p><strong>性別:</strong> ${esc(user.gender || '-')}</p>
          <p><strong>居住地:</strong> ${esc(user.location || '-')}</p>
          <p><strong>職業:</strong> ${esc(user.occupation || '-')}</p>
        </div>

        <div class="user-detail-section">
          <h4>健康</h4>
          <p><strong>持病・症状:</strong> ${esc(user.diseases?.length > 0 ? user.diseases.join(', ') : 'なし')}</p>
          <p><strong>服薬:</strong> ${esc(user.medications || 'なし')}</p>
        </div>

        <div class="user-detail-section">
          <h4>資産・収入</h4>
          <p><strong>月収:</strong> ${esc(String(user.monthlyIncome || '-'))}</p>
          <p><strong>貯蓄:</strong> ${esc(String(user.savings || '-'))}</p>
          <p><strong>プラン:</strong> ${esc(user.subscription || '-')}</p>
        </div>

        <div class="user-detail-section">
          <h4>人生目標・悩み</h4>
          <p><strong>目標:</strong> ${esc(user.lifeGoals || '-')}</p>
          <p><strong>悩み:</strong> ${esc(user.concerns || '-')}</p>
        </div>

        ${scoreHtml ? `
        <div class="user-detail-section">
          <h4>6領域スコア</h4>
          <div class="user-scores-grid">${scoreHtml}</div>
        </div>` : ''}

        <div class="user-detail-section" style="font-size:0.73rem;color:var(--text-muted);">
          UID: ${user.uid}<br>
          最終アクティビティ: ${user.lastActive ? new Date(user.lastActive).toLocaleString('ja-JP') : '-'}
        </div>
      </div>
    `;

    this.openModal(user.displayName || user.email || 'ユーザー詳細', body);
  }

  // ─── First-run Onboarding ───
  checkFirstRun() {
    if (store.get('hasOnboarded') || localStorage.getItem('lms_hasOnboarded')) return;
    this.startOnboarding();
  }

  startOnboarding() {
    const icons = { consciousness: '🧘', health: '💚', time: '⏰', work: '💼', relationship: '🤝', assets: '💰' };
    const rows = Object.keys(CONFIG.domains).map(d =>
      `<button class="onboarding-domain-btn" onclick="app.selectOnboardingDomain('${d}')">
        <span class="onb-icon">${icons[d] || '●'}</span>
        <span class="onb-name">${i18n.t(d)}</span>
      </button>`
    ).join('');
    this.openModal('ようこそ！どこから始めますか？', `
      <p style="color:#64748b;margin-bottom:20px;line-height:1.7;">
        今、一番気になっていることはどれですか？<br>そこから一緒に始めましょう。
      </p>
      <div class="onboarding-domains">${rows}</div>
    `);
  }

  selectOnboardingDomain(domain) {
    store.set('currentDomain', domain);
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (titleEl) titleEl.textContent = 'あなたのことを少し教えてください';
    if (bodyEl) bodyEl.innerHTML = `
      <p style="color:#64748b;margin-bottom:20px;line-height:1.7;">
        入力は後からいつでも変えられます。今わかる範囲で大丈夫です。
      </p>
      <div class="form-group">
        <label>お名前（呼び名で大丈夫です）</label>
        <input type="text" id="onb_name" class="form-input" placeholder="例：花子さん">
      </div>
      <div class="form-group">
        <label>年齢</label>
        <input type="number" id="onb_age" class="form-input" placeholder="65" min="1" max="120">
      </div>
      <div class="form-group">
        <label>今、一番気になっていること（自由に書いてください）</label>
        <textarea id="onb_concern" class="form-input" rows="3"
          placeholder="体の疲れ、孤独感、老後のお金、やることがない…など"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary btn-lg" onclick="app.completeOnboarding()">始める →</button>
      </div>
    `;
    setTimeout(() => document.getElementById('onb_name')?.focus(), 50);
  }

  completeOnboarding() {
    const name = document.getElementById('onb_name')?.value?.trim();
    const age = parseInt(document.getElementById('onb_age')?.value) || null;
    const concern = document.getElementById('onb_concern')?.value?.trim();

    const profile = store.get('userProfile') || {};
    if (name) profile.displayName = name;
    if (age) profile.age = age;
    if (concern) profile.concerns = concern;
    store.set('userProfile', profile);

    store.set('hasOnboarded', true);
    localStorage.setItem('lms_hasOnboarded', '1');

    this.closeModal();
    Components.showToast('ようこそ！まず今日の状態を記録してみましょう', 'success');
    this.navigate('record');
  }

  generateDemoData() {
    Components.confirmModal('デモデータを生成しますか？既存データに追加されます。', () => {
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        store.addDomainEntry('health', 'symptoms', { condition_level: 5 + Math.floor(Math.random() * 3), timestamp: d.toISOString() });
        store.addDomainEntry('health', 'sleepData', { quality: 6 + Math.floor(Math.random() * 3), timestamp: d.toISOString() });
      }
      Components.showToast('デモデータを生成しました', 'success');
      this.renderApp();
    }, '生成する');
  }

  deleteAllData() {
    Components.confirmModal('本当にすべてのデータを削除しますか？この操作は元に戻せません。', () => {
      Components.confirmModal('最終確認：すべてのデータを完全に削除します。よろしいですか？', () => {
        store.clearAll();
        Components.showToast('すべてのデータを削除しました', 'info');
        window.location.reload();
      }, '完全に削除する', true);
    }, 'はい、削除します', true);
  }

  // ─── PWA Install Prompt ───
  // ─── Daily reminder notification ───
  async _checkDailyReminder() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!localStorage.getItem('lms_notificationEnabled')) return;

    const reminderTime = localStorage.getItem('lms_notificationTime') || '08:00';
    const [rHour, rMin] = reminderTime.split(':').map(Number);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Only fire once per day and only if it's past the reminder time
    if (localStorage.getItem('lms_lastReminderDate') === today) return;
    if (now.getHours() < rHour || (now.getHours() === rHour && now.getMinutes() < rMin)) return;

    // Check if any data was logged today across all domains
    let loggedToday = false;
    Object.keys(CONFIG.domains).forEach(d => {
      Object.keys(CONFIG.domains[d]?.categories || {}).forEach(cat => {
        const entries = store.getDomainData(d, cat, 1);
        if (entries.some(e => (e.date || e.timestamp || '').startsWith(today))) loggedToday = true;
      });
    });
    if (loggedToday) return;

    localStorage.setItem('lms_lastReminderDate', today);

    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      reg.showNotification('LMS 記録リマインダー', {
        body: '今日の記録をつけましょう。少しの入力が、より良い明日に繋がります。',
        icon: '/lms/icon.svg',
        badge: '/lms/icon.svg',
        tag: 'lms-daily-reminder',
        renotify: false
      });
    } else {
      new Notification('LMS 記録リマインダー', {
        body: '今日の記録をつけましょう。少しの入力が、より良い明日に繋がります。',
        icon: '/lms/icon.svg'
      });
    }
  }

  async enableDailyReminder(time) {
    if (!('Notification' in window)) {
      Components.showToast('このブラウザは通知に対応していません', 'error');
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      Components.showToast('通知が許可されませんでした。ブラウザの設定をご確認ください', 'error');
      return false;
    }
    localStorage.setItem('lms_notificationEnabled', '1');
    localStorage.setItem('lms_notificationTime', time || '08:00');
    Components.showToast('毎日のリマインダーを設定しました', 'success');
    return true;
  }

  disableDailyReminder() {
    localStorage.removeItem('lms_notificationEnabled');
    Components.showToast('リマインダーをオフにしました', 'info');
    this.renderApp();
  }

  setTextSize(size) {
    if (!['normal', 'lg', 'xl'].includes(size)) size = 'normal';
    localStorage.setItem('lms_textSize', size);
    this._applyTextSize(size);
    this.renderApp();
  }

  _applyTextSize(size) {
    const html = document.documentElement;
    if (!size || size === 'normal') {
      html.removeAttribute('data-text-size');
    } else {
      html.setAttribute('data-text-size', size);
    }
  }

  setTheme(theme) {
    if (!['light', 'dark'].includes(theme)) theme = 'light';
    localStorage.setItem('lms_theme', theme);
    this._applyTheme(theme);
    this.renderApp();
  }

  _applyTheme(theme) {
    const html = document.documentElement;
    if (!theme || theme === 'light') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }
  }

  _checkPwaInstallOffer() {
    if (window.matchMedia('(display-mode: standalone)').matches) return; // already installed
    if (localStorage.getItem('lms_pwaInstallDeclined')) return;
    const visits = parseInt(localStorage.getItem('lms_visitCount') || '0') + 1;
    localStorage.setItem('lms_visitCount', visits);
    if (visits >= 2 && this._pwaPrompt) this.offerPwaInstall();
  }

  async offerPwaInstall() {
    if (localStorage.getItem('lms_pwaInstallDeclined')) return;
    if (!this._pwaPrompt) return;
    this._pwaPrompt.prompt();
    const { outcome } = await this._pwaPrompt.userChoice;
    this._pwaPrompt = null;
    if (outcome === 'accepted') {
      Components.showToast('ホーム画面に追加しました！', 'success');
    } else {
      localStorage.setItem('lms_pwaInstallDeclined', '1');
    }
  }

  // ─── Sidebar toggle (未病ダイアリー方式) ───
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('open');
    sidebar.classList.toggle('open', !isOpen);
    if (overlay) overlay.classList.toggle('active', !isOpen);
  }

  // ─── Modal ───
  openQuickCheckin() {
    this.openModal('今日の体調を記録', `
      <p style="color:var(--text-secondary);margin-bottom:20px;">2項目だけ教えてください。30秒で完了します。</p>
      <div class="form-group">
        <label>今日の体調 <span id="qc-cond-val" style="font-weight:700;color:var(--accent)">5</span>/10</label>
        <input type="range" min="1" max="10" value="5" class="form-input" id="qcCondition"
          oninput="document.getElementById('qc-cond-val').textContent=this.value"
          style="padding:8px 0;cursor:pointer">
        <div style="display:flex;justify-content:space-between;font-size:0.73rem;color:var(--text-muted)">
          <span>とても辛い</span><span>最高</span>
        </div>
      </div>
      <div class="form-group" style="margin-top:16px">
        <label>昨夜の睡眠の質 <span id="qc-sleep-val" style="font-weight:700;color:var(--accent)">5</span>/10</label>
        <input type="range" min="1" max="10" value="5" class="form-input" id="qcSleep"
          oninput="document.getElementById('qc-sleep-val').textContent=this.value"
          style="padding:8px 0;cursor:pointer">
        <div style="display:flex;justify-content:space-between;font-size:0.73rem;color:var(--text-muted)">
          <span>眠れなかった</span><span>ぐっすり</span>
        </div>
      </div>
      <div class="form-group" style="margin-top:16px">
        <label>ひと言メモ（任意）</label>
        <input type="text" id="qcNote" class="form-input" placeholder="気になることがあれば">
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-primary btn-lg" style="width:100%" onclick="app.saveQuickCheckin()">記録する</button>
      </div>
    `);
  }

  saveQuickCheckin() {
    const condition = parseInt(document.getElementById('qcCondition')?.value || '5');
    const sleep = parseInt(document.getElementById('qcSleep')?.value || '5');
    const note = document.getElementById('qcNote')?.value?.trim() || '';

    store.addDomainEntry('health', 'symptoms', {
      condition_level: condition,
      fatigue_level: Math.max(1, 11 - condition),
      notes: note
    });
    store.addDomainEntry('health', 'sleepData', {
      quality: sleep,
      notes: ''
    });

    this.closeModal();
    Components.showToast('今日の体調を記録しました', 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  openQuickAddContact() {
    const levels = CONFIG.domains?.relationship?.distanceLevels || {};
    const levelOpts = [1,2,3,4,5].map(n => {
      const lv = levels[n] || {};
      return `<option value="${n}">${n}. ${Components.escapeHtml(lv.description || '')}</option>`;
    }).join('');
    this.openModal('連絡先を追加', `
      <div class="form-group">
        <label>お名前 <span style="color:var(--danger)">*</span></label>
        <input type="text" id="qc_name" class="form-input" placeholder="例：田中 花子" autocomplete="name">
      </div>
      <div class="form-group">
        <label>電話番号（任意）</label>
        <input type="tel" id="qc_phone" class="form-input" placeholder="例：090-1234-5678" autocomplete="tel">
      </div>
      <div class="form-group">
        <label>この方との距離感</label>
        <select id="qc_distance" class="form-input">${levelOpts}</select>
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <input type="text" id="qc_notes" class="form-input" placeholder="例：毎週会う親友">
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-primary btn-lg" style="width:100%" onclick="app.saveQuickContact()">追加する</button>
      </div>
    `);
  }

  saveQuickContact() {
    const name = document.getElementById('qc_name')?.value?.trim() || '';
    if (!name) { Components.showToast('お名前を入力してください', 'error'); return; }
    const phone = document.getElementById('qc_phone')?.value?.trim() || '';
    const distance = document.getElementById('qc_distance')?.value || '3';
    const notes = document.getElementById('qc_notes')?.value?.trim() || '';
    store.addDomainEntry('relationship', 'contacts', { name, phone, distance, notes, relationship: 'other' });
    this.closeModal();
    Components.showToast(`${name}さんを追加しました`, 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  // One-tap mood check-in from health home emoji picker
  quickMoodCheckin(level) {
    store.addDomainEntry('health', 'symptoms', {
      condition_level: level,
      fatigue_level: Math.max(1, 11 - level),
      notes: ''
    });
    Components.showToast('今日の体調を記録しました', 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  // ─── Domain quick check-ins (one-tap from checkin nudge) ───

  quickConsciousnessCheckin(level) {
    store.addDomainEntry('consciousness', 'entries', {
      mood_level: level,
      notes: ''
    });
    Components.showToast('今日の気持ちを記録しました', 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  quickTimeCheckin(level) {
    store.addDomainEntry('time', 'entries', {
      activity: '日課チェックイン',
      category: 'leisure',
      productivity: level,
      notes: ''
    });
    Components.showToast('今日の充実度を記録しました', 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  quickWorkCheckin(status) {
    const noteMap = { active: '活動した', planned: '予定あり', rest: '今日は休み' };
    store.addDomainEntry('work', 'tasks', {
      title: '日課チェックイン',
      status: status === 'active' ? 'done' : 'todo',
      notes: noteMap[status] || status
    });
    Components.showToast('今日の活動状況を記録しました', 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  quickRelationshipCheckin(talked) {
    if (!talked) {
      Components.showToast('また明日声をかけてみましょう', 'info');
      return;
    }
    const contacts = store.get('relationship_contacts') || [];
    const esc = Components.escapeHtml;
    const opts = contacts.slice(0, 15).map(c =>
      `<option value="${esc(c.name)}">${esc(c.name)}</option>`
    ).join('');
    this.openModal('今日連絡した方', `
      <div class="form-group">
        <label>誰と連絡しましたか？</label>
        ${contacts.length > 0
          ? `<select id="qr_person" class="form-input"
               onchange="document.getElementById('qr_other').style.display=this.value==='_other'?'block':'none'">
               <option value="">選択してください</option>
               ${opts}
               <option value="_other">その他（名前を入力）</option>
             </select>
             <input type="text" id="qr_other" class="form-input" placeholder="お名前を入力"
               style="display:none;margin-top:8px">`
          : `<input type="text" id="qr_other" class="form-input" placeholder="お名前を入力してください">`
        }
      </div>
      <div class="form-group">
        <label>連絡の種類</label>
        <select id="qr_type" class="form-input">
          <option value="call">電話</option>
          <option value="message" selected>メッセージ・LINE</option>
          <option value="meeting">直接会った</option>
          <option value="other">その他</option>
        </select>
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-primary btn-lg" style="width:100%" onclick="app.saveQuickRelationship()">記録する</button>
      </div>
    `);
  }

  saveQuickRelationship() {
    const selectEl = document.getElementById('qr_person');
    const otherEl = document.getElementById('qr_other');
    const typeEl = document.getElementById('qr_type');
    let person = selectEl ? selectEl.value : '';
    if (!person || person === '_other') person = otherEl?.value?.trim() || '';
    const type = typeEl?.value || 'message';
    if (!person) { Components.showToast('お名前を入力してください', 'info'); return; }
    store.addDomainEntry('relationship', 'interactions', {
      person,
      type,
      quality: 3,
      notes: 'ワンタッチ記録'
    });
    this.closeModal();
    Components.showToast(`${person}さんへの連絡を記録しました`, 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  quickExpenseEntry() {
    this.openModal('今日の出費を記録', `
      <div class="form-group">
        <label>金額（円）<span style="color:var(--danger)"> *</span></label>
        <input type="number" id="qe_amount" class="form-input" placeholder="例：1200" min="0" step="100" inputmode="numeric">
      </div>
      <div class="form-group">
        <label>カテゴリ</label>
        <select id="qe_category" class="form-input">
          <option value="food">食費</option>
          <option value="medical">医療・薬</option>
          <option value="transport">交通費</option>
          <option value="utility">光熱費</option>
          <option value="entertainment">娯楽・趣味</option>
          <option value="other">その他</option>
        </select>
      </div>
      <div class="form-group">
        <label>メモ（省略可）</label>
        <input type="text" id="qe_note" class="form-input" placeholder="何に使いましたか？">
      </div>
      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-primary btn-lg" style="width:100%" onclick="app.saveQuickExpense()">記録する</button>
      </div>
    `);
  }

  saveQuickExpense() {
    const amount = parseFloat(document.getElementById('qe_amount')?.value || '0');
    const category = document.getElementById('qe_category')?.value || 'other';
    const note = document.getElementById('qe_note')?.value?.trim() || '';
    if (!amount || amount <= 0) { Components.showToast('金額を入力してください', 'info'); return; }
    const catLabels = { food: '食費', medical: '医療・薬', transport: '交通費', utility: '光熱費', entertainment: '娯楽・趣味', other: 'その他' };
    store.addDomainEntry('assets', 'expenses', {
      amount,
      category,
      description: note || catLabels[category] || 'その他',
      notes: 'ワンタッチ記録'
    });
    this.closeModal();
    Components.showToast(`${amount.toLocaleString()}円の出費を記録しました`, 'success');
    setTimeout(() => this.renderApp(), 100);
  }

  shareApp() {
    if (navigator.share) {
      navigator.share({
        title: 'LMS - 65歳からの人生管理アプリ',
        text: '健康・時間・お金・仕事・関係・心の6つを一緒に管理できる無料アプリです。使いやすくておすすめ！',
        url: 'https://agewaller.github.io/lms/'
      }).catch(() => {});
    }
  }

  copyShareLink() {
    const url = 'https://agewaller.github.io/lms/';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => Components.showToast('リンクをコピーしました', 'success'))
        .catch(() => Components.showToast('コピーに失敗しました', 'error'));
    } else {
      Components.showToast(url, 'info');
    }
  }

  openModal(title, bodyHtml) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (overlay) overlay.classList.add('active');
  }

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
  }
};

// Global instance
var app = new App();
