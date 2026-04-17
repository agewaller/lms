/* ============================================================
   LMS - Work Feature Modules
   活動診断 / 提供形態の選択 / 近くのお仕事さがし
   ============================================================ */
var WorkFeatures = {

  // ═══════════════════════════════════════════════════════════
  //  提供形態の選択（有償 / 無償 / 記帳）
  // ═══════════════════════════════════════════════════════════

  renderProvisionSelector() {
    const prefs = store.get('workProvisionPrefs') || { paid: true, volunteer: true, bookkeeping: false };

    return `<div class="provision-selector">
      <h3>あなたの活動スタイル</h3>
      <p>お仕事やボランティア、記録だけなど、あなたに合った形を選べます。全部選んでも大丈夫です。</p>

      <div class="provision-cards">
        <label class="provision-card ${prefs.paid ? 'selected' : ''}" onclick="WorkFeatures.toggleProvision('paid', this)">
          <input type="checkbox" name="provision" value="paid" ${prefs.paid ? 'checked' : ''} style="display:none">
          <div class="pc-icon">💰</div>
          <div class="pc-title">お仕事として</div>
          <div class="pc-desc">時給や報酬をもらう</div>
        </label>

        <label class="provision-card ${prefs.volunteer ? 'selected' : ''}" onclick="WorkFeatures.toggleProvision('volunteer', this)">
          <input type="checkbox" name="provision" value="volunteer" ${prefs.volunteer ? 'checked' : ''} style="display:none">
          <div class="pc-icon">🤝</div>
          <div class="pc-title">ボランティアとして</div>
          <div class="pc-desc">誰かのために無償で</div>
        </label>

        <label class="provision-card ${prefs.bookkeeping ? 'selected' : ''}" onclick="WorkFeatures.toggleProvision('bookkeeping', this)">
          <input type="checkbox" name="provision" value="bookkeeping" ${prefs.bookkeeping ? 'checked' : ''} style="display:none">
          <div class="pc-icon">📝</div>
          <div class="pc-title">記録だけ</div>
          <div class="pc-desc">活動を記録しておく</div>
        </label>
      </div>
    </div>`;
  },

  toggleProvision(type, el) {
    const prefs = store.get('workProvisionPrefs') || { paid: true, volunteer: true, bookkeeping: false };
    prefs[type] = !prefs[type];
    store.set('workProvisionPrefs', prefs);
    if (el) el.classList.toggle('selected');
  },

  // ═══════════════════════════════════════════════════════════
  //  近くのお仕事・ボランティアさがし
  // ═══════════════════════════════════════════════════════════

  renderJobDiscovery() {
    const profile = store.get('userProfile') || {};
    const location = profile.location || '';
    const prefs = store.get('workProvisionPrefs') || { paid: true, volunteer: true, bookkeeping: false };

    let html = `<div class="job-discovery">
      <h3>🔍 近くのお仕事・ボランティアを見つける</h3>`;

    if (!location) {
      html += `<div class="jd-location-prompt">
        <p>お住まいの地域を設定すると、近くのお仕事やボランティアを見つけられます。</p>
        <div class="form-group">
          <label>お住まいの地域</label>
          <input type="text" id="jdLocation" class="form-input" placeholder="例：東京都渋谷区">
        </div>
        <button class="btn btn-primary" onclick="WorkFeatures.saveLocation()">設定する</button>
      </div>`;
    } else {
      html += `<p>「${location}」の近くで見つかるお仕事やボランティアです。</p>`;

      // 検索ボタン
      html += `<button class="btn btn-primary btn-lg" onclick="WorkFeatures.searchOpportunities()" style="margin-bottom:20px;">
        近くのお仕事を探す
      </button>
      <div id="jobSearchResult"></div>`;

      // 外部サイトへのリンク
      html += `<div class="jd-platforms">
        <h4>お仕事さがしサイト</h4>`;

      if (prefs.paid) {
        html += `
        <a href="https://timee.co.jp/" target="_blank" rel="noopener" class="jd-platform-link">
          <span class="jd-pl-icon">⏰</span>
          <span class="jd-pl-info">
            <strong>タイミー</strong>
            <span>好きな時間に、好きな場所で、すぐ働ける</span>
          </span>
        </a>
        <a href="https://www.baitoru.com/" target="_blank" rel="noopener" class="jd-platform-link">
          <span class="jd-pl-icon">💼</span>
          <span class="jd-pl-info">
            <strong>バイトル</strong>
            <span>パート・アルバイトを探す</span>
          </span>
        </a>
        <a href="https://www.indeed.com/q-senior-l-${encodeURIComponent(location)}-jobs.html" target="_blank" rel="noopener" class="jd-platform-link">
          <span class="jd-pl-icon">🔎</span>
          <span class="jd-pl-info">
            <strong>Indeed</strong>
            <span>シニア歓迎のお仕事</span>
          </span>
        </a>
        <a href="https://crowdworks.jp/" target="_blank" rel="noopener" class="jd-platform-link">
          <span class="jd-pl-icon">💻</span>
          <span class="jd-pl-info">
            <strong>クラウドワークス</strong>
            <span>家にいながらできるお仕事</span>
          </span>
        </a>`;
      }

      if (prefs.volunteer) {
        html += `
        <a href="https://www.activocommunity.com/" target="_blank" rel="noopener" class="jd-platform-link volunteer">
          <span class="jd-pl-icon">🤝</span>
          <span class="jd-pl-info">
            <strong>activo</strong>
            <span>ボランティア・NPO求人を探す</span>
          </span>
        </a>
        <a href="https://b.volunteer-platform.org/" target="_blank" rel="noopener" class="jd-platform-link volunteer">
          <span class="jd-pl-icon">🌱</span>
          <span class="jd-pl-info">
            <strong>ボランティアプラットフォーム</strong>
            <span>地域のボランティア活動</span>
          </span>
        </a>
        <a href="https://www.shakyo.or.jp/" target="_blank" rel="noopener" class="jd-platform-link volunteer">
          <span class="jd-pl-icon">🏛️</span>
          <span class="jd-pl-info">
            <strong>社会福祉協議会</strong>
            <span>お住まいの地域のボランティア情報</span>
          </span>
        </a>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  saveLocation() {
    const loc = document.getElementById('jdLocation')?.value?.trim();
    if (!loc) return;
    const profile = store.get('userProfile') || {};
    profile.location = loc;
    store.set('userProfile', profile);
    Components.showToast('地域を設定しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  async searchOpportunities() {
    const profile = store.get('userProfile') || {};
    const resume = store.get('userResume') || {};
    const prefs = store.get('workProvisionPrefs') || {};
    const resultEl = document.getElementById('jobSearchResult');

    if (resultEl) resultEl.innerHTML = Components.loading('あなたに合ったお仕事を探しています...');

    const types = [];
    if (prefs.paid) types.push('有償のお仕事（パート、アルバイト、業務委託）');
    if (prefs.volunteer) types.push('ボランティア活動');
    if (prefs.bookkeeping) types.push('活動記録の提案');

    const prompt = `以下の方に合うお仕事やボランティアを5つ提案してください。

場所：${profile.location || '不明'}
年齢：${profile.age || '65歳'}
経験：${resume.summary || '特に記載なし'}
できること：${(resume.skills || []).join('、') || '特に記載なし'}
探しているもの：${types.join('、')}

それぞれについて、以下を書いてください：
・何をするか（ひと言で）
・どこで見つかるか（サイト名や場所）
・どのくらい稼げるか（有償の場合）/ どんないいことがあるか（無償の場合）
・始め方（最初の一歩）

むずかしい言葉は使わないでください。`;

    try {
      const result = await AIEngine.analyze('work', 'daily', { text: prompt });
      if (resultEl) {
        resultEl.innerHTML = `<div class="job-search-result">
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
        </div>`;
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  活動の記録（提供形態つき）
  // ═══════════════════════════════════════════════════════════

  renderActivityLog() {
    const recent = store.getDomainData('work', 'tasks', 14);
    if (recent.length === 0) return '';

    return `<div class="activity-log">
      <h3>最近の活動</h3>
      <div class="activity-list">
        ${recent.slice(-10).reverse().map(a => {
          const typeLabel = a.provision === 'paid' ? '💰 有償' : a.provision === 'volunteer' ? '🤝 ボランティア' : '📝 記録';
          return `<div class="activity-item">
            <span class="ai-type">${typeLabel}</span>
            <span class="ai-title">${a.title || a.description || ''}</span>
            <span class="ai-time">${new Date(a.timestamp).toLocaleDateString('ja-JP')}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════
  //  あなたの経験診断（シンプル化）
  // ═══════════════════════════════════════════════════════════

  renderSideBizDiagnosis() {
    return `<div class="sidebiz-diagnosis">
      <h3>あなたにできること診断</h3>
      <p>これまでの経験や好きなことを教えてください。あなたに合った活動を見つけます。</p>

      <div class="diagnosis-form">
        <div class="form-group">
          <label>これまでやってきたこと</label>
          <textarea id="diagExperience" class="form-input" rows="3"
            placeholder="例：病院で30年働いた、パン作りが好き、英語を少し話せる"></textarea>
        </div>

        <div class="form-group">
          <label>好きなこと・得意なこと</label>
          <textarea id="diagSkills" class="form-input" rows="3"
            placeholder="例：料理、手芸、話を聞くこと、片付け、庭いじり"></textarea>
        </div>

        <div class="form-group">
          <label>使える時間</label>
          <select id="diagTime" class="form-input">
            <option value="2-3h">すきま時間だけ（週2〜3時間）</option>
            <option value="5-10h" selected>午前中だけなど（週5〜10時間）</option>
            <option value="10-20h">半日を何日か（週10〜20時間）</option>
            <option value="20h+">しっかり取り組みたい（週20時間以上）</option>
          </select>
        </div>

        <div class="form-group">
          <label>やり方</label>
          <select id="diagMode" class="form-input">
            <option value="online">家からオンラインで</option>
            <option value="both" selected>どちらでも</option>
            <option value="offline">直接会って</option>
          </select>
        </div>
      </div>

      <button class="btn btn-primary btn-lg" onclick="WorkFeatures.diagnose()">
        見つけてもらう
      </button>

      <div id="diagnosisResult"></div>
    </div>`;
  },

  async diagnose() {
    const experience = document.getElementById('diagExperience')?.value || '';
    const skills = document.getElementById('diagSkills')?.value || '';
    const time = document.getElementById('diagTime')?.value || '';
    const mode = document.getElementById('diagMode')?.value || '';
    const prefs = store.get('workProvisionPrefs') || { paid: true, volunteer: true };
    const resultEl = document.getElementById('diagnosisResult');

    if (!experience && !skills) {
      Components.showToast('経験や好きなことを教えてください', 'info');
      return;
    }

    if (resultEl) resultEl.innerHTML = Components.loading('あなたに合った活動を探しています...');

    const types = [];
    if (prefs.paid) types.push('お金がもらえるお仕事');
    if (prefs.volunteer) types.push('ボランティア');
    if (prefs.bookkeeping) types.push('記録として残す活動');

    const prompt = `この方に合う活動を3つ見つけてください。

やってきたこと：${experience}
好きなこと：${skills}
使える時間：${time}
やり方：${mode === 'online' ? '家からオンライン' : mode === 'offline' ? '直接会って' : 'どちらでも'}
希望する形：${types.join('、')}

それぞれについて：
1. 何をするか（ひと言で）
2. 始め方（今日15分でできること）
3. どこで始めるか（サイト名や場所）
4. どんないいことがあるか

むずかしい言葉は使わないでください。
おばあちゃんに話すように、やさしく伝えてください。`;

    try {
      const result = await AIEngine.analyze('work', 'daily', { text: prompt });
      if (resultEl) {
        resultEl.innerHTML = `<div class="diagnosis-result">
          <h3>🎯 あなたにおすすめ</h3>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
        </div>`;
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  空き時間販売の案内
  // ═══════════════════════════════════════════════════════════

  renderTimeSellingBanner() {
    const mpSettings = typeof TimeMarketplace !== 'undefined' ? TimeMarketplace.getSettings() : {};

    if (mpSettings.enabled) {
      const free = typeof TimeMarketplace !== 'undefined' ? TimeMarketplace.getTotalFreeHours(7) : { totalHours: 0, potentialRevenue: 0 };
      return `<div class="time-selling-banner active">
        <div class="tsb-icon">⏰</div>
        <div class="tsb-content">
          <h4>空き時間の提供 稼働中</h4>
          <p>今週の空き：${free.totalHours}時間</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="app.switchDomain('time')">見る</button>
      </div>`;
    }

    return `<div class="time-selling-banner">
      <div class="tsb-icon">💡</div>
      <div class="tsb-content">
        <h4>空き時間を誰かのために使いませんか？</h4>
        <p>カレンダーの空き時間で、あなたのできることを提供できます。有償でも無償でもOKです。</p>
      </div>
      <button class="btn btn-sm btn-primary" onclick="app.switchDomain('time');app.navigate('settings')">やってみる</button>
    </div>`;
  }
};
