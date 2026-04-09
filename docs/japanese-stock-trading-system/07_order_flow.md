# 07. 注文フロー（状態遷移）

---

## 1. シグナルと注文のライフサイクル概観

```
[シグナル生成] → [リスク判定] → [承認待ち]
                               ├─ 承認 → [発注送信] → [受付成功] → [一部約定] → [全部約定]
                               │                              └─ [取消]
                               │                 └─ [発注失敗] → [拒否/エラー]
                               └─ 却下        → [REJECTED]
```

---

## 2. 買い注文フロー（状態遷移）

状態は `シグナル.状態` と `注文管理.状態` の **2 系統** で管理する。

### 2-1. シグナル状態 (`シグナル.状態`)

| 状態 | 意味 | 次の遷移先 |
|---|---|---|
| `WAIT` | 承認待ち | `APPROVED` / `REJECTED` / `EXPIRED` |
| `APPROVED` | 人が承認（発注前チェック通過を含む） | `SENT` / `REJECTED` |
| `REJECTED` | リスク/人により却下 | 終端 |
| `EXPIRED` | 時間経過で無効（例: 承認待ちが 3 分を超過） | 終端 |
| `SENT` | 発注送信済 | `FILLED` / `PART` / `CANCEL` / `ERROR` |
| `PART` | 一部約定 | `FILLED` / `CANCEL` |
| `FILLED` | 全部約定 | 終端 |
| `CANCEL` | 取消済 | 終端 |
| `ERROR` | 発注時エラー | 終端（人が確認） |

### 2-2. 注文管理 状態 (`注文管理.状態`)

| 状態 | 意味 |
|---|---|
| `NEW` | 内部生成、未送信 |
| `SENT` | RSS 関数呼出完了、受付 OK |
| `PART` | 一部約定 |
| `FILLED` | 全部約定 |
| `CANCEL` | 取消済 |
| `REJECT` | 受付時点で証券会社が拒否 |
| `ERROR` | 送信時に VBA 側例外 |

### 2-3. シーケンス（買い・指値）

```
1. modSignal.ScanAll → シグナル生成 → WAIT
2. modRisk.PreCheckSignal → WARN/NG なら REJECTED
3. ユーザー承認ボタン → modUI.btnApprove_Click
4. modRisk.PreCheckOrder → OK 必須
5. modOrder.AcquireOrderLock
6. modOrder.NewOrder → 注文管理に NEW 行追加
7. 売買ログ: "ORDER_SENT_ATTEMPT"
8. modOrder.SendOrder → RSS 発注関数
   - OK  → 注文管理: SENT、シグナル: SENT
   - NG  → 注文管理: REJECT/ERROR、シグナル: ERROR
9. modOrder.ReleaseOrderLock
10. Slack 通知
11. 周期タスク modPosition.SyncFromRss で約定検知
    - 一部 → PART
    - 全部 → FILLED
    - 時間経過で未約定 → (期限切れで取消 or 維持)
12. 約定時: 約定履歴 INSERT、建玉管理 UPDATE、売買ログ "FILL"
```

---

## 3. 売り注文フロー

売りは **決済起因** を複数持つ。起因ごとに処理パスを分ける。

| 起因 | 条件 | 発注種別 | 優先度 |
|---|---|---|---|
| 利確 | 建玉.利確価格 ≤ 現在値 | 指値 | 中 |
| 損切 | 建玉.損切価格 ≥ 現在値 | **指値**（成行禁止） | **高** |
| 時間切れ | 保有 N 分超 | 指値 | 中 |
| 手動 | ダッシュボードから手動売却 | 指値/成行 | ユーザー判断 |
| 緊急決済 | KillSwitch + 決済モード | 指値（寄り付近） | **最優先** |

### 3-1. 損切フロー

```
1. modPosition.SyncFromRss で建玉取得
2. for 各建玉:
   if 現在値 ≤ 損切価格:
      → 既に売り注文が未約定に存在する? YES → skip
      → modRisk.PreCheckOrder(決済)
      → modOrder.NewOrder(SELL, 現物, 全数量, 損切価格 付近の指値)
      → SendOrder
      → 通知 "STOPLOSS"
3. 売却失敗時:
   → エラーログ + 通知 + 一時停止（同銘柄の再試行は人判断）
```

