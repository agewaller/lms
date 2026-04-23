/* ============================================================
   LMS - ZenTrack Module (禅トラック システムモジュール)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   禅トラックは「1日の文字起こし」を多次元で分析し、人生の6ドメイン
   （意識・健康・時間・仕事・関係・資産）にデータを分配するシステム。

   ┌─────────────────────────────────────────────────────────┐
   │  入力: Plaud / Otter / Limitless / Bee / Whisper / 手入力  │
   │    ↓                                                     │
   │  正規化 → consciousness_transcript として保存              │
   │    ↓                                                     │
   │  AIEngine.analyze('consciousness','transcript_analysis')  │
   │  = 禅トラック日次内省プロンプト                              │
   │    ↓                                                     │
   │  AI出力: フル版（人間向け）+ JSON版（DB格納用）              │
   │    ↓                                                     │
   │  ZenTrack.parseResponse() → 構造化データ                   │
   │    ↓                                                     │
   │  ZenTrack.saveObservation() → consciousness_observation    │
   │  ZenTrack.routeCrossDomain() → health / time / work / etc  │
   │    ↓                                                     │
   │  時系列グラフ (Pages.initConsciousnessTrendChart) が更新     │
   │  ZenTrack.renderLatestReport() で構造化レポート表示          │
   └─────────────────────────────────────────────────────────┘

   JSON版 最上位キー (AIプロンプト仕様):
     meta, summary, details, actions, people, context,
     conscious_focus, calories, signals, raw_bullets

   ============================================================ */

