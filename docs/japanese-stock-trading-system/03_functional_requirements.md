# 03. 機能要件

> 本書の「RSS」は MS2 RSS の関数を指す。正確な関数名は `RSS_VERIFIED.md`（実装時作成）を参照。

---

## 1. データ取得

### 1-1. 取得項目

| 分類 | 項目 | 取得元 | 更新 | 備考 |
|---|---|---|---|---|
| 相場 | 銘柄コード | RSS | 起動時/追加時 | `銘柄一覧` PK |
| 相場 | 現在値 | RSS | 周期 | - |
| 相場 | 前日比 | RSS | 周期 | 円/％ |
| 相場 | 始値/高値/安値 | RSS | 周期 | 寄与 |
| 相場 | 出来高 | RSS | 周期 | 流動性判定 |
| 相場 | VWAP | RSS | 周期 | 逆張り系 |
| 相場 | 板情報(気配N段) | RSS | 周期 | 要確認 R4 |
| 相場 | 歩み値 | RSS | 周期 | 取得可否/頻度 要確認 |
| 口座 | 買付余力 | RSS | 周期 | 要確認 R5 |
| 口座 | 現物保有銘柄 | RSS | 周期 | 一覧で取得 |
| 口座 | 保有数量 | RSS | 周期 | - |
| 口座 | 平均取得単価 | RSS | 周期 | - |
| 口座 | 評価損益 | RSS | 周期 | 計算でも良い |
| 注文 | 未約定注文一覧 | RSS | 周期 | 要確認 R7 |
| 注文 | 約定状況 | RSS | 周期/イベント | 要確認 R12 |

### 1-2. 取得設計

- 相場データは `RSS_raw` シートに **1銘柄=1行** で集約。他シートは全て VLOOKUP/INDEX で参照。
- `RSS_raw!A1` に **ハートビート**（最終更新時刻）を RSS 関数で出力させ、
  `modRisk.CheckRssHeartbeat` が `cfgRssHeartbeatMaxAgeSec` を超えていないか常時確認する。
- 余力・建玉・未約定注文は **別シート** (`RSS_account_raw`, 隠し) に取得して正規化する。
- VBA は `RSS_raw` を **読み取り専用** として扱う。値を上書きしない。

### 1-3. 取得失敗時の挙動

| 事象 | 挙動 |
|---|---|
| ハートビート古い | `stateHaltReason="RSS停止"` をセットして停止 |
| 特定銘柄の値が `#N/A` / 0 | 当該銘柄を **売買禁止フラグ ON** |
| 余力が取得不可 | 即停止（発注不可） |
| 建玉が取得不可 | 即停止（リスク計算不可） |

---

## 2. シグナル判定

### 2-1. 判定の全体構造

```
for 銘柄 in 監視対象:
    if 売買禁止フラグ(銘柄): continue
    if 時間帯フィルター NG: continue
    if 地合いフィルター NG: continue
    if 同一銘柄の再エントリー制限 NG: continue
    if 既に保有中 and 重複発注禁止: continue

    for 戦略 in 戦略リスト(銘柄):
        if 戦略.判定(銘柄データ) == HIT:
            シグナル = 戦略.作成(銘柄, 価格, 数量, 理由)
            risk_result = modRisk.PreCheck(シグナル)
            if risk_result != OK:
                シグナル.状態 = REJECTED
            else:
                シグナル.状態 = WAIT
            シグナルシートへ追記
            通知（承認待ち）
```

### 2-2. 戦略インターフェース（VBA）

```vb
' 戦略は Class Module で実装し、以下のメソッドを必須とする
Public Function Name() As String
Public Function Evaluate(ByRef ctx As SignalContext) As SignalResult
' SignalContext: 銘柄コード, 時系列, 板, 出来高, 余力, 現在保有
' SignalResult: Hit(Bool), Side(BUY/SELL), Qty, RefPrice, Stop, Take, Reason
```

