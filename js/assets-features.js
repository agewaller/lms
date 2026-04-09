/* ============================================================
   LMS - Assets Feature Modules
   プラチナNISA シミュレーター / アドバイザー / スクショ読取
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
  //  「何を買えばいいか」アドバイザー
  // ═══════════════════════════════════════════════════════════

  renderAIAdvisor() {
    return `<div class="ai-advisor">
      <h3>「何を買えばいいか」アドバイザー</h3>
      <p>あなたの状況に合わせて、投資の方向性をわかりやすくご提案します。</p>

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
        アドバイスをもらう
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
  //  証券口座スクリーンショット 読み取り
  // ═══════════════════════════════════════════════════════════

  renderScreenshotReader() {
    return `<div class="screenshot-reader">
      <h3>証券口座の画面を読み取り</h3>
      <p>証券会社や銀行のアプリの画面をスクリーンショットで撮影して、アップロードしてください。自動で内容を読み取って分析します。</p>

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
  },

  // ═══════════════════════════════════════════════════════════
  //  自動売買（Auto Trading）
  //  外部リポジトリのコードと連携予定
  // ═══════════════════════════════════════════════════════════

  renderAutoTrading() {
    const settings = this.getAutoTradingSettings();

    return `<div class="auto-trading">
      <h3>自動売買</h3>
      <p>分析結果に基づいて、設定した条件で自動的に売買を実行します。</p>

      ${settings.enabled ? this.renderAutoTradingDashboard(settings) : this.renderAutoTradingSetup(settings)}

      <div class="disclaimer">
        ※ 自動売買は元本を保証するものではありません。投資は自己責任でお願いいたします。
        必ず余裕資金の範囲内で、リスクをご理解の上ご利用ください。
      </div>
    </div>`;
  },

  renderAutoTradingSetup(settings) {
    return `<div class="at-setup">
      <div class="at-status-badge at-inactive">停止中</div>

      <div class="form-group">
        <label>証券会社の接続</label>
        <select id="atBroker" class="form-input">
          <option value="">接続先を選択してください</option>
          <option value="sbi" ${settings.broker === 'sbi' ? 'selected' : ''}>SBI証券</option>
          <option value="rakuten" ${settings.broker === 'rakuten' ? 'selected' : ''}>楽天証券</option>
          <option value="monex" ${settings.broker === 'monex' ? 'selected' : ''}>マネックス証券</option>
          <option value="matsui" ${settings.broker === 'matsui' ? 'selected' : ''}>松井証券</option>
          <option value="au_kabucom" ${settings.broker === 'au_kabucom' ? 'selected' : ''}>auカブコム証券</option>
          <option value="alpaca" ${settings.broker === 'alpaca' ? 'selected' : ''}>Alpaca（米国株）</option>
          <option value="ib" ${settings.broker === 'ib' ? 'selected' : ''}>Interactive Brokers</option>
          <option value="custom" ${settings.broker === 'custom' ? 'selected' : ''}>その他（API設定）</option>
        </select>
      </div>

      <div class="form-group">
        <label>APIキー（証券会社から取得）</label>
        <input type="password" id="atApiKey" class="form-input" value="${settings.apiKey ? '••••••••' : ''}"
          placeholder="証券会社のAPIキーを入力">
        <div class="input-help">APIキーの取得方法は証券会社のサイトをご確認ください</div>
      </div>

      <div class="form-group">
        <label>APIシークレット</label>
        <input type="password" id="atApiSecret" class="form-input" value="${settings.apiSecret ? '••••••••' : ''}"
          placeholder="APIシークレットを入力">
      </div>

      <div class="form-group">
        <label>売買戦略</label>
        <select id="atStrategy" class="form-input">
          <option value="conservative" ${settings.strategy === 'conservative' ? 'selected' : ''}>安全重視（債券中心・リバランスのみ）</option>
          <option value="balanced" ${settings.strategy === 'balanced' ? 'selected' : ''}>バランス型（インデックス積立＋配当再投資）</option>
          <option value="income" ${settings.strategy === 'income' ? 'selected' : ''}>インカム重視（高配当・毎月分配型）</option>
          <option value="growth" ${settings.strategy === 'growth' ? 'selected' : ''}>成長重視（個別株・自動選定）</option>
          <option value="vm" ${settings.strategy === 'vm' ? 'selected' : ''}>VMハンズオン（銘柄分析ベース）</option>
          <option value="custom" ${settings.strategy === 'custom' ? 'selected' : ''}>カスタム（自分でルールを設定）</option>
        </select>
      </div>

      <div class="form-group">
        <label>1回あたりの最大投資額（円）</label>
        <input type="number" id="atMaxAmount" class="form-input" value="${settings.maxAmountPerTrade || 100000}"
          step="10000" min="0">
        <div class="input-help">この金額を超える注文は自動的にブロックされます</div>
      </div>

      <div class="form-group">
        <label>月間の投資上限額（円）</label>
        <input type="number" id="atMonthlyLimit" class="form-input" value="${settings.monthlyLimit || 300000}"
          step="10000" min="0">
      </div>

      <div class="form-group">
        <label>損切りライン（%）</label>
        <select id="atStopLoss" class="form-input">
          <option value="5" ${settings.stopLoss == 5 ? 'selected' : ''}>-5%（慎重）</option>
          <option value="10" ${settings.stopLoss == 10 ? 'selected' : ''}>-10%（標準）</option>
          <option value="15" ${settings.stopLoss == 15 ? 'selected' : ''}>-15%（ゆとり）</option>
          <option value="20" ${settings.stopLoss == 20 ? 'selected' : ''}>-20%（長期視点）</option>
        </select>
        <div class="input-help">この割合以上の含み損が出たら自動で売却します</div>
      </div>

      <div class="form-group">
        <label>実行前に確認する</label>
        <label class="toggle">
          <input type="checkbox" id="atConfirmBefore" ${settings.confirmBefore !== false ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <div class="input-help">オンにすると、売買の前にあなたの承認を求めます（おすすめ）</div>
      </div>

      <button class="btn btn-primary" onclick="AssetsFeatures.saveAutoTradingSettings()">設定を保存</button>
    </div>`;
  },

  renderAutoTradingDashboard(settings) {
    const history = store.get('autoTradeHistory') || [];
    const pending = store.get('autoTradePending') || [];
    const today = history.filter(h => h.timestamp?.startsWith(new Date().toISOString().slice(0, 10)));

    return `<div class="at-dashboard">
      <div class="at-header">
        <div class="at-status-badge at-active">稼働中</div>
        <button class="btn btn-sm btn-danger" onclick="AssetsFeatures.toggleAutoTrading(false)">停止する</button>
      </div>

      <div class="at-stats">
        ${Components.statCard('戦略', this.getStrategyLabel(settings.strategy), null, '📋')}
        ${Components.statCard('今日の取引', today.length + '件', null, '📊')}
        ${Components.statCard('月間投資額', (settings._monthlyUsed || 0).toLocaleString() + '円', null, '💰')}
        ${Components.statCard('月間上限', settings.monthlyLimit?.toLocaleString() + '円', null, '🔒')}
      </div>

      ${pending.length > 0 ? `
      <div class="at-pending">
        <h4>承認待ちの注文（${pending.length}件）</h4>
        ${pending.map((p, i) => `
          <div class="at-order">
            <div class="at-order-info">
              <span class="at-order-type ${p.type}">${p.type === 'buy' ? '買い' : '売り'}</span>
              <strong>${p.ticker || p.name}</strong>
              <span>${p.amount?.toLocaleString()}円</span>
              <span class="at-order-reason">${p.reason || ''}</span>
            </div>
            <div class="at-order-actions">
              <button class="btn btn-sm btn-primary" onclick="AssetsFeatures.approveOrder(${i})">承認</button>
              <button class="btn btn-sm btn-secondary" onclick="AssetsFeatures.rejectOrder(${i})">却下</button>
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="at-history">
        <h4>最近の取引履歴</h4>
        ${history.length === 0 ? '<p>まだ取引はありません</p>' :
          history.slice(-10).reverse().map(h => `
            <div class="at-history-item">
              <span class="at-order-type ${h.type}">${h.type === 'buy' ? '買い' : '売り'}</span>
              <span>${h.ticker || h.name}</span>
              <span>${h.amount?.toLocaleString()}円</span>
              <span class="at-history-time">${new Date(h.timestamp).toLocaleString('ja-JP')}</span>
              <span class="at-history-status ${h.status}">${h.status === 'executed' ? '約定' : h.status === 'rejected' ? '却下' : '保留'}</span>
            </div>
          `).join('')}
      </div>

      <button class="btn btn-secondary" onclick="AssetsFeatures.showAutoTradingSettings()">設定を変更</button>
    </div>`;
  },

  // ─── Settings Management ───

  getAutoTradingSettings() {
    return store.get('autoTradingSettings') || {
      enabled: false,
      broker: '',
      apiKey: '',
      apiSecret: '',
      strategy: 'conservative',
      maxAmountPerTrade: 100000,
      monthlyLimit: 300000,
      stopLoss: 10,
      confirmBefore: true,
      _monthlyUsed: 0
    };
  },

  saveAutoTradingSettings() {
    const settings = {
      enabled: false, // starts disabled, user must explicitly enable
      broker: document.getElementById('atBroker')?.value || '',
      apiKey: document.getElementById('atApiKey')?.value?.includes('•') ? this.getAutoTradingSettings().apiKey : (document.getElementById('atApiKey')?.value || ''),
      apiSecret: document.getElementById('atApiSecret')?.value?.includes('•') ? this.getAutoTradingSettings().apiSecret : (document.getElementById('atApiSecret')?.value || ''),
      strategy: document.getElementById('atStrategy')?.value || 'conservative',
      maxAmountPerTrade: parseInt(document.getElementById('atMaxAmount')?.value) || 100000,
      monthlyLimit: parseInt(document.getElementById('atMonthlyLimit')?.value) || 300000,
      stopLoss: parseInt(document.getElementById('atStopLoss')?.value) || 10,
      confirmBefore: document.getElementById('atConfirmBefore')?.checked !== false,
      _monthlyUsed: this.getAutoTradingSettings()._monthlyUsed || 0
    };

    store.set('autoTradingSettings', settings);

    // Save API keys securely
    if (settings.apiKey && !settings.apiKey.includes('•')) {
      localStorage.setItem('lms_at_apikey', settings.apiKey);
    }
    if (settings.apiSecret && !settings.apiSecret.includes('•')) {
      localStorage.setItem('lms_at_apisecret', settings.apiSecret);
    }

    Components.showToast('自動売買の設定を保存しました', 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  toggleAutoTrading(enabled) {
    const settings = this.getAutoTradingSettings();
    if (enabled && !settings.broker) {
      Components.showToast('まず証券会社を設定してください', 'info');
      return;
    }
    settings.enabled = enabled;
    store.set('autoTradingSettings', settings);
    Components.showToast(enabled ? '自動売買を開始しました' : '自動売買を停止しました', enabled ? 'success' : 'info');
    if (typeof app !== 'undefined') app.renderApp();
  },

  showAutoTradingSettings() {
    const settings = this.getAutoTradingSettings();
    settings.enabled = false; // temporarily show setup form
    store.set('autoTradingSettings', settings);
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── Order Management ───

  approveOrder(index) {
    const pending = store.get('autoTradePending') || [];
    if (!pending[index]) return;

    const order = pending.splice(index, 1)[0];
    order.status = 'executed';
    order.executedAt = new Date().toISOString();

    const history = store.get('autoTradeHistory') || [];
    history.push(order);

    // Update monthly usage
    const settings = this.getAutoTradingSettings();
    settings._monthlyUsed = (settings._monthlyUsed || 0) + (order.amount || 0);

    store.set('autoTradePending', pending);
    store.set('autoTradeHistory', history);
    store.set('autoTradingSettings', settings);

    // TODO: Connect to actual broker API via external repository
    Components.showToast(`${order.ticker || order.name} の注文を承認しました`, 'success');
    if (typeof app !== 'undefined') app.renderApp();
  },

  rejectOrder(index) {
    const pending = store.get('autoTradePending') || [];
    if (!pending[index]) return;

    const order = pending.splice(index, 1)[0];
    order.status = 'rejected';
    order.rejectedAt = new Date().toISOString();

    const history = store.get('autoTradeHistory') || [];
    history.push(order);

    store.set('autoTradePending', pending);
    store.set('autoTradeHistory', history);

    Components.showToast(`${order.ticker || order.name} の注文を却下しました`, 'info');
    if (typeof app !== 'undefined') app.renderApp();
  },

  // ─── AI-driven trade signal (called from analysis) ───

  proposeTrade(signal) {
    const settings = this.getAutoTradingSettings();
    if (!settings.enabled) return;

    // Check limits
    if (signal.amount > settings.maxAmountPerTrade) {
      signal.amount = settings.maxAmountPerTrade;
      signal.reason += '（上限適用）';
    }
    if ((settings._monthlyUsed || 0) + signal.amount > settings.monthlyLimit) {
      Components.showToast('月間投資上限に達しています', 'warning');
      return;
    }

    const order = {
      ...signal,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    if (settings.confirmBefore) {
      // Add to pending for approval
      const pending = store.get('autoTradePending') || [];
      pending.push(order);
      store.set('autoTradePending', pending);
      Components.showToast('新しい注文提案があります。承認してください。', 'info');
    } else {
      // Auto-execute
      order.status = 'executed';
      order.executedAt = new Date().toISOString();
      const history = store.get('autoTradeHistory') || [];
      history.push(order);
      store.set('autoTradeHistory', history);

      settings._monthlyUsed = (settings._monthlyUsed || 0) + order.amount;
      store.set('autoTradingSettings', settings);

      // TODO: Connect to actual broker API
      Components.showToast(`${order.ticker || order.name} を自動売買しました`, 'success');
    }

    if (typeof app !== 'undefined') app.renderApp();
  },

  getStrategyLabel(strategy) {
    const labels = {
      conservative: '安全重視',
      balanced: 'バランス型',
      income: 'インカム重視',
      growth: '成長重視',
      vm: 'VMハンズオン',
      custom: 'カスタム'
    };
    return labels[strategy] || strategy;
  },

  // ═══════════════════════════════════════════════════════════
  //  楽天証券 MS2 RSS + Excel/VBA 連携ダッシュボード
  //  日本株 半自動売買支援システム (Phase 1 / Phase 2 相当)
  //
  //  ※ Web 上は「監視ダッシュボード」として動作するシミュレータ。
  //     実際の発注は Excel/VBA 側から MS2 RSS 経由で行われる。
  //     本UIは ローカル state を CSV/JSON で橋渡しする想定で
  //     設計されている (docs/japanese-stock-trading-system/ 参照)。
  // ═══════════════════════════════════════════════════════════

  renderMS2Trading() {
    const state = this.getMS2State();
    const risk = state.risk;
    const realized = this.computeMS2RealizedPnl();
    const unrealized = this.computeMS2UnrealizedPnl();
    const dailyLoss = Math.max(0, -(realized + unrealized));
    const lossPct = Math.min(100, Math.round((dailyLoss / (risk.maxLossPerDay || 1)) * 100));

    const hbAge = this.computeMS2HeartbeatAge(state);
    const hbOk = hbAge != null && hbAge <= (risk.rssHeartbeatMaxSec || 10);
    const running = state.tradingEnabled && !state.killSwitch && hbOk;
    const statusClass = state.killSwitch ? 'ms2-halted' : running ? 'ms2-running' : 'ms2-stopped';
    const statusLabel = state.killSwitch ? 'HALTED' : running ? 'RUNNING' : 'STOPPED';

    return `<div class="ms2-trading">
      <div class="ms2-header">
        <div>
          <h3>楽天証券 MS2 RSS 日本株トレード</h3>
          <p class="ms2-sub">Marketspeed II RSS × Excel/VBA 連携の監視ダッシュボード</p>
        </div>
        <span class="ms2-mode ms2-mode-${(state.tradingMode || 'paper').toLowerCase()}">${state.tradingMode || 'PAPER'}</span>
      </div>

      <!-- 稼働バー -->
      <div class="ms2-statusbar ${statusClass}">
        <span class="ms2-status-led"></span>
        <strong>${statusLabel}</strong>
        <span class="ms2-status-reason">${state.haltReason ? '停止理由: ' + state.haltReason : hbOk ? 'RSS healthy' : 'RSS stale'}</span>
        <span class="ms2-status-time">最終更新 ${state.lastRssUpdate ? new Date(state.lastRssUpdate).toLocaleTimeString('ja-JP') : '—'}</span>
      </div>

      <!-- KPI カード -->
      <div class="ms2-kpi">
        ${Components.statCard('実現損益(本日)', this.fmtYen(realized), null, '💴')}
        ${Components.statCard('含み損益', this.fmtYen(unrealized), null, '📈')}
        ${Components.statCard('本日発注', (state.todayOrderCount || 0) + ' / ' + (risk.maxOrdersPerDay || 10), null, '📤')}
        ${Components.statCard('同時保有', (state.positions?.length || 0) + ' / ' + (risk.maxConcurrentPositions || 3), null, '🧺')}
        ${Components.statCard('承認待ち', (state.signals?.filter(s => s.state === 'WAIT').length || 0) + ' 件', null, '⏳')}
        ${Components.statCard('エラー(本日)', (state.todayErrorCount || 0) + ' 件', null, '⚠️')}
      </div>

      <!-- 日次損失ゲージ -->
      <div class="ms2-loss-gauge">
        <div class="ms2-loss-label">
          <span>日次損失上限の使用率</span>
          <span>${this.fmtYen(dailyLoss)} / ${this.fmtYen(risk.maxLossPerDay)}</span>
        </div>
        <div class="ms2-loss-track">
          <div class="ms2-loss-fill" style="width:${lossPct}%; background:${lossPct >= 80 ? '#E74C3C' : lossPct >= 50 ? '#F39C12' : '#27AE60'}"></div>
        </div>
        <div class="ms2-loss-sub">${lossPct >= 100 ? '⛔ 上限到達。新規発注は全停止' : lossPct >= 80 ? '⚠️ 80% 到達。残り枠わずか' : '残り ' + this.fmtYen(risk.maxLossPerDay - dailyLoss)}</div>
      </div>

      <!-- 制御ボタン -->
      <div class="ms2-controls">
        <label class="ms2-switch">
          <input type="checkbox" ${state.tradingEnabled ? 'checked' : ''} onchange="AssetsFeatures.toggleMS2Trading(this.checked)">
          <span class="ms2-switch-slider"></span>
          <span>取引ON/OFF</span>
        </label>
        <label class="ms2-switch">
          <input type="checkbox" ${state.approvalRequired !== false ? 'checked' : ''} onchange="AssetsFeatures.toggleMS2Approval(this.checked)">
          <span class="ms2-switch-slider"></span>
          <span>承認必須</span>
        </label>
        <select class="form-input ms2-mode-select" onchange="AssetsFeatures.setMS2Mode(this.value)">
          <option value="PAPER" ${state.tradingMode === 'PAPER' ? 'selected' : ''}>PAPER (模擬)</option>
          <option value="OBSERVE" ${state.tradingMode === 'OBSERVE' ? 'selected' : ''}>OBSERVE (通知のみ)</option>
          <option value="LIVE" ${state.tradingMode === 'LIVE' ? 'selected' : ''}>LIVE (実発注)</option>
        </select>
        <button class="btn btn-sm btn-secondary" onclick="AssetsFeatures.simulateMS2Tick()">⏱ シグナル生成</button>
        <button class="btn btn-sm btn-secondary" onclick="AssetsFeatures.resetMS2Heartbeat()">♻ RSS 再接続</button>
        <button class="btn btn-danger ms2-kill" onclick="AssetsFeatures.ms2KillSwitch()">🛑 緊急停止</button>
        ${state.killSwitch ? `<button class="btn btn-sm btn-primary" onclick="AssetsFeatures.ms2Resume()">停止解除</button>` : ''}
      </div>

      <!-- シグナル承認リスト -->
      <div class="ms2-section">
        <h4>シグナル（承認待ち / 処理済）</h4>
        ${this.renderMS2Signals(state)}
      </div>

      <!-- 建玉管理 -->
      <div class="ms2-section">
        <h4>建玉（現物）</h4>
        ${this.renderMS2Positions(state)}
      </div>

      <!-- リスクパラメータ -->
      <div class="ms2-section">
        <h4>リスクパラメータ</h4>
        <div class="ms2-risk-grid">
          <label>1回最大損失(円)<input type="number" class="form-input" value="${risk.maxLossPerTrade}" onchange="AssetsFeatures.updateMS2Risk('maxLossPerTrade', this.value)"></label>
          <label>1日最大損失(円)<input type="number" class="form-input" value="${risk.maxLossPerDay}" onchange="AssetsFeatures.updateMS2Risk('maxLossPerDay', this.value)"></label>
          <label>1銘柄最大投資(円)<input type="number" class="form-input" value="${risk.maxPositionPerSymbol}" onchange="AssetsFeatures.updateMS2Risk('maxPositionPerSymbol', this.value)"></label>
          <label>同時保有数上限<input type="number" class="form-input" value="${risk.maxConcurrentPositions}" onchange="AssetsFeatures.updateMS2Risk('maxConcurrentPositions', this.value)"></label>
          <label>1日最大発注数<input type="number" class="form-input" value="${risk.maxOrdersPerDay}" onchange="AssetsFeatures.updateMS2Risk('maxOrdersPerDay', this.value)"></label>
          <label>RSS死活TO(秒)<input type="number" class="form-input" value="${risk.rssHeartbeatMaxSec}" onchange="AssetsFeatures.updateMS2Risk('rssHeartbeatMaxSec', this.value)"></label>
          <label>成行許可
            <select class="form-input" onchange="AssetsFeatures.updateMS2Risk('allowedOrderType', this.value)">
              <option value="LIMIT" ${risk.allowedOrderType === 'LIMIT' ? 'selected' : ''}>指値のみ</option>
              <option value="ANY" ${risk.allowedOrderType === 'ANY' ? 'selected' : ''}>指値・成行</option>
            </select>
          </label>
          <label>二重クリック防止(ms)<input type="number" class="form-input" value="${risk.minTickIntervalMs}" onchange="AssetsFeatures.updateMS2Risk('minTickIntervalMs', this.value)"></label>
        </div>
      </div>

      <!-- 最近のログ -->
      <div class="ms2-section">
        <h4>最近のログ (直近 ${(state.logs?.length || 0)} 件)</h4>
        <div class="ms2-log">
          ${(state.logs || []).slice(-15).reverse().map(l => `
            <div class="ms2-log-row ms2-log-${(l.severity || 'info').toLowerCase()}">
              <span class="ms2-log-time">${new Date(l.timestamp).toLocaleTimeString('ja-JP')}</span>
              <span class="ms2-log-kind">${l.kind || ''}</span>
              <span class="ms2-log-text">${l.text || ''}</span>
            </div>`).join('') || '<div class="ms2-empty">ログはまだありません</div>'}
        </div>
      </div>

      <div class="ms2-export">
        <button class="btn btn-sm btn-secondary" onclick="AssetsFeatures.exportMS2State()">状態を JSON で書き出し</button>
        <button class="btn btn-sm btn-secondary" onclick="AssetsFeatures.clearMS2State()">今日の状態をリセット</button>
        <span class="ms2-export-help">設計書: <code>docs/japanese-stock-trading-system/</code></span>
      </div>

      <div class="disclaimer">
        ※ 本 Web UI は楽天証券 MS2 RSS × Excel/VBA の「監視ダッシュボードのミラー」です。
          実際の発注は Excel ブック側で行われ、本 UI は状態の可視化と操作トリガーに徹します。
          PAPER モードでは一切の実発注を行いません。投資は自己責任で行ってください。
      </div>
    </div>`;
  },

  renderMS2Signals(state) {
    const sigs = (state.signals || []).slice(-12).reverse();
    if (!sigs.length) return '<div class="ms2-empty">シグナルはまだありません。「シグナル生成」を押すと PAPER モードで擬似シグナルが生成されます。</div>';

    return `<div class="ms2-table">
      <div class="ms2-thead">
        <span>時刻</span><span>コード</span><span>戦略</span><span>売買</span>
        <span>数量</span><span>参考価格</span><span>損切</span><span>状態</span><span>操作</span>
      </div>
      ${sigs.map(s => `
        <div class="ms2-trow ms2-state-${(s.state || '').toLowerCase()}">
          <span>${new Date(s.timestamp).toLocaleTimeString('ja-JP')}</span>
          <span class="ms2-code">${s.code}</span>
          <span>${s.strategy || '-'}</span>
          <span class="ms2-side-${(s.side || '').toLowerCase()}">${s.side}</span>
          <span>${(s.qty || 0).toLocaleString()}</span>
          <span>${this.fmtYen(s.refPrice)}</span>
          <span>${this.fmtYen(s.stopPrice)}</span>
          <span class="ms2-state-badge">${s.state}${s.reason ? ' (' + s.reason + ')' : ''}</span>
          <span class="ms2-actions">
            ${s.state === 'WAIT' ? `
              <button class="btn btn-xs btn-primary" onclick="AssetsFeatures.ms2Approve('${s.id}')">承認</button>
              <button class="btn btn-xs btn-secondary" onclick="AssetsFeatures.ms2Reject('${s.id}')">却下</button>` : ''}
            ${s.state === 'SENT' || s.state === 'PART' ? `<button class="btn btn-xs btn-secondary" onclick="AssetsFeatures.ms2Cancel('${s.id}')">取消</button>` : ''}
          </span>
        </div>`).join('')}
    </div>`;
  },

  renderMS2Positions(state) {
    const pos = state.positions || [];
    if (!pos.length) return '<div class="ms2-empty">建玉はありません</div>';
    return `<div class="ms2-table">
      <div class="ms2-thead">
        <span>コード</span><span>銘柄名</span><span>数量</span><span>平均取得</span>
        <span>現在値</span><span>評価額</span><span>含み損益</span><span>損切/利確</span><span></span>
      </div>
      ${pos.map(p => {
        const pnl = (p.lastPrice - p.avgPrice) * p.qty;
        const cls = pnl >= 0 ? 'ms2-pnl-plus' : 'ms2-pnl-minus';
        return `<div class="ms2-trow">
          <span class="ms2-code">${p.code}</span>
          <span>${p.name || ''}</span>
          <span>${p.qty.toLocaleString()}</span>
          <span>${this.fmtYen(p.avgPrice)}</span>
          <span>${this.fmtYen(p.lastPrice)}</span>
          <span>${this.fmtYen(p.lastPrice * p.qty)}</span>
          <span class="${cls}">${this.fmtYen(pnl)}</span>
          <span>${this.fmtYen(p.stopPrice)} / ${this.fmtYen(p.takePrice)}</span>
          <span><button class="btn btn-xs btn-secondary" onclick="AssetsFeatures.ms2CloseManual('${p.code}')">手動決済</button></span>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ─── MS2 state management ─────────────────────────────────

  getMS2State() {
    const defaults = {
      tradingEnabled: false,
      killSwitch: false,
      haltReason: '',
      approvalRequired: true,
      tradingMode: 'PAPER',
      lastRssUpdate: Date.now(),
      todayOrderCount: 0,
      todayErrorCount: 0,
      signals: [],
      orders: [],
      positions: [],
      logs: [],
      todayRealizedPnl: 0,
      day: new Date().toISOString().slice(0, 10),
      risk: {
        maxLossPerTrade: 5000,
        maxLossPerDay: 20000,
        maxPositionPerSymbol: 300000,
        maxConcurrentPositions: 3,
        maxOrdersPerDay: 10,
        rssHeartbeatMaxSec: 10,
        allowedOrderType: 'LIMIT',
        minTickIntervalMs: 500
      }
    };
    const saved = store.get('ms2TradingState');
    if (!saved || typeof saved !== 'object') return defaults;
    // Day rollover: reset counters if a new day
    if (saved.day !== defaults.day) {
      return { ...defaults, positions: saved.positions || [], risk: { ...defaults.risk, ...(saved.risk || {}) } };
    }
    return { ...defaults, ...saved, risk: { ...defaults.risk, ...(saved.risk || {}) } };
  },

  saveMS2State(state) {
    store.set('ms2TradingState', state);
  },

  ms2Log(state, kind, text, severity = 'INFO') {
    const logs = state.logs || [];
    logs.push({ timestamp: Date.now(), kind, text, severity });
    state.logs = logs.slice(-200);
    if (severity === 'ERROR' || severity === 'FATAL') state.todayErrorCount = (state.todayErrorCount || 0) + 1;
  },

  computeMS2RealizedPnl() {
    return (this.getMS2State().todayRealizedPnl || 0);
  },

  computeMS2UnrealizedPnl() {
    const st = this.getMS2State();
    return (st.positions || []).reduce((sum, p) => sum + (p.lastPrice - p.avgPrice) * p.qty, 0);
  },

  computeMS2HeartbeatAge(state) {
    if (!state.lastRssUpdate) return null;
    return Math.round((Date.now() - state.lastRssUpdate) / 1000);
  },

  fmtYen(n) {
    if (n == null || isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    return sign + '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP');
  },

  // ─── Controls ─────────────────────────────────────────────

  toggleMS2Trading(on) {
    const st = this.getMS2State();
    if (on && st.killSwitch) {
      Components.showToast('緊急停止中です。先に停止解除してください', 'warning');
      return;
    }
    st.tradingEnabled = !!on;
    this.ms2Log(st, 'SYSTEM', on ? 'TradingEnabled=TRUE' : 'TradingEnabled=FALSE');
    this.saveMS2State(st);
    Components.showToast(on ? '取引を有効化しました' : '取引を無効化しました', 'info');
    if (typeof app !== 'undefined') app.renderApp();
  },

  toggleMS2Approval(on) {
    const st = this.getMS2State();
    st.approvalRequired = !!on;
    this.ms2Log(st, 'SYSTEM', 'ApprovalRequired=' + on);
    this.saveMS2State(st);
  },

  setMS2Mode(mode) {
    const st = this.getMS2State();
    st.tradingMode = mode;
    this.ms2Log(st, 'SYSTEM', 'TradingMode=' + mode);
    if (mode === 'LIVE') {
      Components.showToast('LIVE モードは Excel/VBA 側の実装が必要です', 'warning');
    }
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  },

  resetMS2Heartbeat() {
    const st = this.getMS2State();
    st.lastRssUpdate = Date.now();
    this.ms2Log(st, 'SYSTEM', 'RSS heartbeat reset');
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  },

  ms2KillSwitch() {
    if (!confirm('緊急停止します。よろしいですか？\n(取引 OFF・停止フラグ ON)')) return;
    const st = this.getMS2State();
    st.killSwitch = true;
    st.tradingEnabled = false;
    st.haltReason = 'MANUAL';
    this.ms2Log(st, 'SYSTEM', 'KILLSWITCH activated', 'FATAL');
    this.saveMS2State(st);
    Components.showToast('🛑 緊急停止しました', 'warning');
    if (typeof app !== 'undefined') app.renderApp();
  },

  ms2Resume() {
    if (!confirm('停止状態を解除します。再発防止の確認は済んでいますか？')) return;
    const st = this.getMS2State();
    st.killSwitch = false;
    st.haltReason = '';
    this.ms2Log(st, 'SYSTEM', 'Resumed by user');
    this.saveMS2State(st);
    Components.showToast('停止を解除しました。取引を再開するには ON にしてください', 'info');
    if (typeof app !== 'undefined') app.renderApp();
  },

  updateMS2Risk(key, value) {
    const st = this.getMS2State();
    st.risk[key] = isNaN(value) ? value : Number(value);
    this.ms2Log(st, 'CONFIG', `${key}=${value}`);
    this.saveMS2State(st);
  },

  // ─── Signal / Order simulation (PAPER only) ───────────────

  simulateMS2Tick() {
    const st = this.getMS2State();
    if (st.killSwitch) {
      Components.showToast('緊急停止中。シグナル生成は実行されません', 'warning');
      return;
    }

    // simulate RSS heartbeat
    st.lastRssUpdate = Date.now();

    // pick a random Japanese blue-chip
    const universe = [
      { code: '7203', name: 'トヨタ自動車', px: 2540 },
      { code: '9984', name: 'ソフトバンクG', px: 9800 },
      { code: '6758', name: 'ソニーG',       px: 3250 },
      { code: '8306', name: '三菱UFJ',       px: 1720 },
      { code: '7974', name: '任天堂',         px: 7600 },
      { code: '9432', name: 'NTT',           px: 158  },
      { code: '6861', name: 'キーエンス',     px: 63000 }
    ];
    const u = universe[Math.floor(Math.random() * universe.length)];
    const jitter = (Math.random() - 0.3) * 0.02;          // slightly bullish-biased
    const ref = Math.round(u.px * (1 + jitter));
    const unit = 100;
    let qty = Math.floor((st.risk.maxPositionPerSymbol / ref) / unit) * unit;
    if (qty < unit) qty = unit;
    const stop = Math.round(ref * 0.995);
    const take = Math.round(ref * 1.01);

    const sig = {
      id: 'SIG-' + Date.now().toString(36).toUpperCase(),
      timestamp: Date.now(),
      code: u.code, name: u.name, strategy: 'breakout_v1',
      side: 'BUY', qty, refPrice: ref, stopPrice: stop, takePrice: take,
      reason: '当日高値ブレイク+VWAP上',
      state: 'WAIT'
    };

    // Pre-check (risk)
    const check = this.ms2PreCheck(st, sig);
    if (check !== 'OK') {
      sig.state = 'REJECTED';
      sig.reason = check;
      this.ms2Log(st, 'SIGNAL', `REJECT ${sig.id} ${sig.code} ${check}`, 'WARN');
    } else {
      this.ms2Log(st, 'SIGNAL', `NEW ${sig.id} ${sig.side} ${sig.code} x${qty} @${ref}`);
      // If approval not required and PAPER mode: auto-send
      if (!st.approvalRequired && st.tradingEnabled && st.tradingMode === 'PAPER') {
        this.ms2SendOrder(st, sig);
      }
    }

    st.signals = [...(st.signals || []), sig].slice(-100);
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  },

  ms2PreCheck(st, sig) {
    if (st.killSwitch) return 'NG: KILLSWITCH';
    if (!st.tradingEnabled) return 'NG: TRADING_DISABLED';
    const hbAge = this.computeMS2HeartbeatAge(st);
    if (hbAge == null || hbAge > st.risk.rssHeartbeatMaxSec) return 'NG: RSS_STALE';

    const estLoss = Math.abs(sig.refPrice - sig.stopPrice) * sig.qty;
    if (estLoss > st.risk.maxLossPerTrade) return 'NG: LOSS_PER_TRADE_OVER';

    const posYen = sig.refPrice * sig.qty;
    if (posYen > st.risk.maxPositionPerSymbol) return 'NG: POSITION_PER_SYMBOL_OVER';

    if (sig.side === 'BUY' && (st.positions || []).length >= st.risk.maxConcurrentPositions) {
      return 'NG: CONCURRENT_MAX';
    }

    if ((st.todayOrderCount || 0) >= st.risk.maxOrdersPerDay) return 'NG: DAILY_ORDER_COUNT';

    // Duplicate orders on same symbol
    const dup = (st.signals || []).some(s =>
      s.code === sig.code && (s.state === 'SENT' || s.state === 'PART' || s.state === 'WAIT')
    );
    if (dup) return 'NG: SYMBOL_HAS_OPEN_ORDER';

    // Daily loss gate
    const dailyLoss = Math.max(0, -(this.computeMS2RealizedPnl() + this.computeMS2UnrealizedPnl()));
    if (dailyLoss >= st.risk.maxLossPerDay) return 'NG: DAILY_LOSS_LIMIT';

    return 'OK';
  },

  ms2Approve(sigId) {
    const st = this.getMS2State();
    const sig = (st.signals || []).find(s => s.id === sigId);
    if (!sig || sig.state !== 'WAIT') return;
    if (!st.tradingEnabled) {
      Components.showToast('取引が無効です。取引 ON にしてから承認してください', 'warning');
      return;
    }
    // Double-check at approval time
    const check = this.ms2PreCheck(st, sig);
    if (check !== 'OK') {
      sig.state = 'REJECTED';
      sig.reason = check;
      this.ms2Log(st, 'ORDER', `REJECT ${sig.id} ${check}`, 'WARN');
      this.saveMS2State(st);
      if (typeof app !== 'undefined') app.renderApp();
      return;
    }
    if (!confirm(`本当に発注しますか？\n${sig.side} ${sig.code} x${sig.qty} @${sig.refPrice}`)) return;
    this.ms2SendOrder(st, sig);
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  },

  ms2Reject(sigId) {
    const st = this.getMS2State();
    const sig = (st.signals || []).find(s => s.id === sigId);
    if (!sig) return;
    sig.state = 'REJECTED';
    sig.reason = 'MANUAL';
    this.ms2Log(st, 'SIGNAL', `REJECTED ${sig.id} MANUAL`);
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  },

  ms2Cancel(sigId) {
    const st = this.getMS2State();
    const sig = (st.signals || []).find(s => s.id === sigId);
    if (!sig) return;
    if (sig.state === 'SENT' || sig.state === 'PART') {
      sig.state = 'CANCEL';
      this.ms2Log(st, 'ORDER', `CANCEL ${sig.id}`);
    }
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  },

  ms2SendOrder(st, sig) {
    sig.state = 'SENT';
    sig.sentAt = Date.now();
    st.todayOrderCount = (st.todayOrderCount || 0) + 1;
    this.ms2Log(st, 'ORDER', `SENT ${sig.id} ${sig.code} ${sig.side} x${sig.qty} @${sig.refPrice}`);

    if (st.tradingMode === 'PAPER') {
      // Simulate immediate fill in PAPER mode
      setTimeout(() => this.ms2SimulateFill(sig.id), 300);
    }
  },

  ms2SimulateFill(sigId) {
    const st = this.getMS2State();
    const sig = (st.signals || []).find(s => s.id === sigId);
    if (!sig || sig.state !== 'SENT') return;
    // 90% full fill, 10% rejected
    if (Math.random() < 0.1) {
      sig.state = 'REJECTED';
      sig.reason = 'SIM_ERR';
      this.ms2Log(st, 'ORDER', `REJECT ${sig.id} SIM_ERR`, 'WARN');
      this.saveMS2State(st);
      if (typeof app !== 'undefined') app.renderApp();
      return;
    }
    sig.state = 'FILLED';
    sig.fillPrice = sig.refPrice;
    sig.fillQty = sig.qty;
    this.ms2Log(st, 'FILL', `${sig.id} ${sig.code} x${sig.qty} @${sig.refPrice}`);

    if (sig.side === 'BUY') {
      st.positions = [...(st.positions || []), {
        code: sig.code, name: sig.name,
        qty: sig.qty, avgPrice: sig.refPrice, lastPrice: sig.refPrice,
        stopPrice: sig.stopPrice, takePrice: sig.takePrice,
        openedAt: Date.now(), sourceSignalId: sig.id
      }];
    } else {
      // close matching long
      const pos = (st.positions || []).find(p => p.code === sig.code);
      if (pos) {
        const pnl = (sig.refPrice - pos.avgPrice) * Math.min(pos.qty, sig.qty);
        st.todayRealizedPnl = (st.todayRealizedPnl || 0) + pnl;
        st.positions = (st.positions || []).filter(p => p.code !== sig.code);
      }
    }
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  },

  ms2CloseManual(code) {
    const st = this.getMS2State();
    const pos = (st.positions || []).find(p => p.code === code);
    if (!pos) return;
    if (!confirm(`${code} ${pos.name} を手動決済します。よろしいですか？`)) return;
    const pnl = (pos.lastPrice - pos.avgPrice) * pos.qty;
    st.todayRealizedPnl = (st.todayRealizedPnl || 0) + pnl;
    st.positions = (st.positions || []).filter(p => p.code !== code);
    this.ms2Log(st, 'FILL', `MANUAL_CLOSE ${code} pnl=${Math.round(pnl)}`);
    this.saveMS2State(st);
    Components.showToast(`${code} を決済しました (損益 ${this.fmtYen(pnl)})`, pnl >= 0 ? 'success' : 'info');
    if (typeof app !== 'undefined') app.renderApp();
  },

  exportMS2State() {
    const st = this.getMS2State();
    const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ms2_state_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  clearMS2State() {
    if (!confirm('本日の状態をリセットしますか？(建玉以外)')) return;
    const st = this.getMS2State();
    st.signals = [];
    st.logs = [];
    st.todayOrderCount = 0;
    st.todayErrorCount = 0;
    st.todayRealizedPnl = 0;
    this.saveMS2State(st);
    if (typeof app !== 'undefined') app.renderApp();
  }
};
