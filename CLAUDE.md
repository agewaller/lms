# CLAUDE.md — LMS (Life Management System)

このファイルは Claude Code がこのプロジェクトで作業する際の指示書です。
すべてのタスクでこの内容に従ってください。

## プロジェクト概要

**LMS** は、65歳以上の一般ユーザーが人生の6領域（意識・健康・時間・仕事・関係・資産）を
統合的に管理するためのWebアプリケーションです。

- **対象ユーザー**: 素人。専門家でも研究者でもなく、苦しんでいる一般人
- **表現**: 専門用語ゼロ。小学5年生でもわかる日本語
- **中身**: 最も正確で深い示唆。手抜きしない
- **行動**: 自動化を最大限に。ユーザーの手を煩わせない
- **デザイン**: シンプルで洗練。ありきたりのアイコンは使わない
- **ユーザー画面にAIの文字を出さない**: 「相談する」「分析」「アドバイザー」等に言い換え

## 技術スタック

- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript（フレームワークなし）
- **Auth**: Firebase Authentication (Google + Email/Password)
- **DB**: Firebase Firestore + Firebase Storage
- **AI**: Anthropic Claude / OpenAI GPT / Google Gemini
- **Proxy**: Cloudflare Workers（direct modeもサポート）
- **Hosting**: GitHub Pages（mainブランチから自動デプロイ）
- **多言語**: 独自i18nモジュール（ja/en/zh/ko）

## ファイル構造

```
lms/
├── index.html                    ← トップLP
├── {domain}.html                 ← 6領域のLP
├── dashboard.html                ← ログイン後のメインSPA
├── css/styles.css                ← 全スタイル（未病ダイアリー準拠）
├── js/
│   ├── config.js                 ← 設定・プロンプト・ドメイン定義
│   ├── store.js                  ← 状態管理（リアクティブ + localStorage + Firestore）
│   ├── i18n.js                   ← 多言語
│   ├── components.js             ← 共通UI部品
│   ├── ai-engine.js              ← AI統一呼び出し（直接/プロキシ両対応）
│   ├── firebase-backend.js       ← 認証・Firestore・Storage・管理者共有config
│   ├── affiliate.js              ← アフィリエイト + PayPal
│   ├── calendar.js               ← カレンダー統合
│   ├── integrations.js           ← Plaud/Google/Fitbit/Apple/Outlook/Withings/Garmin
│   ├── sns-integrations.js       ← Gmail/Facebook/Instagram/X/LinkedIn/WhatsApp/LINE/Telegram/WeChat/Kakao/Discord
│   ├── time-marketplace.js       ← 空き時間販売
│   ├── assets-features.js        ← NISA/株式/自動売買
│   ├── work-features.js          ← 副業診断/求人連携
│   ├── relationship-features.js  ← 孤立スコア/今日連絡
│   ├── pages.js                  ← ページ描画
│   └── app.js                    ← メインコントローラ
├── worker/
│   ├── anthropic-proxy.js        ← Claude API中継
│   └── email-ingest.js           ← Plaudメール受信
├── firestore.rules               ← データベース権限
├── storage.rules                 ← ファイル権限
├── SETUP.md                      ← OAuth/Firebase/API設定手順書
└── CLAUDE.md                     ← このファイル
```

## 6つのライフドメイン

| # | ID | 名前 | 色 | 概要 |
|---|------|------|-----|------|
| 一 | consciousness | 意識 | #6C63FF | 禅トラック七つのレイヤー定点観測 |
| 二 | health | 健康 | #10b981 | 未病ダイアリー構造準拠 |
| 三 | time | 時間 | #f59e0b | カレンダー連携・空き時間販売 |
| 四 | work | 仕事 | #3b82f6 | 副業診断・ボランティア・有償/無償 |
| 五 | relationship | 関係 | #ef4444 | 孤立スコア・5段階距離感・SNS取込 |
| 六 | assets | 資産 | #d97706 | VMハンズオン銘柄分析・プラチナNISA |

## 管理者 vs ユーザー

- **管理者**: `agewaller@gmail.com` + 動的admin/config.adminEmails
- **管理者のみ**: AIモデル選択、APIキー、プロンプト編集、OAuth Client ID、ユーザー管理
- **一般ユーザー**: 管理者が設定したAI・プロンプトを自動継承。「AI」の文字は表示しない
- **データ格納**: 全てFirestore（localStorageはオフラインキャッシュのみ）