- **戦略は純粋関数に近づける**（副作用なし、グローバル状態を触らない）。
- 戦略を追加する時、`modSignal.RegisterStrategies` に 1 行追加するだけで済むようにする。

### 2-3. 代表的なフィルター

| フィルター | 内容 | 実装位置 |
|---|---|---|
| 時間帯 | ザラ場 + 寄り/引け直前を除外（最初の5分、最後の5分など） | `modSignal.TimeFilter` |
| 地合い | TOPIX/日経225 の乖離や移動平均位置 | `modSignal.MarketFilter` |
| 流動性 | 出来高 < `cfgMinLiquidityVolume` で禁止 | `modSignal.LiquidityFilter` |
| スプレッド | (売気配-買気配)/中値 > `cfgMaxSpreadBps` で禁止 | `modSignal.SpreadFilter` |
| 再エントリー | 同一銘柄の直近損切から N 分以内は禁止 | `modSignal.ReentryFilter` |
| 重複発注 | 同一銘柄に既存未約定注文がある間は新規不可 | `modSignal.DuplicateFilter` |
| ストップ高/安 | 値幅制限に張り付き中は禁止 | `modSignal.LimitHitFilter` |
| 決算前後 | 決算日の前後1営業日は禁止（マスター参照） | `modSignal.EarningsFilter` |

---

## 3. 発注

### 3-1. 発注種別

| 種別 | 対応 | 実装 |
|---|---|---|
| 現物 買い | 必須 | `modOrder.BuyCash` |
| 現物 売り | 必須 | `modOrder.SellCash` |
| 指値 | 必須 | `LIMIT` |
| 成行 | **原則禁止**、例外条件のみ許可 | `cfgAllowedOrderType` で切替 |
| 逆指値 | 任意（要確認 R6） | `STOP` |
| 取消 | 必須 | `modOrder.CancelOrder(orderId)` |
| 訂正 | 任意（MVP範囲外） | - |

### 3-2. 発注前チェック（modRisk.PreCheckOrder）

以下を **すべて** 通過してはじめて送信関数に到達する。

1. `cfgTradingEnabled = TRUE`
2. `cfgKillSwitch = FALSE`
3. ザラ場時間内（前場/後場）
4. RSS ハートビート OK
5. 買付余力 >= 必要証拠金 × 安全係数(1.05)
6. 1銘柄あたり最大投資額を超えない
7. 同時保有銘柄数上限を超えない
8. 1日最大発注回数を超えない
9. 1回最大損失 / 1日最大損失 を超える可能性が低い
10. 当該銘柄の `売買禁止フラグ` が OFF
11. 同一銘柄の未約定注文が存在しない
12. 直近の発注 Tick から `cfgMinTickInterval` 以上経過（二重クリック防止）
13. 数量 > 0 かつ最小発注単位の倍数
14. 指値価格が最終板から ±X% の範囲内
15. 発注トークン（モーダル）の **排他取得** に成功している

### 3-3. 発注処理シーケンス（指値買い）

```
1. PreCheckOrder → OK でなければ拒否
2. modOrder.AcquireOrderLock() → 取れなければ拒否
3. 内部注文ID 採番 (ORD-yyyymmdd-nnnn)
4. 注文管理シートに "NEW" で行追加
5. 売買ログに "ORDER_SENT_ATTEMPT" 追記
6. RSS 発注関数呼び出し（引数: コード, 数量, 指値, BUY, 指値, 口座区分 ...）
7. 応答取得
   - OK → 注文IDを注文管理シートに記録 → 状態 "SENT"
   - NG → エラーログ追記 → 状態 "REJECT" → 通知
8. modOrder.ReleaseOrderLock()
9. 売買ログに "ORDER_SENT_RESULT" 追記
10. 通知（成功/失敗）
```

### 3-4. 発注失敗時の処理

