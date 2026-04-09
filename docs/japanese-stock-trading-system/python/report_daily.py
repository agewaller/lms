#!/usr/bin/env python3
"""Generate a simple daily report from the SQLite log.

Usage:
    pythonw.exe report_daily.py --date 2026-04-09

Output:
    <log_root>/YYYY/MM/DD/report.html
    <log_root>/YYYY/MM/DD/report.txt
"""
from __future__ import annotations

import argparse
import sqlite3
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.yaml"


def load_config() -> dict:
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def summarize(db: Path, target_date: str) -> dict:
    out: dict = {
        "date": target_date,
        "orders_total": 0,
        "fills_total": 0,
        "errors_total": 0,
        "errors_fatal": 0,
        "by_code": {},
    }
    if not db.exists():
        return out
    with sqlite3.connect(db) as con:
        cur = con.cursor()
        try:
            cur.execute(
                "SELECT COUNT(*) FROM trade_log WHERE 種別='ORDER' "
                "AND 時刻 LIKE ?", (target_date + "%",))
            out["orders_total"] = cur.fetchone()[0]
        except sqlite3.OperationalError:
            pass
        try:
            cur.execute(
                "SELECT COUNT(*), SUM(1) FROM fills WHERE 約定時刻 LIKE ?",
                (target_date + "%",))
            row = cur.fetchone()
            out["fills_total"] = row[0] if row else 0
        except sqlite3.OperationalError:
            pass
        try:
            cur.execute(
                "SELECT 深刻度, COUNT(*) FROM errors WHERE 時刻 LIKE ? "
                "GROUP BY 深刻度", (target_date + "%",))
            for sev, cnt in cur.fetchall():
                out["errors_total"] += cnt
                if sev == "FATAL":
                    out["errors_fatal"] += cnt
        except sqlite3.OperationalError:
            pass
    return out


def render_text(s: dict) -> str:
    return (
        f"===== Daily Report {s['date']} =====\n"
        f"Orders:       {s['orders_total']}\n"
        f"Fills:        {s['fills_total']}\n"
        f"Errors:       {s['errors_total']}\n"
        f"  of which FATAL: {s['errors_fatal']}\n"
    )


def render_html(s: dict) -> str:
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>Daily {s['date']}</title>
<style>body{{font-family:sans-serif}}table{{border-collapse:collapse}}
td,th{{border:1px solid #ccc;padding:4px 8px}}</style></head>
<body>
<h1>Daily Report {s['date']}</h1>
<table>
  <tr><th>項目</th><th>値</th></tr>
  <tr><td>発注件数</td><td>{s['orders_total']}</td></tr>
  <tr><td>約定件数</td><td>{s['fills_total']}</td></tr>
  <tr><td>エラー件数</td><td>{s['errors_total']}</td></tr>
  <tr><td>うち FATAL</td><td>{s['errors_fatal']}</td></tr>
</table>
</body></html>
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=date.today().isoformat())
    args = parser.parse_args()

    cfg = load_config()
    log_root = Path(cfg["logs"]["root_dir"])
    db = Path(cfg["logs"]["sqlite_path"])
    d = args.date
    target = log_root / d[0:4] / d[5:7] / d[8:10]
    target.mkdir(parents=True, exist_ok=True)

    summary = summarize(db, d)
    (target / "report.txt").write_text(render_text(summary), encoding="utf-8")
    (target / "report.html").write_text(render_html(summary), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
