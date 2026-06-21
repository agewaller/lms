/* ============================================================
   LMS - State Management Store
   Reactive store with localStorage persistence + Firebase sync
   ============================================================ */
var Store = class Store {
  constructor() {
    this.state = {
      // Auth
      user: null,
      isAuthenticated: false,

      // Navigation
      currentPage: 'login',       // login | home | record | action | settings | admin | ask_ai
      currentDomain: 'health',    // consciousness | health | time | work | relationship | assets
      theme: 'light',
      sidebarOpen: window.innerWidth > 768,

      // Domain scores (0-100)
      domainScores: {
        consciousness: 0,
        health: 0,
        time: 0,
        work: 0,
        relationship: 0,
        assets: 0
      },

      // ─── Consciousness (意識) ───
      consciousness_observation: [], // daily 7-layer observations
      consciousness_transcript: [],  // Plaud / voice memo transcripts
      consciousness_entries: [],     // journal, gratitude
      consciousness_practices: [],   // meditation, breathwork

      // ─── Health (健康) ───
      health_symptoms: [],
      health_vitals: [],
      health_bloodTests: [],
      health_medications: [],
      health_supplements: [],
      health_meals: [],
      health_sleepData: [],
      health_activityData: [],
      health_photos: [],
      health_wearableData: [],
      health_geneticData: null,

      // ─── Time (時間) ───
      time_entries: [],       // time logs
      time_schedules: [],     // planned schedules
      time_habits: [],        // habit tracking
      time_goals: [],         // time-related goals

      // ─── Work (仕事) ───
      work_tasks: [],     // work tasks
      work_goals: [],     // career/work goals
      work_skills: [],    // skill development
      work_projects: [],  // projects
      work_reviews: [],   // performance reviews

      // ─── Relationship (関係) ───
      relationship_contacts: [],       // relationships with distance levels
      relationship_interactions: [],   // interaction logs
      relationship_gifts: [],          // gift tracking
      relationship_groups: [],         // relationship groups

      // ─── Assets (資産) ───
      assets_overview: [],      // overall asset situation
      assets_stocks: [],        // stock investments
      assets_portfolio: [],     // all assets
      assets_income: [],        // income streams
      assets_expenses: [],      // expense tracking
      assets_goals: [],         // financial goals

      // AI Analysis (shared)
      latestAnalysis: null,
      analysisHistory: [],
      isAnalyzing: false,
      conversationHistory: [],

      // Actions / Recommendations
      recommendations: [],
      actionItems: [],

      // Admin
      adminMode: false,
      adminTab: 'prompts',
      adminEmails: ['agewaller@gmail.com'],
      adminPromptFilter: { search: '', domain: '' },
      selectedModel: 'claude-sonnet-4-6',
      customPrompts: {},
      dashboardLayout: 'default',
      affiliateConfig: {},

      // Subscription
      subscription: null,  // { plan, status, expiresAt, paypalId }

      // User Profile
      userProfile: {},
      userResume: {},              // Resume data for work domain
      timeMarketplaceSettings: {}, // Time marketplace settings
      timeMarketplaceBookings: [], // Booking requests
      autoTradingSettings: {},     // Auto trading configuration
      autoTradePending: [],        // Pending trade orders
      autoTradeHistory: [],        // Executed/rejected trade history
      calendarEvents: [],
      latestFeedback: null,
      cachedResearch: null,
      aiComments: [],

      // Notifications
      notifications: [],
      unreadCount: 0
    };

    this.listeners = new Map();
    this.loadFromStorage();
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
      'user', 'isAuthenticated', 'theme', 'currentDomain',
      'selectedModel', 'customPrompts', 'dashboardLayout', 'affiliateConfig',
      'adminEmails', 'adminTab', 'adminPromptFilter',
      'domainScores', 'userProfile', 'subscription',
      // Consciousness
      'consciousness_observation', 'consciousness_transcript',
      'consciousness_entries', 'consciousness_practices',
      // Health
      'health_symptoms', 'health_vitals', 'health_bloodTests',
      'health_medications', 'health_supplements', 'health_meals',
      'health_sleepData', 'health_activityData', 'health_photos',
      // Time
      'time_entries', 'time_schedules', 'time_habits', 'time_goals',
      // Work
      'work_tasks', 'work_goals', 'work_skills',
      'work_projects', 'work_reviews',
      // Relationship
      'relationship_contacts', 'relationship_interactions', 'relationship_gifts', 'relationship_groups',
      // Assets
      'assets_overview', 'assets_stocks', 'assets_portfolio',
      'assets_income', 'assets_expenses', 'assets_goals',
      // Shared
      'analysisHistory', 'recommendations', 'actionItems',
      'conversationHistory', 'calendarEvents', 'latestFeedback',
      'cachedResearch', 'aiComments',
      'userResume', 'timeMarketplaceSettings', 'timeMarketplaceBookings',
      'autoTradingSettings', 'autoTradePending', 'autoTradeHistory',
      'latestAnalysis', 'hasOnboarded',
      'workProvisionPrefs'
    ];
  }

  saveToStorage(key, value) {
    if (this.persistKeys.includes(key)) {
      try {
        localStorage.setItem(`lms_${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn('Storage save failed:', e);
      }
    }
  }

  loadFromStorage() {
    this.persistKeys.forEach(key => {
      try {
        const val = localStorage.getItem(`lms_${key}`);
        if (val !== null) {
          this.state[key] = JSON.parse(val);
        }
      } catch (e) { /* ignore */ }
    });
  }

  // ─── Domain Data Helpers ───

  addDomainEntry(domain, category, data) {
    const key = `${domain}_${category}`;
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: new Date().toISOString(),
      domain,
      category,
      ...data
    };

    if (Array.isArray(this.state[key])) {
      this.state[key] = [...this.state[key], entry];
      this.notify(key, this.state[key]);
      this.saveToStorage(key, this.state[key]);
    }
    return entry;
  }

  getDomainData(domain, category, days) {
    const key = `${domain}_${category}`;
    const data = this.state[key];
    if (!Array.isArray(data)) return [];
    if (!days) return data;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.filter(d => new Date(d.timestamp) >= cutoff);
  }

  // ─── Score Calculation ───

  calculateDomainScore(domain) {
    const scores = { ...this.state.domainScores };
    let score = 50;

    switch (domain) {
      case 'health': {
        const symptoms = this.getDomainData('health', 'symptoms', 7);
        const sleep = this.getDomainData('health', 'sleepData', 7);
        let parts = 0, total = 0;
        const levels = symptoms.map(s => s.condition_level).filter(v => v != null);
        if (levels.length) { total += (levels.reduce((a,b)=>a+b,0)/levels.length) * 10; parts++; }
        const sleepQ = sleep.map(s => s.quality).filter(v => v != null);
        if (sleepQ.length) { total += (sleepQ.reduce((a,b)=>a+b,0)/sleepQ.length) * 10; parts++; }
        score = parts > 0 ? Math.round(total / parts) : 50;
        break;
      }
      case 'consciousness': {
        const obs = this.getDomainData('consciousness', 'observation', 7);
        if (obs.length) {
          const netValues = obs.map(o => o.net_value).filter(v => v != null);
          score = netValues.length ? Math.round(netValues.reduce((a,b)=>a+b,0) / netValues.length) : 50;
        }
        break;
      }
      case 'time': {
        const logs = this.getDomainData('time', 'entries', 7);
        const prods = logs.map(l => l.productivity).filter(v => v != null);
        // Productivity score + consistency bonus
        const avgProd = prods.length ? prods.reduce((a,b)=>a+b,0)/prods.length : 0;
        const daysCounted = new Set(logs.map(l => (l.timestamp||'').split('T')[0])).size;
        score = Math.min(100, Math.round((avgProd * 8) + (daysCounted * 4)));
        if (!logs.length) score = 50;
        break;
      }
      case 'work': {
        const tasks = this.getDomainData('work', 'tasks', 14);
        const done = tasks.filter(t => t.status === 'done').length;
        const completionRate = tasks.length ? done / tasks.length : 0;
        score = Math.min(100, Math.round(40 + completionRate * 40 + Math.min(tasks.length, 5) * 4));
        if (!tasks.length) score = 50;
        break;
      }
      case 'relationship': {
        const contacts = this.state.relationship_contacts || [];
        const interactions = this.state.relationship_interactions || [];
        if (!contacts.length) { score = 50; break; }
        // Use same logic as RelationshipFeatures isolation score but invert it
        const closeContacts = contacts.filter(c => parseInt(c.distance) <= 3);
        if (!closeContacts.length) { score = 60; break; }
        const now = new Date();
        let overdueWeight = 0;
        closeContacts.forEach(c => {
          const last = interactions
            .filter(i => i.person === c.name)
            .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
          const days = last ? Math.floor((now - new Date(last.timestamp)) / 86400000) : 999;
          const ideal = { 1:1, 2:7, 3:14 }[parseInt(c.distance)] || 14;
          if (days > ideal) overdueWeight += Math.min(3, Math.round(days / ideal));
        });
        score = Math.max(10, Math.min(100, 100 - overdueWeight * 8));
        break;
      }
      case 'assets': {
        const income = this.getDomainData('assets', 'income', 30);
        const expenses = this.getDomainData('assets', 'expenses', 30);
        const totalIncome = income.reduce((s,e) => s + (e.amount||0), 0);
        const totalExpenses = expenses.reduce((s,e) => s + (e.amount||0), 0);
        if (!income.length && !expenses.length) { score = 50; break; }
        const ratio = totalExpenses > 0 ? totalIncome / totalExpenses : 1;
        // ratio >= 1.2 → score 80+; < 0.8 → score < 40
        score = Math.min(100, Math.max(10, Math.round(ratio * 65)));
        break;
      }
      default: {
        const allKeys = Object.keys(this.state).filter(k => k.startsWith(domain + '_'));
        let totalRecent = 0;
        allKeys.forEach(k => {
          if (Array.isArray(this.state[k])) totalRecent += this.getDomainData(domain, k.replace(domain+'_',''), 7).length;
        });
        score = Math.min(100, 30 + totalRecent * 5);
      }
    }

    scores[domain] = score;
    this.set('domainScores', scores);
    return score;
  }

  // ─── Clear ───

  clearAll() {
    // Only remove lms_* keys — never touch Firebase config, OAuth tokens,
    // or any other non-LMS data (CLAUDE.md: never call localStorage.clear())
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('lms_')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));

    Object.keys(this.state).forEach(key => {
      if (Array.isArray(this.state[key])) this.state[key] = [];
      else if (typeof this.state[key] === 'object' && this.state[key] !== null) this.state[key] = {};
    });
    this.state.isAuthenticated = false;
    this.state.user = null;
    this.state.currentPage = 'login';
    this.state.currentDomain = 'health';
    this.state.subscription = null;
  }
};

var store = new Store();
