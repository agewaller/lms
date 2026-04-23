# LMS セットアップガイド

このドキュメントは、管理者（agewaller@gmail.com）が LMS の各連携サービスを設定するための手順書です。非エンジニアの方でも順番に実施すれば完了できます。

---

## 目次

1. [Firebase（必須）](#1-firebase必須)
2. [Anthropic Claude APIキー（必須）](#2-anthropic-claude-apiキー必須)
3. [Google OAuth（カレンダー / Gmail）](#3-google-oauthカレンダー--gmail)
4. [Microsoft OAuth（Outlookカレンダー）](#4-microsoft-oauthoutlookカレンダー)
5. [Fitbit OAuth](#5-fitbit-oauth)
6. [SNS 手動エクスポート（Facebook / Instagram / X / LinkedIn）](#6-sns-手動エクスポート)
7. [デバイス CSV エクスポート（Garmin / Oura / Whoop）](#7-デバイス-csv-エクスポート)
8. [Cloudflare Workers（プロキシ / メール取込）](#8-cloudflare-workersオプション)

---

## 1. Firebase（必須）

**目的**: ユーザー認証、データ保存、ファイル保存

### 手順

1. https://console.firebase.google.com/ にアクセス
2. 「**プロジェクトを追加**」→ プロジェクト名を入力（例: `lms-life`）
3. Google アナリティクスは無効でOK
4. 作成完了後、左メニュー「**Authentication**」→「**Sign-in method**」
5. 以下を有効化:
   - **Google**: 有効 → プロジェクトサポートメール選択 → 保存
   - **メール/パスワード**: 有効 → 保存
6. 同じ Authentication の「**Settings**」→「**Authorized domains**」
   - `agewaller.github.io` を追加
7. 左メニュー「**Firestore Database**」→「**データベースを作成**」
   - 本番環境モード、ロケーション: `asia-northeast1`（東京）
8. 左メニュー「**Storage**」→「**始める**」
9. ⚙️ プロジェクトの設定 →「**マイアプリ**」→ ウェブ `</>` アイコン
10. アプリの登録名（例: `LMS Web`）→ 登録
11. 表示される `firebaseConfig` の値をすべてコピー
12. LMS にログイン → 管理 → **Firebase** タブ → 6項目を貼り付け → 保存

### Firestore ルールのデプロイ

1. Firebase Console → Firestore Database → **ルール** タブ
2. このリポジトリの `firestore.rules` の内容を全コピーして貼り付け
3. 「**公開**」

---

## 2. Anthropic Claude APIキー（必須）

**目的**: Claude による分析を利用

### 手順

1. https://console.anthropic.com/ にアクセス
2. アカウント作成 → 支払い方法を登録（従量課金）
3. 左メニュー「**API Keys**」→「**Create Key**」
4. Key Name に `LMS` と入力 → Create
5. 表示される `sk-ant-...` で始まるキーをコピー（再表示されません）
6. LMS → 管理 → **APIキー** タブ → **Anthropic API Key** に貼り付け → 保存
7. **「直接モードに切り替え」** ボタンをタップ（Cloudflare Worker 不要）
8. 「接続テスト」で✓確認

---

## 3. Google OAuth（カレンダー / Gmail）

**目的**: Googleカレンダーの同期、Gmail からの連絡先自動抽出

### 手順

1. https://console.cloud.google.com/ にアクセス
2. 上部プルダウン →「**新しいプロジェクト**」→ 名前 `lms-integrations` → 作成
3. 左メニュー「**APIとサービス**」→「**ライブラリ**」
4. 以下を検索して有効化:
   - **Google Calendar API**
   - **Gmail API**
   - **People API**（連絡先取得用）
5. 左メニュー「**APIとサービス**」→「**OAuth同意画面**」
6. User Type: **外部** → 作成
7. アプリ名: `LMS`、ユーザーサポートメール: `agewaller@gmail.com`
8. スコープは後で追加されるので何もせず「保存して次へ」
9. テストユーザーに `agewaller@gmail.com` を追加
10. 左メニュー「**APIとサービス**」→「**認証情報**」
11. 「**認証情報を作成**」→「**OAuth クライアント ID**」
12. アプリケーションの種類: **ウェブ アプリケーション**
13. 名前: `LMS Web`
14. **承認済みの JavaScript 生成元**: `https://agewaller.github.io`
15. **承認済みのリダイレクト URI**:
    - `https://agewaller.github.io/lms/dashboard.html`
    - `https://agewaller.github.io/lms/consciousness.html` 等、必要なら他のLPも
16. 作成 → 表示される **クライアント ID**（`xxx.apps.googleusercontent.com`）をコピー
17. LMS → 連携ページ → **Googleカレンダー** カード → Client ID を貼り付け → 「接続する」
18. 同じ Client ID を **Gmail** カードにも貼り付けて「接続する」

---

## 4. Microsoft OAuth（Outlookカレンダー）

**目的**: Outlook / Office 365 カレンダーの同期

### 手順

1. https://portal.azure.com/ にアクセス（Microsoft アカウントでログイン）
2. 上部検索バーで「**アプリの登録**」→ Microsoft Entra ID のアプリ登録
3. 「**新規登録**」
4. 名前: `LMS Integration`
5. サポートされているアカウントの種類: **任意の組織のディレクトリ内のアカウントと個人用 Microsoft アカウント**
6. リダイレクト URI:
   - プラットフォーム: **シングルページ アプリケーション (SPA)**
   - URL: `https://agewaller.github.io/lms/dashboard.html`
7. 登録
8. 登録後の画面で **「アプリケーション (クライアント) ID」** をコピー
9. 左メニュー「**API のアクセス許可**」→「**アクセス許可の追加**」
10. **Microsoft Graph** →「**委任されたアクセス許可**」
11. 以下を追加:
    - `Calendars.Read`
    - `offline_access`
12. 「**管理者の同意を与える**」（自分の管理者権限で）
13. LMS → 連携ページ → **Outlook カレンダー** カード → Client ID を貼り付け → 「接続する」

---

## 5. Fitbit OAuth

**目的**: Fitbit の歩数・心拍数・睡眠データを自動取り込み

### 手順

1. https://dev.fitbit.com/apps/new にアクセス（Fitbitアカウントでログイン）
2. アプリ情報を入力:
   - **Application Name**: `LMS`
   - **Description**: `Life Management System personal integration`
   - **Application Website URL**: `https://agewaller.github.io/lms/`
   - **Organization**: 個人名でOK
   - **Organization Website URL**: 上と同じ
   - **Terms of Service URL**: 上と同じ
   - **Privacy Policy URL**: 上と同じ
   - **OAuth 2.0 Application Type**: **Client**
   - **Redirect URL**: `https://agewaller.github.io/lms/dashboard.html`
   - **Default Access Type**: **Read Only**
3. 「**Register**」
4. 登録後の画面で **OAuth 2.0 Client ID** をコピー
5. LMS → 連携ページ → **Fitbit** カード → Client ID を貼り付け → 「接続する」
6. Fitbitの認証画面で承認 → LMSに戻る

---

## 6. SNS 手動エクスポート

LMS はSNSの友達リストをファイル取込で連絡先に追加します。以下の手順で各SNSからエクスポートしてください。

### Facebook

1. https://www.facebook.com/dyi/ にアクセス
2. 「**情報のダウンロード**」
3. 「**データのコピーをダウンロード**」→「**情報をダウンロード**」
4. カスタムを選択 → **友達**にチェック → 形式: **JSON**
5. 作成されたアーカイブをダウンロード → 解凍
6. `friends_and_followers/friends.json` を LMS の連携ページ → SNS連絡先取り込みで選択

### Instagram

1. Instagramアプリ → プロフィール → 設定 → **セキュリティ** → **データのダウンロード**
2. メールアドレスを入力 → 形式: **JSON** → リクエスト
3. メールで届くリンクからダウンロード → 解凍
4. `followers_and_following/following.json` を LMS で選択

### X (Twitter)

1. https://x.com/settings/download_your_data にアクセス
2. パスワード確認 → 「**アーカイブをリクエスト**」
3. 準備完了後（数時間〜24時間）ダウンロード → 解凍
4. `data/following.js` を LMS で選択

### LinkedIn

1. https://www.linkedin.com/mypreferences/d/download-my-data にアクセス
2. 「**必要なデータを選択**」→ **Connections** にチェック
3. リクエスト → 数分〜数時間でメール通知
4. ダウンロード → 解凍
5. `Connections.csv` を LMS で選択

### WhatsApp

1. WhatsApp で取り込みたいトークを開く
2. トーク画面上部のメニュー（⋮）→ **その他** → **チャットをエクスポート**
3. **メディアなし** を選択（テキストのみ）
4. 保存先を選んで `.txt` ファイルを取得
5. LMS で選択（ファイル名に `whatsapp` を含むと自動判別）

### LINE

1. LINE で取り込みたいトークを開く
2. トーク画面右上のメニュー（≡）→ **設定**
3. 「**トーク履歴を送信**」→ テキスト形式で保存
4. `.txt` ファイルを取得
5. LMS で選択（ファイル名に `line` または `トーク` を含むと自動判別）

### Telegram

1. Telegram Desktop（PC版）を開く
2. 左上メニュー → **Settings** → **Advanced** → **Export Telegram data**
3. 形式: **Machine-readable JSON** を選択
4. Contacts と必要な項目をチェック → Export
5. 生成された `result.json` を LMS で選択

### WeChat (微信)

1. WeChat でトーク画面を長押し
2. 「チャットログ送信」または「Backup Chat History」
3. メールアドレスに送信（テキスト形式）
4. 受信したメールから添付 .txt を保存
5. ファイル名に `wechat` を含めてLMSで選択

### KakaoTalk (카카오톡)

1. KakaoTalk でトーク画面を開く
2. 右上 ≡ → 設定（⚙️）→ **トーク履歴をメールで送信**
3. メールに添付された .txt をダウンロード
4. ファイル名に `kakao` を含めて LMS で選択

### Discord

1. Discord で User Settings → **Privacy & Safety**
2. 下部 **Request My Data** → Request all of my data
3. メール通知後、アーカイブZIPをダウンロード
4. LMS の **ZIP一括取込** で直接アップロード可能
5. または `friends.json` を展開して SNS取込ボタンで選択

---

## ZIP一括取込（おすすめ）

複数のファイルを含むアーカイブ（Facebook / Instagram / Google Takeout / Discord 等）は、
解凍せずにそのままLMSの「ZIP一括取込」にアップロードすれば自動で処理されます。

対応:
- `friends.json`, `following.json`, `connections.csv` → 連絡先
- `.ics` → カレンダー
- `export.xml` (Apple Health) → 健康データ
- その他認識できるフォーマット全般

画像・動画は自動でスキップされます。

---

## Withings Health Mate

CSV取込を推奨しています（OAuth は Withings 側の仕様でサーバー側トークン交換が必要なため）。

1. Health Mate アプリ → プロフィール → 設定 → 「データのダウンロード」
2. 体重 / 活動 / 睡眠 / 心拍 各CSVをダウンロード
3. LMS 連携ページ → Withings → 各CSVを個別に取込

## Muse Headband

1. Muse アプリ → 設定 → データエクスポート → セッション履歴
2. CSVをダウンロード
3. LMS 連携ページ → Muse → ファイル選択

## Garmin Connect

1. https://www.garmin.com/ja-JP/account/datamanagement/ にアクセス
2. 「データのエクスポート」→ CSV または FITファイル
3. LMS 連携ページ → Garmin → ファイル選択

---

## 7. デバイス CSV エクスポート

### Garmin

1. https://www.garmin.com/ja-JP/account/datamanagement/ にアクセス
2. 「**データのエクスポート**」
3. CSV ファイルをダウンロード → LMS で選択

### Oura Ring

1. Ouraアプリ → 設定 → プロフィール → **データをダウンロード**
2. CSV を選択 → ダウンロード → LMS で選択

### Whoop

1. Whoopアプリ → Profile → **Export Data**
2. CSVを選択 → メール送信 → ダウンロード → LMS で選択

---

## 8. Cloudflare Workers（オプション）

Anthropic Direct Mode を使う場合、Cloudflare Worker は**不要**です。
プロキシ経由で運用したい場合のみ、以下を実施してください。

### Anthropic プロキシ Worker

1. https://dash.cloudflare.com/ にログイン（無料アカウント可）
2. Workers & Pages → **Create Worker**
3. 名前: `lms-api-proxy` → Deploy
4. 「Edit code」→ このリポジトリの `worker/anthropic-proxy.js` を全コピー → 貼り付け → Save and Deploy
5. 生成された URL（例: `https://lms-api-proxy.xxx.workers.dev`）をコピー
6. LMS → 管理 → APIキー → 「プロキシ経由に戻す」→ URL を貼り付け → 保存

### GitHub Actions 自動デプロイ（上級者向け）

1. https://dash.cloudflare.com/profile/api-tokens → Create Token → **Edit Cloudflare Workers** テンプレート → Create
2. https://github.com/agewaller/lms/settings/secrets/actions → New secret
3. Name: `CLOUDFLARE_API_TOKEN`、値: 上のトークン
4. 以降、worker/ 配下を更新すると自動デプロイされます

### Plaud メール受信 Worker（将来実装予定）

現時点では Plaud の自動メール取込は手動貼り付けフォールバックのみ使用可能です。
将来、メール受信インフラを設定する場合は別途手順をご案内します。

---

## 楽天ウェブサービス（レシピ・献立 機能）

健康ドメインの「今週の献立をつくる」を有効化するための設定です。
管理者が一度設定すれば、全ユーザーが共通の献立提案を受けられます。

### 1. 楽天 アプリID を取得

1. https://webservice.rakuten.co.jp/ にログイン（無料／楽天会員アカウントでOK）
2. 「アプリID発行」→ アプリ名（例: `LMS`）を入力 → アプリ登録
3. 表示された **applicationId**（19桁の数字）をコピー

### 2. （任意）楽天アフィリエイトID を取得

1. https://affiliate.rakuten.co.jp/ にログイン
2. アフィリエイトID（例: `20XXXXXX.XXXXXXXX`）をコピー
3. これを設定すると、買い物リストの「楽天で買う」リンクが報酬付きになります

### 3. LMS に登録

管理 → APIキー タブ で以下を入力 → **保存**:

- **楽天 アプリID**: 上記でコピーした applicationId
- **楽天 アフィリエイトID**: アフィリエイトID（任意）
- **レシピ取り込み プロキシURL**: 空欄のまま（直接モード）または下記 Worker URL

「レシピ接続テスト」ボタンで疎通確認できます。

### 4. （任意）Cloudflare Worker でアプリIDを秘匿

直接モードでは applicationId がブラウザから見えるため、本番運用では
`worker/rakuten-proxy.js` をデプロイして秘匿することを推奨します。

1. https://dash.cloudflare.com/ → Workers & Pages → Create Worker
2. `worker/rakuten-proxy.js` の内容を貼り付けて Deploy
3. Worker の Settings → Variables and Secrets で以下を追加:
   - `RAKUTEN_APPLICATION_ID` = 上記 applicationId
   - `RAKUTEN_AFFILIATE_ID` = 上記 affiliateId（任意）
4. 生成された URL（例: `https://lms-rakuten-proxy.your-account.workers.dev`）を
   LMS の「レシピ取り込み プロキシURL」欄に貼り付けて保存
5. 管理画面で applicationId 欄は空でも動作します（Worker 側で付与されるため）

> GitHub Actions 経由の自動デプロイを設定する場合は、`worker/anthropic-proxy.js`
> と同じ仕組みで `worker/rakuten-proxy.js` も自動デプロイされます。

### 5. 動作確認

1. 健康ドメインを開く → 「今週の献立をつくる」ボタン
2. 好みと体調を入力 → 数十秒で 7 日 × 3 食の献立が表示
3. 「買い物リストを開く」→ 楽天/Amazon リンクを確認
4. 個別レシピの「手順を見る」→ A4 一枚紙が表示 → 印刷 / PDF 保存

> 楽天 アプリID 未設定でも、内蔵のサンプルレシピで一通りの動作を確認できます。

---

## トラブルシューティング

### 「APIプロキシが未設定です」
→ 管理 → APIキー → 「直接モードに切り替え」ボタンをタップ

### 「接続テスト」で失敗する
→ APIキーが正しく入力されているか確認
→ 直接モードに切り替えてみる
→ ブラウザのキャッシュをクリア

### Google OAuth で「リダイレクトURIの不一致」
→ Google Cloud Console の「承認済みリダイレクトURI」に `https://agewaller.github.io/lms/dashboard.html` を正確に追加

### 連絡先のSNS取り込みで0件
→ ファイル名を変更していないか確認（例: `friends.json`, `Connections.csv`）
→ ファイルが最新のフォーマットか確認

### Firebase 認証が失敗する
→ Firebase Console → Authentication → Settings → Authorized domains に `agewaller.github.io` を追加

---

## 最小セットアップ（動作確認まで3分）

最速で動かすだけなら:

1. **Firebase**: プロジェクト作成 → config を貼り付け（5分）
2. **Anthropic API Key**: 取得して貼り付け → 「直接モードに切り替え」（2分）
3. ログイン → 分析テスト

これだけで LMS の主要機能が動きます。他の連携はあとから追加できます。