| エラー種別 | 対応 |
|---|---|
| 一時的通信エラー | **自動再送しない**。通知 + 人判断 |
| 余力不足 | 注文管理シートに REJECT 記録、停止条件に当該が複数回続いたら停止 |
| 値段エラー | REJECT 記録、該当銘柄を **一時的に売買禁止** |
| 認証エラー | FATAL 停止 |
| 未知のエラーコード | FATAL 停止（握りつぶさない） |

> **二重発注 / 無限再送** の可能性がある処理は **原則書かない**。迷ったら停止。

---

## 4. ログ

| ログ | シート | 記録タイミング | 含める情報 |
|---|---|---|---|
| シグナル | `シグナル`, `売買ログ` | 生成時/状態遷移時 | シグナルID/コード/戦略/価格/根拠/状態 |
| 発注 | `注文管理`, `売買ログ` | 送信前/送信後 | 注文ID/コード/数量/価格/結果/エラーコード |
| 約定 | `約定履歴`, `売買ログ` | 約定検知時 | 約定ID/注文ID/時刻/数量/価格 |
| エラー | `エラーログ` | 例外発生時 | モジュール/関数/Err.Number/Err.Description/コンテキスト/深刻度 |
| 手動操作 | `売買ログ` | ボタン押下時 | 操作種別/シグナルID/操作者/時刻 |
| 設定変更 | `売買ログ` | 名前付きセル変更時 | 変更前/変更後/変更者/時刻 |

> **ログは INSERT ONLY**。過去行を書き換えない。誤った情報は「訂正ログ」として新規追記する。

---

## 5. 通知

### 5-1. 通知チャネル

- 一次：Slack (Incoming Webhook) ← Python 経由
- 二次：Excel ダッシュボードの背景色・音
- 三次：Windows トースト（`modNotify.ShowToast`）

### 5-2. 通知イベント

| イベント | チャネル | 深刻度 | メッセージ例 |
|---|---|---|---|
| 起動/停止 | Slack | INFO | `[trading] RUNNING at 08:55` |
| シグナル発生 | Slack | INFO | `SIGNAL BUY 7203 x100 @2135 breakout` |
| 承認待ち | Slack | WARN | `APPROVAL NEEDED SIG-...` |
| 発注成功 | Slack | INFO | `SENT ORD-... 7203 BUY 100 @2135` |
| 発注失敗 | Slack | WARN | `REJECT 7203 reason=INSUFFICIENT_FUNDS` |
| 約定 | Slack | INFO | `FILL 7203 BUY 100 @2134.5` |
| 損切発動 | Slack | WARN | `STOPLOSS 7203 @2100 loss=-3500` |
| エラー | Slack | ERROR | `ERROR modOrder.SendOrder Err=1004 ...` |
| 緊急停止 | Slack + Toast | FATAL | `KILLSWITCH ACTIVATED reason=RSS停止` |
| 再開 | Slack | INFO | `RESUMED by user at 12:35` |

### 5-3. 通知の抑止

- 同一内容の連続通知は **30秒以内は抑止**（モジュール: `modNotify.Dedupe`）。
- `cfgNotifyEnabled = FALSE` の時は **FATAL 以外は抑止**。
- ペーパートレード (`cfgTradingMode = "PAPER"`) の時はメッセージに `[PAPER]` を付与。

---

## 6. 非機能要件

| 分類 | 要件 |
|---|---|
| 応答 | 監視ループ周期 3秒以下、UI操作レスポンス 100ms 以下 |
| 可用性 | ザラ場中は無停止を目指す。停止時は即時検知して通知 |
| 可観測性 | 全ての発注/約定/停止がログから再現可能 |
| セキュリティ | Slack Webhook/証券口座情報は **ブックにハードコードしない**。`%USERPROFILE%\.trading\secrets.ini` から読む |
| 操作性 | 誤クリック防止（発注ボタンは二重確認 or モーダル） |
| 拡張性 | 戦略を Class Module として差し替えできる |
