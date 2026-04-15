"""
TCH Financials — Database backup cron
Runs db_backup.sh every 6 hours indefinitely.
Register as a Replit console workflow: python scripts/backup_cron.py
"""

import subprocess
import time
import sys
import os
from pathlib import Path
from datetime import datetime, timezone

INTERVAL_HOURS = 6
INTERVAL_SECONDS = INTERVAL_HOURS * 3600
SCRIPT = Path(__file__).parent / "db_backup.sh"


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{ts}] {msg}", flush=True)


def run_backup() -> bool:
    log("Running database snapshot…")
    result = subprocess.run(
        ["bash", str(SCRIPT)],
        capture_output=False,
        text=True,
    )
    if result.returncode == 0:
        log("Snapshot completed successfully.")
        return True
    else:
        log(f"Snapshot FAILED (exit code {result.returncode}).")
        return False


def main() -> None:
    log(f"Backup cron started. Interval: every {INTERVAL_HOURS} hours.")
    log(f"Script: {SCRIPT}")

    # Run immediately on start
    run_backup()

    while True:
        next_run = datetime.now(timezone.utc).replace(microsecond=0)
        log(f"Next snapshot in {INTERVAL_HOURS} hours (sleeping {INTERVAL_SECONDS}s).")
        time.sleep(INTERVAL_SECONDS)
        run_backup()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Backup cron stopped.")
        sys.exit(0)
