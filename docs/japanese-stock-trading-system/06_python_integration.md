# 06. Python 連携設計

Python は **補助** であり、**発注の経路には入れない**。
発注は常に VBA → RSS に閉じる。

---

## 1. Python でやること / やらないこと

### Python でやること

- Slack 通知（Webhook 送信）
- CSV / SQLite へのログ保存
- 日次レポート生成（PnL, 発注数, 勝率, エラー数）
- 週次・月次のパフォーマンス分析
- 外部分析結果（スクリーニング・ML モデル出力）の **CSV/SQLite → Excel 取込** 用意
- `secrets.ini` の読み書きラッパ
- Excel バックアップの圧縮・保存

### Python でやらないこと

- **発注関数の呼び出し**（MS2 RSS は Excel/VBA 側でのみ）
- **建玉・余力の更新**
- **停止/再開判定**（Python は状態を所有しない）
- **リアルタイム監視ループ**（VBA が主）
- **Excel の値を書き換える処理**（原則 VBA 側。Python は読みのみ／明示的な import のみ）

---

## 2. 連携方法

### 2-1. 原則：ファイル経由（CSV）

同期は **ファイル経由** を基本とする。理由：
- VBA から Python を起動するのは `Shell` 1 行で済む
- 通信プロトコルの不具合が発注路に波及しない
- エラー時のデバッグが容易

### 2-2. フロー図

```
VBA → (売買ログ/約定履歴) → 引け後 Python 起動(Shell) → CSV/SQLite 出力 → Slack 通知
                                                       → 日次レポート.html

VBA → (通知キュー) → notify_queue.json → Python 定期読込 → Slack 送信
                                            or
VBA → (直接 Shell) → notify_slack.py "text" → Slack 送信
```

### 2-3. 連携時の注意点

| 注意 | 内容 |
|---|---|
| 文字コード | CSV は **UTF-8 BOM 付き**（Excel で開けるため）|
| パス | Windows 絶対パス `C:\Trading\...` |
| Shell 実行 | `Shell "pythonw.exe path\notify_slack.py msg"` で **非同期**（ブロックしない） |
| エラー | Python 側のエラーは必ず `python_errors.log` に追記 |
| 排他 | `notify_queue.json` は **advisory lock（.lock ファイル）** で排他 |
| 機密 | `secrets.ini` を Python が読む。VBA からは Python 経由で間接アクセス |
| 時刻 | すべて **ローカル時刻 + ISO 8601** で揃える |

---

## 3. Python 側ディレクトリ構成

```
C:\Trading\python\
├─ config.yaml                 # 接続・チャネル・パス設定
├─ secrets.ini                 # Webhook 等の機密（Git管理外）
├─ requirements.txt
├─ notify_slack.py             # Slack 送信 CLI
├─ log_to_csv.py               # 売買ログ → CSV/SQLite
├─ report_daily.py             # 日次レポート生成
├─ import_screening.py         # 外部分析CSV → 銘柄一覧 取込
├─ common/
│   ├─ __init__.py
│   ├─ cfg.py                  # config.yaml 読み込み
│   ├─ sec.py                  # secrets.ini 読み込み
│   ├─ files.py                # ファイル・ロック・安全書込
│   └─ slack.py                # Slack Webhook ラッパ
└─ tests/
    ├─ test_notify.py
    └─ test_log_to_csv.py
```

---

## 4. 設定ファイル例

### `config.yaml`

```yaml
excel:
  workbook: "C:/Trading/trading.xlsm"
  backup_dir: "C:/Trading/backups"

logs:
  root_dir: "C:/Trading/logs"
  format: "csv"         # csv | sqlite | both
  sqlite_path: "C:/Trading/logs/trades.sqlite"

notify:
  enabled: true
  channel: "#trading"
  paper_prefix: "[PAPER]"
  dedupe_seconds: 30

import:
  screening_csv: "C:/Trading/inbound/screening.csv"
  min_volume: 100000
```

### `secrets.ini`（Git 管理外）

```ini
[slack]
webhook_url = https://hooks.slack.com/services/XXXX/YYYY/ZZZZ

[rakuten]
# ログイン情報は原則保存しない（MS2 本体に入力する運用）
account_display_name = "main"
```

---

## 5. `notify_slack.py` サンプル

