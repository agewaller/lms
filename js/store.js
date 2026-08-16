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
      unreadCount: 0,

      // Streak tracking
      recordStreak: 0,
      lastRecordDate: null,
      streakHistory: []   // [{date, domains}] per day
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
      'recordStreak', 'lastRecordDate', 'streakHistory'
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
      this.updateStreak(domain);
    }
    return entry;
  }

  updateStreak(domain) {
    const today = new Date().toISOString().slice(0, 10);
    const last = this.state.lastRecordDate;

    // Update streakHistory for today
    const history = [...(this.state.streakHistory || [])];
    const todayEntry = history.find(h => h.date === today);
    if (todayEntry) {
      if (!todayEntry.domains.includes(domain)) todayEntry.domains.push(domain);
    } else {
      history.push({ date: today, domains: [domain] });
    }
    // Keep only last 90 days
    history.sort((a, b) => a.date.localeCompare(b.date));
    const trimmed = history.slice(-90);
    this.state.streakHistory = trimmed;
    this.saveToStorage('streakHistory', trimmed);

    // Update streak count
    if (last === today) return; // already counted today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    const streak = (last === yStr)
      ? (this.state.recordStreak || 0) + 1
      : 1;

    this.state.recordStreak = streak;
    this.state.lastRecordDate = today;
    this.saveToStorage('recordStreak', streak);
    this.saveToStorage('lastRecordDate', today);
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
    let score = 0;

    switch (domain) {
      case 'health': {
        const symptoms = this.getDomainData('health', 'symptoms', 7);
        const sleep = this.getDomainData('health', 'sleepData', 7);
        const activity = this.getDomainData('health', 'activityData', 7);
        let points = 0;
        if (symptoms.length > 0) {
          const avg = symptoms.reduce((s, e) => s + (e.condition_level || 5), 0) / symptoms.length;
          points += avg * 6;  // up to 60 pts from condition level (0-10 scale)
        } else {
          points += 30; // neutral if no data
        }
        const sleepQuality = sleep.length > 0
          ? sleep.reduce((s, e) => s + (e.quality || 5), 0) / sleep.length : 5;
        points += sleepQuality * 2;  // up to 20 pts
        points += Math.min(20, activity.length * 5); // up to 20 pts
        score = Math.round(Math.min(100, points));
        break;
      }
      case 'consciousness': {
        const obs = this.getDomainData('consciousness', 'observation', 7);
        const entries = this.getDomainData('consciousness', 'entries', 7);
        const practices = this.getDomainData('consciousness', 'practices', 7);
        let points = 30; // base
        if (obs.length > 0) {
          const avgNv = obs.reduce((s, e) => s + (e.net_value || 50), 0) / obs.length;
          points += avgNv * 0.4; // up to 40 pts from net value
        }
        points += Math.min(15, entries.length * 5);
        points += Math.min(15, practices.length * 5);
        score = Math.round(Math.min(100, points));
        break;
      }
      case 'time': {
        const logs = this.getDomainData('time', 'entries', 7);
        const habits = this.getDomainData('time', 'habits', 7);
        let points = 20;
        if (logs.length > 0) {
          const avgProd = logs.reduce((s, e) => s + (e.productivity || 5), 0) / logs.length;
          points += avgProd * 5;  // up to 50
        }
        points += Math.min(30, habits.filter(h => h.completed).length * 5);
        score = Math.round(Math.min(100, points));
        break;
      }
      case 'work': {
        const tasks = this.getDomainData('work', 'tasks', 7);
        const projects = this.get('work_projects') || [];
        let points = 20;
        if (tasks.length > 0) {
          const doneRatio = tasks.filter(t => t.status === 'done').length / tasks.length;
          points += doneRatio * 50;
        }
        points += Math.min(30, projects.filter(p => p.status === 'active').length * 10);
        score = Math.round(Math.min(100, points));
        break;
      }
      case 'relationship': {
        const contacts = this.get('relationship_contacts') || [];
        const interactions = this.getDomainData('relationship', 'interactions', 7);
        let points = 20;
        const closeCount = contacts.filter(c => parseInt(c.distance) <= 2).length;
        points += Math.min(30, closeCount * 5);
        points += Math.min(30, interactions.length * 6);
        points += Math.min(20, contacts.length * 0.5);
        score = Math.round(Math.min(100, points));
        break;
      }
      case 'assets': {
        const stocks = this.get('assets_stocks') || [];
        const income = this.getDomainData('assets', 'income', 30);
        const expenses = this.getDomainData('assets', 'expenses', 30);
        let points = 30;
        points += Math.min(30, stocks.length * 5);
        points += Math.min(20, income.length * 4);
        if (income.length > 0 && expenses.length > 0) {
          const tot_income = income.reduce((s, e) => s + (e.amount || 0), 0);
          const tot_exp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
          if (tot_income > tot_exp) points += 20;
          else if (tot_income > 0) points += 10;
        }
        score = Math.round(Math.min(100, points));
        break;
      }
      default: {
        const allKeys = Object.keys(this.state).filter(k => k.startsWith(domain + '_'));
        let total = 0;
        allKeys.forEach(k => {
          if (Array.isArray(this.state[k])) {
            total += this.getDomainData(domain, k.replace(domain + '_', ''), 7).length;
          }
        });
        score = Math.min(100, 30 + total * 5);
      }
    }

    scores[domain] = score;
    this.set('domainScores', scores);
    return score;
  }

  // ─── Clear ───

  clearAll() {
    // Use targeted key removal — never localStorage.clear() which would
    // wipe Firebase config, OAuth tokens, and other non-LMS data.
    this.persistKeys.forEach(key => {
      localStorage.removeItem(`lms_${key}`);
    });
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
