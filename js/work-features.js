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

      html += `<button class="btn btn-primary btn-lg" onclick="WorkFeatures.searchOpportunities()" style="margin-bottom:20px;">
        近くのお仕事を探す
      </button>
      <div id="jobSearchResult"></div>`;

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
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${Components.escapeHtml(e.message)}</div>`;
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
            <span class="ai-title">${Components.escapeHtml(a.title || a.description || '')}</span>
            <span class="ai-time">${new Date(a.timestamp).toLocaleDateString('ja-JP')}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════
  //  生きがい発見ウィジェット
  // ═══════════════════════════════════════════════════════════

  renderIkigaiDiscover() {
    const saved = store.get('ikigai_answers') || {};
    const result = store.get('ikigai_result');

    return `<div class="ikigai-widget">
      <h3>あなたの「生きがい」を見つける</h3>
      <p>3つの質問に答えるだけで、あなたの生きがいと活躍できる場所が見えてきます。</p>

      <div class="ikigai-questions">
        <div class="iq-item">
          <div class="iq-num" style="background:#9B59B6">1</div>
          <div class="iq-content">
            <label class="iq-label">好きなこと・楽しいと感じること</label>
            <textarea id="ikigai_love" class="form-input iq-input" rows="2"
              placeholder="例：料理、読書、旅行、人と話すこと、子どもと接すること...">${Components.escapeHtml(saved.love || '')}</textarea>
          </div>
        </div>
        <div class="iq-item">
          <div class="iq-num" style="background:#3b82f6">2</div>
          <div class="iq-content">
            <label class="iq-label">得意なこと・人に褒められること</label>
            <textarea id="ikigai_good" class="form-input iq-input" rows="2"
              placeholder="例：細かい作業、人の気持ちがわかる、計算、掃除・整理、ガーデニング...">${Components.escapeHtml(saved.good || '')}</textarea>
          </div>
        </div>
        <div class="iq-item">
          <div class="iq-num" style="background:#10b981">3</div>
          <div class="iq-content">
            <label class="iq-label">誰かのためにしてあげたいこと</label>
            <textarea id="ikigai_give" class="form-input iq-input" rows="2"
              placeholder="例：困っている人を助けたい、子どもに教えたい、地域を盛り上げたい...">${Components.escapeHtml(saved.give || '')}</textarea>
          </div>
        </div>
      </div>

      <button class="btn btn-primary btn-lg" onclick="WorkFeatures.findIkigai()" style="margin-top:16px;width:100%">
        生きがいを見つける
      </button>

      <div id="ikigaiResult">${result ? `<div class="ikigai-result-card">
        <h4>✦ あなたの生きがい</h4>
        <div class="analysis-content">${Components.formatMarkdown(result)}</div>
        <button class="btn btn-sm btn-secondary" style="margin-top:12px"
          onclick="store.set('ikigai_result',null);app.renderApp()">もう一度考える</button>
      </div>` : ''}</div>
    </div>`;
  },

  async findIkigai() {
    const love = document.getElementById('ikigai_love')?.value?.trim() || '';
    const good = document.getElementById('ikigai_good')?.value?.trim() || '';
    const give = document.getElementById('ikigai_give')?.value?.trim() || '';
    const resultEl = document.getElementById('ikigaiResult');

    if (!love && !good && !give) {
      Components.showToast('ひとつ以上入力してください', 'info');
      return;
    }

    store.set('ikigai_answers', { love, good, give });
    if (resultEl) resultEl.innerHTML = Components.loading('あなたの生きがいを探しています...');

    const prompt = `65歳以上の方の「生きがい」を一緒に探します。

以下の回答をもとに、この方の「生きがい」と、それを活かせる具体的な活動を提案してください。

【好きなこと・楽しいこと】
${love || '（未記入）'}

【得意なこと・人に褒められること】
${good || '（未記入）'}

【誰かのためにしてあげたいこと】
${give || '（未記入）'}

以下の構成で回答してください：
1. あなたの生きがいの言葉（ひと言で。詩的に、心に響くように）
2. なぜそれがあなたの生きがいといえるのか（3文以内）
3. 今日から始められる活動（3つ。具体的に）
4. 1年後の理想の姿（短く、温かく）

