/* ============================================================
   LMS - Contribution Feature Modules
   「あなたの経験 × AI = 副業」診断 / 空き時間販売の導線強化
   ============================================================ */
var ContributionFeatures = {

  // ═══════════════════════════════════════════════════════════
  //  「あなたの経験 × AI = 副業」診断
  // ═══════════════════════════════════════════════════════════

  renderSideBizDiagnosis() {
    return `<div class="sidebiz-diagnosis">
      <h3>✨ あなたの経験 × AI = 副業 診断</h3>
      <p>これまでのご経験やお得意なことから、AIがあなたに合った副業や活動を提案します。</p>

      <div class="diagnosis-form">
        <div class="form-group">
          <label>これまでのお仕事やご経験（複数可）</label>
          <textarea id="diagExperience" class="form-input" rows="3"
            placeholder="例：30年間看護師として病院勤務、趣味でパン教室を開いたことがある、英語が少し話せる"></textarea>
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
          <label>AIツールの使用について</label>
          <select id="diagAI" class="form-input">
            <option value="never">まったく使ったことがない</option>
            <option value="beginner" selected>少し興味がある / 使ってみたい</option>
            <option value="some">ChatGPTなどを使ったことがある</option>
            <option value="active">日常的に使っている</option>
          </select>
        </div>
      </div>

      <button class="btn btn-primary btn-lg" onclick="ContributionFeatures.diagnose()">
        🤖 診断する
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
      const result = await AIEngine.analyze('contribution', 'daily', { text: prompt });
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
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
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
      // Already set up - show status
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

    // Not set up - show CTA
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
