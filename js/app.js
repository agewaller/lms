/* ============================================================
   LMS - Main Application Controller
   ============================================================ */
var App = class App {
  constructor() {
    this.entryDomain = null; // Which sub-site the user entered from
  }

  // ─── Initialize ───
  async init(entryDomain) {
    this.entryDomain = entryDomain || null;
    this.checkOAuthCallbacks();

    // Initialize Firebase
    await FirebaseBackend.init();

    // Check if already authenticated
    if (store.get('isAuthenticated') && store.get('user')) {
      store.set('currentDomain', entryDomain || store.get('currentDomain') || 'health');
      store.set('currentPage', 'home');
      this.renderApp();
      this.startInboxPolling();
    }

    // Listen for auth changes
    store.on('isAuthenticated', (val) => {
      if (val) {
        store.set('currentDomain', this.entryDomain || store.get('currentDomain') || 'health');
        store.set('currentPage', 'home');
        this.renderApp();
        this.startInboxPolling();
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
    const pageNames = { home: 'ホーム', record: '記録する', actions: 'アクション', ask_ai: 'AIに相談', settings: '設定', admin: '管理' };
    if (titleEl) titleEl.textContent = `${domainConfig?.icon || ''} ${i18n.t(domain)} - ${pageNames[page] || page}`;

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
  }

  updateSidebar() {
    const user = store.get('user');
    const nameEl = document.getElementById('userName');
    const avatarEl = document.getElementById('userAvatar');
    const domainLabel = document.getElementById('currentDomainLabel');

    if (nameEl) nameEl.textContent = user?.displayName || user?.email || 'ゲスト';
    if (avatarEl) {
      if (user?.photoURL) {
        avatarEl.innerHTML = `<img src="${user.photoURL}" alt="">`;
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
        html += '</div>';
        if (responseEl) responseEl.innerHTML = html;
      } else {
        // Fallback: strip code fences and display as markdown
        const stripped = (result || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
        if (responseEl) responseEl.innerHTML = `<div class="quick-response">${Components.formatMarkdown(stripped)}</div>`;
      }

      input.value = '';
    } catch (e) {
      if (responseEl) responseEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
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

    store.addDomainEntry(domain, category, data);
    Components.showToast(i18n.t('saved'), 'success');
    form.reset();
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

  // ─── AI Chat ───
  async sendChat(domain) {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    // Show user message immediately
    const container = document.getElementById('chatContainer');
    if (container) {
      container.innerHTML += Components.chatMessage({
        role: 'user', content: text, timestamp: new Date().toISOString()
      });
      container.innerHTML += Components.loading(i18n.t('analyzing'));
      container.scrollTop = container.scrollHeight;
    }

    try {
      const response = await AIEngine.chat(domain, text);

      // Re-render to show full history
      this.renderApp();
    } catch (e) {
      if (container) {
        container.innerHTML += Components.chatMessage({
          role: 'assistant', content: '⚠️ ' + e.message, timestamp: new Date().toISOString()
        });
      }
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
      Components.showToast(i18n.t('saved'), 'success');
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
    if (resultEl) resultEl.innerHTML = Components.loading(`${ticker} を分析中です...`);

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
          ${e.message || 'もう一度お試しください'}
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
          <label>${i18n.t(k) || k}</label>
          ${typeof v === 'string' && v.length > 50
            ? `<textarea name="${k}" class="form-input" rows="3">${v}</textarea>`
            : `<input type="${typeof v === 'number' ? 'number' : 'text'}" name="${k}" class="form-input" value="${v}">`}
        </div>
      `).join('')}
      <div class="form-actions">
        <button type="button" class="btn btn-primary" onclick="app.saveDataEntryEdit('${domain}','${category}','${id}')">保存</button>
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
    if (!confirm('この記録を削除しますか？')) return;
    const key = `${domain}_${category}`;
    const entries = (store.get(key) || []).filter(e => e.id !== id);
    store.set(key, entries);

    // Also delete from Firestore if connected
    if (typeof FirebaseBackend !== 'undefined' && FirebaseBackend.db) {
      const uid = store.get('user')?.uid;
      if (uid) {
        FirebaseBackend.db.collection('users').doc(uid).collection(key).doc(id).delete().catch(e => console.warn(e));
      }
    }

    Components.showToast('削除しました', 'info');
    this.renderApp();
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
    if (!confirm('Fitbit接続を解除しますか？')) return;
    if (typeof fitbit !== 'undefined') fitbit.disconnect();
    Components.showToast('接続を解除しました', 'info');
    this.renderApp();
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
    if (!confirm('Googleカレンダー接続を解除しますか？')) return;
    if (typeof googleCalendar !== 'undefined') googleCalendar.disconnect();
    Components.showToast('接続を解除しました', 'info');
    this.renderApp();
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
    if (!confirm('Outlook接続を解除しますか？')) return;
    if (typeof outlookCalendar !== 'undefined') outlookCalendar.disconnect();
    Components.showToast('接続を解除しました', 'info');
    this.renderApp();
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
    if (!confirm('Gmail接続を解除しますか？')) return;
    if (typeof gmailIntegration !== 'undefined') gmailIntegration.disconnect();
    Components.showToast('接続を解除しました', 'info');
    this.renderApp();
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
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
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
      modal.innerHTML = `<div class="modal-content">
        <h3>レジュメをコピー</h3>
        <textarea class="form-input" rows="10" readonly>${text}</textarea>
        <p>上のテキストをコピーして、求人サイトに貼り付けてください。</p>
        <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">閉じる</button>
      </div>`;
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
    if (!confirm('このプロンプトを削除しますか？')) return;
    delete CONFIG.prompts[key];
    const custom = store.get('customPrompts') || {};
    delete custom[key];
    store.set('customPrompts', custom);
    Components.showToast('削除しました', 'info');
    this.renderApp();
  }

  addNewPrompt() {
    const key = prompt('プロンプトのキー名を入力（例: work_custom）');
    if (!key) return;
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
      if (resultEl) resultEl.innerHTML = '<div class="toast toast-error" style="position:static;opacity:1;margin-top:10px;">✗ ' + e.message + '</div>';
    }
  }

  clearApiKeys() {
    if (!confirm('すべてのAPIキーを削除しますか？')) return;
    ['anthropic', 'openai', 'google'].forEach(p => {
      localStorage.removeItem('lms_apikey_' + p);
    });
    store.state._apiKeys = {};
    Components.showToast('削除しました', 'info');
    this.renderApp();
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
    if (!confirm('Firebase設定を削除しますか？')) return;
    localStorage.removeItem('lms_firebaseConfig');
    Components.showToast('削除しました（再読み込みが必要です）', 'info');
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
  async addAdminEmail() {
    const email = prompt('管理者として追加するメールアドレスを入力してください');
    if (!email || !email.trim()) return;

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

    // Sync to Firestore admin/config
    if (FirebaseBackend.db) {
      await FirebaseBackend.db.collection('admin').doc('config').set(
        {
          adminEmails: list,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      ).catch(e => console.warn(e));
    }

    Components.showToast(`${trimmed} を管理者に追加しました`, 'success');
    this.renderApp();
  }

  async removeAdminEmail(email) {
    if (email === 'agewaller@gmail.com') {
      Components.showToast('オーナーアカウントは削除できません', 'error');
      return;
    }
    if (!confirm(`${email} を管理者から外しますか？`)) return;

    const list = (store.get('adminEmails') || ['agewaller@gmail.com']).filter(e => e !== email);
    store.set('adminEmails', list);

    if (FirebaseBackend.db) {
      await FirebaseBackend.db.collection('admin').doc('config').set(
        {
          adminEmails: list,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      ).catch(e => console.warn(e));
    }

    Components.showToast('管理者から削除しました', 'info');
    this.renderApp();
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
            <ul style="font-size:12px;color:var(--text-muted);max-height:200px;overflow-y:auto;">
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

    const body = `
      <div class="user-detail">
        <div class="user-detail-section">
          <h4>基本情報</h4>
          <p><strong>お名前:</strong> ${user.displayName || '-'}</p>
          <p><strong>メール:</strong> ${user.email || '-'}</p>
          <p><strong>年齢:</strong> ${user.age || '-'}</p>
          <p><strong>性別:</strong> ${user.gender || '-'}</p>
          <p><strong>居住地:</strong> ${user.location || '-'}</p>
          <p><strong>職業:</strong> ${user.occupation || '-'}</p>
        </div>

        <div class="user-detail-section">
          <h4>健康</h4>
          <p><strong>持病・症状:</strong> ${user.diseases.length > 0 ? user.diseases.join(', ') : 'なし'}</p>
          <p><strong>服薬:</strong> ${user.medications || 'なし'}</p>
        </div>

        <div class="user-detail-section">
          <h4>資産・収入</h4>
          <p><strong>月収:</strong> ${user.monthlyIncome || '-'}</p>
          <p><strong>貯蓄:</strong> ${user.savings || '-'}</p>
          <p><strong>プラン:</strong> ${user.subscription}</p>
        </div>

        <div class="user-detail-section">
          <h4>人生目標・悩み</h4>
          <p><strong>目標:</strong> ${user.lifeGoals || '-'}</p>
          <p><strong>悩み:</strong> ${user.concerns || '-'}</p>
        </div>

        ${scoreHtml ? `
        <div class="user-detail-section">
          <h4>6領域スコア</h4>
          <div class="user-scores-grid">${scoreHtml}</div>
        </div>` : ''}

        <div class="user-detail-section" style="font-size:11px;color:var(--text-muted);">
          UID: ${user.uid}<br>
          最終アクティビティ: ${user.lastActive ? new Date(user.lastActive).toLocaleString('ja-JP') : '-'}
        </div>
      </div>
    `;

    this.openModal(user.displayName || user.email || 'ユーザー詳細', body);
  }

  generateDemoData() {
    if (!confirm('デモデータを生成しますか？既存データに追加されます。')) return;
    // Generate sample entries for each domain
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      store.addDomainEntry('health', 'symptoms', { condition_level: 5 + Math.floor(Math.random() * 3), timestamp: d.toISOString() });
      store.addDomainEntry('health', 'sleepData', { quality: 6 + Math.floor(Math.random() * 3), timestamp: d.toISOString() });
    }
    Components.showToast('デモデータを生成しました', 'success');
    this.renderApp();
  }

  deleteAllData() {
    if (!confirm('本当にすべてのデータを削除しますか？この操作は元に戻せません。')) return;
    if (!confirm('最終確認：すべてのデータを完全に削除します。よろしいですか？')) return;
    store.clearAll();
    Components.showToast('すべてのデータを削除しました', 'info');
    window.location.reload();
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
