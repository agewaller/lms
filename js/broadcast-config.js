/* ============================================================
   Broadcast - Configuration
   Platforms, AI models, prompts
   LMS の CONFIG と同じ設計思想 (flat key prompts, マルチAIモデル)
   ============================================================ */
var BROADCAST_CONFIG = {

  // ─── App Info ───
  app: {
    name: 'Broadcast',
    fullName: 'Multi-Platform Distribution System',
    version: '1.0.0',
    description: '思想・アイデア・メモを世界中のあらゆるプラットフォームに一括配信'
  },

  // ─── AI Models (LMS と同じ) ───
  // 実際の呼び出しは LMS の AIEngine を再利用するので、
  // ここでは UI 表示用のメタデータのみ保持する
  aiModels: {
    'claude-opus-4-6':    { name: 'Claude Opus 4.6',   provider: 'anthropic', maxTokens: 4096, recommended: true },
    'claude-sonnet-4-6':  { name: 'Claude Sonnet 4.6', provider: 'anthropic', maxTokens: 4096 },
    'claude-haiku-4-5':   { name: 'Claude Haiku 4.5',  provider: 'anthropic', maxTokens: 4096 },
    'gpt-4o':             { name: 'GPT-4o',            provider: 'openai',    maxTokens: 4096 },
    'gemini-pro':         { name: 'Gemini Pro',        provider: 'google',    maxTokens: 4096 }
  },

  // ─── API Endpoints (LMS と共有) ───
  endpoints: {
    anthropic: 'https://lms-api-proxy.your-account.workers.dev',
    openai: 'https://api.openai.com/v1/chat/completions',
    google: 'https://generativelanguage.googleapis.com/v1beta/models',
    broadcastProxy: 'https://broadcast-proxy.your-account.workers.dev' // CORS回避用プロキシ(任意)
  },

  // ─── Supported Platforms ───
  // category:
  //   microblog   - X, Threads, Mastodon, Bluesky
  //   social      - Facebook, Instagram, LinkedIn, Tumblr, Pinterest
  //   blog        - Medium, note, はてなブログ, WordPress, Dev.to
  //   messenger   - Discord, Slack, Telegram, LINE, WhatsApp
  //   media       - YouTube, Reddit
  //   other       - Email, RSS, Webhook
  //
  // auth:
  //   oauth2      - OAuth 2.0 Implicit/Auth Code flow
  //   token       - API key / access token 直接入力
  //   app-password- ATProto 系の app password
  //   webhook     - Webhook URL
  //   smtp        - SMTP server 経由
  //   worker      - 自前 Worker 経由で送信
  //   manual      - 公式API無し → クリップボード＆新規タブ
  //
  // charLimit: 投稿の最大文字数 (0 = 無制限)
  platforms: {
    twitter: {
      id: 'twitter', name: 'X / Twitter', icon: '𝕏', color: '#000000',
      category: 'microblog', auth: 'oauth2', charLimit: 280,
      tone: 'casual_short', hashtags: true,
      oauth: {
        authUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        scope: 'tweet.read tweet.write users.read offline.access'
      },
      postUrl: 'https://api.twitter.com/2/tweets',
      shareUrl: 'https://twitter.com/intent/tweet?text='
    },
    facebook: {
      id: 'facebook', name: 'Facebook', icon: 'f', color: '#1877F2',
      category: 'social', auth: 'oauth2', charLimit: 63206,
      tone: 'conversational', hashtags: true,
      oauth: {
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        scope: 'pages_manage_posts,pages_read_engagement,public_profile'
      },
      postUrl: 'https://graph.facebook.com/v18.0/me/feed',
      shareUrl: 'https://www.facebook.com/sharer/sharer.php?u='
    },
    instagram: {
      id: 'instagram', name: 'Instagram', icon: '📷', color: '#E4405F',
      category: 'social', auth: 'oauth2', charLimit: 2200,
      tone: 'visual_caption', hashtags: true, requiresImage: true,
      oauth: {
        authUrl: 'https://api.instagram.com/oauth/authorize',
        scope: 'instagram_business_content_publish'
      },
      postUrl: 'https://graph.facebook.com/v18.0/me/media',
      shareUrl: null // IG はシェアURL無し
    },
    threads: {
      id: 'threads', name: 'Threads', icon: '@', color: '#000000',
      category: 'microblog', auth: 'oauth2', charLimit: 500,
      tone: 'casual_medium', hashtags: true,
      oauth: {
        authUrl: 'https://threads.net/oauth/authorize',
        scope: 'threads_basic,threads_content_publish'
      },
      postUrl: 'https://graph.threads.net/v1.0/me/threads',
      shareUrl: 'https://www.threads.net/intent/post?text='
    },
    linkedin: {
      id: 'linkedin', name: 'LinkedIn', icon: 'in', color: '#0A66C2',
      category: 'social', auth: 'oauth2', charLimit: 3000,
      tone: 'professional', hashtags: true,
      oauth: {
        authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        scope: 'w_member_social r_liteprofile'
      },
      postUrl: 'https://api.linkedin.com/v2/ugcPosts',
      shareUrl: 'https://www.linkedin.com/sharing/share-offsite/?url='
    },
    mastodon: {
      id: 'mastodon', name: 'Mastodon', icon: '🐘', color: '#6364FF',
      category: 'microblog', auth: 'oauth2', charLimit: 500,
      tone: 'casual_medium', hashtags: true,
      instanceRequired: true, // ユーザーに instance URL を聞く
      postUrlTemplate: 'https://{instance}/api/v1/statuses'
    },
    bluesky: {
      id: 'bluesky', name: 'Bluesky', icon: '🦋', color: '#0085FF',
      category: 'microblog', auth: 'app-password', charLimit: 300,
      tone: 'casual_short', hashtags: true,
      sessionUrl: 'https://bsky.social/xrpc/com.atproto.server.createSession',
      postUrl: 'https://bsky.social/xrpc/com.atproto.repo.createRecord'
    },
    reddit: {
      id: 'reddit', name: 'Reddit', icon: '🤖', color: '#FF4500',
      category: 'media', auth: 'oauth2', charLimit: 40000,
      tone: 'longform_title_body', hashtags: false,
      subredditRequired: true,
      oauth: {
        authUrl: 'https://www.reddit.com/api/v1/authorize',
        scope: 'submit identity'
      },
      postUrl: 'https://oauth.reddit.com/api/submit',
      shareUrl: 'https://www.reddit.com/submit?url='
    },
    medium: {
      id: 'medium', name: 'Medium', icon: 'M', color: '#00AB6C',
      category: 'blog', auth: 'token', charLimit: 0,
      tone: 'longform_essay', hashtags: false, tagsMax: 5,
      postUrl: 'https://api.medium.com/v1/users/{userId}/posts'
    },
    note: {
      id: 'note', name: 'note', icon: '📝', color: '#41C9B4',
      category: 'blog', auth: 'manual', charLimit: 0,
      tone: 'longform_essay_jp', hashtags: false,
      shareUrl: 'https://note.com/notes/new'
      // note は公式API無し → クリップボード + 新規タブ
    },
    hatena: {
      id: 'hatena', name: 'はてなブログ', icon: 'H', color: '#00A4DE',
      category: 'blog', auth: 'token', charLimit: 0,
      tone: 'longform_essay_jp', hashtags: false,
      postUrlTemplate: 'https://blog.hatena.ne.jp/{hatenaId}/{blogId}/atom/entry'
      // WSSE 認証 + AtomPub
    },
    wordpress: {
      id: 'wordpress', name: 'WordPress', icon: 'W', color: '#21759B',
      category: 'blog', auth: 'token', charLimit: 0,
      tone: 'longform_article', hashtags: false,
      siteRequired: true,
      postUrlTemplate: 'https://{site}/wp-json/wp/v2/posts'
    },
    devto: {
      id: 'devto', name: 'Dev.to', icon: '⌨', color: '#0A0A0A',
      category: 'blog', auth: 'token', charLimit: 0,
      tone: 'technical_article', hashtags: false, tagsMax: 4,
      postUrl: 'https://dev.to/api/articles'
    },
    tumblr: {
      id: 'tumblr', name: 'Tumblr', icon: 't', color: '#35465C',
      category: 'social', auth: 'oauth2', charLimit: 4096,
      tone: 'creative_casual', hashtags: true,
      oauth: { authUrl: 'https://www.tumblr.com/oauth2/authorize', scope: 'write' },
      postUrlTemplate: 'https://api.tumblr.com/v2/blog/{blog}/posts'
    },
    pinterest: {
      id: 'pinterest', name: 'Pinterest', icon: 'P', color: '#BD081C',
      category: 'social', auth: 'oauth2', charLimit: 500,
      tone: 'visual_caption', hashtags: false, requiresImage: true,
      oauth: { authUrl: 'https://www.pinterest.com/oauth/', scope: 'pins:write,boards:read' },
      postUrl: 'https://api.pinterest.com/v5/pins'
    },
    discord: {
      id: 'discord', name: 'Discord', icon: '🎮', color: '#5865F2',
      category: 'messenger', auth: 'webhook', charLimit: 2000,
      tone: 'casual_community', hashtags: false
      // Webhook URL: https://discord.com/api/webhooks/{id}/{token}
    },
    slack: {
      id: 'slack', name: 'Slack', icon: '#', color: '#4A154B',
      category: 'messenger', auth: 'webhook', charLimit: 40000,
      tone: 'professional_chat', hashtags: false
      // Incoming Webhook URL
    },
    telegram: {
      id: 'telegram', name: 'Telegram', icon: '✈', color: '#0088CC',
      category: 'messenger', auth: 'token', charLimit: 4096,
      tone: 'casual_medium', hashtags: true,
      chatIdRequired: true,
      postUrlTemplate: 'https://api.telegram.org/bot{token}/sendMessage'
    },
    line: {
      id: 'line', name: 'LINE', icon: 'L', color: '#00B900',
      category: 'messenger', auth: 'token', charLimit: 5000,
      tone: 'casual_friendly_jp', hashtags: false,
      postUrl: 'https://api.line.me/v2/bot/message/broadcast'
    },
    whatsapp: {
      id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: '#25D366',
      category: 'messenger', auth: 'manual', charLimit: 65536,
      tone: 'casual_medium', hashtags: false,
      shareUrl: 'https://wa.me/?text='
    },
    email: {
      id: 'email', name: 'Email / Gmail', icon: '✉', color: '#EA4335',
      category: 'other', auth: 'smtp', charLimit: 0,
      tone: 'newsletter', hashtags: false,
      // Worker 経由で SMTP 送信 (または mailto: でフォールバック)
      shareUrl: 'mailto:?subject={subject}&body={body}'
    },
    rss: {
      id: 'rss', name: 'RSS / Atom Feed', icon: '📡', color: '#FF6600',
      category: 'other', auth: 'none', charLimit: 0,
      tone: 'longform_article', hashtags: false
      // 自動的に feed.xml に追加 (Firestore 保存 + Worker で配信)
    },
    youtube: {
      id: 'youtube', name: 'YouTube Community', icon: '▶', color: '#FF0000',
      category: 'media', auth: 'oauth2', charLimit: 1500,
      tone: 'engaging_short', hashtags: true,
      oauth: { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', scope: 'https://www.googleapis.com/auth/youtube' }
    },
    webhook: {
      id: 'webhook', name: 'Custom Webhook', icon: '＋', color: '#999999',
      category: 'other', auth: 'webhook', charLimit: 0,
      tone: 'raw', hashtags: false
    }
  },

  // ─── Platform Categories (UI grouping) ───
  categories: {
    microblog: { label: 'マイクロブログ',        icon: '📱' },
    social:    { label: 'ソーシャルネットワーク', icon: '👥' },
    blog:      { label: 'ブログ・メディア',      icon: '📖' },
    messenger: { label: 'メッセンジャー',         icon: '💬' },
    media:     { label: '掲示板・動画',           icon: '📺' },
    other:     { label: 'その他',                 icon: '📦' }
  },

  // ─── AI Prompts (flat key 構造 = LMS の CONFIG.prompts と同じ) ───
  // key: broadcast_{purpose}_{platform?}
  prompts: {

    // ─── 基本: 原稿から各プラットフォーム向けに書き分ける ───
    broadcast_adapt: {
      name: 'プラットフォーム最適化',
      description: '元の思想・アイデアを指定したプラットフォームの文化・字数・語調に合わせて書き直す',
      schedule: 'on_demand',
      active: true,
      prompt: `あなたはマルチプラットフォーム配信の編集者です。
著者の「元の思想・アイデア・メモ」を、指定されたプラットフォームに最適な形で書き直してください。

【基本原則】
1. 元のメッセージの本質・著者の声・熱量を必ず保つ
2. 各プラットフォームの文字数制限を厳守する
3. そのプラットフォームの文化・読者層・慣習を踏まえた語調にする
4. ハッシュタグが慣習的なプラットフォームでは 2〜5 個を自然に混ぜる
5. 著者の思想を歪めたり、無難に薄めたりしない
6. 元の言語（日本語）が基本。指示があれば翻訳する

【プラットフォーム別の書き方の指針】
- X/Twitter (280字):      要点を圧縮、引きのある一文、絵文字は最小限
- Threads (500字):        X より少しゆったり、対話を誘う
- Mastodon (500字):       誠実で丁寧、スラングは控える
- Bluesky (300字):        カジュアル、技術系コミュニティ意識
- Facebook (長文OK):      ストーリーテリング、個人的な気づきを前面に
- Instagram (2200字):     ビジュアル前提のキャプション、情緒的な余韻
- LinkedIn (3000字):      プロフェッショナル、学び・洞察を軸に
- Tumblr:                 自由形式、カルチャー寄りの語り
- Reddit:                 タイトル(100字)と本文を分ける、自己紹介的 lead
- Medium (長文):          エッセイ構成(導入→洞察→結論)、小見出し
- note (長文):            日本語エッセイ、読者との距離感を大切に
- はてなブログ:           論考寄り、見出しで構造化
- WordPress:              SEO 意識した本格記事、H2/H3 を使う
- Dev.to:                 技術エッセイ、コード例は保持
- Discord / Slack:        コミュニティ向けカジュアル、要点先
- Telegram / LINE:        親しみ、結論から、絵文字OK
- Email Newsletter:       挨拶→本題→結び、件名も生成
- Pinterest:              短く視覚的、検索されるキーワード
- RSS:                    原文の要約 + 全文リンク

【出力フォーマット（厳守）】
最上段に「---TITLE---」見出し行、次の行にタイトル（タイトルが必要ないプラットフォームは空行）。
次に「---BODY---」見出し行、その後に本文。
末尾に「---TAGS---」見出し行、カンマ区切りのタグ（不要なら空行）。
他に文章を出力しないこと。

例:
---TITLE---
（タイトル）
---BODY---
（本文）
---TAGS---
tag1, tag2, tag3`
    },

    // ─── 翻訳配信 ───
    broadcast_translate: {
      name: '翻訳',
      description: '元の文章を指定した言語に翻訳する（プラットフォームの語調を保つ）',
      schedule: 'on_demand',
      active: true,
      prompt: `あなたは多言語配信の翻訳者です。
与えられた文章を指定された言語に翻訳してください。

【原則】
1. 著者の声・熱量・比喩を保つ
2. 機械翻訳ではなく、現地の読者に自然に届く言葉選びをする
3. 固有名詞はそのまま、必要ならカッコで説明を添える
4. ハッシュタグは翻訳せず、現地で一般的なタグに置き換える
5. 文字数制限（指定されていれば）を超えない

出力は翻訳後の本文のみ。前置きや注釈は不要。`
    },

    // ─── タイトル生成 ───
    broadcast_title: {
      name: 'タイトル生成',
      description: 'ブログ系プラットフォーム向けの魅力的なタイトルを生成',
      schedule: 'on_demand',
      active: true,
      prompt: `あなたは編集者です。以下の本文に合う、魅力的で誠実なタイトルを 1 つだけ生成してください。
- 誇大表現や釣りタイトルは避ける
- 内容を正確に表す
- 読み手が「続きを読みたい」と思える
- 30 文字前後（日本語）または 80 字前後（英語）

出力はタイトル 1 行のみ。`
    },

    // ─── ハッシュタグ生成 ───
    broadcast_hashtags: {
      name: 'ハッシュタグ生成',
      description: 'プラットフォーム向けの適切なハッシュタグを提案',
      schedule: 'on_demand',
      active: true,
      prompt: `以下の文章の内容に基づき、指定プラットフォームで効果的なハッシュタグを 3〜5 個提案してください。
- 流行り過ぎず、検索されやすいもの
- 内容と関係のないハッシュタグは禁止
- プラットフォームの慣習に従う (英/日混在可)
出力はカンマ区切りのタグのみ (例: #技術 #エッセイ #思考) 。`
    },

    // ─── 要約 ───
    broadcast_summarize: {
      name: '要約',
      description: '長文を指定文字数に要約する',
      schedule: 'on_demand',
      active: true,
      prompt: `以下の文章を指定された文字数以内で要約してください。
- 結論を先に
- 著者の主張を歪めない
- 引きのある一文で始める
出力は要約本文のみ。`
    },

    // ─── 配信後の分析 ───
    broadcast_analytics: {
      name: '配信結果の分析',
      description: '各プラットフォームの配信結果を俯瞰し、次回のための学びを抽出',
      schedule: 'post_distribution',
      active: true,
      prompt: `あなたはコンテンツマーケティングのアナリストです。
複数プラットフォームへの配信結果（投稿時刻・文字数・リアクション数など）を見て、以下をまとめてください。
1. どのプラットフォームで最も響いたか
2. 共通する傾向（時間帯・トピック・トーン）
3. 次回試す価値のある変更（2つまで）
押しつけず、観察として伝える。日本語で回答。`
    }
  },

  // ─── Default Distribution Presets ───
  presets: {
    'short_thought': {
      name: '一言つぶやき',
      description: '短いつぶやきを主要マイクロブログへ',
      platforms: ['twitter', 'threads', 'mastodon', 'bluesky']
    },
    'long_essay': {
      name: '長文エッセイ',
      description: '長文をブログ系プラットフォームへ',
      platforms: ['medium', 'note', 'hatena', 'wordpress', 'devto']
    },
    'announcement': {
      name: 'アナウンス',
      description: 'ソーシャル＋メッセンジャーへ一斉通知',
      platforms: ['twitter', 'facebook', 'linkedin', 'discord', 'slack', 'telegram']
    },
    'all': {
      name: 'すべて',
      description: '接続済みの全プラットフォームに配信',
      platforms: null // null = 接続済みの全て
    }
  }
};

// Expose for non-module scripts
if (typeof window !== 'undefined') window.BROADCAST_CONFIG = BROADCAST_CONFIG;
