# Broadcast - Multi-Platform Distribution System

思想・アイデア・メモを、世界中のあらゆるプラットフォームに一括配信するシステム。

LMS (Life Management System) と同じ技術スタック・デザイン・AI モデル・プロンプト設計で構築されており、
`index.html` (LMS) と `broadcast.html` (Broadcast) は同じ Firebase アカウントで共通ログインできます。

---

## 特徴

- **1 つ書けば、全プラットフォームへ**: 原稿を 1 つ書くだけで、24 以上のプラットフォームへ同時配信
- **AI による書き分け**: Claude Opus/Sonnet/Haiku 4.5/4.6, GPT-4o, Gemini Pro が各プラットフォームの文字数・文化・語調に合わせて自動書き分け
- **多言語翻訳配信**: 日・英・中・韓などへ自動翻訳
- **LMS と共通基盤**: Firebase 認証・AI Engine・Worker プロキシを共有
- **カスタマイズ可能なプロンプト**: 書き分け・翻訳・タイトル生成など、全 AI プロンプトを編集可能

---

## 対応プラットフォーム (24)

| カテゴリ          | プラットフォーム                                      | 認証方式        |
|-------------------|-------------------------------------------------------|-----------------|
| マイクロブログ    | X (Twitter), Threads, Mastodon, Bluesky               | OAuth2 / App PW |
| ソーシャル        | Facebook, Instagram, LinkedIn, Tumblr, Pinterest     | OAuth2          |
| ブログ・メディア  | Medium, note, はてなブログ, WordPress, Dev.to         | API token       |
| メッセンジャー    | Discord, Slack, Telegram, LINE, WhatsApp              | Webhook / Token |
| 掲示板・動画      | Reddit, YouTube Community                             | OAuth2          |
| その他            | Email, RSS, Custom Webhook                            | SMTP / URL      |

---

## ファイル構成

```
broadcast.html              # ランディングページ
broadcast-dashboard.html    # メインダッシュボード (書く/配信/接続/履歴/設定)
css/broadcast.css           # Broadcast 専用 CSS (LMS の styles.css を拡張)
js/broadcast-config.js      # プラットフォーム設定 + AI モデル + プロンプト
js/broadcast-store.js       # 状態管理 (LMS store と同じ設計)
js/broadcast-ai.js          # AI Engine (LMS AIEngine を再利用)
js/broadcast-platforms.js   # 各プラットフォームへの投稿処理
js/broadcast-app.js         # UI コントローラー
worker/broadcast-proxy.js   # CORS 回避・メール送信・RSS フィード用 Cloudflare Worker
```

---

## セットアップ

### 1. Firebase (LMS と共通)

すでに LMS で Firebase を設定済みの場合は追加作業は不要です。
未設定なら `SETUP.md` の手順で Firebase を有効化してください。

### 2. AI API キー

LMS 管理パネルから、または Broadcast の「設定」ページから以下の API キーを設定できます:

- **Anthropic API Key** (推奨): Claude Opus 4.6 / Sonnet 4.6 / Haiku 4.5
- **OpenAI API Key**: GPT-4o
- **Google API Key**: Gemini Pro

LMS と同じ API キーを自動で共有します (`localStorage: lms_apikey_*`)。

### 3. Cloudflare Worker のデプロイ (任意)

CORS 制約で直接叩けないプラットフォーム・メール送信・RSS フィードを使う場合、
`worker/broadcast-proxy.js` を Cloudflare Workers にデプロイしてください。

```bash
# wrangler をインストール
npm install -g wrangler
wrangler login

# デプロイ
cd worker
wrangler deploy broadcast-proxy.js --name broadcast-proxy
```

デプロイ後、生成された URL (例: `https://broadcast-proxy.your-account.workers.dev`) を
`js/broadcast-config.js` の `BROADCAST_CONFIG.endpoints.broadcastProxy` に設定。

**必要な環境変数 (Worker Dashboard → Settings → Variables):**

- `SENDGRID_API_KEY` (オプション): SendGrid でメール送信する場合。未設定なら MailChannels を使用
- `RSS_TITLE`: RSS フィードのタイトル
- `RSS_LINK`: サイトのリンク
- `RSS_KV` (KV バインディング): RSS アイテムを保存する KV ネームスペース

### 4. 各プラットフォームの接続

Broadcast ダッシュボード → 「プラットフォーム接続」ページから、
各プラットフォームの「接続」ボタンで認証情報を入力します。

#### マイクロブログ系