難しい言葉は使わず、65歳以上の方に伝わるやさしい日本語で。`;

    try {
      const result = await AIEngine.analyze('work', 'daily', { text: prompt });
      store.set('ikigai_result', result);
      if (resultEl) {
        resultEl.innerHTML = `<div class="ikigai-result-card">
          <h4>✦ あなたの生きがい</h4>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
          <button class="btn btn-sm btn-secondary" style="margin-top:12px"
            onclick="store.set('ikigai_result',null);app.renderApp()">もう一度考える</button>
        </div>`;
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${Components.escapeHtml(e.message)}</div>`;
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  あなたの経験診断
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
          <label>お得意なこと・好きなこと</label>
          <textarea id="diagSkills" class="form-input" rows="3"
            placeholder="例：料理、手芸、人の話を聞くこと、片付け、ガーデニング、パソコン操作"></textarea>
        </div>

        <div class="form-group">
          <label>一週間で使える時間</label>
          <select id="diagTime" class="form-input">
            <option value="2-3h">週2〜3時間（すきま時間だけ）</option>
            <option value="5-10h" selected>週5〜10時間（午前中だけなど）</option>
            <option value="10-20h">週10〜20時間（半日×数日）</option>
            <option value="20h+">週20時間以上（しっかり取り組みたい）</option>
          </select>
        </div>

        <div class="form-group">
          <label>提供の方法</label>
          <select id="diagMode" class="form-input">
            <option value="online">オンラインだけ（家から出なくてOK）</option>
            <option value="both" selected>オンラインでも対面でも</option>
            <option value="offline">対面のみ（直接お会いしたい）</option>
          </select>
        </div>

        <div class="form-group">
          <label>月にどのくらいの収入を目指しますか？</label>
          <select id="diagIncome" class="form-input">
            <option value="pocket">お小遣い程度（1〜3万円）</option>
            <option value="supplement" selected>年金の足しに（3〜5万円）</option>
            <option value="serious">しっかり稼ぎたい（5〜10万円）</option>
            <option value="pro">本格的に（10万円以上）</option>
          </select>
        </div>

        <div class="form-group">
          <label>パソコン・スマホアプリの使用について</label>
          <select id="diagAI" class="form-input">
            <option value="never">まったく使ったことがない</option>
            <option value="beginner" selected>少し興味がある / 使ってみたい</option>
            <option value="some">ChatGPTなどを使ったことがある</option>
            <option value="active">日常的に使っている</option>
          </select>
        </div>
      </div>

      <button class="btn btn-primary btn-lg" onclick="WorkFeatures.diagnose()">
        診断する
      </button>

      <div id="diagnosisResult"></div>
    </div>`;
  },

  async diagnose() {
    const experience = document.getElementById('diagExperience')?.value || '';
    const skills = document.getElementById('diagSkills')?.value || '';
    const time = document.getElementById('diagTime')?.value || '';
    const mode = document.getElementById('diagMode')?.value || '';
    const income = document.getElementById('diagIncome')?.value || '';
    const ai = document.getElementById('diagAI')?.value || '';
    const resultEl = document.getElementById('diagnosisResult');

    if (!experience && !skills) {
      Components.showToast('ご経験やお得意なことを入力してください', 'info');
      return;
    }

    if (resultEl) resultEl.innerHTML = Components.loading('あなたにぴったりの副業を診断中...');

    const prompt = `65歳の女性から副業の相談です。以下の情報をもとに、AIを活用した副業プランを3つ提案してください。

【ご経験・職歴】${experience}
【お得意なこと・好きなこと】${skills}
【使える時間】${time}
【提供方法】${mode}
【目標収入】${income}
【AIツール経験】${ai}

各プランについて以下を含めてください：
1. 副業の名称とわかりやすい説明
2. 必要な準備（具体的なステップ）
3. 使うAIツール（ChatGPT/Claude/Canvaなど）とその使い方
4. 想定月収（現実的な金額）
5. 始めるまでの期間
6. 最初の一歩（今日から15分でできること）

AIが怖くない方にも、まったくの初心者にも伝わるよう、やさしい言葉で。
難しい用語には必ず（　）で説明を添えてください。日本語で回答。`;

    try {
      const result = await AIEngine.analyze('work', 'daily', { text: prompt });
      if (resultEl) {
        resultEl.innerHTML = `<div class="diagnosis-result">
          <h3>🎯 あなたにおすすめの副業プラン</h3>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
          <div class="diagnosis-actions" style="margin-top:20px;">
            <button class="btn btn-secondary" onclick="app.switchDomain('time');app.navigate('settings')">
              ⏰ 空き時間を販売する設定へ
            </button>
            <button class="btn btn-secondary" onclick="app.navigate('settings')">
              📄 レジュメを登録する
            </button>
          </div>
        </div>`;
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${Components.escapeHtml(e.message)}</div>`;
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  空き時間販売の導線強化ウィジェット
  // ═══════════════════════════════════════════════════════════

  renderTimeSellingBanner() {
    const mpSettings = typeof TimeMarketplace !== 'undefined' ? TimeMarketplace.getSettings() : {};
    const resume = store.get('userResume') || {};
    const hasSkills = (resume.skills || []).length > 0 || (mpSettings.skills || []).length > 0;

    if (mpSettings.enabled) {
      const free = typeof TimeMarketplace !== 'undefined' ? TimeMarketplace.getTotalFreeHours(7) : { totalHours: 0, potentialRevenue: 0 };
      return `<div class="time-selling-banner active">
        <div class="tsb-icon">⏰</div>
        <div class="tsb-content">
          <h4>空き時間販売 稼働中</h4>
          <p>今週の空き：${free.totalHours}時間 ｜ 見込み収入：${free.potentialRevenue.toLocaleString()}円</p>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="app.switchDomain('time')">詳細を見る</button>
      </div>`;
    }

    return `<div class="time-selling-banner">
      <div class="tsb-icon">💡</div>
      <div class="tsb-content">
        <h4>あなたの空き時間が収入に変わります</h4>
        <p>カレンダーの空き時間を自動で計算し、スキルを必要としている方に提供できます。PayPalでお支払いを受け取れます。</p>
      </div>
      <button class="btn btn-sm btn-primary" onclick="app.switchDomain('time');app.navigate('settings')">設定する</button>
    </div>`;
  }
};
