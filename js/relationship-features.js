/* ============================================================
   LMS - Relationship Feature Modules
   孤立スコア / 今日連絡すべき人 / 関係性ダッシュボード
   ============================================================ */
var RelationshipFeatures = {

  // ═══════════════════════════════════════════════════════════
  //  孤立スコア（Isolation Score）
  // ═══════════════════════════════════════════════════════════

  calculateIsolationScore() {
    const contacts = store.get('relationship_contacts') || [];
    const interactions = store.get('relationship_interactions') || [];

    if (contacts.length === 0) return { score: 0, level: 'unknown', details: [] };

    const now = new Date();
    const closeContacts = contacts.filter(c => parseInt(c.distance) <= 3);
    const details = [];

    // 親しい人ごとに最後の接触からの日数を計算
    closeContacts.forEach(contact => {
      const lastInteraction = interactions
        .filter(i => i.person === contact.name || i.person === contact.furigana)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      const daysSince = lastInteraction ?
        Math.floor((now - new Date(lastInteraction.timestamp)) / (1000 * 60 * 60 * 24)) :
        999;

      const distance = parseInt(contact.distance) || 3;
      // 距離感に応じた適正間隔
      const idealInterval = { 1: 1, 2: 7, 3: 14 }[distance] || 14;
      const overdue = daysSince > idealInterval;

      details.push({
        name: contact.name,
        distance,
        daysSince,
        idealInterval,
        overdue,
        lastType: lastInteraction?.type || null,
        urgency: overdue ? Math.min(10, Math.round(daysSince / idealInterval)) : 0
      });
    });

    // 孤立スコア計算（0=孤立なし〜100=深刻な孤立）
    if (details.length === 0) return { score: 50, level: 'caution', details: [] };

    const overdueCount = details.filter(d => d.overdue).length;
    const overdueRatio = overdueCount / details.length;
    const avgUrgency = details.reduce((s, d) => s + d.urgency, 0) / details.length;

    // 加重スコア: 距離1-2の人との接触不足は重い
    const weightedOverdue = details
      .filter(d => d.overdue)
      .reduce((s, d) => s + (d.distance <= 2 ? 3 : 1), 0);

    const score = Math.min(100, Math.round(
      (overdueRatio * 40) + (avgUrgency * 4) + (weightedOverdue * 3)
    ));

    const level = score <= 20 ? 'good' : score <= 40 ? 'fair' : score <= 60 ? 'caution' : 'warning';

    return { score, level, details: details.sort((a, b) => b.urgency - a.urgency), overdueCount, total: details.length };
  },

  // ═══════════════════════════════════════════════════════════
  //  孤立スコア表示ウィジェット
  // ═══════════════════════════════════════════════════════════

  renderIsolationWidget() {
    const result = this.calculateIsolationScore();

    const colors = { good: '#27AE60', fair: '#F1C40F', caution: '#E67E22', warning: '#E74C3C', unknown: '#8896A6' };
    const labels = { good: '良好', fair: 'まずまず', caution: '少し注意', warning: '要注意', unknown: '不明' };
    const messages = {
      good: '大切な方とのつながりがしっかり保たれています。',
      fair: '概ね良いですが、少し間が空いている方がいます。',
      caution: 'しばらくご連絡していない方がいらっしゃいます。',
      warning: '大切な方との連絡が途絶えがちです。ぜひお声がけを。',
      unknown: '連絡先を登録すると、つながりの状態を確認できます。'
    };

    const color = colors[result.level];
    const invertScore = 100 - result.score; // 高い方がいい表示にする

    let html = `<div class="isolation-widget" style="border-left: 5px solid ${color}">
      <div class="iso-header">
        <h3>つながりスコア</h3>
        <div class="iso-score" style="color:${color}">${invertScore}<span class="iso-unit">/100</span></div>
      </div>
      <div class="iso-status" style="color:${color}">${labels[result.level]}</div>
      <p class="iso-message">${messages[result.level]}</p>`;

    if (result.overdueCount > 0) {
      html += `<div class="iso-alert">
        <strong>⚠️ ${result.overdueCount}人</strong>の方と、適切な間隔を超えてご連絡できていません
      </div>`;
    }

    html += `</div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  「今日連絡すべき人」
  // ═══════════════════════════════════════════════════════════

  renderTodayContacts() {
    const result = this.calculateIsolationScore();
    const contacts = store.get('relationship_contacts') || [];

    // 今日連絡すべき人（urgencyが高い順 + 誕生日が近い人）
    const overdueList = result.details.filter(d => d.overdue).slice(0, 5);

    // 誕生日が今日〜3日以内の人
    const today = new Date();
    const birthdayList = contacts
      .filter(c => c.birthday)
      .filter(c => {
        const bd = new Date(c.birthday);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(next.getFullYear() + 1);
        const days = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
        return days <= 3;
      });

    if (overdueList.length === 0 && birthdayList.length === 0) {
      return `<div class="today-contacts">
        <h3>📞 今日のおすすめ</h3>
        <p class="today-good">すべての方と適切な頻度でつながれています。素晴らしいですね。</p>
      </div>`;
    }

    let html = `<div class="today-contacts">
      <h3>📞 今日、連絡してみませんか？</h3>`;

    // 誕生日の方を最優先
    birthdayList.forEach(c => {
      const bd = new Date(c.birthday);
      const dateStr = `${bd.getMonth() + 1}月${bd.getDate()}日`;
      html += `<div class="contact-suggest birthday-suggest">
        <div class="cs-icon">🎂</div>
        <div class="cs-info">
          <div class="cs-name">${c.name}さん</div>
          <div class="cs-reason">お誕生日が${dateStr}です！おめでとうのメッセージを送りましょう</div>
        </div>
        <div class="cs-actions">
          ${c.phone ? `<a href="tel:${c.phone}" class="btn btn-sm btn-primary">📞 電話</a>` : ''}
          <button class="btn btn-sm btn-secondary" onclick="RelationshipFeatures.logContact('${c.name}','message')">💬 連絡済み</button>
        </div>
      </div>`;
    });

    // 連絡が途絶えている方
    overdueList.forEach(d => {
      const contact = contacts.find(c => c.name === d.name);
      const distLabel = CONFIG.domains.relationship?.distanceLevels?.[d.distance]?.description || '';
      const suggestion = this.getSuggestion(d);

      html += `<div class="contact-suggest ${d.urgency >= 5 ? 'urgent' : ''}">
        <div class="cs-icon">${d.urgency >= 5 ? '⚠️' : '💭'}</div>
        <div class="cs-info">
          <div class="cs-name">${d.name}さん <span class="cs-dist">${distLabel}</span></div>
          <div class="cs-reason">${d.daysSince}日間ご連絡していません${suggestion ? '。' + suggestion : ''}</div>
        </div>
        <div class="cs-actions">
          ${contact?.phone ? `<a href="tel:${contact.phone}" class="btn btn-sm btn-primary">📞 電話</a>` : ''}
          <button class="btn btn-sm btn-secondary" onclick="RelationshipFeatures.logContact('${d.name}','call')">📝 連絡済み</button>
        </div>
      </div>`;
    });

    html += `</div>`;
    return html;
  },

  getSuggestion(detail) {
    if (detail.distance === 1) return 'パートナー・ご家族です。今日お声がけを';
    if (detail.distance === 2 && detail.daysSince > 30) return '親しい方です。お手紙やお電話はいかがですか？';
    if (detail.distance === 2) return '親しい方です。近況をお聞きしてみては？';
    if (detail.daysSince > 60) return 'お元気か確認のご連絡をおすすめします';
    return '';
  },

  // ─── 連絡済みとして記録 ───
  logContact(name, type) {
    store.addDomainEntry('relationship', 'interactions', {
      person: name,
      type: type,
      quality: 3,
      notes: '（ワンタッチ記録）'
    });
    Components.showToast(`${name}さんへの連絡を記録しました`, 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ═══════════════════════════════════════════════════════════
  //  連絡先一覧
  // ═══════════════════════════════════════════════════════════

  renderContactList() {
    const contacts = store.get('relationship_contacts') || [];
    if (contacts.length === 0) return '';

    const interactions = store.get('relationship_interactions') || [];
    const now = new Date();
    const levels = CONFIG.domains.relationship.distanceLevels;

    // Ideal contact interval by distance
    const idealInterval = { 1: 1, 2: 7, 3: 14, 4: 60, 5: 180 };

    const annotated = contacts.map(c => {
      const last = interactions
        .filter(i => i.person === c.name || i.person === c.furigana)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const daysSince = last
        ? Math.floor((now - new Date(last.timestamp)) / (1000 * 60 * 60 * 24))
        : null;
      const dist = parseInt(c.distance) || 5;
      const overdue = daysSince !== null && daysSince > (idealInterval[dist] || 60);
      return { ...c, daysSince, overdue, dist };
    }).sort((a, b) => a.dist - b.dist);

    const grouped = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    annotated.forEach(c => { if (grouped[c.dist]) grouped[c.dist].push(c); });

    let html = `<div class="contact-list-section">
      <div class="cl-header">
        <h3>連絡先一覧（${contacts.length}人）</h3>
        <input type="text" class="form-input cl-search" placeholder="名前で検索..."
          oninput="RelationshipFeatures.filterContactList(this.value)" id="contactSearch">
      </div>
      <div id="contactListBody">`;

    [1, 2, 3, 4, 5].forEach(level => {
      const people = grouped[level];
      if (!people || people.length === 0) return;
      const lc = levels[level];
      html += `<div class="cl-group">
        <div class="cl-group-header" style="color:${lc.color}">${lc.description}（${people.length}人）</div>
        <div class="cl-group-body">`;
      people.forEach(c => {
        const nameEsc = Components.escapeHtml(c.name || '');
        const dayLabel = c.daysSince === null ? 'まだ記録なし' :
          c.daysSince === 0 ? '今日連絡済み' : `${c.daysSince}日前`;
        html += `<div class="cl-item ${c.overdue ? 'cl-overdue' : ''}">
          <div class="cl-avatar" style="background:${lc.color}20;color:${lc.color}">${nameEsc.substring(0, 1)}</div>
          <div class="cl-info">
            <div class="cl-name">${nameEsc}</div>
            <div class="cl-meta">最終連絡：${dayLabel}</div>
          </div>
          <div class="cl-actions">
            ${c.phone ? `<a href="tel:${Components.escapeHtml(c.phone)}" class="btn btn-sm btn-secondary">📞</a>` : ''}
            <button class="btn btn-sm btn-secondary"
              onclick="RelationshipFeatures.logContact('${nameEsc.replace(/'/g, "\\'")}','meeting')">✓ 記録</button>
          </div>
        </div>`;
      });
      html += `</div></div>`;
    });

    html += `</div></div>`;
    return html;
  },

  filterContactList(query) {
    const body = document.getElementById('contactListBody');
    if (!body) return;
    const q = (query || '').toLowerCase();
    body.querySelectorAll('.cl-item').forEach(item => {
      const name = item.querySelector('.cl-name')?.textContent?.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
    // Hide empty groups
    body.querySelectorAll('.cl-group').forEach(g => {
      const visible = [...g.querySelectorAll('.cl-item')].some(i => i.style.display !== 'none');
      g.style.display = visible ? '' : 'none';
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  贈り物の記録
  // ═══════════════════════════════════════════════════════════

  renderGiftHistory() {
    const gifts = store.getDomainData('relationship', 'gifts', 90);
    const contacts = store.get('relationship_contacts') || [];

    // Upcoming birthdays (distance 1-3, within 30 days) with no gift sent yet
    const today = new Date();
    const upcoming = contacts
      .filter(c => c.birthday && parseInt(c.distance) <= 3)
      .map(c => {
        const bd = new Date(c.birthday);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(next.getFullYear() + 1);
        return { ...c, daysUntil: Math.ceil((next - today) / (1000 * 60 * 60 * 24)), nextBirthday: next };
      })
      .filter(c => c.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (gifts.length === 0 && upcoming.length === 0) return '';

    const occasionLabels = {
      birthday: '誕生日', new_year: 'お正月', obon: 'お盆',
      okaeshi: 'お返し', celebration: 'お祝い',
      sympathy: 'お見舞い', souvenir: 'お土産', other: 'その他'
    };

    let html = `<div class="gift-section"><h3>🎁 贈り物の記録</h3>`;

    if (upcoming.length > 0) {
      html += `<div class="gift-reminders">
        <div class="gift-reminder-title">近い誕生日（プレゼント候補）</div>`;
      upcoming.forEach(c => {
        const dateStr = c.nextBirthday.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
        html += `<div class="gift-reminder-item">
          <span class="gift-reminder-days ${c.daysUntil <= 7 ? 'soon' : ''}">あと${c.daysUntil}日</span>
          <span>${Components.escapeHtml(c.name || '')}さん（${dateStr}）</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (gifts.length > 0) {
      html += `<div class="gift-list">`;
      gifts.slice(0, 8).forEach(g => {
        const arrow = g.direction === 'sent' ? '→ 贈った' : '← いただいた';
        const occ = occasionLabels[g.occasion] || g.occasion || '';
        html += `<div class="gift-item">
          <div class="gift-direction ${g.direction}">${arrow}</div>
          <div class="gift-info">
            <div class="gift-person">${Components.escapeHtml(g.person || '')}さん</div>
            <div class="gift-detail">${Components.escapeHtml(g.item || '')}${occ ? '（' + occ + '）' : ''}${g.amount ? ' ' + Number(g.amount).toLocaleString() + '円' : ''}</div>
          </div>
          <div class="gift-date">${new Date(g.timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</div>
        </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  統合表示（ホーム画面用）
  // ═══════════════════════════════════════════════════════════

  renderDashboard() {
    return (
      this.renderIsolationWidget() +
      this.renderTodayContacts() +
      this.renderContactList() +
      this.renderGiftHistory()
    );
  }
};