**X / Twitter**
- [Developer Portal](https://developer.twitter.com/en/portal/dashboard) で Client ID を発行
- OAuth 2.0 の User authentication settings で Redirect URI を `https://your-site.com/broadcast-dashboard.html` に設定
- Broadcast の接続画面で Client ID を入力 → 自動で OAuth 認証フローへ

**Threads**
- [Meta for Developers](https://developers.facebook.com/) で Threads API アクセスを申請
- 同じく Client ID を入力 → OAuth 認証

**Mastodon**
- 任意のインスタンス (例: `mastodon.social`) の Preferences → Development → New Application
- 生成されたアクセストークンをそのまま貼り付け

**Bluesky**
- Settings → App Passwords で生成
- ハンドル (例: `me.bsky.social`) と App Password を入力
- ログインセッションは初回投稿時に自動取得

#### ソーシャル系

**Facebook / Instagram**
- [Meta for Developers](https://developers.facebook.com/) でアプリを作成
- Graph API アクセスを有効化
- Page Access Token (長期) を取得して入力
- Instagram は画像が必須

**LinkedIn**
- [LinkedIn Developers](https://www.linkedin.com/developers/) でアプリを作成
- OAuth 2.0 の `w_member_social` スコープを有効化
- 認証後、プロフィール URN を自動取得

#### ブログ系

**Medium**
- Settings → Security → Integration tokens で発行
- `GET https://api.medium.com/v1/me` でユーザー ID を取得して入力

**note**
- 公式 API が無いため、クリップボード経由の手動投稿になります
- 配信時に AI が生成した本文が自動でクリップボードにコピーされ、note の新規投稿ページが開きます

**はてなブログ**
- 詳細設定 → API キーを発行
- はてな ID、ブログ ID (`example.hatenablog.com`)、API キーを入力
- AtomPub + WSSE 認証で投稿

**WordPress**
- プロフィール → Application Passwords で発行
- サイト URL (例: `example.com`)、ユーザー名、App Password を入力
- REST API で投稿

**Dev.to**
- Settings → Extensions → DEV Community API Keys で発行
- API キーを貼り付け

#### メッセンジャー系

**Discord**
- サーバー設定 → 連携サービス → Webhook で URL を発行
- そのまま貼り付け

**Slack**
- Slack App → Incoming Webhooks で URL を発行
- そのまま貼り付け

**Telegram**
- [@BotFather](https://t.me/botfather) で Bot を作成 → Bot Token を取得
- 投稿先チャンネル/グループ ID を取得 (`@channelname` または数値 ID)
- Bot をそのチャンネルに管理者として追加

**LINE**
- [LINE Developers](https://developers.line.biz/) で Messaging API チャンネルを作成
- Channel Access Token を入力
- Broadcast では友達全員に送信されます

#### その他

**Email**
- Worker がデプロイされていれば SMTP 経由で一括送信
- Worker 未設定なら `mailto:` フォールバック

**RSS**
- Worker がデプロイされていれば `/feed.xml` にアイテムが追加される
- フィード URL: `https://broadcast-proxy.your-account.workers.dev/feed.xml`

**Custom Webhook**
- 任意の URL に JSON ペイロードで POST
- 独自のブログシステム・Zapier・Make.com などと連携

---

## 使い方

### 基本フロー

1. **書く**: 「書く」ページで原稿を 1 つ書く
2. **プラットフォーム選択**: 配信したいプラットフォームをチェック
3. **AI で書き分け**: 「AI で各プラットフォーム向けに書き分け」ボタンをクリック
4. **プレビュー編集**: 各プラットフォーム向けに AI が生成した内容を確認・編集
5. **一斉配信**: 「🚀 一斉配信する」ボタンをクリック
6. **結果確認**: 「配信ログ」ページで各プラットフォームへの配信結果を確認

### プリセット

- **一言つぶやき**: X, Threads, Mastodon, Bluesky
- **長文エッセイ**: Medium, note, はてな, WordPress, Dev.to
- **アナウンス**: Twitter, Facebook, LinkedIn, Discord, Slack, Telegram
- **すべて**: 接続済みの全プラットフォーム

### AI モデルの選択

設定ページで使用する AI モデルを切り替えできます。
LMS と同じ `CONFIG.aiModels` を参照します:

- `claude-opus-4-6` (推奨): 最高品質の書き分け
- `claude-sonnet-4-6`: バランス型
- `claude-haiku-4-5`: 高速・低コスト
- `gpt-4o`: OpenAI
- `gemini-pro`: Google

### プロンプトのカスタマイズ

設定ページから各プロンプトを編集できます:

- `broadcast_adapt`: プラットフォーム書き分け
- `broadcast_translate`: 翻訳
- `broadcast_title`: タイトル生成
- `broadcast_hashtags`: ハッシュタグ生成
- `broadcast_summarize`: 要約
- `broadcast_analytics`: 配信後の分析

空にすると既定のプロンプトに戻ります。

---

## LMS との関係

Broadcast は LMS (Life Management System) と同じコードベース・同じ Firebase プロジェクト・
同じ認証アカウントで動作します。

| 共有しているもの           | Broadcast 専用                             |
|----------------------------|--------------------------------------------|
| Firebase 認証              | 配信先プラットフォーム設定                 |
| AI Engine (AIEngine)       | 書き分けプロンプト                         |
| API キー (Anthropic 等)    | 配信ログ                                   |
| Worker プロキシ (任意)     | スケジュール配信                           |
| CSS 基盤 (styles.css)      | プラットフォーム接続情報                   |
| Components (components.js) |                                            |

LMS の 6 領域 (意識・健康・時間・仕事・関係・資産) とは独立して動作しますが、
将来的には LMS の「意識」領域で記録した日記・思想を Broadcast に送信、
といった連携も想定しています。

---

## セキュリティ

- **トークン保存**: すべての API トークン・Webhook URL は `localStorage` に保存されます
- **Firebase 同期**: ログイン中は Firestore に暗号化されずに同期されます (Firestore Rules で自己データのみアクセス可)
- **APIキー**: LMS と同じく、Worker プロキシ経由でも `x-api-key` ヘッダーで直接送信されます

**重要**: 公開されている共有端末では使用しないでください。

---

## トラブルシューティング

### 「プラットフォームに接続されていません」エラー

接続ページで対象プラットフォームを接続してください。

### 「CORS エラー」「fetch failed」

- 直接ブラウザから叩けないプラットフォーム (Reddit, Tumblr など) は Worker プロキシが必要です
- `worker/broadcast-proxy.js` をデプロイし、`BROADCAST_CONFIG.endpoints.broadcastProxy` を設定

### AI が書き分けてくれない

- 設定ページで API キーが設定されているか確認
- `CONFIG.endpoints.anthropic` (LMS と共有) を確認

### 投稿が反映されない

- 各プラットフォームの投稿制限 (レート制限・スパムフィルター) を確認
- 「配信ログ」でエラーメッセージを確認

---

## ライセンス

LMS と同じ。詳細はルートの `SETUP.md` を参照。
