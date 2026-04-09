/* ============================================================
   Broadcast - Main UI Controller
   LMS の app.js と同じ設計思想 (renderApp, navigate, reactive UI)
   ============================================================ */
var BroadcastApp = class BroadcastApp {
  constructor() {
    this.authMode = 'login';
  }

  // ─── Initialize on dashboard ───
  async init() {
    // Reuse LMS Firebase backend for auth
    if (typeof FirebaseBackend !== 'undefined') await FirebaseBackend.init();

    BroadcastPlatforms.checkOAuthCallback();

    if (broadcastStore.get('isAuthenticated') && broadcastStore.get('user')) {
      this.renderApp();
    }

    broadcastStore.on('isAuthenticated', (v) => {
      if (v) this.renderApp();
      else window.location.href = 'broadcast.html';
    });
    broadcastStore.on('currentPage', () => this.renderApp());
    broadcastStore.on('adaptations', () => {
      if (broadcastStore.get('currentPage') === 'compose') this.renderApp();
    });
    broadcastStore.on('connections', () => {
      if (broadcastStore.get('currentPage') === 'connections') this.renderApp();
    });
  }

  // ─── Initialize on landing page ───
  initLandingPage() {
    // Nothing special - LMS app.init() handles auth
  }

  // ─── Render ───
  renderApp() {
    const main = document.getElementById('mainContent');
    if (!main) return;

    const user = broadcastStore.get('user');
    const username = document.getElementById('userName');
    if (username && user) username.textContent = user.displayName || user.email || 'ユーザー';

    const page = broadcastStore.get('currentPage') || 'compose';
    const title = document.getElementById('top-bar-title');
    if (title) title.textContent = this.pageTitle(page);

    // Highlight active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    switch (page) {
      case 'compose':     main.innerHTML = this.renderCompose(); this.bindCompose(); break;
      case 'history':     main.innerHTML = this.renderHistory(); break;
      case 'connections': main.innerHTML = this.renderConnections(); break;
      case 'scheduled':   main.innerHTML = this.renderScheduled(); break;
      case 'settings':    main.innerHTML = this.renderSettings(); break;
      case 'ask_ai':      main.innerHTML = this.renderAskAI(); break;
      default:            main.innerHTML = this.renderCompose();
    }
  }

  pageTitle(page) {
    return {
      compose: '書く',
      history: '配信ログ',
      connections: 'プラットフォーム接続',
      scheduled: 'スケジュール',
      settings: '設定',
      ask_ai: 'AI に相談'
    }[page] || 'Broadcast';
  }

  // ─── Navigation ───
  navigate(page) {
    broadcastStore.set('currentPage', page);
  }

  toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('show');
  }

  // ─── Auth passthroughs (delegates to LMS app) ───
  async loginWithGoogle() { return window.app?.loginWithGoogle?.(); }
  async loginWithEmail()  { return window.app?.loginWithEmail?.(); }
  async registerWithEmail() { return window.app?.registerWithEmail?.(); }
  async resetPassword()   { return window.app?.resetPassword?.(); }
  toggleAuthMode(mode)    { return window.app?.toggleAuthMode?.(mode); }

  async logout() {
    try {
      await FirebaseBackend.signOut();
      window.location.href = 'broadcast.html';
    } catch (e) { Components.showToast(e.message, 'error'); }
  }

  // ─── Page: Compose ───
  renderCompose() {
    const draft = broadcastStore.get('draft') || {};
    const adaptations = broadcastStore.get('adaptations') || {};
    const selected = broadcastStore.get('selectedPlatforms') || [];
    const isAdapting = broadcastStore.get('isAdapting');
    const isDistributing = broadcastStore.get('isDistributing');

    return `
      <div class="compose-wrap">
        <div class="compose-editor">
          <div class="card">
            <h3>原稿を書く</h3>
            <p class="sub">思想・アイデア・メモを 1 つだけ書いてください。AI が各プラットフォームに最適化します。</p>

            <div class="form-group">
              <label>タイトル（任意・ブログ系でのみ使用）</label>
              <input type="text" class="form-input" id="draftTitle" value="${escapeHtml(draft.title || '')}" placeholder="タイトル">
            </div>

            <div class="form-group">
              <label>本文</label>
              <textarea class="form-input" id="draftBody" rows="14" placeholder="ここに思想・アイデア・メモを書いてください...">${escapeHtml(draft.body || '')}</textarea>
              <div class="char-count" id="charCount">${(draft.body || '').length} 文字</div>
            </div>

            <div class="form-group">
              <label>言語</label>
              <select class="form-input" id="draftLang">
                <option value="ja" ${draft.language === 'ja' ? 'selected' : ''}>日本語</option>
                <option value="en" ${draft.language === 'en' ? 'selected' : ''}>English</option>
                <option value="zh" ${draft.language === 'zh' ? 'selected' : ''}>中文</option>
                <option value="ko" ${draft.language === 'ko' ? 'selected' : ''}>한국어</option>
              </select>
            </div>

            <div class="form-actions">
              <button class="btn btn-secondary" onclick="broadcastApp.saveDraft()">下書き保存</button>
              <button class="btn btn-outline" onclick="broadcastApp.clearDraft()">クリア</button>
              <button class="btn btn-primary" onclick="broadcastApp.adaptAll()" ${isAdapting ? 'disabled' : ''}>
                ${isAdapting ? '最適化中...' : 'AI で各プラットフォーム向けに書き分け'}
              </button>
            </div>
          </div>
        </div>

        <div class="compose-platforms">
          <div class="card">
            <h3>配信先プラットフォーム</h3>
            <p class="sub">配信したいプラットフォームを選択</p>
            ${this.renderPlatformChecklist(selected)}

            <div class="preset-bar">
              ${Object.entries(BROADCAST_CONFIG.presets).map(([k, p]) => `
                <button class="btn btn-sm btn-outline" onclick="broadcastApp.applyPreset('${k}')">${p.name}</button>
              `).join('')}
            </div>
          </div>
        </div>

        ${Object.keys(adaptations).length > 0 ? `
          <div class="compose-preview full-width">
            <div class="card">
              <h3>プラットフォーム別プレビュー</h3>
              <p class="sub">AI が各プラットフォーム向けに書き分けた結果です。内容を編集してから配信できます。</p>
              ${this.renderAdaptationsPreview(adaptations, selected)}

              <div class="form-actions" style="margin-top:24px">
                <button class="btn btn-lg btn-primary" onclick="broadcastApp.distributeAll()" ${isDistributing ? 'disabled' : ''}>
                  ${isDistributing ? '配信中...' : '🚀 一斉配信する'}
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderPlatformChecklist(selected) {
    const platforms = BROADCAST_CONFIG.platforms;
    const categories = BROADCAST_CONFIG.categories;
    const conns = broadcastStore.get('connections') || {};

    let html = '';
    Object.keys(categories).forEach(cat => {
      const inCat = Object.values(platforms).filter(p => p.category === cat);
      if (inCat.length === 0) return;
      html += `<div class="platform-category">
        <h4>${categories[cat].icon} ${categories[cat].label}</h4>
        <div class="platform-checklist">
          ${inCat.map(p => {
            const isConnected = conns[p.id]?.connected || p.auth === 'manual';
            const isChecked = selected.includes(p.id);
            return `
              <label class="platform-chip ${isConnected ? '' : 'disabled'} ${isChecked ? 'checked' : ''}"
                     style="--p-color:${p.color}">
                <input type="checkbox"
                       value="${p.id}"
                       ${isChecked ? 'checked' : ''}
                       ${isConnected ? '' : 'disabled'}
                       onchange="broadcastApp.togglePlatform('${p.id}', this.checked)">
                <span class="chip-icon">${p.icon}</span>
                <span class="chip-name">${p.name}</span>
                ${!isConnected ? `<span class="chip-badge">未接続</span>` : ''}
              </label>
            `;
          }).join('')}
        </div>
      </div>`;
    });
    return html;
  }

  renderAdaptationsPreview(adaptations, selected) {
    return selected.map(pid => {
      const adapted = adaptations[pid];
      if (!adapted) return '';
      const platform = BROADCAST_CONFIG.platforms[pid];
      const over = platform.charLimit > 0 && adapted.charCount > platform.charLimit;

      if (adapted.error) {
        return `<div class="adapt-card error">
          <div class="adapt-header" style="border-color:${platform.color}">
            <span class="adapt-icon">${platform.icon}</span>
            <strong>${platform.name}</strong>
          </div>
          <div class="adapt-error">エラー: ${escapeHtml(adapted.error)}</div>
          <button class="btn btn-sm btn-outline" onclick="broadcastApp.retryAdapt('${pid}')">再試行</button>
        </div>`;
      }

      return `<div class="adapt-card">
        <div class="adapt-header" style="border-color:${platform.color}">
          <span class="adapt-icon">${platform.icon}</span>
          <strong>${platform.name}</strong>
          <span class="adapt-chars ${over ? 'over' : ''}">${adapted.charCount}${platform.charLimit > 0 ? '/' + platform.charLimit : ''}</span>
          <button class="btn btn-sm btn-outline" onclick="broadcastApp.retryAdapt('${pid}')">再生成</button>
        </div>
        ${adapted.title ? `
          <input type="text" class="form-input adapt-title" data-pid="${pid}"
                 value="${escapeHtml(adapted.title)}"
                 onblur="broadcastApp.editAdapted('${pid}', 'title', this.value)">
        ` : ''}
        <textarea class="form-input adapt-body" data-pid="${pid}" rows="6"
                  onblur="broadcastApp.editAdapted('${pid}', 'body', this.value)">${escapeHtml(adapted.body)}</textarea>
        ${(adapted.tags || []).length > 0 ? `
          <div class="adapt-tags">${adapted.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
        ` : ''}
      </div>`;
    }).join('');
  }

  // ─── Compose page handlers ───
  bindCompose() {
    const body = document.getElementById('draftBody');
    const charCount = document.getElementById('charCount');
    if (body && charCount) {
      body.addEventListener('input', () => { charCount.textContent = body.value.length + ' 文字'; });
    }
  }

  saveDraft() {
    const draft = {
      title: document.getElementById('draftTitle')?.value || '',
      body:  document.getElementById('draftBody')?.value || '',
      language: document.getElementById('draftLang')?.value || 'ja',
      tags: [],
      images: broadcastStore.get('draft')?.images || [],
      createdAt: broadcastStore.get('draft')?.createdAt || new Date().toISOString()
    };
    broadcastStore.set('draft', draft);
    Components.showToast('下書きを保存しました', 'success');
  }

  clearDraft() {
    if (!confirm('下書きと書き分け結果をすべてクリアしますか？')) return;
    broadcastStore.clearDraft();
    this.renderApp();
  }

  togglePlatform(pid, on) {
    let list = broadcastStore.get('selectedPlatforms') || [];
    if (on && !list.includes(pid)) list = [...list, pid];
    if (!on) list = list.filter(p => p !== pid);
    broadcastStore.set('selectedPlatforms', list);
    this.renderApp();
  }

  applyPreset(key) {
    const preset = BROADCAST_CONFIG.presets[key];
    if (!preset) return;
    const conns = broadcastStore.get('connections') || {};
    let list = preset.platforms;
    if (list === null) {
      // "all" preset = all connected platforms
      list = Object.keys(conns).filter(p => conns[p]?.connected);
    } else {
      // Only include connected ones
      list = list.filter(p => conns[p]?.connected || BROADCAST_CONFIG.platforms[p]?.auth === 'manual');
    }
    broadcastStore.set('selectedPlatforms', list);
    Components.showToast(`${preset.name}: ${list.length} 個のプラットフォームを選択`, 'info');
    this.renderApp();
  }

  async adaptAll() {
    this.saveDraft();
    const draft = broadcastStore.get('draft');
    const selected = broadcastStore.get('selectedPlatforms') || [];

    if (!draft.body?.trim()) {
      Components.showToast('本文を入力してください', 'error');
      return;
    }
    if (selected.length === 0) {
      Components.showToast('配信先プラットフォームを選択してください', 'error');
      return;
    }

    Components.showToast(`${selected.length} プラットフォーム向けに AI が書き分けています...`, 'info');
    try {
      await BroadcastAI.adaptForAll(draft, selected, draft.language);
      Components.showToast('書き分け完了', 'success');
    } catch (e) {
      Components.showToast('書き分けエラー: ' + e.message, 'error');
    }
  }

  async retryAdapt(pid) {
    const draft = broadcastStore.get('draft');
    try {
      const adapted = await BroadcastAI.adaptForPlatform(draft, pid, draft.language);
      const current = broadcastStore.get('adaptations') || {};
      broadcastStore.set('adaptations', {
        ...current,
        [pid]: { ...adapted, charCount: (adapted.body || '').length, language: draft.language, edited: false }
      });
    } catch (e) {
      Components.showToast('再生成エラー: ' + e.message, 'error');
    }
  }

  editAdapted(pid, field, value) {
    const adaptations = broadcastStore.get('adaptations') || {};
    if (!adaptations[pid]) return;
    adaptations[pid] = {
      ...adaptations[pid],
      [field]: value,
      edited: true,
      charCount: field === 'body' ? value.length : adaptations[pid].charCount
    };
    broadcastStore.set('adaptations', { ...adaptations });
  }

  async distributeAll() {
    const adaptations = broadcastStore.get('adaptations') || {};
    const selected = broadcastStore.get('selectedPlatforms') || [];
    const draft = broadcastStore.get('draft');

    if (selected.length === 0) {
      Components.showToast('配信先を選択してください', 'error');
      return;
    }
    if (broadcastStore.get('confirmBeforeSend')) {
      if (!confirm(`${selected.length} 個のプラットフォームに配信しますか？`)) return;
    }

    Components.showToast(`${selected.length} プラットフォームに配信中...`, 'info');
    try {
      const results = await BroadcastPlatforms.distribute(adaptations, draft, selected);
      const entry = broadcastStore.addBroadcast({
        draft: { ...draft },
        adaptations: { ...adaptations },
        platforms: [...selected],
        results
      });

      // Count success/fail
      let ok = 0, err = 0;
      Object.values(results).forEach(r => { r.status === 'success' ? ok++ : err++; });
      Components.showToast(`配信完了: 成功 ${ok} / 失敗 ${err}`, ok > 0 ? 'success' : 'error');

      // Navigate to history
      this.navigate('history');
    } catch (e) {
      Components.showToast('配信エラー: ' + e.message, 'error');
    }
  }

  // ─── Page: History ───
  renderHistory() {
    const list = (broadcastStore.get('broadcasts') || []).slice().reverse();
    if (list.length === 0) {
      return `<div class="card">${Components.emptyState('📡', '配信履歴はまだありません', '最初の配信をしてみましょう')}</div>`;
    }
    return `<div class="history-list">
      ${list.map(b => this.renderHistoryItem(b)).join('')}
    </div>`;
  }

  renderHistoryItem(b) {
    const date = new Date(b.timestamp).toLocaleString('ja-JP');
    const results = b.results || {};
    return `<div class="card history-item">
      <div class="history-header">
        <div>
          <strong>${escapeHtml(b.draft?.title || (b.draft?.body || '').slice(0, 50) || '(無題)')}</strong>
          <div class="sub">${date} · ${Object.keys(results).length} プラットフォーム</div>
        </div>
      </div>
      <div class="history-results">
        ${Object.entries(results).map(([pid, r]) => {
          const p = BROADCAST_CONFIG.platforms[pid];
          if (!p) return '';
          const statusClass = r.status === 'success' ? 'ok' : r.status === 'error' ? 'err' : 'skip';
          return `<div class="result-chip ${statusClass}" style="--p-color:${p.color}">
            <span>${p.icon}</span>
            <span>${p.name}</span>
            ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">↗</a>` : ''}
            ${r.error ? `<span class="err-msg" title="${escapeHtml(r.error)}">⚠</span>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="form-actions">
        <button class="btn btn-sm btn-outline" onclick="broadcastApp.reloadDraft('${b.id}')">再編集して再配信</button>
        <button class="btn btn-sm btn-outline" onclick="broadcastApp.analyzeBroadcast('${b.id}')">AI で結果を分析</button>
      </div>
    </div>`;
  }

  reloadDraft(id) {
    const b = (broadcastStore.get('broadcasts') || []).find(x => x.id === id);
    if (!b) return;
    broadcastStore.set('draft', { ...b.draft });
    broadcastStore.set('adaptations', { ...b.adaptations });
    broadcastStore.set('selectedPlatforms', [...(b.platforms || [])]);
    this.navigate('compose');
  }

  async analyzeBroadcast(id) {
    const b = (broadcastStore.get('broadcasts') || []).find(x => x.id === id);
    if (!b) return;
    Components.showToast('分析中...', 'info');
    try {
      const result = await BroadcastAI.analyzeResults(b);
      alert(result);
    } catch (e) {
      Components.showToast('分析エラー: ' + e.message, 'error');
    }
  }

  // ─── Page: Connections ───
  renderConnections() {
    const categories = BROADCAST_CONFIG.categories;
    const platforms = BROADCAST_CONFIG.platforms;
    const conns = broadcastStore.get('connections') || {};

    let html = '<div class="connections-wrap">';
    Object.keys(categories).forEach(cat => {
      const inCat = Object.values(platforms).filter(p => p.category === cat);
      if (inCat.length === 0) return;
      html += `<div class="card">
        <h3>${categories[cat].icon} ${categories[cat].label}</h3>
        <div class="connection-list">
          ${inCat.map(p => this.renderConnectionItem(p, conns[p.id])).join('')}
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  renderConnectionItem(platform, conn) {
    const isConnected = conn?.connected;
    return `<div class="conn-item" style="--p-color:${platform.color}">
      <div class="conn-icon">${platform.icon}</div>
      <div class="conn-info">
        <strong>${platform.name}</strong>
        <div class="sub">
          ${isConnected ? '✅ 接続済み' : '未接続'}
          · 認証方式: ${platform.auth}
          ${platform.charLimit > 0 ? ` · ${platform.charLimit}字` : ''}
        </div>
      </div>
      <div class="conn-actions">
        ${isConnected
          ? `<button class="btn btn-sm btn-outline" onclick="broadcastApp.disconnect('${platform.id}')">解除</button>`
          : `<button class="btn btn-sm btn-primary" onclick="broadcastApp.promptConnect('${platform.id}')">接続</button>`
        }
      </div>
    </div>`;
  }

  promptConnect(platformId) {
    const platform = BROADCAST_CONFIG.platforms[platformId];
    if (!platform) return;

    switch (platform.auth) {
      case 'oauth2': {
        const clientId = prompt(`${platform.name} の Client ID を入力してください (.env または管理画面で発行)`);
        if (!clientId) return;
        localStorage.setItem(`broadcast_${platformId}_clientId`, clientId);
        BroadcastPlatforms.connect.oauthRedirect(platformId);
        break;
      }
      case 'token': {
        const token = prompt(`${platform.name} の API トークン / キーを入力してください`);
        if (!token) return;

        const extra = {};
        if (platformId === 'telegram') {
          const chatId = prompt('送信先の Chat ID (@channelname または 数字)');
          if (!chatId) return;
          extra.chatId = chatId;
        }
        if (platformId === 'medium') {
          const userId = prompt('Medium User ID (GET /me で取得)');
          extra.userId = userId;
        }
        BroadcastPlatforms.connect.token(platformId, token, extra);
        this.renderApp();
        break;
      }
      case 'webhook': {
        const webhook = prompt(`${platform.name} の Webhook URL を入力してください`);
        if (!webhook) return;
        BroadcastPlatforms.connect.webhook(platformId, webhook);
        this.renderApp();
        break;
      }
      case 'app-password': {
        if (platformId === 'bluesky') {
          const handle = prompt('Bluesky ハンドル (例: me.bsky.social)');
          if (!handle) return;
          const pw = prompt('App Password (Settings → App Passwords で発行)');
          if (!pw) return;
          BroadcastPlatforms.connect.blueskyAppPassword(handle, pw);
          this.renderApp();
        }
        break;
      }
      case 'smtp': {
        if (!confirm('Email 配信には Cloudflare Worker の SMTP エンドポイント設定が必要です。続行しますか？')) return;
        const recipients = prompt('送信先アドレス (カンマ区切り)');
        if (!recipients) return;
        broadcastStore.setConnection(platformId, { recipients: recipients.split(',').map(s => s.trim()) });
        this.renderApp();
        break;
      }
      default: {
        if (platformId === 'mastodon') {
          const instance = prompt('Mastodon インスタンス URL (例: mastodon.social)');
          if (!instance) return;
          const token = prompt('アクセストークン (Preferences → Development → New Application)');
          if (!token) return;
          BroadcastPlatforms.connect.mastodon(instance, token);
          this.renderApp();
        } else if (platformId === 'hatena') {
          const hatenaId = prompt('はてな ID');
          if (!hatenaId) return;
          const blogId = prompt('ブログ ID (例: example.hatenablog.com)');
          if (!blogId) return;
          const apiKey = prompt('API キー (詳細設定 → API キー)');
          if (!apiKey) return;
          BroadcastPlatforms.connect.hatena(hatenaId, blogId, apiKey);
          this.renderApp();
        } else if (platformId === 'wordpress') {
          const site = prompt('サイト URL (例: example.com)');
          if (!site) return;
          const username = prompt('ユーザー名');
          if (!username) return;
          const pw = prompt('アプリケーションパスワード (プロフィール → Application Passwords)');
          if (!pw) return;
          BroadcastPlatforms.connect.wordpress(site, username, pw);
          this.renderApp();
        } else {
          Components.showToast('このプラットフォームは手動投稿のみ対応です', 'info');
        }
      }
    }
  }

  disconnect(platformId) {
    if (!confirm('接続を解除しますか？')) return;
    broadcastStore.removeConnection(platformId);
    Components.showToast('接続を解除しました', 'success');
    this.renderApp();
  }

  // ─── Page: Scheduled ───
  renderScheduled() {
    const list = broadcastStore.get('scheduled') || [];
    if (list.length === 0) {
      return `<div class="card">${Components.emptyState('⏰', 'スケジュール配信はありません', '下書きから予約投稿を作成できます')}</div>`;
    }
    return `<div class="card"><h3>スケジュール済みの配信</h3>
      <ul>${list.map(s => `<li>${new Date(s.scheduledAt).toLocaleString('ja-JP')} - ${escapeHtml(s.draft?.body?.slice(0, 60) || '')}</li>`).join('')}</ul>
    </div>`;
  }

  // ─── Page: Settings ───
  renderSettings() {
    const model = broadcastStore.get('selectedModel');
    const autoAdapt = broadcastStore.get('autoAdapt');
    const confirmBeforeSend = broadcastStore.get('confirmBeforeSend');

    return `
      <div class="card">
        <h3>AI モデル設定</h3>
        <div class="form-group">
          <label>使用する AI モデル</label>
          <select class="form-input" onchange="broadcastStore.set('selectedModel', this.value)">
            ${Object.entries(BROADCAST_CONFIG.aiModels).map(([id, m]) => `
              <option value="${id}" ${id === model ? 'selected' : ''}>${m.name} (${m.provider})</option>
            `).join('')}
          </select>
          <div class="sub">LMS と同じ Anthropic API キー・Worker エンドポイントを使用します</div>
        </div>

        <div class="form-group">
          <label>API キー設定</label>
          <button class="btn btn-outline" onclick="broadcastApp.setApiKey('anthropic')">Anthropic API キーを設定</button>
          <button class="btn btn-outline" onclick="broadcastApp.setApiKey('openai')">OpenAI API キーを設定</button>
          <button class="btn btn-outline" onclick="broadcastApp.setApiKey('google')">Google API キーを設定</button>
        </div>
      </div>

      <div class="card">
        <h3>配信動作</h3>
        <div class="form-group">
          <label class="toggle-row">
            <input type="checkbox" ${autoAdapt ? 'checked' : ''} onchange="broadcastStore.set('autoAdapt', this.checked)">
            <span>本文変更時に自動で AI 書き分けを実行</span>
          </label>
        </div>
        <div class="form-group">
          <label class="toggle-row">
            <input type="checkbox" ${confirmBeforeSend ? 'checked' : ''} onchange="broadcastStore.set('confirmBeforeSend', this.checked)">
            <span>配信前に確認ダイアログを表示</span>
          </label>
        </div>
      </div>

      <div class="card">
        <h3>プロンプトカスタマイズ</h3>
        <p class="sub">各プロンプトを編集できます。空にすると既定値に戻ります。</p>
        ${Object.entries(BROADCAST_CONFIG.prompts).map(([k, p]) => `
          <div class="form-group">
            <label>${p.name}</label>
            <textarea class="form-input" rows="4" id="prompt_${k}"
                      onblur="broadcastApp.saveCustomPrompt('${k}', this.value)">${escapeHtml((broadcastStore.get('customPrompts') || {})[k]?.prompt || p.prompt)}</textarea>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <h3>データ</h3>
        <button class="btn btn-outline" onclick="broadcastApp.exportData()">データをエクスポート (JSON)</button>
        <button class="btn btn-danger" onclick="broadcastApp.resetAll()">全データをリセット</button>
      </div>
    `;
  }

  setApiKey(provider) {
    const key = prompt(`${provider} の API キーを入力してください`);
    if (!key) return;
    AIEngine.setApiKey(provider, key);
    Components.showToast('API キーを保存しました', 'success');
  }

  saveCustomPrompt(key, value) {
    const custom = broadcastStore.get('customPrompts') || {};
    if (!value?.trim()) {
      delete custom[key];
    } else {
      custom[key] = { ...BROADCAST_CONFIG.prompts[key], prompt: value };
    }
    broadcastStore.set('customPrompts', custom);
  }

  exportData() {
    const data = {
      broadcasts: broadcastStore.get('broadcasts'),
      connections: broadcastStore.get('connections'),
      customPrompts: broadcastStore.get('customPrompts'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broadcast-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  resetAll() {
    if (!confirm('本当に全データをリセットしますか？（元に戻せません）')) return;
    broadcastStore.persistKeys.forEach(k => localStorage.removeItem(`broadcast_${k}`));
    location.reload();
  }

  // ─── Page: Ask AI ───
  renderAskAI() {
    const history = broadcastStore.get('conversationHistory') || [];
    return `
      <div class="card">
        <h3>AI コンサルタントに相談</h3>
        <p class="sub">配信戦略・各プラットフォームの使い分けなど、気軽に聞いてみてください。</p>
        <div class="chat-history">
          ${history.length === 0
            ? '<div class="sub">まだ会話はありません</div>'
            : history.map(m => Components.chatMessage(m)).join('')
          }
        </div>
        <div class="form-group">
          <textarea class="form-input" id="chatInput" rows="3" placeholder="質問を入力..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="broadcastApp.sendChat()">送信</button>
      </div>
    `;
  }

  async sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input?.value?.trim();
    if (!msg) return;
    input.value = '';
    try {
      await BroadcastAI.chat(msg);
      this.renderApp();
    } catch (e) {
      Components.showToast('エラー: ' + e.message, 'error');
    }
  }
};

// HTML escape helper
function escapeHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global instance
var broadcastApp = new BroadcastApp();
if (typeof window !== 'undefined') window.broadcastApp = broadcastApp;
