#!/usr/bin/env python3
"""Create a consistent SQLite snapshot and upload it to the backup Worker."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", "/home/pi/door-pin/data.db"))
BACKUP_URL = os.environ["BACKUP_URL"]
MAX_ATTEMPTS = 4


def load_backup_token() -> str:
    credentials_directory = Path(os.environ["CREDENTIALS_DIRECTORY"])
    token = (credentials_directory / "backup-token").read_text().strip()
    if not token:
        raise RuntimeError("the backup upload credential is empty")
    return token


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_snapshot(destination: Path) -> None:
    source_uri = DATABASE_PATH.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(source_uri, uri=True, timeout=30) as source:
        source.execute("PRAGMA busy_timeout=30000")
        with sqlite3.connect(destination, timeout=30) as snapshot:
            source.backup(snapshot, pages=128, sleep=0.1)
            result = snapshot.execute("PRAGMA integrity_check").fetchone()[0]
            if result != "ok":
                raise RuntimeError(f"snapshot integrity check failed: {result}")
            snapshot.commit()

    with destination.open("rb") as handle:
        os.fsync(handle.fileno())


def upload(snapshot: Path, digest: str, token: str) -> dict[str, object]:
    body = snapshot.read_bytes()
    request = urllib.request.Request(
        BACKUP_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/vnd.sqlite3",
            "User-Agent": "Anlok-Database-Backup/1.0",
            "X-Backup-SHA256": digest,
        },
    )

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            if error.code < 500 or attempt == MAX_ATTEMPTS:
                raise RuntimeError(f"backup upload returned HTTP {error.code}: {detail}") from error
        except (TimeoutError, urllib.error.URLError) as error:
            if attempt == MAX_ATTEMPTS:
                raise RuntimeError(f"backup upload failed after {attempt} attempts: {error}") from error
        time.sleep(2 ** (attempt - 1))

    raise RuntimeError("backup upload failed")


def main() -> None:
    if not DATABASE_PATH.is_file():
        raise RuntimeError(f"database does not exist: {DATABASE_PATH}")

    token = load_backup_token()
    with tempfile.TemporaryDirectory(prefix="anlok-db-backup-") as directory:
        snapshot = Path(directory) / "data.sqlite3"
        create_snapshot(snapshot)
        digest = sha256(snapshot)
        size = snapshot.stat().st_size
        result = upload(snapshot, digest, token)

    if (
        result.get("verified") is not True
        or result.get("sha256") != digest
        or result.get("size") != size
    ):
        raise RuntimeError("the backup service did not confirm restore verification")

    print(
        f"Backup verified: {result['key']} "
        f"({result['size']} bytes, sha256={digest})"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Backup failed: {error}", file=sys.stderr)
        raise SystemExit(1)
