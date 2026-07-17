/* ============================================================
   LMS - Health Feature Modules
   服薬管理 / 健康トレンド / 受診予定
   ============================================================ */
var HealthFeatures = {

  // ═══════════════════════════════════════════════════════════
  //  服薬トラッカー（今日の服薬チェックリスト）
  // ═══════════════════════════════════════════════════════════

  renderMedicationTracker() {
    const medications = store.get('health_medications') || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayLog = store.get('health_medication_log_' + today) || {};

    if (medications.length === 0) {
      return `<div class="medication-tracker">
        <div class="med-header">
          <h3>💊 服薬管理</h3>
          <button class="btn btn-sm btn-secondary" onclick="HealthFeatures.addMedication()">＋ お薬を登録</button>
        </div>
        <p class="med-empty">定期的にお薬を飲まれている方はこちらに登録できます。毎朝、今日飲むお薬を確認できます。</p>
      </div>`;
    }

    const times = ['朝', '昼', '夕', '就寝前'];
    const byTime = {};
    times.forEach(t => { byTime[t] = medications.filter(m => m.timing === t); });

    const totalCount = medications.length;
    const takenCount = Object.keys(todayLog).length;
    const allDone = takenCount >= totalCount;

    let html = `<div class="medication-tracker">
      <div class="med-header">
        <h3>💊 今日の服薬</h3>
        <span class="med-progress ${allDone ? 'done' : ''}">${takenCount}/${totalCount} 完了</span>
      </div>
      <p class="med-date">${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })}</p>`;

    if (allDone) {
      html += `<div class="med-all-done">今日の服薬がすべて完了しました ✓</div>`;
    }

    times.forEach(time => {
      const meds = byTime[time];
      if (meds.length === 0) return;
      html += `<div class="med-time-group">
        <div class="med-time-label">${time}</div>
        <div class="med-items">`;
      meds.forEach(med => {
        const logKey = med.id + '_' + time;
        const taken = !!todayLog[logKey];
        html += `<div class="med-item ${taken ? 'taken' : ''}">
          <label class="med-check-label">
            <input type="checkbox" class="med-check" ${taken ? 'checked' : ''}
              onchange="HealthFeatures.toggleMedication('${med.id}','${time}',this.checked)">
            <span class="med-name">${Components.escapeHtml(med.name)}</span>
            ${med.dose ? `<span class="med-dose">${Components.escapeHtml(med.dose)}</span>` : ''}
          </label>
        </div>`;
      });
      html += `</div></div>`;
    });

    html += `<div class="med-footer">
      <button class="btn btn-sm btn-secondary" onclick="HealthFeatures.addMedication()">＋ お薬を追加</button>
      <button class="btn btn-sm btn-secondary" onclick="HealthFeatures.manageMedications()">お薬の一覧・編集</button>
    </div>
    </div>`;
    return html;
  },

  toggleMedication(id, time, taken) {
    const today = new Date().toISOString().slice(0, 10);
    const storeKey = 'health_medication_log_' + today;
    const log = store.get(storeKey) || {};
    const logKey = id + '_' + time;
    if (taken) {
      log[logKey] = new Date().toISOString();
    } else {
      delete log[logKey];
    }
    store.set(storeKey, log);
    if (taken) Components.showToast('服薬を記録しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  addMedication() {
    const times = ['朝', '昼', '夕', '就寝前'];
    const body = `<div>
      <div class="form-group">
        <label>お薬の名前</label>
        <input type="text" id="medName" class="form-input" placeholder="例：アムロジピン、血圧の薬">
      </div>
      <div class="form-group">
        <label>用量・メモ</label>
        <input type="text" id="medDose" class="form-input" placeholder="例：5mg 1錠">
      </div>
      <div class="form-group">
        <label>服薬タイミング</label>
        <select id="medTiming" class="form-input">
          ${times.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
        <button class="btn btn-primary" id="saveMedBtn">登録する</button>
      </div>
    </div>`;
    app.openModal('お薬を登録する', body);
    requestAnimationFrame(() => {
      const btn = document.getElementById('saveMedBtn');
      if (btn) btn.onclick = () => {
        const name = document.getElementById('medName')?.value.trim();
        const dose = document.getElementById('medDose')?.value.trim();
        const timing = document.getElementById('medTiming')?.value;
        if (!name) { Components.showToast('お薬の名前を入力してください', 'warning'); return; }
        const meds = store.get('health_medications') || [];
        meds.push({ id: 'med_' + Date.now(), name, dose, timing });
        store.set('health_medications', meds);
        app.closeModal();
        Components.showToast('お薬を登録しました', 'success');
        app.renderApp();
      };
    });
  },

  manageMedications() {
    const meds = store.get('health_medications') || [];
    if (meds.length === 0) { this.addMedication(); return; }

    const rows = meds.map((m, i) => `
      <div class="med-manage-row">
        <div class="med-manage-info">
          <span class="med-manage-name">${Components.escapeHtml(m.name)}</span>
          <span class="med-manage-detail">${Components.escapeHtml(m.timing)} ${m.dose ? '/ ' + Components.escapeHtml(m.dose) : ''}</span>
        </div>
        <button class="btn btn-sm btn-secondary" style="color:#ef4444" onclick="HealthFeatures._deleteMedication('${m.id}')">削除</button>
      </div>`).join('');

    app.openModal('お薬の一覧', `<div>${rows}<div style="margin-top:16px"><button class="btn btn-primary" onclick="app.closeModal();HealthFeatures.addMedication()">＋ 追加する</button></div></div>`);
  },

  _deleteMedication(id) {
    const meds = (store.get('health_medications') || []).filter(m => m.id !== id);
    store.set('health_medications', meds);
    app.closeModal();
    Components.showToast('削除しました', 'info');
    app.renderApp();
  },

  // ═══════════════════════════════════════════════════════════
  //  健康トレンド（過去7日間のバーチャート）
  // ═══════════════════════════════════════════════════════════

  renderHealthTrends() {
    const symptoms = store.getDomainData('health', 'symptoms', 7);
    const sleep = store.getDomainData('health', 'sleepData', 7);
    const activity = store.getDomainData('health', 'activityData', 7);

    if (symptoms.length === 0 && sleep.length === 0 && activity.length === 0) return '';

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const getByDate = (data, key) => days.map(date => {
      const entry = data.find(e => (e.timestamp || '').slice(0, 10) === date);
      return entry ? (entry[key] || 0) : null;
    });

    const conditionData = getByDate(symptoms, 'condition_level');
    const sleepQuality = getByDate(sleep, 'quality');
    const stepsData = getByDate(activity, 'steps');
    const dayLabels = days.map(d => ['日','月','火','水','木','金','土'][new Date(d).getDay()]);

    const barBlock = (vals, max, color) => `<div class="trend-bars">
      ${vals.map(v => v === null
        ? `<div class="trend-bar empty"></div>`
        : `<div class="trend-bar" style="height:${Math.max(4, Math.min(100, Math.round(v / max * 100)))}%;background:${color}" title="${v}"></div>`
      ).join('')}
    </div>`;

    let html = `<div class="health-trends-section">
      <h3>過去7日間の傾向</h3>
      <div class="trends-grid">`;

    if (conditionData.some(v => v !== null)) {
      html += `<div class="trend-chart">
        <div class="trend-title">体調 <span class="trend-unit">（/10）</span></div>
        ${barBlock(conditionData, 10, 'var(--success)')}
        <div class="trend-labels">${dayLabels.map(l => `<span>${l}</span>`).join('')}</div>
      </div>`;
    }

    if (sleepQuality.some(v => v !== null)) {
      html += `<div class="trend-chart">
        <div class="trend-title">睡眠の質 <span class="trend-unit">（/10）</span></div>
        ${barBlock(sleepQuality, 10, 'var(--accent)')}
        <div class="trend-labels">${dayLabels.map(l => `<span>${l}</span>`).join('')}</div>
      </div>`;
    }

    if (stepsData.some(v => v !== null)) {
      const peak = Math.max(...stepsData.filter(v => v !== null), 8000);
      html += `<div class="trend-chart">
        <div class="trend-title">歩数</div>
        ${barBlock(stepsData, peak, 'var(--info)')}
        <div class="trend-labels">${dayLabels.map(l => `<span>${l}</span>`).join('')}</div>
      </div>`;
    }

    html += `</div></div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  受診予定ウィジェット
  // ═══════════════════════════════════════════════════════════

  renderDoctorVisitWidget() {
    const visits = store.get('health_doctor_visits') || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = visits
      .filter(v => new Date(v.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3);

    const past = visits
      .filter(v => new Date(v.date) < today)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 2);

    let html = `<div class="doctor-visit-widget">
      <div class="visit-header">
        <h3>🏥 受診予定</h3>
        <button class="btn btn-sm btn-secondary" onclick="HealthFeatures.addDoctorVisit()">＋ 予定を追加</button>
      </div>`;

    if (upcoming.length === 0 && past.length === 0) {
      html += `<p class="visit-empty">受診の予定を登録しておくと、忘れずに準備ができます。</p>`;
    }

    if (upcoming.length > 0) {
      html += `<div class="visit-list">`;
      upcoming.forEach(v => {
        const vDate = new Date(v.date);
        vDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((vDate - today) / (1000 * 60 * 60 * 24));
        const label = daysUntil === 0 ? '今日！' : daysUntil === 1 ? '明日' : `あと${daysUntil}日`;
        html += `<div class="visit-item ${daysUntil <= 3 ? 'visit-soon' : ''}">
          <div class="visit-icon">🏥</div>
          <div class="visit-info">
            <div class="visit-name">${Components.escapeHtml(v.hospital || v.doctor || '受診')}</div>
            <div class="visit-date">${vDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}<span class="visit-countdown"> ─ ${label}</span></div>
            ${v.notes ? `<div class="visit-notes">${Components.escapeHtml(v.notes)}</div>` : ''}
          </div>
        </div>`;
      });
      html += `</div>`;
    }

    if (past.length > 0) {
      html += `<div class="visit-past">
        <div class="visit-past-label">直近の受診</div>`;
      past.forEach(v => {
        const d = new Date(v.date);
        html += `<div class="visit-past-item">
          <span>${Components.escapeHtml(v.hospital || v.doctor || '受診')}</span>
          <span>${d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
        </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  addDoctorVisit() {
    const body = `<div>
      <div class="form-group">
        <label>病院名・先生のお名前</label>
        <input type="text" id="visitHospital" class="form-input" placeholder="例：山田内科、田中整形外科">
      </div>
      <div class="form-group">
        <label>受診日</label>
        <input type="date" id="visitDate" class="form-input" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label>メモ（聞きたいことなど）</label>
        <textarea id="visitNotes" class="form-input" rows="3"
          placeholder="例：血圧の数値を確認する、薬の副作用について聞く"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-secondary" onclick="app.closeModal()">キャンセル</button>
        <button class="btn btn-primary" id="saveVisitBtn">登録する</button>
      </div>
    </div>`;
    app.openModal('受診を記録する', body);
    requestAnimationFrame(() => {
      const btn = document.getElementById('saveVisitBtn');
      if (btn) btn.onclick = () => {
        const hospital = document.getElementById('visitHospital')?.value.trim();
        const date = document.getElementById('visitDate')?.value;
        const notes = document.getElementById('visitNotes')?.value.trim();
        if (!date) { Components.showToast('日付を入力してください', 'warning'); return; }
        const visits = store.get('health_doctor_visits') || [];
        visits.push({ id: 'visit_' + Date.now(), hospital, date, notes });
        store.set('health_doctor_visits', visits);
        app.closeModal();
        Components.showToast('受診を登録しました', 'success');
        app.renderApp();
      };
    });
  },

  // ─── 統合ダッシュボード（ホーム画面用） ───
  renderDashboard() {
    return this.renderMedicationTracker() +
           this.renderHealthTrends() +
           this.renderDoctorVisitWidget();
  }
};
