/* ============================================================
   LMS - Page Renderers
   Renders Home, Record, Action, Ask AI, Settings for each domain
   ============================================================ */
var Pages = {

  // ─── Main render dispatcher ───
  render(page, domain) {
    switch (page) {
      case 'home':         return this.renderHome(domain);
      case 'data':         return this.renderDataBrowser(domain);
      case 'integrations': return this.renderIntegrations(domain);
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

    // Recommendations
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
        <h3>分析結果</h3>
        <div class="analysis-content">${Components.formatMarkdown(latest.response)}</div>
        <div class="analysis-meta">${latest.model} | ${new Date(latest.timestamp).toLocaleString()}</div>
      </div>`;
    }

    // ─── Domain-specific widgets ───

    // Consciousness domain: 7-layer visualization + transcript input
    if (domain === 'consciousness') {
      html += this.renderConsciousnessLayers();
      html += this.renderTranscriptInput();
    }

    // Time domain: Calendar widget + Marketplace widget
    if (domain === 'time') {
      if (typeof CalendarIntegration !== 'undefined') html += CalendarIntegration.renderWidget();
      if (typeof TimeMarketplace !== 'undefined') html += TimeMarketplace.renderWidget();
    }

    // Work domain: Resume + side biz diagnosis + time marketplace link
    if (domain === 'work') {
      if (typeof WorkFeatures !== 'undefined') {
        html += WorkFeatures.renderSideBizDiagnosis();
        html += WorkFeatures.renderTimeSellingBanner();
      }
      html += this.renderResumeWidget();
    }

    // Relationship domain: Isolation score + today contacts + social graph + birthdays
    if (domain === 'relationship') {
      if (typeof RelationshipFeatures !== 'undefined') html += RelationshipFeatures.renderDashboard();
      html += this.renderSocialGraph();
      html += this.renderUpcomingBirthdays();
    }

    // Assets domain: NISA simulator + AI advisor + screenshot + auto trading + stock analysis
    if (domain === 'assets') {
      if (typeof AssetsFeatures !== 'undefined') {
        html += AssetsFeatures.renderNISASimulator();
        html += AssetsFeatures.renderAIAdvisor();
        html += AssetsFeatures.renderScreenshotReader();
        html += AssetsFeatures.renderAutoTrading();
      }
      html += this.renderStockAnalysisWidget();
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

  // ─── Consciousness 7-Layer Visualization ───
  renderConsciousnessLayers() {
    const observations = store.getDomainData('consciousness', 'observation', 7);
    const layers = CONFIG.domains.consciousness.layers;
    const layerKeys = ['1', '2', '3', '3.5', '4', '5', '6', '7'];

    // Get latest observation or defaults
    const latest = observations.length > 0 ? observations[observations.length - 1] : null;

    let html = `<div class="consciousness-layers-section">
      <h3>七つの意識レイヤー</h3>
      <p>今日、あなたの意識はどのレイヤーに多く向いていましたか？</p>
      <div class="layers-chart">`;

    layerKeys.forEach(key => {
      const storeKey = key === '3.5' ? 'layer_35' : 'layer_' + key;
      const pct = latest ? (latest[storeKey] || 0) : 0;
      const layer = layers[key];
      html += `<div class="layer-bar">
        <div class="layer-label">
          <span class="layer-num" style="background:${layer.color}">${key}</span>
          <span class="layer-name">${layer.name}</span>
        </div>
        <div class="layer-track">
          <div class="layer-fill" style="width:${pct}%;background:${layer.color}"></div>
        </div>
        <span class="layer-pct">${pct > 0 ? pct + '%' : '—'}</span>
      </div>`;
    });

    html += `</div>`;

    // Net value (純価値)
    if (latest) {
      const nv = latest.net_value || 0;
      const nvColor = nv >= 70 ? '#27AE60' : nv >= 40 ? '#F39C12' : '#E74C3C';
      html += `<div class="net-value-display">
        <div class="nv-label">純価値（エネルギー＋徳−欲）</div>
        <div class="nv-score" style="color:${nvColor}">${nv}/100</div>
        <div class="nv-details">
          欲: ${latest.desire_count || 0}回
          徳: ${latest.virtue_count || 0}回
          エネルギー: ${latest.energy_count || 0}回
        </div>
      </div>`;
    }

    // Layer descriptions (collapsible)
    html += `<details class="layer-legend">
      <summary>レイヤーの説明</summary>
      <div class="legend-list">
        ${layerKeys.map(key => {
          const l = layers[key];
          return `<div class="legend-item">
            <span class="layer-num" style="background:${l.color}">${key}</span>
            <strong>${l.name}</strong> — ${l.description}
          </div>`;
        }).join('')}
      </div>
    </details>`;

    html += `</div>`;
    return html;
  },

  // ─── Transcript Input (Plaud / Voice) ───
  renderTranscriptInput() {
    return `<div class="transcript-section">
      <h3>🎙️ 文字起こしの分析</h3>
      <p>Plaudや音声メモの文字起こしを貼り付けると、七つのレイヤーで分析します。</p>
      <div class="form-group">
        <label>文字起こしの入力元</label>
        <select id="transcriptSource" class="form-input">
          <option value="plaud">Plaud</option>
          <option value="voice_memo">ボイスメモ</option>
          <option value="manual">手入力</option>
          <option value="other">その他</option>
        </select>
      </div>
      <div class="form-group">
        <label>文字起こし内容</label>
        <textarea id="transcriptText" class="form-input" rows="8"
          placeholder="ここに文字起こしの全文を貼り付けてください..."></textarea>
      </div>
      <div class="form-group">
        <input type="file" id="transcriptFile" accept=".txt,.json,.csv" style="display:none"
          onchange="app.loadTranscriptFile(event)">
        <button class="btn btn-secondary" onclick="document.getElementById('transcriptFile').click()">
          📄 ファイルから読み込む
        </button>
      </div>
      <button class="btn btn-primary btn-lg" onclick="app.analyzeTranscript()">
        🧠 意識レイヤー分析を実行
      </button>
      <div id="transcriptResult"></div>
    </div>`;
  },

  // ─── Social Graph (Relationship domain) ───
  renderSocialGraph() {
    const contacts = store.get('relationship_contacts') || [];
    if (contacts.length === 0) {
      return `<div class="social-graph-section">
        <h3>つながりの地図</h3>
        ${Components.emptyState('🤝', 'まだ連絡先がありません', '「記録する」から連絡先を追加、または取り込んでください')}
      </div>`;
    }

    const levels = CONFIG.domains.relationship.distanceLevels;
    const grouped = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    contacts.forEach(c => {
      const d = parseInt(c.distance) || 4;
      if (grouped[d]) grouped[d].push(c);
    });

    let html = `<div class="social-graph-section">
      <h3>つながりの地図（${contacts.length}人）</h3>
      <div class="social-graph">
        <div class="graph-center">あなた</div>`;

    // Concentric rings
    [1, 2, 3, 4, 5].forEach(level => {
      const people = grouped[level] || [];
      if (people.length === 0) return;
      html += `<div class="graph-ring ring-${level}" style="--ring-color: ${levels[level].color}">
        <div class="ring-label">${levels[level].description}（${people.length}人）</div>
        <div class="ring-people">
          ${people.slice(0, 8).map(p => `<span class="ring-person" title="${p.name}">${(p.name || '').substring(0, 3)}</span>`).join('')}
          ${people.length > 8 ? `<span class="ring-more">+${people.length - 8}</span>` : ''}
        </div>
      </div>`;
    });

    html += `</div></div>`;
    return html;
  },

  // ─── Upcoming Birthdays (Relationship domain) ───
  renderUpcomingBirthdays() {
    const contacts = store.get('relationship_contacts') || [];
    const today = new Date();
    const upcoming = contacts
      .filter(c => c.birthday)
      .map(c => {
        const bd = new Date(c.birthday);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(next.getFullYear() + 1);
        const daysUntil = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        return { ...c, daysUntil, nextBirthday: next };
      })
      .filter(c => c.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (upcoming.length === 0) return '';

    let html = `<div class="birthdays-section">
      <h3>🎂 ${i18n.t('upcoming_birthdays')}</h3>
      <div class="birthday-list">`;

    upcoming.forEach(c => {
      const dateStr = c.nextBirthday.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
      const label = c.daysUntil === 0 ? '今日！' : `あと${c.daysUntil}日`;
      html += `<div class="birthday-item ${c.daysUntil <= 3 ? 'birthday-soon' : ''}">
        <span class="birthday-name">${c.name}</span>
        <span class="birthday-date">${dateStr}（${label}）</span>
        <span class="birthday-distance">${CONFIG.domains.relationship.distanceLevels[c.distance]?.description || ''}</span>
      </div>`;
    });

    html += `</div></div>`;
    return html;
  },

  // ─── Stock Analysis Widget (Assets domain) ───
  renderStockAnalysisWidget() {
    return `<div class="stock-analysis-section">
      <h3>📈 ${i18n.t('stock_investment')}</h3>
      <p>銘柄名またはティッカーを入力すると、詳しい分析をご覧いただけます。</p>
      <div class="stock-input-bar">
        <input type="text" id="stockTicker" class="form-input" placeholder="例：トヨタ、7203、AAPL">
        <button class="btn btn-primary" onclick="app.analyzeStock()">
          ${i18n.t('analyze_stock')}
        </button>
      </div>
      <div id="stockResult"></div>
    </div>`;
  },

  // ─── Resume Widget (Contribution domain) ───
  renderResumeWidget() {
    const resume = store.get('userResume') || {};
    const hasResume = resume.name || resume.summary;

    if (!hasResume) {
      return `<div class="resume-widget">
        <h3>📄 レジュメ・職務経歴</h3>
        <p>あなたの経験やスキルを登録しておくと、求人プラットフォームへワンクリックで送信できます。</p>
        <button class="btn btn-secondary" onclick="app.navigate('settings')">レジュメを登録する</button>
      </div>`;
    }

    return `<div class="resume-widget">
      <h3>📄 レジュメ</h3>
      <div class="resume-summary">
        <p><strong>${resume.name || ''}</strong></p>
        <p>${resume.summary || ''}</p>
        <p>スキル: ${(resume.skills || []).join(', ')}</p>
      </div>
      <div class="resume-actions">
        <button class="btn btn-sm btn-secondary" onclick="app.navigate('settings')">編集</button>
        <button class="btn btn-sm btn-primary" onclick="app.sendResumeToPortals()">求人サイトに送信</button>
      </div>
      ${typeof TimeMarketplace !== 'undefined' ? `
      <div class="time-sell-link" style="margin-top:16px;">
        <h4>⏰ 空き時間を販売する</h4>
        <p>あなたのスキルを空き時間で提供できます。</p>
        <button class="btn btn-sm btn-secondary" onclick="app.switchDomain('time');app.navigate('settings')">時間販売の設定へ</button>
      </div>` : ''}
    </div>`;
  },

  // ─── Domain-specific stat cards ───
  getDomainStats(domain) {
    const stats = [];

    switch (domain) {
      case 'consciousness': {
        const obs = store.getDomainData('consciousness', 'observation', 7);
        const entries = store.getDomainData('consciousness', 'entries', 7);
        const transcripts = store.getDomainData('consciousness', 'transcript', 7);
        const latestObs = obs.length > 0 ? obs[obs.length - 1] : null;
        const nv = latestObs?.net_value || '-';
        stats.push(Components.statCard('純価値', nv + (nv !== '-' ? '/100' : ''), null, '✨'));
        stats.push(Components.statCard('定点観測', obs.length + i18n.t('items'), null, '👁️'));
        stats.push(Components.statCard('文字起こし', transcripts.length + i18n.t('items'), null, '🎙️'));
        stats.push(Components.statCard(i18n.t('journal'), entries.length + i18n.t('items'), null, '📝'));
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
      case 'work': {
        const tasks = store.getDomainData('work', 'tasks', 7);
        const done = tasks.filter(t => t.status === 'done').length;
        const projects = store.get('work_projects') || [];
        const active = projects.filter(p => p.status === 'active').length;
        stats.push(Components.statCard(i18n.t('tasks'), `${done}/${tasks.length}`, null, '✅'));
        stats.push(Components.statCard(i18n.t('projects'), active + ' ' + i18n.t('active'), null, '📊'));
        stats.push(Components.statCard(i18n.t('skills'), (store.get('work_skills') || []).length + i18n.t('items'), null, '📚'));
        break;
      }
      case 'relationship': {
        const interactions = store.getDomainData('relationship', 'interactions', 7);
        const contacts = store.get('relationship_contacts') || [];
        const gifts = store.getDomainData('relationship', 'gifts', 30);
        const close = contacts.filter(c => parseInt(c.distance) <= 2).length;
        stats.push(Components.statCard(i18n.t('contacts'), contacts.length + '人', null, '👤'));
        stats.push(Components.statCard('親しい方', close + '人', null, '💕'));
        stats.push(Components.statCard(i18n.t('interactions'), interactions.length + i18n.t('items'), null, '💬'));
        stats.push(Components.statCard(i18n.t('gifts'), gifts.length + i18n.t('items'), null, '🎁'));
        break;
      }
      case 'assets': {
        const stocks = store.get('assets_stocks') || [];
        const portfolio = store.get('assets_portfolio') || [];
        const income = store.getDomainData('assets', 'income', 30);
        const expenses = store.getDomainData('assets', 'expenses', 30);
        const totalIncome = income.reduce((s, e) => s + (e.amount || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        stats.push(Components.statCard(i18n.t('stock_investment'), stocks.length + '銘柄', null, '📈'));
        stats.push(Components.statCard(i18n.t('portfolio'), portfolio.length + i18n.t('items'), null, '📊'));
        stats.push(Components.statCard(i18n.t('income'), totalIncome.toLocaleString() + '円', null, '💵'));
        stats.push(Components.statCard(i18n.t('expenses'), totalExpenses.toLocaleString() + '円', null, '🧾'));
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

      <!-- Relationship domain: Contact import -->
      ${domain === 'relationship' ? `
      <div class="contact-import-section">
        <h3>📥 ${i18n.t('import_contacts')}</h3>
        <p>電話帳やCSVファイル、名刺データなどから連絡先をまとめて取り込めます。</p>
        <div class="import-buttons">
          <input type="file" id="contactImport" accept=".csv,.vcf,.json,.xlsx" style="display:none" onchange="app.importContacts(event)">
          <button class="btn btn-secondary" onclick="document.getElementById('contactImport').click()">
            📄 CSV / vCard / Excelから取り込む
          </button>
          <button class="btn btn-secondary" onclick="app.enrichContacts()">
            🔍 ${i18n.t('enrich_contact')}
          </button>
        </div>
      </div>` : ''}

      <!-- File upload (photos, documents, screenshots) -->
      <div class="file-upload-section">
        <h3>📎 ${i18n.t('file_upload')}（写真・書類など）</h3>
        <p>写真や画面キャプチャ、PDFなどをアップロードできます。</p>
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
      <h2>${i18n.t(domain)} - ${i18n.t('actions')}</h2>

      <!-- Generate recommendations -->
      <div class="action-generate">
        <button class="btn btn-primary btn-lg" onclick="app.generateRecommendations('${domain}')">
          ${i18n.t(domain)}の分析を実行
        </button>
        <button class="btn btn-secondary btn-lg" onclick="app.generateRecommendations('holistic')">
          6領域の総合分析
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
        '上の「分析を実行」ボタンを押してみてください');
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
  //  CHAT PAGE (相談する)
  // ═══════════════════════════════════════════════════════════
  renderAskAI(domain) {
    const history = (store.get('conversationHistory') || [])
      .filter(m => m.domain === domain || !m.domain)
      .slice(-50);

    let html = `<div class="page-ask-ai">
      <h2>${i18n.t(domain)} - 相談する</h2>

      <div class="chat-container" id="chatContainer">
        ${history.length === 0 ?
          Components.emptyState('💬', '相談する', i18n.t('quick_input_placeholder')) :
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

      <!-- Data Export/Import -->
      <div class="settings-section">
        <h3>💾 ${i18n.t('data_export')} / ${i18n.t('data_import')}</h3>
        <button class="btn btn-secondary" onclick="app.exportData()">${i18n.t('data_export')}</button>
        <input type="file" id="importFile" accept=".json" onchange="app.importData(event)" style="display:none">
        <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">${i18n.t('data_import')}</button>
      </div>

      <!-- Time Marketplace Settings (Time domain) -->
      ${domain === 'time' && typeof TimeMarketplace !== 'undefined' ? TimeMarketplace.renderSettings() : ''}

      <!-- Resume Settings (Work domain) -->
      ${domain === 'work' ? this.renderResumeSettings() : ''}

      <!-- Calendar Import (Time domain) -->
      ${domain === 'time' ? `
      <div class="settings-section">
        <h3>📅 カレンダー連携</h3>
        <p>ICSファイル（Googleカレンダー/Outlook等からエクスポート）を取り込めます。</p>
        <input type="file" id="calImport" accept=".ics" style="display:none" onchange="app.importCalendarFile(event)">
        <button class="btn btn-secondary" onclick="document.getElementById('calImport').click()">カレンダーファイルを取り込む</button>
      </div>` : ''}

      <!-- Logout -->
      <div class="settings-section">
        <button class="btn btn-danger" onclick="app.logout()">🚪 ${i18n.t('logout')}</button>
      </div>
    </div>`;

    return html;
  },

  // ─── Resume Settings (Contribution domain) ───
  renderResumeSettings() {
    const r = store.get('userResume') || {};
    return `<div class="settings-section">
      <h3>📄 レジュメ・職務経歴</h3>
      <p>ここに登録した内容を求人プラットフォームにワンクリックで送信できます。</p>
      <div class="form-group">
        <label>お名前</label>
        <input type="text" id="resumeName" class="form-input" value="${r.name || ''}" placeholder="山田花子">
      </div>
      <div class="form-group">
        <label>職務要約・自己PR</label>
        <textarea id="resumeSummary" class="form-input" rows="4" placeholder="これまでのご経験や強みを自由にお書きください">${r.summary || ''}</textarea>
      </div>
      <div class="form-group">
        <label>スキル・資格（カンマ区切り）</label>
        <input type="text" id="resumeSkills" class="form-input" value="${(r.skills || []).join(', ')}" placeholder="例：看護師免許, 英検2級, Excel">
      </div>
      <div class="form-group">
        <label>職務経歴</label>
        <textarea id="resumeHistory" class="form-input" rows="4" placeholder="会社名、期間、役職、内容をお書きください">${r.history || ''}</textarea>
      </div>
      <div class="form-group">
        <label>希望する働き方</label>
        <select id="resumeWorkStyle" class="form-input">
          <option value="" ${!r.workStyle ? 'selected' : ''}>選択してください</option>
          <option value="fulltime" ${r.workStyle === 'fulltime' ? 'selected' : ''}>フルタイム</option>
          <option value="parttime" ${r.workStyle === 'parttime' ? 'selected' : ''}>パートタイム</option>
          <option value="freelance" ${r.workStyle === 'freelance' ? 'selected' : ''}>フリーランス・業務委託</option>
          <option value="volunteer" ${r.workStyle === 'volunteer' ? 'selected' : ''}>ボランティア</option>
          <option value="timesell" ${r.workStyle === 'timesell' ? 'selected' : ''}>空き時間だけ</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="app.saveResume()">${i18n.t('save')}</button>
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════
  //  DATA BROWSER (全領域のデータを整理・閲覧)
  // ═══════════════════════════════════════════════════════════
  renderDataBrowser(domain) {
    const filter = store.get('dataBrowserFilter') || { category: '', search: '', sort: 'desc' };
    const domainConfig = CONFIG.domains[domain];
    const categories = domainConfig?.categories || {};

    // Gather all entries across all categories
    let allEntries = [];
    Object.keys(categories).forEach(cat => {
      const data = store.getDomainData(domain, cat, 365 * 10); // all entries
      data.forEach(entry => allEntries.push({ ...entry, _category: cat }));
    });

    // Filter
    if (filter.category) {
      allEntries = allEntries.filter(e => e._category === filter.category);
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      allEntries = allEntries.filter(e =>
        JSON.stringify(e).toLowerCase().includes(s)
      );
    }

    // Sort
    allEntries.sort((a, b) => {
      const diff = new Date(b.timestamp) - new Date(a.timestamp);
      return filter.sort === 'asc' ? -diff : diff;
    });

    // Count by category
    const catCounts = {};
    Object.keys(categories).forEach(cat => {
      catCounts[cat] = store.getDomainData(domain, cat, 365 * 10).length;
    });
    const totalCount = Object.values(catCounts).reduce((a, b) => a + b, 0);

    let html = `<div class="page-data-browser">
      <div class="data-browser-header">
        <h2>${i18n.t(domain)} のデータ</h2>
        <p class="page-desc">これまで記録したすべてのデータを整理して見られます。</p>
      </div>

      <!-- Summary -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-body">
          <div class="data-summary">
            <div class="data-summary-total">
              <div class="data-total-num">${totalCount}</div>
              <div class="data-total-label">記録数</div>
            </div>
            <div class="data-summary-categories">
              ${Object.entries(catCounts).map(([cat, count]) => `
                <div class="data-cat-item ${filter.category === cat ? 'active' : ''}"
                     onclick="app.filterDataBrowser('category','${cat}')">
                  <div class="data-cat-count">${count}</div>
                  <div class="data-cat-label">${i18n.t(categories[cat].label)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-body">
          <div class="data-filters">
            <div class="form-group" style="flex:2;">
              <label>検索</label>
              <input type="text" id="dataSearch" class="form-input"
                value="${filter.search}"
                placeholder="記録の中身を検索..."
                oninput="app.filterDataBrowser('search',this.value)">
            </div>
            <div class="form-group" style="flex:1;">
              <label>カテゴリ</label>
              <select id="dataCategoryFilter" class="form-input" onchange="app.filterDataBrowser('category',this.value)">
                <option value="">すべて</option>
                ${Object.entries(categories).map(([key, cat]) => `
                  <option value="${key}" ${filter.category === key ? 'selected' : ''}>${i18n.t(cat.label)}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group" style="flex:1;">
              <label>並び順</label>
              <select id="dataSort" class="form-input" onchange="app.filterDataBrowser('sort',this.value)">
                <option value="desc" ${filter.sort === 'desc' ? 'selected' : ''}>新しい順</option>
                <option value="asc" ${filter.sort === 'asc' ? 'selected' : ''}>古い順</option>
              </select>
            </div>
          </div>
          <div class="data-actions">
            <button class="btn btn-sm btn-secondary" onclick="app.exportDomainData('${domain}')">このデータを書き出す</button>
            <button class="btn btn-sm btn-secondary" onclick="app.clearDataFilter()">フィルタをクリア</button>
          </div>
        </div>
      </div>

      <!-- Records grouped by date -->
      <div class="data-records">`;

    if (allEntries.length === 0) {
      html += `<div class="card"><div class="card-body">${Components.emptyState('', 'データがありません', 'まず「記録する」から入力してください')}</div></div>`;
    } else {
      // Group by date
      const groups = {};
      allEntries.forEach(entry => {
        const date = (entry.timestamp || '').slice(0, 10);
        if (!groups[date]) groups[date] = [];
        groups[date].push(entry);
      });

      Object.entries(groups).forEach(([date, entries]) => {
        const d = new Date(date);
        const dateStr = isNaN(d) ? date : d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

        html += `<div class="data-date-group">
          <div class="data-date-header">
            <span class="data-date-label">${dateStr}</span>
            <span class="data-date-count">${entries.length}件</span>
          </div>
          <div class="data-entries-list">`;

        entries.forEach(entry => {
          const catLabel = entry._category ? i18n.t(categories[entry._category]?.label || entry._category) : '';
          const fields = Object.entries(entry)
            .filter(([k, v]) => !k.startsWith('_') && k !== 'timestamp' && k !== 'id' && k !== 'domain' && k !== 'category' && v !== null && v !== undefined && v !== '')
            .slice(0, 6);

          html += `<div class="data-entry-card">
            <div class="data-entry-header">
              <span class="data-entry-cat">${catLabel}</span>
              <span class="data-entry-time">${new Date(entry.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
              <div class="data-entry-actions">
                <button class="btn-icon-sm" onclick="app.editDataEntry('${domain}','${entry._category}','${entry.id}')" title="編集">編集</button>
                <button class="btn-icon-sm" onclick="app.deleteDataEntry('${domain}','${entry._category}','${entry.id}')" title="削除">削除</button>
              </div>
            </div>
            <div class="data-entry-fields">
              ${fields.map(([k, v]) => {
                const label = i18n.t(k) || k;
                const val = typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 100);
                return `<div class="data-field"><span class="data-field-key">${label}</span><span class="data-field-val">${val}</span></div>`;
              }).join('')}
            </div>
          </div>`;
        });

        html += `</div></div>`;
      });
    }

    html += `</div></div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  INTEGRATIONS PAGE (未病ダイアリー方式)
  // ═══════════════════════════════════════════════════════════
  renderIntegrations(domain) {
    const ingestEmail = typeof generateUserEmail === 'function' ? generateUserEmail() : null;
    const calendarCount = (store.get('calendarEvents') || []).length;
    const fitbitConnected = typeof fitbit !== 'undefined' && fitbit.isConnected();
    const gcalConnected = typeof googleCalendar !== 'undefined' && googleCalendar.isConnected();

    let html = `<div class="page-integrations">
      <h2>連携・データ取り込み</h2>
      <p class="page-desc">外部のアプリやファイルからデータを取り込めます。</p>

      <!-- Plaud (自動フロー + 手動貼り付け) -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Plaud（文字起こし）</h3>
          <span class="status-badge connected">自動取込対応</span>
        </div>
        <div class="card-body">
          <p>Plaudで録音した音声の文字起こしを取り込むと、七つの意識レイヤーで分析されます。</p>

          <!-- 自動フロー（推奨） -->
          <div class="integration-auto-flow">
            <h4>自動で取り込む（おすすめ）</h4>
            <p>Plaudの自動送信機能を使うと、録音するたびに文字起こしがあなた専用のメールアドレスに送られ、自動で取り込まれます。</p>

            ${ingestEmail ? `
            <div class="auto-flow-email">
              <label>あなた専用の受信アドレス</label>
              <div class="ingest-email-box">
                <code class="ingest-email">${ingestEmail}</code>
                <button class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText('${ingestEmail}');Components.showToast('コピーしました','success')">コピー</button>
              </div>
            </div>

            <div class="integration-steps">
              <h4>設定手順</h4>
              <ol>
                <li>Plaudアプリを開く</li>
                <li>設定（歯車アイコン）→「自動送信」または「Auto Sync」</li>
                <li>送信先メールアドレスに、上記の<strong>あなた専用アドレス</strong>を入力</li>
                <li>「送信フォーマット」を「テキスト」または「文字起こしのみ」に設定</li>
                <li>「自動送信を有効化」をオン</li>
              </ol>
              <p class="integration-note">これで、録音するたびに自動で意識レイヤー分析が実行されます。</p>
            </div>
            ` : `
            <p class="integration-note">ログインすると専用のメールアドレスが発行されます。</p>
            `}
          </div>

          <hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">

          <!-- 手動貼り付け（フォールバック） -->
          <div class="integration-manual">
            <h4>手動で取り込む</h4>
            <p>自動フローを設定していない場合は、こちらから貼り付けて取り込めます。</p>

            <div class="form-group">
              <label>文字起こしの内容</label>
              <textarea id="plaudText" class="form-input" rows="6"
                placeholder="ここにPlaudの文字起こしを貼り付けてください..."></textarea>
            </div>
            <div class="form-group">
              <label>日付</label>
              <input type="date" id="plaudDate" class="form-input" value="${new Date().toISOString().slice(0,10)}">
            </div>
            <button class="btn btn-primary" onclick="app.importPlaud()">取り込む</button>
          </div>
        </div>
      </div>

      <!-- Google Calendar -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Googleカレンダー</h3>
          <span class="status-badge ${gcalConnected ? 'connected' : ''}">${gcalConnected ? '接続済み' : '未接続'}</span>
        </div>
        <div class="card-body">
          <p>Googleカレンダーから予定を直接同期します。iPhoneやOutlookのカレンダーは .icsファイルでも取り込めます。</p>

          ${gcalConnected ? `
          <p>${calendarCount}件の予定を取り込み済み</p>
          <div class="form-actions">
            <button class="btn btn-primary" onclick="app.gcalSync()">今すぐ同期する</button>
            <button class="btn btn-sm btn-secondary" onclick="app.gcalDisconnect()">接続解除</button>
          </div>
          ` : `
          <div class="integration-steps">
            <h4>接続方法</h4>
            <ol>
              <li><a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>でOAuthクライアントIDを作成</li>
              <li>Client IDを下に入力</li>
              <li>「接続する」を押す</li>
            </ol>
          </div>
          <div class="form-group">
            <label>Google Client ID</label>
            <input type="text" id="gcalClientId" class="form-input" value="${localStorage.getItem('lms_gcal_client_id') || ''}" placeholder="xxx.apps.googleusercontent.com">
          </div>
          <button class="btn btn-primary" onclick="app.gcalConnect()">接続する</button>
          `}

          <hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">

          <div class="integration-steps">
            <h4>ICSファイルから取り込み</h4>
            <p style="font-size:13px;color:var(--text-secondary);">カレンダーアプリの設定から.icsファイルをエクスポートして取り込めます。</p>
          </div>
          <input type="file" id="calendarFile" accept=".ics" style="display:none" onchange="app.importCalendarFile(event)">
          <button class="btn btn-secondary" onclick="document.getElementById('calendarFile').click()">ICSファイルを選択</button>
        </div>
      </div>

      <!-- Fitbit -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Fitbit</h3>
          <span class="status-badge ${fitbitConnected ? 'connected' : ''}">${fitbitConnected ? '接続済み' : '未接続'}</span>
        </div>
        <div class="card-body">
          <p>Fitbitから歩数・心拍数・睡眠データを自動で取り込みます。</p>

          ${fitbitConnected ? `
          <div class="form-actions">
            <button class="btn btn-primary" onclick="app.fitbitImportToday()">今日のデータを取り込む</button>
            <button class="btn btn-secondary" onclick="app.fitbitImportHistory()">過去7日分を取り込む</button>
            <button class="btn btn-sm btn-secondary" onclick="app.fitbitDisconnect()">接続解除</button>
          </div>
          ` : `
          <div class="integration-steps">
            <h4>接続方法</h4>
            <ol>
              <li><a href="https://dev.fitbit.com/apps/new" target="_blank">Fitbit開発者ページ</a>でアプリを登録</li>
              <li>Client IDを下に入力</li>
              <li>「接続する」を押す</li>
            </ol>
          </div>
          <div class="form-group">
            <label>Fitbit Client ID</label>
            <input type="text" id="fitbitClientId" class="form-input" value="${localStorage.getItem('lms_fitbit_client_id') || ''}" placeholder="Client IDを入力">
          </div>
          <button class="btn btn-primary" onclick="app.fitbitConnect()">接続する</button>
          `}
        </div>
      </div>

      <!-- Apple Health -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Apple Health（iPhoneの方）</h3>
        </div>
        <div class="card-body">
          <p>iPhoneの「ヘルスケア」アプリからデータを取り込みます。</p>

          <div class="integration-steps">
            <h4>方法1: XMLファイルから</h4>
            <ol>
              <li>iPhoneの「ヘルスケア」アプリを開く</li>
              <li>右上のプロフィールアイコン → 「すべてのヘルスケアデータを書き出す」</li>
              <li>ZIPファイルをダウンロードして解凍</li>
              <li>「export.xml」を下のボタンで選択</li>
            </ol>
          </div>

          <input type="file" id="appleHealthFile" accept=".xml" style="display:none" onchange="app.importAppleHealth(event)">
          <button class="btn btn-primary" onclick="document.getElementById('appleHealthFile').click()">Apple Healthファイルを選択</button>

          <hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">

          <div class="integration-steps">
            <h4>方法2: ショートカットで毎日自動送信</h4>
            <ol>
              ${(typeof appleHealth !== 'undefined' ? appleHealth.getShortcutInstructions() : []).map(s => `<li>${s}</li>`).join('')}
            </ol>
          </div>
        </div>
      </div>

      <!-- ファイル取り込み -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>📎 ファイル取り込み</h3>
        </div>
        <div class="card-body">
          <p>CSV、JSON、テキストファイルなど、いろいろなファイルからデータを取り込めます。</p>

          <div class="file-drop-area" id="fileDropArea"
            ondragover="event.preventDefault();this.classList.add('dragover')"
            ondragleave="this.classList.remove('dragover')"
            ondrop="app.handleFileDrop(event)">
            <div class="upload-icon">📁</div>
            <p>ここにファイルをドラッグ＆ドロップ</p>
            <p>または</p>
            <input type="file" id="generalFile" accept=".csv,.json,.xml,.txt,.pdf" style="display:none" onchange="app.handleFileUpload(event, '${domain}')">
            <button class="btn btn-secondary" onclick="document.getElementById('generalFile').click()">ファイルを選択</button>
          </div>
        </div>
      </div>

    </div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  ADMIN PAGE (未病ダイアリー準拠: tabbed interface)
  // ═══════════════════════════════════════════════════════════
  renderAdmin() {
    if (!FirebaseBackend.isAdmin()) {
      return '<div class="page-admin"><div class="card"><div class="card-body"><h2>Access Denied</h2><p>管理権限がありません。</p></div></div></div>';
    }

    const currentTab = store.get('adminTab') || 'prompts';
    const promptCount = Object.keys(CONFIG.prompts || {}).length;

    let html = `<div class="page-admin">
      <div class="admin-tabs">
        <button class="admin-tab ${currentTab === 'prompts' ? 'active' : ''}" onclick="app.setAdminTab('prompts')">
          プロンプト<span class="tab-count">${promptCount}</span>
        </button>
        <button class="admin-tab ${currentTab === 'models' ? 'active' : ''}" onclick="app.setAdminTab('models')">
          AIモデル
        </button>
        <button class="admin-tab ${currentTab === 'apikeys' ? 'active' : ''}" onclick="app.setAdminTab('apikeys')">
          APIキー
        </button>
        <button class="admin-tab ${currentTab === 'affiliate' ? 'active' : ''}" onclick="app.setAdminTab('affiliate')">
          アフィリエイト
        </button>
        <button class="admin-tab ${currentTab === 'firebase' ? 'active' : ''}" onclick="app.setAdminTab('firebase')">
          Firebase
        </button>
        <button class="admin-tab ${currentTab === 'data' ? 'active' : ''}" onclick="app.setAdminTab('data')">
          データ管理
        </button>
      </div>

      <div class="admin-content">
        ${this['renderAdminTab_' + currentTab] ? this['renderAdminTab_' + currentTab]() : this.renderAdminTab_prompts()}
      </div>
    </div>`;

    return html;
  },

  // ─── Admin Tab: Prompts ───
  renderAdminTab_prompts() {
    const prompts = CONFIG.prompts || {};
    const filter = store.get('adminPromptFilter') || { search: '', domain: '' };

    let html = `<div class="card">
      <div class="card-header">
        <h3>AIプロンプト管理</h3>
        <button class="btn btn-sm btn-primary" onclick="app.addNewPrompt()">新規追加</button>
      </div>
      <div class="card-body">
        <div class="admin-filters">
          <input type="text" id="promptSearch" class="form-input" placeholder="プロンプト名で検索"
            value="${filter.search}" oninput="app.filterPrompts()">
          <select id="promptDomainFilter" class="form-input" onchange="app.filterPrompts()">
            <option value="">すべての領域</option>
            ${Object.keys(CONFIG.domains).map(d => `<option value="${d}" ${filter.domain === d ? 'selected' : ''}>${i18n.t(d)}</option>`).join('')}
            <option value="universal">共通</option>
          </select>
        </div>

        <div class="prompt-list">`;

    const filtered = Object.entries(prompts).filter(([key, p]) => {
      if (filter.search && !key.toLowerCase().includes(filter.search.toLowerCase()) && !(p.name || '').includes(filter.search)) return false;
      if (filter.domain && p.domain !== filter.domain) return false;
      return true;
    });

    filtered.forEach(([key, p], i) => {
      const schedule = p.schedule || 'manual';
      const scheduleLabel = { daily: '毎日', weekly: '毎週', on_data_update: 'データ更新時', manual: '手動' }[schedule] || schedule;
      html += `<div class="prompt-item ${p.active === false ? 'inactive' : ''}" data-key="${key}">
        <div class="prompt-header">
          <div class="prompt-meta">
            <span class="prompt-num">${i + 1}</span>
            <span class="prompt-name">${p.name || key}</span>
            <span class="prompt-badge domain">${p.domain ? i18n.t(p.domain) : '共通'}</span>
            <span class="prompt-badge schedule">${scheduleLabel}</span>
          </div>
          <div class="prompt-actions">
            <button class="btn btn-sm btn-secondary" onclick="app.editPrompt('${key}')">編集</button>
          </div>
        </div>
        <div class="prompt-desc">${p.description || ''}</div>
        <div class="prompt-edit" id="edit-${key}" style="display:none;">
          <div class="form-group">
            <label>名前</label>
            <input type="text" class="form-input" value="${p.name || ''}" data-field="name">
          </div>
          <div class="form-group">
            <label>領域</label>
            <select class="form-input" data-field="domain">
              <option value="">共通</option>
              ${Object.keys(CONFIG.domains).map(d => `<option value="${d}" ${p.domain === d ? 'selected' : ''}>${i18n.t(d)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>スケジュール</label>
            <select class="form-input" data-field="schedule">
              <option value="daily" ${schedule === 'daily' ? 'selected' : ''}>毎日</option>
              <option value="weekly" ${schedule === 'weekly' ? 'selected' : ''}>毎週</option>
              <option value="on_data_update" ${schedule === 'on_data_update' ? 'selected' : ''}>データ更新時</option>
              <option value="manual" ${schedule === 'manual' ? 'selected' : ''}>手動</option>
            </select>
          </div>
          <div class="form-group">
            <label>説明</label>
            <input type="text" class="form-input" value="${p.description || ''}" data-field="description">
          </div>
          <div class="form-group">
            <label>プロンプト本文</label>
            <textarea class="form-input prompt-textarea" rows="16" data-field="prompt">${p.prompt || ''}</textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" onclick="app.savePrompt('${key}')">保存</button>
            <button class="btn btn-secondary" onclick="app.cancelPromptEdit('${key}')">キャンセル</button>
            <button class="btn btn-danger" onclick="app.deletePrompt('${key}')">削除</button>
          </div>
        </div>
      </div>`;
    });

    html += `</div></div></div>`;
    return html;
  },

  // ─── Admin Tab: Models ───
  renderAdminTab_models() {
    const current = store.get('selectedModel') || 'claude-sonnet-4-6';
    return `<div class="card">
      <div class="card-header"><h3>AIモデル選択</h3></div>
      <div class="card-body">
        <div class="model-grid">
          ${Object.entries(CONFIG.aiModels).map(([id, m]) => `
            <div class="model-card ${current === id ? 'selected' : ''}" onclick="app.selectModel('${id}')">
              <div class="model-name">${m.name}</div>
              <div class="model-provider">${m.provider}</div>
              <div class="model-tokens">最大 ${m.maxTokens?.toLocaleString() || '-'} トークン</div>
              ${current === id ? '<div class="model-active">使用中</div>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
  },

  // ─── Admin Tab: API Keys ───
  renderAdminTab_apikeys() {
    return `<div class="card">
      <div class="card-header"><h3>APIキー設定</h3></div>
      <div class="card-body">
        <div class="form-group">
          <label>APIプロキシURL（必須）</label>
          <input type="text" id="workerUrl" class="form-input" value="${CONFIG.endpoints.anthropic}" placeholder="https://...workers.dev">
          <div class="input-help">CloudflareワーカーのURLを入力してください</div>
        </div>
        <div class="form-group">
          <label>Anthropic API Key (Claude)</label>
          <input type="password" id="apiKeyAnthropic" class="form-input"
            value="${AIEngine.getApiKey('anthropic') ? '••••••••' : ''}" placeholder="sk-ant-...">
        </div>
        <div class="form-group">
          <label>OpenAI API Key (GPT)</label>
          <input type="password" id="apiKeyOpenAI" class="form-input"
            value="${AIEngine.getApiKey('openai') ? '••••••••' : ''}" placeholder="sk-...">
        </div>
        <div class="form-group">
          <label>Google API Key (Gemini)</label>
          <input type="password" id="apiKeyGoogle" class="form-input"
            value="${AIEngine.getApiKey('google') ? '••••••••' : ''}" placeholder="AI...">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="app.saveApiKeys();app.saveWorkerUrl()">保存</button>
          <button class="btn btn-secondary" onclick="app.testConnection()">接続テスト</button>
          <button class="btn btn-danger" onclick="app.clearApiKeys()">すべて削除</button>
        </div>
        <div id="connectionResult"></div>
      </div>
    </div>`;
  },

  // ─── Admin Tab: Affiliate ───
  renderAdminTab_affiliate() {
    return `<div class="card">
      <div class="card-header"><h3>アフィリエイト設定</h3></div>
      <div class="card-body">
        ${Object.entries(CONFIG.affiliate).map(([name, config]) => `
          <div class="form-group">
            <label>${name}</label>
            <input type="text" class="form-input" id="aff_${name}"
              value="${config.tag || config.id || config.code || ''}" placeholder="アフィリエイトID / タグ">
          </div>
        `).join('')}
        <button class="btn btn-primary" onclick="app.saveAffiliateConfig()">保存</button>
      </div>
    </div>`;
  },

  // ─── Admin Tab: Firebase ───
  renderAdminTab_firebase() {
    const connected = FirebaseBackend.initialized;
    return `<div class="card">
      <div class="card-header">
        <h3>Firebase設定</h3>
        <span class="status-badge ${connected ? 'connected' : 'disconnected'}">${connected ? '接続済' : '未接続'}</span>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label>API Key</label>
          <input type="text" id="fbApiKey" class="form-input" value="${CONFIG.firebase.apiKey || ''}">
        </div>
        <div class="form-group">
          <label>Auth Domain</label>
          <input type="text" id="fbAuthDomain" class="form-input" value="${CONFIG.firebase.authDomain || ''}">
        </div>
        <div class="form-group">
          <label>Project ID</label>
          <input type="text" id="fbProjectId" class="form-input" value="${CONFIG.firebase.projectId || ''}">
        </div>
        <div class="form-group">
          <label>Storage Bucket</label>
          <input type="text" id="fbStorageBucket" class="form-input" value="${CONFIG.firebase.storageBucket || ''}">
        </div>
        <div class="form-group">
          <label>Messaging Sender ID</label>
          <input type="text" id="fbMessagingSenderId" class="form-input" value="${CONFIG.firebase.messagingSenderId || ''}">
        </div>
        <div class="form-group">
          <label>App ID</label>
          <input type="text" id="fbAppId" class="form-input" value="${CONFIG.firebase.appId || ''}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="app.saveFirebaseConfig()">保存</button>
          <button class="btn btn-danger" onclick="app.clearFirebaseConfig()">削除</button>
        </div>
      </div>
    </div>`;
  },

  // ─── Admin Tab: Data Management ───
  renderAdminTab_data() {
    const user = store.get('user');
    return `<div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3>管理者</h3></div>
      <div class="card-body">
        <div class="admin-user-item">
          <div>
            <strong>${user?.email || '未ログイン'}</strong>
            <span class="status-badge">オーナー</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>データ管理</h3></div>
      <div class="card-body">
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="app.generateDemoData()">デモデータを生成</button>
          <button class="btn btn-secondary" onclick="app.exportData()">データを書き出す</button>
          <button class="btn btn-danger" onclick="app.deleteAllData()">すべてのデータを削除</button>
        </div>
      </div>
    </div>`;
  }
};