## コーディング規約

### 全般
- **命名**: JavaScript は camelCase、HTML/CSS は kebab-case
- **コメント**: 必要最小限。「なぜ」のみ書く（「何」は書かない）
- **関数**: 短く保つ。30行を超えたら分割を検討
- **エラー**: 境界（ユーザー入力、外部API）でのみバリデーション
- **UI文言**: 日本語。コード内のキーは英語
- **専門用語**: ユーザー向けテキストでは禁止。管理者向け・コメント内はOK

### JavaScript
- `var` でグローバルモジュール定義（Vanilla JS、import/export不使用）
- `const`/`let` は関数スコープ内で
- テンプレートリテラルでHTML生成
- `store.set()` / `store.get()` でデータ管理
- `Components.showToast()` でユーザー通知
- `CONFIG.domains[domainId]` でドメイン設定取得
- `i18n.t('key')` で多言語文字列取得

### CSS
- CSS変数は `:root` で定義（未病ダイアリーのデザインシステム準拠）
- `--accent: #6C63FF` がプライマリカラー
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` の3段階背景
- `--radius: 12px`, `--radius-sm: 8px` のボーダー半径
- モバイルファースト: `@media (max-width: 768px)` でサイドバーオーバーレイ

### プロンプト構造
- `CONFIG.prompts` のフラットキー形式: `{domain}_{type}`
- 各プロンプトはオブジェクト: `{ name, domain, description, schedule, active, prompt }`
- `CONFIG.inlinePrompts` でクイック分析用
- 管理者はadmin画面からプロンプトを追加・編集・削除可能

## AI 呼び出し

```javascript
// 分析実行
const result = await AIEngine.analyze(domain, promptType, { text: userInput });

// プロンプトキー解決
// buildSystemPrompt(domain, promptType) が以下を順に探索:
// 1. store.customPrompts[key] (管理者カスタム)
// 2. CONFIG.prompts[key] (デフォルト)
// 3. CONFIG.inlinePrompts[key] (インライン)
// 4. フォールバック: universal_daily
```

## データフロー

```
ユーザー入力 → store.addDomainEntry(domain, category, data)
              → localStorage に即座保存
              → Firestore listeners が自動同期
              → Firestore subcollection /users/{uid}/{domain}_{category}/ に保存
```

## OAuth Client ID の共有

管理者が一度設定すれば全ユーザーがボタン1つで外部サービスに接続:
- `CONFIG.oauthClientIds` に格納
- `admin/config.oauthClientIds` 経由で Firestore 同期
- 各モジュールの `getClientId()` が CONFIG > localStorage の優先順で取得

## テスト

現時点ではユニットテストフレームワーク未導入。以下で代替:
- `node -c file.js` で構文チェック
- ブラウザでの手動動作確認
- 接続テストボタン（管理画面）

## デプロイ

```bash
# feature branch
git push -u origin claude/life-management-system-95hjH

# main にマージ & デプロイ
git checkout main && git merge claude/life-management-system-95hjH && git push origin main

