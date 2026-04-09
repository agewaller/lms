#!/usr/bin/env python3
"""Slack notify CLI used by VBA via Shell().

Usage:
    pythonw.exe notify_slack.py --severity warn "text body"

Notes:
    - このスクリプトは発注経路には入らない。通知専用。
    - config.yaml / secrets.ini を同一ディレクトリから読む。
    - Webhook 送信失敗時は python_errors.log に追記し、終了コード 1。
"""
from __future__ import annotations

import argparse
import configparser
import json
import sys
import time
import urllib.request
from pathlib import Path

import yaml  # pip install pyyaml

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.yaml"
SECRETS_PATH = ROOT / "secrets.ini"
ERR_LOG = ROOT / "python_errors.log"

SEVERITY_EMOJI = {
    "info":  ":information_source:",
    "warn":  ":warning:",
    "error": ":x:",
    "fatal": ":rotating_light:",
}


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {"notify": {"enabled": True, "channel": "#trading"}}
    return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))


def load_webhook() -> str | None:
    if not SECRETS_PATH.exists():
        return None
    parser = configparser.ConfigParser()
    parser.read(SECRETS_PATH, encoding="utf-8")
    return parser.get("slack", "webhook_url", fallback=None)


def post(text: str, severity: str) -> int:
    cfg = load_config()
    if not cfg.get("notify", {}).get("enabled", True):
        return 0

    url = load_webhook()
    if not url:
        _log_err(severity, text, "no webhook configured")
        return 1

    emoji = SEVERITY_EMOJI.get(severity, ":information_source:")
    payload = json.dumps({
        "text": f"{emoji} {text}",
        "username": "lms-trading",
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return 0 if resp.getcode() == 200 else 1
    except Exception as e:
        _log_err(severity, text, str(e))
        return 1


def _log_err(severity: str, text: str, reason: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    with ERR_LOG.open("a", encoding="utf-8") as f:
        f.write(f"{ts}\t{severity}\t{reason}\t{text}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--severity", default="info",
        choices=["info", "warn", "error", "fatal"])
    parser.add_argument("text", help="Message body")
    args = parser.parse_args()
    return post(args.text, args.severity)


if __name__ == "__main__":
    sys.exit(main())
