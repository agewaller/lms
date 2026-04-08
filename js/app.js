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
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) {
      Components.showToast(i18n.t('error'), 'error');
      return;
    }
    try {
      await FirebaseBackend.signInWithEmail(email, password);
    } catch (e) {
      Components.showToast(e.message, 'error');
    }
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

  // ─── Main Render ───
  renderApp() {
    const page = store.get('currentPage');
    const domain = store.get('currentDomain');

    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    // Update domain tabs
    const tabsEl = document.getElementById('domainTabs');
    if (tabsEl) tabsEl.innerHTML = Components.domainTabs(domain);

    // Update sub-navigation
    const subNavEl = document.getElementById('subNav');
    if (subNavEl) subNavEl.innerHTML = Components.subNav(page, domain);

    // Update sidebar info
    this.updateSidebar();

    // Render page content
    mainContent.innerHTML = Pages.render(page, domain);

    // Scroll chat to bottom if on ask_ai page
    if (page === 'ask_ai') {
      setTimeout(() => {
        const chat = document.getElementById('chatContainer');
        if (chat) chat.scrollTop = chat.scrollHeight;
      }, 50);
    }

    // Initialize PayPal buttons if on settings page
    if (page === 'settings') {
      setTimeout(() => {
        Object.keys(CONFIG.paypal.plans).forEach(key => {
          PayPalManager.renderButtons('paypal-btn-' + key, key);
        });
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

  // ─── Sidebar toggle ───
  toggleSidebar() {
    store.set('sidebarOpen', !store.get('sidebarOpen'));
    document.body.classList.toggle('sidebar-open', store.get('sidebarOpen'));
  }
};

// Global instance
var app = new App();