### 3-2. 売却失敗時の対応

| 失敗 | 対応 |
|---|---|
| 受付 REJECT（値幅外） | 指値を再計算（但し **自動再送は1回のみ**） |
| 通信エラー | 停止、人が手動で処理 |
| 一部約定のまま停滞 | N 分待っても残数量がある場合は通知、人が取消/訂正判断 |
| 建玉と不整合（売ったはずが残っている） | 全停止、`H09` 相当 |

---

## 4. エラーフロー

| エラー分類 | 検知箇所 | ログ | 通知 | 停止 |
|---|---|---|---|---|
| 通信エラー（発注関数呼出時） | `modOrder.SendOrder` | `エラーログ` FATAL | Slack FATAL | 全停止 |
| RSS 取得エラー（値 `#N/A`） | `modRssData.GetTicker` | `エラーログ` WARN | Slack WARN | 当該銘柄のみ |
| RSS 凍結（HB 古い） | `modRisk.CheckRssHeartbeat` | `エラーログ` FATAL | Slack FATAL | 全停止 |
| 注文拒否（エラーコード） | `modOrder.SendOrder` | `エラーログ` WARN→FATAL | Slack WARN | 連続 N 回で全停止 |
| 未約定放置 | `modOrder.CheckStaleOrders` | `エラーログ` WARN | Slack WARN | 当該のみ |
| 建玉不整合 | `modPosition.SyncFromRss` | `エラーログ` FATAL | Slack FATAL | 全停止 |
| ログ書込失敗 | `modLog.Error` | 標準出力 + `_meta` セル | なし | 2回連続で停止 |

### 4-1. 未約定放置の判定

```
for each open order where 状態 ∈ {SENT, PART}:
    age = Now - 発注時刻
    if age > cfgOrderStaleMinutes (例:5分):
        通知 "ORDER_STALE ORD-..."
        人が判断（自動取消はしない。設定で有効化可）
```

### 4-2. 建玉不整合の判定

```
vba_positions = modPosition.FromSheet()   ' 手元状態
rss_positions = modRssData.GetPositions() ' 実際

diff = compare(vba_positions, rss_positions)
if not diff.empty:
    modRisk.Halt "POSITION_MISMATCH: " + diff.summary
    modNotify.NotifyFatal "POSITION MISMATCH"
```

> 「ずれ」は最も危険な状態。人が確認するまで一切の発注を止める。

---

## 5. ステートマシン図（テキスト）

```
            ┌───────────┐
            │   WAIT    │◀─────── modSignal.ScanAll
            └─────┬─────┘
                  │ 承認ボタン
                  ▼
            ┌───────────┐
            │ APPROVED  │
            └─────┬─────┘
                  │ PreCheckOrder OK
                  ▼
            ┌───────────┐
            │   SENT    │
            └──┬───┬────┘
    一部約定  │   │  取消
              ▼   ▼
        ┌──────┐ ┌──────┐
        │ PART │ │CANCEL│
        └──┬───┘ └──────┘
           │ 全部約定
           ▼
        ┌──────┐
        │FILLED│
        └──────┘

    REJECTED / EXPIRED / ERROR は WAIT / APPROVED / SENT のいずれからも到達可能（終端）
```

---

## 6. 状態遷移時の必須アクション

| 遷移 | ログ | 通知 | シート更新 |
|---|---|---|---|
| `WAIT → APPROVED` | `APPROVE` | - | `シグナル.承認者/時刻` |
| `APPROVED → SENT` | `ORDER_SENT` | Slack INFO | `注文管理` 新規 |
| `SENT → PART` | `FILL_PART` | Slack INFO | `注文管理.約定数量/平均価格` |
| `SENT → FILLED` | `FILL` | Slack INFO | `注文管理`, `建玉管理`, `約定履歴` |
| `SENT → CANCEL` | `CANCEL` | Slack INFO | `注文管理.状態=CANCEL` |
| `SENT → ERROR` | `ORDER_ERROR` | Slack FATAL | `エラーログ`, `注文管理.状態=ERROR` |
| `* → REJECTED` | `REJECT` | Slack WARN | `シグナル.状態=REJECTED` |
| `* → EXPIRED` | `EXPIRE` | Slack INFO | `シグナル.状態=EXPIRED` |
