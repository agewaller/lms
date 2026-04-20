/* ============================================================
   LMS - Reusable UI Components
   ============================================================ */
var Components = {

  // ─── Score Gauge (circular) ───
  scoreGauge(score, size = 120, label = '') {
    const pct = Math.max(0, Math.min(100, score));
    const color = pct >= 70 ? '#27AE60' : pct >= 40 ? '#F39C12' : '#E74C3C';
    const r = (size - 12) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    return `<div class="score-gauge" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#eee" stroke-width="8"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"
          style="transition:stroke-dashoffset 0.6s ease"/>
      </svg>
      <div class="score-value">${pct}</div>
      ${label ? `<div class="score-label">${label}</div>` : ''}
    </div>`;
  },

  // ─── Stat Card ───
  statCard(label, value, change, icon) {
    const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : '';
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '';
    return `<div class="stat-card">
      <div class="stat-icon">${icon || ''}</div>
      <div class="stat-info">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${change != null ? `<div class="stat-change ${changeClass}">${arrow}${Math.abs(change)}</div>` : ''}
      </div>
    </div>`;
  },

  // ─── Recommendation Card ───
  recommendationCard(rec) {
    const priorityClass = rec.priority === 'high' ? 'priority-high' : rec.priority === 'medium' ? 'priority-med' : 'priority-low';
    return `<div class="recommendation-card ${priorityClass}">
      <div class="rec-header">
        <span class="rec-domain-badge" style="background:${CONFIG.domains[rec.domain]?.color || '#666'}">${CONFIG.domains[rec.domain]?.icon || ''} ${i18n.t(rec.domain)}</span>
        <span class="rec-priority">${i18n.t(rec.priority || 'medium')}</span>
      </div>
      <div class="rec-body">${rec.text || ''}</div>
      ${rec.action ? `<button class="btn btn-sm btn-primary" onclick="app.executeAction('${rec.actionType}','${rec.actionData || ''}')">${rec.action}</button>` : ''}
    </div>`;
  },

  // ─── Data Entry Form (dynamic, based on CONFIG.domains[domain].dataFields) ───
  dataEntryForm(domain, category) {
    const domainConfig = CONFIG.domains[domain];
    if (!domainConfig || !domainConfig.dataFields[category]) return '<p>No fields configured.</p>';

    const fields = domainConfig.dataFields[category];
    let html = `<form class="data-entry-form" data-domain="${domain}" data-category="${category}">
      <input type="hidden" name="date" value="${new Date().toISOString().slice(0,10)}">`;

    fields.forEach(f => {
      html += `<div class="form-group">
        <label>${i18n.t(f.label)}</label>`;
      html += this.renderField(f);
      html += `</div>`;
    });

    html += `<div class="form-actions">
      <button type="button" class="btn btn-primary" onclick="app.saveRecord('${domain}','${category}')">${i18n.t('save')}</button>
      <button type="button" class="btn btn-secondary" onclick="app.saveAndAnalyze('${domain}','${category}')">${i18n.t('save_and_analyze')}</button>
    </div></form>`;
    return html;
  },

  renderField(f) {
    const name = f.key;
    switch (f.type) {
      case 'slider': {
        const sMin = f.min || 0;
        const sMax = f.max || 10;
        const sMid = Math.floor((sMin + sMax) / 2);
        return `<div class="slider-field">
          <input type="range" name="${name}" min="${sMin}" max="${sMax}" value="${sMid}" oninput="this.nextElementSibling.textContent=this.value">
          <span class="slider-val">${sMid}</span>
        </div>`;
      }
      case 'number':
        return `<input type="number" name="${name}" step="${f.step||1}" class="form-input" placeholder="${i18n.t(f.label)}${f.unit ? ' ('+f.unit+')' : ''}">`;
      case 'text':
        return `<input type="text" name="${name}" class="form-input" placeholder="${i18n.t(f.label)}">`;
      case 'textarea':
        return `<textarea name="${name}" class="form-input" rows="3" placeholder="${i18n.t(f.label)}"></textarea>`;
      case 'select':
        return `<select name="${name}" class="form-input">
          ${(f.options||[]).map(o => `<option value="${o}">${i18n.t(o)}</option>`).join('')}
        </select>`;
      case 'toggle':
        return `<label class="toggle"><input type="checkbox" name="${name}"><span class="toggle-slider"></span></label>`;
      case 'date':
        return `<input type="date" name="${name}" class="form-input">`;
      case 'time':
        return `<input type="time" name="${name}" class="form-input">`;
      case 'datetime-local':
        return `<input type="datetime-local" name="${name}" class="form-input">`;
      default:
        return `<input type="text" name="${name}" class="form-input">`;
    }
  },

  // ─── Chat Message ───
  chatMessage(msg) {
    const cls = msg.role === 'user' ? 'chat-user' : 'chat-ai';
    const icon = msg.role === 'user' ? 'あ' : 'S';
    return `<div class="chat-msg ${cls}">
      <div class="chat-icon">${icon}</div>
      <div class="chat-content">${this.formatMarkdown(msg.content || '')}</div>
      <div class="chat-time">${msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</div>
    </div>`;
  },

  // ─── Markdown Formatter ───
  formatMarkdown(text) {
    if (!text) return '';
    // Escape HTML to prevent XSS, then apply markdown transformations
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    return escaped
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
        const safeUrl = /^https?:\/\//i.test(url) ? url : '#';
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      })
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  },

  // ─── Toast Notification (未病ダイアリー方式) ───
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  },

  // ─── Loading Spinner ───
  loading(text) {
    return `<div class="loading-container">
      <div class="spinner"></div>
      <p>${text || i18n.t('loading')}</p>
    </div>`;
  },

  // ─── Empty State ───
  emptyState(icon, title, description) {
    return `<div class="empty-state">
      <div class="empty-icon">${icon || '📭'}</div>
      <h3>${title || i18n.t('no_data')}</h3>
      <p>${description || ''}</p>
    </div>`;
  },

  // ─── Domain Tab Bar ───
  domainTabs(activeDomain) {
    const domains = Object.values(CONFIG.domains);
    return `<div class="domain-tabs">
      ${domains.map(d => `
        <button class="domain-tab ${d.id === activeDomain ? 'active' : ''}"
          style="${d.id === activeDomain ? 'border-color:'+d.color+';color:'+d.color : ''}"
          onclick="app.switchDomain('${d.id}')">
          <span class="tab-icon">${d.icon}</span>
          <span class="tab-label">${i18n.t(d.id)}</span>
        </button>
      `).join('')}
    </div>`;
  },

  // ─── Sub Navigation (Home, Record, Action, Settings) ───
  subNav(activePage, domain) {
    const pages = [
      { id: 'home', icon: '🏠' },
      { id: 'record', icon: '📝' },
      { id: 'actions', icon: '⚡' },
      { id: 'ask_ai', icon: '' },
      { id: 'settings', icon: '⚙️' }
    ];
    const color = CONFIG.domains[domain]?.color || '#6C63FF';
    return `<div class="sub-nav">
      ${pages.map(p => `
        <button class="sub-nav-btn ${p.id === activePage ? 'active' : ''}"
          style="${p.id === activePage ? 'color:'+color+';border-color:'+color : ''}"
          onclick="app.navigate('${p.id}')">
          <span>${p.icon}</span>
          <span>${i18n.t(p.id)}</span>
        </button>
      `).join('')}
    </div>`;
  },

  // ─── Auth Form (shared login/register/reset UI) ───
  authForm(options = {}) {
    const title = options.title || 'ログイン / 新規登録';
    const subtitle = options.subtitle || '';
    return `<div class="login-card">
      <div class="auth-tabs">
        <button class="auth-tab active" onclick="app.toggleAuthMode('login')">ログイン</button>
        <button class="auth-tab" onclick="app.toggleAuthMode('register')">新規登録</button>
      </div>

      <!-- Login -->
      <div class="auth-panel active" id="auth-login">
        <button class="btn btn-google" onclick="app.loginWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Googleでログイン
        </button>
        <div class="login-divider"><span>またはメールアドレスで</span></div>
        <div class="form-group"><label>メールアドレス</label><input type="email" id="loginEmail" class="form-input" placeholder="example@email.com"></div>
        <div class="form-group"><label>パスワード</label><input type="password" id="loginPassword" class="form-input" placeholder="パスワード"></div>
        <button class="btn btn-primary btn-block" onclick="app.loginWithEmail()">ログイン</button>
        <div class="auth-help"><a href="javascript:void(0)" onclick="app.toggleAuthMode('reset')">パスワードをお忘れですか？</a></div>
        <div class="auth-help"><span>アカウントをお持ちでないですか？ </span><a href="javascript:void(0)" onclick="app.toggleAuthMode('register')">新規登録</a></div>
      </div>

      <!-- Register -->
      <div class="auth-panel" id="auth-register">
        <h3>新規登録</h3>
        <p class="auth-desc">無料でアカウントを作成できます</p>
        <button class="btn btn-google" onclick="app.loginWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Googleで登録
        </button>
        <div class="login-divider"><span>またはメールアドレスで</span></div>
        <div class="form-group"><label>お名前</label><input type="text" id="registerName" class="form-input" placeholder="山田 花子"></div>
        <div class="form-group"><label>メールアドレス</label><input type="email" id="registerEmail" class="form-input" placeholder="example@email.com"></div>
        <div class="form-group"><label>パスワード（6文字以上）</label><input type="password" id="registerPassword" class="form-input" placeholder="6文字以上"></div>
        <div class="form-group"><label>パスワード（確認）</label><input type="password" id="registerPasswordConfirm" class="form-input" placeholder="もう一度入力"></div>
        <button class="btn btn-primary btn-block" onclick="app.registerWithEmail()">アカウントを作成</button>
        <div class="auth-help"><span>すでにアカウントをお持ちですか？ </span><a href="javascript:void(0)" onclick="app.toggleAuthMode('login')">ログイン</a></div>
      </div>

      <!-- Reset -->
      <div class="auth-panel" id="auth-reset">
        <h3>パスワードの再設定</h3>
        <p class="auth-desc">ご登録のメールアドレスに再設定リンクをお送りします</p>
        <div class="form-group"><label>メールアドレス</label><input type="email" id="resetEmail" class="form-input" placeholder="ご登録のメールアドレス"></div>
        <button class="btn btn-primary btn-block" onclick="app.resetPassword()">再設定メールを送信</button>
        <div class="auth-help"><a href="javascript:void(0)" onclick="app.toggleAuthMode('login')">ログインに戻る</a></div>
      </div>
    </div>`;
  },

  // ─── Record List Item ───
  recordItem(entry, domain) {
    const color = CONFIG.domains[domain]?.color || '#666';
    const time = new Date(entry.timestamp).toLocaleString();
    const cat = entry.category ? i18n.t(entry.category) : '';
    const summary = Object.entries(entry)
      .filter(([k]) => !['id','timestamp','domain','category','_synced'].includes(k))
      .slice(0, 3)
      .map(([k, v]) => `${i18n.t(k)}: ${v}`)
      .join(' | ');
    return `<div class="record-item" style="border-left-color:${color}">
      <div class="record-header">
        <span class="record-cat">${cat}</span>
        <span class="record-time">${time}</span>
      </div>
      <div class="record-summary">${summary}</div>
    </div>`;
  }
};