```python
#!/usr/bin/env python3
"""Slack notify CLI used by VBA via Shell()

Usage:
    pythonw.exe notify_slack.py --severity warn "text body"
"""
import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path
import configparser
import yaml

ROOT = Path(__file__).resolve().parent
CONFIG = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
SECRETS = configparser.ConfigParser()
SECRETS.read(ROOT / "secrets.ini", encoding="utf-8")

SEVERITY_EMOJI = {
    "info":  ":information_source:",
    "warn":  ":warning:",
    "error": ":x:",
    "fatal": ":rotating_light:",
}


def post(text: str, severity: str = "info") -> int:
    if not CONFIG.get("notify", {}).get("enabled", True):
        return 0
    url = SECRETS["slack"]["webhook_url"]
    emoji = SEVERITY_EMOJI.get(severity, ":information_source:")
    payload = json.dumps({
        "text": f"{emoji} {text}",
        "username": "lms-trading",
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload,
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.getcode()
    except Exception as e:
        errlog = ROOT / "python_errors.log"
        with errlog.open("a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')}\t{severity}\t{e}\t{text}\n")
        return -1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--severity", default="info",
                        choices=["info", "warn", "error", "fatal"])
    parser.add_argument("text", help="Message body")
    args = parser.parse_args()
    rc = post(args.text, args.severity)
    return 0 if rc == 200 else 1


if __name__ == "__main__":
    sys.exit(main())
```

---

## 6. `log_to_csv.py` サンプル（骨子）

```python
#!/usr/bin/env python3
"""Read 売買ログ / 約定履歴 sheets and dump to CSV + SQLite.

Run after market close by VBA:
    pythonw.exe log_to_csv.py --date 2026-04-09
"""
import argparse
import csv
import sqlite3
from datetime import date, datetime
from pathlib import Path

import openpyxl
import yaml

ROOT = Path(__file__).resolve().parent
CFG = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))


def dump_sheet_to_csv(wb_path: Path, sheet_name: str, out_path: Path):
    wb = openpyxl.load_workbook(wb_path, data_only=True, read_only=True)
    ws = wb[sheet_name]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        for row in ws.iter_rows(values_only=True):
            writer.writerow(row)


def dump_sheet_to_sqlite(wb_path: Path, sheet_name: str, table: str, db: Path):
    wb = openpyxl.load_workbook(wb_path, data_only=True, read_only=True)
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return
    header = [str(c) if c is not None else f"col{i}" for i, c in enumerate(rows[0])]
    db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db) as con:
        cols_sql = ", ".join(f'"{h}" TEXT' for h in header)
        con.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ({cols_sql});')
        q = f'INSERT INTO "{table}" VALUES ({",".join(["?"] * len(header))});'
        con.executemany(q, [tuple(str(v) if v is not None else None for v in r)
                            for r in rows[1:]])
        con.commit()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat())
    args = parser.parse_args()

    wb_path = Path(CFG["excel"]["workbook"])
    log_root = Path(CFG["logs"]["root_dir"])
    target = log_root / args.date[0:4] / args.date[5:7] / args.date[8:10]

    dump_sheet_to_csv(wb_path, "売買ログ",   target / "trade_log.csv")
    dump_sheet_to_csv(wb_path, "約定履歴",   target / "fills.csv")
    dump_sheet_to_csv(wb_path, "エラーログ", target / "errors.csv")

    if CFG["logs"]["format"] in ("sqlite", "both"):
        db = Path(CFG["logs"]["sqlite_path"])
        dump_sheet_to_sqlite(wb_path, "売買ログ",   "trade_log", db)
        dump_sheet_to_sqlite(wb_path, "約定履歴",   "fills",     db)
        dump_sheet_to_sqlite(wb_path, "エラーログ", "errors",    db)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

---

## 7. VBA 側から Python を呼ぶサンプル

```vb
' modNotify.PostSlackAsync
Public Sub PostSlackAsync(ByVal text As String, Optional ByVal severity As String = "info")
    Dim py As String
    py = "pythonw.exe"
    Dim script As String
    script = "C:\Trading\python\notify_slack.py"
    Dim cmd As String
    ' 引数は必ずダブルクォートでエスケープ
    cmd = py & " """ & script & """ --severity " & severity & " """ & Replace(text, """", "'") & """"
    ' vbHide + 非同期起動
    Shell cmd, vbHide
End Sub
```

---

## 8. 連携時の落とし穴（必読）

1. **`Shell` は同期ではない**。Python 側で書込後 VBA が即読みにいくと未完了。
2. **openpyxl で開いている間 Excel 側で該当シートを書き換えない**。
   引け後の `log_to_csv.py` 実行時は VBA の書込を一時停止する。
3. **Slack Webhook の rate limit**（1秒数通）を超えないように `Dedupe` と `PostSlackAsync` を併用。
4. **文字コード**：CSV を Excel で開く場合は必ず `utf-8-sig`。
5. **Python 仮想環境**：`py -m venv .venv` で作って `pythonw.exe` の絶対パスを `config.yaml` に記録。
6. **セキュリティ**：`secrets.ini` は `.gitignore` に追加、NTFS ACL で本人のみ読取に制限。
