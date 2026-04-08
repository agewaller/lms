/* ============================================================
   LMS - Page Renderers
   Renders Home, Record, Action, Ask AI, Settings for each domain
   ============================================================ */
var Pages = {

  // ─── Main render dispatcher ───
  render(page, domain) {
    switch (page) {
      case 'home':     return this.renderHome(domain);
      case 'record':   return this.renderRecord(domain);
      case 'actions':  return this.renderActions(domain);
      case 'ask_ai':   return this.renderAskAI(domain);
      case 'settings': return this.renderSettings(domain);
      case 'admin':    return this.renderAdmin();
      default:         return this.renderHome(domain);
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  HOME PAGE (per domain)
  // ═══════════════════════════════════════════════════════════
  renderHome(domain) {
    const domainConfig = CONFIG.domains[domain];
    const score = store.calculateDomainScore(domain);
    const color = domainConfig?.color || '#6C63FF';

    // Quick input bar
    let html = `<div class="page-home">
      <div class="quick-input-bar">
        <input type="text" id="quickInput" class="form-input" placeholder="${i18n.t('quick_input_placeholder')}"
          onkeydown="if(event.key==='Enter')app.quickInput()">
        <button class="btn btn-primary" onclick="app.quickInput()">${i18n.t('send')}</button>
      </div>
      <div id="quickResponse"></div>`;

    // Domain score + overview
    html += `<div class="home-overview">
        <div class="overview-score">
          ${Components.scoreGauge(score, 140, i18n.t(domain))}
        </div>
        <div class="overview-stats">`;

    // Domain-specific stats
    html += this.getDomainStats(domain);
    html += `</div></div>`;

    // All domain scores overview (mini)
    html += `<div class="all-domains-overview">
      <h3>${i18n.t('holistic_analysis')}</h3>
      <div class="domain-scores-grid">
        ${Object.keys(CONFIG.domains).map(d => {
          const s = store.get('domainScores')?.[d] || 0;
          return `<div class="mini-score ${d === domain ? 'current' : ''}" onclick="app.switchDomain('${d}')">
            ${Components.scoreGauge(s, 70, i18n.t(d))}
          </div>`;
        }).join('')}
      </div>
    </div>`;

    // Recent records
    html += `<div class="recent-section">
      <h3>${i18n.t('recent_records')}</h3>
      <div class="records-list">`;

    const categories = Object.keys(domainConfig?.categories || {});
    let allRecent = [];
    categories.forEach(cat => {
      const data = store.getDomainData(domain, cat, 7);
      allRecent = allRecent.concat(data);
    });
    allRecent.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (allRecent.length === 0) {
      html += Components.emptyState(domainConfig?.icon || '📭', i18n.t('no_data'),
        `${i18n.t('record')} → ${i18n.t('save')}`);
    } else {
      allRecent.slice(0, 10).forEach(entry => {
        html += Components.recordItem(entry, domain);
      });
    }

    html += `</div></div>`;

    // AI Recommendations
    const recs = (store.get('recommendations') || []).filter(r => r.domain === domain || !r.domain);
    if (recs.length > 0) {
      html += `<div class="recommendations-section">
        <h3>${i18n.t('your_recommendations')}</h3>
        ${recs.slice(0, 5).map(r => Components.recommendationCard(r)).join('')}
      </div>`;
    }

    // Latest analysis
    const latest = store.get('latestAnalysis');
    if (latest && latest.domain === domain) {
      html += `<div class="analysis-section">
        <h3>${i18n.t('ai_analysis')}</h3>
        <div class="analysis-content">${Components.formatMarkdown(latest.response)}</div>
        <div class="analysis-meta">${latest.model} | ${new Date(latest.timestamp).toLocaleString()}</div>
      </div>`;
    }

    // Domain disclaimers
    if (domain === 'health') {
      html += `<div class="disclaimer">${i18n.t('disclaimer_health')}</div>`;
    } else if (domain === 'assets') {
      html += `<div class="disclaimer">${i18n.t('disclaimer_assets')}</div>`;
    }

    html += `</div>`;
    return html;
  },

  // ─── Domain-specific stat cards ───
  getDomainStats(domain) {
    const stats = [];

    switch (domain) {
      case 'consciousness': {
        const entries = store.getDomainData('consciousness', 'entries', 7);
        const practices = store.getDomainData('consciousness', 'practices', 7);
        const avgMood = entries.length > 0 ?
          (entries.reduce((s, e) => s + (e.mood_level || 0), 0) / entries.length).toFixed(1) : '-';
        stats.push(Components.statCard(i18n.t('journal'), entries.length + i18n.t('items'), null, '📝'));
        stats.push(Components.statCard(i18n.t('practice'), practices.length + i18n.t('items'), null, '🧘'));
        stats.push(Components.statCard(i18n.t('mood'), avgMood + '/10', null, '😊'));
        break;
      }
      case 'health': {
        const symptoms = store.getDomainData('health', 'symptoms', 7);
        const sleep = store.getDomainData('health', 'sleepData', 7);
        const activity = store.getDomainData('health', 'activityData', 7);
        const avgCondition = symptoms.length > 0 ?
          (symptoms.reduce((s, e) => s + (e.condition_level || 0), 0) / symptoms.length).toFixed(1) : '-';
        const avgSleep = sleep.length > 0 ?
          (sleep.reduce((s, e) => s + (e.quality || 0), 0) / sleep.length).toFixed(1) : '-';
        stats.push(Components.statCard(i18n.t('condition_level'), avgCondition + '/10', null, '🤒'));
        stats.push(Components.statCard(i18n.t('sleep_quality'), avgSleep + '/10', null, '😴'));
        stats.push(Components.statCard(i18n.t('activity'), activity.length + i18n.t('items'), null, '🏃'));
        break;
      }
      case 'time': {
        const logs = store.getDomainData('time', 'entries', 7);
        const habits = store.getDomainData('time', 'habits', 7);
        const totalMin = logs.reduce((s, e) => s + (e.duration || 0), 0);
        const avgProd = logs.length > 0 ?
          (logs.reduce((s, e) => s + (e.productivity || 0), 0) / logs.length).toFixed(1) : '-';
        stats.push(Components.statCard(i18n.t('time_log'), Math.round(totalMin / 60) + 'h', null, '⏱️'));
        stats.push(Components.statCard(i18n.t('productivity'), avgProd + '/10', null, '📊'));
        stats.push(Components.statCard(i18n.t('habits'), habits.length + i18n.t('items'), null, '🔄'));
        break;
      }
      case 'contribution': {
        const tasks = store.getDomainData('contribution', 'tasks', 7);
        const done = tasks.filter(t => t.status === 'done').length;
        const projects = store.get('contribution_projects') || [];
        const active = projects.filter(p => p.status === 'active').length;
        stats.push(Components.statCard(i18n.t('tasks'), `${done}/${tasks.length}`, null, '✅'));
        stats.push(Components.statCard(i18n.t('projects'), active + ' ' + i18n.t('active'), null, '📊'));
        stats.push(Components.statCard(i18n.t('skills'), (store.get('contribution_skills') || []).length + i18n.t('items'), null, '📚'));
        break;
      }
      case 'trust': {
        const interactions = store.getDomainData('trust', 'interactions', 7);
        const contacts = store.get('trust_contacts') || [];
        const avgQuality = interactions.length > 0 ?
          (interactions.reduce((s, e) => s + (e.quality || 0), 0) / interactions.length).toFixed(1) : '-';
        stats.push(Components.statCard(i18n.t('contacts'), contacts.length, null, '👤'));
        stats.push(Components.statCard(i18n.t('interactions'), interactions.length + i18n.t('items'), null, '💬'));
        stats.push(Components.statCard(i18n.t('quality'), avgQuality + '/10', null, '⭐'));
        break;
      }
      case 'assets': {
        const portfolio = store.get('assets_portfolio') || [];
        const income = store.getDomainData('assets', 'income', 30);
        const expenses = store.getDomainData('assets', 'expenses', 30);
        const totalIncome = income.reduce((s, e) => s + (e.amount || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        stats.push(Components.statCard(i18n.t('portfolio'), portfolio.length + i18n.t('items'), null, '📈'));
        stats.push(Components.statCard(i18n.t('income'), totalIncome.toLocaleString(), null, '💵'));
        stats.push(Components.statCard(i18n.t('expenses'), totalExpenses.toLocaleString(), null, '🧾'));
        break;
      }
    }

    return stats.join('');
  },

  // ═══════════════════════════════════════════════════════════
  //  RECORD PAGE
  // ═══════════════════════════════════════════════════════════
  renderRecord(domain) {
    const domainConfig = CONFIG.domains[domain];
    const categories = domainConfig?.categories || {};

    let html = `<div class="page-record">
      <h2>${domainConfig?.icon || ''} ${i18n.t(domain)} - ${i18n.t('record')}</h2>

      <!-- Category tabs -->
      <div class="category-tabs">
        ${Object.entries(categories).map(([key, cat], i) => `
          <button class="cat-tab ${i === 0 ? 'active' : ''}"
            onclick="app.showCategory('${key}', this)"
            style="--cat-color:${domainConfig.color}">
            ${cat.icon} ${i18n.t(cat.label)}
          </button>
        `).join('')}
      </div>

      <!-- Diary / free text input -->
      <div class="diary-section">
        <h3>📝 ${i18n.t('content')}</h3>
        <textarea id="diaryText" class="form-input diary-textarea" rows="4"
          placeholder="${i18n.t('quick_input_placeholder')}"></textarea>
        <div class="diary-actions">
          <button class="btn btn-secondary" onclick="app.saveDiary('${domain}')">${i18n.t('save')}</button>
          <button class="btn btn-primary" onclick="app.saveDiaryAndAnalyze('${domain}')">${i18n.t('save_and_analyze')}</button>
        </div>
      </div>

      <!-- Category-specific data entry forms -->
      <div class="category-forms">
        ${Object.entries(categories).map(([key, cat], i) => `
          <div class="category-form ${i === 0 ? 'active' : ''}" data-category="${key}">
            <h3>${cat.icon} ${i18n.t(cat.label)}</h3>
            ${Components.dataEntryForm(domain, key)}
          </div>
        `).join('')}
      </div>

      <!-- File upload -->
      <div class="file-upload-section">
        <h3>📎 ${i18n.t('file_upload')}</h3>
        <input type="file" id="fileUpload" accept="image/*,.csv,.json,.xml,.pdf" onchange="app.handleFileUpload(event, '${domain}')">
      </div>

      <!-- Recent entries for this domain -->
      <div class="recent-entries">
        <h3>${i18n.t('recent_records')}</h3>
        <div id="recentEntries">`;

    let allRecent = [];
    Object.keys(categories).forEach(cat => {
      allRecent = allRecent.concat(store.getDomainData(domain, cat, 30));
    });
    allRecent.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (allRecent.length === 0) {
      html += Components.emptyState(domainConfig?.icon, i18n.t('no_data'));
    } else {
      allRecent.slice(0, 20).forEach(entry => {
        html += Components.recordItem(entry, domain);
      });
    }

    html += `</div></div></div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  ACTIONS PAGE
  // ═══════════════════════════════════════════════════════════
  renderActions(domain) {
    const domainConfig = CONFIG.domains[domain];
    const recs = (store.get('recommendations') || []).filter(r => r.domain === domain || !r.domain);
    const actions = (store.get('actionItems') || []).filter(a => a.domain === domain || !a.domain);

    let html = `<div class="page-actions">
      <h2>⚡ ${i18n.t(domain)} - ${i18n.t('actions')}</h2>

      <!-- Generate AI recommendations -->
      <div class="action-generate">
        <button class="btn btn-primary btn-lg" onclick="app.generateRecommendations('${domain}')">
          🤖 ${i18n.t('ai_analysis')} - ${i18n.t(domain)}
        </button>
        <button class="btn btn-secondary btn-lg" onclick="app.generateRecommendations('holistic')">
          🌐 ${i18n.t('holistic_analysis')}
        </button>
      </div>`;

    // Loading state
    if (store.get('isAnalyzing')) {
      html += Components.loading(i18n.t('analyzing'));
    }

    // Active recommendations
    if (recs.length > 0) {
      html += `<div class="recommendations-list">
        <h3>${i18n.t('your_recommendations')}</h3>
        ${recs.map(r => Components.recommendationCard(r)).join('')}
      </div>`;
    } else {
      html += Components.emptyState('⚡', i18n.t('no_data'),
        `${i18n.t('ai_analysis')}ボタンを押して推奨を生成してください`);
    }

    // Action items (todos)
    if (actions.length > 0) {
      html += `<div class="action-items">
        <h3>📋 Action Items</h3>
        ${actions.map((a, i) => `
          <div class="action-item ${a.done ? 'done' : ''}">
            <label><input type="checkbox" ${a.done ? 'checked' : ''} onchange="app.toggleAction(${i})"> ${a.text}</label>
            <span class="action-domain" style="background:${CONFIG.domains[a.domain]?.color || '#666'}">${CONFIG.domains[a.domain]?.icon || ''}</span>
          </div>
        `).join('')}
      </div>`;
    }

    // Disclaimers
    if (domain === 'health') {
      html += `<div class="disclaimer">${i18n.t('disclaimer_health')}</div>`;
    } else if (domain === 'assets') {
      html += `<div class="disclaimer">${i18n.t('disclaimer_assets')}</div>`;
    }

    html += `</div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  ASK AI (Chat) PAGE
  // ═══════════════════════════════════════════════════════════
  renderAskAI(domain) {
    const history = (store.get('conversationHistory') || [])
      .filter(m => m.domain === domain || !m.domain)
      .slice(-50);

    let html = `<div class="page-ask-ai">
      <h2>🤖 ${i18n.t('ask_ai')} - ${i18n.t(domain)}</h2>

      <div class="chat-container" id="chatContainer">
        ${history.length === 0 ?
          Components.emptyState('🤖', i18n.t('ask_ai'), i18n.t('quick_input_placeholder')) :
          history.map(m => Components.chatMessage(m)).join('')
        }
      </div>

      <div class="chat-input-bar">
        <textarea id="chatInput" class="form-input" rows="2"
          placeholder="${i18n.t('quick_input_placeholder')}"
          onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();app.sendChat('${domain}')}"></textarea>
        <button class="btn btn-primary" onclick="app.sendChat('${domain}')">${i18n.t('send')}</button>
      </div>

      ${store.get('isAnalyzing') ? Components.loading(i18n.t('analyzing')) : ''}
    </div>`;

    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  SETTINGS PAGE
  // ═══════════════════════════════════════════════════════════
  renderSettings(domain) {
    const profile = store.get('userProfile') || {};
    const user = store.get('user') || {};

    let html = `<div class="page-settings">
      <h2>⚙️ ${i18n.t('settings')}</h2>

      <!-- Profile -->
      <div class="settings-section">
        <h3>👤 ${i18n.t('profile')}</h3>
        <div class="form-group">
          <label>${i18n.t('age')}</label>
          <input type="number" id="profileAge" class="form-input" value="${profile.age || ''}">
        </div>
        <div class="form-group">
          <label>${i18n.t('gender')}</label>
          <select id="profileGender" class="form-input">
            <option value="">${i18n.t('other')}</option>
            <option value="male" ${profile.gender === 'male' ? 'selected' : ''}>${i18n.t('male')}</option>
            <option value="female" ${profile.gender === 'female' ? 'selected' : ''}>${i18n.t('female')}</option>
            <option value="other" ${profile.gender === 'other' ? 'selected' : ''}>${i18n.t('other')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${i18n.t('location')}</label>
          <input type="text" id="profileLocation" class="form-input" value="${profile.location || ''}">
        </div>
        <div class="form-group">
          <label>${i18n.t('language')}</label>
          <select id="profileLang" class="form-input" onchange="app.changeLanguage(this.value)">
            <option value="ja" ${i18n.currentLang === 'ja' ? 'selected' : ''}>日本語</option>
            <option value="en" ${i18n.currentLang === 'en' ? 'selected' : ''}>English</option>
            <option value="zh" ${i18n.currentLang === 'zh' ? 'selected' : ''}>中文</option>
            <option value="ko" ${i18n.currentLang === 'ko' ? 'selected' : ''}>한국어</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="app.saveProfile()">${i18n.t('save_profile')}</button>
      </div>

      <!-- Subscription -->
      <div class="settings-section">
        <h3>💳 ${i18n.t('subscription')}</h3>
        ${PayPalManager.renderStatus()}
      </div>

      <!-- AI Model Selection -->
      <div class="settings-section">
        <h3>🤖 AI Model</h3>
        <select id="aiModel" class="form-input" onchange="store.set('selectedModel', this.value)">
          ${Object.entries(CONFIG.aiModels).map(([id, m]) => `
            <option value="${id}" ${store.get('selectedModel') === id ? 'selected' : ''}>${m.name}</option>
          `).join('')}
        </select>
      </div>

      <!-- API Keys -->
      <div class="settings-section">
        <h3>🔑 API Keys</h3>
        <div class="form-group">
          <label>Anthropic (Claude)</label>
          <input type="password" id="apiKeyAnthropic" class="form-input"
            value="${AIEngine.getApiKey('anthropic') ? '••••••••' : ''}"
            placeholder="sk-ant-...">
        </div>
        <div class="form-group">
          <label>OpenAI (GPT)</label>
          <input type="password" id="apiKeyOpenAI" class="form-input"
            value="${AIEngine.getApiKey('openai') ? '••••••••' : ''}"
            placeholder="sk-...">
        </div>
        <div class="form-group">
          <label>Google (Gemini)</label>
          <input type="password" id="apiKeyGoogle" class="form-input"
            value="${AIEngine.getApiKey('google') ? '••••••••' : ''}"
            placeholder="AI...">
        </div>
        <button class="btn btn-primary" onclick="app.saveApiKeys()">${i18n.t('save')}</button>
      </div>

      <!-- Data Export/Import -->
      <div class="settings-section">
        <h3>💾 ${i18n.t('data_export')} / ${i18n.t('data_import')}</h3>
        <button class="btn btn-secondary" onclick="app.exportData()">${i18n.t('data_export')}</button>
        <input type="file" id="importFile" accept=".json" onchange="app.importData(event)" style="display:none">
        <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">${i18n.t('data_import')}</button>
      </div>

      <!-- Logout -->
      <div class="settings-section">
        <button class="btn btn-danger" onclick="app.logout()">🚪 ${i18n.t('logout')}</button>
      </div>
    </div>`;

    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  ADMIN PAGE
  // ═══════════════════════════════════════════════════════════
  renderAdmin() {
    if (!FirebaseBackend.isAdmin()) {
      return '<div class="page-admin"><h2>Access Denied</h2></div>';
    }

    let html = `<div class="page-admin">
      <h2>🔧 ${i18n.t('admin')}</h2>

      <!-- Custom Prompts Editor -->
      <div class="settings-section">
        <h3>📝 AI Prompt Editor</h3>
        <div class="form-group">
          <label>Domain</label>
          <select id="adminPromptDomain" class="form-input" onchange="app.loadAdminPrompt()">
            ${Object.keys(CONFIG.domains).map(d => `<option value="${d}">${i18n.t(d)}</option>`).join('')}
            <option value="holistic">${i18n.t('holistic_analysis')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Prompt Type</label>
          <select id="adminPromptType" class="form-input" onchange="app.loadAdminPrompt()">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <textarea id="adminPromptText" class="form-input" rows="12" placeholder="Enter custom prompt..."></textarea>
        <button class="btn btn-primary" onclick="app.saveAdminPrompt()">${i18n.t('save')}</button>
      </div>

      <!-- Affiliate Settings -->
      <div class="settings-section">
        <h3>🏷️ Affiliate Settings</h3>
        ${Object.entries(CONFIG.affiliate).map(([store_name, config]) => `
          <div class="form-group">
            <label>${store_name}</label>
            <input type="text" class="form-input" id="aff_${store_name}"
              value="${config.tag || config.id || config.code || ''}"
              placeholder="Affiliate ID/Tag">
          </div>
        `).join('')}
        <button class="btn btn-primary" onclick="app.saveAffiliateConfig()">${i18n.t('save')}</button>
      </div>

      <!-- Firebase Config -->
      <div class="settings-section">
        <h3>🔥 Firebase Config</h3>
        <div class="form-group">
          <label>API Key</label>
          <input type="text" id="fbApiKey" class="form-input" value="${CONFIG.firebase.apiKey}">
        </div>
        <div class="form-group">
          <label>Auth Domain</label>
          <input type="text" id="fbAuthDomain" class="form-input" value="${CONFIG.firebase.authDomain}">
        </div>
        <div class="form-group">
          <label>Project ID</label>
          <input type="text" id="fbProjectId" class="form-input" value="${CONFIG.firebase.projectId}">
        </div>
        <button class="btn btn-primary" onclick="app.saveFirebaseConfig()">${i18n.t('save')}</button>
      </div>

      <!-- Worker URL -->
      <div class="settings-section">
        <h3>☁️ API Proxy URL</h3>
        <input type="text" id="workerUrl" class="form-input" value="${CONFIG.endpoints.anthropic}">
        <button class="btn btn-primary" onclick="app.saveWorkerUrl()">${i18n.t('save')}</button>
      </div>
    </div>`;

    return html;
  }
};
