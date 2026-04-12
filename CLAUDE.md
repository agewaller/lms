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
