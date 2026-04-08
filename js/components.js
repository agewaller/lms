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
      case 'slider':
        return `<div class="slider-field">
          <input type="range" name="${name}" min="${f.min||0}" max="${f.max||10}" value="${Math.floor((f.min||0 + f.max||10)/2)}" oninput="this.nextElementSibling.textContent=this.value">
          <span class="slider-val">${Math.floor(((f.min||0) + (f.max||10))/2)}</span>
        </div>`;
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
    const icon = msg.role === 'user' ? '👤' : '🤖';
    return `<div class="chat-msg ${cls}">
      <div class="chat-icon">${icon}</div>
      <div class="chat-content">${this.formatMarkdown(msg.content || '')}</div>
      <div class="chat-time">${msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</div>
    </div>`;
  },

  // ─── Markdown Formatter ───
  formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  },

  // ─── Toast Notification ───
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
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
      { id: 'ask_ai', icon: '🤖' },
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
