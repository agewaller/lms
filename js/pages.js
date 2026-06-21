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
      case 'admin':        return this.renderAdmin();
      case 'doctor_report': return this.renderDoctorReport(domain);
      default:         return this.renderHome(domain);
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  HOME PAGE (per domain)
  // ═══════════════════════════════════════════════════════════
  renderHome(domain) {
    const domainConfig = CONFIG.domains[domain];
    // Pre-calculate all domain scores so mini gauges don't show stale 0s
    Object.keys(CONFIG.domains).forEach(d => store.calculateDomainScore(d));
    const score = store.get('domainScores')?.[domain] || 50;
    const color = domainConfig?.color || '#6C63FF';

    // Quick input bar
    let html = `<div class="page-home">
      <div class="quick-input-bar">
        <input type="text" id="quickInput" class="form-input" placeholder="${i18n.t('quick_input_placeholder')}"
          onkeydown="if(event.key==='Enter')app.quickInput()">
        <button class="btn btn-voice" id="voiceBtn_quickInput" onclick="app.startVoiceInput('quickInput')" title="音声入力">🎤</button>
        <button class="btn btn-primary" onclick="app.quickInput()">${i18n.t('send')}</button>
      </div>
      <div id="quickResponse"></div>
      ${this.renderGettingStarted(domain)}
      ${this.renderTodayPriorities(domain)}
      ${this.renderCheckinNudge(domain)}
      ${this.renderDailyPrompt(domain)}
      ${this.renderWeeklySummary()}`;

    // Assets domain: Show stock analysis at the very top
    if (domain === 'assets') {
      html += this.renderStockAnalysisWidget();
    }

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
      html += `<div class="first-entry-prompt">
        <div class="fep-icon">${domainConfig?.icon || '●'}</div>
        <div class="fep-text">
          <strong>まだ記録がありません</strong><br>
          <span>「記録する」から今日の状態を入力してみましょう。<br>記録が増えると、あなたに合ったアドバイスが届きます。</span>
        </div>
        <button class="btn btn-primary" onclick="app.navigate('record')">今すぐ記録する →</button>
      </div>`;
    } else {
      allRecent.slice(0, 10).forEach(entry => {
        html += Components.recordItem(entry, domain);
      });
    }

    html += `</div></div>`;

    // 14-day trend chart
    html += this.renderTrendChartContainer(domain);

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
        <div class="analysis-meta">${new Date(latest.timestamp).toLocaleString()}</div>
      </div>`;
    }

    // ─── Domain-specific widgets ───

    // Consciousness domain: gratitude journal + 7-layer visualization + transcript input
    if (domain === 'consciousness') {
      html += this.renderGratitudeWidget();
      html += this.renderConsciousnessLayers();
      html += this.renderTranscriptInput();
    }

    // Time domain: Habit tracker + Calendar widget + Marketplace widget
    if (domain === 'time') {
      html += this.renderHabitTracker();
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

    // Assets domain: monthly budget summary + NISA simulator + advisor + screenshot + auto trading
    // (Stock analysis widget is rendered at the top of the page.)
    if (domain === 'assets') {
      html += this.renderMonthlyBudgetSummary();
      if (typeof AssetsFeatures !== 'undefined') {
        html += AssetsFeatures.renderNISASimulator();
        html += AssetsFeatures.renderAIAdvisor();
        html += AssetsFeatures.renderScreenshotReader();
        html += AssetsFeatures.renderAutoTrading();
      }
    }

    // Health: SOS button + medication reminder + doctor report shortcut
    if (domain === 'health') {
      html += this.renderSOSWidget();
      html += this.renderMedicationReminder();
      html += `<div class="doctor-report-banner">
        <div class="drb-text">
          <strong>かかりつけ医への受診準備</strong>
          <span>直近30日間の健康データをまとめて印刷できます</span>
        </div>
        <button class="btn btn-secondary" onclick="app.navigate('doctor_report')">レポートを作成 →</button>
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

  // ─── Gratitude Journal (Consciousness domain quick widget) ───
  renderGratitudeWidget() {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = 'lms_gratitude_' + today;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (e) {}
    const hasSaved = saved.length > 0;

    // Recent entries from Firestore
    const recentEntries = store.getDomainData('consciousness', 'appreciation', 7);
    const todayEntry = recentEntries.find(e => (e.timestamp || '').startsWith(today));

    if (todayEntry || hasSaved) {
      const items = hasSaved ? saved : (Array.isArray(todayEntry?.items) ? todayEntry.items : [todayEntry?.content].filter(Boolean));
      return `<div class="gratitude-widget">
        <div class="gw-header">
          <span class="gw-title">今日の感謝 <span class="gw-done-badge">✓ 記録済み</span></span>
        </div>
        <ul class="gw-list">
          ${items.slice(0, 3).map(item => `<li class="gw-item">${Components.escapeHtml(String(item))}</li>`).join('')}
        </ul>
      </div>`;
    }

    return `<div class="gratitude-widget">
      <div class="gw-header">
        <span class="gw-title">今日の感謝を3つ書きましょう</span>
      </div>
      <p class="gw-desc">小さなことでも大丈夫。毎日続けると、心が穏やかになります。</p>
      <div class="gw-inputs">
        <div class="gw-input-row"><span class="gw-num">1</span><input type="text" id="gw1" class="form-input" placeholder="例：おいしいお茶が飲めた"></div>
        <div class="gw-input-row"><span class="gw-num">2</span><input type="text" id="gw2" class="form-input" placeholder="例：今日もお天気が良かった"></div>
        <div class="gw-input-row"><span class="gw-num">3</span><input type="text" id="gw3" class="form-input" placeholder="例：友人から連絡がきた"></div>
      </div>
      <button class="btn btn-primary" style="margin-top:14px;width:100%" onclick="Pages.saveGratitude()">感謝を記録する</button>
    </div>`;
  },

  saveGratitude() {
    const items = ['gw1','gw2','gw3'].map(id => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }).filter(Boolean);

    if (items.length === 0) {
      Components.showToast('1つ以上入力してください', 'error');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('lms_gratitude_' + today, JSON.stringify(items));
    store.addDomainEntry('consciousness', 'appreciation', { items, content: items.join('、') });
    Components.showToast('感謝を記録しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
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
    const addBtn = `<button class="btn btn-sm btn-secondary" onclick="app.openQuickAddContact()">＋ 追加</button>`;
    if (contacts.length === 0) {
      return `<div class="social-graph-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="margin:0">つながりの地図</h3>
          ${addBtn}
        </div>
        ${Components.emptyState('🤝', 'まだ連絡先がありません', '「＋ 追加」から大切な方を登録してみましょう')}
      </div>`;
    }

    const levels = CONFIG.domains.relationship.distanceLevels;
    const grouped = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    contacts.forEach(c => {
      const d = parseInt(c.distance) || 4;
      if (grouped[d]) grouped[d].push(c);
    });

    let html = `<div class="social-graph-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <h3 style="margin:0">つながりの地図（${contacts.length}人）</h3>
        ${addBtn}
      </div>
      <div class="social-graph">
        <div class="graph-center">あなた</div>`;

    // Concentric rings
    [1, 2, 3, 4, 5].forEach(level => {
      const people = grouped[level] || [];
      if (people.length === 0) return;
      html += `<div class="graph-ring ring-${level}" style="--ring-color: ${levels[level].color}">
        <div class="ring-label">${levels[level].description}（${people.length}人）</div>
        <div class="ring-people">
          ${people.slice(0, 8).map(p => `<span class="ring-person" title="${Components.escapeHtml(p.name || '')}">${Components.escapeHtml((p.name || '').substring(0, 3))}</span>`).join('')}
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
        <span class="birthday-name">${Components.escapeHtml(c.name)}</span>
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
      <h3>${i18n.t('stock_investment')}</h3>
      <p>銘柄名またはティッカーを入力すると、詳しい分析をご覧いただけます。</p>
      <div class="stock-input-bar">
        <input type="text" id="stockTicker" class="form-input"
          placeholder="例：トヨタ、7203、AAPL"
          onkeydown="if(event.key==='Enter'){event.preventDefault();app.analyzeStock();}">
        <button class="btn btn-primary" onclick="app.analyzeStock()">
          ${i18n.t('analyze_stock')}
        </button>
      </div>
      <div id="stockResult"></div>
    </div>`;
  },

  // ─── Daily Habit Tracker (Time domain) ───
  renderHabitTracker() {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = 'lms_habits_' + today;
    let completedArr = [];
    try { completedArr = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (e) {}
    const completedSet = new Set(completedArr);

    const defaultHabits = [
      { key: 'walk', label: '散歩・運動' },
      { key: 'medicine', label: 'お薬を飲む' },
      { key: 'contact', label: '誰かに連絡' },
      { key: 'meal', label: '食事を楽しむ' },
      { key: 'rest', label: 'ゆっくり休む' }
    ];

    return `<div class="habit-tracker-card">
      <div class="ht-header">
        <span class="ht-title">今日の習慣チェック</span>
        <span class="ht-count">${completedSet.size}/${defaultHabits.length}</span>
      </div>
      <div class="ht-habits">
        ${defaultHabits.map(h => {
          const done = completedSet.has(h.key);
          return `<button class="ht-habit ${done ? 'done' : ''}"
            onclick="Pages.toggleHabit('${Components.escapeHtml(h.key)}')">
            <span class="ht-check">${done ? '✓' : ''}</span>
            <span class="ht-label">${Components.escapeHtml(h.label)}</span>
          </button>`;
        }).join('')}
      </div>
      ${completedSet.size === defaultHabits.length ? '<div class="ht-complete">今日の習慣をすべて達成しました！素晴らしい！</div>' : ''}
    </div>`;
  },

  toggleHabit(key) {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = 'lms_habits_' + today;
    let completed = [];
    try { completed = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch (e) {}

    if (completed.includes(key)) {
      completed = completed.filter(k => k !== key);
    } else {
      completed.push(key);
      if (completed.length === 5) {
        store.addDomainEntry('time', 'habits', { completed_habits: completed, streak: 0 });
      }
    }
    localStorage.setItem(storageKey, JSON.stringify(completed));
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Monthly Budget Summary (Assets domain) ───
  renderMonthlyBudgetSummary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;

    const incomeData = store.getDomainData('assets', 'income', 90).filter(e => (e.timestamp || '') >= monthStart);
    const expenseData = store.getDomainData('assets', 'expenses', 90).filter(e => (e.timestamp || '') >= monthStart);

    const totalIncome = incomeData.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalExpense = expenseData.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const balance = totalIncome - totalExpense;
    const balanceColor = balance >= 0 ? 'var(--success,#10b981)' : 'var(--danger,#ef4444)';

    // Expense by category
    const catMap = {};
    const catLabels = { housing: '住居費', food: '食費', health: '医療費', transport: '交通費', insurance: '保険', tax: '税金', entertainment: '交際・娯楽', other: 'その他' };
    expenseData.forEach(e => {
      const cat = e.category || 'other';
      catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
    });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

    const fmt = (n) => n === 0 ? '¥0' : `¥${Math.round(n).toLocaleString('ja-JP')}`;

    if (totalIncome === 0 && totalExpense === 0) {
      return `<div class="budget-summary-card">
        <div class="bs-header">
          <span class="bs-title">${monthLabel}の家計</span>
          <button class="btn btn-sm btn-primary" onclick="app.navigate('record')">収支を記録する</button>
        </div>
        <p style="color:var(--text-secondary);font-size:15px;margin-top:12px">今月の収入・支出の記録がまだありません。記録を始めると、お金の流れが見えてきます。</p>
      </div>`;
    }

    return `<div class="budget-summary-card">
      <div class="bs-header">
        <span class="bs-title">${monthLabel}の家計</span>
        <button class="btn btn-sm btn-secondary" onclick="app.navigate('record')">記録を追加</button>
      </div>
      <div class="bs-totals">
        <div class="bs-total-item bs-income">
          <div class="bs-total-label">収入</div>
          <div class="bs-total-value">${fmt(totalIncome)}</div>
        </div>
        <div class="bs-total-item bs-expense">
          <div class="bs-total-label">支出</div>
          <div class="bs-total-value">${fmt(totalExpense)}</div>
        </div>
        <div class="bs-total-item bs-balance">
          <div class="bs-total-label">収支</div>
          <div class="bs-total-value" style="color:${balanceColor}">${balance >= 0 ? '+' : ''}${fmt(balance)}</div>
        </div>
      </div>
      ${topCats.length > 0 ? `
        <div class="bs-categories">
          <div class="bs-cat-title">支出の内訳</div>
          ${topCats.map(([cat, amt]) => {
            const pct = totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0;
            return `<div class="bs-cat-row">
              <span class="bs-cat-label">${Components.escapeHtml(catLabels[cat] || cat)}</span>
              <div class="bs-cat-track"><div class="bs-cat-fill" style="width:${pct}%"></div></div>
              <span class="bs-cat-amt">${fmt(amt)}</span>
            </div>`;
          }).join('')}
        </div>` : ''}
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
        <p><strong>${Components.escapeHtml(resume.name || '')}</strong></p>
        <p>${Components.escapeHtml(resume.summary || '')}</p>
        <p>スキル: ${Components.escapeHtml((resume.skills || []).join(', '))}</p>
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
            ${domain === 'health' && key === 'symptoms' ? this.renderPainLocationSelector() : ''}
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
        <h3>📋 アクション項目</h3>
        ${actions.map((a, i) => `
          <div class="action-item ${a.done ? 'done' : ''}">
            <label><input type="checkbox" ${a.done ? 'checked' : ''} onchange="app.toggleAction(${i})"> ${Components.escapeHtml(a.text || '')}</label>
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

    const suggestionsByDomain = {
      health:        ['今日の体調について相談したい', '最近眠れていない', '薬の飲み合わせが気になる', '体重が気になる'],
      consciousness: ['最近気持ちが落ち着かない', '瞑想を始めたい', '自分の生きがいを見つけたい', '不安を減らしたい'],
      time:          ['時間の使い方を見直したい', '毎日がルーティンで退屈', '趣味の時間を作りたい', '朝型生活にしたい'],
      work:          ['定年後の仕事を探している', '副業・ボランティアに興味がある', 'スキルを活かしたい', '履歴書の書き方が知りたい'],
      relationship:  ['家族との関係で悩んでいる', '友人と疎遠になってきた', '新しい出会いを作りたい', '孤独感が強い'],
      assets:        ['老後の生活費が心配', 'NISAについて知りたい', '家計を見直したい', '年金だけで暮らせるか不安']
    };
    const suggestions = suggestionsByDomain[domain] || [];

    let html = `<div class="page-ask-ai">
      <div class="chat-header">
        <h2>${i18n.t(domain)} - 相談する</h2>
        ${history.length > 0 ? `<button class="btn btn-sm btn-secondary" onclick="app.clearChat('${domain}')">新しい会話</button>` : ''}
      </div>

      <div class="chat-container" id="chatContainer">
        ${history.length === 0 ?
          Components.emptyState('💬', '相談する', i18n.t('quick_input_placeholder')) :
          history.map(m => Components.chatMessage(m)).join('')
        }
      </div>

      ${history.length === 0 && suggestions.length > 0 ? `
      <div class="chat-suggestions">
        <div class="chat-suggestions-label">よく聞かれる質問（タップで入力）</div>
        <div class="chat-suggestions-grid">
          ${suggestions.map(s => `<button class="chat-suggestion-chip"
            onclick="document.getElementById('chatInput').value=${JSON.stringify(s)};app.sendChat('${domain}')"
          >${Components.escapeHtml(s)}</button>`).join('')}
        </div>
      </div>` : ''}

      <div class="chat-input-bar">
        <textarea id="chatInput" class="form-input" rows="2"
          placeholder="${i18n.t('quick_input_placeholder')}"
          onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();app.sendChat('${domain}')}"></textarea>
        <button class="btn btn-voice" id="voiceBtn_chatInput" onclick="app.startVoiceInput('chatInput')" title="音声入力">🎤</button>
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
    const schema = CONFIG.profileSchema || {};

    // Helper: render a form field from schema definition
    const renderField = (field, value) => {
      const val = value ?? '';
      const id = 'profile_' + field.key;
      const esc = Components.escapeHtml;
      switch (field.type) {
        case 'number':
          return `<input type="number" id="${id}" class="form-input" value="${esc(String(val))}" ${field.step ? `step="${field.step}"` : ''}>`;
        case 'text':
          return `<input type="text" id="${id}" class="form-input" value="${esc(String(val))}">`;
        case 'date':
          return `<input type="date" id="${id}" class="form-input" value="${esc(String(val))}">`;
        case 'textarea':
          return `<textarea id="${id}" class="form-input" rows="3">${esc(String(val))}</textarea>`;
        case 'select':
          return `<select id="${id}" class="form-input">
            <option value="">選択してください</option>
            ${(field.options || []).map(o => `<option value="${esc(o)}" ${val === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
          </select>`;
        default:
          return `<input type="text" id="${id}" class="form-input" value="${esc(String(val))}">`;
      }
    };

    const renderSchemaSection = (sectionKey, sectionTitle) => {
      const fields = schema[sectionKey] || [];
      if (fields.length === 0) return '';
      return `<div class="settings-section">
        <h3>${sectionTitle}</h3>
        ${fields.map(f => `
          <div class="form-group">
            <label>${f.label}</label>
            ${renderField(f, profile[f.key])}
          </div>
        `).join('')}
      </div>`;
    };

    // Diseases (WHO ICD-11 based multi-select)
    const selectedDiseases = Array.isArray(profile.diseases) ? profile.diseases : [];
    const renderDiseases = () => {
      const cats = CONFIG.diseaseCategories || {};
      return `<div class="settings-section">
        <h3>持病・症状（WHO ICD-11準拠）</h3>
        <p class="page-desc">該当する項目すべてにチェックしてください。後から変更できます。</p>
        ${Object.entries(cats).map(([catKey, cat]) => `
          <div class="disease-category">
            <h4>${cat.label}</h4>
            <div class="disease-grid">
              ${cat.diseases.map(d => `
                <label class="disease-item">
                  <input type="checkbox" name="disease" value="${d}"
                    ${selectedDiseases.includes(d) ? 'checked' : ''}>
                  <span>${d}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>`;
    };

    let html = `<div class="page-settings">
      <h2>${i18n.t('settings')}</h2>
      ${this.renderProfileCompletion(profile)}

      <!-- 基本情報 -->
      ${renderSchemaSection('basic', '基本情報')}

      <!-- 生活・家族 -->
      ${renderSchemaSection('lifestyle', '生活・家族構成')}

      <!-- 健康 -->
      ${renderSchemaSection('health', '健康・医療')}

      <!-- 疾患選択 -->
      ${renderDiseases()}

      <!-- 資産・収入 -->
      ${renderSchemaSection('financial', '資産・収入')}

      <!-- 目標・価値観 -->
      ${renderSchemaSection('goals', '目標・価値観')}

      <!-- 言語 -->
      <div class="settings-section">
        <h3>言語</h3>
        <div class="form-group">
          <label>${i18n.t('language')}</label>
          <select id="profileLang" class="form-input" onchange="app.changeLanguage(this.value)">
            <option value="ja" ${i18n.currentLang === 'ja' ? 'selected' : ''}>日本語</option>
            <option value="en" ${i18n.currentLang === 'en' ? 'selected' : ''}>English</option>
            <option value="zh" ${i18n.currentLang === 'zh' ? 'selected' : ''}>中文</option>
            <option value="ko" ${i18n.currentLang === 'ko' ? 'selected' : ''}>한국어</option>
          </select>
        </div>
      </div>

      <div class="settings-section" style="text-align:center;">
        <button class="btn btn-primary btn-lg" onclick="app.saveProfile()">${i18n.t('save_profile')}</button>
      </div>

      <!-- Subscription -->
      <div class="settings-section">
        <h3>サブスクリプション</h3>
        ${PayPalManager.renderStatus()}
      </div>

      <!-- Data Export/Import -->
      <div class="settings-section">
        <h3>💾 ${i18n.t('data_export')} / ${i18n.t('data_import')}</h3>
        <button class="btn btn-secondary" onclick="app.exportData()">${i18n.t('data_export')}</button>
        <input type="file" id="importFile" accept=".json" onchange="app.importData(event)" style="display:none">
        <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">${i18n.t('data_import')}</button>
      </div>

      <!-- Share App -->
      <div class="settings-section">
        <h3>友人・家族に教える</h3>
        <p style="color:var(--text-secondary);font-size:15px;margin-bottom:16px">このアプリが役立てば、大切な方にも教えてあげましょう。</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${navigator.share ? `<button class="btn btn-primary" onclick="app.shareApp()">📤 友人に教える</button>` : ''}
          <a href="https://social-plugins.line.me/lineit/share?url=https%3A%2F%2Fagewaller.github.io%2Flms%2F&text=%E3%81%93%E3%81%AE%E3%82%A2%E3%83%97%E3%83%AA%E3%80%81%E4%BD%BF%E3%81%84%E3%82%84%E3%81%99%E3%81%8F%E3%81%A6%E3%81%8A%E3%81%99%E3%81%99%E3%82%81%EF%BC%81" class="btn line-share-btn" target="_blank" rel="noopener">LINEで送る</a>
          <button class="btn btn-secondary" onclick="app.copyShareLink()">🔗 リンクをコピー</button>
        </div>
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

      <!-- Display Theme -->
      <div class="settings-section">
        <h3>🌙 画面の明るさ</h3>
        <p>夜間や暗い場所では「ダーク」モードが目に優しいです。</p>
        <div class="theme-toggle-row">
          ${['light','dark'].map(t => {
            const cur = localStorage.getItem('lms_theme') || 'light';
            const labels = { light: '☀️ ライト', dark: '🌙 ダーク' };
            return `<button class="theme-toggle-btn ${cur === t ? 'active' : ''}"
              onclick="app.setTheme('${t}')">${labels[t]}</button>`;
          }).join('')}
        </div>
      </div>

      <!-- Text Size Accessibility -->
      <div class="settings-section">
        <h3>🔠 文字の大きさ</h3>
        <p>目に合わせて文字の大きさを変えられます。</p>
        <div class="form-group" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
          ${['normal','lg','xl'].map(size => {
            const current = localStorage.getItem('lms_textSize') || 'normal';
            const labels = { normal: '標準', lg: '大きめ', xl: '特大' };
            return `<button class="btn ${current === size ? 'btn-primary' : 'btn-secondary'}"
              onclick="app.setTextSize('${size}')">${labels[size]}</button>`;
          }).join('')}
        </div>
      </div>

      <!-- Notification Settings -->
      <div class="settings-section">
        <h3>🔔 毎日のリマインダー</h3>
        ${'Notification' in window ? (() => {
          const enabled = !!localStorage.getItem('lms_notificationEnabled');
          const time = localStorage.getItem('lms_notificationTime') || '08:00';
          const permitted = Notification.permission === 'granted';
          if (enabled && permitted) {
            return `<p style="color:var(--success,#10b981)">リマインダーが設定されています（毎日 ${Components.escapeHtml(time)}）</p>
              <div class="form-group">
                <label>通知時刻</label>
                <input type="time" id="reminderTime" class="form-input" value="${Components.escapeHtml(time)}"
                  onchange="localStorage.setItem('lms_notificationTime',this.value);Components.showToast('時刻を更新しました','success')">
              </div>
              <button class="btn btn-secondary" onclick="app.disableDailyReminder()">リマインダーをオフにする</button>`;
          } else {
            return `<p>毎日決まった時間にアプリを開くよう通知します。<br>まず、通知の許可が必要です。</p>
              <div class="form-group">
                <label>通知時刻</label>
                <input type="time" id="reminderTime" class="form-input" value="08:00">
              </div>
              <button class="btn btn-primary" onclick="app.enableDailyReminder(document.getElementById('reminderTime')?.value)">リマインダーをオンにする</button>`;
          }
        })() : '<p style="color:#94a3b8">このブラウザは通知に対応していません。</p>'}
      </div>

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
        <input type="text" id="resumeName" class="form-input" value="${Components.escapeHtml(r.name || '')}" placeholder="山田花子">
      </div>
      <div class="form-group">
        <label>職務要約・自己PR</label>
        <textarea id="resumeSummary" class="form-input" rows="4" placeholder="これまでのご経験や強みを自由にお書きください">${Components.escapeHtml(r.summary || '')}</textarea>
      </div>
      <div class="form-group">
        <label>スキル・資格（カンマ区切り）</label>
        <input type="text" id="resumeSkills" class="form-input" value="${Components.escapeHtml((r.skills || []).join(', '))}" placeholder="例：看護師免許, 英検2級, Excel">
      </div>
      <div class="form-group">
        <label>職務経歴</label>
        <textarea id="resumeHistory" class="form-input" rows="4" placeholder="会社名、期間、役職、内容をお書きください">${Components.escapeHtml(r.history || '')}</textarea>
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

  // ─── Pain Location Selector (health symptoms only) ───
  renderPainLocationSelector() {
    const parts = [
      { id: 'head',        label: '頭' },
      { id: 'neck',        label: '首・肩' },
      { id: 'chest',       label: '胸' },
      { id: 'stomach',     label: 'お腹' },
      { id: 'back_upper',  label: '背中（上）' },
      { id: 'back_lower',  label: '腰' },
      { id: 'arm_right',   label: '右腕・手' },
      { id: 'arm_left',    label: '左腕・手' },
      { id: 'leg_right',   label: '右脚・足' },
      { id: 'leg_left',    label: '左脚・足' },
      { id: 'knee_right',  label: '右ひざ' },
      { id: 'knee_left',   label: '左ひざ' }
    ];

    return `<div class="pain-location-selector" id="painLocationSelector">
      <label>体のどこが痛みますか？（複数選択可）</label>
      <div class="pain-parts-grid">
        ${parts.map(p => `<button type="button" class="pain-part-btn" data-label="${p.label}"
          onclick="this.classList.toggle('selected')">${p.label}</button>`).join('')}
      </div>
    </div>`;
  },

  // ─── SOS Emergency Widget (health domain only) ───
  renderSOSWidget() {
    const profile = store.get('userProfile') || {};
    const name = profile.emergencyContact;
    const phone = profile.emergencyPhone;

    if (!name && !phone) {
      return `<div class="sos-setup-prompt">
        <span class="sos-setup-icon">🆘</span>
        <div class="sos-setup-text">
          緊急連絡先を登録しておくと、体調が急変したとき素早く連絡できます
        </div>
        <button class="btn btn-sm btn-secondary" onclick="app.navigate('settings')">登録する</button>
      </div>`;
    }

    const smsText = encodeURIComponent(`【緊急】LMSから自動送信: ${name || ''}さん、体調が悪化しています。連絡をください。`);
    return `<div class="sos-widget">
      <div class="sos-info">
        <span class="sos-label">緊急連絡先</span>
        <span class="sos-name">${Components.escapeHtml(name || '')}
          ${phone ? `<a href="tel:${Components.escapeHtml(phone)}" class="sos-phone">${Components.escapeHtml(phone)}</a>` : ''}
        </span>
      </div>
      <div class="sos-actions">
        ${phone ? `<a href="tel:${Components.escapeHtml(phone)}" class="btn sos-call-btn">📞 緊急電話</a>` : ''}
        ${phone ? `<a href="sms:${Components.escapeHtml(phone)}?body=${smsText}" class="btn sos-sms-btn">💬 緊急SMS</a>` : ''}
      </div>
    </div>`;
  },

  // ─── Medication reminder (health domain only) ───
  renderMedicationReminder() {
    const meds = store.get('health_medications') || [];
    if (meds.length === 0) return '';

    const today = new Date().toISOString().split('T')[0];
    // Check if any medication entry was logged today with medications_taken flag
    const takenToday = (store.get('health_symptoms') || []).some(
      e => e.medications_taken && e.timestamp?.startsWith(today)
    );

    if (takenToday) {
      return `<div class="med-reminder med-done">
        <span class="med-check">✓</span>
        <span>今日の薬の記録 完了</span>
      </div>`;
    }

    // List unique medication names (most recent entry per name)
    const latestByName = new Map();
    [...meds].reverse().forEach(m => {
      if (m.name && !latestByName.has(m.name)) latestByName.set(m.name, m);
    });
    const medNames = [...latestByName.keys()].slice(0, 5);

    const hour = new Date().getHours();
    const timeLabel = hour < 10 ? '朝の' : hour < 14 ? '昼の' : hour < 19 ? '夕方の' : '夜の';

    return `<div class="med-reminder">
      <div class="med-reminder-header">
        <span class="med-icon">💊</span>
        <strong>${timeLabel}お薬は飲みましたか？</strong>
      </div>
      <div class="med-list">
        ${medNames.map(n => `<span class="med-tag">${Components.escapeHtml(n)}</span>`).join('')}
        ${latestByName.size > 5 ? `<span class="med-tag">…他${latestByName.size - 5}件</span>` : ''}
      </div>
      <button class="btn btn-sm btn-primary" onclick="app.logMedicationTaken()">飲みました ✓</button>
    </div>`;
  },

  // ─── Today's Priorities (cross-domain actionable items) ───
  renderTodayPriorities(domain) {
    const items = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Medication not taken yet
    const meds = store.get('health_medications') || [];
    if (meds.length > 0) {
      const takenToday = (store.getDomainData('health', 'symptoms', 1) || [])
        .some(e => e.timestamp?.startsWith(today) && e.medications_taken);
      if (!takenToday) {
        items.push({ icon: '💊', text: '薬を飲みましたか？', action: `app.logMedicationTaken()`, domain: 'health', urgent: true });
      }
    }

    // 2. Overdue relationship contacts (top 1)
    if (typeof RelationshipFeatures !== 'undefined') {
      const rel = RelationshipFeatures.calculateIsolationScore();
      const top = rel.details?.filter(d => d.overdue)?.[0];
      if (top) {
        const daysText = top.daysSince > 999 ? '長い間' : `${top.daysSince}日間`;
        items.push({ icon: '📞', text: `${Components.escapeHtml(top.name)}さんに${daysText}連絡できていません`, action: `app.switchDomain('relationship')`, domain: 'relationship', urgent: top.urgency >= 5 });
      }
    }

    // 3. No record today in current domain
    const cats = Object.keys(CONFIG.domains[domain]?.categories || {});
    const hasRecord = cats.some(cat =>
      store.getDomainData(domain, cat, 1).some(e => e.timestamp?.startsWith(today))
    );
    if (!hasRecord && cats.length > 0) {
      const domainName = i18n.t(domain);
      items.push({ icon: CONFIG.domains[domain]?.icon || '●', text: `今日の${domainName}の記録がまだありません`, action: `app.navigate('record')`, domain, urgent: false });
    }

    // 4. Low domain score warning
    const score = store.get('domainScores')?.[domain] || 50;
    if (score < 35) {
      items.push({ icon: '⚠️', text: `${i18n.t(domain)}スコアが低下しています（${score}/100）。分析を実行してみましょう`, action: `app.navigate('actions')`, domain, urgent: true });
    }

    if (items.length === 0) return '';

    return `<div class="today-priorities" id="todayPriorities">
      <div class="tp-header">
        <span class="tp-title">📋 今日のアクション</span>
        <button class="tp-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
      </div>
      <div class="tp-items">
        ${items.slice(0, 3).map(item => `
          <button class="tp-item ${item.urgent ? 'tp-urgent' : ''}" onclick="${item.action}">
            <span class="tp-icon">${item.icon}</span>
            <span class="tp-text">${item.text}</span>
            <span class="tp-arrow">›</span>
          </button>
        `).join('')}
      </div>
    </div>`;
  },

  // ─── Getting Started (shown to new users until 3 steps complete) ───
  renderGettingStarted(domain) {
    if (localStorage.getItem('lms_gettingStartedDone')) return '';

    const profile = store.get('userProfile') || {};
    const hasProfile = !!(profile.displayName || profile.name);

    let anyEntry = false;
    Object.keys(CONFIG.domains).forEach(d => {
      Object.keys(CONFIG.domains[d]?.categories || {}).forEach(cat => {
        if (store.getDomainData(d, cat, 365).length > 0) anyEntry = true;
      });
    });

    const hasAnalysis = !!(store.get('latestAnalysis') || (store.get('recommendations') || []).length > 0);

    const steps = [
      { label: 'プロフィールを設定する', done: hasProfile, action: `app.navigate('settings')` },
      { label: '今日の記録を入力する', done: anyEntry, action: `app.navigate('record')` },
      { label: '分析を実行してみる', done: hasAnalysis, action: `app.navigate('actions')` }
    ];

    const allDone = steps.every(s => s.done);
    if (allDone) {
      localStorage.setItem('lms_gettingStartedDone', '1');
      return '';
    }

    const completedCount = steps.filter(s => s.done).length;

    return `<div class="getting-started-card">
      <div class="gs-title">はじめの3ステップ（${completedCount}/3 完了）</div>
      <div class="gs-sub">完了すると、あなたに合ったアドバイスが届くようになります。</div>
      <div class="gs-steps">
        ${steps.map((s, i) => `
          <div class="gs-step ${s.done ? 'done' : ''}" onclick="${s.done ? '' : s.action}">
            <div class="gs-step-num">${s.done ? '✓' : i + 1}</div>
            <div class="gs-step-text">${Components.escapeHtml(s.label)}</div>
            ${s.done ? '' : '<span style="color:var(--accent)">→</span>'}
          </div>
        `).join('')}
      </div>
      <div class="gs-dismiss" onclick="localStorage.setItem('lms_gettingStartedDone','1');this.closest('.getting-started-card').remove()">表示しない</div>
    </div>`;
  },

  // ─── Daily check-in nudge ───
  renderCheckinNudge(domain) {
    const domainConfig = CONFIG.domains[domain];
    const categories = Object.keys(domainConfig?.categories || {});

    // Compute a Set of all date strings (YYYY-MM-DD) that have at least one entry
    const datesWithEntry = new Set();
    const today = new Date().toISOString().split('T')[0];
    let todayCount = 0;
    categories.forEach(cat => {
      store.getDomainData(domain, cat, 90).forEach(entry => {
        if (!entry.timestamp) return;
        const d = entry.timestamp.split('T')[0];
        datesWithEntry.add(d);
        if (d === today) todayCount++;
      });
    });

    // Count consecutive days ending today (or yesterday if today not done yet)
    let streak = 0;
    const check = new Date();
    if (!datesWithEntry.has(today)) check.setDate(check.getDate() - 1);
    while (true) {
      const key = check.toISOString().split('T')[0];
      if (!datesWithEntry.has(key)) break;
      streak++;
      check.setDate(check.getDate() - 1);
      if (streak > 90) break;
    }

    const streakBadge = streak >= 2
      ? `<span class="streak-badge">${streak}日連続</span>`
      : '';

    if (todayCount > 0) {
      return `<div class="checkin-done">
        <span class="checkin-check">✓</span>
        <span>今日の記録 ${todayCount}件完了${streak >= 2 ? '　' : ''}</span>
        ${streakBadge}
      </div>`;
    }
    if (domain === 'health') {
      return `<div class="checkin-nudge checkin-nudge-health">
        <div class="checkin-nudge-top">
          <span class="checkin-nudge-text">今日の体調は？${streak >= 2 ? '　' : ''}</span>
          ${streakBadge}
        </div>
        <div class="mood-picker">
          ${[['😢','1','とても辛い'],['😕','3','少し辛い'],['😐','5','普通'],['🙂','7','良い'],['😄','9','とても良い']].map(([emoji, val, label]) =>
            `<button class="mood-btn" title="${Components.escapeHtml(label)}" onclick="app.quickMoodCheckin(${val})" aria-label="${Components.escapeHtml(label)}">
              <span class="mood-emoji">${emoji}</span>
              <span class="mood-label">${Components.escapeHtml(label)}</span>
            </button>`
          ).join('')}
        </div>
      </div>`;
    }
    const quickBtn = `<button class="btn btn-sm btn-primary" onclick="app.navigate('record')">記録する</button>`;
    return `<div class="checkin-nudge">
      <span class="checkin-nudge-text">今日はまだ記録していません${streak >= 2 ? '　' : ''}</span>
      <span style="display:flex;align-items:center;gap:8px;">
        ${streakBadge}
        ${quickBtn}
      </span>
    </div>`;
  },

  // ─── Daily Prompt (rotating question to encourage reflection) ───
  renderDailyPrompt(domain) {
    const prompts = (CONFIG.dailyPrompts || {})[domain];
    if (!prompts || prompts.length === 0) return '';

    // Pick question based on day-of-year so it rotates but is stable within a day
    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const q = prompts[doy % prompts.length];

    return `<div class="daily-prompt-card">
      <div class="dp-label">今日の問いかけ</div>
      <div class="dp-question">${Components.escapeHtml(q)}</div>
      <button class="btn btn-sm btn-primary dp-btn" onclick="app.replyToPrompt('${Components.escapeHtml(q).replace(/'/g, '&#39;')}')">答える</button>
    </div>`;
  },

  // ─── Weekly Summary (shown once per week, first login of each week) ───
  renderWeeklySummary() {
    const today = new Date();
    const weekKey = `${today.getFullYear()}-W${this._weekNumber(today)}`;
    const dismissed = localStorage.getItem('lms_weeklySummaryDismissed');
    if (dismissed === weekKey) return '';
    // Only show if there was data last week (avoid showing every login for new users)
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek >= 6) return ''; // skip weekends (low context)

    // Gather last 7 days counts per domain
    const domainKeys = Object.keys(CONFIG.domains);
    const rows = domainKeys.map(d => {
      const cats = Object.keys(CONFIG.domains[d]?.categories || {});
      let count = 0;
      cats.forEach(cat => { count += store.getDomainData(d, cat, 7).length; });
      const color = CONFIG.domains[d]?.color || '#6C63FF';
      const icon = CONFIG.domains[d]?.icon || '';
      return { d, icon, count, color };
    });

    const totalRecords = rows.reduce((s, r) => s + r.count, 0);
    if (totalRecords === 0) return '';

    const topDomain = rows.reduce((a, b) => b.count > a.count ? b : a);

    return `<div class="weekly-summary-card" id="weeklySummaryCard">
      <div class="ws-header">
        <span class="ws-title">先週の記録まとめ</span>
        <button class="ws-close" onclick="Pages.dismissWeeklySummary('${weekKey}')">&times;</button>
      </div>
      <div class="ws-total">合計 <strong>${totalRecords}</strong> 件の記録</div>
      <div class="ws-domains">
        ${rows.map(r => r.count > 0 ? `
          <div class="ws-domain-bar">
            <span class="ws-domain-label">${r.icon} ${i18n.t(r.d)}</span>
            <div class="ws-bar-track">
              <div class="ws-bar-fill" style="width:${Math.min(100, r.count * 10)}%;background:${r.color}"></div>
            </div>
            <span class="ws-domain-count">${r.count}</span>
          </div>
        ` : '').join('')}
      </div>
      <div class="ws-highlight">
        一番記録が多かった領域: <strong>${topDomain.icon} ${i18n.t(topDomain.d)}</strong>（${topDomain.count}件）
      </div>
    </div>`;
  },

  dismissWeeklySummary(weekKey) {
    localStorage.setItem('lms_weeklySummaryDismissed', weekKey);
    const card = document.getElementById('weeklySummaryCard');
    if (card) card.remove();
  },

  _weekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  },

  // ─── Profile completion progress bar ───
  renderProfileCompletion(profile) {
    const p = profile || {};
    const keyFields = ['displayName', 'age', 'gender', 'location', 'diseases', 'lifeGoals', 'concerns', 'emergencyContact'];
    const filled = keyFields.filter(k => {
      const v = p[k];
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    }).length;
    const pct = Math.round((filled / keyFields.length) * 100);
    if (pct >= 100) return '';
    return `<div class="profile-completion">
      <div class="pc-header">
        <span>プロフィール完成度</span>
        <span class="pc-pct">${pct}%</span>
      </div>
      <div class="pc-bar"><div class="pc-fill" style="width:${pct}%"></div></div>
      ${pct < 60 ? '<p class="pc-hint">プロフィールを充実させると、より的確なアドバイスが届きます</p>' : ''}
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════
  //  TREND CHART (14日間のトレンド)
  // ═══════════════════════════════════════════════════════════

  renderTrendChartContainer(domain) {
    const categories = Object.keys(CONFIG.domains[domain]?.categories || {});
    let totalEntries = 0;
    categories.forEach(cat => { totalEntries += store.getDomainData(domain, cat, 30).length; });
    if (totalEntries < 3) return '';

    const label = domain === 'health' ? '体調スコア（10段階）' : '記録件数';
    return `<div class="trend-chart-card">
      <h3>14日間のトレンド</h3>
      <p style="color:var(--text-secondary);font-size:0.87rem;margin-bottom:12px;">${label}</p>
      <canvas id="domainTrendChart" height="120"></canvas>
    </div>`;
  },

  initTrendChart(domain) {
    const canvas = document.getElementById('domainTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const color = CONFIG.domains[domain]?.color || '#6C63FF';
    const categories = Object.keys(CONFIG.domains[domain]?.categories || {});

    // Build 14-day label/data arrays
    const days = 14;
    const labels = [];
    const values = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

      if (domain === 'health') {
        const dayEntries = store.getDomainData('health', 'symptoms', days + 1)
          .filter(e => e.timestamp?.startsWith(dateKey));
        const levels = dayEntries.map(e => e.condition_level).filter(v => v != null);
        values.push(levels.length > 0 ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length * 10) / 10 : null);
      } else {
        let count = 0;
        categories.forEach(cat => {
          count += store.getDomainData(domain, cat, days + 1)
            .filter(e => e.timestamp?.startsWith(dateKey)).length;
        });
        values.push(count || null);
      }
    }

    // Destroy previous chart if exists
    if (canvas._chart) { canvas._chart.destroy(); }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';

    canvas._chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: color + '99',
          borderColor: color,
          borderWidth: 1,
          borderRadius: 4,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
          y: {
            min: 0,
            max: domain === 'health' ? 10 : undefined,
            ticks: { font: { size: 10 }, stepSize: domain === 'health' ? 2 : 1, color: tickColor },
            grid: { color: gridColor }
          }
        }
      }
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  DOCTOR VISIT REPORT (健康 → かかりつけ医へのレポート)
  // ═══════════════════════════════════════════════════════════
  renderDoctorReport() {
    const profile = store.get('userProfile') || {};
    const today = new Date();
    const since30 = new Date(today); since30.setDate(today.getDate() - 30);

    const symptoms   = store.getDomainData('health', 'symptoms', 30);
    const vitals     = store.getDomainData('health', 'vitals', 30);
    const meds       = store.getDomainData('health', 'medications', 30);
    const bloodTests = store.getDomainData('health', 'bloodTests', 30);
    const sleep      = store.getDomainData('health', 'sleepData', 30);
    const activity   = store.getDomainData('health', 'activityData', 30);

    // Averages
    const avgCondition = symptoms.length
      ? (symptoms.reduce((s,e) => s + (e.condition_level||0), 0) / symptoms.length).toFixed(1) : '-';
    const avgFatigue = symptoms.length
      ? (symptoms.reduce((s,e) => s + (e.fatigue_level||0), 0) / symptoms.length).toFixed(1) : '-';
    const avgBP_s = vitals.filter(v=>v.bp_systolic).length
      ? Math.round(vitals.filter(v=>v.bp_systolic).reduce((s,v)=>s+(v.bp_systolic||0),0)/vitals.filter(v=>v.bp_systolic).length) : '-';
    const avgBP_d = vitals.filter(v=>v.bp_diastolic).length
      ? Math.round(vitals.filter(v=>v.bp_diastolic).reduce((s,v)=>s+(v.bp_diastolic||0),0)/vitals.filter(v=>v.bp_diastolic).length) : '-';
    const avgSleep = sleep.length
      ? (sleep.reduce((s,e)=>s+(e.quality||0),0)/sleep.length).toFixed(1) : '-';

    // Most recent vitals
    const latestVital = vitals.length ? vitals[vitals.length - 1] : null;

    // Medications (unique by name)
    const uniqueMeds = [...new Map((meds).map(m => [m.name, m])).values()];

    // Notable symptoms (notes with content)
    const notedSymptoms = symptoms.filter(s => s.notes && s.notes.trim()).slice(-5).reverse();

    const dateStr = today.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' });

    return `<div class="doctor-report" id="doctorReport">
      <div class="dr-actions no-print">
        <button class="btn btn-secondary" onclick="app.navigate('home')">← 戻る</button>
        <button class="btn btn-primary" onclick="window.print()">🖨️ 印刷する</button>
      </div>

      <div class="dr-header">
        <h1>受診準備レポート</h1>
        <div class="dr-meta">
          <div>患者名：<strong>${Components.escapeHtml(profile.displayName || profile.name || '（未登録）')}</strong></div>
          <div>年齢：<strong>${profile.age ? profile.age + '歳' : '（未登録）'}</strong></div>
          <div>作成日：<strong>${dateStr}</strong></div>
          <div class="dr-period">直近30日間のデータ（${since30.toLocaleDateString('ja-JP')}〜${today.toLocaleDateString('ja-JP')}）</div>
        </div>
      </div>

      <div class="dr-section">
        <h2>1. 体調の概要</h2>
        <div class="dr-stats-row">
          <div class="dr-stat"><div class="dr-stat-val">${avgCondition}/10</div><div class="dr-stat-label">平均体調</div></div>
          <div class="dr-stat"><div class="dr-stat-val">${avgFatigue}/10</div><div class="dr-stat-label">平均疲労感</div></div>
          <div class="dr-stat"><div class="dr-stat-val">${avgBP_s}/${avgBP_d}</div><div class="dr-stat-label">平均血圧<br>(mmHg)</div></div>
          <div class="dr-stat"><div class="dr-stat-val">${avgSleep}/10</div><div class="dr-stat-label">睡眠の質</div></div>
        </div>
      </div>

      ${latestVital ? `
      <div class="dr-section">
        <h2>2. 最新バイタル（${new Date(latestVital.timestamp).toLocaleDateString('ja-JP')}）</h2>
        <table class="dr-table">
          <thead><tr><th>項目</th><th>値</th></tr></thead>
          <tbody>
            ${latestVital.heart_rate ? `<tr><td>脈拍</td><td>${latestVital.heart_rate} bpm</td></tr>` : ''}
            ${latestVital.bp_systolic ? `<tr><td>血圧</td><td>${latestVital.bp_systolic}/${latestVital.bp_diastolic} mmHg</td></tr>` : ''}
            ${latestVital.temperature ? `<tr><td>体温</td><td>${latestVital.temperature} °C</td></tr>` : ''}
            ${latestVital.weight ? `<tr><td>体重</td><td>${latestVital.weight} kg</td></tr>` : ''}
          </tbody>
        </table>
      </div>` : ''}

      ${uniqueMeds.length > 0 ? `
      <div class="dr-section">
        <h2>3. 現在の服薬・サプリメント</h2>
        <table class="dr-table">
          <thead><tr><th>薬品名</th><th>用量</th><th>服用タイミング</th><th>備考</th></tr></thead>
          <tbody>
            ${uniqueMeds.map(m => `<tr>
              <td>${Components.escapeHtml(m.name || '')}</td>
              <td>${Components.escapeHtml(m.dosage || '')}</td>
              <td>${Components.escapeHtml(m.timing || '')}</td>
              <td>${Components.escapeHtml(m.notes || '')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${bloodTests.length > 0 ? `
      <div class="dr-section">
        <h2>4. 検査値の記録</h2>
        <table class="dr-table">
          <thead><tr><th>日付</th><th>検査項目</th><th>値</th><th>単位</th><th>基準値</th></tr></thead>
          <tbody>
            ${bloodTests.slice(-10).reverse().map(t => `<tr>
              <td>${new Date(t.timestamp).toLocaleDateString('ja-JP')}</td>
              <td>${Components.escapeHtml(t.test_name || '')}</td>
              <td>${Components.escapeHtml(String(t.value || ''))}</td>
              <td>${Components.escapeHtml(t.unit || '')}</td>
              <td>${Components.escapeHtml(t.reference || '')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${(() => {
        const painEntries = symptoms.filter(s => s.pain_location).slice(-5).reverse();
        const noted = symptoms.filter(s => s.notes && s.notes.trim()).slice(-5).reverse();
        if (painEntries.length === 0 && noted.length === 0) return '';
        return `<div class="dr-section">
          <h2>5. 気になった症状・メモ</h2>
          <div class="dr-notes">
            ${painEntries.map(s => `<div class="dr-note-item">
              <div class="dr-note-date">${new Date(s.timestamp).toLocaleDateString('ja-JP')}</div>
              <div class="dr-note-text">🗺️ 痛む場所：${Components.escapeHtml(String(s.pain_location || ''))}</div>
            </div>`).join('')}
            ${noted.map(s => `<div class="dr-note-item">
              <div class="dr-note-date">${new Date(s.timestamp).toLocaleDateString('ja-JP')}</div>
              <div class="dr-note-text">${Components.escapeHtml(s.notes || '')}</div>
            </div>`).join('')}
          </div>
        </div>`;
      })()}

      <div class="dr-section">
        <h2>${uniqueMeds.length > 0 ? '6' : notedSymptoms.length > 0 ? '6' : '3'}. 生活習慣の概要（直近30日）</h2>
        <div class="dr-stats-row">
          <div class="dr-stat"><div class="dr-stat-val">${symptoms.length}</div><div class="dr-stat-label">体調記録日数</div></div>
          <div class="dr-stat"><div class="dr-stat-val">${sleep.length}</div><div class="dr-stat-label">睡眠記録日数</div></div>
          <div class="dr-stat"><div class="dr-stat-val">${activity.length}</div><div class="dr-stat-label">運動記録日数</div></div>
        </div>
      </div>

      <div class="dr-footer no-print">
        <button class="btn btn-primary btn-lg" onclick="window.print()">🖨️ 印刷する</button>
        <button class="btn btn-secondary" onclick="app.navigate('home')">ホームに戻る</button>
      </div>

      <div class="dr-disclaimer">
        このレポートはLMSアプリに記録されたデータを元に自動生成されました。
        医療診断ではありません。必ず医師にご相談ください。
      </div>
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
                value="${Components.escapeHtml(filter.search || '')}"
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
              <span class="data-entry-cat">${Components.escapeHtml(catLabel)}</span>
              <span class="data-entry-time">${new Date(entry.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
              <div class="data-entry-actions">
                <button class="btn-icon-sm" onclick="app.editDataEntry('${Components.escapeHtml(domain)}','${Components.escapeHtml(entry._category)}','${Components.escapeHtml(entry.id)}')" title="編集">編集</button>
                <button class="btn-icon-sm" onclick="app.deleteDataEntry('${Components.escapeHtml(domain)}','${Components.escapeHtml(entry._category)}','${Components.escapeHtml(entry.id)}')" title="削除">削除</button>
              </div>
            </div>
            <div class="data-entry-fields">
              ${fields.map(([k, v]) => {
                const label = Components.escapeHtml(i18n.t(k) || k);
                const raw = typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 100);
                return `<div class="data-field"><span class="data-field-key">${label}</span><span class="data-field-val">${Components.escapeHtml(raw)}</span></div>`;
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
    const outlookConnected = typeof outlookCalendar !== 'undefined' && outlookCalendar.isConnected();
    const gmailConnected = typeof gmailIntegration !== 'undefined' && gmailIntegration.isConnected();

    // Check if admin has configured OAuth client IDs - if so, users see
    // a one-click "Connect" button without needing to paste their own.
    const oauthIds = (CONFIG && CONFIG.oauthClientIds) || {};
    const googleReady = !!oauthIds.google;
    const microsoftReady = !!oauthIds.microsoft;
    const fitbitReady = !!oauthIds.fitbit;

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
          ` : googleReady ? `
          <p>ボタン1つで接続できます。Googleのログイン画面で許可してください。</p>
          <button class="btn btn-primary btn-lg" onclick="app.gcalConnectOneClick()">Googleカレンダーに接続する</button>
          ` : `
          <div class="integration-note">
            接続機能を有効にするには、管理者が一度だけOAuth設定を行う必要があります。
            管理者にご連絡いただくか、下記のICSファイル取込をご利用ください。
          </div>
          `}

          <hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">

          <div class="integration-steps">
            <h4>ICSファイルから取り込み</h4>
            <p style="font-size:0.87rem;color:var(--text-secondary);">カレンダーアプリの設定から.icsファイルをエクスポートして取り込めます。</p>
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
          ` : fitbitReady ? `
          <p>ボタン1つで接続できます。Fitbit のログイン画面で許可してください。</p>
          <button class="btn btn-primary btn-lg" onclick="app.fitbitConnectOneClick()">Fitbitに接続する</button>
          ` : `
          <div class="integration-note">
            接続機能を有効にするには、管理者が一度だけOAuth設定を行う必要があります。
            管理者にご連絡ください。
          </div>
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

      <!-- Outlook カレンダー -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Outlook カレンダー</h3>
          <span class="status-badge ${outlookConnected ? 'connected' : ''}">${outlookConnected ? '接続済み' : '未接続'}</span>
        </div>
        <div class="card-body">
          <p>Microsoft Outlook / Office 365 の予定を取り込みます。</p>
          ${outlookConnected ? `
          <div class="form-actions">
            <button class="btn btn-primary" onclick="app.outlookSync()">今すぐ同期する</button>
            <button class="btn btn-sm btn-secondary" onclick="app.outlookDisconnect()">接続解除</button>
          </div>
          ` : microsoftReady ? `
          <p>ボタン1つで接続できます。Microsoftのログイン画面で許可してください。</p>
          <button class="btn btn-primary btn-lg" onclick="app.outlookConnectOneClick()">Outlookに接続する</button>
          ` : `
          <div class="integration-note">
            接続機能を有効にするには、管理者が一度だけOAuth設定を行う必要があります。
            管理者にご連絡ください。
          </div>
          `}
        </div>
      </div>

      <!-- Apple Watch -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Apple Watch</h3>
        </div>
        <div class="card-body">
          <p>Apple Watchのデータは、iPhoneの「ヘルスケア」アプリ経由で取り込めます（上記 Apple Health と同じ方法）。</p>
          <div class="integration-steps">
            <h4>取り込み手順</h4>
            <ol>
              <li>Apple Watchのデータは iPhone の「ヘルスケア」アプリに自動で集約されます</li>
              <li>上の「Apple Health」セクションの手順でエクスポート</li>
              <li>心拍・活動・睡眠・転倒検知などのデータが自動取り込みされます</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Garmin -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Garmin</h3>
        </div>
        <div class="card-body">
          <p>Garmin Connect のデータをエクスポートして取り込めます。</p>
          <div class="integration-steps">
            <h4>取り込み方法</h4>
            <ol>
              <li><a href="https://www.garmin.com/ja-JP/account/datamanagement/" target="_blank">Garmin Connect データ管理</a>を開く</li>
              <li>「データのエクスポート」からCSVまたはFITファイルをダウンロード</li>
              <li>下のボタンでファイルを選択</li>
            </ol>
          </div>
          <input type="file" id="garminFile" accept=".csv,.fit,.tcx,.gpx" style="display:none" onchange="app.importGarmin(event)">
          <button class="btn btn-primary" onclick="document.getElementById('garminFile').click()">Garminファイルを選択</button>
        </div>
      </div>

      <!-- Oura Ring -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Oura Ring</h3>
        </div>
        <div class="card-body">
          <p>Oura Ring の睡眠・レディネス・アクティビティデータを取り込めます。</p>
          <div class="integration-steps">
            <h4>取り込み方法</h4>
            <ol>
              <li>Ouraアプリ → 設定 → データエクスポート</li>
              <li>CSVファイルをダウンロード</li>
              <li>下のボタンでファイルを選択</li>
            </ol>
          </div>
          <input type="file" id="ouraFile" accept=".csv" style="display:none" onchange="app.importOura(event)">
          <button class="btn btn-primary" onclick="document.getElementById('ouraFile').click()">Ouraファイルを選択</button>
        </div>
      </div>

      <!-- Whoop -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Whoop</h3>
        </div>
        <div class="card-body">
          <p>Whoop のストレイン・リカバリー・睡眠データを取り込めます。</p>
          <div class="integration-steps">
            <h4>取り込み方法</h4>
            <ol>
              <li>Whoop アプリ → Profile → Export Data</li>
              <li>CSVファイルをダウンロード</li>
              <li>下のボタンでファイルを選択</li>
            </ol>
          </div>
          <input type="file" id="whoopFile" accept=".csv" style="display:none" onchange="app.importWhoop(event)">
          <button class="btn btn-primary" onclick="document.getElementById('whoopFile').click()">Whoopファイルを選択</button>
        </div>
      </div>

      <!-- Withings Health Mate -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Withings Health Mate</h3>
        </div>
        <div class="card-body">
          <p>Withings の体重計・活動量計・睡眠マットからデータを取り込めます。</p>
          <div class="integration-steps">
            <h4>取り込み方法（CSV）</h4>
            <ol>
              <li>Health Mate アプリ → プロフィール → 設定 → 「データのダウンロード」</li>
              <li>CSVファイルをダウンロード（体重・活動・睡眠・心拍の各ファイル）</li>
              <li>下のボタンでそれぞれ選択して取り込み</li>
            </ol>
          </div>
          <input type="file" id="withingsFile" accept=".csv" style="display:none" onchange="app.importWithingsCSV(event)">
          <button class="btn btn-primary" onclick="document.getElementById('withingsFile').click()">Withingsファイルを選択</button>
          <p class="integration-note">※ OAuth接続はWithings側の仕様でサーバーが必要なため、CSV取込を推奨しています。</p>
        </div>
      </div>

      <!-- Muse Headband -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Muse Headband（瞑想センサー）</h3>
        </div>
        <div class="card-body">
          <p>Muse Headband の瞑想セッションデータ（落ち着き度・継続時間）を意識ドメインに取り込みます。</p>
          <div class="integration-steps">
            <h4>取り込み方法</h4>
            <ol>
              <li>Muse アプリ → 設定 → データエクスポート</li>
              <li>セッション履歴をCSVで書き出し</li>
              <li>下のボタンでファイルを選択</li>
            </ol>
          </div>
          <input type="file" id="museFile" accept=".csv" style="display:none" onchange="app.importMuseCSV(event)">
          <button class="btn btn-primary" onclick="document.getElementById('museFile').click()">Museファイルを選択</button>
        </div>
      </div>

      <!-- Sony Reon Pocket -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Sony Reon Pocket</h3>
        </div>
        <div class="card-body">
          <p>Reon Pocket は現在データエクスポートに対応していないため、手動で使用記録を残せます。</p>
          <div class="integration-note">
            Sony からの公式データアクセスAPIが提供されれば自動連携を実装します。
            現状は「記録する」→「健康」→「活動」から手動で記録してください。
          </div>
        </div>
      </div>

      <!-- ZIP 一括取込 -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>ZIP一括取込（アーカイブファイル）</h3>
        </div>
        <div class="card-body">
          <p>Facebook、Instagram、Google Takeout、Discord などのアーカイブZIPをそのまま取り込めます。ZIP内のファイルが自動で各パーサーに振り分けられます。</p>
          <div class="integration-steps">
            <h4>対応しているアーカイブ</h4>
            <ul>
              <li><strong>Facebook</strong>: 個人データのダウンロードZIP</li>
              <li><strong>Instagram</strong>: データダウンロードZIP</li>
              <li><strong>Google Takeout</strong>: Contacts + Calendar を含むZIP</li>
              <li><strong>Discord</strong>: Request My Data ZIP</li>
              <li><strong>Telegram</strong>: Export Desktop ZIP</li>
              <li><strong>LinkedIn</strong>: Archive ZIP</li>
            </ul>
          </div>
          <input type="file" id="zipFile" accept=".zip" style="display:none" onchange="app.importZipFile(event)">
          <button class="btn btn-primary" onclick="document.getElementById('zipFile').click()">ZIPファイルを選択</button>
          <p class="integration-note">大きいZIP（500MB超）は処理に時間がかかる場合があります。画像・動画は自動でスキップします。</p>
        </div>
      </div>

      <!-- Gmail (連絡先抽出) -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>Gmail（連絡先の自動抽出）</h3>
          <span class="status-badge ${gmailConnected ? 'connected' : ''}">${gmailConnected ? '接続済み' : '未接続'}</span>
        </div>
        <div class="card-body">
          <p>Gmailから頻繁にやり取りしている人を自動で抽出し、連絡先に追加します。</p>
          ${gmailConnected ? `
          <div class="form-actions">
            <button class="btn btn-primary" onclick="app.gmailImportContacts()">連絡先を取り込む</button>
            <button class="btn btn-sm btn-secondary" onclick="app.gmailDisconnect()">接続解除</button>
          </div>
          ` : googleReady ? `
          <p>ボタン1つで接続できます。Googleのログイン画面で許可してください。</p>
          <button class="btn btn-primary btn-lg" onclick="app.gmailConnectOneClick()">Gmailに接続する</button>
          ` : `
          <div class="integration-note">
            接続機能を有効にするには、管理者が一度だけOAuth設定を行う必要があります。
            管理者にご連絡ください。
          </div>
          `}
        </div>
      </div>

      <!-- SNS 連絡先の取り込み (Facebook/Instagram/X/LinkedIn/WhatsApp/LINE/Telegram) -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>SNS連絡先の取り込み</h3>
        </div>
        <div class="card-body">
          <p>各SNSからダウンロードした友達リストや会話ログを取り込み、連絡先に追加します。</p>

          <div class="integration-steps">
            <h4>対応プラットフォーム（10種）</h4>
            <ol>
              <li><strong>Facebook</strong>: 設定 → プライバシー → 個人データのダウンロード → 「友達」→ JSON形式</li>
              <li><strong>Instagram</strong>: 設定 → アカウント → データのダウンロード → JSON形式</li>
              <li><strong>X (Twitter)</strong>: 設定 → アカウント → データのアーカイブをリクエスト</li>
              <li><strong>LinkedIn</strong>: Settings → Get a copy of your data → Connections → CSV</li>
              <li><strong>WhatsApp</strong>: トーク画面 → メニュー → その他 → チャットをエクスポート → メディアなし（.txt）</li>
              <li><strong>LINE</strong>: トーク画面 → メニュー → 設定 → トーク履歴を送信（.txt）</li>
              <li><strong>Telegram</strong>: Telegram Desktop → Settings → Advanced → Export Telegram data → JSON</li>
              <li><strong>WeChat (微信)</strong>: トーク長押し → チャットログをメールで送信（.txt）</li>
              <li><strong>Kakao (카카오톡)</strong>: トーク画面 → 設定 → トーク履歴をメールで送信（.txt）</li>
              <li><strong>Discord</strong>: User Settings → Privacy & Safety → Request My Data（.json）</li>
              <li>ダウンロードしたファイルを下のボタンで選択</li>
            </ol>
          </div>

          <input type="file" id="snsFile" accept=".json,.csv,.js,.txt" style="display:none" onchange="app.importSnsFile(event)">
          <button class="btn btn-primary" onclick="document.getElementById('snsFile').click()">SNSエクスポートファイルを選択</button>
          <p class="integration-note">ファイル名から自動的にどのSNSかを判別します。会話ログからは3回以上やり取りした相手のみを追加します。ZIPアーカイブは上のZIP一括取込で処理してください。</p>
        </div>
      </div>

      <!-- ファイル取り込み -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header">
          <h3>汎用ファイル取り込み</h3>
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

    const adminEmails = (store.get('adminEmails') || ['agewaller@gmail.com']);
    const userCount = store.get('_allUsersCount') || 0;

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
        <button class="admin-tab ${currentTab === 'users' ? 'active' : ''}" onclick="app.setAdminTab('users')">
          ユーザー管理<span class="tab-count">${adminEmails.length}</span>
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
    const isDirect = !CONFIG.endpoints.anthropic
      || CONFIG.endpoints.anthropic === 'direct'
      || CONFIG.endpoints.anthropic.includes('your-account');

    return `<div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3>APIキー設定</h3></div>
      <div class="card-body">
        <p class="page-desc">ここで設定したキーは、すべてのユーザーが利用します。</p>

        <div class="form-group">
          <label>接続モード</label>
          <div class="connection-mode">
            <span class="mode-badge ${isDirect ? 'mode-direct' : 'mode-proxy'}">
              ${isDirect ? '直接モード（プロキシ不要）' : 'プロキシ経由'}
            </span>
            ${isDirect
              ? '<div class="input-help">Anthropicに直接接続します。Cloudflare Workerは不要です。</div>'
              : '<div class="input-help">Cloudflare Worker経由で接続します。</div>'
            }
          </div>
          <div class="form-actions" style="margin-top:8px;">
            ${isDirect
              ? '<button class="btn btn-sm btn-secondary" onclick="app.useProxyMode()">プロキシ経由に戻す</button>'
              : '<button class="btn btn-sm btn-secondary" onclick="app.useDirectMode()">直接モードに切り替え</button>'
            }
          </div>
        </div>

        <div class="form-group">
          <label>APIプロキシURL ${isDirect ? '（直接モードでは未使用）' : '（必須）'}</label>
          <input type="text" id="workerUrl" class="form-input"
            value="${CONFIG.endpoints.anthropic}"
            placeholder="https://...workers.dev または direct"
            ${isDirect ? 'disabled' : ''}>
          <div class="input-help">CloudflareワーカーのURL、または「direct」で直接モード</div>
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
    </div>

    <!-- OAuth Client IDs (admin-shared: one-click user connections) -->
    <div class="card" style="margin-top:16px;">
      <div class="card-header">
        <h3>連携サービス OAuth Client ID</h3>
      </div>
      <div class="card-body">
        <p class="page-desc">
          ここで Client ID を設定すると、すべてのユーザーの連携ページで
          「接続する」ボタン<strong>1つ</strong>だけで各サービスに繋がるようになります。
          Client ID は公開可能な値です（シークレットではありません）。
        </p>

        <div class="form-group">
          <label>Google Client ID <span class="mode-badge ${CONFIG.oauthClientIds?.google ? 'mode-direct' : 'mode-proxy'}">${CONFIG.oauthClientIds?.google ? '設定済' : '未設定'}</span></label>
          <input type="text" id="oauthGoogle" class="form-input"
            value="${CONFIG.oauthClientIds?.google || ''}"
            placeholder="xxx.apps.googleusercontent.com">
          <div class="input-help">Google カレンダー + Gmail で共通利用</div>
        </div>

        <div class="form-group">
          <label>Microsoft Client ID <span class="mode-badge ${CONFIG.oauthClientIds?.microsoft ? 'mode-direct' : 'mode-proxy'}">${CONFIG.oauthClientIds?.microsoft ? '設定済' : '未設定'}</span></label>
          <input type="text" id="oauthMicrosoft" class="form-input"
            value="${CONFIG.oauthClientIds?.microsoft || ''}"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
          <div class="input-help">Outlook カレンダー用</div>
        </div>

        <div class="form-group">
          <label>Fitbit Client ID <span class="mode-badge ${CONFIG.oauthClientIds?.fitbit ? 'mode-direct' : 'mode-proxy'}">${CONFIG.oauthClientIds?.fitbit ? '設定済' : '未設定'}</span></label>
          <input type="text" id="oauthFitbit" class="form-input"
            value="${CONFIG.oauthClientIds?.fitbit || ''}"
            placeholder="XXXXXX">
          <div class="input-help">Fitbit 活動・睡眠データ用</div>
        </div>

        <div class="form-group">
          <label>Withings Client ID <span class="mode-badge ${CONFIG.oauthClientIds?.withings ? 'mode-direct' : 'mode-proxy'}">${CONFIG.oauthClientIds?.withings ? '設定済' : '未設定'}</span></label>
          <input type="text" id="oauthWithings" class="form-input"
            value="${CONFIG.oauthClientIds?.withings || ''}"
            placeholder="xxxxxxxxxx">
          <div class="input-help">Withings 体組成計・睡眠マット用（認証コードのみ取得）</div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" onclick="app.saveOAuthClientIds()">保存</button>
        </div>

        <div class="integration-note">
          設定方法は <a href="https://github.com/agewaller/lms/blob/main/SETUP.md" target="_blank">SETUP.md</a>
          の「Google OAuth」「Microsoft OAuth」「Fitbit OAuth」セクションをご参照ください。
        </div>
      </div>
    </div>`;
  },

  // ─── Admin Tab: ユーザー管理 (未病ダイアリー準拠) ───
  renderAdminTab_users() {
    const currentUser = store.get('user');
    const adminEmails = store.get('adminEmails') || ['agewaller@gmail.com'];
    const allUsers = store.get('_allUsers') || [];

    return `<div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <h3>管理者（${adminEmails.length}）</h3>
        <button class="btn btn-sm btn-primary" onclick="app.addAdminEmail()">管理者を追加</button>
      </div>
      <div class="card-body">
        <p class="page-desc">管理者権限を持つユーザーのリストです。管理者はAIモデル・プロンプト・APIキーを変更できます。</p>
        <div class="admin-users-list">
          ${adminEmails.map(email => {
            const isOwner = email === 'agewaller@gmail.com';
            const isSelf = currentUser?.email === email;
            return `<div class="admin-user-item">
              <div class="admin-user-info">
                <div class="admin-user-avatar">${email.charAt(0).toUpperCase()}</div>
                <div>
                  <div class="admin-user-email">${Components.escapeHtml(email)}${isSelf ? ' <span class="you-badge">あなた</span>' : ''}</div>
                  <div class="admin-user-role">${isOwner ? 'オーナー（削除不可）' : '管理者'}</div>
                </div>
              </div>
              ${isOwner ? '<span class="status-badge">オーナー</span>' : `
                <button class="btn btn-sm btn-danger" data-email="${Components.escapeHtml(email)}" onclick="app.removeAdminEmail(this.dataset.email)">削除</button>
              `}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>登録ユーザー一覧${allUsers.length > 0 ? `（${allUsers.length}名）` : ''}</h3>
        <button class="btn btn-sm btn-secondary" onclick="app.loadAllUsers()">更新</button>
      </div>
      <div class="card-body">
        <p class="page-desc">タップすると詳細情報（プロフィール・疾患・資産・目標）が見られます。</p>

        ${allUsers.length === 0 ? `
          <p style="color:var(--text-muted);font-size:0.87rem;">ユーザー一覧を読み込むには「更新」ボタンを押してください。</p>
        ` : this.renderUserListWithFilters(allUsers, adminEmails)}
      </div>
    </div>`;
  },

  // Render the filterable user list
  renderUserListWithFilters(allUsers, adminEmails) {
    const filter = store.get('_userFilter') || { search: '', type: 'all' };

    // Apply filters
    const searchLower = filter.search.toLowerCase();
    const filtered = allUsers.filter(u => {
      // Text search across multiple fields
      if (searchLower) {
        const haystack = [
          u.displayName, u.email, u.location, u.occupation,
          u.concerns, u.lifeGoals, ...(u.diseases || [])
        ].join(' ').toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      // Type filter
      if (filter.type === 'admin') {
        if (!adminEmails.includes(u.email)) return false;
      } else if (filter.type === 'subscribed') {
        if (!u.subscription || u.subscription === 'free') return false;
      } else if (filter.type === 'withDiseases') {
        if (!u.diseases || u.diseases.length === 0) return false;
      } else if (filter.type === 'recent') {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (!u.lastActive || new Date(u.lastActive).getTime() < sevenDaysAgo) return false;
      }
      return true;
    });

    return `
      <div class="user-filters">
        <div class="form-group" style="flex:2;">
          <input type="text" id="userSearch" class="form-input"
            value="${filter.search}"
            placeholder="名前・メール・居住地・症状で検索..."
            oninput="app.filterUsers('search', this.value)">
        </div>
        <div class="form-group" style="flex:1;">
          <select id="userFilterType" class="form-input" onchange="app.filterUsers('type', this.value)">
            <option value="all" ${filter.type === 'all' ? 'selected' : ''}>すべて (${allUsers.length})</option>
            <option value="admin" ${filter.type === 'admin' ? 'selected' : ''}>管理者のみ</option>
            <option value="subscribed" ${filter.type === 'subscribed' ? 'selected' : ''}>有料プラン</option>
            <option value="withDiseases" ${filter.type === 'withDiseases' ? 'selected' : ''}>持病あり</option>
            <option value="recent" ${filter.type === 'recent' ? 'selected' : ''}>直近7日間</option>
          </select>
        </div>
        ${filter.search || filter.type !== 'all' ? `
          <button class="btn btn-sm btn-secondary" onclick="app.clearUserFilter()">クリア</button>
        ` : ''}
      </div>

      <div style="margin:12px 0;color:var(--text-secondary);font-size:0.87rem;">
        ${filtered.length}件を表示中（全${allUsers.length}件）
      </div>

      <div class="admin-users-list">
        ${filtered.length === 0 ? `
          <p style="padding:20px;text-align:center;color:var(--text-muted);">該当するユーザーがいません</p>
        ` : filtered.map(u => {
          const diseaseCount = (u.diseases || []).length;
          const initial = (u.displayName || u.email || '?').charAt(0).toUpperCase();
          const meta = [];
          if (u.age) meta.push(u.age + '歳');
          if (u.gender) meta.push(u.gender === 'male' ? '男性' : u.gender === 'female' ? '女性' : 'その他');
          if (u.location) meta.push(u.location);
          const metaText = meta.join(' · ');

          const esc = Components.escapeHtml;
          return `<div class="admin-user-item clickable" data-uid="${esc(u.uid || '')}" onclick="app.showUserDetail(this.dataset.uid)">
            <div class="admin-user-info">
              <div class="admin-user-avatar">${esc(initial)}</div>
              <div>
                <div class="admin-user-email">${esc(u.displayName || u.email || '不明')}</div>
                <div class="admin-user-role">
                  ${u.email ? esc(u.email) + '<br>' : ''}${esc(metaText || 'プロフィール未設定')}
                  ${u.lastActive ? ' · 最終: ' + new Date(u.lastActive).toLocaleDateString('ja-JP') : ''}
                </div>
              </div>
            </div>
            <div class="admin-user-stats">
              ${diseaseCount > 0 ? `<span class="stat-chip">持病${diseaseCount}</span>` : ''}
              ${u.subscription && u.subscription !== 'free' ? `<span class="stat-chip">${esc(u.subscription)}</span>` : ''}
              ${adminEmails.includes(u.email) ? '<span class="status-badge">管理者</span>' : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
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
