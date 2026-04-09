# 05. VBA 設計

## 1. モジュール構成

| モジュール | 種別 | 役割 |
|---|---|---|
| `modMain` | 標準 | 起動/停止/監視ループのエントリポイント |
| `modConfig` | 標準 | 名前付きセル読込・設定フェイルセーフ |
| `modRssData` | 標準 | `RSS_raw` → 構造体への読み出し（データアクセス層） |
| `modSignal` | 標準 | 戦略ディスパッチ・フィルター・シグナル生成 |
| `modRisk` | 標準 | 発注前/常時のリスクチェック・停止判定 |
| `modOrder` | 標準 | 発注/取消/注文ロック/注文管理シート更新 |
| `modPosition` | 標準 | 建玉同期・損益計算 |
| `modLog` | 標準 | 売買ログ/エラーログ/約定履歴 への追記 |
| `modNotify` | 標準 | Slack/トースト通知・重複抑止 |
| `modUtils` | 標準 | ID採番・時刻/配列/辞書ユーティリティ |
| `modUI` | 標準 | ボタン/承認/緊急停止イベントハンドラ |
| `clsSignalContext` | クラス | 戦略に渡すコンテキスト |
| `clsSignalResult` | クラス | 戦略の返す結果 |
| `clsStrategyBreakout` | クラス | 戦略実装例 |
| `clsStrategyReversion` | クラス | 戦略実装例 |
| `clsOrder` | クラス | 注文オブジェクト |
| `clsPosition` | クラス | 建玉オブジェクト |
| `ThisWorkbook` | イベント | Workbook_Open / BeforeClose |
| `Sheet_ダッシュボード` | イベント | ボタン Click, Worksheet_Change |

---

## 2. 各モジュールの責務と主要関数

### 2-1. `modMain`

| 項目 | 内容 |
|---|---|
| 役割 | システム起動/停止、監視ループ、OnTime 再帰管理 |
| 主要関数 | `Startup()`, `Shutdown()`, `MainLoop()`, `ScheduleNextTick()`, `EmergencyStop(reason)` |
| 入出力 | 設定読込 / 監視ダッシュボード更新 / ログ出力 |
| 依存 | `modConfig`, `modRssData`, `modSignal`, `modRisk`, `modOrder`, `modPosition`, `modLog`, `modNotify` |

### 2-2. `modConfig`

| 項目 | 内容 |
|---|---|
| 役割 | 名前付きセルを **安全に** 読む。失敗時はフェイルセーフ値を返す |
| 主要関数 | `GetLong(name, default)`, `GetBool(name, default)`, `GetString(name, default)`, `GetDouble(name, default)`, `GetTime(name, default)`, `IsKillSwitchOn()`, `IsTradingEnabled()`, `AllowedOrderType()`, `Refresh()` |
| 入出力 | 名前付きセル → VBA 変数 |
| 依存 | なし |

### 2-3. `modRssData`

| 項目 | 内容 |
|---|---|
| 役割 | `RSS_raw` / `RSS_account_raw` を読み、構造化したデータを返す |
| 主要関数 | `GetTicker(code) As clsTicker`, `GetOrderBook(code) As clsBook`, `GetCashBalance() As Long`, `GetPositions() As Collection`, `GetOpenOrders() As Collection`, `GetHeartbeatAge() As Long`, `IsRssStale() As Boolean` |
| 入出力 | シート読込 |
| 依存 | `modConfig` |

### 2-4. `modSignal`

| 項目 | 内容 |
|---|---|
| 役割 | 戦略登録、監視銘柄走査、シグナル生成、フィルター適用 |
| 主要関数 | `RegisterStrategies()`, `ScanAll()`, `EvaluateSymbol(code)`, `PassFilters(ctx) As Boolean`, `CreateSignal(code, strategy, result)`, `AppendSignalRow(sig)` |
| 入出力 | `銘柄一覧` → `シグナル` |
| 依存 | `modRssData`, `modConfig`, `modLog`, 戦略クラス群 |

### 2-5. `modRisk`

| 項目 | 内容 |
|---|---|
| 役割 | 発注前/常時リスクチェック、停止判定 |
| 主要関数 | `PreCheckOrder(order) As String`, `CheckRssHeartbeat()`, `CheckDailyLoss()`, `CheckConcurrentPositions()`, `CheckSymbolPosition(code)`, `CheckOrderRate()`, `IsHalted()`, `Halt(reason)`, `Resume(user)` |
| 入出力 | 設定/建玉/注文管理/余力 → 判定結果 |
| 依存 | `modConfig`, `modRssData`, `modOrder`, `modPosition`, `modLog`, `modNotify` |

### 2-6. `modOrder`

| 項目 | 内容 |
|---|---|
| 役割 | 発注/取消、注文管理シートの CRUD、注文ロック |
| 主要関数 | `NewOrder(code, side, qty, price, type, account) As clsOrder`, `SendOrder(order) As Boolean`, `CancelOrder(orderId) As Boolean`, `AcquireOrderLock() As Boolean`, `ReleaseOrderLock()`, `FindOpenOrderBySymbol(code) As clsOrder`, `UpdateOrderState(orderId, state, fillQty, fillPrice)` |
| 入出力 | 注文管理 / RSS 発注関数 / 売買ログ |
| 依存 | `modRisk`, `modLog`, `modNotify`, `modUtils` |

