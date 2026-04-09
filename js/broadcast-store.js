/* ============================================================
   Broadcast - State Management Store
   LMS の store.js と同じ設計 (reactive + localStorage + Firebase sync)
   ============================================================ */
var BroadcastStore = class BroadcastStore {
  constructor() {
    this.state = {
      // ─── Auth (LMS の store と共有するので、ここはミラー) ───
      user: null,
      isAuthenticated: false,

      // ─── Composer state ───
      draft: {
        title: '',
        body: '',
        tags: [],
        images: [],       // data-URL / uploaded URL
        language: 'ja',
        createdAt: null
      },

      // ─── Adapted versions ───
      // { platformId: { title, body, tags, language, charCount, edited } }
      adaptations: {},

      // ─── Selected platforms for this broadcast ───
      selectedPlatforms: [],

      // ─── Platform connections ───
      // { platformId: { connected: bool, token?: str, webhook?: str, instance?: str, expiresAt?: str } }
      connections: {},

      // ─── Distribution history ───
      // [{ id, timestamp, draft, adaptations, results: { platformId: { status, url?, error? } } }]
      broadcasts: [],

      // ─── Scheduled broadcasts ───
      scheduled: [],

      // ─── Analytics ───
      analytics: {},

      // ─── Settings ───
      selectedModel: 'claude-opus-4-6',
      customPrompts: {},
      defaultLanguages: ['ja'], // multi-lang auto-translate
      autoAdapt: true,          // automatically AI-adapt for each platform
      confirmBeforeSend: true,
      theme: 'light',

      // ─── UI state ───
      currentPage: 'compose', // compose | history | connections | settings | ask_ai
      isDistributing: false,
      isAdapting: false,

      // ─── AI Analysis ───
      latestAnalysis: null,
      analysisHistory: [],
      conversationHistory: []
    };

    this.listeners = new Map();
    this.loadFromStorage();

    // Mirror LMS store's auth state so both apps share login
    this.syncFromLmsStore();
  }

  // Mirror user/isAuthenticated from the shared LMS store
  syncFromLmsStore() {
    if (typeof store === 'undefined') return;
    this.state.user = store.get('user');
    this.state.isAuthenticated = store.get('isAuthenticated');
    store.on('user', (v) => { this.state.user = v; this.notify('user', v); });
    store.on('isAuthenticated', (v) => { this.state.isAuthenticated = v; this.notify('isAuthenticated', v); });
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const old = this.state[key];
    this.state[key] = value;
    this.notify(key, value, old);
    this.saveToStorage(key, value);
  }

  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.state[key] = value;
      this.notify(key, value);
    });
    Object.keys(updates).forEach(key => this.saveToStorage(key, updates[key]));
  }

  on(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  notify(key, value, old) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(value, old));
    }
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => cb(key, value, old));
    }
  }

  // ─── Persistence ───

  get persistKeys() {
    return [
      'draft', 'adaptations', 'selectedPlatforms',
      'connections', 'broadcasts', 'scheduled', 'analytics',
      'selectedModel', 'customPrompts', 'defaultLanguages',
      'autoAdapt', 'confirmBeforeSend', 'theme',
      'analysisHistory', 'conversationHistory'
    ];
  }

  saveToStorage(key, value) {
    if (this.persistKeys.includes(key)) {
      try {
        localStorage.setItem(`broadcast_${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn('Storage save failed:', e);
      }
    }
  }

  loadFromStorage() {
    this.persistKeys.forEach(key => {
      try {
        const val = localStorage.getItem(`broadcast_${key}`);
        if (val !== null) {
          this.state[key] = JSON.parse(val);
        }
      } catch (e) { /* ignore */ }
    });
  }

  // ─── Helpers ───

  addBroadcast(broadcast) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...broadcast
    };
    this.state.broadcasts = [...(this.state.broadcasts || []), entry];
    this.notify('broadcasts', this.state.broadcasts);
    this.saveToStorage('broadcasts', this.state.broadcasts);
    return entry;
  }

  updateBroadcast(id, updates) {
    const list = this.state.broadcasts || [];
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...updates };
    this.set('broadcasts', [...list]);
  }

  setConnection(platformId, data) {
    const conns = { ...(this.state.connections || {}) };
    conns[platformId] = { ...(conns[platformId] || {}), ...data, connected: !!(data.token || data.webhook || data.appPassword) };
    this.set('connections', conns);
  }

  removeConnection(platformId) {
    const conns = { ...(this.state.connections || {}) };
    delete conns[platformId];
    this.set('connections', conns);
  }

  getConnectedPlatforms() {
    const conns = this.state.connections || {};
    return Object.keys(conns).filter(p => conns[p]?.connected);
  }

  clearDraft() {
    this.set('draft', { title: '', body: '', tags: [], images: [], language: 'ja', createdAt: null });
    this.set('adaptations', {});
    this.set('selectedPlatforms', []);
  }
};

var broadcastStore = new BroadcastStore();
