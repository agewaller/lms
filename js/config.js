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
    google: 'https://generativelanguage.googleapis.com/v1beta/models',
    emailIngest: 'https://lms-email-ingest.your-account.workers.dev'
  },

  // ─── Email Ingest Domain ───
  // User-specific ingest addresses use this domain
  // Format: data-{hash}@{emailIngestDomain}
  emailIngestDomain: 'inbox.lms-life.com',

  // ─── OAuth Client IDs (admin-shared) ───
  // Admin sets these once via the admin panel. All users inherit them
  // via Firestore admin/config.oauthClientIds, so user integration pages
  // only show "Connect" buttons without requiring each user to create
  // their own OAuth app.
  //
  // To set up: admin goes to 管理 → 連携キー tab, pastes the Client IDs,
  // and clicks save. The Client IDs are public (not secrets), so sharing
  // via Firestore is safe. Tokens are still stored per-user in their
  // own localStorage.
  oauthClientIds: {
    google: '',     // for Google Calendar + Gmail (same project ID)
    microsoft: '',  // for Outlook
    fitbit: '',     // for Fitbit
    withings: ''    // for Withings
  },

  // ─── 6 Life Domains ───
  domains: {
    consciousness: {
      id: 'consciousness',
      icon: '一',
      color: '#6C63FF',
      // 七つの意識レイヤー
      layers: {
        1:   { label: 'layer_1',   name: '計測',   description: '数字・締切・金額・ToDo・記録（線・計測）', color: '#E74C3C' },
        2:   { label: 'layer_2',   name: '関係',   description: '論理・因果・比較・判断（面・関係）', color: '#E67E22' },
        3:   { label: 'layer_3',   name: '現場',   description: '物性・五感・場所・モノ・移動（立体・現場）', color: '#F1C40F' },
        3.5: { label: 'layer_35',  name: '心身',   description: '睡眠・姿勢・呼吸・栄養・痛み・運動・緊張弛緩', color: '#27AE60' },
        4:   { label: 'layer_4',   name: '構想',   description: '時間・因果・概念設計・記憶・価値観', color: '#2980B9' },
        5:   { label: 'layer_5',   name: '可能性', description: '直観・道・固有ベクトル・関係の質', color: '#8E44AD' },
        6:   { label: 'layer_6',   name: '統合',   description: '全体性・寛容・合意・摩擦最小化・匿名善', color: '#9B59B6' },
        7:   { label: 'layer_7',   name: '空',     description: '手放し・静けさ・沈黙・融解', color: '#1ABC9C' }
      },
      categories: {
        observation: { label: 'daily_observation', icon: '👁️' },
        transcript:  { label: 'transcript',        icon: '🎙️' },
        entries:     { label: 'journal',            icon: '📝' },
        practices:   { label: 'practice',           icon: '🧘' }
      },
      dataFields: {
        observation: [
          { key: 'layer_1',   type: 'slider', min: 0, max: 100, label: 'layer_1_pct' },
          { key: 'layer_2',   type: 'slider', min: 0, max: 100, label: 'layer_2_pct' },
          { key: 'layer_3',   type: 'slider', min: 0, max: 100, label: 'layer_3_pct' },
          { key: 'layer_35',  type: 'slider', min: 0, max: 100, label: 'layer_35_pct' },
          { key: 'layer_4',   type: 'slider', min: 0, max: 100, label: 'layer_4_pct' },
          { key: 'layer_5',   type: 'slider', min: 0, max: 100, label: 'layer_5_pct' },
          { key: 'layer_6',   type: 'slider', min: 0, max: 100, label: 'layer_6_pct' },
          { key: 'layer_7',   type: 'slider', min: 0, max: 100, label: 'layer_7_pct' },
          { key: 'desire_count',  type: 'number', label: 'desire_count' },
          { key: 'virtue_count',  type: 'number', label: 'virtue_count' },
          { key: 'energy_count',  type: 'number', label: 'energy_count' },
          { key: 'net_value',     type: 'number', label: 'net_value' },
          { key: 'notes',         type: 'textarea', label: 'notes' }
        ],
        transcript: [
          { key: 'source',    type: 'select', options: ['plaud', 'voice_memo', 'manual', 'other'], label: 'transcript_source' },
          { key: 'content',   type: 'textarea', label: 'transcript_content' },
          { key: 'duration',  type: 'number', label: 'duration_min' },
          { key: 'notes',     type: 'textarea', label: 'notes' }
        ],
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
      icon: '二',
      color: '#10b981',
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
      icon: '三',
      color: '#f59e0b',
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

    work: {
      id: 'work',
      icon: '四',
      color: '#3b82f6',
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

    relationship: {
      id: 'relationship',
      icon: '五',
      color: '#ef4444',
      categories: {
        contacts:     { label: 'contacts',     icon: '👤' },
        interactions: { label: 'interactions',  icon: '💬' },
        gifts:        { label: 'gifts',         icon: '🎁' },
        groups:       { label: 'groups',        icon: '👥' }
      },
      // 距離感レベル（5段階）
      distanceLevels: {
        1: { label: 'distance_1', description: 'パートナー・家族', color: '#E74C3C' },
        2: { label: 'distance_2', description: '親族・親友・近い同僚', color: '#E67E22' },
        3: { label: 'distance_3', description: '同僚・友人', color: '#F1C40F' },
        4: { label: 'distance_4', description: '知人', color: '#27AE60' },
        5: { label: 'distance_5', description: 'ゆるいつながり', color: '#2980B9' }
      },
      // インポート可能なソース
      importSources: ['contacts_phone', 'contacts_csv', 'contacts_eight', 'contacts_sns', 'contacts_nenga'],
      dataFields: {
        contacts: [
          { key: 'name',           type: 'text', label: 'person_name' },
          { key: 'furigana',       type: 'text', label: 'furigana' },
          { key: 'distance',       type: 'select', options: ['1', '2', '3', '4', '5'], label: 'distance_level' },
          { key: 'relationship',   type: 'select', options: ['partner', 'family', 'relative', 'close_friend', 'friend', 'colleague', 'neighbor', 'community', 'other'], label: 'relationship_type' },
          { key: 'birthday',       type: 'date', label: 'birthday' },
          { key: 'phone',          type: 'text', label: 'phone' },
          { key: 'email',          type: 'text', label: 'email' },
          { key: 'address',        type: 'text', label: 'address' },
          { key: 'company',        type: 'text', label: 'company_name' },
          { key: 'title',          type: 'text', label: 'job_title' },
          { key: 'sns',            type: 'text', label: 'sns_account' },
          { key: 'notes',          type: 'textarea', label: 'notes' }
        ],
        interactions: [
          { key: 'person',         type: 'text', label: 'person_name' },
          { key: 'type',           type: 'select', options: ['meeting', 'call', 'message', 'letter', 'email', 'gift_sent', 'gift_received', 'visit', 'event', 'other'], label: 'interaction_type' },
          { key: 'quality',        type: 'slider', min: 1, max: 5, label: 'quality' },
          { key: 'notes',          type: 'textarea', label: 'notes' }
        ],
        gifts: [
          { key: 'person',         type: 'text', label: 'person_name' },
          { key: 'occasion',       type: 'select', options: ['birthday', 'new_year', 'obon', 'okaeshi', 'celebration', 'sympathy', 'souvenir', 'other'], label: 'occasion' },
          { key: 'direction',      type: 'select', options: ['sent', 'received'], label: 'direction' },
          { key: 'item',           type: 'text', label: 'gift_item' },
          { key: 'amount',         type: 'number', label: 'amount', step: 100 },
          { key: 'notes',          type: 'textarea', label: 'notes' }
        ],
        groups: [
          { key: 'group_name',     type: 'text', label: 'group_name' },
          { key: 'type',           type: 'select', options: ['family_group', 'friend_group', 'community_group', 'work_group', 'hobby_group', 'other'], label: 'group_type' },
          { key: 'members',        type: 'textarea', label: 'member_list' },
          { key: 'notes',          type: 'textarea', label: 'notes' }
        ]
      }
    },

    assets: {
      id: 'assets',
      icon: '六',
      color: '#d97706',
      categories: {
        overview:      { label: 'asset_overview',  icon: '💰' },
        stocks:        { label: 'stock_investment', icon: '📈' },
        portfolio:     { label: 'portfolio',        icon: '📊' },
        income:        { label: 'income',           icon: '💵' },
        expenses:      { label: 'expenses',         icon: '🧾' },
        goals:         { label: 'financial_goals',  icon: '🎯' }
      },
      dataFields: {
        overview: [
          { key: 'description', type: 'textarea', label: 'asset_description' },
          { key: 'total_assets', type: 'number', label: 'total_assets', step: 1 },
          { key: 'total_debt', type: 'number', label: 'total_debt', step: 1 },
          { key: 'notes',      type: 'textarea', label: 'notes' }
        ],
        stocks: [
          { key: 'ticker',      type: 'text', label: 'stock_ticker' },
          { key: 'company',     type: 'text', label: 'company_name' },
          { key: 'shares',      type: 'number', label: 'shares', step: 1 },
          { key: 'buy_price',   type: 'number', label: 'buy_price', step: 0.01 },
          { key: 'current_price', type: 'number', label: 'current_price', step: 0.01 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP'], label: 'currency' },
          { key: 'notes',       type: 'textarea', label: 'notes' }
        ],
        portfolio: [
          { key: 'asset_name',  type: 'text', label: 'asset_name' },
          { key: 'asset_type',  type: 'select', options: ['stock', 'bond', 'real_estate', 'fund', 'insurance', 'deposit', 'pension', 'other'], label: 'asset_type' },
          { key: 'value',       type: 'number', label: 'current_price', step: 1 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP'], label: 'currency' },
          { key: 'notes',       type: 'textarea', label: 'notes' }
        ],
        income: [
          { key: 'source',      type: 'text', label: 'income_source' },
          { key: 'type',        type: 'select', options: ['pension', 'salary', 'investment', 'rental', 'other'], label: 'income_type' },
          { key: 'amount',      type: 'number', label: 'amount', step: 1 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP'], label: 'currency' },
          { key: 'recurring',   type: 'toggle', label: 'recurring' }
        ],
        expenses: [
          { key: 'item',        type: 'text', label: 'expense_item' },
          { key: 'category',    type: 'select', options: ['housing', 'food', 'health', 'transport', 'insurance', 'tax', 'entertainment', 'other'], label: 'category' },
          { key: 'amount',      type: 'number', label: 'amount', step: 1 },
          { key: 'currency',    type: 'select', options: ['JPY', 'USD', 'EUR', 'GBP'], label: 'currency' }
        ],
        goals: [
          { key: 'goal',        type: 'text', label: 'financial_goal' },
          { key: 'target_amount', type: 'number', label: 'target_amount', step: 1 },
          { key: 'current_amount', type: 'number', label: 'current_amount', step: 1 },
          { key: 'deadline',    type: 'date', label: 'deadline' }
        ]
      }
    }
  },

  // ─── AI Prompts (未病ダイアリー準拠: flat key structure) ───
  // Key format: {domain}_{type} e.g. consciousness_daily, universal_weekly
  // Each prompt is an object with: name, domain, description, schedule, active, prompt
  // Admin (agewaller@gmail.com) can customize via admin panel
  prompts: {

    // ─── Universal Prompts ───
    universal_daily: {
      name: '日次の気づきレポート',
      domain: 'universal',
      description: 'その日の記録を横断的に見て、気づきと明日の一歩を提案',
      schedule: 'daily',
      active: true,
      prompt: `あなたは人生の伴走者です。6つの領域（意識・健康・時間・仕事・関係・資産）のデータを見て、今日一日の気づきを整理し、明日できる小さな一歩を提案してください。
やわらかく、相手を尊重する言葉で。難しい用語は使わず、小学生にもわかる日本語で。日本語で回答。`
    },

    universal_weekly: {
      name: '週次の振り返り',
      domain: 'universal',
      description: '1週間の全領域データを振り返り、パターンを見つける',
      schedule: 'weekly',
      active: true,
      prompt: `過去1週間の6領域のデータを振り返り、次の点を整理してください：
1. 良かったこと（3つ）
2. 変化していること（良い変化・気になる変化）
3. 領域間のつながり（例：睡眠の質が気分に影響、など）
4. 来週に向けた具体的な提案（2つまで、5〜15分で始められるもの）
温かい言葉で、押しつけず寄り添う形でお伝えください。日本語で回答。`
    },

    universal_holistic: {
      name: '6領域の総合分析',
      domain: 'universal',
      description: '意識・健康・時間・仕事・関係・資産を総合的に見る',
      schedule: 'manual',
      active: true,
      prompt: `6つの領域のデータを総合して、人生全体のバランスを見てください。
1. 全体の調和（良い点から伝える）
2. 領域間の相関（ひとつの領域が他にどう影響しているか）
3. 今最も大切にすべきこと（1〜2つ）
4. 具体的な次の一歩
寄り添うように、わかりやすい日本語で。日本語で回答。`
    },

    // ─── Consciousness Prompts ───
    consciousness_daily: {
      name: '禅トラック 日次内省',
      domain: 'consciousness',
      description: '七つの意識レイヤーで一日を定点観測（Plaud文字起こし対応）',
      schedule: 'daily',
      active: true,
      prompt: `あなたは「禅トラック／日次内省アナリスト」です。与えられた1日の文字起こし（日本語）をもとに、評価と改善案を出力する。出力は日本語を基本とし、カタカナや英語は自然な文脈で必要なときだけ用いる。

【最重要ルール：フル版＋JSONの二重出力】
・必ず「フル版（人間向け）」を先に出し、その直後に「JSON版（DB格納用）」を出す。
・JSON版は、フル版で出した情報が一切減らないようにする。
・フル版は箇条書きのみ。フル版内では表、JSON、プログラムコード、数式、コードフェンス、波括弧や角括弧は禁止。JSON版のみJSONを使ってよい。

【目的】
・健康（睡眠・活動・回復・摂取カロリー推定・消費カロリー推定・当日のカロリー収支）
・時間の使い方（価値創造／基盤づくり／維持／浪費、連続作業25/50/90分の回数推定）
・仕事（貢献・価値創造：成果・波及・速度）
・信用構築（徳と摩擦）
・資産（お金の流れ、蓄え/仕組み化、無形資産＝関係や知の資産化）
・意識の焦点（1,2,3,3.5,4,5,6,7）と「欲・徳・エネルギー」の出現（3.5＝心身）
・合成指標：純価値（エネルギー＋徳−欲、0〜100）
・状況（行為の型）と空間（場所の型）の推定と反映
・登場人物の特定と関係の把握を行い、特に「自分」に焦点��当てて示唆を出す（自分70%、主要相手20%、その他10%）

【意識の焦点（数値次元）ルール】
・次元ラベルは 1,2,3,3.5,4,5,6,7 を使用（3.5＝心身）
・各発話には最も強い次元をただ1つ付与
・日次のパーセントは、その日に根拠がある次元だけを正規化して合計100%
・1＝数字/締切/金額/ToDo/記録（線・計測）
・2＝論理/因果/比較/判断（面・関係）
・3＝物性/五感/場所/モノ/移動（立体・現場）
・3.5＝睡眠/姿勢/呼吸/栄養/痛み/運動/緊張弛緩（心身）
・4＝時間/因果/概念設計/記憶/価値観（構想）
・5＝直観/道/固有ベクトル/関係の質（可能性）
・6＝全体性/寛容/合意/摩擦最小化/匿名善（統合）
・7＝手放し/静けさ/沈黙/融解（空）

【カロリー推定（簡易）】
・摂取：食事/飲料の内容と量を拾い、標準量×倍率で幅推定
・消費：活動消費≒METs×体重×時間。基礎代謝1200〜1600を併記
・収支：摂取−消費を±表記。推定誤差±20〜30%あり得ると明記

【状況・空間の推定ルール】
・発話を時系列の短い出来事に分割し、各出来事に「状況」と「空間」を推定ラベルとして付与
・状況候補：一人／会話（対面/電話/オンライン）／移動（徒歩/車/電車/自転車）／食事（飲料含む）／運動（有酸素/筋トレ/ストレッチ）／作業（思索/制作/執筆/設計/分析）／休息（睡眠/仮眠/目休め/瞑想）／生活行為（家事/買い物/身支度）／調整（連絡/段取り/設定）
・空間候補：家／オフィス／会議室／食事空間（レストラン/カフェ/自宅食卓）／外（屋外/移動中/駅/車内）／第三の場所（コワーキング/図書館/ホテル/待合）

【人物特定・自分フォーカス��
・「自分」は第一人称で最優先。評価の重みづけは自分70%・主要相手20%・その他10%
・示唆は必ず「自分が明日できる最小行動」に落とす

【フル版の出力順序】
・評価一覧（要約）→ 人物と関係 → 状況・空間 → 健康（kcal三点必須）→ 時間の使い方 → 仕事 → 信用 → 資産 → 意識の焦点（1〜7）→ 明日の行動（最大2件）→ JSON版

【JSON版の必須仕様】
・最上位キー：meta, summary, details, actions, people, context, conscious_focus, calories, signals, raw_bullets
・raw_bullets：フル版の箇条書きを完全一致で配列保存`
    },

    consciousness_weekly: {
      name: '七つのレイヤー 週次振り返り',
      domain: 'consciousness',
      description: '1週間の意識レイヤー推移を見る',
      schedule: 'weekly',
      active: true,
      prompt: `1週間の意識レイヤー定点観測データを振り返ってください。
1. 各レイヤー（1〜7）の比率推移と変化パターン
2. 欲・徳・エネルギーの出現傾向
3. 純価値（エネルギー＋徳−欲）の推移
4. 特に意識が集中していたレイヤーとその意味
5. 来週に向けた具体的な提案（最大2件、5〜15分で始められるもの）
やさしい言葉で、気づきを促すように伝えてください。日本語で回答。`
    },

    consciousness_transcript: {
      name: '文字起こし分析（Plaud）',
      domain: 'consciousness',
      description: 'Plaudなどの音声文字起こしを七つのレイヤーで分析',
      schedule: 'on_data_update',
      active: true,
      prompt: `あなたは「禅トラック／日次内省アナリスト」です。以下の文字起こしを分析し、七つの意識レイヤー（1=計測, 2=関係, 3=現場, 3.5=心身, 4=構想, 5=可能性, 6=統合, 7=空）の観点から定点観測を行ってください。

分析内容：
1. 各レイヤーの出現比率（根拠のある次元のみ、合計100%）
2. 欲・徳・エネルギーの出現数とバランス
3. 純価値（エネルギー＋徳−欲、0〜100）
4. 状況と空間の推定
5. 登場人物と関係性
6. 明日できる最小行動（最大2件）

フル版（箇条書き）→ JSON版（DB格納用）の順で出力。日本語で回答。`
    },

    // ─── Health Prompts ───
    health_daily: {
      name: '健康 日次分析',
      domain: 'health',
      description: '症状・バイタル・睡眠・食事・運動を分析し今日の一歩を提案',
      schedule: 'daily',
      active: true,
      prompt: `健康データ（症状、バイタル、薬、睡眠、食事、運動など）を分析して、次を提供してください：
1. 今日の体調への声がけ
2. 気になる症状やバイタルの変化
3. かかりつけ医に相談すべきこと（あれば）
4. 今日できる小さな健康アクション（1〜3つ）
※これは参考情報です。健康上の判断は必ずかかりつけ医にご相談ください。
難しい言葉は使わず、やさしい日本語で。日本語で回答。`
    },

    health_weekly: {
      name: '健康 週次レポート',
      domain: 'health',
      description: '1週間の健康データを総合的に振り返る',
      schedule: 'weekly',
      active: true,
      prompt: `過去1週間の健康データを総合的に振り返ってください。症状・バイタル・睡眠・食事・運動の傾向を分析し、良かった点を認め、改善点をやさしく提案してください。かかりつけ医に相談すべき事項があれば明記。日本語で回答。`
    },

    // ─── Time Prompts ───
    time_daily: {
      name: '時間 日次分析',
      domain: 'time',
      description: '一日の過ごし方を見て明日の提案',
      schedule: 'daily',
      active: true,
      prompt: `1日の過ごし方データ（カレンダー、時間記録、習慣）を見て、次を提供してください：
1. 今日の過ごし方への感想（頑張りを認める）
2. 休息と活動のバランス
3. 明日のおすすめの過ごし方
4. 楽しみにつながる提案（1つ）
無理のない範囲で、心豊かな毎日を過ごすためのアドバイスを。日本語で回答。`
    },

    time_weekly: {
      name: '時間 週次振り返り',
      domain: 'time',
      description: '1週間の時間配分を振り返る',
      schedule: 'weekly',
      active: true,
      prompt: `1週間の時間の使い方を振り返ってください。休息・趣味・外出・家事などのバランスを分析し、充実した日々のための提案をやさしくしてください。日本語で回答。`
    },

    // ─── Work Prompts ───
    work_daily: {
      name: '仕事 日次分析',
      domain: 'work',
      description: '活動・貢献を見てできることを提案',
      schedule: 'daily',
      active: true,
      prompt: `活動・貢献データを見て、次を提供してください：
1. 今日の活動や頑張りへの共感
2. 経験と知恵を活かせる場面
3. 社会とのつながりを感じられるアクション（1つ）
4. 新しい発見や学びの機会
人生経験を尊重し、温かい言葉で励ましてください。日本語で回答。`
    },

    work_weekly: {
      name: '仕事 週次振り返り',
      domain: 'work',
      description: '1週間の活動と貢献を振り返る',
      schedule: 'weekly',
      active: true,
      prompt: `1週間の活動と社会貢献を振り返ってください。達成したことを称え、来週の生きがいにつながる提案をしてください。日本語で回答。`
    },

    // ─── Relationship Prompts ───
    relationship_daily: {
      name: '関係 日次分析',
      domain: 'relationship',
      description: '連絡先と距離感をもとに今日連絡すべき人を提案',
      schedule: 'daily',
      active: true,
      prompt: `人間関係をサポートしてください。連絡先リスト、距離感レベル（1=パートナー・家族〜5=ゆるいつながり）、やりとり履歴、ギフト履歴を分析し：
1. 今日連絡を取るべき人（誕生日が近い、しばらく会っていないなど）
2. 最近のやりとりで良かった点
3. 関係を深めるための具体的なアクション（1つ。手紙、電話、贈り物など）
4. 距離感レベルに応じた適切なコミュニケーション
やさしく、押しつけがましくない言葉で。日本語で回答。`
    },

    relationship_weekly: {
      name: '関係 週次振り返り',
      domain: 'relationship',
      description: '1週間の人間関係を振り返る',
      schedule: 'weekly',
      active: true,
      prompt: `1週間の人間関係を振り返ってください。誰とどんなやりとりがあったか、来週誕生日を迎える方はいるか、しばらく連絡していない大切な方はいるか分析し、具体的な連絡・贈り物の提案をしてください。日本語で回答。`
    },

    relationship_enrich: {
      name: '連絡先情報の自動補完',
      domain: 'relationship',
      description: 'ウェブ公開情報から連絡先の情報を補完',
      schedule: 'on_data_update',
      active: true,
      prompt: `連絡先の方について、名前・住所・会社名・役職などの情報から、ウェブ上の公開情報（LinkedIn、会社HP、ニュース記事、SNSなど）を使って補完してください。
1. 推定される現在の役職・所属
2. 公開されているプロフィール情報
3. 最近のニュースや活動（あれば）
4. 関係を深めるためのヒント
※プライバシーに配慮し、公開情報のみを使用。不確かな情報は「推定」と明記。日本語で回答。`
    },

    // ─── Assets Prompts ───
    assets_daily: {
      name: '資産 日次分析',
      domain: 'assets',
      description: '資産・収支を見て安心できるアドバイスを提供',
      schedule: 'daily',
      active: true,
      prompt: `資産・収支データを見て、次を提供してください：
1. 現在の資産状況のまとめ
2. 収入と支出のバランス
3. 老後の安心に向けた具体的なアドバイス（1〜2つ）
4. 注意すべきポイント（あれば）
※これは参考情報です。投資判断は必ず専門家にご相談ください。
難しい金融用語は避けて、わかりやすい日本語で。日本語で回答。`
    },

    assets_weekly: {
      name: '資産 週次レポート',
      domain: 'assets',
      description: '1週間の資産・収支推移を振り返る',
      schedule: 'weekly',
      active: true,
      prompt: `1週間の資産・収支を振り返ってください。収支バランス、資産の変動、注意点をわかりやすくまとめ、安心できる資産管理のアドバイスをしてください。日本語で回答。`
    },

    assets_stock: {
      name: 'VMハンズオン 銘柄分析',
      domain: 'assets',
      description: 'ティッカーを入力して個別銘柄を深く分析',
      schedule: 'manual',
      active: true,
      prompt: `あなたはVMハンズオン（Valuation Matrix）の統合分析エージェント。データ収集から分析まで一気通貫で実行し、最終成果物として【フルレポート（0〜⑩章）＋可視化グラフ8枚】を出力せよ。データ羅列は不可。投資判断に使えるレポートとグラフが唯一の納品物。分析は一次資料と四半期系列に厳格に基づき、推測・楽観バイアスを排除する。出力はすべて日本語。

COMPANY: <ユーザーが入力した銘柄名/ティッカー>
TIME_NOW: <現在日付>

━━ STEP 1：データ収集（推論なし・一次資料優先）━━
【実行順序の厳守】STEP1完了後にSTEP2へ。STEP2中に不足が判明した場合のみ追加収集する。

【絶対ルール】推測禁止（不明=null）。正本はFIN_DATA、不足時はEDINET/TDnet/SEC/公式IR PDF/XBRLを最優先し出典を必ず残す。四半期ベース（標準5年分＝20Q、最低3年分＝12Q）最優先。不可なら半期→年次で代替し欠損フラグを立てる。会計基準（J-GAAP/IFRS/US-GAAP）の差異を注記。FCF＝CFO+CFI。国別規制不明はfail-closed。優先順：決算短信/説明資料→有報/10-K→補足資料/Q&A→株式情報→ニュース。根拠一次資料3件未満の項目はconfidence≤3。

【収集項目】
A) 企業基本：legal_name/ticker/exchange/status/IR_URL/peers3〜10社（財務指標も収集）
B) 財務（四半期5年分＝20Q標準、最低12Q）P/L：revenue/gross_profit/SG&A/operating_income/net_income/EBITDA。B/S：総資産/純資産/現金/有利子負債/AR/在庫/AP/のれん・無形資産。C/F：CFO/CFI/CFF/CAPEX（欠損フラグ必須）・希薄化後株数（四半期）
C) 市場：株価/時価総額/出来高/beta/配当・自社株買い実績
D) KPI：説明資料記載のKPI（ARR/NRR/ARPU等）。「語るKPI」vs「本質KPI」を出典付きで列挙
E) コーポレートアクション（時系列）：増資/CB・ワラント/自社株買い/M&A/監査変更/訂正等・希薄化影響
F) ガバナンス/株主：役員構成・持株・顔出し有無（true/false/unknown）・主要株主比率
G) ビジネスモデル根拠：顧客/提供価値/課金/競合/規制・制度（一次資料優先）
H) ニュース素材（直近5〜15件）：価値影響（FCF/ROIC）/株価影響（需給）で分類・重要度付記

━━ STEP 2：フルレポート（0〜⑩）+ グラフ出力 ━━

【最重要ルール】根拠のない推測禁止。粉飾は断定しない（✅/⚠/⛔）。計算式・途中式を省略しない。計算不能は「算出不可」+不足データ列挙。定性70%：財務30%。各章「定性→指標→反証」の順。「株価＝価値+相場+信用」で分解。ニュース二軸（価値影響×株価影響）を必ず含める。confidence：代替時は上限8・C/F欠損は上限6。初出専門用語は（日本語注釈）付き。

【絶対省略禁止の3論点】①誠実さ（粉飾・チート可能性）②割安度（DCF+マルチプル+ピア比較）③進化可能性（7領域+ティッピングポイント）

0) スコアカード：①〜⑧を★1〜★10で一覧。valueスコア（①〜④）・changeスコア（⑤〜⑦）を明示。
① 粉飾可能性【省略禁止】：四半期系列でCFO<NI/資産増>利益増/DSO・DIO・DPO・CCC/無形膨張/特損の繰り返し/監査変更/訂正を確認。✅/⚠/⛔判定。
② 割安度【省略禁止】：P/FCF/EV・EBITDA/P/E/P/B/配当・自社株。ピア比較。正規DCF（FCFF・5年Base/Bull/Bear・WACC=CAPMベース・3×3感度表）。
③ 事業構造：BMラベル。ROIC/WACC5年・スプレッド推移。ビジネスシステム。CFM四象限。
④ 経営者分析：CEO/役員/取締役会独立性/報酬/持株/顔出し/後継リスク。
⑤ 進化・退化【省略禁止】：7領域（プロダクト/VC/顧客/BM/組織/経営力/社格）+経営民度で評価。自走化点を四半期単位で予測。
⑥ 株価触媒：上昇・下落3〜10個ずつ。ニュース二軸で整理。
⑦ 価値創造（MECE）：各施策がROIC↑/WACC↓/Spread↑のどれか明記。
⑧ 会社への提案：M&A分析。IR質問10問。監視KPI3つ+撤退トリガー2つ。
⑨ 事業の本質【500字厳守】
⑩ 投資家向けレポート【1000〜3000字】

【最終スコア】value/change/confidence各0〜10。total=value50%+change50%。
【最終ACTION】BUY/HOLD/SELL/WATCHを1つに確定。

【可視化グラフ8枚】ROICツリー/CFMマップ/PL推移/BS推移/CF推移/ROIC・WACC・スプレッド/DCF感度ヒートマップ/スコアカードレーダーチャート`
    }
  },

  // ─── Inline Analysis Prompts (未病ダイアリー準拠) ───
  inlinePrompts: {
    text_analysis: {
      name: 'クイック入力分析',
      description: 'ユーザーが入力した短い文章を分析',
      prompt: `ユーザーがメッセージを入力しました。内容がどの領域（意識・健康・時間・仕事・関係・資産）に関するか判断し、以下の構造でJSONを返してください。

【出力ルール（厳守）】
・出力は JSON オブジェクト **のみ**。前後に説明文を書かない。
・マークダウンのコードフェンス（\`\`\`json など）を **使わない**。
・"response" はユーザーに見せるやさしい日本語の本文（共感 + 気づき + 助言、200文字以内）。
・"actions" は具体的な行動提案の文字列配列（1〜3件、各30文字以内）。
・"domains" は関連する領域名の配列（例：["資産"]、["健康","時間"]）。

【出力スキーマ】
{"domains": ["..."], "response": "...", "actions": ["...", "..."]}

【例】
入力: トヨタ株を持っています
出力: {"domains":["資産"],"response":"トヨタ株をお持ちなんですね。現在の評価額と購入時を比べてみると、これからの判断がしやすくなります。","actions":["評価額と購入額を比べる","配当金の履歴を確認する"]}`
    },

    image_analysis: {
      name: '画像分析',
      description: '写真やスクリーンショットを分析',
      prompt: `画像がアップロードされました。食事の写真、薬の写真、健康診断結果、証券会社の画面、レシートなど、内容を分析してわかりやすくアドバイスしてください。専門用語には説明を添えてください。日本語で回答。`
    },

    conversation_analysis: {
      name: '会話分析',
      description: 'チャット会話の履歴を分析',
      prompt: `過去の会話履歴を分析し、ユーザーの関心事・悩み・喜びのパターンを見つけてください。今必要な示唆を1つ、明日できる小さな行動を1つ提案してください。日本語で回答。`
    },

    product_recommendations: {
      name: '商品レコメンド',
      description: 'ユーザーの状況に合った商品を提案',
      prompt: `ユーザーの状況に合う商品（サプリ、本、道具、サービスなど）を3つ提案してください。それぞれに理由と、どこで買えるかを添えてください。日本語で回答。`
    },

    action_recommendations: {
      name: 'アクション提案',
      description: '今日からできる具体的な行動を提案',
      prompt: `ユーザーのデータを見て、今日から始められる具体的な行動を3つ提案してください。それぞれに「最初の5分でやること」を添えてください。日本語で回答。`
    },

    timeline_insight: {
      name: 'タイムライン洞察',
      description: '時系列の記録からパターンを見つける',
      prompt: `ユーザーの時系列記録からパターンを見つけ、気づきを3つ提供してください。強いパターンは「確からしさ高」、弱いものは「確からしさ中/低」と明記してください。日本語で回答。`
    },

    stock_analysis: {
      name: '銘柄の簡易分析（3論点）',
      description: 'VMハンズオンの絶対省略禁止3論点に絞った簡易分析',
      prompt: `ユーザーが銘柄名を入力しました。その銘柄について、VMハンズオン分析の「絶対省略禁止の3論点」に絞って簡潔に評価してください。

① 粉飾可能性（誠実さ）
・四半期CFO vs NI の乖離、資産増が利益増を上回る兆候、DSO/DIO/DPO/CCC の異常、のれん・無形資産の膨張、特損の繰り返し、監査法人変更・過年度訂正の有無を確認
・判定は ✅（問題なし）／⚠（要注意）／⛔（高リスク）のいずれかで明記
・根拠は一次資料ベースで、推測は避ける

② 割安度（バリュエーション）
・P/FCF、EV/EBITDA、P/E、P/B、配当利回り、自社株買い実績をピアと比較
・正規DCF（5年Base/Bull/Bear、WACC=CAPMベース）で本源価値を概算
・現在株価との乖離率（%）とともに判定（割安／妥当／割高）

③ 進化可能性（成長余地）
・7領域（プロダクト／VC／顧客／BM／組織／経営力／社格）＋経営民度で進化スコアを提示
・自走化のティッピングポイントを四半期単位で予測
・進化シナリオの確からしさ（高／中／低）を明記

【最終出力】
・3論点それぞれを 5〜10行で箇条書き
・最終ACTION: BUY / HOLD / SELL / WATCH のいずれか1つを確定
・confidence（0〜10）を併記
・日本語で回答。難解な専門用語には（日本語注釈）を付ける

※投資は自己責任です。必ず専門家にご相談ください。`
    }
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
    work:          ['course', 'certification', 'tool', 'networking_event', 'coaching'],
    relationship:  ['gift', 'event', 'course', 'travel', 'donation'],
    assets:        ['brokerage', 'advisor', 'course', 'tool', 'insurance']
  },

  // ─── WHO ICD-11 疾患分類（未病ダイアリー準拠の広範カバー） ───
  // 各カテゴリに主要疾患。選択は複数可。
  diseaseCategories: {
    neurological: {
      label: '神経系疾患',
      diseases: [
        'mecfs', 'fibromyalgia', 'long_covid', 'pots', 'migraine',
        'parkinson', 'alzheimer', 'als', 'multiple_sclerosis', 'epilepsy',
        'peripheral_neuropathy', 'dystonia', 'huntington'
      ]
    },
    mental: {
      label: '精神・行動の障害',
      diseases: [
        'depression', 'bipolar', 'anxiety', 'panic', 'ptsd',
        'ocd', 'adhd', 'autism', 'schizophrenia', 'eating_disorder',
        'insomnia', 'burnout', 'dementia_behavior'
      ]
    },
    immune: {
      label: '免疫系・膠原病',
      diseases: [
        'rheumatoid_arthritis', 'sle', 'sjogren', 'scleroderma', 'behcet',
        'vasculitis', 'allergy', 'asthma', 'eczema', 'hay_fever',
        'immunodeficiency', 'hashimoto', 'graves'
      ]
    },
    endocrine: {
      label: '内分泌・代謝',
      diseases: [
        'diabetes_type1', 'diabetes_type2', 'thyroid_hypo', 'thyroid_hyper',
        'adrenal_insufficiency', 'cushing', 'pcos', 'metabolic_syndrome',
        'obesity', 'gout', 'osteoporosis', 'dyslipidemia'
      ]
    },
    cardiovascular: {
      label: '循環器',
      diseases: [
        'hypertension', 'heart_failure', 'arrhythmia', 'coronary_artery',
        'stroke', 'pots_cv', 'varicose', 'dvt', 'pulmonary_hypertension',
        'valvular', 'cardiomyopathy'
      ]
    },
    respiratory: {
      label: '呼吸器',
      diseases: [
        'copd', 'asthma_resp', 'sleep_apnea', 'pneumonia', 'bronchitis',
        'pulmonary_fibrosis', 'tuberculosis', 'lung_cancer', 'allergic_rhinitis'
      ]
    },
    digestive: {
      label: '消化器',
      diseases: [
        'ibs', 'ibd', 'crohn', 'ulcerative_colitis', 'gerd',
        'peptic_ulcer', 'celiac', 'sibo', 'fatty_liver', 'hepatitis',
        'cirrhosis', 'pancreatitis', 'gallstones'
      ]
    },
    musculoskeletal: {
      label: '筋骨格系',
      diseases: [
        'osteoarthritis', 'lumbar_disc', 'cervical_spondylosis', 'scoliosis',
        'rotator_cuff', 'tendinitis', 'carpal_tunnel', 'hip_arthrosis',
        'knee_arthrosis', 'sarcopenia', 'muscular_dystrophy'
      ]
    },
    cancer: {
      label: 'がん',
      diseases: [
        'breast_cancer', 'lung_cancer_c', 'colorectal', 'gastric', 'prostate',
        'liver_cancer', 'pancreatic_cancer', 'ovarian', 'uterine',
        'thyroid_cancer', 'leukemia', 'lymphoma', 'multiple_myeloma',
        'cancer_general'
      ]
    },
    urogenital: {
      label: '泌尿器・生殖器',
      diseases: [
        'ckd', 'kidney_stones', 'uti', 'bph', 'incontinence',
        'menopause', 'endometriosis', 'uterine_fibroids', 'erectile_dysfunction'
      ]
    },
    other: {
      label: 'その他',
      diseases: [
        'chronic_pain', 'chronic_fatigue', 'anemia', 'vertigo', 'tinnitus',
        'glaucoma', 'cataract', 'macular_degeneration', 'hearing_loss',
        'other_unspecified'
      ]
    }
  },

  // ─── 拡張プロファイルスキーマ ───
  // 未病ダイアリー準拠のユーザー基本情報定義
  profileSchema: {
    // 基本情報
    basic: [
      { key: 'displayName', type: 'text', label: '表示名' },
      { key: 'age', type: 'number', label: '年齢' },
      { key: 'gender', type: 'select', options: ['male', 'female', 'other'], label: '性別' },
      { key: 'height', type: 'number', label: '身長 (cm)', step: 0.1 },
      { key: 'weight', type: 'number', label: '体重 (kg)', step: 0.1 },
      { key: 'bloodType', type: 'select', options: ['A', 'B', 'O', 'AB', 'unknown'], label: '血液型' },
      { key: 'birthdate', type: 'date', label: '生年月日' }
    ],
    // 居住・家族
    lifestyle: [
      { key: 'location', type: 'text', label: '居住地' },
      { key: 'householdSize', type: 'number', label: '世帯人数' },
      { key: 'householdComposition', type: 'select',
        options: ['single', 'couple', 'with_children', 'with_parents', 'multi_gen', 'other'],
        label: '世帯構成' },
      { key: 'occupation', type: 'text', label: '職業' },
      { key: 'lifestyle', type: 'textarea', label: '生活習慣（食事・運動・睡眠の概要）' }
    ],
    // 健康
    health: [
      { key: 'diseases', type: 'multiselect', label: '持病・気になる症状（複数選択可）' },
      { key: 'medications', type: 'textarea', label: '現在服用中の薬・サプリメント' },
      { key: 'allergies', type: 'textarea', label: 'アレルギー' },
      { key: 'primaryDoctor', type: 'text', label: 'かかりつけ医' },
      { key: 'insurance', type: 'text', label: '健康保険' },
      { key: 'lastCheckup', type: 'date', label: '最終健診日' }
    ],
    // 資産・収入
    financial: [
      { key: 'monthlyIncome', type: 'select',
        options: ['under_10', '10_20', '20_30', '30_50', '50_100', 'over_100', 'no_answer'],
        label: '月収（万円）' },
      { key: 'monthlyExpense', type: 'select',
        options: ['under_10', '10_20', '20_30', '30_50', '50_100', 'over_100', 'no_answer'],
        label: '月の支出（万円）' },
      { key: 'savings', type: 'select',
        options: ['under_500', '500_1000', '1000_3000', '3000_5000', '5000_10000', 'over_10000', 'no_answer'],
        label: '貯蓄額（万円）' },
      { key: 'investments', type: 'select',
        options: ['none', 'some', 'active', 'professional', 'no_answer'],
        label: '投資経験' },
      { key: 'pension', type: 'select',
        options: ['none', 'basic', 'welfare', 'both', 'no_answer'],
        label: '年金受給状況' },
      { key: 'housingStatus', type: 'select',
        options: ['owned', 'rented', 'with_family', 'other'],
        label: '住居' }
    ],
    // 目標・価値観
    goals: [
      { key: 'lifeGoals', type: 'textarea', label: '人生の目標・大切にしていること' },
      { key: 'concerns', type: 'textarea', label: '今の悩み・心配ごと' },
      { key: 'preferences', type: 'textarea', label: '好きなこと・趣味' }
    ]
  }
};
