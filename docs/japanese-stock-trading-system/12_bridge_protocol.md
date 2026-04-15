# ブリッジプロトコル仕様 (Web UI ↔ Excel/VBA)

楽天証券 MS2 RSS 自動売買で、ブラウザ (LMS Web UI) と Excel/VBA を結ぶ
**ファイルベース** の同期プロトコルです。

- ブラウザから証券会社への発注は **行いません**（ブラウザには発注権限がない）
- すべての実発注は Excel/VBA 側が MS2 RSS 経由で行います
- ブラウザは「承認キュー」と「監視ダッシュボード」に徹します

---

## 1. 物理配置

```
C:\Trading\
├─ trading.xlsm         ← Excel/VBA 本体
├─ bridge\              ← このプロトコルフォルダ
│   ├─ signals.csv      ← Web → Excel  承認済シグナル
│   ├─ signals.csv.lock ← Excel が読取中の排他
│   ├─ fills.csv        ← Excel → Web  約定結果
│   ├─ positions.csv    ← Excel → Web  建玉スナップショット
│   ├─ heartbeat.txt    ← Excel → Web  MS2 RSS 最終更新時刻
│   ├─ control.json     ← Web → Excel  取引ON/OFF / KillSwitch / リスク値
│   └─ README_bridge.txt ← プロトコル説明
├─ backups\
└─ logs\
```

