/* ============================================================
   LMS - Assets Feature Modules
   プラチナNISA シミュレーター / AIアドバイザー / スクショ読取
   ============================================================ */
var AssetsFeatures = {

  // ═══════════════════════════════════════════════════════════
  //  プラチナNISA シミュレーター
  // ═══════════════════════════════════════════════════════════

  renderNISASimulator() {
    return `<div class="nisa-simulator">
      <h3>💴 プラチナNISAシミュレーター</h3>
      <p>65歳以上の方が毎月分配型で受け取れる収入を試算します。</p>

      <div class="sim-inputs">
        <div class="form-group">
          <label>投資に回せる金額（万円）</label>
          <input type="number" id="nisaAmount" class="form-input" value="500" step="10" min="0"
            oninput="AssetsFeatures.calculateNISA()">
          <div class="input-help">現在の貯金の一部を投資に回すイメージです</div>
        </div>

        <div class="form-group">
          <label>想定利回り（年率 %）</label>
          <select id="nisaYield" class="form-input" onchange="AssetsFeatures.calculateNISA()">
            <option value="2">2%（国債・安定型）</option>
            <option value="3" selected>3%（バランス型）</option>
            <option value="4">4%（やや積極型）</option>
            <option value="5">5%（積極型）</option>
          </select>
          <div class="input-help">高い利回りはリターンも大きいですがリスクも大きくなります</div>
        </div>

        <div class="form-group">
          <label>受取期間（年）</label>
          <select id="nisaYears" class="form-input" onchange="AssetsFeatures.calculateNISA()">
            <option value="10">10年</option>
            <option value="15">15年</option>
            <option value="20" selected>20年</option>
            <option value="25">25年</option>
            <option value="30">30年</option>
          </select>
        </div>
      </div>

      <div class="sim-result" id="nisaResult">
        <div class="sim-loading">数値を入力すると自動で計算します</div>
      </div>

      <div class="disclaimer">${i18n.t('disclaimer_assets')}</div>
    </div>`;
  },

  calculateNISA() {
    const amount = parseFloat(document.getElementById('nisaAmount')?.value || 0) * 10000; // 万円→円
    const yieldRate = parseFloat(document.getElementById('nisaYield')?.value || 3) / 100;
    const years = parseInt(document.getElementById('nisaYears')?.value || 20);
    const resultEl = document.getElementById('nisaResult');
    if (!resultEl || amount <= 0) return;

    const months = years * 12;
    // 毎月分配型: 元本を取り崩しながら利回りを受け取る（年金型）
    // PMT = PV * r / (1 - (1+r)^-n) where r = monthly rate
    const r = yieldRate / 12;
    const monthlyIncome = r > 0 ?
      Math.round(amount * r / (1 - Math.pow(1 + r, -months))) :
      Math.round(amount / months);

    const totalReceived = monthlyIncome * months;
    const totalProfit = totalReceived - amount;

    // 税金なし（NISA非課税）の場合
    const taxSaved = Math.round(totalProfit * 0.20315); // 通常なら20.315%課税

    resultEl.innerHTML = `
      <div class="sim-cards">
        <div class="sim-card sim-card-main">
          <div class="sim-card-label">毎月の受取額</div>
          <div class="sim-card-value">約 ${monthlyIncome.toLocaleString()}円</div>
          <div class="sim-card-sub">年金にプラスして受け取れます</div>
        </div>
        <div class="sim-card">
          <div class="sim-card-label">投資額</div>
          <div class="sim-card-value">${(amount / 10000).toLocaleString()}万円</div>
        </div>
        <div class="sim-card">
          <div class="sim-card-label">${years}年間の受取総額</div>
          <div class="sim-card-value">${Math.round(totalReceived / 10000).toLocaleString()}万円</div>
        </div>
        <div class="sim-card">
          <div class="sim-card-label">運用益（非課税）</div>
          <div class="sim-card-value" style="color:var(--success)">+${Math.round(totalProfit / 10000).toLocaleString()}万円</div>
        </div>
        <div class="sim-card">
          <div class="sim-card-label">NISA非課税で節約できる税金</div>
          <div class="sim-card-value" style="color:var(--primary)">約${Math.round(taxSaved / 10000).toLocaleString()}万円</div>
        </div>
      </div>
      <div class="sim-note">
        ※ 上記はシミュレーションであり、実際の運用結果を保証するものではありません。
        投資信託は値動きがあり、元本が減る可能性があります。
      </div>`;
  },

  // ═══════════════════════════════════════════════════════════
  //  「何を買えばいいか」AIアドバイザー
  // ═══════════════════════════════════════════════════════════

  renderAIAdvisor() {
    return `<div class="ai-advisor">
      <h3>🤖 「何を買えばいいか」AIアドバイザー</h3>
      <p>あなたの状況に合わせて、投資の方向性をAIがわかりやすくご提案します。</p>

      <div class="advisor-questions">
        <div class="form-group">
          <label>現在の貯蓄額（だいたいで結構です）</label>
          <select id="advSavings" class="form-input">
            <option value="under500">500万円未満</option>
            <option value="500to1000">500万〜1,000万円</option>
            <option value="1000to3000">1,000万〜3,000万円</option>
            <option value="3000to5000">3,000万〜5,000万円</option>
            <option value="over5000">5,000万円以上</option>
          </select>
        </div>

        <div class="form-group">
          <label>毎月の年金受給額（だいたいで結構です）</label>
          <select id="advPension" class="form-input">
            <option value="under10">10万円未満</option>
            <option value="10to15">10万〜15万円</option>
            <option value="15to20" selected>15万〜20万円</option>
            <option value="20to25">20万〜25万円</option>
            <option value="over25">25万円以上</option>
          </select>
        </div>

        <div class="form-group">
          <label>毎月の生活費（だいたいで結構です）</label>
          <select id="advExpenses" class="form-input">
            <option value="under15">15万円未満</option>
            <option value="15to20" selected>15万〜20万円</option>
            <option value="20to25">20万〜25万円</option>
            <option value="25to30">25万〜30万円</option>
            <option value="over30">30万円以上</option>
          </select>
        </div>

        <div class="form-group">
          <label>投資のご経験は？</label>
          <select id="advExperience" class="form-input">
            <option value="none" selected>まったくない</option>
            <option value="little">少しだけある（銀行の投資信託など）</option>
            <option value="some">ある程度ある（株や投信の売買経験）</option>
            <option value="experienced">豊富にある</option>
          </select>
        </div>

        <div class="form-group">
          <label>投資で一番大切にしたいことは？</label>
          <select id="advGoal" class="form-input">
            <option value="safety" selected>元本をできるだけ減らしたくない（安全重視）</option>
            <option value="income">毎月の収入を少しでも増やしたい（収入重視）</option>
            <option value="growth">長い目で資産を増やしたい（成長重視）</option>
            <option value="balance">バランスよくしたい</option>
          </select>
        </div>

        <div class="form-group">
          <label>ご心配なことや、ご質問があれば（任意）</label>
          <textarea id="advNotes" class="form-input" rows="3" placeholder="例：老後の医療費が心配です / 子供に資産を残したい / NISAの使い方がわからない"></textarea>
        </div>
      </div>

      <button class="btn btn-primary btn-lg" onclick="AssetsFeatures.getAIAdvice()">
        🤖 AIにアドバイスをもらう
      </button>

      <div id="advisorResult"></div>
    </div>`;
  },

  async getAIAdvice() {
    const savings = document.getElementById('advSavings')?.value;
    const pension = document.getElementById('advPension')?.value;
    const expenses = document.getElementById('advExpenses')?.value;
    const experience = document.getElementById('advExperience')?.value;
    const goal = document.getElementById('advGoal')?.value;
    const notes = document.getElementById('advNotes')?.value || '';
    const resultEl = document.getElementById('advisorResult');

    if (resultEl) resultEl.innerHTML = Components.loading('あなたに合ったアドバイスを作成中...');

    const userInfo = `65歳女性のユーザーからの投資相談です。
・貯蓄: ${savings}
・毎月の年金: ${pension}
・毎月の生活費: ${expenses}
・投資経験: ${experience}
・投資目的: ${goal}
・その他ご相談: ${notes}

2026年のプラチナNISA（65歳以上向け、毎月分配型解禁）を踏まえて、以下を提案してください：
1. この方に合った投資の基本方針（わかりやすく）
2. おすすめの資産配分（例：預金60%、債券投信20%、株式投信20%など）
3. 具体的な商品カテゴリ（投資信託の種類など、銘柄名は不要）
4. プラチナNISAの活用方法
5. 気をつけるべきリスク
6. まず最初にやるべき一歩（具体的に）

難しい用語には必ず説明を添えて、やさしい言葉で伝えてください。`;

    try {
      const result = await AIEngine.analyze('assets', 'daily', { text: userInfo });
      if (resultEl) {
        resultEl.innerHTML = `<div class="advisor-result">
          <h3>あなたへのアドバイス</h3>
          <div class="analysis-content">${Components.formatMarkdown(result)}</div>
          <div class="disclaimer">${i18n.t('disclaimer_assets')}</div>
        </div>`;
      }
    } catch (e) {
      if (resultEl) resultEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  証券口座スクリーンショット AI読み取り
  // ═══════════════════════════════════════════════════════════

  renderScreenshotReader() {
    return `<div class="screenshot-reader">
      <h3>📸 証券口座の画面を読み取り</h3>
      <p>証券会社や銀行のアプリの画面をスクリーンショットで撮影して、アップロードしてください。AIが内容を読み取って分析します。</p>

      <div class="screenshot-upload-area" id="screenshotArea"
        ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="AssetsFeatures.handleScreenshotDrop(event)">
        <div class="upload-icon">📷</div>
        <p>ここに画像をドラッグ＆ドロップ</p>
        <p>または</p>
        <input type="file" id="screenshotFile" accept="image/*" style="display:none"
          onchange="AssetsFeatures.handleScreenshotUpload(event)">
        <button class="btn btn-secondary" onclick="document.getElementById('screenshotFile').click()">
          画像ファイルを選択
        </button>
      </div>

      <div id="screenshotPreview"></div>
      <div id="screenshotResult"></div>
    </div>`;
  },

  handleScreenshotDrop(event) {
    event.preventDefault();
    document.getElementById('screenshotArea')?.classList.remove('dragover');
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      this.processScreenshot(file);
    }
  },

  handleScreenshotUpload(event) {
    const file = event.target.files[0];
    if (file) this.processScreenshot(file);
  },

  async processScreenshot(file) {
    const previewEl = document.getElementById('screenshotPreview');
    const resultEl = document.getElementById('screenshotResult');

    // Show preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;

      if (previewEl) {
        previewEl.innerHTML = `<div class="screenshot-preview">
          <img src="${dataUrl}" alt="証券口座のスクリーンショット" style="max-width:100%;border-radius:8px;margin:16px 0;">
        </div>`;
      }

      if (resultEl) resultEl.innerHTML = Components.loading('画面の内容を読み取り中...');

      // Save to store
      store.addDomainEntry('assets', 'overview', {
        type: 'screenshot',
        filename: file.name,
        data: dataUrl
      });

      try {
        const result = await AIEngine.analyze('assets', 'daily', {
          text: `ユーザーが証券口座または銀行のアプリの画面キャプチャをアップロードしました。
画像の内容を読み取り、以下を分析してください：
1. 表示されている資産の種類と金額
2. ポートフォリオの構成（何にいくら投資しているか）
3. 損益の状況
4. 改善の提案（分散投資、リバランスなど）
5. 注意すべき点

65歳女性のユーザーにわかりやすい言葉で説明してください。
※画像の内容をテキストとして読み取れない場合は、ユーザーに手入力をお願いしてください。`
        });

        if (resultEl) {
          resultEl.innerHTML = `<div class="screenshot-result">
            <h3>読み取り結果</h3>
            <div class="analysis-content">${Components.formatMarkdown(result)}</div>
            <div class="disclaimer">${i18n.t('disclaimer_assets')}</div>
          </div>`;
        }
      } catch (e) {
        if (resultEl) resultEl.innerHTML = `<div class="error-msg">${e.message}</div>`;
      }
    };
    reader.readAsDataURL(file);
  }
};
