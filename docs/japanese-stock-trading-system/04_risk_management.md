# 04. リスク管理要件

> **最優先章**。本章の要件は「シグナル > 発注前 > 発注時 > 発注後」のすべての段で検証される。

---

## 1. リスクパラメータ（`設定` シート / 名前付きセル）

| パラメータ | 名前付きセル | 既定値 | 備考 |
|---|---|---|---|
| 1回最大損失 | `cfgMaxLossPerTrade` | 5,000円 | (参考価格 - 損切価格) × 数量 |
| 1日最大損失 | `cfgMaxLossPerDay` | 20,000円 | 実現損益 + 現時点確定見込損失 |
| 1銘柄最大投資額 | `cfgMaxPositionPerSymbol` | 300,000円 | 同一コード合計 |
| 同時保有銘柄数上限 | `cfgMaxConcurrentPositions` | 3 | 現物 + 信用 |
| 1日最大発注回数 | `cfgMaxOrdersPerDay` | 10 | 新規+決済 合算 |
| 発注最小間隔 | `cfgMinTickInterval` | 500ms | 二重クリック防止 |
| 最小出来高 | `cfgMinLiquidityVolume` | 100,000 | 当日累計出来高 |
| 最大スプレッド | `cfgMaxSpreadBps` | 50bps | (売気配-買気配)/中値 |
| 最大指値乖離 | `cfgMaxPriceSlippageBps` | 30bps | 指値と最終板の乖離 |
| 許可される執行条件 | `cfgAllowedOrderType` | LIMIT | 成行禁止 |
| ストップ高/安張付時 | （ロジック） | 禁止 | - |
| RSS死活タイムアウト | `cfgRssHeartbeatMaxAgeSec` | 10秒 | 超過で即停止 |

---

## 2. 停止条件マトリクス（最重要）

| # | 条件 | 検知 | 停止範囲 | 再開条件 | 深刻度 |
|---|---|---|---|---|---|
| H01 | `cfgKillSwitch = TRUE` | 常時監視 | 全機能 | 手動で FALSE + 確認ダイアログ | FATAL |
| H02 | `cfgTradingEnabled = FALSE` | 常時監視 | 発注のみ | 手動で TRUE | INFO |
| H03 | 1日損失が `cfgMaxLossPerDay` を超過 | 約定後/建玉更新後 | 当日全発注 | 翌営業日まで自動再開しない | FATAL |
| H04 | 1回損失が `cfgMaxLossPerTrade` を超過する見込 | 発注前 | 当該シグナルのみ | - | WARN |
| H05 | 同時保有が上限 | 発注前 | 新規買のみ | 決済後 | INFO |
| H06 | RSS ハートビート停止 | 常時監視 | 全発注 | RSS 復帰 + 手動 | FATAL |
| H07 | 通信断（発注関数呼出失敗が連続N回） | 発注時 | 全発注 | 手動 | FATAL |
| H08 | 余力取得失敗 | 周期 | 全発注 | 正常取得＋手動 | FATAL |
| H09 | 建玉取得失敗 | 周期 | 全発注 | 正常取得＋手動 | FATAL |
| H10 | 板情報が異常（気配0段/0値） | 周期 | 当該銘柄のみ禁止 | 次回正常取得 | WARN |
| H11 | 出来高が最小未満 | シグナル時 | 当該銘柄のみ | - | WARN |
| H12 | スプレッドが上限超 | シグナル時 | 当該銘柄のみ | - | WARN |
| H13 | ストップ高/安に張り付き | シグナル時 | 当該銘柄禁止 | 離れた後 | WARN |
| H14 | 値動きが急騰/急落（1分で±X%） | 周期 | 全発注 一時停止 | 落ち着き + 手動 | WARN |
| H15 | 同一銘柄の発注が直近再試行扱い | 発注前 | 当該銘柄のみ | 直近注文解消 | WARN |
| H16 | 同一銘柄の未約定注文存在 | 発注前 | 新規禁止 | 未約定解消 | INFO |
| H17 | 発注エラーが同一時間内に連続M回 | 発注後 | 全発注 | 手動調査 | FATAL |
| H18 | エラーログ未処理 FATAL 件数 > 0 | 常時 | 全機能 | 手動クリア | FATAL |
| H19 | 時刻がザラ場外 | 発注前 | 発注不可 | ザラ場開始 | INFO |
| H20 | 決算日前後の禁止銘柄 | シグナル時 | 当該銘柄のみ | マスター更新 | INFO |
| H21 | 二重クリック (`cfgMinTickInterval` 未満) | 発注前 | 当該のみ | - | WARN |
| H22 | `cfgMaxOrdersPerDay` 超過 | 発注前 | 全発注 | 翌営業日 | WARN |

