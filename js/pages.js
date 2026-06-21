/* ============================================================
   LMS - Page Renderers
   Renders Home, Record, Action, Ask AI, Settings for each domain
   ============================================================ */
var Pages = {

  // ─── Morning check-in state ───
  _ciAnswers: {},

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
      ${this.renderDailyGreeting(domain)}
      ${this.renderCheckinSummaryCard()}
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
      ${this.renderWeeklyReflectionCard()}
      ${this.renderTodaySummary(domain)}
      ${this.renderDailyPrompt(domain)}
      ${this.renderDomainInsight(domain)}
      ${this.renderCrossDomainInsights(domain)}
      ${this.renderReengagementNudge()}
      ${this.renderAchievementBadges()}
      ${this.renderFamilyShareCard(domain)}
      ${this.renderWeeklySummary()}
      ${this.renderNotificationPrompt()}`;

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

    // All domain scores overview (mini + radar chart)
    html += `<div class="all-domains-overview">
      <h3>${i18n.t('holistic_analysis')}</h3>
      <div class="ado-body">
        <div class="domain-scores-grid">
          ${Object.keys(CONFIG.domains).map(d => {
            const s = store.get('domainScores')?.[d] || 0;
            return `<div class="mini-score ${d === domain ? 'current' : ''}" onclick="app.switchDomain('${d}')">
              ${Components.scoreGauge(s, 70, i18n.t(d))}
            </div>`;
          }).join('')}
        </div>
        <div class="radar-chart-wrap">
          <canvas id="domainRadarChart" width="200" height="200"></canvas>
        </div>
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

    // Monthly goal tracker (every domain home)
    html += this.renderMonthlyGoalTracker();

    // Today's balance radar (appears on every domain home when 2+ domains have today's data)
    html += this.renderDailyBalanceRadar();

    // Cross-domain correlation insights (appears on every domain home when enough data)
    html += this.renderCrossDomainInsights();

    // ─── Domain-specific widgets ───

    // Consciousness domain: daily intention + gratitude journal + 7-layer visualization + transcript input
    if (domain === 'consciousness') {
      html += this.renderDailyZenQuestion();
      html += this.renderDailyIntention();
      html += this.renderMicroJournal();
      html += this.renderBreathingExercise();
      html += this.renderMeditationTimer();
      html += this.renderPracticeHistory();
      html += this.renderQuickLayerPick();
      html += this.renderGratitudeWidget();
      html += this.renderGratitudeStreak();
      html += this.renderConsciousnessLayers();
      html += this.renderLayerTrendChart();
      html += this.renderWeeklyConsciousnessTrend();
      html += this.renderMoodTrendCard();
      html += this.renderTranscriptInput();
    }

    // Time domain: Habit tracker + Calendar widget + Marketplace widget
    if (domain === 'time') {
      html += this.renderHabitTracker();
      html += this.renderQuickTimeLog();
      html += this.renderEveningReviewCard();
      html += this.renderTimeAllocationChart();
      html += this.renderWeeklyTimeComparison();
      if (typeof CalendarIntegration !== 'undefined') html += CalendarIntegration.renderWidget();
      if (typeof TimeMarketplace !== 'undefined') html += TimeMarketplace.renderWidget();
    }

    // Work domain: Ikigai + Resume + side biz diagnosis + time marketplace link
    if (domain === 'work') {
      html += this.renderDailyPlanCard();
      html += this.renderTaskCompletionCard();
      html += this.renderWorkDayCloseCard();
      html += this.renderWorkWeeklyStats();
      if (typeof WorkFeatures !== 'undefined') {
        html += WorkFeatures.renderIkigaiDiscover();
        html += WorkFeatures.renderSideBizDiagnosis();
        html += WorkFeatures.renderTimeSellingBanner();
      }
      html += this.renderWorkGoalProgress();
      html += this.renderResumeWidget();
      html += this.renderVolunteerTracker();
    }

    // Relationship domain: Isolation score + today contacts + social graph + birthdays
    if (domain === 'relationship') {
      html += this.renderMonthlyConnectionReport();
      html += this.renderQuickContactAdd();
      html += this.renderIsolationScore();
      html += this.renderConnectionActivity();
      if (typeof RelationshipFeatures !== 'undefined') html += RelationshipFeatures.renderDashboard();
      html += this.renderTodayContactSuggestion();
      html += this.renderSocialGraph();
      html += this.renderUpcomingBirthdays();
    }

    // Assets domain: monthly budget summary + NISA simulator + advisor + screenshot + auto trading
    // (Stock analysis widget is rendered at the top of the page.)
    if (domain === 'assets') {
      html += this.renderRetirementRunway();
      html += this.renderPortfolioSummary();
      html += this.renderQuickExpenseEntry();
      html += this.renderMonthlyBudgetSummary();
      html += this.renderBudgetTrendChart();
      html += this.renderSavingsGoals();
      html += this.renderMedicalExpenseTracker();
      if (typeof AssetsFeatures !== 'undefined') {
        html += AssetsFeatures.renderNISASimulator();
        html += AssetsFeatures.renderAIAdvisor();
        html += AssetsFeatures.renderScreenshotReader();
        html += AssetsFeatures.renderAutoTrading();
      }
    }

    // Health: morning vitals + SOS button + medication reminder + BP trend + doctor report shortcut
    if (domain === 'health') {
      html += this.renderWeeklyHealthSummary();
      html += this.renderProfileCompletionBanner();
      html += this.renderSeasonalHealthAlert();
      html += this.renderBPAlertCard();
      html += this.renderMorningVitalsCard();
      html += this.renderAfternoonSleepLog();
      html += this.renderWaterTracker();
      html += this.renderStepCounter();
      html += this.renderWeeklyStepGoal();
      html += this.renderSOSWidget();
      html += this.renderMedicationReminder();
      html += this.renderBPTrendCard();
      html += this.renderSleepTrendCard();
      html += this.renderWeightTrendCard();
      html += this.renderMonthlyHealthComparison();
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

  // ─── Daily Zen Question Card (consciousness domain, rotates by layer) ───
  renderDailyZenQuestion() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (localStorage.getItem('lms_zenq_dismissed') === todayStr) return '';

    const layerQs = [
      { name: '計測', color: '#E74C3C', q: '今日、数字や成果で表せる「達成」は何でしたか？' },
      { name: '関係', color: '#E67E22', q: '今日、誰かとの「つながり」で気づいたことはありましたか？' },
      { name: '現場', color: '#F1C40F', q: '今日、五感で一番印象に残った瞬間はどこですか？' },
      { name: '心身', color: '#27AE60', q: '今日の体の状態を一言で表すとすれば、何という言葉になりますか？' },
      { name: '構想', color: '#2980B9', q: '最近、「これが自分の大切にしたいこと」と気づいたことはありますか？' },
      { name: '可能性', color: '#8E44AD', q: 'いつもと違う選択をするとしたら、今日何を変えてみますか？' },
      { name: '統合', color: '#9B59B6', q: '今日、誰かを（または自分を）そのまま受け入れられましたか？' },
      { name: '空',   color: '#1ABC9C', q: '今、手放してもよいと思える「こだわり」はありますか？' }
    ];

    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    const layer = layerQs[dayOfYear % layerQs.length];

    const ansKey = `lms_zenq_answer_${todayStr}`;
    let savedAnswer = '';
    try { savedAnswer = localStorage.getItem(ansKey) || ''; } catch (e) {}
    const esc = Components.escapeHtml;

    if (savedAnswer) {
      return `<div class="zen-q-card zen-q-answered" style="border-left-color:${layer.color}">
        <div class="zenq-layer" style="color:${layer.color}">${layer.name}レイヤー</div>
        <div class="zenq-q">${layer.q}</div>
        <div class="zenq-answer">${esc(savedAnswer)}</div>
        <button class="zenq-dismiss" onclick="Pages.dismissZenQuestion('${todayStr}')">閉じる</button>
      </div>`;
    }

    return `<div class="zen-q-card" style="border-left-color:${layer.color}">
      <div class="zenq-layer" style="color:${layer.color}">${layer.name}レイヤーの問い</div>
      <div class="zenq-q">${layer.q}</div>
      <div class="zenq-input-row">
        <input type="text" id="zenqInput" class="form-input" placeholder="思ったことを一言…" maxlength="80">
        <button class="btn btn-sm btn-primary" onclick="Pages.saveZenAnswer('${esc(todayStr)}', '${esc(ansKey)}')">記録</button>
      </div>
      <button class="zenq-skip" onclick="Pages.dismissZenQuestion('${todayStr}')">スキップ</button>
    </div>`;
  },

  saveZenAnswer(todayStr, ansKey) {
    const input = document.getElementById('zenqInput');
    if (!input || !input.value.trim()) return;
    try { localStorage.setItem(ansKey, input.value.trim()); } catch (e) {}
    store.addDomainEntry('consciousness', 'entries', {
      text: input.value.trim(), entry_type: 'zen_question', timestamp: new Date().toISOString()
    });
    Components.showToast('記録しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  dismissZenQuestion(todayStr) {
    try { localStorage.setItem('lms_zenq_dismissed', todayStr); } catch (e) {}
    const card = document.querySelector('.zen-q-card');
    if (card) card.remove();
  },

  // ─── Daily Intention (Consciousness domain) ───
  renderDailyIntention() {
    const today = new Date().toISOString().split('T')[0];
    const key = 'lms_intention_' + today;
    let intention = '';
    try { intention = localStorage.getItem(key) || ''; } catch (e) {}

    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const isEvening = hour >= 17;
    const esc = Components.escapeHtml;

    if (!intention) {
      // Morning: prompt to set intention; rest of day: quiet prompt
      const prompt = isMorning
        ? '今日一日、どんな自分でいたいですか？ひと言で表してみてください。'
        : '今日の誓いをまだ決めていません。今からでも遅くありません。';
      return `<div class="daily-intention-card empty">
        <div class="di-icon">🌅</div>
        <div class="di-prompt">${prompt}</div>
        <div class="di-input-row">
          <input type="text" id="intentionInput" class="form-input" placeholder="例：穏やか、感謝、挑戦" maxlength="20">
          <button class="btn btn-primary btn-sm" onclick="app.saveDailyIntention()">決める</button>
        </div>
      </div>`;
    }

    // Evening reflection prompt (skip if already reflected today)
    let reflected = false;
    try { reflected = !!localStorage.getItem('lms_intention_reflected_' + today); } catch (e) {}
    const reflectionHtml = (isEvening && !reflected) ? `
      <div class="di-reflect">
        <span class="di-reflect-label">今日「${esc(intention)}」を体現できましたか？</span>
        <div class="di-reflect-btns">
          <button class="btn btn-xs btn-secondary" onclick="app.logIntentionReflection('yes')">できた ✓</button>
          <button class="btn btn-xs btn-secondary" onclick="app.logIntentionReflection('partly')">まあまあ</button>
          <button class="btn btn-xs btn-secondary" onclick="app.logIntentionReflection('no')">難しかった</button>
        </div>
      </div>` : (isEvening && reflected) ? `<div class="di-reflect-done">今日の振り返り完了 ✓</div>` : '';

    return `<div class="daily-intention-card set">
      <div class="di-header">
        <span class="di-label">今日の誓い</span>
        <button class="btn-link" onclick="app.clearDailyIntention()" title="リセット">✕</button>
      </div>
      <div class="di-word">${esc(intention)}</div>
      ${reflectionHtml}
    </div>`;
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

  // ─── Quick Consciousness Layer Pick (today) ───
  renderQuickLayerPick() {
    const today = new Date().toISOString().split('T')[0];
    const observations = store.getDomainData('consciousness', 'observation', 1);
    if (observations.some(e => (e.timestamp || '').startsWith(today))) return '';

    const layers = CONFIG.domains.consciousness.layers;
    const layerKeys = ['1', '2', '3', '3.5', '4', '5', '6', '7'];
    const btns = layerKeys.map(k => {
      const l = layers[k];
      return `<button class="qlp-btn" style="border-color:${l.color};--qlp-color:${l.color}"
        onclick="Pages.quickLayerPick('${k}', this)">
        <span class="qlp-num" style="background:${l.color}">${k}</span>
        <span class="qlp-name">${l.name}</span>
      </button>`;
    }).join('');
    return `<div class="quick-layer-pick">
      <div class="qlp-header">今日いちばん意識が向いたのは？（複数選べます）</div>
      <div class="qlp-grid">${btns}</div>
      <button class="btn btn-primary btn-sm qlp-save" onclick="Pages.saveQuickLayerPick()" style="margin-top:12px;width:100%;display:none">記録する</button>
    </div>`;
  },

  quickLayerPick(key, btn) {
    btn.classList.toggle('selected');
    const anySelected = document.querySelectorAll('.qlp-btn.selected').length > 0;
    const saveBtn = document.querySelector('.qlp-save');
    if (saveBtn) saveBtn.style.display = anySelected ? 'block' : 'none';
  },

  saveQuickLayerPick() {
    const selected = [...document.querySelectorAll('.qlp-btn.selected')].map(b => {
      const key = b.querySelector('.qlp-num')?.textContent?.trim();
      return key === '3.5' ? 'layer_35' : `layer_${key?.replace('.', '')}`;
    });
    if (selected.length === 0) return;
    const data = {};
    ['1','2','3','3.5','4','5','6','7'].forEach(k => {
      const storeKey = k === '3.5' ? 'layer_35' : `layer_${k}`;
      data[storeKey] = selected.includes(storeKey) ? Math.round(100 / selected.length) : 15;
    });
    store.addDomainEntry('consciousness', 'observation', data);
    Components.showToast('今日の意識レイヤーを記録しました', 'success');
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

  // ─── Today's Contact Suggestions (Relationship domain) ───
  renderTodayContactSuggestion() {
    const contacts = store.get('relationship_contacts') || [];
    if (contacts.length === 0) return '';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const interactions = store.get('relationship_interactions') || [];
    const now = Date.now();

    const contactedToday = new Set(
      store.getDomainData('relationship', 'interactions', 1)
        .filter(e => (e.timestamp || '').startsWith(todayStr))
        .map(e => e.person)
    );

    const scored = contacts.map(c => {
      const last = interactions
        .filter(i => i.person === c.name)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const daysSince = last ? Math.floor((now - new Date(last.timestamp)) / 86400000) : 999;
      const idealDays = { 1: 1, 2: 7, 3: 14, 4: 30, 5: 90 }[parseInt(c.distance)] || 30;
      const overdueDays = Math.max(0, daysSince - idealDays);

      let birthdayDays = Infinity;
      if (c.birthday) {
        const bd = new Date(c.birthday);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(next.getFullYear() + 1);
        birthdayDays = (next - today) / 86400000;
      }
      const birthdaySoon = birthdayDays <= 7;

      // Score: birthday within 3d = 10000 pts, overdue most = high pts
      const score = (birthdayDays <= 3 ? 10000 : birthdaySoon ? 5000 : 0) + overdueDays * 10 + (daysSince >= 999 ? 500 : 0);
      return { ...c, daysSince, overdueDays, birthdaySoon, birthdayDays, score };
    });

    const top3 = scored
      .filter(c => c.overdueDays > 0 || c.birthdaySoon || c.daysSince >= 999)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (top3.length === 0) return '';

    const esc = Components.escapeHtml;
    const rows = top3.map(c => {
      const done = contactedToday.has(c.name);
      let badge = '';
      if (c.birthdayDays <= 1) badge = '<span class="csl-badge birthday">今日誕生日🎂</span>';
      else if (c.birthdaySoon) badge = `<span class="csl-badge birthday">誕生日まで${Math.ceil(c.birthdayDays)}日🎂</span>`;
      else if (c.daysSince >= 999) badge = '<span class="csl-badge overdue">未記録</span>';
      else badge = `<span class="csl-badge overdue">${c.daysSince}日ぶり</span>`;

      return `<div class="csl-row${done ? ' done' : ''}">
        <div class="csl-avatar">${esc((c.name || '？').substring(0, 2))}</div>
        <div class="csl-info">
          <span class="csl-name">${esc(c.name)}</span>
          ${badge}
        </div>
        <div class="csl-actions">
          ${done
            ? '<span class="csl-done-mark">✓ 済</span>'
            : `<button class="btn btn-xs btn-primary" onclick="app.quickContactLog('${esc(c.name)}')">連絡した</button>`}
          ${c.phone && !done ? `<a href="tel:${esc(c.phone)}" class="btn btn-xs btn-secondary">📞</a>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="contact-suggestion-list">
      <div class="csl-header">今日連絡したい方</div>
      ${rows}
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
    const todayStr = today.toISOString().split('T')[0];
    const esc = Components.escapeHtml;

    const upcoming = contacts
      .filter(c => c.birthday)
      .map(c => {
        const bd = new Date(c.birthday);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(next.getFullYear() + 1);
        const daysUntil = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        // Age they are turning (only if birth year is meaningful, i.e. > 1900)
        const birthYear = bd.getFullYear();
        const turningAge = (birthYear > 1900) ? (next.getFullYear() - birthYear) : null;
        return { ...c, daysUntil, nextBirthday: next, turningAge };
      })
      .filter(c => c.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (upcoming.length === 0) return '';

    // Track who we've contacted today for this birthday
    const contactedToday = new Set(
      store.getDomainData('relationship', 'interactions', 1)
        .filter(e => e.timestamp?.startsWith(todayStr))
        .map(e => e.person)
    );

    // Split into urgent (≤3 days) and upcoming (4-30 days)
    const urgent = upcoming.filter(c => c.daysUntil <= 3);
    const rest   = upcoming.filter(c => c.daysUntil > 3);

    let html = `<div class="birthdays-section">
      <div class="bd-header">
        <h3 style="margin:0">誕生日のご連絡</h3>
        <span class="bd-count">${upcoming.length}件</span>
      </div>`;

    // Urgent cards (large, action-focused)
    urgent.forEach(c => {
      const dateStr = c.nextBirthday.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
      const doneContact = contactedToday.has(c.name);
      const dayLabel = c.daysUntil === 0 ? '今日が誕生日です！' : `あと${c.daysUntil}日で誕生日です`;
      const ageLabel = c.turningAge ? `${c.turningAge}歳になります` : '';
      const phoneLink = c.phone ? `<a href="tel:${esc(c.phone)}" class="btn btn-sm bd-btn-call">電話する</a>` : '';
      const smsLink   = c.phone ? `<a href="sms:${esc(c.phone)}" class="btn btn-sm bd-btn-sms">メッセージ</a>` : '';
      const loggedMark = doneContact ? `<span class="bd-contacted">✓ 連絡済み</span>` : `<button class="btn btn-sm bd-btn-log" onclick="Pages.logBirthdayContact('${esc(c.name)}')">連絡した ✓</button>`;

      html += `<div class="birthday-urgent-card${doneContact ? ' bd-done' : ''}">
        <div class="buc-top">
          <div class="buc-avatar">${esc((c.name || '?').substring(0, 2))}</div>
          <div class="buc-info">
            <div class="buc-name">${esc(c.name)}</div>
            <div class="buc-day">${dateStr} — ${dayLabel}</div>
            ${ageLabel ? `<div class="buc-age">${esc(ageLabel)}</div>` : ''}
          </div>
        </div>
        <div class="buc-actions">
          ${phoneLink}${smsLink}${loggedMark}
        </div>
      </div>`;
    });

    // Compact list for others
    if (rest.length > 0) {
      html += `<div class="birthday-list">`;
      rest.forEach(c => {
        const dateStr = c.nextBirthday.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
        const ageLabel = c.turningAge ? `（${c.turningAge}歳）` : '';
        html += `<div class="birthday-item">
          <span class="birthday-name">${esc(c.name)}${esc(ageLabel)}</span>
          <span class="birthday-date">${dateStr}（あと${c.daysUntil}日）</span>
        </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  logBirthdayContact(name) {
    store.addDomainEntry('relationship', 'interactions', {
      person: name,
      type: 'message',
      quality: 5,
      notes: '誕生日のご連絡'
    });
    Components.showToast(`${name}さんへの連絡を記録しました`, 'success');
    if (typeof app !== 'undefined') app.renderApp();
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

  // ─── Quick Time Activity Log (Time domain home) ───
  renderQuickTimeLog() {
    const esc = Components.escapeHtml;
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = store.getDomainData('time', 'entries', 1)
      .filter(e => e.timestamp?.startsWith(today));
    const todayMinutes = todayLogs.reduce((s, e) => s + (Number(e.duration) || 0), 0);

    const cats = [
      { key: 'health',        label: '運動・健康', icon: '🏃' },
      { key: 'learning',      label: '学び',       icon: '📚' },
      { key: 'relationships', label: '交流',       icon: '👥' },
      { key: 'housework',     label: '家事',       icon: '🏠' },
      { key: 'leisure',       label: '余暇',       icon: '🎭' },
      { key: 'work',          label: '仕事',       icon: '💼' }
    ];

    const recentHtml = todayLogs.slice(-3).reverse().map(e => {
      const cat = cats.find(c => c.key === e.category);
      const dur = Number(e.duration);
      const durStr = dur >= 60 ? `${Math.floor(dur/60)}時間${dur%60?dur%60+'分':''}` : `${dur}分`;
      return `<div class="qtl-log-item">
        <span class="qtl-log-icon">${cat?.icon || '⏱'}</span>
        <span class="qtl-log-label">${cat?.label || esc(e.category || '')}</span>
        <span class="qtl-log-dur">${durStr}</span>
      </div>`;
    }).join('');

    const catBtns = cats.map(c =>
      `<button class="qtl-cat-btn" data-cat="${c.key}" onclick="Pages.selectTimeCat('${c.key}', this)">${c.icon} ${c.label}</button>`
    ).join('');

    const durBtns = [30, 60, 90, 120].map(m =>
      `<button class="qtl-dur-btn" onclick="Pages.selectTimeDur(${m}, this)">${m >= 60 ? m/60+'時間' : m+'分'}</button>`
    ).join('');

    const todayStr = todayMinutes >= 60
      ? `${Math.floor(todayMinutes/60)}時間${todayMinutes%60 ? todayMinutes%60+'分' : ''}` : `${todayMinutes}分`;

    return `<div class="quick-time-card">
      <div class="qtl-header">
        <span class="qtl-title">今日の活動を記録</span>
        ${todayMinutes > 0 ? `<span class="qtl-today">今日 ${todayStr}</span>` : ''}
      </div>
      ${recentHtml ? `<div class="qtl-recent">${recentHtml}</div>` : ''}
      <div class="qtl-cats">${catBtns}</div>
      <div class="qtl-entry" id="qtlEntry" style="display:none">
        <span class="qtl-entry-label" id="qtlEntryLabel">時間を選択</span>
        <div class="qtl-dur-row">${durBtns}</div>
        <input type="number" id="qtlCustomDur" class="form-input qtl-custom-dur" placeholder="その他(分)">
        <div class="qtl-entry-btns">
          <button class="btn btn-primary" onclick="Pages.saveQuickTimeLog()">記録する</button>
          <button class="btn btn-ghost" onclick="Pages.cancelTimeCat()">キャンセル</button>
        </div>
      </div>
    </div>`;
  },

  selectTimeCat(cat, btn) {
    document.querySelectorAll('.qtl-cat-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    this._qtlCat = cat;
    this._qtlDur = null;
    document.querySelectorAll('.qtl-dur-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('qtlCustomDur').value = '';
    const entry = document.getElementById('qtlEntry');
    if (entry) { entry.style.display = ''; }
    const catLabels = { health:'運動・健康', learning:'学び', relationships:'交流', housework:'家事', leisure:'余暇', work:'仕事' };
    const label = document.getElementById('qtlEntryLabel');
    if (label) label.textContent = (catLabels[cat] || cat) + ' — 時間を選択';
  },

  selectTimeDur(minutes, btn) {
    document.querySelectorAll('.qtl-dur-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    this._qtlDur = minutes;
    document.getElementById('qtlCustomDur').value = '';
  },

  cancelTimeCat() {
    document.querySelectorAll('.qtl-cat-btn,.qtl-dur-btn').forEach(b => b.classList.remove('selected'));
    const entry = document.getElementById('qtlEntry');
    if (entry) entry.style.display = 'none';
    this._qtlCat = null;
    this._qtlDur = null;
  },

  saveQuickTimeLog() {
    const cat = this._qtlCat;
    const customDur = parseInt(document.getElementById('qtlCustomDur')?.value || '0', 10);
    const duration = customDur > 0 ? customDur : this._qtlDur;
    if (!cat) { Components.showToast('活動を選んでください', 'error'); return; }
    if (!duration || duration <= 0) { Components.showToast('時間を選択または入力してください', 'error'); return; }
    store.addDomainEntry('time', 'entries', { category: cat, duration, notes: '' });
    const catLabels = { health:'運動・健康', learning:'学び', relationships:'交流', housework:'家事', leisure:'余暇', work:'仕事' };
    const durStr = duration >= 60 ? `${Math.floor(duration/60)}時間${duration%60?duration%60+'分':''}` : `${duration}分`;
    Components.showToast(`${catLabels[cat] || cat} ${durStr}を記録しました`, 'success');
    this.cancelTimeCat();
    if (typeof app !== 'undefined') app.renderApp();
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

    // 28-day habit heatmap: check both localStorage (today) and Firestore habit entries
    const firestoreHabitDates = new Set(
      (store.getDomainData('time', 'habits', 28) || [])
        .filter(e => e.completed_habits && e.completed_habits.length >= 5 && e.timestamp)
        .map(e => e.timestamp.split('T')[0])
    );
    // Also check localStorage for each of the last 28 days
    const heatmapDays = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = `${d.getMonth()+1}/${d.getDate()}`;
      let level = 0;
      if (key === today) {
        level = completedSet.size >= 5 ? 3 : completedSet.size >= 3 ? 2 : completedSet.size >= 1 ? 1 : 0;
      } else {
        const lsKey = 'lms_habits_' + key;
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch (e) {}
        const count = saved.length || (firestoreHabitDates.has(key) ? 5 : 0);
        level = count >= 5 ? 3 : count >= 3 ? 2 : count >= 1 ? 1 : 0;
      }
      heatmapDays.push({ key, label, level });
    }

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
      <div class="ht-heatmap" title="過去28日間の習慣達成記録">
        <div class="ht-heatmap-label">過去28日</div>
        <div class="ht-heatmap-grid">
          ${heatmapDays.map(d => `<div class="ht-cell level-${d.level}" title="${d.label}"></div>`).join('')}
        </div>
        <div class="ht-heatmap-legend">
          <span class="ht-cell level-0" style="display:inline-block"></span>なし
          <span class="ht-cell level-1" style="display:inline-block"></span>少し
          <span class="ht-cell level-2" style="display:inline-block"></span>半分
          <span class="ht-cell level-3" style="display:inline-block"></span>全達成
        </div>
      </div>
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
        Components.showToast('今日の習慣を全部達成！素晴らしいです！', 'success');
      }
    }
    localStorage.setItem(storageKey, JSON.stringify(completed));
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Weekly Time Allocation Chart (Time domain) ───
  // ─── Evening time review card (time domain, 4pm–11pm only) ───
  renderEveningReviewCard() {
    const hour = new Date().getHours();
    if (hour < 16 || hour >= 23) return '';
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_eveningReview_' + today;
    if (localStorage.getItem(lsKey)) return '';
    const categories = [
      { key: 'rest',          icon: '😴', label: '休養' },
      { key: 'leisure',       icon: '🎨', label: '趣味' },
      { key: 'health',        icon: '🏃', label: '運動・健康' },
      { key: 'relationships', icon: '🤝', label: '人との交流' },
      { key: 'learning',      icon: '📚', label: '学習・読書' },
      { key: 'housework',     icon: '🏠', label: '家事' },
      { key: 'work',          icon: '💼', label: '仕事・活動' }
    ];
    return `<div class="evening-review-card" id="eveningReviewCard">
      <div class="er-header">
        <span class="er-icon">🌙</span>
        <div class="er-title-block">
          <strong>今日の振り返り</strong>
          <span>今日、時間を使ったことは？（複数選べます）</span>
        </div>
        <button class="er-close btn-ghost" onclick="Pages.dismissEveningReview('${today}')">&times;</button>
      </div>
      <div class="er-cats">
        ${categories.map(c =>
          `<button class="er-cat" data-key="${c.key}" onclick="Pages.toggleEveningCat(this)">${c.icon} ${c.label}</button>`
        ).join('')}
      </div>
      <div class="er-satisfaction">
        <span class="er-sat-label">今日の充実度</span>
        <div class="er-stars">
          ${[1,2,3,4,5].map(n =>
            `<button class="er-star" data-val="${n}" onclick="Pages.selectEveningStar(this)">☆</button>`
          ).join('')}
        </div>
      </div>
      <input type="text" id="erHighlight" class="form-input er-highlight" placeholder="今日のハイライト（任意）" maxlength="80">
      <button class="btn btn-primary er-save" onclick="app.saveEveningReview('${today}')">記録する</button>
    </div>`;
  },

  toggleEveningCat(btn) {
    btn.classList.toggle('selected');
  },

  selectEveningStar(btn) {
    const val = parseInt(btn.dataset.val);
    btn.closest('.er-stars').querySelectorAll('.er-star').forEach((s, i) => {
      s.textContent = i < val ? '★' : '☆';
      s.classList.toggle('active', i < val);
    });
    btn.closest('.er-stars').dataset.val = val;
  },

  dismissEveningReview(today) {
    localStorage.setItem('lms_eveningReview_' + today, 'skipped');
    const card = document.getElementById('eveningReviewCard');
    if (card) card.remove();
  },

  renderTimeAllocationChart() {
    const logs = store.getDomainData('time', 'entries', 7);
    if (logs.length === 0) return '';
    const catColors = { work:'#3b82f6', health:'#10b981', learning:'#6C63FF', relationships:'#ef4444', leisure:'#f59e0b', sleep:'#94a3b8', commute:'#64748b', housework:'#d97706', other:'#a0aec0' };
    const catLabels = { work:'仕事', health:'健康・運動', learning:'学び', relationships:'交流', leisure:'余暇', sleep:'睡眠', commute:'移動', housework:'家事', other:'その他' };
    const totals = {};
    let grandTotal = 0;
    logs.forEach(e => {
      if (!e.duration) return;
      const cat = e.category || 'other';
      totals[cat] = (totals[cat] || 0) + Number(e.duration);
      grandTotal += Number(e.duration);
    });
    if (grandTotal === 0) return '';
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const legendHtml = sorted.map(([cat, min]) => {
      const pct = Math.round(min / grandTotal * 100);
      const hrs = (min / 60).toFixed(1);
      return `<div class="tac-legend-item">
        <span class="tac-dot" style="background:${catColors[cat]||'#a0aec0'}"></span>
        <span class="tac-cat">${catLabels[cat]||cat}</span>
        <span class="tac-val">${hrs}h (${pct}%)</span>
      </div>`;
    }).join('');
    return `<div class="time-alloc-card">
      <div class="tac-header">
        <span class="tac-title">過去7日の時間の使い方</span>
        <span class="tac-total">${(grandTotal/60).toFixed(1)}h 合計</span>
      </div>
      <div class="tac-body">
        <canvas id="timeAllocChart" width="160" height="160" style="flex-shrink:0;"></canvas>
        <div class="tac-legend">${legendHtml}</div>
      </div>
    </div>`;
  },

  initTimeAllocationChart() {
    const canvas = document.getElementById('timeAllocChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const logs = store.getDomainData('time', 'entries', 7);
    const catColors = { work:'#3b82f6', health:'#10b981', learning:'#6C63FF', relationships:'#ef4444', leisure:'#f59e0b', sleep:'#94a3b8', commute:'#64748b', housework:'#d97706', other:'#a0aec0' };
    const catLabels = { work:'仕事', health:'健康・運動', learning:'学び', relationships:'交流', leisure:'余暇', sleep:'睡眠', commute:'移動', housework:'家事', other:'その他' };
    const totals = {};
    logs.forEach(e => {
      if (!e.duration) return;
      const cat = e.category || 'other';
      totals[cat] = (totals[cat] || 0) + Number(e.duration);
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return;
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: sorted.map(([cat]) => catLabels[cat]||cat),
        datasets: [{ data: sorted.map(([,min]) => +(min/60).toFixed(1)), backgroundColor: sorted.map(([cat]) => catColors[cat]||'#a0aec0'), borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}h` } }
        },
        cutout: '65%'
      }
    });
  },

  // ─── Weekly time comparison card (time domain, week-over-week) ───
  renderWeeklyTimeComparison() {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);

    const logs = store.getDomainData('time', 'entries', 14);
    if (logs.length < 3) return '';

    const catLabels = { work:'仕事', health:'健康・運動', learning:'学び', relationships:'交流', leisure:'余暇', sleep:'睡眠', commute:'移動', housework:'家事', other:'その他' };
    const thisWeek = {};
    const prevWeek = {};

    logs.forEach(e => {
      if (!e.duration || !e.timestamp) return;
      const d = new Date(e.timestamp);
      const cat = e.category || 'other';
      const min = Number(e.duration);
      if (d >= weekStart) thisWeek[cat] = (thisWeek[cat] || 0) + min;
      else if (d >= prevWeekStart) prevWeek[cat] = (prevWeek[cat] || 0) + min;
    });

    const thisTotal = Object.values(thisWeek).reduce((s, v) => s + v, 0);
    if (thisTotal === 0) return '';

    const allCats = [...new Set([...Object.keys(thisWeek), ...Object.keys(prevWeek)])];
    allCats.sort((a, b) => (thisWeek[b] || 0) - (thisWeek[a] || 0));
    const top = allCats.slice(0, 5);
    const maxMin = Math.max(...top.map(c => Math.max(thisWeek[c] || 0, prevWeek[c] || 0)), 1);

    const rows = top.map(cat => {
      const t = thisWeek[cat] || 0;
      const p = prevWeek[cat] || 0;
      const thisPct = Math.round(t / maxMin * 100);
      const prevPct = Math.round(p / maxMin * 100);
      const diff = t - p;
      const trend = diff > 30 ? '▲' : diff < -30 ? '▼' : '–';
      const trendColor = diff > 30 ? '#10b981' : diff < -30 ? '#ef4444' : '#94a3b8';
      return `<div class="twc-row">
        <div class="twc-cat">${catLabels[cat] || cat}</div>
        <div class="twc-bars">
          <div class="twc-bar twc-bar-this" style="width:${thisPct}%"></div>
          <div class="twc-bar twc-bar-prev" style="width:${prevPct}%"></div>
        </div>
        <div class="twc-hrs">${(t / 60).toFixed(1)}h</div>
        <div class="twc-trend" style="color:${trendColor}">${trend}</div>
      </div>`;
    }).join('');

    const prevTotal = Object.values(prevWeek).reduce((s, v) => s + v, 0);
    const diffMin = thisTotal - prevTotal;
    const diffLabel = prevTotal > 0
      ? `<span style="color:${diffMin >= 0 ? '#10b981' : '#ef4444'}">${diffMin >= 0 ? '+' : ''}${(diffMin / 60).toFixed(1)}h 先週比</span>`
      : '';

    const daysRecorded = new Set(
      logs.filter(e => e.timestamp && new Date(e.timestamp) >= weekStart)
        .map(e => (e.timestamp || '').split('T')[0])
    ).size;

    return `<div class="time-weekly-compare-card">
      <div class="twc-header">
        <span class="twc-title">今週の時間の使い方</span>
        <span class="twc-badge">${daysRecorded}日記録</span>
      </div>
      <div class="twc-legend">
        <span class="twc-leg-dot twc-leg-this"></span><span>今週</span>
        <span class="twc-leg-spacer"></span>
        <span class="twc-leg-dot twc-leg-prev"></span><span>先週</span>
      </div>
      <div class="twc-rows">${rows}</div>
      <div class="twc-footer">今週合計 <strong>${(thisTotal / 60).toFixed(1)}h</strong> ${diffLabel}</div>
    </div>`;
  },

  // ─── Quick Expense Entry (Assets domain home) ───
  renderQuickExpenseEntry() {
    const esc = Components.escapeHtml;
    const today = new Date().toISOString().split('T')[0];
    const todayExpenses = store.getDomainData('assets', 'expenses', 1)
      .filter(e => e.timestamp?.startsWith(today));
    const todayTotal = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const cats = [
      { key: 'food',          label: '食費',   icon: '🍽' },
      { key: 'transport',     label: '交通費', icon: '🚌' },
      { key: 'health',        label: '医療費', icon: '💊' },
      { key: 'entertainment', label: '交際',   icon: '🎭' },
      { key: 'other',         label: 'その他', icon: '🛍' }
    ];

    const recentHtml = todayExpenses.slice(-3).reverse().map(e => {
      const catLabel = cats.find(c => c.key === e.category)?.label || esc(e.category || 'その他');
      const notes = e.notes ? ` (${esc(e.notes.substring(0, 12))})` : '';
      return `<div class="qe-recent-item">
        <span class="qe-recent-cat">${catLabel}${notes}</span>
        <span class="qe-recent-amt">¥${Math.round(Number(e.amount)).toLocaleString()}</span>
      </div>`;
    }).join('');

    const catBtns = cats.map(c =>
      `<button class="qe-cat-btn" data-cat="${c.key}" onclick="Pages.selectExpenseCat('${c.key}', this)">${c.icon} ${c.label}</button>`
    ).join('');

    return `<div class="quick-expense-card">
      <div class="qe-header">
        <span class="qe-title">今日の出費を記録</span>
        <span class="qe-today-total">${todayTotal > 0 ? '今日合計 ¥' + Math.round(todayTotal).toLocaleString() : ''}</span>
      </div>
      ${recentHtml ? `<div class="qe-recent">${recentHtml}</div>` : ''}
      <div class="qe-cats">${catBtns}</div>
      <div class="qe-entry" id="qeEntry" style="display:none">
        <span class="qe-entry-label" id="qeEntryLabel">金額を入力</span>
        <div class="qe-entry-row">
          <input type="number" id="qeAmount" class="form-input" placeholder="例: 500" min="0" step="100"
            onkeydown="if(event.key==='Enter')Pages.saveQuickExpense()">
          <span class="qe-unit">円</span>
          <button class="btn btn-primary qe-save-btn" onclick="Pages.saveQuickExpense()">記録</button>
          <button class="btn btn-ghost qe-cancel-btn" onclick="Pages.cancelExpenseCat()">×</button>
        </div>
        <input type="hidden" id="qeCategory" value="">
      </div>
    </div>`;
  },

  selectExpenseCat(cat, btn) {
    document.querySelectorAll('.qe-cat-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    document.getElementById('qeCategory').value = cat;
    const entry = document.getElementById('qeEntry');
    if (entry) { entry.style.display = ''; document.getElementById('qeAmount')?.focus(); }
    const catLabels = { food:'食費', transport:'交通費', health:'医療費', entertainment:'交際・娯楽費', other:'その他の出費' };
    const label = document.getElementById('qeEntryLabel');
    if (label) label.textContent = (catLabels[cat] || cat) + 'の金額';
  },

  cancelExpenseCat() {
    document.querySelectorAll('.qe-cat-btn').forEach(b => b.classList.remove('selected'));
    const entry = document.getElementById('qeEntry');
    if (entry) entry.style.display = 'none';
  },

  saveQuickExpense() {
    const cat = document.getElementById('qeCategory')?.value;
    const amtStr = document.getElementById('qeAmount')?.value;
    const amount = parseFloat(amtStr);
    if (!cat || !amount || amount <= 0) { Components.showToast('金額を入力してください', 'error'); return; }
    store.addDomainEntry('assets', 'expenses', { category: cat, amount, notes: '' });
    Components.showToast(`¥${amount.toLocaleString()}を記録しました`, 'success');
    this.cancelExpenseCat();
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

    // Previous month comparison
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = monthStart;
    const prevExpense = store.getDomainData('assets', 'expenses', 90)
      .filter(e => (e.timestamp||'') >= prevMonthStart && (e.timestamp||'') < prevMonthEnd)
      .reduce((s, e) => s + (Number(e.amount)||0), 0);
    const momDiff = prevExpense > 0 ? totalExpense - prevExpense : null;

    const savingsRate = totalIncome > 0 ? Math.round(balance / totalIncome * 100) : null;
    const statusBadge = balance >= 0
      ? `<span class="bs-status surplus">黒字 ${savingsRate !== null ? savingsRate + '%' : ''}</span>`
      : `<span class="bs-status deficit">赤字 ${fmt(Math.abs(balance))}</span>`;

    const momHtml = momDiff !== null
      ? `<div class="bs-mom">先月比 支出: <strong style="color:${momDiff<=0?'var(--success,#10b981)':'var(--danger,#ef4444)'}">${momDiff<=0?'▼':'▲'}${fmt(Math.abs(momDiff))}</strong></div>`
      : '';

    return `<div class="budget-summary-card">
      <div class="bs-header">
        <span class="bs-title">${monthLabel}の家計</span>
        <div style="display:flex;align-items:center;gap:8px">${statusBadge}<button class="btn btn-sm btn-secondary" onclick="app.navigate('record')">記録を追加</button></div>
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
      ${momHtml}
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
  // ─── Daily plan card (work domain, morning only 5am-12pm) ───
  renderDailyPlanCard() {
    const hour = new Date().getHours();
    if (hour < 5 || hour >= 12) return '';
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_dailyPlan_' + today;
    const existing = localStorage.getItem(lsKey);
    if (existing) {
      let tasks = [];
      try { tasks = JSON.parse(existing); } catch(e) {}
      if (tasks.length === 0) return '';
      const esc = Components.escapeHtml;
      return `<div class="daily-plan-card daily-plan-done">
        <div class="dp-done-header">📋 今日の計画</div>
        <ul class="dp-done-list">
          ${tasks.map(t => `<li>${esc(t)}</li>`).join('')}
        </ul>
      </div>`;
    }
    return `<div class="daily-plan-card" id="dailyPlanCard">
      <div class="dp-header">
        <span class="dp-icon">📋</span>
        <div class="dp-title-block">
          <strong>今日の計画</strong>
          <span>今日やることを1〜3つ書いてみましょう</span>
        </div>
        <button class="dp-close" onclick="Pages.dismissDailyPlan('${today}')">&times;</button>
      </div>
      <div class="dp-inputs">
        <input type="text" id="dp1" class="form-input dp-input" placeholder="やること 1" maxlength="60"
          onkeydown="if(event.key==='Enter')document.getElementById('dp2')?.focus()">
        <input type="text" id="dp2" class="form-input dp-input" placeholder="やること 2（任意）" maxlength="60"
          onkeydown="if(event.key==='Enter')document.getElementById('dp3')?.focus()">
        <input type="text" id="dp3" class="form-input dp-input" placeholder="やること 3（任意）" maxlength="60"
          onkeydown="if(event.key==='Enter')app.saveDailyPlan('${today}')">
      </div>
      <button class="btn btn-primary dp-save" onclick="app.saveDailyPlan('${today}')">計画する</button>
    </div>`;
  },

  // ─── Task completion card (work domain, afternoon 12pm+ when plan exists) ───
  renderTaskCompletionCard() {
    const hour = new Date().getHours();
    if (hour < 12) return '';
    const today = new Date().toISOString().split('T')[0];
    let tasks = [];
    try { tasks = JSON.parse(localStorage.getItem('lms_dailyPlan_' + today) || '[]'); } catch(e) {}
    if (tasks.length === 0) return '';

    let done = {};
    try { done = JSON.parse(localStorage.getItem('lms_tasksDone_' + today) || '{}'); } catch(e) {}
    const allDone = tasks.every(t => done[t]);
    const esc = Components.escapeHtml;

    return `<div class="task-completion-card${allDone ? ' tc-all-done' : ''}" id="taskCompletionCard">
      <div class="tc-header">
        <span class="tc-title">📋 今日の進捗</span>
        ${allDone ? '<span class="tc-badge">全完了 ✅</span>' : `<span class="tc-count">${Object.keys(done).length}/${tasks.length}</span>`}
      </div>
      <div class="tc-tasks">
        ${tasks.map(t => {
          const isDone = !!done[t];
          const tEsc = esc(t).replace(/'/g, '&#39;');
          return `<label class="tc-task${isDone ? ' tc-done' : ''}">
            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="Pages.toggleTaskDone('${tEsc}', this.checked, '${today}')">
            <span>${esc(t)}</span>
          </label>`;
        }).join('')}
      </div>
      ${allDone ? '<div class="tc-congrats">今日の計画をすべて達成しました！お疲れ様でした。</div>' : ''}
    </div>`;
  },

  toggleTaskDone(task, checked, today) {
    let done = {};
    try { done = JSON.parse(localStorage.getItem('lms_tasksDone_' + today) || '{}'); } catch(e) {}
    if (checked) {
      done[task] = 1;
      store.addDomainEntry('work', 'tasks', { title: task, status: 'done', source: 'task_completion' });
    } else {
      delete done[task];
    }
    try { localStorage.setItem('lms_tasksDone_' + today, JSON.stringify(done)); } catch(e) {}
    // Rerender only the card to avoid losing checkbox state
    const card = document.getElementById('taskCompletionCard');
    if (card) {
      const newHtml = Pages.renderTaskCompletionCard();
      const tmp = document.createElement('div');
      tmp.innerHTML = newHtml;
      if (tmp.firstElementChild) card.replaceWith(tmp.firstElementChild);
    }
  },

  dismissDailyPlan(today) {
    try { localStorage.setItem('lms_dailyPlan_' + today, '[]'); } catch(e) {}
    const card = document.getElementById('dailyPlanCard');
    if (card) card.remove();
  },

  // ─── Work day close card (5pm-10pm, after plan exists) ───
  renderWorkDayCloseCard() {
    const hour = new Date().getHours();
    if (hour < 17 || hour >= 22) return '';

    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_workClose_' + today;
    if (localStorage.getItem(lsKey)) return ''; // already done today

    const tasks = store.getDomainData('work', 'tasks', 1).filter(e => e.timestamp?.startsWith(today));
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    if (total === 0) return ''; // no plan was made today

    const esc = Components.escapeHtml;
    return `<div class="work-close-card" id="workCloseCard">
      <div class="wc-header">
        <span class="wc-icon">🌇</span>
        <div class="wc-title-wrap">
          <span class="wc-title">今日の仕事を振り返る</span>
          <span class="wc-sub">完了 ${done}/${total}件</span>
        </div>
      </div>
      <div class="wc-body">
        <div class="wc-rating">
          <span class="wc-rating-label">今日の充実度は？</span>
          <div class="wc-stars">
            ${[1,2,3,4,5].map(n =>
              `<button class="wc-star" data-val="${n}" onclick="Pages.selectWorkCloseStar(${n}, this)">☆</button>`
            ).join('')}
          </div>
        </div>
        <div class="wc-tmr">
          <label class="wc-tmr-label">明日の最優先は？</label>
          <input type="text" id="wcTomorrow" class="form-input" placeholder="例：企画書を完成させる" maxlength="40">
        </div>
      </div>
      <div class="wc-actions">
        <button class="btn btn-primary" onclick="Pages.saveWorkDayClose('${today}')">振り返りを保存</button>
        <button class="btn btn-ghost" onclick="localStorage.setItem('lms_workClose_${today}','skip');this.closest('.work-close-card').remove()">後で</button>
      </div>
    </div>`;
  },

  selectWorkCloseStar(n, btn) {
    document.querySelectorAll('.wc-star').forEach((s, i) => {
      s.textContent = i < n ? '★' : '☆';
      s.classList.toggle('active', i < n);
    });
    this._wcStars = n;
  },

  saveWorkDayClose(today) {
    const rating = this._wcStars || 0;
    const tomorrow = document.getElementById('wcTomorrow')?.value?.trim() || '';
    store.addDomainEntry('work', 'reflections', {
      day_rating: rating,
      tomorrow_priority: tomorrow,
      notes: `充実度${rating}/5 • 明日: ${tomorrow}`
    });
    try { localStorage.setItem('lms_workClose_' + today, '1'); } catch(e) {}
    Components.showToast('振り返りを保存しました', 'success');
    const card = document.getElementById('workCloseCard');
    if (card) card.remove();
  },

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

  // ─── Work Goal Progress (Work domain) ───
  renderWorkGoalProgress() {
    const goals = store.getDomainData('work', 'goals', 365);
    if (goals.length === 0) return '';
    const today = new Date().toISOString().split('T')[0];
    const active = goals
      .filter(g => !g.deadline || g.deadline >= today)
      .sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1)
      .slice(0, 5);
    if (active.length === 0) return '';

    const esc = Components.escapeHtml;
    const rows = active.map(g => {
      const pct = Math.min(100, Math.max(0, Number(g.progress) || 0));
      const barColor = pct >= 80 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#3b82f6';
      let deadlineBadge = '';
      if (g.deadline) {
        const daysLeft = Math.ceil((new Date(g.deadline) - new Date()) / 86400000);
        const cls = daysLeft <= 7 ? 'wg-deadline urgent' : 'wg-deadline';
        deadlineBadge = `<span class="${cls}">${daysLeft <= 0 ? '期限切れ' : `あと${daysLeft}日`}</span>`;
      }
      return `<div class="wg-row">
        <div class="wg-top">
          <span class="wg-name">${esc(g.goal || '目標')}</span>
          ${deadlineBadge}
          <span class="wg-pct">${pct}%</span>
        </div>
        ${g.target ? `<div class="wg-target">${esc(g.target)}</div>` : ''}
        <div class="wg-bar-bg"><div class="wg-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
      </div>`;
    }).join('');

    return `<div class="work-goal-card">
      <div class="wg-header">
        <span class="wg-title">目標の進捗</span>
        <button class="btn btn-xs btn-secondary" onclick="app.navigate('record')">＋ 追加</button>
      </div>
      ${rows}
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
        <div class="diary-input-row">
          <textarea id="diaryText" class="form-input diary-textarea" rows="4"
            placeholder="${i18n.t('quick_input_placeholder')}"></textarea>
          <button class="btn btn-voice diary-voice" id="voiceBtn_diaryText" onclick="app.startVoiceInput('diaryText')" title="音声入力">🎤</button>
        </div>
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
    const color = domainConfig?.color || '#6C63FF';
    const recs = (store.get('recommendations') || []).filter(r => r.domain === domain || !r.domain);
    const actions = (store.get('actionItems') || []).filter(a => a.domain === domain || !a.domain);
    const latest = store.get('latestAnalysis');
    const lastAnalysisTime = latest ? new Date(latest.timestamp).toLocaleDateString('ja-JP') : null;

    const categories = Object.keys(domainConfig?.categories || {});
    let totalRecords = 0;
    categories.forEach(cat => { totalRecords += store.getDomainData(domain, cat, 7).length; });

    const domainDescriptions = {
      consciousness: ['気持ちのパターンと変化', '七つのレイヤーの状態', '心が安らぐ習慣のヒント'],
      health:        ['体調の変化の傾向', '疲れやすい時間帯や原因', '医師に伝えるべき変化'],
      time:          ['時間の使い方の傾向', '生産性が上がる時間帯', '空き時間の活用アイデア'],
      work:          ['あなたの強みと可能性', '始めやすい活動・副業', '収入を増やすヒント'],
      relationship:  ['大切な人との繋がり状況', '連絡が足りていない人', '孤立リスクの早期発見'],
      assets:        ['家計の健全度', '無駄な出費のパターン', '将来の生活費の見通し']
    };
    const desc = domainDescriptions[domain] || ['記録のパターン', '変化の傾向', '具体的な改善案'];

    let html = `<div class="page-actions">

      <div class="actions-status-card" style="border-left-color:${color}">
        <div class="asc-left">
          <div class="asc-domain">${domainConfig?.icon || ''} ${i18n.t(domain)}</div>
          <div class="asc-records">${totalRecords > 0
            ? `直近7日間の記録: <strong>${totalRecords}件</strong> ✅`
            : '記録がまだありません。記録を増やすほど精度が上がります。'
          }</div>
          ${lastAnalysisTime ? `<div class="asc-last">最後の分析: ${lastAnalysisTime}</div>` : ''}
        </div>
        ${totalRecords === 0
          ? `<button class="btn btn-sm btn-secondary" onclick="app.navigate('record')">記録する →</button>`
          : ''}
      </div>

      <div class="analysis-preview-card">
        <div class="apc-title">分析でわかること</div>
        <ul class="apc-list">
          ${desc.map(d => `<li>✦ ${d}</li>`).join('')}
        </ul>
      </div>

      <div class="action-generate">
        <button class="btn btn-primary btn-lg btn-analyze" onclick="app.generateRecommendations('${domain}')">
          <span class="btn-analyze-icon">🔍</span>
          <span class="btn-analyze-text">
            <span class="btn-analyze-main">${i18n.t(domain)}の分析を実行</span>
            <span class="btn-analyze-sub">記録から傾向を見つけます</span>
          </span>
        </button>
        <button class="btn btn-secondary btn-holistic" onclick="app.generateRecommendations('holistic')">
          🌐 6領域まとめて分析
        </button>
      </div>`;

    if (store.get('isAnalyzing')) {
      html += Components.loading(i18n.t('analyzing'));
    }

    if (recs.length > 0) {
      html += `<div class="recommendations-list">
        <h3>${i18n.t('your_recommendations')}</h3>
        ${recs.map(r => Components.recommendationCard(r)).join('')}
      </div>`;
    } else if (!store.get('isAnalyzing')) {
      html += `<div class="analysis-empty-hint">
        <div class="aeh-icon">💡</div>
        <div class="aeh-text">分析を実行すると、あなたの記録から傾向を見つけて、具体的な提案が届きます</div>
      </div>`;
    }

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

    const renderSchemaSection = (sectionKey, sectionTitle, startOpen = false) => {
      const fields = schema[sectionKey] || [];
      if (fields.length === 0) return '';
      const filled = fields.filter(f => {
        const v = profile[f.key];
        return v !== undefined && v !== null && v !== '';
      }).length;
      const badge = filled > 0 ? `<span class="ss-count">${filled}/${fields.length}</span>` : '';
      return `<div class="settings-section ss-collapsible ${startOpen ? 'ss-open' : ''}">
        <h3 class="ss-head" onclick="this.parentNode.classList.toggle('ss-open')">
          ${sectionTitle}${badge}
          <span class="ss-arrow">▾</span>
        </h3>
        <div class="ss-body">
          ${fields.map(f => `
            <div class="form-group">
              <label>${f.label}</label>
              ${renderField(f, profile[f.key])}
            </div>
          `).join('')}
        </div>
      </div>`;
    };

    // Diseases (WHO ICD-11 based multi-select)
    const selectedDiseases = Array.isArray(profile.diseases) ? profile.diseases : [];
    const renderDiseases = () => {
      const cats = CONFIG.diseaseCategories || {};
      const badge = selectedDiseases.length > 0 ? `<span class="ss-count">${selectedDiseases.length}件選択中</span>` : '';
      const isOpen = selectedDiseases.length > 0;
      return `<div class="settings-section ss-collapsible ${isOpen ? 'ss-open' : ''}">
        <h3 class="ss-head" onclick="this.parentNode.classList.toggle('ss-open')">
          持病・症状${badge}
          <span class="ss-arrow">▾</span>
        </h3>
        <div class="ss-body">
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
        </div>
      </div>`;
    };

    const curTheme = localStorage.getItem('lms_theme') || 'light';
    const curSize = localStorage.getItem('lms_textSize') || 'normal';

    let html = `<div class="page-settings">
      <h2>${i18n.t('settings')}</h2>

      <!-- 文字・テーマ（アクセシビリティ） -->
      <div class="settings-access-bar">
        <div class="sab-group">
          <div class="sab-label">文字の大きさ</div>
          <div class="sab-btns">
            ${['normal','lg','xl'].map(sz => {
              const labels = { normal: '標準', lg: '大きめ', xl: '特大' };
              return `<button class="sab-btn ${curSize === sz ? 'active' : ''}" onclick="app.setTextSize('${sz}')">${labels[sz]}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="sab-group">
          <div class="sab-label">画面の明るさ</div>
          <div class="sab-btns">
            ${['light','dark'].map(t => {
              const labels = { light: '☀️ 標準', dark: '🌙 ダーク' };
              return `<button class="sab-btn ${curTheme === t ? 'active' : ''}" onclick="app.setTheme('${t}')">${labels[t]}</button>`;
            }).join('')}
          </div>
        </div>
      </div>

      ${this.renderProfileCompletion(profile)}

      <!-- 基本情報 -->
      ${renderSchemaSection('basic', '基本情報', true)}

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
      <div class="settings-section ss-collapsible">
        <h3 class="ss-head" onclick="this.parentNode.classList.toggle('ss-open')">
          言語
          <span class="ss-arrow">▾</span>
        </h3>
        <div class="ss-body">
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
        <h3>💾 データのバックアップ・復元</h3>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:12px">記録データをファイルに保存したり、別の端末に移行できます。</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="app.exportData()">全データをJSON形式で保存</button>
          <button class="btn btn-secondary" onclick="app.exportDomainCSV('${domain}')">CSVで保存（${Components.escapeHtml(i18n.t(domain))}）</button>
        </div>
        <div style="margin-top:10px">
          <input type="file" id="importFile" accept=".json" onchange="app.importData(event)" style="display:none">
          <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">バックアップから復元（JSON）</button>
        </div>
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

      <!-- Account Deletion (GDPR / 個人情報削除) -->
      <div class="settings-section settings-danger-zone">
        <h3>アカウントとデータの削除</h3>
        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:14px">
          アカウントを削除すると、すべての記録・プロフィール・設定が完全に消去されます。<br>この操作は取り消せません。
        </p>
        <button class="btn btn-danger-outline" onclick="app.confirmDeleteAccount()">データとアカウントを削除する</button>
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

  // ─── Morning vitals quick-entry (health domain, 5am–11am only) ───
  renderMorningVitalsCard() {
    const hour = new Date().getHours();
    if (hour < 5 || hour >= 11) return '';

    // Don't show if vitals already recorded today
    const today = new Date().toISOString().split('T')[0];
    const vitals = store.get('health_vitals') || [];
    if (vitals.some(e => (e.timestamp || '').startsWith(today))) return '';

    return `<div class="morning-vitals-card">
      <div class="mvc-header">
        <span class="mvc-icon">🌅</span>
        <div>
          <div class="mvc-title">朝の健康チェック</div>
          <div class="mvc-sub">血圧・体重を記録しておきましょう</div>
        </div>
      </div>
      <div class="mvc-fields">
        <div class="mvc-field-group">
          <label class="mvc-label">血圧（上 / 下）</label>
          <div class="mvc-bp-row">
            <input type="number" id="mvc_sys" class="form-input mvc-input" placeholder="120" min="60" max="250">
            <span class="mvc-slash">/</span>
            <input type="number" id="mvc_dia" class="form-input mvc-input" placeholder="80" min="40" max="150">
            <span class="mvc-unit">mmHg</span>
          </div>
        </div>
        <div class="mvc-field-group">
          <label class="mvc-label">体重</label>
          <div class="mvc-bp-row">
            <input type="number" id="mvc_weight" class="form-input mvc-input" placeholder="65.0" step="0.1" min="20" max="200">
            <span class="mvc-unit">kg</span>
          </div>
        </div>
        <div class="mvc-field-group">
          <label class="mvc-label">今朝の睡眠</label>
          <div class="mvc-sleep-row">
            ${[['😴','1'],['😕','3'],['😐','5'],['🙂','7'],['😄','9']].map(([e, v]) =>
              `<button type="button" class="mvc-sleep-btn" data-val="${v}" onclick="app.selectMorningSleep(${v}, this)">${e}</button>`
            ).join('')}
          </div>
          <input type="hidden" id="mvc_sleep" value="">
        </div>
      </div>
      <button class="btn btn-primary mvc-save" onclick="app.saveMorningVitals()">記録する</button>
      <button class="btn-text mvc-skip" onclick="this.closest('.morning-vitals-card').remove()">スキップ</button>
    </div>`;
  },

  // ─── Water intake tracker (health domain) ───
  renderWaterTracker() {
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_water_' + today;
    let ml = 0;
    try { ml = parseInt(localStorage.getItem(lsKey) || '0', 10); } catch(e) {}

    const goalMl = 1500;
    const pct = Math.min(100, Math.round(ml / goalMl * 100));
    const glasses = Math.round(ml / 200);
    const remaining = Math.max(0, goalMl - ml);

    const glassRow = [1,2,3,4,5,6,7,8].map(n => {
      const filled = n * 200 <= ml;
      return `<button class="wt-glass ${filled ? 'filled' : ''}"
        onclick="Pages.toggleWaterGlass(${n})" title="${n * 200}ml">
        <span class="wt-drop">${filled ? '💧' : '○'}</span>
      </button>`;
    }).join('');

    const doneMsg = ml >= goalMl ?
      '<div class="wt-goal-met">今日の水分目標を達成しました！</div>' : '';

    return `<div class="water-tracker-card">
      <div class="wt-header">
        <span class="wt-title">💧 水分補給</span>
        <span class="wt-total">${ml >= 1000 ? (ml/1000).toFixed(1)+'L' : ml+'ml'}</span>
      </div>
      <div class="wt-bar-wrap">
        <div class="wt-bar-bg">
          <div class="wt-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="wt-pct">${pct}%</span>
      </div>
      <div class="wt-glasses">${glassRow}</div>
      ${doneMsg}
      ${remaining > 0 ? `<div class="wt-remaining">あと <strong>${remaining >= 1000 ? (remaining/1000).toFixed(1)+'L' : remaining+'ml'}</strong>（コップ約${Math.ceil(remaining/200)}杯）</div>` : ''}
      <div class="wt-hint">各コップ約200ml。コップをタップして記録できます。</div>
    </div>`;
  },

  toggleWaterGlass(glassNum) {
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_water_' + today;
    let ml = 0;
    try { ml = parseInt(localStorage.getItem(lsKey) || '0', 10); } catch(e) {}

    const target = glassNum * 200;
    // If clicking on a filled glass — fill up to that glass exactly
    // If clicking beyond current — fill up to that glass
    // If clicking on the last filled glass — remove that glass
    if (ml === target) {
      ml = target - 200; // undo last glass
    } else {
      ml = target;
    }
    ml = Math.max(0, ml);
    localStorage.setItem(lsKey, String(ml));

    // Sync daily totals to Firestore once (at 1000ml+ threshold)
    if (ml >= 1000 && !localStorage.getItem('lms_waterSynced_' + today)) {
      store.addDomainEntry('health', 'symptoms', { water_ml: ml, notes: '水分補給記録' });
      localStorage.setItem('lms_waterSynced_' + today, '1');
    }

    if (typeof app !== 'undefined') app.renderApp();
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
    if (meds.length === 0) {
      // Show compact setup prompt so users know the feature exists
      const today = new Date().toISOString().split('T')[0];
      const dismissed = localStorage.getItem('lms_medSetup_dismissed');
      if (dismissed) return '';
      return `<div class="med-setup-prompt">
        <div class="med-setup-header">
          <span class="med-icon">💊</span>
          <div>
            <strong>お薬を登録すると服薬チェックができます</strong>
            <span class="med-setup-sub">血圧の薬・睡眠薬・サプリなど何でも</span>
          </div>
          <button class="med-setup-close" onclick="localStorage.setItem('lms_medSetup_dismissed','1');this.closest('.med-setup-prompt').remove()">×</button>
        </div>
        <div class="med-quick-add" id="medQuickAdd" style="display:none">
          <input type="text" id="mqMedName" class="form-input" placeholder="薬の名前（例：降圧剤、アムロジピン）" maxlength="30">
          <select id="mqTiming" class="form-input">
            <option value="morning">朝</option>
            <option value="noon">昼</option>
            <option value="evening">夕方</option>
            <option value="bedtime">就寝前</option>
          </select>
          <div class="med-quick-btns">
            <button class="btn btn-sm btn-primary" onclick="Pages.saveQuickMed()">追加する</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('medQuickAdd').style.display='none'">閉じる</button>
          </div>
        </div>
        <div class="med-setup-actions">
          <button class="btn btn-sm btn-primary" onclick="document.getElementById('medQuickAdd').style.display='block';this.style.display='none'">今すぐ登録</button>
          <button class="btn btn-sm btn-secondary" onclick="app.navigate('record')">詳細設定 →</button>
        </div>
      </div>`;
    }

    const today = new Date().toISOString().split('T')[0];
    const symptoms = store.get('health_symptoms') || [];
    const medDates = new Set(symptoms.filter(e => e.medications_taken && e.timestamp).map(e => e.timestamp.split('T')[0]));
    const takenToday = medDates.has(today);

    // 28-day adherence heatmap (shared between taken/not-taken states)
    const heatmapCells = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().split('T')[0];
      heatmapCells.push({ k, taken: medDates.has(k), isToday: i === 0 });
    }
    const takenCount = heatmapCells.filter(c => c.taken).length;
    const adherencePct = Math.round((takenCount / 28) * 100);
    const rateColor = adherencePct >= 80 ? '#10b981' : adherencePct >= 60 ? '#f59e0b' : '#ef4444';
    const heatmapHtml = takenCount >= 2 ? `<div class="med-adherence">
      <div class="med-adh-header">
        <span class="med-adh-label">28日間の服薬記録</span>
        <span class="med-adh-rate" style="color:${rateColor}">${adherencePct}%</span>
      </div>
      <div class="med-adh-grid">
        ${heatmapCells.map(c => `<div class="ht-cell ${c.taken ? 'level-3' : 'level-0'}${c.isToday ? ' med-adh-today' : ''}" title="${c.k}"></div>`).join('')}
      </div>
    </div>` : '';

    if (takenToday) {
      let medStreak = 0;
      const cur = new Date();
      while (medStreak < 90) {
        const k = cur.toISOString().split('T')[0];
        if (!medDates.has(k)) break;
        medStreak++;
        cur.setDate(cur.getDate() - 1);
      }
      const streakText = medStreak >= 2 ? `<span class="streak-badge">${medStreak}日連続</span>` : '';
      return `<div class="med-reminder med-done">
        <div class="med-done-row">
          <span class="med-check">✓</span>
          <span>今日のお薬 完了</span>
          ${streakText}
        </div>
        ${heatmapHtml}
      </div>`;
    }

    // List unique medication names
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
      ${heatmapHtml}
    </div>`;
  },

  saveQuickMed() {
    const name = document.getElementById('mqMedName')?.value?.trim();
    const timing = document.getElementById('mqTiming')?.value || 'morning';
    if (!name) { Components.showToast('薬の名前を入力してください', 'error'); return; }
    store.addDomainEntry('health', 'medications', { name, timing, dosage: '' });
    Components.showToast(`「${name}」を登録しました`, 'success');
    if (typeof app !== 'undefined') app.renderApp();
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

  // ─── Today's summary bar (shows after first entry of the day) ───
  renderTodaySummary(domain) {
    const today = new Date().toISOString().split('T')[0];
    const cats = Object.keys(CONFIG.domains[domain]?.categories || {});
    const todayEntries = [];
    cats.forEach(cat => {
      store.getDomainData(domain, cat, 1).forEach(e => {
        if ((e.timestamp || '').startsWith(today)) todayEntries.push({ ...e, _cat: cat });
      });
    });
    // Also include prompt replies saved today
    const promptReply = localStorage.getItem(`lms_promptReply_${domain}_${today}`);

    if (todayEntries.length === 0 && !promptReply) return '';

    const esc = Components.escapeHtml;
    const summaryLines = [];
    if (domain === 'health') {
      const s = todayEntries.find(e => e._cat === 'symptoms' && e.condition_level);
      if (s) summaryLines.push(`体調 ${s.condition_level}/10`);
      if (todayEntries.some(e => e.medications_taken)) summaryLines.push('服薬 ✓');
    }
    if (domain === 'consciousness') {
      const e = todayEntries.find(e => e.mood_level);
      if (e) summaryLines.push(`気分 ${e.mood_level}/10`);
      if (todayEntries.some(e => e._cat === 'appreciation' || e._cat === 'entries')) summaryLines.push('感謝 ✓');
    }
    if (domain === 'time') {
      const e = todayEntries.find(e => e.productivity);
      if (e) summaryLines.push(`充実度 ${e.productivity}/10`);
    }
    if (domain === 'work') {
      if (todayEntries.some(e => e.status === 'done' || e.notes === '活動した')) summaryLines.push('活動済み ✓');
    }
    if (domain === 'relationship') {
      const names = [...new Set(todayEntries.map(e => e.person).filter(Boolean))];
      if (names.length > 0) summaryLines.push(`連絡: ${names.slice(0, 2).map(n => esc(n)).join('・')}`);
    }
    if (domain === 'assets') {
      const exps = todayEntries.filter(e => e._cat === 'expenses' && e.amount);
      const incs = todayEntries.filter(e => e._cat === 'income' && e.amount);
      if (exps.length > 0) {
        const total = exps.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        summaryLines.push(`出費 ¥${total.toLocaleString()}`);
      }
      if (incs.length > 0) {
        const total = incs.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        summaryLines.push(`収入 ¥${total.toLocaleString()}`);
      }
    }
    if (promptReply) summaryLines.push('問いかけ ✓');
    summaryLines.push(`記録 ${todayEntries.length}件`);

    const color = CONFIG.domains[domain]?.color || '#6C63FF';
    return `<div class="today-summary-bar" style="border-left-color:${color}">
      <span class="tsb-label">今日</span>
      ${summaryLines.map(l => `<span class="tsb-item">${l}</span>`).join('')}
    </div>`;
  },

  // ─── Personalized daily greeting card ───
  renderDailyGreeting(domain) {
    const profile = store.get('userProfile') || {};
    const name = profile.displayName || profile.name || store.get('user')?.displayName || '';
    const hour = new Date().getHours();
    const greeting = hour < 11 ? 'おはようございます' : hour < 17 ? 'こんにちは' : 'こんばんは';
    const today = new Date();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${dayNames[today.getDay()]}）`;
    const color = CONFIG.domains[domain]?.color || '#6C63FF';

    // Overall streak across all domains
    const allDates = new Set();
    Object.keys(CONFIG.domains).forEach(d => {
      Object.keys(CONFIG.domains[d]?.categories || {}).forEach(cat => {
        store.getDomainData(d, cat, 90).forEach(e => {
          if (e.timestamp) allDates.add(e.timestamp.split('T')[0]);
        });
      });
    });
    const todayKey = today.toISOString().split('T')[0];
    let streak = 0;
    const cur = new Date(today);
    if (!allDates.has(todayKey)) cur.setDate(cur.getDate() - 1);
    while (streak <= 90) {
      if (!allDates.has(cur.toISOString().split('T')[0])) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    let streakText;
    if (streak >= 30) streakText = `🏆 ${streak}日連続記録中！`;
    else if (streak >= 7)  streakText = `⭐ ${streak}日連続記録中`;
    else if (streak >= 2)  streakText = `🔥 ${streak}日連続記録中`;
    else if (streak === 1) streakText = '✅ 今日も記録済み';
    else                   streakText = '📝 今日もつけてみましょう';

    const nameStr = name ? `、${Components.escapeHtml(name)}さん` : '';
    return `<div class="daily-greeting" style="--dg-color:${color}">
      <div class="dg-text">
        <div class="dg-greeting">${greeting}${nameStr}！</div>
        <div class="dg-date">${dateStr}</div>
      </div>
      <div class="dg-streak">${streakText}</div>
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
    const moodScale = (onclickFn) => [
      ['😢','1','とても辛い'],['😕','3','少し辛い'],['😐','5','普通'],['🙂','7','良い'],['😄','9','とても良い']
    ].map(([emoji, val, label]) =>
      `<button class="mood-btn" title="${Components.escapeHtml(label)}" onclick="${onclickFn}(${val})" aria-label="${Components.escapeHtml(label)}">
        <span class="mood-emoji">${emoji}</span>
        <span class="mood-label">${Components.escapeHtml(label)}</span>
      </button>`
    ).join('');

    if (domain === 'health') {
      const hour = new Date().getHours();
      const isEvening = hour >= 17;
      const promptText = hour < 11 ? '今朝の目覚めは？' : isEvening ? '今夜の体調は？' : '今日の体調は？';
      return `<div class="checkin-nudge checkin-nudge-health">
        <div class="checkin-nudge-top">
          <span class="checkin-nudge-text">${promptText}${streak >= 2 ? '　' : ''}</span>
          ${streakBadge}
        </div>
        <div class="mood-picker">${moodScale('app.quickMoodCheckin')}</div>
      </div>`;
    }
    if (domain === 'consciousness') {
      const hour = new Date().getHours();
      const promptText = hour < 11 ? '今朝の気持ちは？' : hour >= 17 ? '今夜の心の状態は？' : '今の気持ちは？';
      return `<div class="checkin-nudge checkin-nudge-health">
        <div class="checkin-nudge-top">
          <span class="checkin-nudge-text">${promptText}${streak >= 2 ? '　' : ''}</span>
          ${streakBadge}
        </div>
        <div class="mood-picker">${moodScale('app.quickConsciousnessCheckin')}</div>
      </div>`;
    }
    if (domain === 'time') {
      return `<div class="checkin-nudge checkin-nudge-health">
        <div class="checkin-nudge-top">
          <span class="checkin-nudge-text">今日の充実度は？${streak >= 2 ? '　' : ''}</span>
          ${streakBadge}
        </div>
        <div class="mood-picker">
          ${[['😴','1','退屈'],['😐','3','普通'],['🙂','5','まあまあ'],['😊','7','充実'],['🌟','9','とても充実']].map(([emoji, val, label]) =>
            `<button class="mood-btn" title="${Components.escapeHtml(label)}" onclick="app.quickTimeCheckin(${val})" aria-label="${Components.escapeHtml(label)}">
              <span class="mood-emoji">${emoji}</span>
              <span class="mood-label">${Components.escapeHtml(label)}</span>
            </button>`
          ).join('')}
        </div>
      </div>`;
    }
    if (domain === 'work') {
      return `<div class="checkin-nudge">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
          <span class="checkin-nudge-text">今日の活動は？${streak >= 2 ? '　' : ''}${streakBadge}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="app.quickWorkCheckin('active')">🙌 活動した</button>
            <button class="btn btn-sm btn-secondary" onclick="app.quickWorkCheckin('planned')">📅 予定あり</button>
            <button class="btn btn-sm btn-secondary" onclick="app.quickWorkCheckin('rest')">🌿 休み</button>
          </div>
        </div>
      </div>`;
    }
    if (domain === 'relationship') {
      return `<div class="checkin-nudge">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
          <span class="checkin-nudge-text">今日誰かに連絡しましたか？${streak >= 2 ? '　' : ''}${streakBadge}</span>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-primary" onclick="app.quickRelationshipCheckin(true)">✅ 連絡した</button>
            <button class="btn btn-sm btn-secondary" onclick="app.quickRelationshipCheckin(false)">まだ</button>
          </div>
        </div>
      </div>`;
    }
    if (domain === 'assets') {
      return `<div class="checkin-nudge">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;gap:8px;">
          <span class="checkin-nudge-text">今日の収支を記録しませんか？${streak >= 2 ? '　' : ''}${streakBadge}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" onclick="app.quickExpenseEntry()">💰 出費を記録</button>
            <button class="btn btn-sm btn-secondary" onclick="app.quickIncomeEntry()">📥 収入を記録</button>
          </div>
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

    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const q = prompts[doy % prompts.length];
    const today = new Date().toISOString().split('T')[0];
    const savedReply = localStorage.getItem(`lms_promptReply_${domain}_${today}`);

    if (savedReply) {
      return `<div class="daily-prompt-card dp-done">
        <div class="dp-label">今日の問いかけ <span class="dp-done-badge">✓ 記録済み</span></div>
        <div class="dp-question">${Components.escapeHtml(q)}</div>
        <div class="dp-reply">${Components.escapeHtml(savedReply)}</div>
      </div>`;
    }

    const qEsc = Components.escapeHtml(q).replace(/'/g, '&#39;');
    return `<div class="daily-prompt-card">
      <div class="dp-label">今日の問いかけ</div>
      <div class="dp-question">${Components.escapeHtml(q)}</div>
      <div class="dp-input-row">
        <textarea id="dpReply_${domain}" class="form-input dp-reply-input" rows="3" placeholder="思ったことをそのまま書いてください。正解はありません"></textarea>
        <button class="btn btn-voice dp-voice" id="voiceBtn_dpReply_${domain}" onclick="app.startVoiceInput('dpReply_${domain}')" title="音声入力">🎤</button>
      </div>
      <div class="dp-actions">
        <button class="btn btn-sm btn-primary" onclick="Pages.savePromptReply('${domain}', '${qEsc}')">書き留める</button>
        <button class="btn btn-sm btn-secondary" onclick="app.replyToPrompt('${qEsc}')">相談する →</button>
      </div>
    </div>`;
  },

  savePromptReply(domain, question) {
    const el = document.getElementById('dpReply_' + domain);
    if (!el || !el.value.trim()) {
      Components.showToast('回答を入力してください', 'error');
      return;
    }
    const text = el.value.trim();
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`lms_promptReply_${domain}_${today}`, text);

    const catMap = {
      consciousness: ['entries',      { reflection: text, prompt_question: question }],
      health:        ['symptoms',     { notes: text, prompt_question: question }],
      time:          ['entries',      { activity: '問いかけへの回答', notes: text, prompt_question: question }],
      work:          ['reviews',      { achievements: text, period: today, prompt_question: question }],
      relationship:  ['interactions', { person: '（日記）', type: 'other', notes: text, prompt_question: question }],
      assets:        ['overview',     { notes: text, prompt_question: question }]
    };
    const entry = catMap[domain];
    if (entry) store.addDomainEntry(domain, entry[0], entry[1]);
    Components.showToast('記録しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Rule-based domain insight (shows after 3+ days of data, no AI needed) ───
  renderDomainInsight(domain) {
    const cats = Object.keys(CONFIG.domains[domain]?.categories || {});
    const week1 = [], week2 = [];
    const now = new Date();
    cats.forEach(cat => {
      store.getDomainData(domain, cat, 14).forEach(e => {
        if (!e.timestamp) return;
        const daysAgo = Math.floor((now - new Date(e.timestamp)) / 86400000);
        const tagged = { ...e, _category: cat };
        if (daysAgo < 7)  week1.push(tagged);
        else              week2.push(tagged);
      });
    });

    if (week1.length < 3) return ''; // not enough data yet

    const color = CONFIG.domains[domain]?.color || '#6C63FF';
    let icon = '📊', msg = '';

    if (domain === 'health') {
      const avg1 = week1.filter(e => e.condition_level).reduce((s,e,_,a) => s + e.condition_level/a.length, 0);
      const avg2 = week2.filter(e => e.condition_level).reduce((s,e,_,a) => s + e.condition_level/a.length, 0);
      if (avg1 > 0) {
        const rounded = avg1.toFixed(1);
        if (week2.length >= 3 && avg2 > 0) {
          const diff = avg1 - avg2;
          if (diff >= 0.5)       msg = `今週の平均体調は${rounded}/10です。先週より${diff.toFixed(1)}ポイント上がっています。`;
          else if (diff <= -0.5) msg = `今週の平均体調は${rounded}/10です。先週より少し下がっています。無理しないでください。`;
          else                    msg = `今週の平均体調は${rounded}/10。先週と同じ水準を保っています。`;
        } else {
          msg = `今週の平均体調スコアは${rounded}/10です。記録を続けると変化が分かります。`;
        }
        icon = avg1 >= 7 ? '💚' : avg1 >= 5 ? '🌿' : '⚠️';
      }
    }
    if (domain === 'consciousness') {
      const moods = week1.filter(e => e.mood_level);
      if (moods.length >= 3) {
        const avg = (moods.reduce((s,e) => s + e.mood_level, 0) / moods.length).toFixed(1);
        icon = avg >= 7 ? '😊' : '🌙';
        msg = `今週の気分スコアの平均は${avg}/10です。`;
        const gratitude = week1.filter(e => e._category === 'appreciation' || e._category === 'entries');
        if (gratitude.length >= 3) msg += '感謝の記録もよく続いています。';
      }
    }
    if (domain === 'time') {
      const prod = week1.filter(e => e.productivity);
      if (prod.length >= 3) {
        const avg = (prod.reduce((s,e) => s + e.productivity, 0) / prod.length).toFixed(1);
        icon = '⏱';
        msg = `今週の充実度の平均は${avg}/10です。`;
      }
    }
    if (domain === 'work') {
      const active = week1.filter(e => e.status === 'done' || (e.notes && e.notes.includes('活動した')));
      if (active.length > 0) {
        icon = '💼';
        msg = `今週は${active.length}日間、活動の記録があります。`;
      }
    }
    if (domain === 'relationship') {
      const names = new Set(week1.map(e => e.person).filter(Boolean));
      if (names.size > 0) {
        icon = '🤝';
        msg = `今週は${names.size}人の方と交流の記録があります。`;
        const prev = new Set(week2.map(e => e.person).filter(Boolean));
        if (names.size > prev.size) msg += '先週より多い交流です。';
      }
    }
    if (domain === 'assets') {
      const exps = week1.filter(e => e._category === 'expenses' && e.amount);
      if (exps.length > 0) {
        const total = exps.reduce((s,e) => s + (parseFloat(e.amount) || 0), 0);
        icon = '💰';
        msg = `今週の出費の記録: 合計¥${Math.round(total).toLocaleString()}。`;
        const prevExps = week2.filter(e => e._category === 'expenses' && e.amount);
        if (prevExps.length > 0) {
          const prevTotal = prevExps.reduce((s,e) => s + (parseFloat(e.amount) || 0), 0);
          if (total < prevTotal * 0.9) msg += '先週より節約できています。';
        }
      }
    }

    if (!msg) return '';

    return `<div class="domain-insight-card" style="border-left-color:${color}">
      <span class="dic-icon">${icon}</span>
      <span class="dic-msg">${msg}</span>
    </div>`;
  },

  // ─── Family share card (drives organic growth via LINE/SNS) ───
  // ─── Achievement milestone system ───
  _achievementDefs: [
    { id: 'first_entry',      icon: '🌱', title: 'はじめの一歩',   desc: '最初の記録を入力しました' },
    { id: 'streak_3',         icon: '🔥', title: '3日連続',        desc: '3日連続で記録しました' },
    { id: 'streak_7',         icon: '✨', title: '7日連続',        desc: '1週間、毎日記録しました！' },
    { id: 'streak_30',        icon: '🌟', title: '30日連続',       desc: '1ヵ月間、毎日記録しました！' },
    { id: 'all_6_domains',    icon: '🎯', title: '6領域制覇',      desc: '6つすべての領域に記録があります' },
    { id: 'entries_100',      icon: '💯', title: '100件達成',      desc: '合計100件の記録を達成しました' },
    { id: 'medication_7',     icon: '💊', title: 'お薬習慣',       desc: '7日連続でお薬を記録しました' },
    { id: 'contacts_10',      icon: '👥', title: 'つながり達人',   desc: '10人以上と交流を記録しました' },
    { id: 'checkin_14',       icon: '☀️', title: '朝の習慣',      desc: '14日間、朝のチェックインを完了しました' },
    { id: 'breath_5',         icon: '🫁', title: '呼吸の達人',     desc: '呼吸法を5回記録しました' }
  ],

  checkAchievements() {
    const unlocked = new Set(JSON.parse(localStorage.getItem('lms_achievements') || '[]'));
    const newlyUnlocked = [];

    // Collect all-domain entries
    let totalEntries = 0;
    const domainsWithData = new Set();
    Object.keys(CONFIG.domains).forEach(d => {
      Object.keys(CONFIG.domains[d]?.categories || {}).forEach(cat => {
        const data = store.getDomainData(d, cat, 365);
        totalEntries += data.length;
        if (data.length > 0) domainsWithData.add(d);
      });
    });

    // Overall streak
    const allDates = new Set();
    Object.keys(CONFIG.domains).forEach(d => {
      Object.keys(CONFIG.domains[d]?.categories || {}).forEach(cat => {
        store.getDomainData(d, cat, 90).forEach(e => { if (e.timestamp) allDates.add(e.timestamp.split('T')[0]); });
      });
    });
    const todayKey = new Date().toISOString().split('T')[0];
    let streak = 0;
    const cur = new Date();
    if (!allDates.has(todayKey)) cur.setDate(cur.getDate() - 1);
    while (streak <= 90) {
      if (!allDates.has(cur.toISOString().split('T')[0])) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    // Medication streak
    const medDates = new Set(
      store.getDomainData('health', 'symptoms', 30)
        .filter(e => e.medications_taken && e.timestamp)
        .map(e => e.timestamp.split('T')[0])
    );
    let medStreak = 0;
    const mc = new Date();
    while (medStreak <= 30) {
      if (!medDates.has(mc.toISOString().split('T')[0])) break;
      medStreak++;
      mc.setDate(mc.getDate() - 1);
    }

    // Unique contacts
    const uniqueContacts = new Set(
      store.getDomainData('relationship', 'interactions', 365)
        .map(e => e.person).filter(Boolean)
    );

    // Checkin count
    let checkinCount = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (localStorage.getItem('lms_checkin_' + d.toISOString().split('T')[0])) checkinCount++;
    }

    // Breathing count
    const breathCount = store.getDomainData('consciousness', 'practices', 365)
      .filter(e => e.practice_type === 'breathwork').length;

    const checks = {
      first_entry:   totalEntries >= 1,
      streak_3:      streak >= 3,
      streak_7:      streak >= 7,
      streak_30:     streak >= 30,
      all_6_domains: domainsWithData.size >= 6,
      entries_100:   totalEntries >= 100,
      medication_7:  medStreak >= 7,
      contacts_10:   uniqueContacts.size >= 10,
      checkin_14:    checkinCount >= 14,
      breath_5:      breathCount >= 5
    };

    this._achievementDefs.forEach(def => {
      if (checks[def.id] && !unlocked.has(def.id)) {
        unlocked.add(def.id);
        newlyUnlocked.push(def);
      }
    });

    localStorage.setItem('lms_achievements', JSON.stringify([...unlocked]));
    return { unlocked: [...unlocked], newlyUnlocked };
  },

  renderAchievementBadges() {
    const unlocked = new Set(JSON.parse(localStorage.getItem('lms_achievements') || '[]'));
    if (unlocked.size === 0) return '';
    const defs = this._achievementDefs;
    const badges = defs.filter(d => unlocked.has(d.id));
    return `<div class="achievement-badges">
      <div class="ab-header">
        <span class="ab-title">実績 <strong>${badges.length}</strong>/<span style="opacity:.6">${defs.length}</span></span>
      </div>
      <div class="ab-list">
        ${badges.map(b => `<div class="ab-badge" title="${b.title}：${b.desc}">${b.icon}</div>`).join('')}
        ${defs.filter(d => !unlocked.has(d.id)).map(() => `<div class="ab-badge ab-locked">🔒</div>`).join('')}
      </div>
    </div>`;
  },

  showNewAchievement(def) {
    const existing = document.getElementById('achievementToast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'achievementToast';
    el.className = 'achievement-toast';
    el.innerHTML = `<div class="at-icon">${def.icon}</div><div class="at-body"><strong>${def.title}</strong><span>${def.desc}</span></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('at-show'), 50);
    setTimeout(() => { el.classList.remove('at-show'); setTimeout(() => el.remove(), 400); }, 4000);
  },

  renderFamilyShareCard(domain) {
    // Only health & consciousness domains get the family share card
    if (!['health', 'consciousness', 'relationship'].includes(domain)) return '';

    // Show on weekends, or if user has 5+ day streak (social sharing moment)
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    // Check if dismissed this week
    const today = new Date();
    const weekKey = `${today.getFullYear()}-W${Pages._isoWeek(today)}`;
    if (localStorage.getItem('lms_familyShareDismissed') === weekKey) return '';

    // Need at least 3 records in last 7 days to have something to report
    const cats = Object.keys(CONFIG.domains[domain]?.categories || {});
    let recordCount = 0;
    cats.forEach(cat => { recordCount += store.getDomainData(domain, cat, 7).length; });
    if (recordCount < 3) return '';

    if (!isWeekend) return '';

    const color = CONFIG.domains[domain]?.color || '#6C63FF';
    return `<div class="family-share-card" style="border-left-color:${color}">
      <div class="fsc-left">
        <div class="fsc-icon">👨‍👩‍👧</div>
        <div class="fsc-text">
          <div class="fsc-title">今週の記録を家族に知らせましょう</div>
          <div class="fsc-desc">LINEや SMS で近況を共有できます</div>
        </div>
      </div>
      <div class="fsc-actions">
        <button class="btn btn-sm btn-primary" onclick="app.openFamilyReport()">報告を作る</button>
        <button class="btn btn-sm btn-text" onclick="Pages.dismissFamilyShare('${weekKey}')">×</button>
      </div>
    </div>`;
  },

  dismissFamilyShare(weekKey) {
    localStorage.setItem('lms_familyShareDismissed', weekKey);
    const card = document.querySelector('.family-share-card');
    if (card) card.remove();
  },

  // ISO week number helper
  _isoWeek: function(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  },

  // ─── Notification permission prompt (shown once until granted or dismissed) ───
  renderNotificationPrompt() {
    if (!('Notification' in window)) return '';
    if (Notification.permission === 'granted') return '';
    const dismissed = localStorage.getItem('lms_notifPromptDismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return '';

    const times = ['06:00','07:00','08:00','09:00','10:00','20:00','21:00','22:00'];
    return `<div class="notif-prompt-card">
      <div class="npc-icon">🔔</div>
      <div class="npc-body">
        <div class="npc-title">毎日のリマインダーを設定しませんか？</div>
        <div class="npc-desc">同じ時間にお知らせが届くと、記録の習慣が続きやすくなります</div>
        <div class="npc-actions">
          <select id="notifTimeSelect" class="form-input npc-time">
            ${times.map(t => `<option value="${t}"${t === '08:00' ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
          <button class="btn btn-sm btn-primary" onclick="Pages.enableNotification()">設定する</button>
          <button class="btn btn-sm btn-text" onclick="Pages.dismissNotifPrompt()">後で</button>
        </div>
      </div>
    </div>`;
  },

  enableNotification() {
    const sel = document.getElementById('notifTimeSelect');
    const time = sel ? sel.value : '08:00';
    if (typeof app !== 'undefined') {
      app.enableDailyReminder(time).then(ok => { if (ok) this.dismissNotifPrompt(); });
    }
  },

  dismissNotifPrompt() {
    localStorage.setItem('lms_notifPromptDismissed', Date.now().toString());
    const card = document.querySelector('.notif-prompt-card');
    if (card) card.remove();
  },

  // ─── Weekly Summary (shown once per week, first login of each week) ───
  renderWeeklySummary() {
    const today = new Date();
    const weekKey = `${today.getFullYear()}-W${this._weekNumber(today)}`;
    const dismissed = localStorage.getItem('lms_weeklySummaryDismissed');
    if (dismissed === weekKey) return '';
    // Only show Mon/Thu/Sat/Sun
    const dayOfWeek = today.getDay();
    if (dayOfWeek !== 1 && dayOfWeek !== 4 && dayOfWeek !== 6 && dayOfWeek !== 0) return '';

    const domainKeys = Object.keys(CONFIG.domains);

    // This week (0–7 days) and last week (7–14 days) counts per domain
    const rows = domainKeys.map(d => {
      const cats = Object.keys(CONFIG.domains[d]?.categories || {});
      let thisWeek = 0, lastWeek = 0;
      cats.forEach(cat => {
        const all14 = store.getDomainData(d, cat, 14);
        const cutoff7 = new Date(); cutoff7.setDate(cutoff7.getDate() - 7);
        thisWeek += all14.filter(e => new Date(e.timestamp) >= cutoff7).length;
        lastWeek += all14.filter(e => new Date(e.timestamp) < cutoff7).length;
      });
      return { d, icon: CONFIG.domains[d]?.icon || '', color: CONFIG.domains[d]?.color || '#6C63FF', thisWeek, lastWeek };
    });

    const totalThis = rows.reduce((s, r) => s + r.thisWeek, 0);
    if (totalThis === 0) return '';

    const totalLast = rows.reduce((s, r) => s + r.lastWeek, 0);
    const diff = totalThis - totalLast;
    const trendIcon = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    const trendClass = diff > 0 ? 'trend-up' : diff < 0 ? 'trend-down' : 'trend-flat';
    const trendMsg = diff > 5 ? 'すばらしい伸びです！' : diff > 0 ? '先週より増えています' : diff < -5 ? '少し減っています。続けましょう' : diff < 0 ? '先週より少し減っています' : '先週と同じペースです';

    const topDomain = rows.reduce((a, b) => b.thisWeek > a.thisWeek ? b : a);
    const maxCount = Math.max(...rows.map(r => r.thisWeek), 1);

    return `<div class="weekly-summary-card" id="weeklySummaryCard">
      <div class="ws-header">
        <span class="ws-title">今週の記録まとめ</span>
        <button class="ws-close" onclick="Pages.dismissWeeklySummary('${weekKey}')">&times;</button>
      </div>
      <div class="ws-total-row">
        <div class="ws-total">合計 <strong>${totalThis}</strong> 件</div>
        ${totalLast > 0 ? `<div class="ws-trend ${trendClass}">${trendIcon} ${Math.abs(diff)}件 ${trendMsg}</div>` : ''}
      </div>
      <div class="ws-domains">
        ${rows.map(r => r.thisWeek > 0 ? `
          <div class="ws-domain-bar">
            <span class="ws-domain-label">${r.icon} ${i18n.t(r.d)}</span>
            <div class="ws-bar-track">
              <div class="ws-bar-fill" style="width:${Math.round(r.thisWeek / maxCount * 100)}%;background:${r.color}"></div>
            </div>
            <span class="ws-domain-count">${r.thisWeek}</span>
          </div>
        ` : '').join('')}
      </div>
      <div class="ws-highlight">
        最も記録が多い領域: <strong>${topDomain.icon} ${i18n.t(topDomain.d)}</strong>（${topDomain.thisWeek}件）
      </div>
    </div>`;
  },

  // ─── Re-engagement nudge (3+ days without any record) ───
  renderReengagementNudge() {
    const allDates = new Set();
    Object.keys(CONFIG.domains).forEach(d => {
      Object.keys(CONFIG.domains[d]?.categories || {}).forEach(cat => {
        store.getDomainData(d, cat, 30).forEach(e => {
          if (e.timestamp) allDates.add(e.timestamp.split('T')[0]);
        });
      });
    });
    if (allDates.size === 0) return ''; // new user — already handled by getting-started
    const today = new Date().toISOString().split('T')[0];
    if (allDates.has(today)) return '';
    // Count gap
    let gap = 0;
    const cur = new Date();
    while (gap < 30) {
      const key = cur.toISOString().split('T')[0];
      if (allDates.has(key)) break;
      gap++;
      cur.setDate(cur.getDate() - 1);
    }
    if (gap < 3) return '';
    const msgs = [
      `${gap}日間、記録がありませんでした。`,
      `久しぶりですね！少しだけ記録してみませんか？`,
      `体調の変化も、${gap}日分まとめて記録できます。`
    ];
    const msg = msgs[gap < 7 ? 0 : gap < 14 ? 1 : 2];
    return `<div class="reengagement-card">
      <span class="re-icon">💌</span>
      <div class="re-body">
        <div class="re-msg">${msg}</div>
        <div class="re-actions">
          <button class="btn btn-sm btn-primary" onclick="app.navigate('record')">今日の記録をつける</button>
          <button class="btn btn-sm btn-text" onclick="this.closest('.reengagement-card').remove()">後で</button>
        </div>
      </div>
    </div>`;
  },

  // ─── Cross-domain holistic insight (rule-based correlation across domains) ───
  renderCrossDomainInsights(domain) {
    const days = 14;

    // Build daily average maps for key signals
    const buildAvgMap = (domainKey, category, valueField) => {
      const map = {};
      store.getDomainData(domainKey, category, days).forEach(e => {
        if (!e.timestamp) return;
        const d = e.timestamp.split('T')[0];
        const v = Number(e[valueField]);
        if (isNaN(v)) return;
        if (!map[d]) map[d] = [];
        map[d].push(v);
      });
      return map;
    };

    const buildCountMap = (domainKey, categories) => {
      const map = {};
      categories.forEach(cat => {
        store.getDomainData(domainKey, cat, days).forEach(e => {
          if (!e.timestamp) return;
          const d = e.timestamp.split('T')[0];
          map[d] = (map[d] || 0) + 1;
        });
      });
      return map;
    };

    // Compute correlation score between two daily maps (0–1, higher = more aligned)
    const correlate = (mapA, mapB, minDays) => {
      const shared = Object.keys(mapA).filter(d => mapB[d] !== undefined);
      if (shared.length < minDays) return null;
      const avg = (val) => Array.isArray(val) ? val.reduce((s, v) => s + v, 0) / val.length : val;
      const vA = shared.map(d => avg(mapA[d]));
      const vB = shared.map(d => avg(mapB[d]));
      const medA = [...vA].sort((a, b) => a - b)[Math.floor(vA.length / 2)] || 0;
      const medB = [...vB].sort((a, b) => a - b)[Math.floor(vB.length / 2)] || 0;
      const highA = new Set(shared.filter((d, i) => vA[i] >= medA));
      const highB = new Set(shared.filter((d, i) => vB[i] >= medB));
      const both = [...highA].filter(d => highB.has(d)).length;
      return { n: shared.length, score: both / Math.max(highA.size, highB.size, 1) };
    };

    const healthMap  = buildAvgMap('health', 'symptoms', 'condition_level');
    const moodMap    = buildAvgMap('consciousness', 'observation', 'net_value');
    const relMap     = buildCountMap('relationship', ['interactions']);
    const habitsMap  = buildCountMap('time', ['habits']);
    const workMap    = buildCountMap('work', Object.keys(CONFIG.domains.work?.categories || {}));

    const MIN = 5;
    const THRESHOLD = 0.65;
    const insights = [];

    const hc = correlate(healthMap, moodMap, MIN);
    if (hc && hc.score >= THRESHOLD) {
      insights.push({ icon: '💚', text: `体調がよい日は心も充実している傾向があります（${hc.n}日分のデータより）` });
    }

    const rc = correlate(relMap, moodMap, MIN);
    if (rc && rc.score >= THRESHOLD) {
      insights.push({ icon: '💞', text: `人と交流した日は心が充実している傾向があります（${rc.n}日分のデータより）` });
    }

    const th = correlate(habitsMap, healthMap, MIN);
    if (th && th.score >= THRESHOLD) {
      insights.push({ icon: '🌿', text: `習慣を続けた日は体調がよい傾向があります（${th.n}日分のデータより）` });
    }

    const wh = correlate(workMap, healthMap, MIN);
    if (wh && wh.score >= THRESHOLD) {
      insights.push({ icon: '🔗', text: `よく動いた日は健康状態もよい傾向があります（${wh.n}日分のデータより）` });
    }

    if (insights.length === 0) return '';

    return `<div class="cross-domain-card">
      <div class="cdc-title">6領域のつながり</div>
      ${insights.slice(0, 2).map(ins => `
        <div class="cdc-insight">
          <span class="cdc-icon">${ins.icon}</span>
          <span class="cdc-text">${Components.escapeHtml(ins.text)}</span>
        </div>
      `).join('')}
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

  // ─── Radar chart: 6-domain life balance ───
  initRadarChart() {
    const canvas = document.getElementById('domainRadarChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const scores = store.get('domainScores') || {};
    const domainKeys = Object.keys(CONFIG.domains);
    const labels = domainKeys.map(d => i18n.t(d));
    const data = domainKeys.map(d => scores[d] || 0);

    // Skip if all zeros (no data yet)
    if (data.every(v => v === 0)) {
      canvas.closest('.radar-chart-wrap')?.remove();
      return;
    }

    if (canvas._chart) canvas._chart.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const fillColor = 'rgba(108,99,255,0.18)';
    const lineColor = '#6C63FF';

    canvas._chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: fillColor,
          borderColor: lineColor,
          borderWidth: 2,
          pointBackgroundColor: lineColor,
          pointRadius: 3
        }]
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              font: { size: 9 },
              color: tickColor,
              backdropColor: 'transparent'
            },
            grid: { color: gridColor },
            pointLabels: { font: { size: 11 }, color: tickColor }
          }
        }
      }
    });
  },

  // ─── Blood pressure trend chart (health domain home, ≥3 BP readings) ───
  renderBPTrendCard() {
    const bp = store.getDomainData('health', 'vitals', 30).filter(v => v.bp_systolic && v.bp_diastolic);
    if (bp.length < 3) return '';
    return `<div class="bp-trend-card">
      <div class="bp-trend-header">
        <h3>血圧の推移（直近30日）</h3>
        <span class="bp-trend-ref">目安：130/80 mmHg 以下</span>
      </div>
      <canvas id="bpTrendChart" height="110"></canvas>
    </div>`;
  },

  initBPTrendChart() {
    const canvas = document.getElementById('bpTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const bp = store.getDomainData('health', 'vitals', 30)
      .filter(v => v.bp_systolic && v.bp_diastolic && v.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-14);
    if (bp.length < 3) { canvas.closest('.bp-trend-card')?.remove(); return; }

    const labels = bp.map(v => {
      const d = new Date(v.timestamp);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    if (canvas._chart) canvas._chart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    canvas._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: '上（mmHg）', data: bp.map(v => v.bp_systolic), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', tension: 0.3, pointRadius: 3, spanGaps: true },
          { label: '下（mmHg）', data: bp.map(v => v.bp_diastolic), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', tension: 0.3, pointRadius: 3, spanGaps: true }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: tickColor, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
          y: { min: 50, max: 200, ticks: { font: { size: 10 }, stepSize: 30, color: tickColor }, grid: { color: gridColor } }
        }
      }
    });
  },

  // ─── Sleep quality trend chart (health domain home, ≥3 sleep readings) ───
  renderSleepTrendCard() {
    const sleep = store.getDomainData('health', 'sleepData', 30).filter(e => e.quality);
    if (sleep.length < 3) return '';
    return `<div class="sleep-trend-card">
      <div class="sleep-trend-header">
        <h3>睡眠の質の推移（直近30日）</h3>
        <span class="sleep-trend-ref">目安：7点以上で良眠</span>
      </div>
      <canvas id="sleepTrendChart" height="110"></canvas>
    </div>`;
  },

  initSleepTrendChart() {
    const canvas = document.getElementById('sleepTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const sleep = store.getDomainData('health', 'sleepData', 30)
      .filter(e => e.quality && e.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-14);
    if (sleep.length < 3) { canvas.closest('.sleep-trend-card')?.remove(); return; }

    const labels = sleep.map(e => {
      const d = new Date(e.timestamp);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    if (canvas._chart) canvas._chart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const qualities = sleep.map(e => e.quality);
    const avg = (qualities.reduce((s, v) => s + v, 0) / qualities.length).toFixed(1);
    canvas._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `睡眠の質（平均 ${avg}点）`,
          data: qualities,
          borderColor: '#6C63FF',
          backgroundColor: 'rgba(108,99,255,0.08)',
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: qualities.map(q => q >= 7 ? '#10b981' : q >= 5 ? '#f59e0b' : '#ef4444'),
          fill: true,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: tickColor, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
          y: { min: 0, max: 10, ticks: { font: { size: 10 }, stepSize: 2, color: tickColor }, grid: { color: gridColor } }
        }
      }
    });
  },

  // ─── Profile completion banner (health domain, until core fields filled) ───
  renderProfileCompletionBanner() {
    if (localStorage.getItem('lms_profileBannerDismissed')) return '';
    const profile = store.get('userProfile') || {};
    const missing = [];
    if (!profile.age && !profile.birthdate) missing.push('年齢');
    if (!profile.height) missing.push('身長');
    if (!profile.weight && !profile.displayName) missing.push('基本情報');
    if (missing.length === 0) return '';
    const esc = Components.escapeHtml;
    return `<div class="profile-banner">
      <span class="pb-icon">👤</span>
      <div class="pb-text">
        <strong>プロフィールを完成させましょう</strong>
        <span>未入力: ${missing.map(esc).join('・')} — 設定すると分析の精度が上がります</span>
      </div>
      <button class="btn btn-sm btn-primary" onclick="app.navigate('settings')">設定する</button>
      <button class="btn btn-ghost pb-close" onclick="localStorage.setItem('lms_profileBannerDismissed','1');this.closest('.profile-banner').remove()">&times;</button>
    </div>`;
  },

  // ─── Blood pressure alert card (health domain, appears when BP is elevated) ───
  renderBPAlertCard() {
    const vitals = store.getDomainData('health', 'vitals', 14)
      .filter(v => v.bp_systolic && v.bp_diastolic && v.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (vitals.length < 2) return '';

    // Check most recent reading for hypertensive crisis (systolic ≥180 or diastolic ≥110)
    const latest = vitals[0];
    if (latest.bp_systolic >= 180 || latest.bp_diastolic >= 110) {
      return `<div class="bp-alert-card bp-crisis">
        <div class="bpa-icon">🚨</div>
        <div class="bpa-body">
          <strong>血圧が非常に高い値です（${latest.bp_systolic}/${latest.bp_diastolic} mmHg）</strong>
          <span>すぐに安静にし、症状がある場合は救急に連絡してください</span>
        </div>
        <div class="bpa-actions">
          <a href="tel:119" class="btn btn-sm btn-danger">119番</a>
          <button class="btn btn-sm btn-secondary" onclick="app.navigate('doctor_report')">レポート確認</button>
        </div>
      </div>`;
    }

    // Check 7-day average (need ≥3 readings)
    const recent7 = vitals.filter(v => {
      const d = new Date(v.timestamp);
      return (Date.now() - d.getTime()) <= 7 * 86400000;
    }).slice(0, 7);
    if (recent7.length < 3) return '';

    const avgS = recent7.reduce((s, v) => s + v.bp_systolic, 0) / recent7.length;
    const avgD = recent7.reduce((s, v) => s + v.bp_diastolic, 0) / recent7.length;

    // Grade 1 hypertension (130-139 / 80-89) — inform but don't alarm
    const isElevated  = avgS >= 130 || avgD >= 80;
    const isHighHigh  = avgS >= 140 || avgD >= 90;

    if (!isElevated) return '';

    const msgTitle = isHighHigh
      ? `血圧が高めが続いています（平均 ${Math.round(avgS)}/${Math.round(avgD)} mmHg）`
      : `血圧が若干高めです（平均 ${Math.round(avgS)}/${Math.round(avgD)} mmHg）`;
    const msgBody = isHighHigh
      ? 'かかりつけ医にご相談されることをお勧めします。塩分を控えめにし、十分な水分補給と安静を心がけてください。'
      : '目安は130/80 mmHg以下です。記録を続け、必要に応じてかかりつけ医にご相談ください。';

    const dismissKey = `lms_bpAlert_${new Date().toISOString().split('T')[0]}`;
    if (localStorage.getItem(dismissKey)) return '';

    return `<div class="bp-alert-card${isHighHigh ? ' bp-high' : ' bp-elevated'}">
      <div class="bpa-icon">${isHighHigh ? '⚠️' : 'ℹ️'}</div>
      <div class="bpa-body">
        <strong>${msgTitle}</strong>
        <span>${msgBody}</span>
      </div>
      <div class="bpa-actions">
        <button class="btn btn-sm btn-secondary" onclick="app.navigate('doctor_report')">レポートを作成</button>
        <button class="btn btn-sm btn-ghost" onclick="localStorage.setItem('${dismissKey}','1');this.closest('.bp-alert-card').remove()">閉じる</button>
      </div>
    </div>`;
  },

  // ─── Weight trend chart (health domain home, ≥3 weight readings) ───
  renderWeightTrendCard() {
    const weights = store.getDomainData('health', 'vitals', 90).filter(e => e.weight);
    if (weights.length < 3) return '';
    return `<div class="weight-trend-card">
      <div class="weight-trend-header">
        <h3>体重の推移（直近90日）</h3>
      </div>
      <canvas id="weightTrendChart" height="110"></canvas>
    </div>`;
  },

  initWeightTrendChart() {
    const canvas = document.getElementById('weightTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const vitals = store.getDomainData('health', 'vitals', 90)
      .filter(e => e.weight && e.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-30);
    if (vitals.length < 3) { canvas.closest('.weight-trend-card')?.remove(); return; }

    const labels = vitals.map(e => { const d = new Date(e.timestamp); return `${d.getMonth()+1}/${d.getDate()}`; });
    if (canvas._chart) canvas._chart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const wts = vitals.map(e => e.weight);
    const min = Math.floor(Math.min(...wts) - 1);
    const max = Math.ceil(Math.max(...wts) + 1);

    // Use profile baseline weight as a reference if available
    const profile = store.get('userProfile') || {};
    const baseWeight = Number(profile.weight) || null;
    const datasets = [{
      label: '体重 (kg)',
      data: wts,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.08)',
      tension: 0.35,
      pointRadius: 3,
      fill: true,
      spanGaps: true
    }];
    if (baseWeight && baseWeight >= min && baseWeight <= max) {
      datasets.push({
        label: '基準体重',
        data: labels.map(() => baseWeight),
        borderColor: 'rgba(148,163,184,0.5)',
        borderDash: [4, 4],
        pointRadius: 0,
        borderWidth: 1.5
      });
    }

    canvas._chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: tickColor, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
          y: { min, max, ticks: { font: { size: 10 }, stepSize: 1, color: tickColor }, grid: { color: gridColor } }
        }
      }
    });
  },

  // ─── Meditation countdown timer (consciousness domain home) ───
  renderMeditationTimer() {
    return `<div class="meditation-card" id="meditCard">
      <div class="mdt-idle">
        <div class="mdt-header">
          <span class="mdt-icon">🧘</span>
          <div class="mdt-intro">
            <strong>瞑想タイマー</strong>
            <span>静かな時間を確保しましょう</span>
          </div>
        </div>
        <div class="mdt-durations">
          <button class="mdt-dur-btn" onclick="Pages.startMeditation(5)">5分</button>
          <button class="mdt-dur-btn" onclick="Pages.startMeditation(10)">10分</button>
          <button class="mdt-dur-btn" onclick="Pages.startMeditation(15)">15分</button>
          <button class="mdt-dur-btn" onclick="Pages.startMeditation(20)">20分</button>
        </div>
      </div>
      <div class="mdt-active" style="display:none">
        <div class="mdt-ring" id="mdtRing">
          <div class="mdt-time" id="mdtTime">--:--</div>
        </div>
        <div class="mdt-phase">静かに目を閉じてください</div>
        <div class="mdt-controls">
          <button class="btn btn-ghost btn-sm" onclick="Pages.pauseMeditation()" id="mdtPauseBtn">一時停止</button>
          <button class="btn btn-ghost btn-sm" onclick="Pages.stopMeditation()">終わる</button>
        </div>
      </div>
      <div class="mdt-done" style="display:none">
        <div class="mdt-done-icon">🙏</div>
        <div class="mdt-done-text">
          <strong>お疲れ様でした</strong>
          <span>心が整いましたか？</span>
        </div>
        <div class="mdt-done-btns">
          <button class="btn btn-primary" onclick="app.logMeditation(Pages._mdtDuration)">記録する</button>
          <button class="btn btn-ghost" onclick="Pages.resetMeditation()">もう一度</button>
        </div>
      </div>
    </div>`;
  },

  startMeditation(minutes) {
    this._mdtDuration = minutes;
    this._mdtRemaining = minutes * 60;
    this._mdtPaused = false;
    clearTimeout(this._mdtTimer);
    const card = document.getElementById('meditCard');
    if (!card) return;
    card.querySelector('.mdt-idle').style.display = 'none';
    card.querySelector('.mdt-done').style.display = 'none';
    card.querySelector('.mdt-active').style.display = '';
    this._runMeditationTick();
  },

  _runMeditationTick() {
    if (this._mdtPaused) return;
    if (this._mdtRemaining <= 0) { this._finishMeditation(); return; }
    const total = this._mdtDuration * 60;
    const pct = ((total - this._mdtRemaining) / total * 100).toFixed(1);
    const ring = document.getElementById('mdtRing');
    const timeEl = document.getElementById('mdtTime');
    if (!ring || !timeEl) return;
    ring.style.setProperty('--progress', pct + '%');
    const m = Math.floor(this._mdtRemaining / 60);
    const s = this._mdtRemaining % 60;
    timeEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    this._mdtRemaining--;
    this._mdtTimer = setTimeout(() => this._runMeditationTick(), 1000);
  },

  pauseMeditation() {
    this._mdtPaused = !this._mdtPaused;
    const btn = document.getElementById('mdtPauseBtn');
    if (btn) btn.textContent = this._mdtPaused ? '再開する' : '一時停止';
    if (!this._mdtPaused) this._runMeditationTick();
  },

  stopMeditation() {
    clearTimeout(this._mdtTimer);
    this.resetMeditation();
  },

  _finishMeditation() {
    clearTimeout(this._mdtTimer);
    const card = document.getElementById('meditCard');
    if (!card) return;
    card.querySelector('.mdt-active').style.display = 'none';
    card.querySelector('.mdt-done').style.display = '';
  },

  resetMeditation() {
    clearTimeout(this._mdtTimer);
    const card = document.getElementById('meditCard');
    if (!card) return;
    card.querySelector('.mdt-active').style.display = 'none';
    card.querySelector('.mdt-done').style.display = 'none';
    card.querySelector('.mdt-idle').style.display = '';
  },

  // ─── Weekly health summary (health domain, shows after ≥3 days of data) ───
  renderWeeklyHealthSummary() {
    const today = new Date();
    const weekKey = `${today.getFullYear()}-W${this._weekNumber(today)}`;
    if (localStorage.getItem('lms_weeklyHealthDismissed') === weekKey) return '';

    const vitals7  = store.getDomainData('health', 'vitals',    7);
    const vitals14 = store.getDomainData('health', 'vitals',   14);
    const sleep7   = store.getDomainData('health', 'sleepData', 7);
    const sleep14  = store.getDomainData('health', 'sleepData',14);
    const syms7    = store.getDomainData('health', 'symptoms',  7);

    const cutoff7 = new Date(); cutoff7.setDate(today.getDate() - 7);

    // Helper: average a numeric field over a filtered subset
    const avg = (arr, field) => {
      const vals = arr.map(e => Number(e[field])).filter(v => !isNaN(v) && v > 0);
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };
    const avgThis = (arr, field) => avg(arr.filter(e => new Date(e.timestamp) >= cutoff7), field);
    const avgPrev = (arr, field) => avg(arr.filter(e => new Date(e.timestamp) < cutoff7), field);

    // Key metrics
    const bpSysThis = avgThis(vitals7, 'bp_systolic');
    const bpSysPrev = avgPrev(vitals14, 'bp_systolic');
    const bpDiasThis = avgThis(vitals7, 'bp_diastolic');

    const weightThis = avgThis(vitals7, 'weight');
    const weightPrev = avgPrev(vitals14, 'weight');

    const sleepHrsThis = avgThis(sleep7, 'duration');
    const sleepHrsPrev = avgPrev(sleep14, 'duration');
    const sleepQltyThis = avgThis(sleep7, 'quality');

    // Steps from localStorage (daily keys)
    let totalSteps7 = 0, stepDays = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = 'lms_steps_' + d.toISOString().split('T')[0];
      try {
        const s = parseInt(localStorage.getItem(k) || '0', 10);
        if (s > 0) { totalSteps7 += s; stepDays++; }
      } catch (e) {}
    }
    const avgStepsThis = stepDays > 0 ? Math.round(totalSteps7 / stepDays) : null;

    // Recording days (unique dates in vitals + symptoms + sleep this week)
    const recDates = new Set();
    [...vitals7, ...syms7, ...sleep7].forEach(e => {
      if (e.timestamp && new Date(e.timestamp) >= cutoff7) recDates.add(e.timestamp.split('T')[0]);
    });
    const recordedDays = recDates.size;
    if (recordedDays < 3) return ''; // not enough data

    const fmt1 = n => (n !== null && !isNaN(n)) ? n.toFixed(1) : null;
    const fmtDiff = (cur, prev, unit, higherIsBetter) => {
      if (cur === null || prev === null) return '';
      const diff = cur - prev;
      if (Math.abs(diff) < 0.1) return `<span style="color:var(--text-secondary)">先週と同じ</span>`;
      const up = diff > 0;
      const good = higherIsBetter ? up : !up;
      const color = good ? '#10b981' : '#ef4444';
      const arrow = up ? '↑' : '↓';
      return `<span style="color:${color}">${arrow}${Math.abs(diff).toFixed(1)}${unit}</span>`;
    };

    const rows = [];

    if (bpSysThis !== null) {
      const bpDiff = bpSysPrev !== null
        ? (Math.abs(bpSysThis - bpSysPrev) < 2 ? `<span style="color:var(--text-secondary)">先週と同じ</span>` : (bpSysThis < bpSysPrev ? `<span style="color:#10b981">↓${(bpSysPrev - bpSysThis).toFixed(0)}</span>` : `<span style="color:#ef4444">↑${(bpSysThis - bpSysPrev).toFixed(0)}</span>`))
        : '';
      const bpStr = `${Math.round(bpSysThis)}/${bpDiasThis ? Math.round(bpDiasThis) : '?'}`;
      rows.push({ label: '平均血圧', value: bpStr, unit: 'mmHg', diff: bpDiff });
    }
    if (sleepHrsThis !== null) {
      rows.push({ label: '平均睡眠', value: fmt1(sleepHrsThis), unit: '時間', diff: fmtDiff(sleepHrsThis, sleepHrsPrev, 'h', true) });
    }
    if (weightThis !== null) {
      rows.push({ label: '平均体重', value: fmt1(weightThis), unit: 'kg', diff: fmtDiff(weightThis, weightPrev, 'kg', false) });
    }
    if (avgStepsThis !== null) {
      rows.push({ label: '平均歩数', value: avgStepsThis.toLocaleString('ja-JP'), unit: '歩', diff: '' });
    }

    if (rows.length === 0) return '';

    // Insight message
    let insight = '';
    if (sleepQltyThis !== null && sleepHrsPrev !== null) {
      if (sleepHrsThis > sleepHrsPrev + 0.3) insight = '睡眠時間が先週より増えています。このまま続けましょう。';
      else if (sleepHrsThis < sleepHrsPrev - 0.3) insight = '睡眠時間が先週より減っています。就寝時間を少し早めてみましょう。';
    }
    if (!insight && bpSysThis !== null) {
      if (bpSysThis > 140) insight = '血圧がやや高めです。塩分と水分に気をつけ、かかりつけ医にご相談ください。';
      else if (bpSysThis < 120 && bpSysPrev !== null && bpSysThis < bpSysPrev - 3) insight = '血圧が先週より下がっています。良い傾向です。';
    }

    const stars = recordedDays >= 6 ? '★★★★★' : recordedDays >= 5 ? '★★★★☆' : recordedDays >= 4 ? '★★★☆☆' : '★★☆☆☆';

    return `<div class="weekly-health-card" id="weeklyHealthCard">
      <div class="wh-header">
        <span class="wh-title">今週の健康まとめ</span>
        <button class="wh-close" onclick="localStorage.setItem('lms_weeklyHealthDismissed','${weekKey}');document.getElementById('weeklyHealthCard').remove()">&times;</button>
      </div>
      <div class="wh-grid">
        ${rows.map(r => `<div class="wh-metric">
          <div class="wh-metric-label">${r.label}</div>
          <div class="wh-metric-value">${r.value}<span class="wh-unit">${r.unit}</span></div>
          ${r.diff ? `<div class="wh-metric-diff">${r.diff}</div>` : ''}
        </div>`).join('')}
      </div>
      <div class="wh-record-row">
        <span class="wh-record-label">記録日数</span>
        <span class="wh-stars">${stars}</span>
        <span class="wh-record-count">${recordedDays} / 7日</span>
      </div>
      ${insight ? `<div class="wh-insight">${Components.escapeHtml(insight)}</div>` : ''}
    </div>`;
  },

  // ─── Monthly health comparison card (this month vs last month) ───
  renderMonthlyHealthComparison() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;

    const symptomsAll = store.getDomainData('health', 'symptoms', 90);
    const sleepAll    = store.getDomainData('health', 'sleepData', 90);

    const thisSx  = symptomsAll.filter(e => e.timestamp?.startsWith(thisMonthPrefix));
    const prevSx  = symptomsAll.filter(e => e.timestamp?.startsWith(lastMonthPrefix));
    const thisSl  = sleepAll.filter(e => e.timestamp?.startsWith(thisMonthPrefix));
    const prevSl  = sleepAll.filter(e => e.timestamp?.startsWith(lastMonthPrefix));

    if ((thisSx.length === 0 && thisSl.length === 0) || (prevSx.length === 0 && prevSl.length === 0)) return '';

    const avg = (arr, key) => arr.length > 0 ? arr.reduce((s, e) => s + (Number(e[key]) || 0), 0) / arr.length : null;

    const metrics = [];
    const cn = avg(thisSx, 'condition_level'), cp = avg(prevSx, 'condition_level');
    if (cn !== null && cp !== null) metrics.push({ label: '体調', unit: '/10', now: cn.toFixed(1), prev: cp.toFixed(1), diff: cn - cp, hb: true });
    const sn = avg(thisSl, 'quality'), sp = avg(prevSl, 'quality');
    if (sn !== null && sp !== null) metrics.push({ label: '睡眠', unit: '/10', now: sn.toFixed(1), prev: sp.toFixed(1), diff: sn - sp, hb: true });
    const fn = avg(thisSx, 'fatigue_level'), fp = avg(prevSx, 'fatigue_level');
    if (fn !== null && fp !== null) metrics.push({ label: '疲れ', unit: '/10', now: fn.toFixed(1), prev: fp.toFixed(1), diff: fn - fp, hb: false });
    if (metrics.length === 0) return '';

    const trendEl = (diff, hb) => {
      if (Math.abs(diff) < 0.2) return `<span class="mhc-flat">→</span>`;
      const good = hb ? diff > 0 : diff < 0;
      return diff > 0 ? `<span class="mhc-${good ? 'up' : 'down'}">↑</span>` : `<span class="mhc-${good ? 'up' : 'down'}">↓</span>`;
    };

    const rows = metrics.map(m => `<div class="mhc-metric">
      <div class="mhc-label">${m.label}</div>
      <div class="mhc-now">${m.now}<span class="mhc-unit">${m.unit}</span></div>
      <div class="mhc-trend">${trendEl(m.diff, m.hb)}</div>
      <div class="mhc-prev">${m.prev}${m.unit}</div>
    </div>`).join('');

    const thisLabel = `${now.getMonth() + 1}月`;
    const lastLabel = `${prevDate.getMonth() + 1}月`;

    return `<div class="monthly-health-card">
      <div class="mhc-header">
        <h4>月別の変化</h4>
        <div class="mhc-legend">
          <span class="mhc-leg-now">${thisLabel}</span>
          <span class="mhc-vs">vs</span>
          <span class="mhc-leg-prev">${lastLabel}</span>
        </div>
      </div>
      <div class="mhc-grid">${rows}</div>
    </div>`;
  },

  // ─── Breathing exercise (consciousness domain home) ───
  renderBreathingExercise() {
    return `<div class="breath-card" id="breathCard">
      <div class="breath-idle">
        <div class="breath-idle-icon">🫁</div>
        <div class="breath-idle-text">
          <strong>深呼吸で心を整える</strong>
          <span>1分間の呼吸法で気持ちが落ち着きます</span>
        </div>
        <button class="btn btn-secondary breath-start-btn" onclick="Pages.startBreathing()">始める</button>
      </div>
      <div class="breath-active" style="display:none">
        <div class="breath-phase-label" id="breathPhaseLabel">準備してください</div>
        <div class="breath-circle-wrap">
          <div class="breath-circle" id="breathCircle"></div>
        </div>
        <div class="breath-cycle-count" id="breathCycleCount">1 / 4 サイクル</div>
        <button class="btn btn-ghost breath-stop-btn" onclick="Pages.stopBreathing()">やめる</button>
      </div>
      <div class="breath-done" style="display:none">
        <div class="breath-done-icon">✅</div>
        <div class="breath-done-text">
          <strong>お疲れ様でした</strong>
          <span>気持ちが整いましたか？</span>
        </div>
        <button class="btn btn-primary" onclick="app.logBreathing()">記録する</button>
        <button class="btn btn-ghost" onclick="Pages.resetBreathing()">もう一度</button>
      </div>
    </div>`;
  },

  startBreathing() {
    const card = document.getElementById('breathCard');
    if (!card) return;
    card.querySelector('.breath-idle').style.display = 'none';
    card.querySelector('.breath-done').style.display = 'none';
    card.querySelector('.breath-active').style.display = '';
    this._breathCycle = 0;
    this._breathTimer = null;
    this._runBreathCycle();
  },

  _runBreathCycle() {
    const totalCycles = 4;
    if (this._breathCycle >= totalCycles) { this._finishBreathing(); return; }
    this._breathCycle++;
    const cycleEl = document.getElementById('breathCycleCount');
    if (cycleEl) cycleEl.textContent = `${this._breathCycle} / ${totalCycles} サイクル`;
    const phases = [
      { label: '吸って…', duration: 4000, expand: true },
      { label: 'ためて…', duration: 2000, expand: null },
      { label: 'はいて…', duration: 6000, expand: false }
    ];
    let idx = 0;
    const runPhase = () => {
      if (idx >= phases.length) { this._runBreathCycle(); return; }
      const phase = phases[idx++];
      const labelEl = document.getElementById('breathPhaseLabel');
      const circle = document.getElementById('breathCircle');
      if (!labelEl || !circle) return;
      labelEl.textContent = phase.label;
      if (phase.expand === true)  circle.classList.add('expand');
      if (phase.expand === false) circle.classList.remove('expand');
      this._breathTimer = setTimeout(runPhase, phase.duration);
    };
    runPhase();
  },

  stopBreathing() {
    clearTimeout(this._breathTimer);
    this.resetBreathing();
  },

  _finishBreathing() {
    const card = document.getElementById('breathCard');
    if (!card) return;
    card.querySelector('.breath-active').style.display = 'none';
    card.querySelector('.breath-done').style.display = '';
  },

  resetBreathing() {
    clearTimeout(this._breathTimer);
    const card = document.getElementById('breathCard');
    if (!card) return;
    card.querySelector('.breath-active').style.display = 'none';
    card.querySelector('.breath-done').style.display = 'none';
    card.querySelector('.breath-idle').style.display = '';
    const circle = document.getElementById('breathCircle');
    if (circle) circle.classList.remove('expand');
  },

  // ─── Practice history summary (consciousness domain home) ───
  renderPracticeHistory() {
    const practices = store.getDomainData('consciousness', 'practices', 30);
    if (practices.length === 0) return '';
    const esc = Components.escapeHtml;
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const thisWeek = practices.filter(p => new Date(p.timestamp) >= weekAgo);
    const totalMins = practices.reduce((s, p) => s + (p.duration_minutes || 0), 0);

    const typeLabels = { breathwork:'深呼吸', meditation:'瞑想', yoga:'ヨガ', journaling:'日記', mindfulness:'マインドフル', gratitude:'感謝', other:'その他' };
    const typeIcons  = { breathwork:'🫁', meditation:'🧘', yoga:'🌿', journaling:'📖', mindfulness:'✨', gratitude:'💛', other:'🌸' };

    const typeCounts = {};
    practices.forEach(p => {
      const t = p.practice_type || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const typePills = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([type, count]) => `<div class="ph-pill">
        <span class="ph-pill-icon">${typeIcons[type] || '🌸'}</span>
        <span class="ph-pill-label">${esc(typeLabels[type] || type)}</span>
        <span class="ph-pill-count">${count}回</span>
      </div>`).join('');

    const recent = [...practices].reverse().slice(0, 5);
    const sessionItems = recent.map(p => {
      const d = new Date(p.timestamp);
      const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
      const type = p.practice_type || 'other';
      const mins = p.duration_minutes ? `${p.duration_minutes}分` : '';
      return `<div class="ph-session">
        <span class="ph-session-icon">${typeIcons[type] || '🌸'}</span>
        <span class="ph-session-label">${esc(typeLabels[type] || type)}</span>
        <span class="ph-session-meta">${dateStr}${mins ? ' · ' + mins : ''}</span>
      </div>`;
    }).join('');

    return `<div class="practice-history-card">
      <div class="ph-header">
        <h4>最近の実践</h4>
        <div class="ph-stats">
          <span><strong>${thisWeek.length}</strong>回 今週</span>
          ${totalMins > 0 ? `<span><strong>${totalMins}</strong>分 累計</span>` : ''}
        </div>
      </div>
      <div class="ph-pills">${typePills}</div>
      <div class="ph-sessions">${sessionItems}</div>
    </div>`;
  },

  // ─── 7-layer trend chart (consciousness domain home, ≥3 observations) ───
  renderLayerTrendChart() {
    const obs = store.getDomainData('consciousness', 'observation', 30)
      .filter(e => Object.keys(e).some(k => k.startsWith('layer_') && e[k] > 0));
    if (obs.length < 3) return '';
    return `<div class="layer-trend-card">
      <div class="layer-trend-header">
        <h3>意識レイヤーの推移（直近30日）</h3>
      </div>
      <canvas id="layerTrendChart" height="130"></canvas>
    </div>`;
  },

  initLayerTrendChart() {
    const canvas = document.getElementById('layerTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const obs = store.getDomainData('consciousness', 'observation', 30)
      .filter(e => e.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-14);
    if (obs.length < 3) { canvas.closest('.layer-trend-card')?.remove(); return; }

    const labels = obs.map(e => { const d = new Date(e.timestamp); return `${d.getMonth()+1}/${d.getDate()}`; });
    if (canvas._chart) canvas._chart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const layers = CONFIG.domains.consciousness?.layers || {};
    const layerKeys = ['layer_1','layer_2','layer_3','layer_35','layer_4','layer_5','layer_6','layer_7'];

    canvas._chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: layerKeys.map(k => {
          const lk = k.replace('layer_', '');
          const layer = layers[parseFloat(lk)];
          return {
            label: layer ? layer.name : k,
            data: obs.map(e => Number(e[k]) || 0),
            backgroundColor: (layer?.color || '#6C63FF') + 'cc',
            stack: 'layers'
          };
        })
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, color: tickColor, boxWidth: 10, padding: 6 } }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
          y: { stacked: true, max: 100, ticks: { font: { size: 10 }, color: tickColor, stepSize: 25 }, grid: { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' } }
        }
      }
    });
  },

  // ─── Weekly consciousness heatmap (consciousness domain, ≥3 obs this week) ───
  renderWeeklyConsciousnessTrend() {
    const layerDefs = [
      { key: 'layer_1',  name: '計測',   color: '#E74C3C' },
      { key: 'layer_2',  name: '関係',   color: '#E67E22' },
      { key: 'layer_3',  name: '現場',   color: '#F1C40F' },
      { key: 'layer_35', name: '心身',   color: '#27AE60' },
      { key: 'layer_4',  name: '構想',   color: '#2980B9' },
      { key: 'layer_5',  name: '可能性', color: '#8E44AD' },
      { key: 'layer_6',  name: '統合',   color: '#9B59B6' },
      { key: 'layer_7',  name: '空',     color: '#1ABC9C' }
    ];

    const obs7 = store.getDomainData('consciousness', 'observation', 7)
      .filter(e => layerDefs.some(l => Number(e[l.key]) > 0));
    if (obs7.length < 3) return '';

    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    const todayStr = now.toISOString().split('T')[0];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    const dayMap = {};
    obs7.forEach(e => {
      const d = (e.timestamp || '').split('T')[0];
      if (!dayMap[d]) dayMap[d] = {};
      layerDefs.forEach(l => {
        const v = Number(e[l.key] || 0);
        if (v > 0) dayMap[d][l.key] = Math.max(dayMap[d][l.key] || 0, v);
      });
    });

    const totals = {};
    obs7.forEach(e => {
      layerDefs.forEach(l => {
        const v = Number(e[l.key] || 0);
        if (v > 0) totals[l.key] = (totals[l.key] || 0) + v;
      });
    });
    const sortedKeys = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const topDef = layerDefs.find(l => l.key === sortedKeys[0]?.[0]);
    const bottomDef = layerDefs.find(l => l.key === sortedKeys[sortedKeys.length - 1]?.[0]);

    const dayHeader = `<div class="cwt-day-headers">
      <div class="cwt-layer-spacer"></div>
      ${days.map(d => {
        const isToday = d === todayStr;
        return `<div class="cwt-day-col${isToday ? ' cwt-today' : ''}">${dayNames[new Date(d).getDay()]}</div>`;
      }).join('')}
    </div>`;

    const layerRows = layerDefs.map(l => {
      const cells = days.map(d => {
        const val = dayMap[d]?.[l.key] || 0;
        if (!val) return `<div class="cwt-cell"></div>`;
        const opacity = (0.3 + (val / 100) * 0.7).toFixed(2);
        return `<div class="cwt-cell cwt-cell-on" style="background:${l.color};opacity:${opacity}" title="${l.name}: ${val}"></div>`;
      }).join('');
      return `<div class="cwt-layer-row">
        <div class="cwt-layer-label">${l.name}</div>
        ${cells}
      </div>`;
    }).join('');

    const insight = topDef
      ? `<div class="cwt-insight">今週最も活発: <strong style="color:${topDef.color}">${topDef.name}</strong>` +
        (bottomDef && bottomDef.key !== topDef.key ? ` / 伸びしろ: <strong>${bottomDef.name}</strong>` : '') +
        `</div>`
      : '';

    return `<div class="consciousness-weekly-card">
      <div class="cwt-header">
        <span class="cwt-title">今週の意識レイヤー</span>
      </div>
      <div class="cwt-grid">
        ${dayHeader}
        ${layerRows}
      </div>
      ${insight}
    </div>`;
  },

  // ─── Mood trend chart (consciousness domain home, ≥3 entries with mood_level) ───
  renderMoodTrendCard() {
    const entries = store.getDomainData('consciousness', 'entries', 30).filter(e => e.mood_level);
    if (entries.length < 3) return '';
    return `<div class="mood-trend-card">
      <div class="mood-trend-header">
        <h3>気分の推移（直近30日）</h3>
        <span class="mood-trend-ref">目安：7点以上で好調</span>
      </div>
      <canvas id="moodTrendChart" height="110"></canvas>
    </div>`;
  },

  initMoodTrendChart() {
    const canvas = document.getElementById('moodTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const entries = store.getDomainData('consciousness', 'entries', 30)
      .filter(e => e.mood_level && e.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-14);
    if (entries.length < 3) { canvas.closest('.mood-trend-card')?.remove(); return; }

    const labels = entries.map(e => {
      const d = new Date(e.timestamp);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    if (canvas._chart) canvas._chart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const moods = entries.map(e => e.mood_level);
    const avg = (moods.reduce((s, v) => s + v, 0) / moods.length).toFixed(1);
    canvas._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `気分（平均 ${avg}点）`,
          data: moods,
          borderColor: '#6C63FF',
          backgroundColor: 'rgba(108,99,255,0.09)',
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: moods.map(m => m >= 7 ? '#10b981' : m >= 5 ? '#f59e0b' : '#ef4444'),
          fill: true,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: tickColor, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
          y: { min: 0, max: 10, ticks: { font: { size: 10 }, stepSize: 2, color: tickColor }, grid: { color: gridColor } }
        }
      }
    });
  },

  // ─── Social connection activity heatmap (relationship domain home) ───
  renderConnectionActivity() {
    const interactions = store.getDomainData('relationship', 'interactions', 28);
    if (interactions.length === 0) return '';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Build a set of dates with interactions (last 28 days)
    const activeDays = new Set(interactions.filter(e => e.timestamp).map(e => e.timestamp.split('T')[0]));

    // Compute connection streak (consecutive days ending today or yesterday)
    let streak = 0;
    const cur = new Date(today);
    if (!activeDays.has(todayStr)) cur.setDate(cur.getDate() - 1);
    while (streak <= 28) {
      if (!activeDays.has(cur.toISOString().split('T')[0])) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    // Week summary (Mon–today)
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
    const weekPeople = new Set(
      interactions.filter(e => e.timestamp && e.timestamp >= weekAgo.toISOString().split('T')[0] && e.person)
        .map(e => e.person)
    );

    // 28-cell heatmap
    const cells = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const active = activeDays.has(ds);
      const isToday = ds === todayStr;
      cells.push(`<div class="ca-cell${active ? ' ca-active' : ''}${isToday ? ' ca-today' : ''}" title="${ds}"></div>`);
    }

    const streakBadge = streak >= 3 ? `<span class="ca-streak">${streak}日連続 🔥</span>` : '';

    return `<div class="connection-activity-card">
      <div class="ca-header">
        <span class="ca-title">つながり活動（直近28日）</span>
        ${streakBadge}
      </div>
      <div class="ca-grid">${cells.join('')}</div>
      <div class="ca-footer">今週 <strong>${weekPeople.size}人</strong> と交流しました</div>
    </div>`;
  },

  // ─── Monthly Connection Report (shown 1st–7th of month, dismissable) ───
  renderMonthlyConnectionReport() {
    const today = new Date();
    if (today.getDate() > 7) return '';
    const monthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
    if (localStorage.getItem('lms_connReport_dismissed') === monthKey) return '';

    // Previous month boundaries
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevStart = prevMonthStart.toISOString().split('T')[0];
    const prevEnd = prevMonthEnd.toISOString().split('T')[0];
    const prevMonthLabel = `${prevMonthStart.getFullYear()}年${prevMonthStart.getMonth() + 1}月`;

    const interactions = store.getDomainData('relationship', 'interactions', 62);
    const prevMonthInter = interactions.filter(e => {
      const d = (e.timestamp || '').split('T')[0];
      return d >= prevStart && d < prevEnd;
    });
    if (prevMonthInter.length === 0) return '';

    const uniquePeople = new Set(prevMonthInter.map(e => e.person).filter(Boolean));
    const totalContacts = prevMonthInter.length;

    // Most connected person
    const personCounts = {};
    prevMonthInter.forEach(e => { if (e.person) personCounts[e.person] = (personCounts[e.person] || 0) + 1; });
    const topPerson = Object.entries(personCounts).sort((a, b) => b[1] - a[1])[0];

    // Average quality
    const qualEntries = prevMonthInter.filter(e => e.quality);
    const avgQuality = qualEntries.length > 0
      ? (qualEntries.reduce((s, e) => s + Number(e.quality), 0) / qualEntries.length).toFixed(1)
      : null;

    // Contacts not reached (registered but no interaction last month)
    const contacts = store.get('relationship_contacts') || [];
    const missed = contacts.filter(c => !uniquePeople.has(c.name)).slice(0, 3);

    const esc = Components.escapeHtml;
    const missedHtml = missed.length > 0
      ? `<div class="mcr-missed">
          <div class="mcr-missed-label">先月お声がけできなかった方</div>
          ${missed.map(c => `<div class="mcr-missed-person">
            <div class="mcr-missed-avatar">${esc((c.name||'？').substring(0,2))}</div>
            <span>${esc(c.name)}</span>
            <button class="btn btn-xs btn-primary" onclick="app.quickContactLog('${esc(c.name)}')">今月連絡する</button>
          </div>`).join('')}
        </div>`
      : '';

    return `<div class="monthly-connection-report">
      <div class="mcr-header">
        <span class="mcr-title">${prevMonthLabel}のつながりレポート</span>
        <button class="mcr-close" onclick="localStorage.setItem('lms_connReport_dismissed','${monthKey}');this.closest('.monthly-connection-report').remove()">×</button>
      </div>
      <div class="mcr-stats">
        <div class="mcr-stat">
          <div class="mcr-num">${uniquePeople.size}</div>
          <div class="mcr-label">交流した人数</div>
        </div>
        <div class="mcr-stat">
          <div class="mcr-num">${totalContacts}</div>
          <div class="mcr-label">交流の回数</div>
        </div>
        ${avgQuality ? `<div class="mcr-stat">
          <div class="mcr-num">${avgQuality}</div>
          <div class="mcr-label">平均満足度</div>
        </div>` : ''}
        ${topPerson ? `<div class="mcr-stat">
          <div class="mcr-num mcr-person">${esc(topPerson[0].substring(0,4))}</div>
          <div class="mcr-label">最多交流</div>
        </div>` : ''}
      </div>
      ${missedHtml}
    </div>`;
  },

  // ─── Quick inline contact add (relationship domain home, no contacts yet) ───
  renderQuickContactAdd() {
    const contacts = store.get('relationship_contacts') || [];
    if (contacts.length > 0) return ''; // already registered some contacts
    return `<div class="quick-contact-card" id="quickContactCard">
      <div class="qcc-header">
        <span class="qcc-icon">👥</span>
        <div>
          <strong class="qcc-title">大切な人を登録する</strong>
          <span class="qcc-sub">登録するとつながりの状態をお知らせします</span>
        </div>
      </div>
      <div class="qcc-form">
        <input type="text" id="qccName" class="form-input" placeholder="お名前（例：田中 花子）" maxlength="20">
        <input type="tel" id="qccPhone" class="form-input" placeholder="電話番号（任意）">
        <div class="qcc-dist-wrap">
          <span class="qcc-dist-label">関係性</span>
          <div class="qcc-dist-btns">
            <button class="qcc-dist-btn" data-d="1" onclick="Pages.selectQccDist(1, this)">家族</button>
            <button class="qcc-dist-btn" data-d="2" onclick="Pages.selectQccDist(2, this)">親友</button>
            <button class="qcc-dist-btn" data-d="3" onclick="Pages.selectQccDist(3, this)">友人</button>
            <button class="qcc-dist-btn" data-d="4" onclick="Pages.selectQccDist(4, this)">知人</button>
          </div>
        </div>
        <div class="qcc-actions">
          <button class="btn btn-primary" onclick="Pages.saveQuickContact()">追加する</button>
          <button class="btn btn-ghost" onclick="app.navigate('record')">詳細登録 →</button>
        </div>
      </div>
    </div>`;
  },

  selectQccDist(n, btn) {
    document.querySelectorAll('.qcc-dist-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    this._qccDist = n;
  },

  saveQuickContact() {
    const name = document.getElementById('qccName')?.value?.trim();
    const phone = document.getElementById('qccPhone')?.value?.trim() || '';
    const distance = this._qccDist || 3;
    if (!name) { Components.showToast('お名前を入力してください', 'error'); return; }
    const contacts = store.get('relationship_contacts') || [];
    contacts.push({ name, phone, distance: String(distance), birthday: '' });
    store.set('relationship_contacts', contacts);
    Components.showToast(`${name}さんを登録しました`, 'success');
    this._qccDist = null;
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Savings goals tracker (assets domain home) ───
  renderSavingsGoals() {
    const goals = store.getDomainData('assets', 'goals', 365);
    if (goals.length === 0) return '';
    const today = new Date().toISOString().split('T')[0];
    const active = goals
      .filter(g => !g.deadline || g.deadline >= today)
      .sort((a, b) => (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1)
      .slice(0, 4);
    if (active.length === 0) return '';

    const fmt = n => n >= 10000 ? `¥${Math.round(n/10000)}万` : `¥${Math.round(n).toLocaleString()}`;
    const esc = Components.escapeHtml;

    const rows = active.map(g => {
      const target  = Number(g.target_amount) || 0;
      const current = Number(g.current_amount) || 0;
      const pct = target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0;
      const barColor = pct >= 80 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#d97706';
      let deadline = '';
      if (g.deadline) {
        const daysLeft = Math.ceil((new Date(g.deadline) - new Date()) / 86400000);
        const cls = daysLeft <= 30 ? 'sg-deadline urgent' : 'sg-deadline';
        deadline = `<span class="${cls}">${daysLeft <= 0 ? '期限超過' : `あと${daysLeft}日`}</span>`;
      }
      return `<div class="sg-row">
        <div class="sg-top">
          <span class="sg-name">${esc(g.goal || '目標')}</span>
          ${deadline}
          <span class="sg-pct">${pct}%</span>
        </div>
        ${target > 0 ? `<div class="sg-amounts">${fmt(current)} / ${fmt(target)}</div>` : ''}
        <div class="sg-bar-bg"><div class="sg-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
      </div>`;
    }).join('');

    return `<div class="savings-goals-card">
      <div class="sg-header">
        <span class="sg-title">貯蓄・目標の進捗</span>
        <button class="btn btn-xs btn-secondary" onclick="app.navigate('record')">＋ 追加</button>
      </div>
      ${rows}
    </div>`;
  },

  // ─── Budget trend chart (assets domain home, ≥2 months with data) ───
  renderBudgetTrendChart() {
    const income   = store.getDomainData('assets', 'income',   180);
    const expenses = store.getDomainData('assets', 'expenses', 180);
    const allEntries = [...income.map(e => ({...e, _type:'income'})), ...expenses.map(e => ({...e, _type:'expense'}))];
    const monthSet = new Set(allEntries.filter(e => e.timestamp).map(e => e.timestamp.slice(0,7)));
    if (monthSet.size < 2) return '';
    return `<div class="budget-trend-card">
      <div class="budget-trend-header">
        <h3>収支の推移（直近6ヵ月）</h3>
      </div>
      <canvas id="budgetTrendChart" height="130"></canvas>
    </div>`;
  },

  initBudgetTrendChart() {
    const canvas = document.getElementById('budgetTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const incomeData   = store.getDomainData('assets', 'income',   180);
    const expensesData = store.getDomainData('assets', 'expenses', 180);
    const sumByMonth = (data) => months.map(m => data.filter(e => (e.timestamp||'').startsWith(m)).reduce((s,e) => s+(Number(e.amount)||0), 0));
    const incTotals = sumByMonth(incomeData);
    const expTotals = sumByMonth(expensesData);
    const hasData = incTotals.some(v=>v>0) || expTotals.some(v=>v>0);
    if (!hasData) { canvas.closest('.budget-trend-card')?.remove(); return; }
    if (canvas._chart) canvas._chart.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const labels = months.map(m => { const [y,mo] = m.split('-'); return `${Number(mo)}月`; });
    canvas._chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '収入', data: incTotals, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
          { label: '支出', data: expTotals, backgroundColor: 'rgba(239,68,68,0.65)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: tickColor, boxWidth: 12, padding: 8 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor } },
          y: { beginAtZero: true, ticks: { font: { size: 10 }, color: tickColor, callback: v => v >= 10000 ? `¥${Math.round(v/10000)}万` : `¥${v.toLocaleString()}` }, grid: { color: gridColor } }
        }
      }
    });
  },

  // ─── Retirement Runway (老後の安心計算) ───
  renderRetirementRunway() {
    const esc = Components.escapeHtml;
    const fmt = (n) => n >= 10000 ? `¥${Math.round(n / 10000)}万` : `¥${Math.round(n).toLocaleString()}`;

    // 1. Net worth from overview + portfolio
    const overviews = store.getDomainData('assets', 'overview', 365)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const ov = overviews[0] || {};
    const portfolioTotal = store.getDomainData('assets', 'portfolio', 365)
      .reduce((s, e) => s + (Number(e.value) || 0), 0);
    let netWorth = (Number(ov.total_assets) || 0) + portfolioTotal - (Number(ov.total_debt) || 0);

    // Quick-setup override (万円 stored as yen)
    let setup = {};
    try { setup = JSON.parse(localStorage.getItem('lms_retirementSetup') || '{}'); } catch (e) {}
    if (setup.netWorth > 0 && netWorth <= 0) netWorth = setup.netWorth;

    // 2. Monthly cashflow — average across months with data
    const incomeData  = store.getDomainData('assets', 'income',   90);
    const expenseData = store.getDomainData('assets', 'expenses', 90);
    const byMonth = (arr) => {
      const map = {};
      arr.forEach(e => {
        if (!e.timestamp) return;
        const m = e.timestamp.slice(0, 7);
        map[m] = (map[m] || 0) + (Number(e.amount) || 0);
      });
      return map;
    };
    const incMap = byMonth(incomeData);
    const expMap = byMonth(expenseData);
    const allMonths = [...new Set([...Object.keys(incMap), ...Object.keys(expMap)])];
    const avgInc  = allMonths.length ? allMonths.reduce((s, m) => s + (incMap[m] || 0), 0) / allMonths.length : (setup.monthlyIncome || 0);
    const avgExp  = allMonths.length ? allMonths.reduce((s, m) => s + (expMap[m] || 0), 0) / allMonths.length : (setup.monthlyExpense || 0);
    const deficit = avgExp - avgInc;

    const hasData = netWorth > 0 || avgInc > 0 || avgExp > 0;
    if (!hasData) return this._renderRetirementSetup();

    // 3. User age
    const profile = store.get('userProfile') || {};
    const age = Number(profile.age) || 70;
    const spanYears = 30;

    // 4. Runway calculation
    let runwayYears = null;
    let runwayMsg = '';
    let statusColor = '#10b981';

    if (deficit > 0 && netWorth > 0) {
      runwayYears = netWorth / deficit / 12;
      const endAge = Math.round(age + runwayYears);
      if (endAge >= 95) {
        runwayMsg = '95歳以降も安心できます';
        statusColor = '#10b981';
      } else if (endAge >= 85) {
        runwayMsg = `${endAge}歳頃まで安心できます`;
        statusColor = '#f59e0b';
      } else {
        runwayMsg = `試算では${endAge}歳頃に資産が尽きる可能性があります`;
        statusColor = '#ef4444';
      }
    } else if (deficit <= 0 && (avgInc > 0 || avgExp > 0)) {
      runwayMsg = '収入が支出を上回っています。資産は増え続けています。';
      statusColor = '#10b981';
    } else {
      runwayMsg = '収支情報を記録すると試算できます';
      statusColor = '#94a3b8';
    }

    // 5. Timeline bar
    const fillPct = runwayYears !== null ? Math.min(100, (runwayYears / spanYears) * 100) : 100;
    const fillColor = fillPct >= 83 ? '#10b981' : fillPct >= 50 ? '#f59e0b' : '#ef4444';
    const markers = [75, 80, 85, 90, 95].map(a => {
      const pct = ((a - age) / spanYears) * 100;
      return (pct > 2 && pct <= 98) ? `<div class="rr-marker" style="left:${pct.toFixed(1)}%"><span>${a}</span></div>` : '';
    }).join('');

    const nwDisplay = netWorth > 0 ? fmt(netWorth) : '未設定';
    const cashDisplay = deficit > 0
      ? `<span style="color:#ef4444">月${fmt(deficit)}の不足</span>`
      : deficit < 0
        ? `<span style="color:#10b981">月${fmt(-deficit)}の黒字</span>`
        : '記録なし';

    return `<div class="retirement-runway-card">
      <div class="rr-header">
        <span class="rr-title">老後の安心計算</span>
        <button class="btn btn-xs btn-secondary" onclick="Pages.showRetirementSetup()">更新する</button>
      </div>
      <div class="rr-stats">
        <div class="rr-stat">
          <div class="rr-stat-label">総資産（推定）</div>
          <div class="rr-stat-value">${esc(nwDisplay)}</div>
        </div>
        <div class="rr-stat">
          <div class="rr-stat-label">毎月の収支</div>
          <div class="rr-stat-value">${cashDisplay}</div>
        </div>
      </div>
      <div class="rr-status" style="color:${statusColor}">${esc(runwayMsg)}</div>
      ${runwayYears !== null ? `
      <div class="rr-timeline">
        <div class="rr-bar-bg">
          <div class="rr-bar-fill" style="width:${fillPct.toFixed(1)}%;background:${fillColor}"></div>
          ${runwayYears < spanYears ? `<div class="rr-bar-end" style="left:${fillPct.toFixed(1)}%"></div>` : ''}
        </div>
        <div class="rr-markers">${markers}</div>
        <div class="rr-age-labels">
          <span>${age}歳（現在）</span>
          <span>${age + spanYears}歳</span>
        </div>
      </div>` : ''}
      <div class="rr-disclaimer">※試算です。年金・税金・医療費の変動は加味していません。</div>
      ${netWorth <= 0 ? `<button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="Pages.showRetirementSetup()">資産を入力して試算する</button>` : ''}
    </div>`;
  },

  _renderRetirementSetup() {
    return `<div class="retirement-runway-card rr-setup">
      <div class="rr-header">
        <span class="rr-title">老後の安心計算</span>
      </div>
      <p class="rr-setup-desc">現在の資産と毎月の収支を入力するだけで、<br>老後のお金が何歳まで持つか試算します。</p>
      <div class="rr-setup-fields">
        <div class="form-group">
          <label class="form-label" style="font-size:0.82rem">現在の総貯蓄・資産（万円）</label>
          <input type="number" id="rrNetWorth" class="form-input" placeholder="例: 2500" min="0" step="100">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.82rem">月の収入（年金・給与など）（万円）</label>
          <input type="number" id="rrIncome" class="form-input" placeholder="例: 18" min="0" step="1">
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size:0.82rem">月の生活費（万円）</label>
          <input type="number" id="rrExpense" class="form-input" placeholder="例: 22" min="0" step="1">
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="Pages.saveRetirementSetup()">試算する</button>
    </div>`;
  },

  showRetirementSetup() {
    const existing = document.querySelector('.retirement-runway-card');
    if (existing) existing.outerHTML = this._renderRetirementSetup();
  },

  saveRetirementSetup() {
    const nwMAN  = parseFloat(document.getElementById('rrNetWorth')?.value || '0');
    const incMAN = parseFloat(document.getElementById('rrIncome')?.value || '0');
    const expMAN = parseFloat(document.getElementById('rrExpense')?.value || '0');
    if (nwMAN <= 0) { Components.showToast('資産額を入力してください', 'error'); return; }
    const setup = { netWorth: nwMAN * 10000, monthlyIncome: incMAN * 10000, monthlyExpense: expMAN * 10000 };
    try { localStorage.setItem('lms_retirementSetup', JSON.stringify(setup)); } catch (e) {}
    store.addDomainEntry('assets', 'overview', { total_assets: nwMAN * 10000, total_debt: 0, description: '老後の安心計算より入力' });
    if (incMAN > 0) store.addDomainEntry('assets', 'income',   { source: '月収入（年金等）', type: 'pension', amount: incMAN * 10000, recurring: true });
    if (expMAN > 0) store.addDomainEntry('assets', 'expenses', { item: '月の生活費', category: 'other', amount: expMAN * 10000 });
    Components.showToast('試算しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Portfolio Summary (資産ポートフォリオ) ───
  renderPortfolioSummary() {
    const portfolio = store.getDomainData('assets', 'portfolio', 365);
    const overviews = store.getDomainData('assets', 'overview', 365)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const ov = overviews[0] || {};

    const hasPortfolio = portfolio.length > 0;
    const hasOverview  = Number(ov.total_assets) > 0;
    if (!hasPortfolio && !hasOverview) return '';

    const fmt = (n) => {
      if (n >= 100000000) return `¥${(n / 100000000).toFixed(1)}億`;
      if (n >= 10000)     return `¥${Math.round(n / 10000)}万`;
      return `¥${Math.round(n).toLocaleString()}`;
    };

    const typeLabels = {
      stock: '株式', bond: '債券', real_estate: '不動産',
      fund: '投資信託', insurance: '保険', deposit: '預貯金',
      pension: '年金', other: 'その他'
    };
    const typeColors = {
      stock: '#3b82f6', bond: '#8b5cf6', real_estate: '#d97706',
      fund: '#06b6d4', insurance: '#10b981', deposit: '#6C63FF',
      pension: '#f59e0b', other: '#94a3b8'
    };

    // Aggregate portfolio by type
    const byType = {};
    portfolio.forEach(e => {
      const t = e.asset_type || 'other';
      byType[t] = (byType[t] || 0) + (Number(e.value) || 0);
    });

    // Add overview deposit if no explicit deposit entry and overview has total_assets
    if (!byType.deposit && hasOverview && !hasPortfolio) {
      byType.deposit = Number(ov.total_assets) || 0;
    }

    const total = Object.values(byType).reduce((s, v) => s + v, 0);
    const debt  = Number(ov.total_debt) || 0;
    const netWorth = total - debt;

    const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    const maxVal = entries[0]?.[1] || 1;

    const esc = Components.escapeHtml;
    const rows = entries.map(([type, val]) => {
      const pct = Math.round(val / total * 100);
      const color = typeColors[type] || '#94a3b8';
      return `<div class="ps-row">
        <span class="ps-type">${esc(typeLabels[type] || type)}</span>
        <div class="ps-bar-track">
          <div class="ps-bar-fill" style="width:${Math.round(val/maxVal*100)}%;background:${color}"></div>
        </div>
        <span class="ps-amt">${esc(fmt(val))}</span>
        <span class="ps-pct">${pct}%</span>
      </div>`;
    }).join('');

    return `<div class="portfolio-summary-card">
      <div class="ps-header">
        <span class="ps-title">資産の内訳</span>
        <button class="btn btn-xs btn-secondary" onclick="app.navigate('record')">＋ 追加</button>
      </div>
      <div class="ps-totals">
        <div class="ps-total-item">
          <div class="ps-total-label">総資産</div>
          <div class="ps-total-value">${esc(fmt(total))}</div>
        </div>
        ${debt > 0 ? `<div class="ps-total-item">
          <div class="ps-total-label">負債</div>
          <div class="ps-total-value" style="color:#ef4444">${esc(fmt(debt))}</div>
        </div>` : ''}
        <div class="ps-total-item">
          <div class="ps-total-label">純資産</div>
          <div class="ps-total-value" style="color:${netWorth >= 0 ? '#10b981' : '#ef4444'}">${esc(fmt(netWorth))}</div>
        </div>
      </div>
      <div class="ps-rows">${rows}</div>
    </div>`;
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
    const filter = store.get('dataBrowserFilter') || { category: '', search: '', sort: 'desc', dateFrom: '', dateTo: '' };
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
    if (filter.dateFrom) {
      allEntries = allEntries.filter(e => (e.timestamp || '').slice(0, 10) >= filter.dateFrom);
    }
    if (filter.dateTo) {
      allEntries = allEntries.filter(e => (e.timestamp || '').slice(0, 10) <= filter.dateTo);
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
          <div class="data-filters" style="margin-top:8px;">
            <div class="form-group" style="flex:1;">
              <label>開始日</label>
              <input type="date" id="dataDateFrom" class="form-input"
                value="${Components.escapeHtml(filter.dateFrom || '')}"
                onchange="app.filterDataBrowser('dateFrom',this.value)">
            </div>
            <div class="form-group" style="flex:1;">
              <label>終了日</label>
              <input type="date" id="dataDateTo" class="form-input"
                value="${Components.escapeHtml(filter.dateTo || '')}"
                onchange="app.filterDataBrowser('dateTo',this.value)">
            </div>
            <div class="form-group" style="flex:1;align-self:flex-end;">
              ${filter.dateFrom || filter.dateTo ? `<p style="font-size:12px;color:var(--accent);margin:0 0 4px 0;">${allEntries.length}件表示中</p>` : ''}
            </div>
          </div>
          <div class="data-actions">
            <button class="btn btn-sm btn-secondary" onclick="app.exportDomainCSV('${domain}')">CSVで保存</button>
            <button class="btn btn-sm btn-secondary" onclick="app.exportDomainData('${domain}')">JSONで保存</button>
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

  // ─── Weekly Reflection Card (Sunday & Monday only, once per week) ───
  renderWeeklyReflectionCard() {
    const today = new Date();
    const day = today.getDay(); // 0=Sun, 1=Mon
    if (day !== 0 && day !== 1) return '';

    const weekKey = `${today.getFullYear()}-W${this._weekNumber(today)}`;
    try { if (localStorage.getItem('lms_weeklyReflection_' + weekKey)) return ''; } catch(e) {}

    const esc = Components.escapeHtml;
    return `<div class="weekly-reflect-card" id="weeklyReflectCard">
      <div class="wrc-header">
        <span class="wrc-icon">📔</span>
        <div class="wrc-titles">
          <div class="wrc-title">今週の振り返り</div>
          <div class="wrc-sub">3つの質問で1週間を整えましょう</div>
        </div>
        <button class="wrc-close" onclick="Pages.dismissWeeklyReflection('${esc(weekKey)}')">×</button>
      </div>
      <div class="wrc-form">
        <div class="wrc-q">今週、一番良かったことは？</div>
        <input type="text" id="wrBest" class="form-input wrc-input" placeholder="例：散歩を毎日続けた" maxlength="60">
        <div class="wrc-q">今週の課題・気になったことは？</div>
        <input type="text" id="wrChallenge" class="form-input wrc-input" placeholder="例：睡眠が浅かった" maxlength="60">
        <div class="wrc-q">来週、一つだけやりたいことは？</div>
        <input type="text" id="wrNext" class="form-input wrc-input" placeholder="例：友人に連絡する" maxlength="60">
      </div>
      <div class="wrc-footer">
        <button class="btn btn-ghost btn-sm" onclick="Pages.dismissWeeklyReflection('${esc(weekKey)}')">スキップ</button>
        <button class="btn btn-primary btn-sm" onclick="app.saveWeeklyReflection('${esc(weekKey)}')">記録する →</button>
      </div>
    </div>`;
  },

  dismissWeeklyReflection(weekKey) {
    try { localStorage.setItem('lms_weeklyReflection_' + weekKey, 'skipped'); } catch(e) {}
    const card = document.getElementById('weeklyReflectCard');
    if (card) card.remove();
  },

  // ─── Check-in Summary Card (shown after morning check-in completed) ───
  renderCheckinSummaryCard() {
    const today = new Date().toISOString().split('T')[0];
    if (!localStorage.getItem('lms_checkin_' + today)) return '';
    try { if (localStorage.getItem('lms_checkin_summary_dismissed_' + today)) return ''; } catch(e) {}

    let answers = {};
    try { answers = JSON.parse(localStorage.getItem('lms_checkin_answers_' + today) || '{}'); } catch(e) {}
    const domains = Object.keys(answers);
    if (domains.length === 0) return '';

    const colorMap = { consciousness:'#6C63FF', health:'#10b981', time:'#f59e0b', work:'#3b82f6', relationship:'#ef4444', assets:'#d97706' };
    const iconMap  = { consciousness:'一', health:'二', time:'三', work:'四', relationship:'五', assets:'六' };
    const labelMap = { consciousness:'意識', health:'健康', time:'時間', work:'仕事', relationship:'関係', assets:'資産' };
    const valueLabels = {
      consciousness: {calm:'穏やか', neutral:'普通', anxious:'不安'},
      health:        {good:'良い', fair:'普通', poor:'悪い'},
      time:          {planned:'しっかりある', loose:'ゆるくある', unknown:'まだ不明'},
      work:          {yes:'ある', some:'少し', none:'なし'},
      relationship:  {planned:'予定あり', maybe:'たぶん', none:'なし'},
      assets:        {secure:'安心', some:'少し', worried:'心配'}
    };
    const suggestionMap = {
      consciousness: {anxious:'今の気持ちを一言書き出すと楽になります。意識ページで記録してみましょう。', neutral:'5分間の深呼吸を試してみましょう。'},
      health:        {poor:'今日は無理せず休養を優先しましょう。3日続くようなら医師に相談を。', fair:'水分をこまめに取りましょう。'},
      time:          {unknown:'今日1つだけやることを決めてみましょう。小さな一歩が大切です。', loose:'朝のうちに今日のメイン行動を1つ書き出してみましょう。'},
      work:          {none:'今日は充電の日です。明日やりたいことをメモしておきましょう。', some:'小さな達成を積み上げましょう。できたことを記録すると自信につながります。'},
      relationship:  {none:'久しぶりに連絡したい人はいますか？関係ページで確認できます。', maybe:'LINEで一言送るだけで十分です。今日1人に連絡してみましょう。'},
      assets:        {worried:'心配を具体化すると小さくなります。資産ページで状況を整理しましょう。', some:'今月の支出を確認してみましょう。把握するだけで安心感が変わります。'}
    };
    const esc = Components.escapeHtml;

    const pillsHtml = domains.map(d => {
      const val = answers[d]?.value;
      const label = valueLabels[d]?.[val] || val || '';
      const color = colorMap[d] || '#6C63FF';
      return `<div class="cscr-pill" style="background:${color}18;color:${color}">${iconMap[d]} ${labelMap[d]}: <strong>${esc(label)}</strong></div>`;
    }).join('');

    // Lowest-score answers get suggestions first
    const sorted = [...domains].sort((a, b) => (answers[a].score || 9) - (answers[b].score || 9));
    const suggestions = [];
    sorted.forEach(d => {
      if (suggestions.length >= 2) return;
      const val = answers[d]?.value;
      const s = suggestionMap[d]?.[val];
      if (s) suggestions.push({ domain: d, text: s, color: colorMap[d], icon: iconMap[d] });
    });

    return `<div class="cscr-card" id="checkinSummaryCard">
      <div class="cscr-header">
        <span class="cscr-title">✓ 今日のチェックイン完了</span>
        <button class="cscr-close" onclick="Pages.dismissCheckinSummary()">×</button>
      </div>
      <div class="cscr-pills">${pillsHtml}</div>
      ${suggestions.length > 0 ? `<div class="cscr-suggestions">
        <div class="cscr-sug-title">今日のおすすめ</div>
        ${suggestions.map(s => `<div class="cscr-sug-item">
          <span class="cscr-sug-icon" style="color:${s.color}">${s.icon}</span>
          <span class="cscr-sug-text">${esc(s.text)}</span>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  },

  dismissCheckinSummary() {
    const today = new Date().toISOString().split('T')[0];
    try { localStorage.setItem('lms_checkin_summary_dismissed_' + today, '1'); } catch(e) {}
    const card = document.getElementById('checkinSummaryCard');
    if (card) card.remove();
  },

  // ─── Morning Check-in Modal ───
  renderDailyCheckinModal() {
    this._ciAnswers = {};
    const steps = [
      { domain: 'consciousness', label: '意識', icon: '一', color: '#6C63FF',
        question: '今朝、心の状態は？',
        answers: [{text:'穏やか',value:'calm',score:9},{text:'普通',value:'neutral',score:6},{text:'不安',value:'anxious',score:3}]
      },
      { domain: 'health', label: '健康', icon: '二', color: '#10b981',
        question: '体の調子は？',
        answers: [{text:'良い',value:'good',score:9},{text:'普通',value:'fair',score:6},{text:'悪い',value:'poor',score:3}]
      },
      { domain: 'time', label: '時間', icon: '三', color: '#f59e0b',
        question: '今日の予定は？',
        answers: [{text:'しっかりある',value:'planned',score:9},{text:'ゆるくある',value:'loose',score:6},{text:'まだ不明',value:'unknown',score:4}]
      },
      { domain: 'work', label: '仕事', icon: '四', color: '#3b82f6',
        question: '今日、やることがありますか？',
        answers: [{text:'ある',value:'yes',score:8},{text:'少し',value:'some',score:6},{text:'なし',value:'none',score:5}]
      },
      { domain: 'relationship', label: '関係', icon: '五', color: '#ef4444',
        question: '今日、誰かと交流しますか？',
        answers: [{text:'予定あり',value:'planned',score:9},{text:'たぶん',value:'maybe',score:6},{text:'なし',value:'none',score:4}]
      },
      { domain: 'assets', label: '資産', icon: '六', color: '#d97706',
        question: 'お金の心配はありますか？',
        answers: [{text:'安心',value:'secure',score:9},{text:'少し',value:'some',score:6},{text:'心配',value:'worried',score:3}]
      }
    ];
    const n = steps.length;
    return `<div class="ci-overlay" id="ciOverlay">
      <div class="ci-modal">
        <button class="ci-close" onclick="Pages.closeCheckin()" aria-label="閉じる">✕</button>
        <div class="ci-header">
          <div class="ci-title">朝のチェックイン</div>
          <div class="ci-subtitle">6つの質問、30秒で完了</div>
        </div>
        <div class="ci-progress"><div class="ci-progress-bar" id="ciProgressBar" style="width:0%"></div></div>
        ${steps.map((s, i) => `
          <div class="ci-step" id="ci-step-${i}" ${i > 0 ? 'style="display:none"' : ''}>
            <div class="ci-step-badge" style="background:${s.color}20;color:${s.color}">${s.icon} ${s.label}</div>
            <div class="ci-question">${s.question}</div>
            <div class="ci-answers">
              ${s.answers.map(a => `<button class="ci-answer" style="--ci-color:${s.color}"
                onclick="Pages.selectCheckinAnswer(${i},'${a.value}',${a.score},'${s.domain}',${n})">${Components.escapeHtml(a.text)}</button>`).join('')}
            </div>
            <button class="ci-skip" onclick="Pages.skipCheckinStep(${i},${n})">スキップ</button>
          </div>`).join('')}
        <div class="ci-step ci-done" id="ci-step-${n}" style="display:none">
          <div class="ci-done-icon">🌟</div>
          <div class="ci-done-title">チェックイン完了！</div>
          <div class="ci-done-sub">今日の状態を記録しました。<br>丁寧な一日を。</div>
          <button class="btn btn-primary ci-done-btn" onclick="Pages.closeCheckin()">はじめよう</button>
        </div>
        <div class="ci-dots">
          ${steps.map((_, i) => `<div class="ci-dot${i === 0 ? ' ci-dot-active' : ''}" id="ci-dot-${i}"></div>`).join('')}
        </div>
      </div>
    </div>`;
  },

  selectCheckinAnswer(stepIdx, value, score, domain, totalSteps) {
    this._ciAnswers[domain] = { value, score };
    setTimeout(() => this.advanceCheckin(stepIdx, totalSteps), 280);
  },

  skipCheckinStep(stepIdx, totalSteps) {
    this.advanceCheckin(stepIdx, totalSteps);
  },

  advanceCheckin(stepIdx, totalSteps) {
    const cur = document.getElementById('ci-step-' + stepIdx);
    if (cur) cur.style.display = 'none';
    const curDot = document.getElementById('ci-dot-' + stepIdx);
    if (curDot) { curDot.classList.remove('ci-dot-active'); curDot.classList.add('ci-dot-done'); }

    const nextIdx = stepIdx + 1;
    const next = document.getElementById('ci-step-' + nextIdx);
    if (next) next.style.display = '';
    const bar = document.getElementById('ciProgressBar');
    if (bar) bar.style.width = Math.round((nextIdx / totalSteps) * 100) + '%';
    const nextDot = document.getElementById('ci-dot-' + nextIdx);
    if (nextDot) nextDot.classList.add('ci-dot-active');
  },

  closeCheckin() {
    if (typeof app !== 'undefined') app.saveDailyCheckin(this._ciAnswers);
    this._ciAnswers = {};
    const overlay = document.getElementById('ciOverlay');
    if (overlay) overlay.remove();
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Afternoon/Evening Sleep Log (health domain, 11am-10pm, if no sleep logged today) ───
  renderAfternoonSleepLog() {
    const hour = new Date().getHours();
    if (hour < 11 || hour >= 22) return ''; // morning vitals card handles 5–11am
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_sleepLog_' + today;
    if (localStorage.getItem(lsKey)) return '';
    // Also skip if already captured via morning vitals card
    const vitals = store.getDomainData('health', 'vitals', 1).filter(e => (e.timestamp || '').startsWith(today) && e.sleep_quality);
    if (vitals.length > 0) return '';
    const sleepEntries = store.getDomainData('health', 'sleepData', 1).filter(e => (e.timestamp || '').startsWith(today));
    if (sleepEntries.length > 0) return '';

    const emojis = [['😴','良く眠れた',9],['🙂','まあまあ',7],['😐','普通',5],['😕','あまり眠れず',3],['😫','ほとんど眠れず',1]];

    const emojiButtons = emojis.map(([e, label, val]) =>
      `<button class="sl-emoji-btn" data-val="${val}" title="${label}"
        onclick="Pages.selectSleepQuality(${val}, this)">${e}</button>`
    ).join('');

    return `<div class="sleep-log-card" id="sleepLogCard">
      <div class="sl-header">
        <span class="sl-icon">😴</span>
        <span class="sl-title">昨夜の睡眠はどうでしたか？</span>
      </div>
      <div class="sl-emojis">${emojiButtons}</div>
      <div class="sl-extra" id="slExtra" style="display:none">
        <div class="sl-dur-row">
          <label class="sl-label">就寝時刻</label>
          <input type="time" id="slBedtime" class="form-input sl-time-input" value="23:00">
          <label class="sl-label">起床時刻</label>
          <input type="time" id="slWaketime" class="form-input sl-time-input" value="07:00">
        </div>
        <button class="btn btn-primary btn-sm" onclick="Pages.saveSleepLog()">記録する</button>
        <button class="btn btn-ghost btn-sm" onclick="localStorage.setItem('${lsKey}','skip');document.getElementById('sleepLogCard').remove()">後で</button>
      </div>
      <input type="hidden" id="slQuality" value="">
    </div>`;
  },

  selectSleepQuality(val, btn) {
    document.querySelectorAll('.sl-emoji-btn').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    const hiddenEl = document.getElementById('slQuality');
    if (hiddenEl) hiddenEl.value = String(val);
    const extra = document.getElementById('slExtra');
    if (extra) extra.style.display = 'flex';
  },

  saveSleepLog() {
    const quality = parseInt(document.getElementById('slQuality')?.value || '', 10);
    if (!quality) { Components.showToast('睡眠の質を選択してください', 'error'); return; }
    const bedtime  = document.getElementById('slBedtime')?.value || '';
    const waketime = document.getElementById('slWaketime')?.value || '';
    store.addDomainEntry('health', 'sleepData', { quality, sleep_time: bedtime, wake_time: waketime });
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('lms_sleepLog_' + today, '1');
    Components.showToast('睡眠記録を保存しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Isolation Score Card (relationship domain) ───
  renderIsolationScore() {
    const contacts = store.get('relationship_contacts') || [];
    if (contacts.length === 0) return '';
    const interactions = store.getDomainData('relationship', 'interactions', 28);
    if (interactions.length === 0) return '';

    const now = Date.now();
    const week7 = new Date(now - 7 * 86400000).toISOString().split('T')[0];
    const days28 = new Date(now - 28 * 86400000).toISOString().split('T')[0];

    const weekPeople = new Set(
      interactions.filter(e => e.timestamp >= week7 && e.person).map(e => e.person)
    ).size;
    const monthPeople = new Set(
      interactions.filter(e => e.timestamp >= days28 && e.person).map(e => e.person)
    ).size;

    // Risk 0–100: higher = more isolated
    let risk;
    if (weekPeople >= 5) risk = 10;
    else if (weekPeople >= 3) risk = 25;
    else if (weekPeople >= 1) risk = 50;
    else if (monthPeople >= 3) risk = 65;
    else if (monthPeople >= 1) risk = 80;
    else risk = 95;

    const level = risk <= 25 ? 'low' : risk <= 60 ? 'mid' : 'high';
    const labels = { low: '良好', mid: 'やや注意', high: '要注意' };
    const colors = { low: '#10b981', mid: '#f59e0b', high: '#ef4444' };
    const msgs = {
      low: '今週もしっかりつながれています。この調子を続けましょう。',
      mid: '今週の交流がやや少なめです。久しぶりの人に一言連絡してみましょう。',
      high: '最近、人との交流が少なくなっています。小さなつながりを意識してみましょう。'
    };

    const connScore = 100 - risk;
    const deg = Math.round(connScore * 1.8); // 0–180deg (half-circle gauge)

    return `<div class="isolation-score-card">
      <div class="isc-header">
        <span class="isc-title">つながり健康度</span>
        <span class="isc-badge isc-${level}">${labels[level]}</span>
      </div>
      <div class="isc-body">
        <div class="isc-gauge-wrap">
          <div class="isc-arc" style="--arc-deg:${deg}deg;--arc-color:${colors[level]}">
            <div class="isc-arc-inner">
              <div class="isc-score" style="color:${colors[level]}">${connScore}</div>
              <div class="isc-score-label">/ 100</div>
            </div>
          </div>
        </div>
        <div class="isc-stats">
          <div class="isc-stat">
            <div class="isc-stat-num" style="color:${colors[level]}">${weekPeople}</div>
            <div class="isc-stat-label">今週の交流人数</div>
          </div>
          <div class="isc-stat">
            <div class="isc-stat-num">${monthPeople}</div>
            <div class="isc-stat-label">今月の交流人数</div>
          </div>
        </div>
      </div>
      <div class="isc-msg">${Components.escapeHtml(msgs[level])}</div>
    </div>`;
  },

  // ─── Micro Journal (consciousness domain, 1–2 sentences daily reflection) ───
  renderMicroJournal() {
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_microjournal_' + today;
    let saved = '';
    try { saved = localStorage.getItem(lsKey) || ''; } catch(e) {}

    if (saved) {
      return `<div class="micro-journal-card mj-done">
        <div class="mj-header">
          <span class="mj-icon">📝</span>
          <span class="mj-title">今日のひとこと <span class="mj-badge">✓ 記録済</span></span>
        </div>
        <div class="mj-text">${Components.escapeHtml(saved)}</div>
      </div>`;
    }

    return `<div class="micro-journal-card">
      <div class="mj-header">
        <span class="mj-icon">📝</span>
        <span class="mj-title">今日のひとこと</span>
      </div>
      <p class="mj-desc">今日感じたことを一言だけ。長くなくて大丈夫です。</p>
      <div class="mj-input-row">
        <textarea id="mjText" class="form-input mj-textarea" rows="2"
          placeholder="例：今日は散歩が気持ちよかった。少し疲れ気味だけど穏やか。" maxlength="200"></textarea>
      </div>
      <div class="mj-actions">
        <button class="btn btn-primary btn-sm" onclick="Pages.saveMicroJournal()">記録する</button>
        <button class="btn btn-voice btn-sm" id="voiceBtn_mjText" onclick="app.startVoiceInput('mjText')" title="音声入力">🎤</button>
      </div>
    </div>`;
  },

  saveMicroJournal() {
    const text = document.getElementById('mjText')?.value?.trim();
    if (!text) { Components.showToast('ひとことを入力してください', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('lms_microjournal_' + today, text);
    store.addDomainEntry('consciousness', 'journal', { content: text, notes: 'ひとこと日記' });
    Components.showToast('記録しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Step Counter (health domain) ───
  renderStepCounter() {
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_steps_' + today;
    let steps = 0;
    try { steps = parseInt(localStorage.getItem(lsKey) || '0', 10); } catch(e) {}

    const goal = 8000;
    const pct = Math.min(100, Math.round(steps / goal * 100));
    const remaining = Math.max(0, goal - steps);
    const achieved = steps >= goal;
    const deg = Math.round(pct * 3.6);

    const statusHtml = achieved
      ? '<div class="sc-achieved">目標達成！</div>'
      : `<div class="sc-remaining">あと <strong>${remaining.toLocaleString()}</strong> 歩</div>`;

    return `<div class="step-counter-card">
      <div class="sc-header">
        <span class="sc-title">今日の歩数</span>
        <span class="sc-goal">目標 ${goal.toLocaleString()}歩</span>
      </div>
      <div class="sc-body">
        <div class="sc-ring-wrap">
          <div class="sc-ring" style="background: conic-gradient(#10b981 ${deg}deg, var(--bg-tertiary) 0)">
            <div class="sc-inner">
              <div class="sc-count">${steps >= 10000 ? (steps/10000).toFixed(1)+'万' : steps.toLocaleString()}</div>
              <div class="sc-unit">歩</div>
            </div>
          </div>
          <div class="sc-pct-badge">${pct}%</div>
        </div>
        <div class="sc-side">
          ${statusHtml}
          <div class="sc-buttons">
            <button class="sc-btn" onclick="Pages.addSteps(1000)">+1,000</button>
            <button class="sc-btn" onclick="Pages.addSteps(2000)">+2,000</button>
            <button class="sc-btn" onclick="Pages.addSteps(3000)">+3,000</button>
            <button class="sc-btn" onclick="Pages.addSteps(5000)">+5,000</button>
          </div>
          <div class="sc-custom-row">
            <input type="number" id="scCustom" class="form-input form-input-sm" placeholder="直接入力（例：6500）" min="0" max="99999">
            <button class="btn btn-sm btn-secondary" onclick="Pages.setStepsCustom()">設定</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  // ─── Weekly Step Goal Card (health domain, gate: ≥2 days with data) ───
  renderWeeklyStepGoal() {
    const now = new Date();
    const weeklyGoal = 50000;
    const days = [];
    let totalSteps = 0;
    let activeDays = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      let s = 0;
      try { s = parseInt(localStorage.getItem('lms_steps_' + key) || '0', 10); } catch(e) {}
      days.push({ key, label: ['日','月','火','水','木','金','土'][d.getDay()], steps: s, isToday: i === 0 });
      totalSteps += s;
      if (s > 0) activeDays++;
    }

    if (activeDays < 2) return '';

    const pct = Math.min(100, Math.round(totalSteps / weeklyGoal * 100));
    const remaining = Math.max(0, weeklyGoal - totalSteps);
    const daysLeft = 7 - days.filter(d => d.steps > 0 || d.isToday).length;
    const maxSteps = Math.max(...days.map(d => d.steps), 1);
    const dailyNeeded = daysLeft > 0 ? Math.ceil(remaining / Math.max(1, daysLeft)) : 0;

    const barColor = pct >= 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#3b82f6';
    const msg = pct >= 100
      ? '今週の歩数目標を達成しました！'
      : daysLeft > 0 && dailyNeeded < 10000
        ? `あと${daysLeft}日・1日あたり${dailyNeeded.toLocaleString()}歩で達成できます`
        : `今週の累計 ${totalSteps.toLocaleString()} 歩`;

    const bars = days.map(d => {
      const h = Math.round((d.steps / maxSteps) * 48);
      const color = d.isToday ? barColor : d.steps > 0 ? `${barColor}88` : 'var(--bg-tertiary)';
      const label = d.steps > 0 ? (d.steps >= 10000 ? `${(d.steps/10000).toFixed(1)}万` : `${Math.round(d.steps/1000)}k`) : '';
      return `<div class="wsb-col">
        <div class="wsb-label-top">${label}</div>
        <div class="wsb-bar-wrap"><div class="wsb-bar" style="height:${h}px;background:${color}"></div></div>
        <div class="wsb-day${d.isToday ? ' wsb-today' : ''}">${d.label}</div>
      </div>`;
    }).join('');

    return `<div class="weekly-step-goal-card">
      <div class="wsg-header">
        <span class="wsg-title">今週の歩数</span>
        <span class="wsg-goal">${weeklyGoal.toLocaleString()}歩/週 目標</span>
      </div>
      <div class="wsg-progress-row">
        <span class="wsg-total">${totalSteps >= 10000 ? `${(totalSteps/10000).toFixed(1)}万` : totalSteps.toLocaleString()}</span>
        <div class="wsg-bar-bg"><div class="wsg-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
        <span class="wsg-pct">${pct}%</span>
      </div>
      <div class="wsg-bars">${bars}</div>
      <div class="wsg-msg">${msg}</div>
    </div>`;
  },

  addSteps(n) {
    const today = new Date().toISOString().split('T')[0];
    const lsKey = 'lms_steps_' + today;
    let steps = 0;
    try { steps = parseInt(localStorage.getItem(lsKey) || '0', 10); } catch(e) {}
    steps = Math.min(99999, steps + n);
    localStorage.setItem(lsKey, String(steps));
    this._syncSteps(today, steps);
    if (typeof app !== 'undefined') app.renderApp();
  },

  setStepsCustom() {
    const el = document.getElementById('scCustom');
    const val = parseInt(el ? el.value : '', 10);
    if (isNaN(val) || val < 0) { Components.showToast('歩数を入力してください', 'error'); return; }
    const today = new Date().toISOString().split('T')[0];
    const capped = Math.min(99999, val);
    localStorage.setItem('lms_steps_' + today, String(capped));
    this._syncSteps(today, capped);
    if (typeof app !== 'undefined') app.renderApp();
  },

  _syncSteps(today, steps) {
    const syncKey = 'lms_stepsSynced_' + today;
    if (steps >= 5000 && !localStorage.getItem(syncKey)) {
      store.addDomainEntry('health', 'activities', { steps, notes: '歩数記録' });
      localStorage.setItem(syncKey, '1');
    }
  },

  // ─── Gratitude Streak (consciousness domain) ───
  renderGratitudeStreak() {
    const entries = store.getDomainData('consciousness', 'appreciation', 60);
    if (entries.length < 2) return '';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const daysWithEntries = new Set();
    entries.forEach(e => {
      if (e.timestamp) daysWithEntries.add(e.timestamp.split('T')[0]);
    });
    try {
      if (localStorage.getItem('lms_gratitude_' + todayStr)) daysWithEntries.add(todayStr);
    } catch(e) {}

    // Count consecutive streak backwards from today
    let streak = 0;
    const cursor = new Date(today);
    for (let i = 0; i < 120; i++) {
      const ds = cursor.toISOString().split('T')[0];
      if (daysWithEntries.has(ds)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }

    if (streak < 2) return '';

    const dayNames = ['日','月','火','水','木','金','土'];
    const dots = Array.from({length: 7}, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const ds = d.toISOString().split('T')[0];
      const has = daysWithEntries.has(ds);
      return `<div class="gs-dot-wrap">
        <div class="gs-dot${has ? ' filled' : ''}"></div>
        <div class="gs-dot-label">${dayNames[d.getDay()]}</div>
      </div>`;
    }).join('');

    const milestones = [3, 7, 14, 21, 30, 60, 100];
    const next = milestones.find(m => m > streak) || (streak + 10);

    return `<div class="gratitude-streak-card">
      <div class="gs-header">
        <div class="gs-flame">🔥</div>
        <div class="gs-info">
          <div class="gs-count"><strong>${streak}</strong> 日連続</div>
          <div class="gs-sub">次の目標：${next}日</div>
        </div>
        <div class="gs-milestone">${streak >= 30 ? '🏆' : streak >= 7 ? '⭐' : '✨'}</div>
      </div>
      <div class="gs-week">${dots}</div>
    </div>`;
  },

  // ─── Work Weekly Stats Card (work domain) ───
  renderWorkWeeklyStats() {
    const tasks = store.getDomainData('work', 'tasks', 7);
    const completions = store.getDomainData('work', 'completions', 7);
    const reflections = store.getDomainData('work', 'reflections', 7);

    if (tasks.length === 0 && completions.length === 0 && reflections.length === 0) return '';

    const allDates = [
      ...tasks.map(e => (e.timestamp || '').split('T')[0]),
      ...completions.map(e => (e.timestamp || '').split('T')[0]),
      ...reflections.map(e => (e.timestamp || '').split('T')[0])
    ].filter(Boolean);
    const activeDays = new Set(allDates).size;

    const totalCompleted = completions.reduce((s, e) => {
      if (Array.isArray(e.completed)) return s + e.completed.length;
      return s + (e.completed ? 1 : 0);
    }, 0);

    const totalPlanned = tasks.reduce((s, e) => {
      if (Array.isArray(e.tasks)) return s + e.tasks.length;
      return s + (e.tasks ? 1 : 0);
    }, 0);

    const avgRating = reflections.length > 0
      ? (reflections.reduce((s, e) => s + (parseFloat(e.day_rating) || 0), 0) / reflections.length).toFixed(1)
      : null;

    const stats = [
      { num: activeDays, label: '活動した日' },
      ...(totalCompleted > 0 ? [{ num: totalCompleted, label: '完了したこと' }] : []),
      ...(totalPlanned > 0 ? [{ num: totalPlanned, label: '計画したこと' }] : []),
      ...(avgRating ? [{ num: avgRating, label: '平均満足度' }] : [])
    ];

    const statCells = stats.map(s => `<div class="wws-stat">
      <div class="wws-num">${s.num}</div>
      <div class="wws-label">${s.label}</div>
    </div>`).join('');

    return `<div class="work-weekly-stats-card">
      <div class="wws-header">今週の仕事サマリー</div>
      <div class="wws-grid">${statCells}</div>
    </div>`;
  },

  // ─── Medical Expense Tracker (assets domain) ─ 医療費控除 support ───
  renderMedicalExpenseTracker() {
    const now = new Date();
    const year = now.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const entries = store.getDomainData('assets', 'medical', 365)
      .filter(e => e.timestamp && new Date(e.timestamp) >= yearStart)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const threshold = 100000;
    const pct = Math.min(100, Math.round(total / threshold * 100));
    const eligible = Math.max(0, total - threshold);
    const fmt = n => '¥' + n.toLocaleString();

    const progressMsg = pct >= 100
      ? `${fmt(eligible)} の医療費控除が申請できます`
      : `控除まであと ${fmt(threshold - total)}（年間合計 ${fmt(threshold)} を超えると申請可）`;

    const typeLabels = {
      hospital: '病院・クリニック',
      pharmacy: '薬局・薬代',
      dental: '歯科',
      nursing: '介護・施術',
      transport: '通院交通費',
      other: 'その他'
    };

    return `<div class="med-exp-card">
      <div class="med-exp-header">
        <div>
          <div class="med-exp-title">医療費の記録（${year}年）</div>
          <div class="med-exp-sub">確定申告・医療費控除の管理</div>
        </div>
        <div class="med-exp-total" style="${total > 0 ? '' : 'opacity:0.3'}">${fmt(total)}</div>
      </div>
      <div class="med-exp-progress">
        <div class="med-exp-bar">
          <div class="med-exp-fill" style="width:${pct}%"></div>
        </div>
        <div class="med-exp-msg${pct >= 100 ? ' eligible' : ''}">${progressMsg}</div>
      </div>
      <div class="med-exp-form">
        <select id="medType" class="form-input form-input-sm">
          ${Object.entries(typeLabels).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
        <input type="number" id="medAmount" class="form-input form-input-sm"
          placeholder="金額 (円)" min="0" step="100" style="width:120px;">
        <button class="btn btn-primary btn-sm" onclick="Pages.logMedicalExpense()">記録</button>
      </div>
      ${entries.length > 0 ? `<div class="med-exp-recent">
        ${entries.slice(0, 4).map(e => `
          <div class="med-entry">
            <span class="med-entry-type">${typeLabels[e.type] || Components.escapeHtml(e.type || '')}</span>
            <span class="med-entry-amt">${fmt(Number(e.amount || 0))}</span>
            <span class="med-entry-date">${(e.timestamp || '').slice(5, 10).replace('-', '/')}</span>
          </div>`).join('')}
      </div>`
      : `<p class="med-exp-hint">今年の医療費を記録しておくと、確定申告の際に一覧として活用できます。通院交通費も対象です。</p>`}
    </div>`;
  },

  logMedicalExpense() {
    const type = document.getElementById('medType')?.value;
    const amount = Number(document.getElementById('medAmount')?.value);
    if (!type || isNaN(amount) || amount <= 0) {
      Components.showToast('種類と金額を入力してください', 'error');
      return;
    }
    store.addDomainEntry('assets', 'medical', { type, amount, timestamp: new Date().toISOString() });
    Components.showToast('記録しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Today's Balance Radar — 6-domain score across all life areas ───
  _calcDailyScores(today) {
    const scores = {};

    // Health: steps (max 5) + last night's sleep quality (max 5)
    const steps = parseInt(localStorage.getItem('lms_steps_' + today) || '0', 10);
    let h = Math.min(5, steps / 1600);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const yKey = yest.toISOString().split('T')[0];
    const sl = store.getDomainData('health', 'sleepData', 2).find(e => (e.timestamp || '').startsWith(yKey));
    if (sl && sl.quality) h += Number(sl.quality) / 2;
    scores.health = Math.min(10, h);

    // Consciousness: mood_level (0-10) + bonus for breathing/meditation
    const consToday = store.getDomainData('consciousness', 'entries', 3).filter(e => (e.timestamp || '').startsWith(today));
    const moodE = consToday.find(e => e.mood_level);
    let c = moodE ? Number(moodE.mood_level) : 0;
    if (consToday.some(e => e.entry_type === 'breathing' || e.entry_type === 'meditation')) c = Math.min(10, c + 2);
    scores.consciousness = c;

    // Time: time log entries + completed habits
    const tLogs = store.getDomainData('time', 'entries', 3).filter(e => (e.timestamp || '').startsWith(today));
    const tHab = store.getDomainData('time', 'habits', 3).filter(e => (e.timestamp || '').startsWith(today) && e.done);
    scores.time = Math.min(10, tLogs.length * 2 + tHab.length * 1.5);

    // Work: completed tasks + day rating
    const wDone = store.getDomainData('work', 'tasks', 3).filter(e => (e.timestamp || '').startsWith(today) && e.status === 'done');
    const wRef = store.getDomainData('work', 'reflections', 3).find(e => (e.timestamp || '').startsWith(today));
    scores.work = Math.min(10, wDone.length * 2 + (wRef ? Number(wRef.day_rating || 0) : 0));

    // Relationship: interactions logged today
    const rels = store.getDomainData('relationship', 'interactions', 3).filter(e => (e.timestamp || '').startsWith(today));
    scores.relationship = Math.min(10, rels.length * 3.5);

    // Assets: any financial entry today
    const aCats = Object.keys((CONFIG.domains.assets || {}).categories || {});
    let aCount = 0;
    aCats.forEach(cat => { aCount += store.getDomainData('assets', cat, 3).filter(e => (e.timestamp || '').startsWith(today)).length; });
    scores.assets = Math.min(10, aCount * 5);

    return scores;
  },

  renderDailyBalanceRadar() {
    const today = new Date().toISOString().split('T')[0];
    const s = this._calcDailyScores(today);
    const vals = [s.health, s.consciousness, s.time, s.work, s.relationship, s.assets];
    const active = vals.filter(v => v > 0).length;
    if (active < 2) return '';

    const labels = ['健康', '意識', '時間', '仕事', '関係', '資産'];
    const colors = ['#10b981','#6C63FF','#f59e0b','#3b82f6','#ef4444','#d97706'];
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);

    return `<div class="dbr-card">
      <div class="dbr-head">
        <div class="dbr-title">今日のバランス</div>
        <div class="dbr-avg">総合 <strong>${avg}</strong><small>/10</small></div>
      </div>
      <canvas id="dbrCanvas" height="180"
        data-vals="${vals.join(',')}"
        data-colors="${colors.join(',')}"
        style="max-width:100%;display:block;margin:0 auto"></canvas>
      <div class="dbr-bars">
        ${labels.map((l, i) => `
          <div class="dbr-bar-row">
            <div class="dbr-bar-label" style="color:${colors[i]}">${l}</div>
            <div class="dbr-bar-track">
              <div class="dbr-bar-fill" style="width:${vals[i]*10}%;background:${colors[i]}"></div>
            </div>
            <div class="dbr-bar-val">${vals[i].toFixed(1)}</div>
          </div>`).join('')}
      </div>
    </div>`;
  },

  initDailyBalanceRadarChart() {
    const canvas = document.getElementById('dbrCanvas');
    if (!canvas || typeof Chart === 'undefined') return;
    const vals = (canvas.dataset.vals || '').split(',').map(Number);
    const colors = (canvas.dataset.colors || '').split(',');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridC = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
    const tickC = isDark ? '#94a3b8' : '#64748b';
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['健康','意識','時間','仕事','関係','資産'],
        datasets: [{
          data: vals,
          backgroundColor: 'rgba(108,99,255,0.12)',
          borderColor: '#6C63FF',
          borderWidth: 2,
          pointBackgroundColor: colors,
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: 10,
            ticks: { stepSize: 2, color: tickC, font: { size: 9 }, backdropColor: 'transparent' },
            grid: { color: gridC },
            pointLabels: { color: tickC, font: { size: 11, weight: '600' } },
            angleLines: { color: gridC }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  },

  // ─── Volunteer / Community Contribution Tracker (work domain) ───
  renderVolunteerTracker() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const entries = store.getDomainData('work', 'volunteer', 60);
    const thisMonth = entries.filter(e => e.timestamp && new Date(e.timestamp) >= monthStart);

    const totalHours = thisMonth.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    const types = [...new Set(thisMonth.map(e => e.type).filter(Boolean))];

    const typeLabels = {
      community: '地域活動',
      volunteer: 'ボランティア',
      mentor: '指導・伝達',
      hobby: '趣味グループ',
      npo: 'NPO・市民活動',
      other: 'その他'
    };

    const msg = totalHours === 0
      ? 'まだ記録がありません。地域や社会とのつながりを記録しましょう。'
      : totalHours < 5
        ? `今月 ${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} 時間。社会とつながる時間は宝物です。`
        : totalHours < 15
          ? `今月 ${totalHours.toFixed(1)} 時間の活動、素晴らしいです！`
          : `今月 ${totalHours.toFixed(1)} 時間！あなたの力が地域を支えています。`;

    return `<div class="vol-tracker-card">
      <div class="vol-header">
        <div>
          <div class="vol-title">地域・社会への貢献</div>
          <div class="vol-sub">${msg}</div>
        </div>
        ${totalHours > 0 ? `<div class="vol-total">${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}<span>h</span></div>` : ''}
      </div>
      ${types.length > 0 ? `<div class="vol-types">${types.map(t => `<span class="vol-badge">${typeLabels[t] || Components.escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="vol-form">
        <select id="volType" class="form-input form-input-sm">
          ${Object.entries(typeLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
        <input type="number" id="volHours" class="form-input form-input-sm" placeholder="時間" min="0.5" max="24" step="0.5" style="width:90px;">
        <button class="btn btn-primary btn-sm" onclick="Pages.logVolunteer()">記録</button>
      </div>
      ${thisMonth.length > 0 ? `<div class="vol-recent">
        ${thisMonth.slice(0, 3).map(e => `
          <div class="vol-entry">
            <span class="vol-entry-type">${typeLabels[e.type] || Components.escapeHtml(e.type || '')}</span>
            <span class="vol-entry-hours">${parseFloat(e.hours || 0).toFixed(1)}h</span>
            <span class="vol-entry-date">${(e.timestamp || '').split('T')[0]}</span>
          </div>`).join('')}
      </div>` : ''}
    </div>`;
  },

  logVolunteer() {
    const type = document.getElementById('volType')?.value;
    const hours = parseFloat(document.getElementById('volHours')?.value);
    if (!type || isNaN(hours) || hours <= 0) {
      Components.showToast('活動の種類と時間を入力してください', 'error');
      return;
    }
    store.addDomainEntry('work', 'volunteer', { type, hours, timestamp: new Date().toISOString() });
    Components.showToast('記録しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Cross-Domain Correlation Insights ───
  // Shows on every domain home when user has 7+ days of data across 2+ domains
  renderCrossDomainInsights() {
    const today = new Date();
    const daysArr = [];
    const dayData = {};

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      daysArr.push(key);
      dayData[key] = {};
    }

    // Steps from localStorage (health domain)
    daysArr.forEach(day => {
      try {
        const s = parseInt(localStorage.getItem('lms_steps_' + day) || '0', 10);
        if (s >= 500) dayData[day].steps = s;
      } catch(e) {}
    });

    // Mood level from consciousness entries (1-10)
    store.getDomainData('consciousness', 'entries', 30).forEach(e => {
      const day = (e.timestamp || '').split('T')[0];
      if (dayData[day] && e.mood_level) {
        dayData[day].mood = Math.max(dayData[day].mood || 0, Number(e.mood_level));
      }
    });

    // Sleep quality from health (0-10 scale)
    store.getDomainData('health', 'sleepData', 30).forEach(e => {
      const day = (e.timestamp || '').split('T')[0];
      if (dayData[day] && e.quality) dayData[day].sleepQ = Number(e.quality);
    });

    // Relationship interactions count per day
    store.getDomainData('relationship', 'interactions', 30).forEach(e => {
      const day = (e.timestamp || '').split('T')[0];
      if (dayData[day]) dayData[day].contacts = (dayData[day].contacts || 0) + 1;
    });

    // Work day satisfaction rating
    store.getDomainData('work', 'reflections', 30).forEach(e => {
      const day = (e.timestamp || '').split('T')[0];
      if (dayData[day] && e.day_rating) dayData[day].workRating = Number(e.day_rating);
    });

    const getPairs = (keyA, keyB) => daysArr
      .map(d => ({ a: dayData[d][keyA], b: dayData[d][keyB] }))
      .filter(p => p.a !== undefined && p.b !== undefined);

    const getMedian = arr => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };

    const calcCorr = pairs => {
      if (pairs.length < 7) return null;
      const medA = getMedian(pairs.map(p => p.a));
      const medB = getMedian(pairs.map(p => p.b));
      const aligned = pairs.filter(p => (p.a >= medA) === (p.b >= medB)).length;
      return aligned / pairs.length;
    };

    const insights = [];

    const smCorr = calcCorr(getPairs('steps', 'mood'));
    if (smCorr !== null && smCorr >= 0.62) {
      insights.push({ icon: '◆', color: '#10b981', text: 'よく歩く日は気持ちの充実度も高い傾向があります。歩くことが心の安定につながっているようです。', conf: smCorr });
    }

    const sqmCorr = calcCorr(getPairs('sleepQ', 'mood'));
    if (sqmCorr !== null && sqmCorr >= 0.60) {
      insights.push({ icon: '◈', color: '#8b5cf6', text: '睡眠の質が高い日は心の充実度も高い傾向があります。よい眠りが心の余裕を生んでいます。', conf: sqmCorr });
    }

    const cmCorr = calcCorr(getPairs('contacts', 'mood'));
    if (cmCorr !== null && cmCorr >= 0.62) {
      insights.push({ icon: '◇', color: '#ef4444', text: '人と交流した日は気持ちの充実度が高い傾向があります。つながりが心の栄養源になっています。', conf: cmCorr });
    }

    const swCorr = calcCorr(getPairs('sleepQ', 'workRating'));
    if (swCorr !== null && swCorr >= 0.60) {
      insights.push({ icon: '▲', color: '#3b82f6', text: 'よく眠れた日は活動の満足度も高い傾向があります。睡眠が一日の質を左右しています。', conf: swCorr });
    }

    if (insights.length === 0) return '';

    // Require data from at least 2 different domains
    const activeDomains = new Set();
    daysArr.forEach(d => {
      if (dayData[d].steps !== undefined || dayData[d].sleepQ !== undefined) activeDomains.add('health');
      if (dayData[d].mood !== undefined) activeDomains.add('consciousness');
      if (dayData[d].contacts !== undefined) activeDomains.add('relationship');
      if (dayData[d].workRating !== undefined) activeDomains.add('work');
    });
    if (activeDomains.size < 2) return '';

    const daysWithData = daysArr.filter(d => Object.keys(dayData[d]).length > 0).length;
    if (daysWithData < 7) return '';

    const top = [...insights].sort((a, b) => b.conf - a.conf).slice(0, 3);

    return `<div class="cdi-card">
      <div class="cdi-header">
        <div class="cdi-title">あなたのパターン</div>
        <div class="cdi-sub">記録から見えてきたつながり</div>
      </div>
      <div class="cdi-list">
        ${top.map(ins => `
          <div class="cdi-item" style="border-left-color:${ins.color}">
            <div class="cdi-icon" style="color:${ins.color}">${ins.icon}</div>
            <div class="cdi-body">
              <div class="cdi-text">${ins.text}</div>
              <div class="cdi-conf">
                <div class="cdi-bar"><div class="cdi-fill" style="width:${Math.round(ins.conf*100)}%;background:${ins.color}"></div></div>
                <span class="cdi-pct">${Math.round(ins.conf*100)}%一致</span>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="cdi-foot">過去30日間のデータ（${daysWithData}日分）から算出</div>
    </div>`;
  },

  // ─── Seasonal Health Alert (health domain, dismissible once per day) ───
  renderSeasonalHealthAlert() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const dismissKey = `lms_seasonalAlert_${today.toISOString().split('T')[0]}`;
    if (localStorage.getItem(dismissKey)) return '';

    let alertData = null;

    if (month >= 6 && month <= 9) {
      const isHigh = month === 7 || month === 8;
      alertData = {
        color: '#E67E22',
        icon: '☀',
        title: isHigh ? '猛暑が続いています。熱中症に特に注意を' : '夏の熱中症予防を毎日心がけましょう',
        tips: [
          '水分は1時間ごとにコップ1杯（のどが渇く前に補給）',
          '正午〜午後3時の外出はできるだけ控える',
          '室内でも冷房を28度以下に（エアコンを遠慮しない）',
          '朝・夕の涼しい時間帯に散歩・外出を',
          '尿の色が濃い黄色のときは水分不足のサイン'
        ],
        warn: '急なめまい・頭痛・吐き気・体の熱さは熱中症のサインです。涼しい場所に移動し、水分補給を。症状が続く場合は119番へ。'
      };
    } else if (month === 12 || month <= 2) {
      alertData = {
        color: '#2980B9',
        icon: '❄',
        title: '冬は血圧が上がりやすく、心臓への負担が増す季節です',
        tips: [
          '起床直後の急激な動作・立ち上がりに注意',
          'トイレ・浴室など寒い場所へ移動する前に暖める（ヒートショック予防）',
          '入浴はぬるめ（40度以下）で長湯しない',
          '定期的な血圧測定を続け、記録しましょう',
          '温かい飲み物で体の内側から温める'
        ],
        warn: '胸の痛み・圧迫感・左腕のしびれ・突然の頭痛は緊急サインです。ためらわず119番へ。'
      };
    } else if (month === 3 || month === 4) {
      alertData = {
        color: '#27AE60',
        icon: '◈',
        title: '春は気温差が大きく、体調を崩しやすい季節です',
        tips: [
          '朝晩の冷え込みに備えて重ね着を心がける',
          '花粉症の方は外出前後に手洗い・洗顔を忘れずに',
          '睡眠リズムを一定に保つ（就寝・起床時間を揃える）',
          '過ごしやすい気候を活かして軽い運動を始めるチャンスです',
          '食欲が落ちても少量でも栄養のある食事を'
        ],
        warn: '春は気分の落ち込みが起きやすい季節です。気になることがあればかかりつけ医にご相談ください。'
      };
    } else if (month === 10 || month === 11) {
      alertData = {
        color: '#8e6914',
        icon: '◆',
        title: '秋は体を冬に備える大切な季節です',
        tips: [
          '朝晩の気温差に備えて一枚多めに着る',
          'インフルエンザ予防接種は10〜11月が最適な時期です',
          '免疫力を高めるため睡眠7時間を目標に',
          '乾燥が始まります。室内の湿度を50〜60%に保つ',
          '秋の散歩は血糖値コントロールにも効果的です'
        ],
        warn: '急な気温低下のあとは風邪・感染症に注意です。体調の変化に早めに気づくことが大切です。'
      };
    } else {
      alertData = {
        color: '#27AE60',
        icon: '◇',
        title: '初夏の健康管理：変化に体を慣らしていく時期です',
        tips: [
          '急に暑くなる日は水分補給を意識して行う',
          '初夏の紫外線は肌・目へのダメージが大きい',
          '睡眠中も気温変化に合わせた寝具を選ぶ',
          '体を動かす習慣をこの季節に始めるのが最適です',
          '心身が疲れを感じたら無理せず休む'
        ],
        warn: null
      };
    }

    const tips = alertData.tips.slice(0, 4);

    return `<div class="seasonal-alert-card" style="--sa-color:${alertData.color}">
      <div class="sa-header">
        <div class="sa-icon-wrap" style="background:${alertData.color}20;color:${alertData.color}">${alertData.icon}</div>
        <div class="sa-title-wrap">
          <div class="sa-label" style="color:${alertData.color}">今月の健康アドバイス</div>
          <div class="sa-title">${alertData.title}</div>
        </div>
        <button class="sa-close" onclick="localStorage.setItem('${dismissKey}','1');this.closest('.seasonal-alert-card').remove()" aria-label="閉じる">✕</button>
      </div>
      <ul class="sa-tips">
        ${tips.map(t => `<li class="sa-tip"><span class="sa-check" style="color:${alertData.color}">◆</span>${Components.escapeHtml(t)}</li>`).join('')}
      </ul>
      ${alertData.warn ? `<div class="sa-warn"><span class="sa-warn-icon">⚠</span>${Components.escapeHtml(alertData.warn)}</div>` : ''}
    </div>`;
  },

  // ─── Monthly Goal Tracker (all domains, up to 3 goals per month) ───
  renderMonthlyGoalTracker() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const storageKey = `lms_monthGoals_${monthKey}`;
    let goals = [];
    try { goals = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) { goals = []; }

    const domainLabels = {
      consciousness: '意識', health: '健康', time: '時間',
      work: '仕事', relationship: '関係', assets: '資産'
    };
    const domainColors = {
      consciousness: '#6C63FF', health: '#10b981', time: '#f59e0b',
      work: '#3b82f6', relationship: '#ef4444', assets: '#d97706'
    };
    const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    const doneCount = goals.filter(g => g.done).length;
    const pct = goals.length > 0 ? Math.round(doneCount / goals.length * 100) : 0;

    const goalsHtml = goals.length > 0 ? goals.map((g, i) => {
      const color = domainColors[g.domain] || '#6C63FF';
      return `<div class="mgt-goal ${g.done ? 'mgt-done' : ''}">
        <button class="mgt-check" onclick="Pages.toggleMonthGoal('${monthKey}',${i})"
          style="border-color:${color};${g.done ? `background:${color};color:#fff` : 'color:transparent'}" aria-label="完了切替">✓</button>
        <div class="mgt-goal-body">
          <span class="mgt-tag" style="color:${color};background:${color}20">${domainLabels[g.domain] || g.domain}</span>
          <span class="mgt-text${g.done ? ' mgt-text-done' : ''}">${Components.escapeHtml(g.text)}</span>
        </div>
        <button class="mgt-del" onclick="Pages.deleteMonthGoal('${monthKey}',${i})" aria-label="削除">✕</button>
      </div>`;
    }).join('') : `<div class="mgt-empty">今月の目標をまだ設定していません。<br>小さな目標を1つ立ててみましょう。</div>`;

    const addFormHtml = goals.length < 3 ? `
      <div class="mgt-add-row">
        <select id="mgtDomain" class="form-input mgt-select">
          ${Object.entries(domainLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
        <input type="text" id="mgtGoalText" class="form-input mgt-input" placeholder="今月やりたいこと…" maxlength="30"
          onkeydown="if(event.key==='Enter')Pages.addMonthGoal('${monthKey}')">
        <button class="btn btn-primary mgt-add-btn" onclick="Pages.addMonthGoal('${monthKey}')">追加</button>
      </div>` : `<div class="mgt-full-msg">目標は3つまで設定できます（達成済みを削除して追加できます）</div>`;

    return `<div class="mgt-card">
      <div class="mgt-header">
        <div class="mgt-title-wrap">
          <div class="mgt-title">${monthLabel}の目標</div>
          ${goals.length > 0 ? `<div class="mgt-pct">${doneCount}/${goals.length} 達成</div>` : ''}
        </div>
        ${goals.length > 0 ? `<div class="mgt-bar"><div class="mgt-bar-fill" style="width:${pct}%"></div></div>` : ''}
      </div>
      <div class="mgt-goals">${goalsHtml}</div>
      ${addFormHtml}
    </div>`;
  },

  addMonthGoal(monthKey) {
    const domainEl = document.getElementById('mgtDomain');
    const textEl = document.getElementById('mgtGoalText');
    if (!domainEl || !textEl) return;
    const text = textEl.value.trim();
    if (!text) { Components.showToast('目標を入力してください', 'error'); return; }
    const storageKey = `lms_monthGoals_${monthKey}`;
    let goals = [];
    try { goals = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) {}
    if (goals.length >= 3) { Components.showToast('目標は3つまでです', 'error'); return; }
    goals.push({ domain: domainEl.value, text, done: false, added: new Date().toISOString() });
    localStorage.setItem(storageKey, JSON.stringify(goals));
    if (typeof app !== 'undefined') app.renderApp();
  },

  toggleMonthGoal(monthKey, idx) {
    const storageKey = `lms_monthGoals_${monthKey}`;
    let goals = [];
    try { goals = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) {}
    if (!goals[idx]) return;
    goals[idx].done = !goals[idx].done;
    localStorage.setItem(storageKey, JSON.stringify(goals));
    if (typeof app !== 'undefined') app.renderApp();
  },

  deleteMonthGoal(monthKey, idx) {
    const storageKey = `lms_monthGoals_${monthKey}`;
    let goals = [];
    try { goals = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) {}
    goals.splice(idx, 1);
    localStorage.setItem(storageKey, JSON.stringify(goals));
    if (typeof app !== 'undefined') app.renderApp();
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
