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
      'autoTradingSettings', 'autoTradePending', 'autoTradeHistory'
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
    let score = 50; // default

    if (domain === 'health') {
      const recent = this.getDomainData('health', 'symptoms', 7);
      if (recent.length > 0) {
        const levels = recent.map(s => s.condition_level).filter(v => v != null);
        if (levels.length > 0) {
          score = Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10);
        }
      }
    } else {
      // Generic: based on recent entry count (activity level)
      const allKeys = Object.keys(this.state).filter(k => k.startsWith(domain + '_'));
      let totalRecent = 0;
      allKeys.forEach(k => {
        if (Array.isArray(this.state[k])) {
          totalRecent += this.getDomainData(domain, k.replace(domain + '_', ''), 7).length;
        }
      });
      score = Math.min(100, 30 + totalRecent * 5);
    }

    scores[domain] = score;
    this.set('domainScores', scores);
    return score;
  }

  // ─── Clear ───

  clearAll() {
    localStorage.clear();
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