var ZenTrack = {

  // ═══════════════════════════════════════════════════════════
  //  Schema: 七つの意識レイヤー (定数)
  // ═══════════════════════════════════════════════════════════
  LAYER_KEYS: ['1', '2', '3', '3.5', '4', '5', '6', '7'],
  STORE_KEY: (k) => (k === '3.5' ? 'layer_35' : 'layer_' + k),

  // ═══════════════════════════════════════════════════════════
  //  Schema: 状況 / 空間 (推定ラベル)
  // ═══════════════════════════════════════════════════════════
  SITUATIONS: [
    { id: 'alone',        label: '一人',       icon: '🧍' },
    { id: 'conversation', label: '会話',       icon: '💬', subs: ['対面', '電話', 'オンライン'] },
    { id: 'moving',       label: '移動',       icon: '🚶', subs: ['徒歩', '車', '電車', '自転車'] },
    { id: 'eating',       label: '食事',       icon: '🍽️', subs: ['飲料含む'] },
    { id: 'exercise',     label: '運動',       icon: '🏃', subs: ['有酸素', '筋トレ', 'ストレッチ'] },
    { id: 'work',         label: '作業',       icon: '💻', subs: ['思索', '制作', '執筆', '設計', '分析'] },
    { id: 'rest',         label: '休息',       icon: '😴', subs: ['睡眠', '仮眠', '目休め', '瞑想'] },
    { id: 'life',         label: '生活行為',   icon: '🏠', subs: ['家事', '買い物', '身支度'] },
    { id: 'coordination', label: '調整',       icon: '📋', subs: ['連絡', '段取り', '設定'] }
  ],

  SPACES: [
    { id: 'home',         label: '家',         icon: '🏠' },
    { id: 'office',       label: 'オフィス',   icon: '🏢' },
    { id: 'meeting_room', label: '会議室',     icon: '📊' },
    { id: 'dining',       label: '食事空間',   icon: '🍴', subs: ['レストラン', 'カフェ', '自宅食卓'] },
    { id: 'outside',      label: '外',         icon: '🌳', subs: ['屋外', '移動中', '駅', '車内'] },
    { id: 'third_place',  label: '第三の場所', icon: '📚', subs: ['コワーキング', '図書館', 'ホテル', '待合'] }
  ],

  // ═══════════════════════════════════════════════════════════
  //  Schema: 時間の使い方カテゴリ
  // ═══════════════════════════════════════════════════════════
  TIME_CATEGORIES: [
    { id: 'value_creation', label: '価値創造', color: '#27AE60' },
    { id: 'foundation',     label: '基盤づくり', color: '#2980B9' },
    { id: 'maintenance',    label: '維持',     color: '#F39C12' },
    { id: 'waste',          label: '浪費',     color: '#E74C3C' }
  ],

  // ═══════════════════════════════════════════════════════════
  //  Parser: AI応答 → 構造化データ
  //
  //  禅トラックAI出力は「フル版（箇条書き）+ JSON版」の二重構造。
  //  JSON版を抽出・パースし、足りないフィールドはデフォルト補完。
  // ═══════════════════════════════════════════════════════════
  parseResponse(aiResponse) {
    if (!aiResponse) return null;

    // Extract JSON block from the response
    const json = this._extractJson(aiResponse);
    if (!json) return null;

    // Normalize into canonical ZenTrack observation
    return {
      // ─── meta ───
      meta: json.meta || { date: new Date().toISOString().slice(0, 10) },

      // ─── summary ───
      summary: this._normalizeSummary(json.summary),

      // ─── details (6-domain breakdown) ───
      details: {
        health:       json.details?.health || null,
        time:         json.details?.time || json.details?.time_usage || null,
        work:         json.details?.work || null,
        trust:        json.details?.trust || json.details?.credit || null,
        assets:       json.details?.assets || null,
        consciousness: json.details?.consciousness || null
      },

      // ─── actions (明日の行動 最大2件) ───
      actions: this._normalizeActions(json.actions),

      // ─── people (登場人物) ───
      people: this._normalizePeople(json.people),

      // ─── context (状況 × 空間 の時系列) ───
      context: this._normalizeContext(json.context),

      // ─── conscious_focus (七つのレイヤー + 信号) ───
      consciousFocus: this._normalizeConscious(json.conscious_focus),

      // ─── calories (カロリー推定) ───
      calories: this._normalizeCalories(json.calories),

      // ─── signals (欲・徳・エネルギー) ───
      signals: {
        desire_count:  json.signals?.desire_count ?? 0,
        virtue_count:  json.signals?.virtue_count ?? 0,
        energy_count:  json.signals?.energy_count ?? 0
      },

      // ─── domainScores (5ドメイン 0-5 スコア) ───
      domainScores: this._normalizeDomainScores(json),

      // ─── timeUsage (4カテゴリ %) ───
      timeUsage: this._normalizeTimeUsage(json),

      // ─── raw_bullets (フル版の箇条書き保存) ───
      rawBullets: Array.isArray(json.raw_bullets) ? json.raw_bullets : [],

      // ─── raw JSON (preserve) ───
      _raw: json
    };
  },

  _extractJson(text) {
    if (!text) return null;
    // Strategy 1: find ```json ... ``` block
    const fenced = text.match(/```json\s*([\s\S]*?)```/);
    if (fenced) {
      try { return JSON.parse(fenced[1].trim()); } catch (_) {}
    }
    // Strategy 2: find the outermost { ... } containing "conscious_focus"
    const braceMatch = text.match(/\{[\s\S]*"conscious_focus"[\s\S]*\}/);
    if (braceMatch) {
      try { return JSON.parse(braceMatch[0]); } catch (_) {}
      // Try fixing common issues (trailing commas, etc)
      try {
        const cleaned = braceMatch[0]
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"');
        return JSON.parse(cleaned);
      } catch (_) {}
    }
    // Strategy 3: any { ... } with "summary"
    const fallback = text.match(/\{[\s\S]*"summary"[\s\S]*\}/);
    if (fallback) {
      try { return JSON.parse(fallback[0]); } catch (_) {}
    }
    return null;
  },

  _normalizeSummary(s) {
    if (!s) return { net_value: { value: 0, label: '' }, headline: '' };
    return {
      net_value: {
        value: s.net_value?.value ?? s.net_value ?? 0,
        label: s.net_value?.label || ''
      },
      headline: s.headline || s.evaluation || s.overview || '',
      time_quality: s.time_quality || null,
      health_score: s.health_score || null
    };
  },

  _normalizeActions(a) {
    if (!a) return [];
    const arr = Array.isArray(a) ? a : (a.items || a.tomorrow || []);
    return arr.slice(0, 5).map(item => {
      if (typeof item === 'string') return { text: item, domain: null };
      return {
        text: item.text || item.action || item.description || String(item),
        domain: item.domain || null,
        priority: item.priority || null
      };
    });
  },

  _normalizePeople(p) {
    if (!p) return [];
    const arr = Array.isArray(p) ? p : (p.people || p.persons || []);
    return arr.map(person => ({
      name: person.name || person.label || '不明',
      role: person.role || person.relation || '',
      weight: person.weight || person.focus || null,
      sentiment: person.sentiment || null,
      notes: person.notes || person.observation || ''
    }));
  },

  _normalizeContext(c) {
    if (!c) return [];
    const arr = Array.isArray(c) ? c : (c.events || c.timeline || c.episodes || []);
    return arr.map(item => ({
      time: item.time || item.start || '',
      situation: item.situation || item.activity || '',
      space: item.space || item.location || item.place || '',
      description: item.description || item.detail || item.summary || ''
    }));
  },

  _normalizeConscious(cf) {
    if (!cf) return { dimsPct: {}, dominant: null };
    const pct = cf.dims_pct || cf.layers || cf.pct || {};
    // Find dominant layer
    let maxKey = null, maxVal = -1;
    this.LAYER_KEYS.forEach(k => {
      const v = pct[k] || 0;
      if (v > maxVal) { maxVal = v; maxKey = k; }
    });
    return {
      dimsPct: pct,
      dominant: maxKey,
      dominantPct: maxVal,
      dominantLabel: maxKey ? (CONFIG.domains.consciousness.layers[maxKey]?.name || '') : ''
    };
  },

  _normalizeCalories(cal) {
    if (!cal) return null;
    return {
      intake:     cal.intake || cal.consumed || null,
      burned:     cal.burned || cal.expenditure || cal.consumed_out || null,
      balance:    cal.balance || cal.net || null,
      bmr:        cal.bmr || cal.basal || null,
      note:       cal.note || cal.estimation_note || '推定誤差±20〜30%'
    };
  },

  _normalizeDomainScores(json) {
    const s = json.summary || {};
    const d = json.details || {};
    const scores = s.domain_scores || s.scores || json.domain_scores || {};
    const clamp = (v) => v == null ? null : Math.max(0, Math.min(5, Number(v) || 0));
    return {
      health: clamp(scores.health ?? s.health_score ?? null),
      time:   clamp(scores.time ?? s.time_quality ?? s.time_score ?? null),
      work:   clamp(scores.work ?? s.work_score ?? null),
      trust:  clamp(scores.trust ?? scores.credit ?? s.trust_score ?? null),
      assets: clamp(scores.assets ?? s.assets_score ?? null)
    };
  },

  _normalizeTimeUsage(json) {
    const t = json.details?.time || json.details?.time_usage || json.time_usage || {};
    if (typeof t === 'string') return null;
    const val = (v) => (typeof v === 'number' ? v : null);
    const vc = val(t.value_creation ?? t.kachi ?? t.creation);
    const fd = val(t.foundation ?? t.kiban ?? t.building);
    const mt = val(t.maintenance ?? t.iji ?? t.maint);
    const ws = val(t.waste ?? t.rouhi ?? t.loss);
    if (vc == null && fd == null && mt == null && ws == null) return null;
    return {
      value_creation: vc || 0,
      foundation: fd || 0,
      maintenance: mt || 0,
      waste: ws || 0
    };
  },

  // ═══════════════════════════════════════════════════════════
  //  Save: 構造化データ → Store 各ドメインに分配
  // ═══════════════════════════════════════════════════════════

  saveObservation(parsed) {
    if (!parsed) return null;
    const cf = parsed.consciousFocus;
    const sig = parsed.signals;
    const nv = parsed.summary?.net_value?.value || 0;
    const date = parsed.meta?.date || new Date().toISOString().slice(0, 10);

    const ds = parsed.domainScores || {};
    const tu = parsed.timeUsage || {};

    const obs = store.addDomainEntry('consciousness', 'observation', {
      // Layer percentages
      layer_1:  cf.dimsPct['1'] || 0,
      layer_2:  cf.dimsPct['2'] || 0,
      layer_3:  cf.dimsPct['3'] || 0,
      layer_35: cf.dimsPct['3.5'] || 0,
      layer_4:  cf.dimsPct['4'] || 0,
      layer_5:  cf.dimsPct['5'] || 0,
      layer_6:  cf.dimsPct['6'] || 0,
      layer_7:  cf.dimsPct['7'] || 0,
      // Signals
      desire_count: sig.desire_count,
      virtue_count: sig.virtue_count,
      energy_count: sig.energy_count,
      net_value: nv,
      // Domain scores (0-5 scale)
      score_health: ds.health,
      score_time:   ds.time,
      score_work:   ds.work,
      score_trust:  ds.trust,
      score_assets: ds.assets,
      // Time usage (%)
      time_value_creation: tu.value_creation ?? null,
      time_foundation:     tu.foundation ?? null,
      time_maintenance:    tu.maintenance ?? null,
      time_waste:          tu.waste ?? null,
      // Metadata
      dominant_layer: cf.dominant,
      date,
      auto_generated: true,
      source: 'zentrack',
      _zentrack: {
        summary: parsed.summary,
        actions: parsed.actions,
        people: parsed.people,
        context: parsed.context,
        calories: parsed.calories,
        details: parsed.details
      }
    });

    // Cross-domain routing
    this.routeCrossDomain(parsed, date);

    // Persist the latest full report for rendering
    store.set('latestZenTrackReport', {
      ...parsed,
      observationId: obs.id,
      savedAt: new Date().toISOString()
    });

    return obs;
  },

  // ─── Cross-domain data routing ───
  // 禅トラックは意識ドメインのプロンプトだが、出力は6ドメインに跨る。
  // 他ドメインに関連する分析結果を各 domain store に書き出す。
  routeCrossDomain(parsed, date) {
    if (!parsed) return;

    // Health: カロリー + 状況から推定される活動
    if (parsed.calories) {
      const cal = parsed.calories;
      if (cal.intake || cal.burned) {
        store.addDomainEntry('health', 'meals', {
          source: 'zentrack',
          calories_intake: cal.intake,
          calories_burned: cal.burned,
          calories_balance: cal.balance,
          bmr: cal.bmr,
          note: cal.note,
          date
        });
      }
    }

    // Health: 心身レイヤー(3.5)が高い → 身体データの示唆
    const layer35 = parsed.consciousFocus?.dimsPct?.['3.5'] || 0;
    if (layer35 >= 20 && parsed.details?.health) {
      store.addDomainEntry('health', 'symptoms', {
        source: 'zentrack',
        condition_level: Math.round(
          (parsed.summary?.health_score || parsed.summary?.net_value?.value || 50) / 10
        ),
        notes: typeof parsed.details.health === 'string'
          ? parsed.details.health
          : JSON.stringify(parsed.details.health),
        date
      });
    }

    // Time: 時間の使い方
    if (parsed.details?.time) {
      store.addDomainEntry('time', 'entries', {
        source: 'zentrack',
        category: 'daily_summary',
        data: parsed.details.time,
        date
      });
    }

    // Work: 仕事の評価
    if (parsed.details?.work) {
      store.addDomainEntry('work', 'reviews', {
        source: 'zentrack',
        data: parsed.details.work,
        date
      });
    }

    // Relationship: 登場人物 → 連絡先候補に追記
    if (parsed.people && parsed.people.length > 0) {
      const existing = store.get('relationship_contacts') || [];
      const existingNames = new Set(existing.map(c => c.name?.toLowerCase()));
      parsed.people.forEach(p => {
        if (p.name && p.name !== '自分' && p.name !== 'Me' &&
            !existingNames.has(p.name.toLowerCase())) {
          store.addDomainEntry('relationship', 'interactions', {
            source: 'zentrack',
            person: p.name,
            role: p.role,
            sentiment: p.sentiment,
            notes: p.notes,
            date
          });
        }
      });
    }

    // Assets: 資産関連
    if (parsed.details?.assets) {
      store.addDomainEntry('assets', 'overview', {
        source: 'zentrack',
        data: parsed.details.assets,
        date
      });
    }
  },

  // ═══════════════════════════════════════════════════════════
  //  Render: 構造化レポートのHTML出力
  // ═══════════════════════════════════════════════════════════

  renderLatestReport() {
    const report = store.get('latestZenTrackReport');
    if (!report) {
      return `<div class="zt-report zt-report-empty">
        <h3>禅トラック レポート</h3>
        ${Components.emptyState('🧠', 'まだ禅トラック分析がありません',
          'Plaudで録音するか文字起こしを取り込むと、ここに構造化レポートが表示されます')}
      </div>`;
    }

    const nv = report.summary?.net_value?.value || 0;
    const nvColor = nv >= 70 ? '#27AE60' : nv >= 40 ? '#F39C12' : '#E74C3C';
    const savedAt = report.savedAt
      ? new Date(report.savedAt).toLocaleString('ja-JP', { hour12: false })
      : '';

    let html = `<div class="zt-report">
      <div class="zt-report-header">
        <h3>🧠 禅トラック レポート</h3>
        <span class="zt-report-time">${savedAt}</span>
      </div>`;

    // ─── Summary bar ───
    html += `<div class="zt-summary-bar">
      <div class="zt-nv-badge" style="border-color:${nvColor}">
        <span class="zt-nv-num" style="color:${nvColor}">${nv}</span>
        <span class="zt-nv-label">純価値</span>
      </div>
      <div class="zt-signals">
        <span class="zt-sig" title="欲">🔥 欲 ${report.signals?.desire_count || 0}</span>
        <span class="zt-sig" title="徳">✨ 徳 ${report.signals?.virtue_count || 0}</span>
        <span class="zt-sig" title="エネルギー">⚡ E ${report.signals?.energy_count || 0}</span>
      </div>
      ${report.consciousFocus?.dominant ? `
        <div class="zt-dominant">
          <span class="zt-dominant-label">最多レイヤー</span>
          <span class="zt-dominant-layer"
            style="background:${CONFIG.domains.consciousness.layers[report.consciousFocus.dominant]?.color || '#888'}">
            ${report.consciousFocus.dominant} ${report.consciousFocus.dominantLabel}
          </span>
          <span class="zt-dominant-pct">${Math.round(report.consciousFocus.dominantPct || 0)}%</span>
        </div>
      ` : ''}
      ${report.summary?.headline ? `
        <p class="zt-headline">${report.summary.headline}</p>
      ` : ''}
    </div>`;

    // ─── Context (状況 × 空間) ───
    if (report.context && report.context.length > 0) {
      html += `<div class="zt-section">
        <h4>状況 × 空間</h4>
        <div class="zt-context-list">
          ${report.context.map(c => `
            <div class="zt-context-item">
              <span class="zt-ctx-time">${c.time || ''}</span>
              <span class="zt-ctx-sit">${c.situation || ''}</span>
              <span class="zt-ctx-space">${c.space || ''}</span>
              <span class="zt-ctx-desc">${c.description || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // ─── People (登場人物) ───
    if (report.people && report.people.length > 0) {
      html += `<div class="zt-section">
        <h4>登場人物</h4>
        <div class="zt-people-list">
          ${report.people.map(p => `
            <div class="zt-person">
              <span class="zt-person-name">${p.name}</span>
              ${p.role ? `<span class="zt-person-role">${p.role}</span>` : ''}
              ${p.weight ? `<span class="zt-person-weight">${p.weight}%</span>` : ''}
              ${p.notes ? `<p class="zt-person-notes">${p.notes}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // ─── Calories (カロリー推定) ───
    if (report.calories) {
      const cal = report.calories;
      html += `<div class="zt-section">
        <h4>カロリー推定</h4>
        <div class="zt-calories">
          ${cal.intake != null ? `<div class="zt-cal-item"><span>摂取</span><strong>${cal.intake} kcal</strong></div>` : ''}
          ${cal.burned != null ? `<div class="zt-cal-item"><span>消費</span><strong>${cal.burned} kcal</strong></div>` : ''}
          ${cal.balance != null ? `<div class="zt-cal-item zt-cal-balance"><span>収支</span><strong>${cal.balance > 0 ? '+' : ''}${cal.balance} kcal</strong></div>` : ''}
          ${cal.bmr != null ? `<div class="zt-cal-item zt-cal-bmr"><span>基礎代謝</span><strong>${cal.bmr} kcal</strong></div>` : ''}
        </div>
        ${cal.note ? `<p class="zt-cal-note">${cal.note}</p>` : ''}
      </div>`;
    }

    // ─── 6-domain details (折りたたみ) ───
    const domainLabels = {
      health: '健康', time: '時間', work: '仕事',
      trust: '信用', assets: '資産', consciousness: '意識'
    };
    const hasDetails = report.details && Object.values(report.details).some(v => v);
    if (hasDetails) {
      html += `<details class="zt-section zt-details-collapse">
        <summary>6ドメイン詳細分析</summary>
        <div class="zt-domain-details">`;
      Object.entries(report.details).forEach(([key, val]) => {
        if (!val) return;
        const content = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
        html += `<div class="zt-detail-item">
          <h5>${domainLabels[key] || key}</h5>
          <pre>${content}</pre>
        </div>`;
      });
      html += `</div></details>`;
    }

    // ─── Actions (明日の行動) ───
    if (report.actions && report.actions.length > 0) {
      html += `<div class="zt-section zt-actions">
        <h4>明日の行動</h4>
        <ul>
          ${report.actions.map(a => `<li>${a.text}</li>`).join('')}
        </ul>
      </div>`;
    }

    // ─── Raw bullets (折りたたみ) ───
    if (report.rawBullets && report.rawBullets.length > 0) {
      html += `<details class="zt-section">
        <summary>フル版（箇条書き原文 ${report.rawBullets.length}件）</summary>
        <ul class="zt-raw-bullets">
          ${report.rawBullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
      </details>`;
    }

    html += `</div>`;
    return html;
  },

  // ═══════════════════════════════════════════════════════════
  //  History: 過去の禅トラック観測データ一覧
  // ═══════════════════════════════════════════════════════════
  getHistory(days = 30) {
    const observations = store.getDomainData('consciousness', 'observation', days) || [];
    return observations
      .filter(o => o.source === 'zentrack' || o.auto_generated)
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  },

  // ─── 週次サマリー計算 ───
  weeklySummary(days = 7) {
    const obs = this.getHistory(days);
    if (obs.length === 0) return null;

    const layers = {};
    this.LAYER_KEYS.forEach(k => { layers[k] = 0; });
    let totalDesire = 0, totalVirtue = 0, totalEnergy = 0, totalNV = 0;

    obs.forEach(o => {
      this.LAYER_KEYS.forEach(k => {
        layers[k] += o[this.STORE_KEY(k)] || 0;
      });
      totalDesire += o.desire_count || 0;
      totalVirtue += o.virtue_count || 0;
      totalEnergy += o.energy_count || 0;
      totalNV += o.net_value || 0;
    });

    const n = obs.length;
    this.LAYER_KEYS.forEach(k => { layers[k] = Math.round(layers[k] / n * 10) / 10; });

    return {
      days: n,
      avgLayers: layers,
      totalDesire,
      totalVirtue,
      totalEnergy,
      avgNetValue: Math.round(totalNV / n),
      dominantLayer: this.LAYER_KEYS.reduce((a, b) => layers[a] > layers[b] ? a : b)
    };
  },

  // ═══════════════════════════════════════════════════════════
  //  Render: 週次ミニサマリー
  // ═══════════════════════════════════════════════════════════
  renderWeeklySummary() {
    const s = this.weeklySummary(7);
    if (!s) return '';

    const dominant = CONFIG.domains.consciousness.layers[s.dominantLayer];
    const nvColor = s.avgNetValue >= 70 ? '#27AE60' : s.avgNetValue >= 40 ? '#F39C12' : '#E74C3C';

    return `<div class="zt-weekly">
      <h4>禅トラック 過去7日間</h4>
      <div class="zt-weekly-stats">
        <div class="zt-weekly-stat">
          <span class="zt-ws-num" style="color:${nvColor}">${s.avgNetValue}</span>
          <span class="zt-ws-label">平均純価値</span>
        </div>
        <div class="zt-weekly-stat">
          <span class="zt-ws-num">${s.days}</span>
          <span class="zt-ws-label">観測日数</span>
        </div>
        <div class="zt-weekly-stat">
          <span class="zt-ws-num" style="background:${dominant?.color || '#888'};color:#fff;padding:2px 8px;border-radius:4px">
            ${s.dominantLayer}
          </span>
          <span class="zt-ws-label">最多レイヤー</span>
        </div>
      </div>
      <div class="zt-weekly-signals">
        🔥 欲 ${s.totalDesire} &nbsp; ✨ 徳 ${s.totalVirtue} &nbsp; ⚡ E ${s.totalEnergy}
      </div>
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════
  //  Charts: ZenTrack 3-panel chart system
  //  ① スコア推移  (5-domain line chart, 0-5)
  //  ② 時間の使い方 (4-category stacked area, 0-100%)
  //  ③ 注意資源の配分 (8-layer stacked area, 0-100%)
  // ═══════════════════════════════════════════════════════════

  // ─── Dimension labels (ZenTrack style) ───
  DIMENSION_LABELS: {
    '1':   '一次元',
    '2':   '二次元',
    '3':   '三次元',
    '3.5': '三・五次元',
    '4':   '四次元',
    '5':   '五次元',
    '6':   '六次元',
    '7':   '七次元'
  },

  SCORE_DOMAINS: [
    { key: 'score_health', label: '健康', color: '#27AE60' },
    { key: 'score_time',   label: '時間', color: '#2980B9' },
    { key: 'score_work',   label: '仕事', color: '#F39C12' },
    { key: 'score_trust',  label: '信用', color: '#E74C3C' },
    { key: 'score_assets', label: '資産', color: '#8E44AD' }
  ],

  TIME_USAGE_SERIES: [
    { key: 'time_value_creation', label: '価値創出', color: 'rgba(39,174,96,0.6)',  border: '#27AE60' },
    { key: 'time_foundation',     label: '基盤づくり', color: 'rgba(41,128,185,0.6)', border: '#2980B9' },
    { key: 'time_maintenance',    label: 'メンテ',   color: 'rgba(243,156,18,0.6)',  border: '#F39C12' },
    { key: 'time_waste',          label: '浪費',     color: 'rgba(231,76,60,0.45)',  border: '#E74C3C' }
  ],

  ATTENTION_COLORS: [
    'rgba(39,174,96,0.55)',   // 一次元
    'rgba(41,128,185,0.55)',  // 二次元
    'rgba(243,156,18,0.55)',  // 三次元
    'rgba(231,76,60,0.45)',   // 三・五次元
    'rgba(142,68,173,0.55)',  // 四次元
    'rgba(230,126,34,0.55)',  // 五次元
    'rgba(26,188,156,0.55)',  // 六次元
    'rgba(127,140,141,0.55)'  // 七次元
  ],

  ATTENTION_BORDERS: [
    '#27AE60', '#2980B9', '#F39C12', '#E74C3C',
    '#8E44AD', '#E67E22', '#1ABC9C', '#7F8C8D'
  ],

  // ─── Build dense day list ───
  _dayList(days) {
    const list = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      list.push(d.toISOString().slice(0, 10));
    }
    return list;
  },

  _dayLabels(dayList) {
    return dayList.map(d => {
      const [, m, day] = d.split('-');
      return `${parseInt(m)}/${parseInt(day)}`;
    });
  },

  // ─── Index observations by date ───
  _obsByDate(days) {
    const raw = store.getDomainData('consciousness', 'observation', days + 30) || [];
    const byDate = {};
    raw.forEach(o => {
      const d = o.date || (o.timestamp || '').slice(0, 10);
      if (d) byDate[d] = o;
    });
    return byDate;
  },

  // ─── Linear interpolation helper (same logic as Pages.buildConsciousnessTrendData) ───
  _interpolateSeries(dayList, byDate, field) {
    const knownDays = dayList.filter(d => byDate[d] && byDate[d][field] != null);
    if (knownDays.length === 0) return dayList.map(() => null);

    const dateDiff = (a, b) => (new Date(b) - new Date(a)) / 86400000;

    return dayList.map(day => {
      if (byDate[day] && byDate[day][field] != null) return byDate[day][field];
      let leftDay = null, rightDay = null;
      for (const kd of knownDays) { if (kd <= day) leftDay = kd; }
      for (let i = knownDays.length - 1; i >= 0; i--) { if (knownDays[i] >= day) rightDay = knownDays[i]; }
      if (!leftDay && !rightDay) return null;
      if (!leftDay) return byDate[rightDay][field];
      if (!rightDay) return byDate[leftDay][field];
      if (leftDay === rightDay) return byDate[leftDay][field];
      const span = dateDiff(leftDay, rightDay);
      if (span <= 0) return byDate[leftDay][field];
      const t = dateDiff(leftDay, day) / span;
      const lv = byDate[leftDay][field];
      const rv = byDate[rightDay][field];
      return lv + (rv - lv) * t;
    });
  },

  // ─── Normalize stacked series so each day sums to target (e.g. 100) ───
  _normalizeStacked(dayList, seriesMap, target = 100) {
    return dayList.map((_, i) => {
      const vals = {};
      let sum = 0;
      Object.entries(seriesMap).forEach(([key, arr]) => {
        const v = Math.max(0, arr[i] || 0);
        vals[key] = v;
        sum += v;
      });
      if (sum <= 0) return vals;
      Object.keys(vals).forEach(k => { vals[k] = (vals[k] / sum) * target; });
      return vals;
    });
  },

  // ═══════════════════════════════════════════════════════════
  //  Render: 3-panel chart HTML
  // ═══════════════════════════════════════════════════════════
  renderCharts() {
    const observations = store.getDomainData('consciousness', 'observation', 60) || [];
    if (observations.length === 0) {
      return `<div class="zt-charts">
        <h3>禅トラック ダッシュボード</h3>
        ${Components.emptyState('📊', 'まだ観測データがありません',
          'Plaudで録音するか文字起こしを取り込むと、禅トラック分析結果がここにグラフとして表示されます')}
      </div>`;
    }

    const range = store.get('consciousnessTrendRange') || 30;

    return `<div class="zt-charts">
      <div class="zt-charts-header">
        <h3>禅トラック ダッシュボード</h3>
        <div class="zt-range-tabs">
          ${[7, 30, 60].map(d => `
            <button class="zt-range-btn ${range === d ? 'active' : ''}"
              onclick="app.setConsciousnessTrendRange(${d})">${d === 7 ? '日次' : d === 30 ? '月次' : '全期間'}</button>
          `).join('')}
        </div>
      </div>

      <div class="zt-chart-card">
        <h4>スコア推移</h4>
        <div class="zt-chart-wrap zt-chart-score">
          <canvas id="ztScoreChart"></canvas>
        </div>
      </div>

      <div class="zt-chart-card">
        <h4>時間の使い方</h4>
        <div class="zt-chart-wrap zt-chart-time">
          <canvas id="ztTimeChart"></canvas>
        </div>
      </div>

      <div class="zt-chart-card">
        <h4>注意資源の配分</h4>
        <div class="zt-chart-wrap zt-chart-attention">
          <canvas id="ztAttentionChart"></canvas>
        </div>
      </div>
    </div>`;
  },

  // ═══════════════════════════════════════════════════════════
  //  Init: Chart.js instantiation (call after DOM insert)
  // ═══════════════════════════════════════════════════════════
  _charts: {},

  destroyCharts() {
    Object.values(this._charts).forEach(c => { try { c.destroy(); } catch (_) {} });
    this._charts = {};
  },

  initCharts() {
    if (typeof Chart === 'undefined') return;
    this.destroyCharts();

    const days = store.get('consciousnessTrendRange') || 30;
    const dayList = this._dayList(days);
    const labels = this._dayLabels(dayList);
    const byDate = this._obsByDate(days);
    const hasData = dayList.some(d => !!byDate[d]);
    if (!hasData) return;

    this._initScoreChart(dayList, labels, byDate);
    this._initTimeChart(dayList, labels, byDate);
    this._initAttentionChart(dayList, labels, byDate);
  },

  // ─── ① スコア推移 (Line chart, 0-5) ───
  _initScoreChart(dayList, labels, byDate) {
    const canvas = document.getElementById('ztScoreChart');
    if (!canvas) return;

    const datasets = this.SCORE_DOMAINS.map(sd => {
      const data = this._interpolateSeries(dayList, byDate, sd.key);
      return {
        label: sd.label,
        data,
        borderColor: sd.color,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        tension: 0.4,
        spanGaps: true,
        pointRadius: (ctx) => byDate[dayList[ctx.dataIndex]] ? 3 : 0,
        pointBackgroundColor: sd.color
      };
    });

    this._charts.score = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } },
          tooltip: {
            callbacks: {
              title: (items) => dayList[items[0].dataIndex],
              label: (ctx) => {
                const v = ctx.parsed.y;
                return v != null ? `${ctx.dataset.label}: ${v.toFixed(1)}` : '';
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { min: 0, max: 5, ticks: { stepSize: 1 }, grid: { borderDash: [3, 3] } }
        }
      }
    });
  },

  // ─── ② 時間の使い方 (Stacked area, 0-100%) ───
  _initTimeChart(dayList, labels, byDate) {
    const canvas = document.getElementById('ztTimeChart');
    if (!canvas) return;

    // Build raw series
    const rawSeries = {};
    this.TIME_USAGE_SERIES.forEach(ts => {
      rawSeries[ts.key] = this._interpolateSeries(dayList, byDate, ts.key);
    });

    // Check if any time usage data exists
    const hasAny = Object.values(rawSeries).some(arr => arr.some(v => v != null && v > 0));
    if (!hasAny) return;

    // Normalize to 100%
    const normalized = this._normalizeStacked(dayList, rawSeries, 100);

    const datasets = this.TIME_USAGE_SERIES.map(ts => ({
      label: ts.label,
      data: normalized.map(n => Math.round((n[ts.key] || 0) * 10) / 10),
      backgroundColor: ts.color,
      borderColor: ts.border,
      borderWidth: 1,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 3
    }));

    this._charts.time = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(0)}%`
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { stacked: true, min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { borderDash: [3, 3] } }
        }
      }
    });
  },

  // ─── ③ 注意資源の配分 (Stacked area, 0-100%) ───
  _initAttentionChart(dayList, labels, byDate) {
    const canvas = document.getElementById('ztAttentionChart');
    if (!canvas) return;

    const layerFields = this.LAYER_KEYS.map(k => this.STORE_KEY(k));

    // Build raw + normalize
    const rawSeries = {};
    layerFields.forEach(field => {
      rawSeries[field] = this._interpolateSeries(dayList, byDate, field);
    });

    const normalized = this._normalizeStacked(dayList, rawSeries, 100);

    const datasets = this.LAYER_KEYS.map((k, i) => {
      const field = this.STORE_KEY(k);
      return {
        label: this.DIMENSION_LABELS[k],
        data: normalized.map(n => Math.round((n[field] || 0) * 10) / 10),
        backgroundColor: this.ATTENTION_COLORS[i],
        borderColor: this.ATTENTION_BORDERS[i],
        borderWidth: 1,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3
      };
    });

    this._charts.attention = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}　${ctx.parsed.y.toFixed(0)}%`
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { stacked: true, min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { borderDash: [3, 3] } }
        }
      }
    });
  }
};