# feature branch に戻る
git checkout claude/life-management-system-95hjH
```

GitHub Pages は main ブランチの push で自動デプロイ。
Cloudflare Worker は `worker/**` の変更で自動デプロイ（GitHub Actions）。

## 壊してはいけないもの

- Firebase認証フロー（Google + Email/Password）
- 管理者判定ロジック（isAdmin()）
- Firestore データ同期（enableAutoSync）
- 既存ユーザーの保存データ（persistKeys のキー名変更禁止）
- 直接モード（anthropic-dangerous-direct-browser-access）
- 未病ダイアリーとのFirebaseプロジェクト共有
- プロキシ/直接モードの切替機能

## 参照すべきもの

- **未病ダイアリー**: https://github.com/agewaller/stock-screener （構造の原型）
- **SETUP.md**: OAuth/Firebase/APIの設定手順書
- **CONFIG.profileSchema**: ユーザープロファイルのスキーマ定義
- **CONFIG.diseaseCategories**: WHO ICD-11 疾患分類
- **CONFIG.prompts**: 全AIプロンプト定義

---

## 外部サービス統合プラン（車輪の再発明をしない）

原則: **既存のサービス・ライブラリで解決できるものはゼロから作らない**。
ただし LMS の「管理者が一度設定すれば全ユーザーが使える」アーキテクチャを維持するため、
各サービスの Client ID / API キーは `admin/config` や `admin/secrets` に格納する。

### 現状の外部サービス（実装済）

| 機能 | 採用サービス | 統合方法 |
|------|-------------|---------|
| **認証** | Firebase Authentication | `js/firebase-backend.js` の `signInWithGoogle()` / `signInWithEmail()` |
| **DB** | Firebase Firestore | `js/firebase-backend.js` の `loadUserData()` / `enableAutoSync()` |
| **ファイル** | Firebase Storage | `FirebaseBackend.uploadFile()` で `/users/{uid}/{path}/` に保存 |
| **決済 (1)** | PayPal Subscriptions | `js/affiliate.js` の `PayPalManager` |
| **AI** | Anthropic Claude / OpenAI / Google Gemini | `js/ai-engine.js` の `callAnthropic() / callOpenAI() / callGemini()` |
| **カレンダー** | Google Calendar / Microsoft Graph | `js/integrations.js` の `googleCalendar` / `outlookCalendar` |
| **ヘルスケア** | Fitbit / Apple Health / Withings | `js/integrations.js` |
| **メール受信** | Cloudflare Email Workers | `worker/email-ingest.js`（Plaud 自動取込） |

### 追加候補サービス

以下のサービスは **必要になったタイミングで追加する**。
現時点では実装しないが、実装時の最小変更点を記載しておく。

#### 決済 (2): Stripe

**追加理由**: PayPalはサブスクリプション管理が中心。単発決済・従量課金・請求書発行が必要になったら Stripe を追加する。

**統合ポイント**:
- 新規ファイル: `js/stripe-integration.js`
- Stripe Checkout（リダイレクト方式）でCORS問題を回避
- 管理画面 → APIキータブ に Stripe Publishable Key 入力欄を追加
- `CONFIG.stripe.publishableKey` に格納（公開キーなので安全）
- 秘密鍵は Cloudflare Worker 経由（`worker/stripe-proxy.js` を追加）
- `store.subscription` に Stripe subscription ID を保存
- Webhook は Cloudflare Worker で受信して Firestore に書込

**最小実装**:
```javascript
// js/stripe-integration.js
var StripeIntegration = {
  async checkout(priceId) {
    const stripe = Stripe(CONFIG.stripe.publishableKey);
    await stripe.redirectToCheckout({
      lineItems: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      successUrl: window.location.origin + '/dashboard.html?payment=success',
      cancelUrl: window.location.origin + '/dashboard.html?payment=cancel'
    });
  }
};
```

**優先度**: **中**（アフィリエイト以外の収益源が必要になったら）

---

#### メール送信: Resend または SendGrid

**追加理由**: 現在はメール送信機能がない。以下で必要になる:
- ユーザー登録時のウェルカムメール
- パスワードリセット（Firebase Auth 標準機能で代替可）
- 日次/週次レポートのメール配信
- アラート通知（孤立スコア警告、誕生日リマインダ）

**統合ポイント**:
- 新規ファイル: `worker/mail-sender.js`（Cloudflare Worker）
- Resend 推奨（無料枠が大きい、日本からのメール到達率が良い）
- `CONFIG.mail.resendApiKey` を `admin/secrets` に格納
- `MailSender.send(to, template, data)` API をフロントから呼出
- テンプレートは `CONFIG.mailTemplates` で一元管理

**最小実装**:
```javascript
// worker/mail-sender.js
export default {
  async fetch(request, env) {
    const { to, subject, html } = await request.json();
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: 'lms@agewaller.com', to, subject, html })
    });
    return new Response(await res.text(), { status: res.status });
  }
};
```

**代替案**: Firebase Extensions の `Trigger Email` を使えば Worker 不要。Firestore `mail/` コレクションへの書込でメール送信が自動実行される。こちらの方が LMS の設計思想（全てFirestore）に沿う。

**優先度**: **高**（ユーザーへの能動的な通知機能は成長に必須）

---

#### 検索: Algolia

**追加理由**: 以下の場面で全文検索が必要になる:
- 管理画面のユーザー検索（現在は line-by-line フィルタで代替）
- 個人のデータブラウザ（現在は全文検索済だが、データ量が増えると重くなる）
- プロンプトライブラリの検索
- 疾患名・症状の検索

**統合ポイント**:
- 新規ファイル: `js/algolia-search.js`
- Algolia InstantSearch JS（CDN読込）
- `CONFIG.algolia.appId` + `CONFIG.algolia.searchApiKey` を `admin/config` に格納
- インデックス: `users`, `prompts`, `records`
- Firestore → Algolia の同期は Firebase Extension（`Search with Algolia`）で自動化

**最小実装**:
```javascript
// js/algolia-search.js
var AlgoliaSearch = {
  client: null,
  init() {
    if (!CONFIG.algolia?.appId) return;
    this.client = algoliasearch(CONFIG.algolia.appId, CONFIG.algolia.searchApiKey);
  },
  async search(indexName, query) {
    const index = this.client.initIndex(indexName);
    const { hits } = await index.search(query);
    return hits;
  }
};
```

**代替案**: データ量が10万件未満なら Firestore のクライアント側フィルタで十分。Algolia は 1000ユーザー以上で検討。

**優先度**: **低**（現状のデータブラウザで十分）

---

#### UI コンポーネント: shadcn/ui の原則のみ採用

**採用不可の理由**: shadcn/ui は React + Tailwind CSS ベース。LMS は Vanilla JS なので直接は使えない。

**採用する原則**:
- **コピペ可能な独立コンポーネント**: `js/components.js` の関数は外部依存なしで動作する
- **アクセシビリティ重視**: ARIA属性、キーボード操作、コントラスト比
- **カスタマイズ可能**: CSS変数で全コンポーネントの見た目を変更可能
- **最小限のスタイル**: 未病ダイアリーの `--accent` を軸にした控えめなデザイン

**参考にする shadcn/ui コンポーネント**（JS版を自作する場合）:
- Dialog → 既存の `.modal-overlay` で代替
- Command palette → `/` キーでスラッシュコマンド起動
- Toast → 既存の `Components.showToast()`
- Tabs → 既存の管理画面タブで代替
- Form → 既存の `Components.dataEntryForm()` で代替

**優先度**: **現状維持**（採用しない）

---

#### 認証代替: Clerk / Supabase Auth

**追加不要の理由**: Firebase Authentication が以下すべてを提供済:
- Google OAuth
- Email/Password
- パスワードリセット
- セッション管理
- カスタムクレーム（管理者フラグ）
- 多要素認証（有料プラン）

**Clerk を検討するケース**: organization 機能や高度な SSO が必要になったら（現状のソロユーザー向けには過剰）
**Supabase Auth を検討するケース**: DB も Supabase に移行するなら同時採用（現状の Firebase から乗り換える必然性はない）

**優先度**: **現状維持**（採用しない）

---

#### DB 代替: Supabase (PostgreSQL)

**追加不要の理由**: Firebase Firestore + Storage でユーザーデータ管理は十分。

**Supabase を検討するケース**:
- SQL による複雑なクエリ（統計・ランキング・分析）が必要
- リレーショナルデータモデル（家族関係、グループチャット等）
- 1ユーザーあたり100万件超のレコード

**優先度**: **現状維持**（採用しない）

---

### 統合時の共通ルール

新しい外部サービスを追加するときは、必ず以下のパターンに従う:

1. **管理画面でキーを設定**: admin → APIキー タブに入力欄を追加
2. **`admin/config` または `admin/secrets` に保存**: 全ユーザーで共有（per-userのトークンのみ localStorage）
3. **`CONFIG.{service}` に展開**: `js/config.js` で型とデフォルト値を定義
4. **モジュールは単一ファイル**: `js/{service}-integration.js` に集約
5. **フォールバック必須**: サービス未設定でも LMS 全体が動く状態を維持
6. **ユーザー画面では名称を出さない**: 「通知メールを送信」「検索する」等の一般名詞で表示
7. **SETUP.md に設定手順を追加**: 非エンジニアが設定できるレベルで記述

### 判断のチェックリスト

新しい機能が必要になったとき、以下の順に検討する:

1. **既存の LMS 機能で代替できないか？**
2. **既存の外部サービス（Firebase, Google, etc.）の機能を拡張すれば済まないか？**
3. **Firebase Extensions で追加できないか？**（Trigger Email, Algolia Search 等）
4. **Cloudflare Workers で実装できないか？**（既存のプロキシ基盤を使える）
5. **それでも必要なら、上記のプランに従って新サービスを統合する**

新しい機能を実装する前に、**必ず既存のスタックで解決できないか検討する**。
「何を作らないか」を判断することが、このプロジェクトの成功の鍵。