ブラウザ側は **File System Access API** (`showDirectoryPicker()`) で
`C:\Trading\bridge\` をユーザーに選択してもらい、そのハンドルを保持して
定期的に読み書きします。Chrome / Edge に対応。Safari/Firefox は
手動 ダウンロード / アップロード モード。

---

## 2. ファイル仕様

### 2-1. `signals.csv` (Web → Excel)

ヘッダ行付き、UTF-8。Web 側が承認されたシグナルを書き出す。

| 列 | 型 | 例 | 備考 |
|---|---|---|---|
| signal_id | string | `SIG-ABC123` | Web が採番、冪等キー |
| timestamp | ISO8601 | `2026-04-15T10:23:15Z` | 承認時刻 |
| code | string | `7203` | 銘柄コード |
| name | string | `トヨタ自動車` | 銘柄名（任意） |
| side | enum | `BUY` / `SELL` | 売買 |
| qty | int | `100` | 数量 (単元) |
| price | decimal | `2540` | 指値価格 |
| stop | decimal | `2528` | 損切価格 |
| take | decimal | `2565` | 利確価格 |
| reason | string | `当日高値ブレイク` | カンマはセミコロン置換 |
| state | enum | `APPROVED` | Excel が読むのはこれだけ |

**Excel/VBA の読取ルール**:

1. `signals.csv.lock` が存在したら読まない（他プロセスが書いている可能性）
2. 読む前に `signals.csv.lock` を作成 → 読了後に削除
3. `state == APPROVED` の行のみ処理
4. 各行の `signal_id` が既に処理済なら **スキップ**（冪等性）
5. 処理後は `fills.csv` に **新規行を追記** （signals.csv は書き換えない）
6. `modRisk.PreCheckOrder` を毎行で通す（Web 側の PreCheck は参考値）

### 2-2. `fills.csv` (Excel → Web)

ヘッダ行付き、UTF-8、**追記**専用（履歴を残す）。

| 列 | 型 | 例 |
|---|---|---|
| signal_id | string | `SIG-ABC123` |
| state | enum | `FILLED` / `PART` / `REJECTED` / `CANCEL` / `ERROR` |
| fill_qty | int | `100` |
| fill_price | decimal | `2540.5` |
| fill_timestamp | ISO8601 | `2026-04-15T10:23:18Z` |
| error | string | `INSUFFICIENT_FUNDS` |

Web 側は 5 秒間隔でこのファイルを読み、既に反映済のシグナルは無視します
（シグナル状態が `FILLED` / `REJECTED` / `CANCEL` なら冪等的に無視）。

### 2-3. `positions.csv` (Excel → Web)

ヘッダ行付き、UTF-8、**全置換**（現在のスナップショット）。

| 列 | 型 |
|---|---|
| code | string |
| name | string |
| qty | int |
| avg_price | decimal |
| last_price | decimal |
| stop_price | decimal |
| take_price | decimal |
| opened_at | ISO8601 |
| source_signal_id | string |

Excel/VBA は `modPosition.SyncFromRss` の後に書き出します。
Web 側は読み込む度に `positions` を **完全置換** します。

### 2-4. `heartbeat.txt` (Excel → Web)

1 行のみ。ISO 8601 のタイムスタンプ。

```
2026-04-15T10:24:01
```

Excel/VBA は `modMain.MainLoop` の先頭で毎周期書き出します。
Web 側は読み込み時刻と比較して `cfgRssHeartbeatMaxAgeSec` を超えていれば
`RSS_STALE` と判断します。

### 2-5. `control.json` (Web → Excel)

```json
{
  "killSwitch": false,
  "tradingEnabled": true,
  "tradingMode": "LIVE",
  "approvalRequired": true,
  "risk": {
    "maxLossPerTrade": 5000,
    "maxLossPerDay": 20000,
    "maxPositionPerSymbol": 300000,
    "maxConcurrentPositions": 3,
    "maxOrdersPerDay": 10,
    "rssHeartbeatMaxSec": 10,
    "allowedOrderType": "LIMIT",
    "minTickIntervalMs": 500
  },
  "updatedAt": "2026-04-15T10:23:15.123Z"
}
```

Excel/VBA は `modBridge.ReadControlJson` で周期読み出し。
`killSwitch=true` を読んだ瞬間に `cfgKillSwitch` セルを TRUE にする。
Web UI と Excel 側で値が二重管理されるが、**安全側優先**
（どちらかが TRUE なら停止）。

### 2-6. `README_bridge.txt`

プロトコル説明（人が読む用）。Web 側が接続時に自動生成する。

---

## 3. 同期サイクル

### 3-1. Web 側

5 秒間隔のタイマーで:

1. `signals.csv` を **書く**（WAIT/APPROVED 状態のシグナルのみ）
2. `control.json` を **書く**
3. `heartbeat.txt` を **読む** → `ms2TradingState.lastRssUpdate` に反映
4. `fills.csv` を **読む** → 該当 signal のステート遷移
5. `positions.csv` を **読む** → `ms2TradingState.positions` を置換

### 3-2. Excel/VBA 側

`modMain.MainLoop` の 3 秒周期で `modBridge.Tick` を呼ぶ:

1. `heartbeat.txt` を **書く**（現在時刻）
2. `control.json` を **読む** → KillSwitch / TradingEnabled 反映
3. `signals.csv` を **読む** → 新規シグナルを `SendOrder`
4. `positions.csv` を **書く** → 現在の建玉スナップショット

---

## 4. 冪等性とレース条件対策

| リスク | 対策 |
|---|---|
| 同一シグナルの重複発注 | `signal_id` で処理済チェック（Excel 側が必ず検査） |
| 書込中の読取 | `.lock` ファイル（advisory lock） |
| 書き出しの途中での異常終了 | 最初に `.tmp` に書き、完了後にリネーム（原子的置換）|
| タイムスタンプのズレ | ローカル時刻を採用、Web と Excel は同じ PC |

### 原子的書き込み（Excel/VBA 側・推奨）

```vb
Open BRIDGE_DIR & "positions.csv.tmp" For Output As #fnum
...
Close #fnum
Name BRIDGE_DIR & "positions.csv.tmp" As BRIDGE_DIR & "positions.csv"
```

---

## 5. セキュリティ

- `control.json` と `signals.csv` は **ローカルファイルシステム内**。ネットワークには出ない
- NTFS ACL で本人のみ読取・書込に設定
- Web 側は File System Access API の **明示的な許可** が必要
- 権限は `readwrite`、永続化はブラウザのセッション単位
- バンドル ZIP には `secrets.ini` を **含めない**
- ブリッジフォルダは `.gitignore` 対象

---

## 6. 故障時のフォールバック

- ブリッジフォルダが接続されていない → Web UI は **手動モード**
  - 「signals.csv ダウンロード」ボタン → Excel 側に手動コピー
  - 「fills.csv 取り込み」ボタン → Excel の出力を手動アップロード
- Excel/VBA 側がブリッジフォルダを認識しない → Web 側でエラートースト
- `heartbeat.txt` が 10 秒以上更新されない → Web は `RSS_STALE` を表示
- `control.json` の読取が失敗 → Excel は安全側（停止扱い）

---

## 7. 動作確認チェックリスト

- [ ] バンドル ZIP を展開して Excel に .bas / .cls をインポート
- [ ] `C:\Trading\bridge\` を作成
- [ ] Web UI で「フォルダを選択」で `bridge\` を選択
- [ ] Web 側ダッシュボードに「接続中」が表示される
- [ ] `heartbeat.txt` が 5 秒以内に作成される
- [ ] PAPER モードで 1 シグナル発注 → `signals.csv` に記録される
- [ ] Excel 側が `fills.csv` に追記する
- [ ] Web 側ダッシュボードで状態が `FILLED` に遷移する
- [ ] Web 側で KillSwitch を押すと Excel 側の `cfgKillSwitch` が TRUE になる
- [ ] Excel 側で `cfgKillSwitch` を TRUE にすると Web 側も停止表示になる
  （※ Web は control.json を書くのみ。Excel → Web の逆同期は将来拡張）
