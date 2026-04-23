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

  // ═══════════════════════════════════════════════════════════
  //  Save: 構造化データ → Store 各ドメインに分配
  // ═══════════════════════════════════════════════════════════

  saveObservation(parsed) {
    if (!parsed) return null;
    const cf = parsed.consciousFocus;
    const sig = parsed.signals;
    const nv = parsed.summary?.net_value?.value || 0;
    const date = parsed.meta?.date || new Date().toISOString().slice(0, 10);

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
      // Metadata
      dominant_layer: cf.dominant,
      date,
      auto_generated: true,
      source: 'zentrack',
      // Full parsed data for later rendering
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
  }
};