### 2-7. `modPosition`

| 項目 | 内容 |
|---|---|
| 役割 | 建玉の同期・損益計算 |
| 主要関数 | `SyncFromRss()`, `GetPositions() As Collection`, `GetUnrealizedPnl() As Long`, `GetRealizedPnlToday() As Long`, `ApplyFill(fill)` |
| 入出力 | RSS 建玉 → `建玉管理` |
| 依存 | `modRssData`, `modLog` |

### 2-8. `modLog`

| 項目 | 内容 |
|---|---|
| 役割 | 追記専用ログ出力 |
| 主要関数 | `Info(kind, text, ctx)`, `Warn(kind, text, ctx)`, `Error(module_, func_, errNo, errDesc, ctx, severity)`, `AppendSignal(sig)`, `AppendOrder(order)`, `AppendFill(fill)` |
| 入出力 | 各履歴シートへ追記 |
| 依存 | `modUtils` |

### 2-9. `modNotify`

| 項目 | 内容 |
|---|---|
| 役割 | Slack / トースト通知、重複抑止 |
| 主要関数 | `NotifyInfo(text)`, `NotifyWarn(text)`, `NotifyError(text)`, `NotifyFatal(text)`, `Dedupe(key, periodSec) As Boolean`, `PostSlackAsync(text)` |
| 入出力 | Slack Webhook / Windows Toast |
| 依存 | `modConfig`, `modUtils`, Python 側 `notify_slack.py` |

### 2-10. `modUtils`

| 項目 | 内容 |
|---|---|
| 役割 | ID 採番、時刻、配列、Dictionary、安全ラッパ |
| 主要関数 | `NewId(kind) As String`, `Now2() As Double`, `SafeLongRead(name, def) As Long`, `DictGet(d, key, def) As Variant`, `Sleep(ms)`, `IsMarketOpen(now) As Boolean` |
| 入出力 | なし |
| 依存 | なし |

### 2-11. `modUI`

| 項目 | 内容 |
|---|---|
| 役割 | ボタンハンドラ（承認/取消/緊急停止/手動発注） |
| 主要関数 | `btnApprove_Click()`, `btnReject_Click()`, `btnCancel_Click()`, `btnEmergencyStop_Click()`, `btnResume_Click()`, `btnReloadConfig_Click()` |
| 入出力 | ユーザー操作 → `シグナル`/`注文管理` |
| 依存 | `modOrder`, `modRisk`, `modLog`, `modNotify` |

---

## 3. 必要な主要関数一覧（代表）

| カテゴリ | 関数 | 概要 |
|---|---|---|
| 初期化 | `modMain.Startup` | ブック初期化、設定読込、タイマー開始 |
| 設定 | `modConfig.Refresh` | 名前付きセルを再読込 |
| 走査 | `modSignal.ScanAll` | 銘柄一覧を回してシグナル生成 |
| 判定 | `clsStrategyBreakout.Evaluate` | 戦略の判定 |
| リスク | `modRisk.PreCheckOrder` | 発注前チェック |
| 発注 | `modOrder.SendOrder` | 発注送信 |
| 取消 | `modOrder.CancelOrder` | 注文取消 |
| 建玉 | `modPosition.SyncFromRss` | 建玉同期 |
| ログ | `modLog.AppendOrder` | 注文ログ追記 |
| 通知 | `modNotify.NotifyWarn` | 警告通知 |
| 停止 | `modRisk.Halt` | 全停止 |
| 再開 | `modRisk.Resume` | 停止解除 |

---

## 4. VBA 設計原則

1. **`Option Explicit` を全モジュールで必須**。
2. **`On Error GoTo` を使う関数は必ず `Cleanup:` ラベル + `Exit Function` パターン**。
3. グローバル状態は **`_state.xlsm` の `_meta` シート** or **Module Level Private 変数** に限定。
4. `DoEvents` は最低限。ループ内で連発しない。
5. `Application.ScreenUpdating = False` と `Calculation = xlCalculationManual` はループ中に適用。
6. **RSS 関数の再計算タイミング** に依存する箇所は `Application.CalculateFull` or 個別 Range.Calculate で制御。
7. **エラー番号を握り潰さない**。必ず `modLog.Error` に残し、再送せず停止。
8. **`End` 命令を使わない**。必ず `Shutdown()` 経由で終了。
9. **`Application.OnTime` の予約は 1 本のみ**。二重起動防止に予約 ID を `_meta` に保存。
10. **戦略クラスは設定駆動**：戦略名と有効/無効を設定シートから読む。

---

## 5. ファイル配置

```
C:\Trading\
├─ trading.xlsm                    ← 本体
├─ secrets\
│   └─ secrets.ini                 ← Slack Webhook / API キー等（個人情報）
├─ backups\
│   └─ trading_20260409.xlsm       ← 引け後自動バックアップ
├─ logs\
│   └─ 2026\04\09\orders.csv       ← Python 側から CSV ダンプ
└─ python\
    ├─ notify_slack.py
    ├─ log_to_csv.py
    ├─ report_daily.py
    └─ config.yaml
```

`secrets\secrets.ini` は Git 管理外（`.gitignore` に追加）。
