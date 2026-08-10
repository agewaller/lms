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
      this.startReminderTimer();
      if (!store.get('onboardingComplete')) {
        setTimeout(() => this.showOnboarding(), 400);
      }
    }

    // Listen for auth changes
    store.on('isAuthenticated', (val) => {
      if (val) {
        store.set('currentDomain', this.entryDomain || store.get('currentDomain') || 'health');
        store.set('currentPage', 'home');
        this.renderApp();
        this.startInboxPolling();
        this.startReminderTimer();
        // Show onboarding for first-time users (after short delay to let render settle)
        if (!store.get('onboardingComplete')) {
          setTimeout(() => this.showOnboarding(), 400);
        }
      } else {
        this.stopInboxPolling();
        this.stopReminderTimer();
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

  // ─── Daily reminder (browser Notification API) ───
  startReminderTimer() {
    if (this._reminderTimer) return;
    this._reminderTimer = setInterval(() => this.checkDailyReminder(), 10 * 60 * 1000); // check every 10 min
    this.checkDailyReminder(); // also check on startup
  }

  stopReminderTimer() {
    if (this._reminderTimer) {
      clearInterval(this._reminderTimer);
      this._reminderTimer = null;
    }
  }

  checkDailyReminder() {
    const prefs = store.get('reminderPrefs') || {};
    if (!prefs.enabled || !prefs.time) return;

    const now = new Date();
    const [hh, mm] = (prefs.time || '09:00').split(':').map(Number);
    if (now.getHours() !== hh || now.getMinutes() > mm + 9) return; // only fire in the 10-min window

    const today = now.toISOString().slice(0, 10);
    const lastNotified = store.get('reminderLastDate');
    if (lastNotified === today) return; // already notified today

    // Check if user has recorded today in any domain
    const domains = Object.keys(CONFIG.domains);
    let recordedToday = false;
    for (const d of domains) {
      const cats = Object.keys(CONFIG.domains[d].categories || {});
      for (const c of cats) {
        const entries = store.getDomainData(d, c, 1);
        if (entries.some(e => (e.timestamp || '').startsWith(today))) {
          recordedToday = true;
          break;
        }
      }
      if (recordedToday) break;
    }

    if (!recordedToday) {
      store.set('reminderLastDate', today);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('LMS - 今日の記録をつけましょう', {
          body: '1分でOKです。今日の気持ちや体調を記録しておきましょう。',
          icon: 'images/icon.svg',
          tag: 'lms-daily-reminder'
        });
      } else {
        // Fall back to in-app toast if notification permission not granted
        Components.showToast('今日の記録をつけましょう！「記録する」タブからどうぞ。', 'info');
      }
    }
  }

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      Components.showToast('このブラウザはリマインダー通知に対応していません', 'info');
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      Components.showToast('通知を許可しました。毎日指定の時刻にお知らせします。', 'success');
    } else {
      Components.showToast('通知が拒否されました。ブラウザの設定から変更できます。', 'info');
    }
    this.renderApp(); // refresh settings page to show updated state
  }

  saveReminderPrefs() {
    const enabled = document.getElementById('reminderEnabled')?.checked;
    const time = document.getElementById('reminderTime')?.value || '09:00';
    store.set('reminderPrefs', { enabled: !!enabled, time });
    if (enabled && 'Notification' in window && Notification.permission !== 'granted') {
      this.requestNotificationPermission();
    } else {
      Components.showToast('リマインダー設定を保存しました', 'success');
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

  // ─── User-friendly error messages ───
  // Translates Firebase/AI error codes to plain Japanese for 65+ users.
  friendlyError(e) {
    const msg = (e && (e.code || e.message)) || '';
    const code = e && e.code ? e.code : '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
      return 'パスワードまたはメールアドレスが正しくありません';
    if (code === 'auth/user-not-found')
      return 'このメールアドレスは登録されていません';
    if (code === 'auth/email-already-in-use')
      return 'このメールアドレスはすでに使われています';
    if (code === 'auth/invalid-email')
      return 'メールアドレスの形式が正しくありません';
    if (code === 'auth/weak-password')
      return 'パスワードが弱すぎます。6文字以上で設定してください';
    if (code === 'auth/too-many-requests')
      return 'ログイン試行が多すぎます。しばらくしてから再試行してください';
    if (code === 'auth/network-request-failed')
      return 'インターネット接続をご確認ください';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request')
      return 'ログインがキャンセルされました';
    if (code === 'auth/requires-recent-login')
      return 'セキュリティのため、再度ログインしてください';
    if (code === 'auth/account-exists-with-different-credential')
      return '別の方法で登録済みのメールアドレスです';
    if (/overloaded|rate.?limit|HTTP 429/i.test(msg))
      return 'サーバーが混み合っています。しばらくしてから再試行してください';
    if (/quota|limit.?exceed/i.test(msg))
      return '利用上限に達しています。管理者にお問い合わせください';
    if (/HTTP 401|HTTP 403|APIキーが設定されていません|api.?key/i.test(msg))
      return '接続設定を確認してください。管理者にお問い合わせください';
    if (/HTTP 5\d\d/i.test(msg))
      return 'サービスが一時的に利用できません。しばらくしてから再試行してください';
    if (/network|fetch|timeout|ECONNRESET|接続できません/i.test(msg))
      return 'インターネット接続を確認してから再試行してください';
    // If message is already in Japanese (no ASCII HTTP error prefix), pass it through
    if (/[぀-ヿ一-鿿]/.test(msg) && !/HTTP\s*\d|error|Error/.test(msg))
      return msg;
    // Strip Firebase boilerplate prefix
    const cleaned = (e.message || '')
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\(auth\/[\w-]+\)\.?\s*$/, '')
      .trim();
    return cleaned || 'エラーが発生しました。しばらくしてから再試行してください';
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
      Components.showToast(this.friendlyError(e), 'error');
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
      Components.showToast(this.friendlyError(e), 'error');
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
      Components.showToast(this.friendlyError(e), 'error');
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

  // ─── Onboarding ───
  showOnboarding() {
    if (document.getElementById('onboardingOverlay')) return;
    const el = document.createElement('div');
    el.innerHTML = Pages.renderOnboarding();
    document.body.appendChild(el.firstElementChild);
  }

  onboardingSelectDomain(domain) {
    store.set('onboardingComplete', true);
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.remove();
    this.switchDomain(domain);
  }

  onboardingSkip() {
    store.set('onboardingComplete', true);
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.remove();
  }

  // ─── Share Streak ───
  async shareStreak(streak) {
    const text = streak >= 100
      ? `LMSで${streak}日連続記録達成！人生6領域を毎日記録して、自分の変化を見える化しています。`
      : `LMSで${streak}日連続で記録中！65歳からの人生を、意識・健康・時間・仕事・関係・資産の6領域で整えています。`;
    try {
      await navigator.share({
        title: 'LMS - Life Management System',
        text,
        url: 'https://agewaller.github.io/lms/'
      });
    } catch (e) {
      // User cancelled or share not available — silently ignore
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
    const pageNames = { home: 'ホーム', record: '記録する', actions: 'アクション', ask_ai: '相談する', settings: '設定', admin: '管理' };
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

    // Render health trend chart
    if (domain === 'health' && page === 'home') {
      setTimeout(() => this.initHealthChart(), 100);
    }
  }

  initHealthChart() {
    const canvas = document.getElementById('healthTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const symptoms = store.getDomainData('health', 'symptoms', 14);
    if (symptoms.length < 2) return;

    // Average condition_level per day
    const byDate = {};
    symptoms.forEach(s => {
      const d = (s.timestamp || '').slice(0, 10);
      if (!d) return;
      if (!byDate[d]) byDate[d] = [];
      if (s.condition_level != null) byDate[d].push(Number(s.condition_level));
    });

    const dates = Object.keys(byDate).sort().slice(-7);
    if (dates.length < 2) return;

    const labels = dates.map(d => {
      const dt = new Date(d);
      return `${dt.getMonth() + 1}/${dt.getDate()}`;
    });
    const data = dates.map(d => {
      const vals = byDate[d];
      return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10 : null;
    });

    if (this._healthChart) this._healthChart.destroy();

    this._healthChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: '#10b981',
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => `体調: ${ctx.raw}/10` }
        }},
        scales: {
          y: { min: 0, max: 10, ticks: { stepSize: 2, font: { size: 13 } } },
          x: { ticks: { font: { size: 12 } } }
        }
      }
    });
  }

  updateSidebar() {
    const user = store.get('user');
    const nameEl = document.getElementById('userName');
    const avatarEl = document.getElementById('userAvatar');
    const domainLabel = document.getElementById('currentDomainLabel');

    if (nameEl) nameEl.textContent = user?.displayName || user?.email || 'ゲスト';
    if (avatarEl) {
      if (user?.photoURL) {
        avatarEl.innerHTML = `<img src="${Components.escapeHtml(user.photoURL)}" alt="">`;
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

    // Auto-save the typed text as a domain diary entry so it counts toward streak
    const quickSaveCategory = {
      consciousness: 'entries', health: 'symptoms', time: 'entries',
      work: 'tasks', relationship: 'interactions', assets: 'overview'
    }[domain] || 'entries';
    store.addDomainEntry(domain, quickSaveCategory, { notes: text, source: 'quick_input' });

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
      if (responseEl) responseEl.innerHTML = `<div class="error-msg">${Components.escapeHtml(this.friendlyError(e))}</div>`;
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
      Components.showToast(this.friendlyError(e), 'error');
    }
  }

  // ─── Diary Save ───
  saveDiary(domain) {
    const textarea = document.getElementById('diaryText');
    if (!textarea || !textarea.value.trim()) return;

    // Map each domain to the most appropriate category for a free-text diary entry
    const diaryCategoryMap = {
      consciousness: 'entries', health: 'symptoms', time: 'entries',
      work: 'tasks', relationship: 'interactions', assets: 'overview'
    };
    const category = diaryCategoryMap[domain] || 'entries';
    store.addDomainEntry(domain, category, {
      type: 'diary',
      notes: textarea.value.trim()
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
      Components.showToast(this.friendlyError(e), 'error');
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
          role: 'assistant', content: this.friendlyError(e), timestamp: new Date().toISOString()
        });
      }
    }
  }

  // ─── Clear chat history for a domain ───
  clearChatHistory(domain) {
    const all = store.get('conversationHistory') || [];
    store.set('conversationHistory', all.filter(m => m.domain !== domain && m.domain));
    this.renderApp();
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
      Components.showToast(this.friendlyError(e), 'error');
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
    console.log('Execute action:', type, data);
    if (type === 'link' && data) {
      window.open(data, '_blank', 'noopener');
    }
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
          この機能を利用するには、管理者による設定が必要です。管理者にご連絡ください。
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
          <h3>${Components.escapeHtml(ticker)} の分析結果</h3>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
          <div class="disclaimer">${i18n.t('disclaimer_assets')}</div>
        </div>`;
      }
    } catch (e) {
      console.error('Stock analysis error:', e);
      if (resultEl) {
        resultEl.innerHTML = `<div class="error-msg">
          <strong>分析できませんでした</strong><br>
          ${Components.escapeHtml(this.friendlyError(e))}
        </div>`;
      }
    }
  }

  // ─── Doctor Visit Memo (Health domain) ───
  async generateDoctorMemo() {
    const resultEl = document.getElementById('doctorMemoResult');
    if (!resultEl) return;

    resultEl.innerHTML = Components.loading('最近の記録を確認しています...');

    // Gather recent health data
    const symptoms = store.getDomainData('health', 'symptoms', 14);
    const vitals = store.getDomainData('health', 'vitals', 14);
    const sleep = store.getDomainData('health', 'sleepData', 14);
    const meds = store.getDomainData('health', 'medications', 60);

    if (symptoms.length === 0 && vitals.length === 0 && sleep.length === 0) {
      resultEl.innerHTML = `<div class="info-msg">まだ健康記録がありません。「記録する」から体調などを入力してみましょう。</div>`;
      return;
    }

    const summaryText = [
      symptoms.length > 0 ? `【最近の体調（14日間: ${symptoms.length}件）】\n` + symptoms.slice(-5).map(s =>
        `・${(s.timestamp || '').slice(0, 10)} 体調${s.condition_level || '-'}/10 ${s.notes || ''}`
      ).join('\n') : '',
      vitals.length > 0 ? `\n【バイタル（直近5件）】\n` + vitals.slice(-5).map(v =>
        `・${(v.timestamp || '').slice(0, 10)} 血圧${v.bp_systolic || '-'}/${v.bp_diastolic || '-'} 体重${v.weight || '-'}kg 体温${v.temperature || '-'}℃`
      ).join('\n') : '',
      sleep.length > 0 ? `\n【睡眠（14日間 平均）】睡眠の質: ${(sleep.reduce((s, e) => s + (e.quality || 0), 0) / sleep.length).toFixed(1)}/10` : '',
      meds.length > 0 ? `\n【服薬中の薬】\n` + meds.slice(0, 10).map(m => `・${m.name || m.notes || ''} ${m.dosage || ''} ${m.timing || ''}`).join('\n') : ''
    ].filter(Boolean).join('\n');

    try {
      const result = await AIEngine.analyze('health', 'doctor_memo', { text: summaryText });

      resultEl.innerHTML = `<div class="doctor-memo-result">
        <div class="doctor-memo-header">
          <strong>診察メモ</strong>
          <div class="doctor-memo-btns">
            <button class="btn btn-sm btn-secondary" onclick="app.copyDoctorMemo()">コピーする</button>
            <button class="btn btn-sm btn-secondary" onclick="app.printDoctorMemo()">印刷する</button>
          </div>
        </div>
        <div id="doctorMemoText" class="doctor-memo-body">${Components.formatMarkdown(result)}</div>
        <p class="doctor-memo-note">このメモをコピー・印刷して、診察前にお医者さんに見せてください。</p>
      </div>`;
    } catch (e) {
      resultEl.innerHTML = `<div class="error-msg">メモを作成できませんでした。しばらくしてから再度お試しください。</div>`;
    }
  }

  copyDoctorMemo() {
    const el = document.getElementById('doctorMemoText');
    if (!el) return;
    const text = el.innerText || el.textContent || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        Components.showToast('クリップボードにコピーしました', 'success');
      });
    }
  }

  printDoctorMemo() {
    const el = document.getElementById('doctorMemoText');
    if (!el) return;
    const content = el.innerHTML;
    const date = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`<!DOCTYPE html><html lang="ja"><head>
      <meta charset="UTF-8">
      <title>診察メモ ${date}</title>
      <style>
        body { font-family: "Noto Sans JP", sans-serif; padding: 32px; color: #333; line-height: 1.8; }
        h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 16px; }
        h2, h3 { font-size: 15px; margin-top: 20px; }
        p { margin: 8px 0; }
        ul, ol { margin: 8px 0 8px 20px; }
        li { margin: 4px 0; }
        .date { font-size: 13px; color: #666; margin-bottom: 24px; }
        @media print { body { padding: 16px; } }
      </style>
    </head><body>
      <h1>診察メモ</h1>
      <p class="date">作成日: ${date}</p>
      ${content}
    </body></html>`);
    win.document.close();
    win.print();
  }

  // ─── Consciousness Quick Mood ───
  recordMoodQuick(level) {
    store.addDomainEntry('consciousness', 'entries', {
      type: 'mood_quick',
      mood_level: level
    });
    const labels = { 8: '良い気分', 5: '普通', 2: '少しつらい' };
    Components.showToast(`今日の気分を記録しました（${labels[level] || level}）`, 'success');
    this.renderApp();
  }

  // ─── Medication Check-in ───
  logMedTaken(name, status) {
    const today = new Date().toISOString().slice(0, 10);
    const log = store.get('health_med_log') || {};
    if (!log[today]) log[today] = {};
    log[today][name] = status;
    store.set('health_med_log', log);
    const msg = status === 'taken' ? `${name} を服用済みとして記録しました` : `${name} をスキップとして記録しました`;
    Components.showToast(msg, 'success');
    this.renderApp();
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
      Components.showToast(this.friendlyError(e), 'error');
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
      ${fields.map(([k, v]) => {
        const safeV = Components.escapeHtml(String(v ?? ''));
        const safeK = Components.escapeHtml(k);
        return `<div class="form-group">
          <label>${Components.escapeHtml(i18n.t(k) || k)}</label>
          ${typeof v === 'string' && v.length > 50
            ? `<textarea name="${safeK}" class="form-input" rows="3">${safeV}</textarea>`
            : `<input type="${typeof v === 'number' ? 'number' : 'text'}" name="${safeK}" class="form-input" value="${safeV}">`}
        </div>`;
      }).join('')}
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
    this.openModal('記録を削除', `
      <p>この記録を削除します。削除後は元に戻せません。</p>
      <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-danger" onclick="app.closeModal();app._doDeleteEntry('${domain}','${category}','${id}')">削除する</button>
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
      </div>`);
  }

  _doDeleteEntry(domain, category, id) {
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
    if (typeof fitbit !== 'undefined') fitbit.disconnect();
    Components.showToast('Fitbit接続を解除しました', 'info');
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
      Components.showToast(this.friendlyError(e), 'error');
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
      Components.showToast(this.friendlyError(e), 'error');
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
    if (typeof googleCalendar !== 'undefined') googleCalendar.disconnect();
    Components.showToast('Googleカレンダー接続を解除しました', 'info');
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
      Components.showToast(this.friendlyError(e), 'error');
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
    if (typeof outlookCalendar !== 'undefined') outlookCalendar.disconnect();
    Components.showToast('Outlook接続を解除しました', 'info');
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
      Components.showToast(this.friendlyError(e), 'error');
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
    if (typeof gmailIntegration !== 'undefined') gmailIntegration.disconnect();
    Components.showToast('Gmail接続を解除しました', 'info');
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
      Components.showToast(this.friendlyError(e), 'error');
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
      Components.showToast(this.friendlyError(e), 'error');
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
        Components.showToast(this.friendlyError(err), 'error');
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
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${Components.escapeHtml(this.friendlyError(e))}</div>`;
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
        Components.showToast(this.friendlyError(err), 'error');
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
    this.openModal('プロンプトを削除', `
      <p>このプロンプトを削除します。よろしいですか？</p>
      <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-danger" onclick="app.closeModal();app._doDeletePrompt('${key}')">削除する</button>
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
      </div>`);
  }

  _doDeletePrompt(key) {
    delete CONFIG.prompts[key];
    const custom = store.get('customPrompts') || {};
    delete custom[key];
    store.set('customPrompts', custom);
    Components.showToast('削除しました', 'info');
    this.renderApp();
  }

  addNewPrompt() {
    this.openModal('新しいプロンプトを追加', `
      <div class="form-group">
        <label>プロンプトのキー名（英数字とアンダースコアのみ）</label>
        <input type="text" id="newPromptKey" class="form-input" placeholder="例: work_custom">
      </div>
      <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-primary" onclick="app._doAddNewPrompt()">追加する</button>
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
      </div>`);
  }

  _doAddNewPrompt() {
    const key = document.getElementById('newPromptKey')?.value?.trim();
    if (!key) { Components.showToast('キー名を入力してください', 'error'); return; }
    if (CONFIG.prompts[key]) { Components.showToast('そのキーは既に存在します', 'error'); return; }
    this.closeModal();
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
      if (resultEl) resultEl.innerHTML = '<div class="toast toast-error" style="position:static;opacity:1;margin-top:10px;">✗ ' + Components.escapeHtml(this.friendlyError(e)) + '</div>';
    }
  }

  clearApiKeys() {
    ['anthropic', 'openai', 'google'].forEach(p => {
      localStorage.removeItem('lms_apikey_' + p);
    });
    store.state._apiKeys = {};
    Components.showToast('APIキーを削除しました', 'info');
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
    localStorage.removeItem('lms_firebaseConfig');
    Components.showToast('Firebase設定を削除しました（再読み込みが必要です）', 'info');
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
    this.openModal('管理者を追加', `
      <div class="form-group">
        <label>管理者のメールアドレス</label>
        <input type="email" id="newAdminEmail" class="form-input" placeholder="admin@example.com">
      </div>
      <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-primary" onclick="app._doAddAdminEmail()">追加する</button>
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
      </div>`);
  }

  async _doAddAdminEmail() {
    const email = document.getElementById('newAdminEmail')?.value?.trim().toLowerCase();
    if (!email) { Components.showToast('メールアドレスを入力してください', 'error'); return; }
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      Components.showToast('有効なメールアドレスを入力してください', 'error');
      return;
    }

    const list = store.get('adminEmails') || ['agewaller@gmail.com'];
    if (list.includes(email)) {
      Components.showToast('すでに管理者です', 'info');
      this.closeModal();
      return;
    }

    list.push(email);
    store.set('adminEmails', list);
    this.closeModal();

    if (FirebaseBackend.db) {
      await FirebaseBackend.db.collection('admin').doc('config').set(
        { adminEmails: list, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      ).catch(e => console.warn(e));
    }

    Components.showToast(`${email} を管理者に追加しました`, 'success');
    this.renderApp();
  }

  async removeAdminEmail(email) {
    if (email === 'agewaller@gmail.com') {
      Components.showToast('オーナーアカウントは削除できません', 'error');
      return;
    }

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
      Components.showToast(this.friendlyError(e), 'error');
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
      Components.showToast(this.friendlyError(e), 'error');
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
    this.openModal('デモデータを生成', `
      <p>過去7日分のサンプルデータを全6領域に追加します。既存のデータは削除されません。</p>
      <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-primary" onclick="app.closeModal();app._doGenerateDemoData()">生成する</button>
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
      </div>`);
  }

  _doGenerateDemoData() {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ts = d.toISOString();
      store.addDomainEntry('health', 'symptoms', { condition_level: 5 + (i % 3), fatigue_level: 3 + (i % 4), notes: 'サンプル記録', timestamp: ts });
      store.addDomainEntry('health', 'sleepData', { quality: 6 + (i % 3), sleep_time: '23:00', wake_time: '06:30', timestamp: ts });
      store.addDomainEntry('consciousness', 'entries', { mood_level: 6 + (i % 3), gratitude: 'サンプル感謝', reflection: 'サンプル振り返り', timestamp: ts });
      store.addDomainEntry('time', 'habits', { habit_name: 'ウォーキング', done: i % 2 === 0, timestamp: ts });
      store.addDomainEntry('assets', 'income', { amount: 180000, category: '年金', timestamp: ts });
    }
    Components.showToast('デモデータを生成しました', 'success');
    this.renderApp();
  }

  deleteAllData() {
    this.openModal('データを削除', `
      <p style="color:var(--error)"><strong>警告：</strong>すべてのデータを完全に削除します。この操作は取り消せません。</p>
      <p>本当に削除してよろしいですか？</p>
      <div class="modal-actions" style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-danger" onclick="app.closeModal();app._doDeleteAllData()">すべて削除する</button>
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
      </div>`);
  }

  _doDeleteAllData() {
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
