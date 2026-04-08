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

    // Initialize Firebase
    await FirebaseBackend.init();

    // Check if already authenticated
    if (store.get('isAuthenticated') && store.get('user')) {
      store.set('currentDomain', entryDomain || store.get('currentDomain') || 'health');
      store.set('currentPage', 'home');
      this.renderApp();
    }

    // Listen for auth changes
    store.on('isAuthenticated', (val) => {
      if (val) {
        store.set('currentDomain', this.entryDomain || store.get('currentDomain') || 'health');
        store.set('currentPage', 'home');
        this.renderApp();
      }
    });

    // Listen for navigation changes
    store.on('currentPage', () => this.renderApp());
    store.on('currentDomain', () => this.renderApp());
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

    if (nameEl) nameEl.textContent = user?.displayName || user?.email || '';
    if (avatarEl && user?.photoURL) avatarEl.src = user.photoURL;
    if (domainLabel) {
      const d = store.get('currentDomain');
      domainLabel.textContent = `${CONFIG.domains[d]?.icon || ''} ${i18n.t(d)}`;
    }

    // Admin link
    const adminLink = document.getElementById('adminLink');
    if (adminLink) {
      adminLink.style.display = FirebaseBackend.isAdmin() ? 'block' : 'none';
    }
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

      // Try to parse as JSON for structured response
      let parsed;
      try { parsed = JSON.parse(result); } catch (e) { parsed = null; }

      if (parsed && parsed.response) {
        if (responseEl) responseEl.innerHTML = `<div class="quick-response">${Components.formatMarkdown(parsed.response)}</div>`;
      } else {
        if (responseEl) responseEl.innerHTML = `<div class="quick-response">${Components.formatMarkdown(result)}</div>`;
      }

      input.value = '';
    } catch (e) {
      if (responseEl) responseEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
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
  async analyzeStock() {
    const input = document.getElementById('stockTicker');
    if (!input || !input.value.trim()) return;

    const ticker = input.value.trim();
    const resultEl = document.getElementById('stockResult');
    if (resultEl) resultEl.innerHTML = Components.loading('銘柄を分析中です...');

    try {
      const prompt = CONFIG.prompts.assets.stock_analysis || CONFIG.inlinePrompts.stockAnalysis;
      const result = await AIEngine.analyze('assets', 'stock_analysis', {
        text: `銘柄: ${ticker}\n日付: ${new Date().toISOString().slice(0, 10)}`
      });

      if (resultEl) {
        resultEl.innerHTML = `<div class="stock-result">
          <h3>📊 ${ticker} の分析結果</h3>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
          <div class="disclaimer">${i18n.t('disclaimer_assets')}</div>
        </div>`;
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
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

  // ─── Calendar import (Time domain) ───
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

  // ─── File Upload ───
  async handleFileUpload(event, domain) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (file.type.startsWith('image/')) {
        // Store as base64 for image analysis
        store.addDomainEntry(domain, 'photos' in CONFIG.domains[domain]?.categories ? 'photos' : 'entries', {
          type: 'image',
          filename: file.name,
          data: content
        });
      } else {
        // Store text-based files
        store.addDomainEntry(domain, 'entries', {
          type: 'file',
          filename: file.name,
          data: content
        });
      }
      Components.showToast(i18n.t('saved'), 'success');
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }

  // ─── Settings ───
  saveProfile() {
    const profile = {
      age: document.getElementById('profileAge')?.value || '',
      gender: document.getElementById('profileGender')?.value || '',
      location: document.getElementById('profileLocation')?.value || '',
      language: document.getElementById('profileLang')?.value || 'ja'
    };
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

  // ─── Admin Methods ───
  loadAdminPrompt() {
    const domain = document.getElementById('adminPromptDomain')?.value;
    const type = document.getElementById('adminPromptType')?.value;
    const custom = store.get('customPrompts') || {};
    const textarea = document.getElementById('adminPromptText');

    if (textarea) {
      textarea.value = custom[domain]?.[type] || CONFIG.prompts[domain]?.[type] || '';
    }
  }

  saveAdminPrompt() {
    const domain = document.getElementById('adminPromptDomain')?.value;
    const type = document.getElementById('adminPromptType')?.value;
    const text = document.getElementById('adminPromptText')?.value;

    const custom = store.get('customPrompts') || {};
    if (!custom[domain]) custom[domain] = {};
    custom[domain][type] = text;
    store.set('customPrompts', custom);
    Components.showToast(i18n.t('saved'), 'success');
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
    Components.showToast(i18n.t('saved'), 'success');
  }

  saveFirebaseConfig() {
    CONFIG.firebase.apiKey = document.getElementById('fbApiKey')?.value || '';
    CONFIG.firebase.authDomain = document.getElementById('fbAuthDomain')?.value || '';
    CONFIG.firebase.projectId = document.getElementById('fbProjectId')?.value || '';
    localStorage.setItem('lms_firebaseConfig', JSON.stringify(CONFIG.firebase));
    Components.showToast(i18n.t('saved') + ' (reload required)', 'success');
  }

  saveWorkerUrl() {
    const url = document.getElementById('workerUrl')?.value || '';
    CONFIG.endpoints.anthropic = url;
    localStorage.setItem('lms_workerUrl', url);
    Components.showToast(i18n.t('saved'), 'success');
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
