# 11. 最小構成 / 1週間タスク / 最大リスク

---

## A. 最小構成で今すぐ作るべきもの

最初の数時間〜数日で、**発注なしの観察環境** まで作る。
**発注機能は絶対に最初から入れない**。

- [ ] `C:\Trading\` フォルダ構成の作成
- [ ] `trading.xlsm` 新規ブック作成（マクロ有効）
- [ ] シート雛形：`設定` / `銘柄一覧` / `シグナル` / `RSS_raw` / `監視ダッシュボード` / `売買ログ` / `エラーログ`
- [ ] 名前付きセルの定義（`cfgKillSwitch`, `cfgTradingEnabled`, `cfgMaxLossPerDay`, ...）
- [ ] `RSS_raw` に **1 銘柄だけ** RSS 関数を貼って値が更新されることを目視確認
- [ ] `modConfig.Refresh` の実装とテスト
- [ ] `modRssData.GetTicker` の実装とテスト
- [ ] `modLog.Info` の実装と `売買ログ` への追記確認
- [ ] `modMain.Startup` / `MainLoop` の実装（OnTime ベース）
- [ ] 監視ダッシュボードへの稼働状態表示
- [ ] `notify_slack.py` の Python 実装 + Webhook 疎通確認
- [ ] `cfgKillSwitch` セルを TRUE にしたら監視ループが即停止することを確認
- [ ] RSS 関数のセルを手で `#N/A` にして停止通知が飛ぶことを確認
- [ ] `RSS_VERIFIED.md` の雛形を作り、確認済み事項を書き始める

この時点で **発注関数は一切書かない**。`modOrder` はダミー関数だけで良い。

---

## B. 1 週間の実装タスク（Day1〜Day7）

> 前提：Phase 1（通知型）を完成させる 1 週間。平日夜 + 週末想定。

### Day 1 — 土台

