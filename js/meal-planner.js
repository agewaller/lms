/* ============================================================
   LMS - Meal Planner
   嗜好と健康状態に基づき、レシピ選定 → 週間献立 → 材料の
   ネット調達 → 一枚紙レシピを一気通貫で提供する。

   - 楽天レシピ / 楽天市場API は admin/secrets の applicationId
     と admin/config の affiliateId / endpoint で動作する。
     endpoint が空 / 'direct' の場合は JSONP で直接呼び出す。
   - レシピ整形・献立組立は AIEngine.analyze('health', ...) を
     使い、Firestore への保存は store.addDomainEntry() に委ねる。
   ============================================================ */
var MealPlanner = {

  // ─── State ───
  state: {
    candidates: [],
    currentPlan: null,
    currentList: null,
    currentSheet: null,
    pdfLoaded: false
  },

  // ─── Default Rakuten recipe categories ───
  // 主要カテゴリのみ。詳細は admin で編集可能にする予定だが、初期値として
  // 和食・洋食・中華を扱う代表的なカテゴリIDを並べる。
  defaultCategoryIds: ['30', '31', '32', '14', '15', '16', '17', '18', '19'],

  // ─── Mock recipes (used when API key not configured) ───
  MOCK_RECIPES: [
    {
      recipe_id: 'mock-1', title: '鶏むね肉のレモン蒸し',
      source: 'mock', source_url: '',
      servings: 2, cook_minutes: 20, calories: 320,
      ingredients: [
        { name: '鶏むね肉', qty: '1', unit: '枚', prep: 'そぎ切り' },
        { name: 'レモン', qty: '1/2', unit: '個', prep: '薄切り' },
        { name: '塩', qty: '小さじ', unit: '1/3' },
        { name: 'オリーブ油', qty: '大さじ', unit: '1' }
      ],
      steps: ['鶏肉に塩をふり、レモンを乗せる', '蒸し器で10分蒸す', '油を回しかけて完成'],
      image_url: '', tags: ['和洋', '高タンパク', '時短']
    },
    {
      recipe_id: 'mock-2', title: '鮭ときのこのホイル焼き',
      source: 'mock', source_url: '',
      servings: 2, cook_minutes: 25, calories: 380,
      ingredients: [
        { name: '生鮭', qty: '2', unit: '切れ' },
        { name: 'しめじ', qty: '1', unit: 'パック' },
        { name: 'バター', qty: '10', unit: 'g' },
        { name: '醤油', qty: '小さじ', unit: '1' }
      ],
      steps: ['ホイルに鮭ときのこを乗せる', 'バターと醤油を加えて包む', 'オーブントースターで15分'],
      image_url: '', tags: ['和食', 'オーブン']
    },
    {
      recipe_id: 'mock-3', title: '豆腐とわかめの味噌汁',
      source: 'mock', source_url: '',
      servings: 2, cook_minutes: 10, calories: 80,
      ingredients: [
        { name: '絹豆腐', qty: '1/2', unit: '丁', prep: 'さいの目' },
        { name: '乾燥わかめ', qty: '小さじ', unit: '1' },
        { name: 'だし', qty: '400', unit: 'ml' },
        { name: '味噌', qty: '大さじ', unit: '1.5' }
      ],
      steps: ['だしを温める', '豆腐とわかめを加える', '火を止めて味噌を溶く'],
      image_url: '', tags: ['和食', '汁物', '時短']
    }
  ],

  // ─── Init ───
  init() {
    // nothing for now; settings come from CONFIG.rakuten populated by FirebaseBackend
  },

  // ─── Connection check ───
  isConfigured() {
    return !!(CONFIG.rakuten && CONFIG.rakuten.applicationId);
  },

  rakutenEndpoint() {
    const ep = CONFIG.rakuten?.endpoint || '';
    if (!ep || ep === 'direct' || ep.includes('your-account')) return null;
    return ep.replace(/\/+$/, '');
  },

  // ─── Rakuten Recipe API: category ranking ───
  // 公式エンドポイント: https://app.rakuten.co.jp/services/api/Recipe/CategoryRanking/20170426
  // JSONP 対応のため direct mode では <script> タグで呼び出す。
  async fetchRecipesByCategory(categoryId, count = 10) {
    if (!this.isConfigured()) {
      Components.showToast('レシピの取り込み元が未設定のため、サンプルから提案します', 'info');
      return this.MOCK_RECIPES.slice(0, count);
    }

    const params = {
      applicationId: CONFIG.rakuten.applicationId,
      categoryId
    };
    if (CONFIG.rakuten.affiliateId) params.affiliateId = CONFIG.rakuten.affiliateId;

    const proxy = this.rakutenEndpoint();
    let raw;
    if (proxy) {
      raw = await this._callViaProxy(proxy + '/recipe/category/ranking', params);
    } else {
      raw = await this._callJsonp('https://app.rakuten.co.jp/services/api/Recipe/CategoryRanking/20170426', params);
    }
    return this._normalizeRakutenRecipes(raw).slice(0, count);
  },

  // ─── Rakuten Ichiba item search ───
  // 公式エンドポイント: https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601
  async searchRakutenItems(keyword, opts = {}) {
    if (!this.isConfigured()) return [];

    const params = {
      applicationId: CONFIG.rakuten.applicationId,
      keyword,
      hits: opts.hits || 5,
      genreId: opts.genreId || '100227' // 食品ジャンル
    };
    if (CONFIG.rakuten.affiliateId) params.affiliateId = CONFIG.rakuten.affiliateId;

    const proxy = this.rakutenEndpoint();
    let raw;
    if (proxy) {
      raw = await this._callViaProxy(proxy + '/ichiba/item/search', params);
    } else {
      raw = await this._callJsonp('https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601', params);
    }
    return (raw?.Items || []).map(x => x.Item).filter(Boolean);
  },

  // ─── Curate candidates with AI ───
  // 候補レシピ + プロファイル + 直近健康データを AI に渡し、相応しいものに絞る。
  async curateCandidates(userCtx) {
    const profile = store.get('userProfile') || {};
    const recentHealth = {
      symptoms: store.getDomainData('health', 'symptoms', 7),
      vitals:   store.getDomainData('health', 'vitals', 7),
      sleep:    store.getDomainData('health', 'sleepData', 7),
      activity: store.getDomainData('health', 'activityData', 7)
    };

    const payload = {
      profile: {
        age: profile.age,
        householdSize: profile.householdSize,
        cuisines: profile.food_cuisines,
        dislikes: profile.food_dislikes,
        restrictions: profile.food_restrictions,
        budget: profile.food_budget,
        maxCookMinutes: profile.food_max_minutes,
        kitchenTools: profile.food_kitchen_tools,
        healthGoal: profile.food_health_goal
      },
      allergies: profile.allergies,
      recentHealth,
      candidates: userCtx.candidates
    };

    const text = await AIEngine.analyze('health', 'menuPlan', { raw: payload });
    return this._parseJsonResponse(text);
  },

  // ─── Build weekly menu (AI) ───
  // curateCandidates と同じプロンプトを使う。返り値は plan オブジェクト。
  async buildWeeklyMenu(candidates, opts = {}) {
    const plan = await this.curateCandidates({ candidates });
    if (!plan || !plan.plan) {
      throw new Error('献立を組み立てられませんでした。もう一度お試しください。');
    }
    plan.week_start_date = plan.week_start_date || this._nextMondayISO();
    plan.generated_by = opts.generatedBy || 'menuPlan';
    return plan;
  },

  // ─── Generate shopping list from a plan ───
  generateShoppingList(plan) {
    const map = new Map();
    const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    days.forEach(d => {
      const day = plan.plan?.[d] || {};
      ['breakfast','lunch','dinner'].forEach(slot => {
        const meal = day[slot];
        if (!meal) return;
        const ings = meal.ingredients || (this._lookupCandidate(meal.recipe_id)?.ingredients) || [];
        ings.forEach(ing => {
          const key = (ing.name || '').trim();
          if (!key) return;
          const cur = map.get(key) || { name: key, qty: 0, unit: ing.unit || '', notes: [] };
          const num = parseFloat(ing.qty);
          cur.qty = isNaN(num) ? cur.qty : (cur.qty + num);
          if (ing.prep) cur.notes.push(ing.prep);
          map.set(key, cur);
        });
      });
    });

    const items = Array.from(map.values()).map(it => ({
      name: it.name,
      qty: it.qty || '',
      unit: it.unit,
      notes: it.notes.join(' / '),
      purchased: false,
      affiliate: { rakuten: '', amazon: '' }
    }));

    return {
      plan_id: plan.id || plan.recipe_id || '',
      items,
      total_budget_est: 0,
      generated_at: new Date().toISOString()
    };
  },

  // ─── Attach affiliate / store search links ───
  async linkToStores(list) {
    const items = await Promise.all((list.items || []).map(async it => {
      const rakutenSearch = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(it.name)}/100227/`;
      const amazonSearch = `https://www.amazon.co.jp/s?k=${encodeURIComponent(it.name)}`;
      return {
        ...it,
        affiliate: {
          rakuten: AffiliateEngine.generateLink('rakuten', rakutenSearch, it.name),
          amazon:  AffiliateEngine.generateLink('amazon_jp', amazonSearch, it.name)
        }
      };
    }));
    return { ...list, items };
  },

  // ─── One-sheet rendering ───
  async renderOneSheet(recipe, opts = {}) {
    let sheet;
    try {
      const text = await AIEngine.analyze('health', 'recipeSheet', { raw: recipe });
      sheet = this._parseJsonResponse(text);
    } catch (e) {
      console.warn('[MealPlanner] recipeSheet AI failed, using raw recipe', e);
    }
    if (!sheet) sheet = this._fallbackSheet(recipe);
    this.state.currentSheet = sheet;

    const ingHtml = (sheet.ingredients_grouped || []).map(g => `
      <div class="recipe-sheet-group">
        <h4>${this._esc(g.group)}</h4>
        <ul>
          ${(g.items || []).map(i => `
            <li><span class="ing-name">${this._esc(i.name)}</span>
            <span class="ing-qty">${this._esc(i.qty || '')}</span>
            ${i.prep ? `<span class="ing-prep">（${this._esc(i.prep)}）</span>` : ''}</li>
          `).join('')}
        </ul>
      </div>
    `).join('');

    const prepHtml = (sheet.prep_steps || []).map(s => `<li>${this._esc(s)}</li>`).join('');

    const cookHtml = (sheet.cook_steps || []).map(st => `
      <li class="cook-step">
        <div class="step-num">${st.n}</div>
        <div class="step-body">
          <p class="step-text">${this._esc(st.text)}</p>
          <div class="step-meta">
            ${st.minutes ? `<span class="step-time">⏱ 約${st.minutes}分</span>` : ''}
            ${st.heat ? `<span class="step-heat">🔥 ${this._esc(st.heat)}</span>` : ''}
            ${st.tip ? `<span class="step-tip">💡 ${this._esc(st.tip)}</span>` : ''}
          </div>
        </div>
      </li>
    `).join('');

    return `<article class="recipe-sheet" id="${opts.id || 'recipeSheet'}">
      <header class="sheet-header">
        <h1>${this._esc(sheet.title || recipe.title)}</h1>
        ${sheet.subtitle ? `<p class="sheet-subtitle">${this._esc(sheet.subtitle)}</p>` : ''}
        <div class="sheet-meta">
          <span>👥 ${sheet.servings || recipe.servings || ''}人分</span>
          <span>⏱ ${sheet.total_minutes || recipe.cook_minutes || ''}分</span>
          ${sheet.tools ? `<span>🍳 ${(sheet.tools || []).join(' / ')}</span>` : ''}
        </div>
      </header>

      <section class="sheet-body">
        <div class="sheet-col sheet-ingredients">
          <h3>材料</h3>
          ${ingHtml || '<p>材料情報なし</p>'}
        </div>
        <div class="sheet-col sheet-steps">
          ${prepHtml ? `<h3>下ごしらえ</h3><ol class="prep-steps">${prepHtml}</ol>` : ''}
          <h3>つくり方</h3>
          <ol class="cook-steps">${cookHtml}</ol>
          ${sheet.finishing ? `<p class="finishing">✨ ${this._esc(sheet.finishing)}</p>` : ''}
        </div>
      </section>

      <footer class="sheet-footer">
        ${sheet.tips?.length ? `<div class="sheet-tips"><strong>コツ</strong> ${sheet.tips.map(t => `・${this._esc(t)}`).join(' ')}</div>` : ''}
        ${sheet.storage ? `<div class="sheet-storage"><strong>保存</strong> ${this._esc(sheet.storage)}</div>` : ''}
        ${recipe.source_url ? `<div class="sheet-source">出典: <a href="${recipe.source_url}" target="_blank" rel="noopener">${this._esc(recipe.source || 'recipe')}</a></div>` : ''}
      </footer>
    </article>`;
  },

  printOneSheet(containerId = 'recipeSheet') {
    const node = document.getElementById(containerId);
    if (!node) { Components.showToast('レシピが見つかりません', 'error'); return; }
    document.body.classList.add('print-recipe-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('print-recipe-mode'), 500);
  },

  async exportPdf(containerId = 'recipeSheet', filename = 'recipe.pdf') {
    const node = document.getElementById(containerId);
    if (!node) { Components.showToast('レシピが見つかりません', 'error'); return; }
    await this._loadPdfLib();
    if (!window.html2pdf) { Components.showToast('PDF生成ライブラリの読み込みに失敗しました', 'error'); return; }
    window.html2pdf().set({
      margin: 10,
      filename,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(node).save();
  },

  // ─── Persistence helpers ───
  saveRecipe(recipe) {
    return store.addDomainEntry('health', 'recipes', this._serializeRecipe(recipe));
  },
  savePlan(plan) {
    const entry = {
      week_start_date: plan.week_start_date,
      plan: JSON.stringify(plan.plan || {}),
      note: plan.rationale || plan.weekly_nutrition_note || '',
      generated_by: plan.generated_by || 'menuPlan'
    };
    const saved = store.addDomainEntry('health', 'mealPlans', entry);
    this.state.currentPlan = { ...plan, id: saved.id };
    return saved;
  },
  saveShoppingList(list) {
    const entry = {
      plan_id: list.plan_id || '',
      items: JSON.stringify(list.items || []),
      total_budget_est: list.total_budget_est || 0,
      generated_at: list.generated_at || new Date().toISOString()
    };
    const saved = store.addDomainEntry('health', 'shoppingLists', entry);
    this.state.currentList = { ...list, id: saved.id };
    return saved;
  },

  // ─── Admin: connection test ───
  async testConnection() {
    if (!this.isConfigured()) return { ok: false, message: '楽天アプリIDが未設定です' };
    try {
      const recs = await this.fetchRecipesByCategory(this.defaultCategoryIds[0], 1);
      return { ok: true, message: `OK（${recs.length}件取得）` };
    } catch (e) {
      return { ok: false, message: e.message || '接続に失敗しました' };
    }
  },

  // ─── Internal: HTTP / JSONP ───
  async _callViaProxy(url, params) {
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const res = await fetch(u.toString());
    if (!res.ok) throw new Error('レシピサーバーに接続できませんでした (' + res.status + ')');
    return await res.json();
  },

  _callJsonp(url, params) {
    return new Promise((resolve, reject) => {
      const cbName = 'lms_rakuten_cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const u = new URL(url);
      Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
      u.searchParams.set('callback', cbName);

      const script = document.createElement('script');
      const cleanup = () => {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('レシピの取り込みがタイムアウトしました')); }, 15000);

      window[cbName] = (data) => { clearTimeout(timer); cleanup(); resolve(data); };
      script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('レシピの取り込みに失敗しました')); };

      script.src = u.toString();
      document.head.appendChild(script);
    });
  },

  _normalizeRakutenRecipes(raw) {
    const list = raw?.result || [];
    return list.map(r => ({
      recipe_id: String(r.recipeId),
      title: r.recipeTitle,
      source: 'rakuten',
      source_url: r.recipeUrl,
      servings: r.recipeIndication ? parseInt(String(r.recipeIndication).match(/\d+/)?.[0] || '2') : 2,
      cook_minutes: this._parseCookMinutes(r.recipeIndication),
      calories: 0,
      ingredients: (r.recipeMaterial || []).map(name => ({ name, qty: '', unit: '' })),
      steps: r.recipeDescription ? [r.recipeDescription] : [],
      image_url: r.foodImageUrl || r.mediumImageUrl || '',
      tags: [r.recipeCategoryName].filter(Boolean)
    }));
  },

  _parseCookMinutes(text) {
    if (!text) return 0;
    const m = String(text).match(/(\d+)\s*分/);
    return m ? parseInt(m[1]) : 0;
  },

  _serializeRecipe(r) {
    return {
      recipe_id: r.recipe_id,
      title: r.title,
      source: r.source,
      source_url: r.source_url,
      servings: r.servings,
      cook_minutes: r.cook_minutes,
      calories: r.calories,
      ingredients: JSON.stringify(r.ingredients || []),
      steps: JSON.stringify(r.steps || []),
      image_url: r.image_url,
      tags: (r.tags || []).join(','),
      rating: r.rating || 0
    };
  },

  _lookupCandidate(recipeId) {
    return (this.state.candidates || []).find(c => String(c.recipe_id) === String(recipeId));
  },

  _parseJsonResponse(text) {
    if (!text) return null;
    // モデルが ```json ... ``` で囲んだ場合に備えて剥がす
    const m = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = m ? m[1] : text;
    try { return JSON.parse(body.trim()); }
    catch (e) {
      // 前後に説明文があるケース：最初の { から最後の } までを抜き出す
      const start = body.indexOf('{');
      const end = body.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { return JSON.parse(body.slice(start, end + 1)); } catch (_) { /* fallthrough */ }
      }
      console.warn('[MealPlanner] JSON parse failed', e, text);
      return null;
    }
  },

  _fallbackSheet(recipe) {
    return {
      title: recipe.title,
      subtitle: '',
      servings: recipe.servings,
      total_minutes: recipe.cook_minutes,
      tools: [],
      ingredients_grouped: [{
        group: '材料',
        items: (recipe.ingredients || []).map(i => ({ name: i.name, qty: [i.qty, i.unit].filter(Boolean).join(' '), prep: i.prep || '' }))
      }],
      prep_steps: [],
      cook_steps: (recipe.steps || []).map((s, i) => ({ n: i + 1, text: s, minutes: 0, heat: '', tip: '' })),
      finishing: '',
      tips: [],
      storage: ''
    };
  },

  _nextMondayISO() {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  },

  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  async _loadPdfLib() {
    if (window.html2pdf || this.state.pdfLoaded) { this.state.pdfLoaded = true; return; }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    this.state.pdfLoaded = true;
  }
};

if (typeof window !== 'undefined') window.MealPlanner = MealPlanner;
