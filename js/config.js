/* ============================================================
   LMS - Configuration
   Domains, AI models, prompts, categories, affiliate settings
   ============================================================ */
var CONFIG = {

  // ─── App Info ───
  app: {
    name: 'LMS',
    fullName: 'Life Management System',
    version: '1.0.0',
    description: 'Integrated life optimization across 6 domains'
  },

  // ─── Firebase (replace with your project values) ───
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },

  // ─── AI Models ───
  aiModels: {
    'claude-sonnet-4-6':  { name: 'Claude Sonnet 4.6', provider: 'anthropic', maxTokens: 4096 },
    'claude-opus-4-6':    { name: 'Claude Opus 4.6',   provider: 'anthropic', maxTokens: 4096 },
    'claude-haiku-4-5':   { name: 'Claude Haiku 4.5',  provider: 'anthropic', maxTokens: 4096 },
    'gpt-4o':             { name: 'GPT-4o',            provider: 'openai',    maxTokens: 4096 },
    'gemini-pro':         { name: 'Gemini Pro',        provider: 'google',    maxTokens: 4096 }
  },

  // ─── API Endpoints ───
  endpoints: {
    anthropic: 'https://lms-api-proxy.your-account.workers.dev',
    openai: 'https://api.openai.com/v1/chat/completions',
    google: 'https://generativelanguage.googleapis.com/v1beta/models'
  },

  // ─── 6 Life Domains ───
  domains: {
    consciousness: {
      id: 'consciousness',
      icon: '🧠',
      color: '#9B59B6',
      categories: {
        entries:    { label: 'journal',     icon: '📝' },
        practices:  { label: 'practice',    icon: '🧘' }
      },
      dataFields: {
        entries: [
          { key: 'mood_level',       type: 'slider', min: 1, max: 10, label: 'mood' },
          { key: 'gratitude',        type: 'text',   label: 'gratitude' },
          { key: 'reflection',       type: 'textarea', label: 'reflection' },
          { key: 'intention',        type: 'text',   label: 'intention' }
        ],
        practices: [
          { key: 'practice_type',    type: 'select', options: ['meditation', 'breathwork', 'prayer', 'journaling', 'visualization', 'other'], label: 'practice_type' },
          { key: 'duration_minutes', type: 'number', label: 'duration_min' },
          { key: 'quality',          type: 'slider', min: 1, max: 10, label: 'quality' },
          { key: 'notes',            type: 'textarea', label: 'notes' }
        ]
      }
    },

    health: {
      id: 'health',
      icon: '💚',
      color: '#27AE60',
      categories: {
        symptoms:     { label: 'symptoms',    icon: '🤒' },
        vitals:       { label: 'vitals',      icon: '❤️' },
        bloodTests:   { label: 'blood_tests', icon: '🩸' },
        medications:  { label: 'medications', icon: '💊' },
        supplements:  { label: 'supplements', icon: '🧴' },
        meals:        { label: 'meals',       icon: '🍽️' },
        sleepData:    { label: 'sleep',       icon: '😴' },
        activityData: { label: 'activity',    icon: '🏃' }
      },
      dataFields: {
        symptoms: [
          { key: 'condition_level', type: 'slider', min: 1, max: 10, label: 'condition_level' },
          { key: 'fatigue_level',   type: 'slider', min: 0, max: 10, label: 'fatigue' },
          { key: 'pain_level',      type: 'slider', min: 0, max: 10, label: 'pain' },
          { key: 'brain_fog',       type: 'slider', min: 0, max: 10, label: 'brain_fog' },
          { key: 'notes',           type: 'textarea', label: 'notes' }
        ],
        vitals: [
          { key: 'heart_rate',      type: 'number', label: 'heart_rate', unit: 'bpm' },
          { key: 'bp_systolic',     type: 'number', label: 'bp_systolic', unit: 'mmHg' },
          { key: 'bp_diastolic',    type: 'number', label: 'bp_diastolic', unit: 'mmHg' },
          { key: 'temperature',     type: 'number', label: 'temperature', unit: '°C', step: 0.1 },
          { key: 'weight',          type: 'number', label: 'weight', unit: 'kg', step: 0.1 }
        ],
        bloodTests: [
          { key: 'test_name',  type: 'text', label: 'test_name' },
          { key: 'value',      type: 'number', label: 'value' },
          { key: 'unit',       type: 'text', label: 'unit' },
          { key: 'reference',  type: 'text', label: 'reference_range' }
        ],
        medications: [
          { key: 'name',     type: 'text', label: 'medicine_name' },
          { key: 'dosage',   type: 'text', label: 'dosage' },
          { key: 'timing',   type: 'select', options: ['morning', 'noon', 'evening', 'bedtime', 'as_needed'], label: 'timing' },
          { key: 'notes',    type: 'textarea', label: 'notes' }
        ],
        supplements: [
          { key: 'name',     type: 'text', label: 'supplement_name' },
          { key: 'dosage',   type: 'text', label: 'dosage' },
          { key: 'brand',    type: 'text', label: 'brand' }
        ],
        meals: [
          { key: 'meal_type', type: 'select', options: ['breakfast', 'lunch', 'dinner', 'snack'], label: 'meal_type' },
          { key: 'content',   type: 'textarea', label: 'meal_content' },
          { key: 'calories',  type: 'number', label: 'calories' }
        ],
        sleepData: [
          { key: 'sleep_time',   type: 'time', label: 'sleep_time' },
          { key: 'wake_time',    type: 'time', label: 'wake_time' },
          { key: 'quality',      type: 'slider', min: 1, max: 10, label: 'sleep_quality' },
          { key: 'notes',        type: 'textarea', label: 'notes' }
        ],
        activityData: [
          { key: 'activity_type', type: 'select', options: ['walking', 'running', 'yoga', 'gym', 'swimming', 'cycling', 'stretching', 'other'], label: 'activity_type' },
          { key: 'duration',      type: 'number', label: 'duration_min' },
          { key: 'intensity',     type: 'slider', min: 1, max: 10, label: 'intensity' }
        ]
      }
    },

    time: {
      id: 'time',
      icon: '⏰',
      color: '#E67E22',
      categories: {
        entries:   { label: 'time_log',    icon: '📋' },
        schedules: { label: 'schedule',    icon: '📅' },
        habits:    { label: 'habits',      icon: '🔄' },
        goals:     { label: 'time_goals',  icon: '🎯' }
      },
      dataFields: {
        entries: [
          { key: 'activity',       type: 'text', label: 'activity' },
          { key: 'category',       type: 'select', options: ['work', 'health', 'learning', 'relationships', 'leisure', 'sleep', 'commute', 'housework', 'other'], label: 'category' },
          { key: 'duration',       type: 'number', label: 'duration_min' },
          { key: 'productivity',   type: 'slider', min: 1, max: 10, label: 'productivity' },
          { key: 'notes',          type: 'textarea', label: 'notes' }
        ],
        schedules: [
          { key: 'title',      type: 'text', label: 'title' },
          { key: 'start_time', type: 'datetime-local', label: 'start_time' },
          { key: 'end_time',   type: 'datetime-local', label: 'end_time' },
          { key: 'priority',   type: 'select', options: ['high', 'medium', 'low'], label: 'priority' }
        ],
        habits: [
          { key: 'habit_name', type: 'text', label: 'habit_name' },
          { key: 'completed',  type: 'toggle', label: 'completed' },
          { key: 'streak',     type: 'number', label: 'streak_days' }
        ],
        goals: [
          { key: 'goal',       type: 'text', label: 'goal' },
          { key: 'target',     type: 'text', label: 'target' },
          { key: 'deadline',   type: 'date', label: 'deadline' },
          { key: 'progress',   type: 'slider', min: 0, max: 100, label: 'progress_pct' }
        ]
      }
    },

    contribution: {
      id: 'contribution',
      icon: '💼',
      color: '#2980B9',
      categories: {
        tasks:    { label: 'tasks',     icon: '✅' },
        goals:    { label: 'work_goals', icon: '🎯' },
        skills:   { label: 'skills',    icon: '📚' },
        projects: { label: 'projects',  icon: '📊' },
        reviews:  { label: 'reviews',   icon: '📝' }
      },
      dataFields: {
        tasks: [
          { key: 'title',       type: 'text', label: 'task_title' },
          { key: 'description', type: 'textarea', label: 'description' },
          { key: 'status',      type: 'select', options: ['todo', 'in_progress', 'done'], label: 'status' },
          { key: 'priority',    type: 'select', options: ['high', 'medium', 'low'], label: 'priority' },
          { key: 'due_date',    type: 'date', label: 'due_date' }
        ],
        goals: [
          { key: 'goal',        type: 'text', label: 'goal' },
          { key: 'category',    type: 'select', options: ['career', 'skill', 'income', 'impact', 'other'], label: 'category' },
          { key: 'progress',    type: 'slider', min: 0, max: 100, label: 'progress_pct' },
          { key: 'deadline',    type: 'date', label: 'deadline' }
        ],
        skills: [
          { key: 'skill_name',  type: 'text', label: 'skill_name' },
          { key: 'level',       type: 'slider', min: 1, max: 10, label: 'skill_level' },
          { key: 'study_hours', type: 'number', label: 'study_hours' },
          { key: 'notes',       type: 'textarea', label: 'notes' }
        ],
        projects: [
          { key: 'name',        type: 'text', label: 'project_name' },
          { key: 'role',        type: 'text', label: 'your_role' },
          { key: 'status',      type: 'select', options: ['planning', 'active', 'completed', 'paused'], label: 'status' },
          { key: 'progress',    type: 'slider', min: 0, max: 100, label: 'progress_pct' }
        ],
        reviews: [
          { key: 'period',      type: 'text', label: 'review_period' },
          { key: 'achievements', type: 'textarea', label: 'achievements' },
          { key: 'challenges',  type: 'textarea', label: 'challenges' },
          { key: 'next_steps',  type: 'textarea', label: 'next_steps' }
        ]
      }
    },

    trust: {
      id: 'trust',
      icon: '🤝',
      color: '#E74C3C',
      categories: {
        contacts:     { label: 'contacts',     icon: '👤' },
        interactions: { label: 'interactions',  icon: '💬' },
        networks:     { label: 'networks',      icon: '🌐' },
        goals:        { label: 'relation_goals', icon: '🎯' }
      },
      dataFields: {
        contacts: [
          { key: 'name',           type: 'text', label: 'person_name' },
          { key: 'relationship',   type: 'select', options: ['family', 'friend', 'colleague', 'mentor', 'mentee', 'business', 'community', 'other'], label: 'relationship_type' },
          { key: 'trust_level',    type: 'slider', min: 1, max: 10, label: 'trust_level' },
          { key: 'notes',          type: 'textarea', label: 'notes' }
        ],
        interactions: [
          { key: 'person',         type: 'text', label: 'person_name' },
          { key: 'type',           type: 'select', options: ['meeting', 'call', 'message', 'email', 'social', 'gift', 'help_given', 'help_received'], label: 'interaction_type' },
          { key: 'quality',        type: 'slider', min: 1, max: 10, label: 'quality' },
          { key: 'notes',          type: 'textarea', label: 'notes' }
        ],
        networks: [
          { key: 'network_name',   type: 'text', label: 'network_name' },
          { key: 'type',           type: 'select', options: ['professional', 'personal', 'community', 'online', 'other'], label: 'network_type' },
          { key: 'member_count',   type: 'number', label: 'member_count' },
          { key: 'your_role',      type: 'text', label: 'your_role' }
        ],
        goals: [
          { key: 'goal',           type: 'text', label: 'goal' },
          { key: 'target_person',  type: 'text', label: 'target_person' },
          { key: 'progress',       type: 'slider', min: 0, max: 100, label: 'progress_pct' },
          { key: 'deadline',       type: 'date', label: 'deadline' }
        ]
      }
    },

    assets: {
      id: 'assets',
      icon: '💰',
      color: '#F1C40F',
      categories: {
        portfolio:    { label: 'portfolio',    icon: '📈' },
        transactions: { label: 'transactions', icon: '💳' },
        income:       { label: 'income',       icon: '💵' },
        expenses:     { label: 'expenses',     icon: '🧾' },
        goals:        { label: 'financial_goals', icon: '🎯' }
      },
      dataFields: {
        portfolio: [
          { key: 'asset_name',  type: 'text', label: 'asset_name' },
          { key: 'asset_type',  type: 'select', options: ['stock', 'bond', 'crypto', 'real_estate', 'fund', 'commodity', 'cash', 'other'], label: 'asset_type' },
          { key: 'quantity',    type: 'number', label: 'quantity', step: 0.0001 },
          { key: 'buy_price',   type: 'number', label: 'buy_price', step: 0.01 },
          { key: 'current_price', type: 'number', label: 'current_price', step: 0.01 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP', 'CNY', 'KRW'], label: 'currency' }
        ],
        transactions: [
          { key: 'type',        type: 'select', options: ['buy', 'sell', 'dividend', 'interest', 'transfer'], label: 'transaction_type' },
          { key: 'asset_name',  type: 'text', label: 'asset_name' },
          { key: 'amount',      type: 'number', label: 'amount', step: 0.01 },
          { key: 'price',       type: 'number', label: 'price', step: 0.01 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP', 'CNY', 'KRW'], label: 'currency' }
        ],
        income: [
          { key: 'source',      type: 'text', label: 'income_source' },
          { key: 'type',        type: 'select', options: ['salary', 'freelance', 'investment', 'rental', 'business', 'other'], label: 'income_type' },
          { key: 'amount',      type: 'number', label: 'amount', step: 0.01 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP', 'CNY', 'KRW'], label: 'currency' },
          { key: 'recurring',   type: 'toggle', label: 'recurring' }
        ],
        expenses: [
          { key: 'item',        type: 'text', label: 'expense_item' },
          { key: 'category',    type: 'select', options: ['housing', 'food', 'transport', 'health', 'education', 'entertainment', 'insurance', 'tax', 'other'], label: 'category' },
          { key: 'amount',      type: 'number', label: 'amount', step: 0.01 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP', 'CNY', 'KRW'], label: 'currency' }
        ],
        goals: [
          { key: 'goal',        type: 'text', label: 'financial_goal' },
          { key: 'target_amount', type: 'number', label: 'target_amount', step: 0.01 },
          { key: 'current_amount', type: 'number', label: 'current_amount', step: 0.01 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP', 'CNY', 'KRW'], label: 'currency' },
          { key: 'deadline',    type: 'date', label: 'deadline' }
        ]
      }
    }
  },

  // ─── AI Prompts (per domain) ───
  // These are starter prompts; admin can customize via settings
  prompts: {
    consciousness: {
      daily: `You are an expert life coach and mindfulness advisor. Analyze the user's consciousness/mindfulness data and provide:
1. Emotional pattern recognition
2. Mental state assessment
3. Personalized mindfulness recommendations
4. Actionable practices for today
Respond in the user's language. Be compassionate yet practical.`,
      weekly: `Review the past week's consciousness and mindfulness data. Provide a weekly reflection covering emotional trends, spiritual growth indicators, and recommended practices for the coming week.`
    },
    health: {
      daily: `You are a medical knowledge specialist. Analyze the user's health data and provide:
1. Health status assessment based on reported symptoms and vitals
2. Pattern recognition (triggers, correlations)
3. Evidence-based recommendations
4. Specific actionable steps (supplements, lifestyle changes, when to see a doctor)
IMPORTANT: Always note that this is informational only - consult a physician for medical decisions.
Respond in the user's language.`,
      weekly: `Review the past week's health data comprehensively. Identify trends in symptoms, vital signs, sleep, nutrition, and activity. Provide a weekly health report with specific recommendations.`
    },
    time: {
      daily: `You are a productivity and time management expert. Analyze the user's time usage data and provide:
1. Time allocation analysis
2. Productivity patterns
3. Optimization suggestions
4. Specific scheduling recommendations for tomorrow
Respond in the user's language. Be practical and actionable.`,
      weekly: `Review the past week's time usage data. Provide analysis of time allocation across categories, identify time wasters, and suggest an optimized schedule template for the coming week.`
    },
    contribution: {
      daily: `You are a career and professional development advisor. Analyze the user's work/contribution data and provide:
1. Task prioritization recommendations
2. Skill development suggestions
3. Career trajectory insights
4. Specific action items for today
Respond in the user's language.`,
      weekly: `Review the past week's work and contribution data. Assess progress on goals and projects, identify bottlenecks, and provide strategic recommendations for the coming week.`
    },
    trust: {
      daily: `You are a relationship and communication expert. Analyze the user's relationship/trust data and provide:
1. Relationship health assessment
2. Communication pattern insights
3. Network development suggestions
4. Specific relationship-building actions for today
Respond in the user's language. Be emotionally intelligent and practical.`,
      weekly: `Review the past week's relationship interactions and trust-building activities. Identify patterns, suggest improvements in communication, and recommend specific actions for deepening key relationships.`
    },
    assets: {
      daily: `You are a financial advisor and investment analyst. Analyze the user's financial data and provide:
1. Portfolio performance summary
2. Risk assessment
3. Investment opportunity suggestions
4. Specific financial actions to consider
IMPORTANT: This is informational only - consult a licensed financial advisor for investment decisions.
Respond in the user's language.`,
      weekly: `Review the past week's financial activities and portfolio performance. Provide a comprehensive financial report with trend analysis, risk assessment, and strategic recommendations.`
    },
    // Cross-domain holistic analysis
    holistic: `You are a life optimization advisor. Review data across all 6 life domains (Consciousness, Health, Time, Contribution, Trust, Assets) and provide:
1. Overall life balance assessment
2. Cross-domain correlations (e.g., sleep affecting productivity)
3. Priority recommendations across domains
4. A unified action plan for the coming week
Respond in the user's language. Be holistic yet practical.`
  },

  // ─── Inline Analysis Prompts ───
  inlinePrompts: {
    quickInput: `The user has entered the following text about their life. Determine which domain(s) it relates to (consciousness, health, time, contribution, trust, assets) and provide:
1. Brief acknowledgment
2. Key insights
3. 1-3 specific actionable recommendations
Keep response concise (under 200 words). Respond in the user's language.
Format as JSON: { "domains": [...], "response": "...", "actions": [...] }`,

    imageAnalysis: `Analyze this image in the context of life management. It could be a meal photo, medical report, schedule, financial statement, etc. Provide relevant analysis and recommendations based on the content. Respond in the user's language.`
  },

  // ─── Affiliate Config ───
  affiliate: {
    amazon_jp:  { tag: '', baseUrl: 'https://www.amazon.co.jp' },
    rakuten:    { id: '', baseUrl: 'https://item.rakuten.co.jp' },
    iherb:      { code: '', baseUrl: 'https://jp.iherb.com' }
  },

  // ─── PayPal Subscription ───
  paypal: {
    clientId: '',
    plans: {
      basic:   { id: '', price: 980,  currency: 'JPY', name: 'Basic',   features: ['ai_analysis', 'data_export'] },
      premium: { id: '', price: 2980, currency: 'JPY', name: 'Premium', features: ['ai_analysis', 'data_export', 'auto_actions', 'priority_support'] }
    }
  },

  // ─── Action Categories ───
  actionCategories: {
    health:        ['clinic', 'supplement', 'lab_test', 'telemedicine', 'fitness', 'nutrition'],
    consciousness: ['meditation_app', 'book', 'workshop', 'retreat', 'therapy'],
    time:          ['tool', 'course', 'coaching', 'planner'],
    contribution:  ['course', 'certification', 'tool', 'networking_event', 'coaching'],
    trust:         ['gift', 'event', 'course', 'travel', 'donation'],
    assets:        ['brokerage', 'advisor', 'course', 'tool', 'insurance']
  }
};