- `C:\Trading\` 配下のディレクトリ作成
- `trading.xlsm` 作成、`Option Explicit` のスニペット準備
- シート 7 枚の雛形作成 + 列ヘッダ
- 名前付きセルの定義（最低限：`cfgKillSwitch`, `cfgTradingEnabled`, `cfgMaxLossPerDay`, `cfgLoopIntervalMs`, `cfgRssHeartbeatMaxAgeSec`）
- Git 初期化 + `.gitignore`（`secrets\*`, `backups\*`, `logs\*`）
- **終了条件**：空のブックを開いて閉じられること

### Day 2 — 設定層 + ログ層

- `modConfig` 実装：`GetLong/Bool/String/Double`, `SafeBoolRead`（失敗時安全側）
- `modUtils` 実装：`NewId`, `Now2`, `SafeLongRead`
- `modLog.Info/Warn/Error` 実装、`売買ログ`/`エラーログ` への追記
- 単体テスト：`tests/TestConfig.bas`
- **終了条件**：名前付きセルを変えてブックを `Ctrl+S`、再起動しても値が生きている

### Day 3 — RSS データアクセス層

- `RSS_raw` シートの列設計（コード、銘柄名、現在値、前日比、出来高、板最良気配、最終更新 ...）
- RSS 関数を **1 銘柄だけ** 貼り付けて値が流れることを目視確認（**要確認 R1 を埋める**）
- `modRssData.GetTicker(code)` 実装
- `modRssData.GetHeartbeatAge()`, `IsRssStale()` 実装
- `modRisk.CheckRssHeartbeat()` 実装
- **終了条件**：MS2 を切って 10 秒以内に `stateHaltReason` が更新される

### Day 4 — 監視ループ + ダッシュボード

- `modMain.Startup / Shutdown / MainLoop / ScheduleNextTick`
- `Application.OnTime` による周期起動（多重起動防止）
- `監視ダッシュボード` の主要セル埋め（RUNNING/損益/発注回数/エラー数/ハートビート）
- ボタン配置：起動、停止、緊急停止、設定再読込
- **終了条件**：ブック開いて起動ボタン押すと監視ループが回り、緊急停止ボタンで即停止する

### Day 5 — シグナル層 + 戦略 1 つ

- `clsSignalContext`, `clsSignalResult`, `clsStrategyBreakout`
- `modSignal.RegisterStrategies`, `ScanAll`, `EvaluateSymbol`
- フィルタ：時間帯、流動性、スプレッド、重複
- `シグナル` シート更新ロジック
- **終了条件**：条件を満たした銘柄がシグナルシートに追加される

### Day 6 — 通知 + Python 連携

- `modNotify.NotifyInfo/Warn/Error/Fatal` と `Dedupe`
- `PostSlackAsync` → `Shell "pythonw.exe notify_slack.py ..."`
- Python `notify_slack.py` 実装 + `secrets.ini` 準備
- 起動/停止/シグナル/エラーが Slack に届くまで配線
- **終了条件**：Slack に 4 種類の通知が届き、誤通知が出ない

### Day 7 — 統合試験 + ドキュメント

- 1 日通しで回して誤作動ログを確認
- `エラーログ` をゼロにする調整
- `RSS_VERIFIED.md` の項目を埋める
- `README.md` / 本書の追補
- `.gitignore` の確認、git commit + push
- **終了条件**：翌営業日に Phase 1 として観察運用を開始できる状態

---

## C. このシステムで最も危険なポイント 5 つ（と回避策）

### 1. 🔴 二重発注

**危険性**：ボタン連打、OnTime 二重起動、RSS 応答遅延 → 同一シグナルで複数回発注 → 想定外の大量ポジション。

**回避策**：
- `modOrder.AcquireOrderLock` / `ReleaseOrderLock` をすべての発注の周囲に必須
- `cfgMinTickInterval`（例 500ms）を発注前チェックに入れる
- `シグナル.状態` が `SENT` 以降のシグナルは **承認ボタンを無効化**
- 同一銘柄に既存の未約定注文があれば新規発注拒否（`H16`）
- `Application.OnTime` の予約 ID を `_meta` で管理し、二重スケジュール禁止

---

### 2. 🔴 RSS 停止に気づかず古い値で発注

**危険性**：RSS の値が表示されたまま凍結 → VBA が「正常」と判断して現実と乖離した指値で発注 → 予想外の約定。

**回避策**：
- `RSS_raw!A1` に **RSS 関数のタイムスタンプ**（`Now()` ではなく RSS が返す時刻）を配置
- VBA の `Now` と差分を取り、`cfgRssHeartbeatMaxAgeSec`（10 秒）超過で即停止
- `SafeBoolRead` と同じく **読み取り失敗 = 停止** を既定
- RSS を意図的に切って 10 秒で停止することを毎日の起動前に演習 or 月 1 で訓練

---

### 3. 🔴 KillSwitch 経路のバグ

**危険性**：緊急停止ボタンを押しても止まらない。最終防衛線が壊れている状態で発注が続く。

**回避策**：
- KillSwitch の読取を **安全側デフォルト**（読取失敗時は "押された" とみなす）
- `modMain.MainLoop` の先頭で **必ず** KillSwitch を確認
- KillSwitch が TRUE なら **新規シグナル生成すら止める**
- KillSwitch テストを `08_test_plan.md T07` で毎リリース確認
- ハードウェアショートカット（例：`Ctrl+Shift+K`）でも押せるようにする

---

### 4. 🔴 建玉不整合（手元状態と実際の食い違い）

**危険性**：Excel 側の `建玉管理` と証券会社の実際の保有が食い違う → 損切判断が間違う → 実際はロングなのにショート決済を出す等。

**回避策**：
- `modPosition.SyncFromRss` を毎周期実行
- `vba_positions` と `rss_positions` を **数量・コード単位で完全比較**
- 1 件でも差があれば **即 FATAL 停止**（`H18`）
- 立会中に **MS2 本体から手動発注しない**（運用ルール）
- 手動介入した日はその日の残りは人判断で運用

---

### 5. 🔴 損失の暴走（1日損失上限が効かない）

**危険性**：損切設定ミス、連続エントリー、1 日損失の集計ミスで想定以上の損失。

**回避策**：
- `cfgMaxLossPerDay` を **複数の箇所で** 評価（発注前、約定後、周期監視）
- 1 日損失の計算は **実現 + 含み損** の両方で評価
- 損失が **上限の 80% に到達** した時点で警告通知 + 新規発注停止
- 上限到達時は **当日の残り全発注禁止**、再開は翌営業日の人の判断
- 同一銘柄の再エントリーは前回損切から N 分禁止
- **Phase を上げる時は必ず `cfgMaxLossPerDay` を引き締める**
- 月次に最大ドローダウンを振り返り、翌月の上限を更新する

---

## 最後に

このシステムで **一番大切なこと** は機能の多さではなく、
「**今日、想定外のことが起きたときに、壊れずに止まれるか**」 です。

- 止められる
- 壊れたら気づける
- 気づいたらやり直せる
- 過去を再現できる

この 4 つができていれば Phase 1 は合格です。
そこまで作れたら、そこからは少しずつ自信をつけて前に進んでください。