---

## 3. リスク判定の実装原則

1. **常時監視は VBA タイマーで 1〜3秒周期**。ただし `OnTime` の連鎖は 1本だけ。
2. **判定は副作用を持たない純関数**（`modRisk.CheckXxx`）。結果を呼び出し側がログ出力する。
3. **停止は "フラグ操作 + 中央ループ検出"**。各所で勝手に `End` しない。
4. **停止フラグが立ったら再開は手動**。`cfgResumeRequiresManual=TRUE` を既定とする。
5. **停止理由は `stateHaltReason` に常に 1 個**（最新優先）。ログには全件残す。
6. **リスク値は Long（整数円）で計算する**。Double での丸め誤差は NG。
7. **設定値を VBA にハードコードしない**。必ず名前付きセル経由で読む。

---

## 4. 事故ケース別の想定挙動

### 4-1. 成行発注禁止が効かないケース
`cfgAllowedOrderType = LIMIT` が読めないバグ → **既定を LIMIT として扱うフェイルセーフ** を `modConfig.GetAllowedOrderType` に実装。

### 4-2. 緊急停止が効かないケース
`cfgKillSwitch` の読み取り自体が失敗 → **読み取り失敗を "KILL" 扱い** にする。
```
KillActive = NOT SafeBoolRead("cfgKillSwitch", default:=True)
' デフォルト True = 安全側
```

### 4-3. 二重発注が通ってしまうケース
`AcquireOrderLock` が Module Level 変数 `mOrderLock` を持ち、`SendOrder` 中は取れない。
`On Error GoTo` の後も **必ず `ReleaseOrderLock` を Finally 相当で実行** する。

### 4-4. RSS が凍結しているが値は古いまま残るケース
`cfgRssHeartbeatCell` に RSS の最終更新時刻（NOW() でなく RSS 関数の時刻）を入れ、
VBA 側の `Now` と比較して `cfgRssHeartbeatMaxAgeSec` 以上の差があったら停止。

### 4-5. 連続損切で無限発注するケース
- 同一銘柄の再エントリーは前回損切から N 分禁止（`modSignal.ReentryFilter`）
- `cfgMaxOrdersPerDay` でグローバル上限
- 1日損失上限 `H03` で最終防衛

### 4-6. 寄り/引けの板薄で成行が約定しないケース
- 原則成行禁止 (`cfgAllowedOrderType=LIMIT`)
- 寄り/引け 5分はシグナル生成自体を禁止 (`TimeFilter`)

### 4-7. PC スリープ/電源断
- 運用で回避（スリープ無効化・UPS）
- 再起動時は **自動再開しない**。起動ルーチンで必ず `HaltReason="再起動直後"` をセット、
  `cfgTradingEnabled` も強制 FALSE に戻してから人の確認を待つ。

---

## 5. リスク管理テスト項目（最低）

| # | 項目 | 合格基準 |
|---|---|---|
| RT01 | KillSwitch 即時停止 | 1秒以内に全発注停止 |
| RT02 | 1日損失上限到達 | 次以降の発注を全件拒否 |
| RT03 | 1回損失上限超 | シグナルが REJECTED |
| RT04 | 同時保有上限 | 新規買拒否、決済のみ可 |
| RT05 | RSS 凍結 | 10秒以内に停止、通知 |
| RT06 | 余力取得失敗 | 即停止 |
| RT07 | 二重クリック (300ms 連打) | 2本目以降を拒否 |
| RT08 | 成行指定 | 拒否 |
| RT09 | スプレッド 80bps | シグナル拒否 |
| RT10 | 出来高 1,000 (最小未満) | シグナル拒否 |
| RT11 | エラー連発 M 回 | 全停止 |
| RT12 | 停止後の自動再開 | 発生しない（手動必須） |

> これらは `08_test_plan.md` で **具体的手順** に展開する。
