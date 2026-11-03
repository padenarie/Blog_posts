"""SQLite storage for private request records and address-free aggregates."""
import datetime as dt
import ipaddress
import json
import posixpath
import re
import sqlite3
from urllib.parse import unquote

SCHEMA = """
CREATE TABLE IF NOT EXISTS raw_requests (
  time TEXT NOT NULL, path TEXT NOT NULL, method TEXT NOT NULL, status INTEGER NOT NULL,
  referrer_host TEXT NOT NULL, user_agent TEXT NOT NULL, client_address TEXT NOT NULL,
  classification TEXT NOT NULL, identity TEXT NOT NULL,
  device INTEGER NOT NULL, inode INTEGER NOT NULL, offset INTEGER NOT NULL,
  UNIQUE(device, inode, offset)
);
CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL, classification TEXT NOT NULL, identity TEXT NOT NULL,
  path TEXT NOT NULL, referrer_host TEXT NOT NULL, status INTEGER NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY(day, classification, identity, path, referrer_host, status)
);
CREATE TABLE IF NOT EXISTS cursors (device INTEGER NOT NULL, inode INTEGER NOT NULL,
  offset INTEGER NOT NULL, path TEXT NOT NULL, PRIMARY KEY(device, inode));
CREATE TABLE IF NOT EXISTS processing_errors (time TEXT NOT NULL, reason TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS gaps (time TEXT NOT NULL, reason TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.executescript(SCHEMA)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=10000")
    return db


def is_page(path, method):
    if method not in ("GET", "HEAD") or not path.startswith("/"):
        return False
    if path.startswith("/assets/") or path in ("/favicon.ico", "/robots.txt", "/sitemap.xml"):
        return False
    return not re.search(r"\.[a-zA-Z0-9]+$", path) or path.endswith((".html", "/"))


def sanitize(record):
    raw_path = record["path"]
    if not isinstance(raw_path, str) or len(raw_path) > 2048 or re.search(r"[?#\x00-\x1f]", raw_path) or re.search(r"%(?![0-9a-fA-F]{2})", raw_path):
        raise ValueError("invalid path")
    path = unquote(raw_path, errors="strict")
    if not path.startswith("/") or path.startswith("//") or re.search(r"[?#\x00-\x1f]", path):
        raise ValueError("invalid decoded path")
    path = posixpath.normpath(path)
    if raw_path.endswith("/") and path != "/":
        path += "/"
    host = record.get("referrer_host", "")
    if not isinstance(host, str) or len(host) > 253 or re.search(r"[^A-Za-z0-9.:-]", host):
        host = ""
    address = str(ipaddress.ip_address(record["client_address"]))
    timestamp = dt.datetime.fromisoformat(record["time"])
    if timestamp.tzinfo is None:
        raise ValueError("timestamp requires timezone")
    status = int(record["status"])
    if not 100 <= status <= 599:
        raise ValueError("invalid HTTP status")
    return {
        "time": timestamp.astimezone(dt.timezone.utc).isoformat(), "path": path,
        "method": record["method"], "status": status, "referrer_host": host.lower(),
        "user_agent": str(record.get("user_agent", ""))[:512], "client_address": address,
    }


def ingest_line(db, device, inode, offset, source_path, line, ranges, now=None):
    stamp = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        record = sanitize(json.loads(line))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        with db:
            db.execute("INSERT INTO processing_errors VALUES (?, ?)", (stamp, "invalid sanitized log record"))
            db.execute("INSERT INTO cursors VALUES (?, ?, ?, ?) ON CONFLICT(device, inode) DO UPDATE SET offset=excluded.offset, path=excluded.path", (device, inode, offset + len(line), source_path))
        return False
    with db:
        prior = db.execute("SELECT 1 FROM raw_requests WHERE device=? AND inode=? AND offset=?", (device, inode, offset)).fetchone()
        if prior or not is_page(record["path"], record["method"]):
            db.execute("INSERT INTO cursors VALUES (?, ?, ?, ?) ON CONFLICT(device, inode) DO UPDATE SET offset=max(offset, excluded.offset), path=excluded.path", (device, inode, offset + len(line), source_path))
            return False
        from .registry import classify
        classification, identity = classify(record["user_agent"], record["client_address"], ranges, now)
        db.execute("INSERT INTO raw_requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (record["time"], record["path"], record["method"], record["status"],
                    record["referrer_host"], record["user_agent"], record["client_address"],
                    classification, identity, device, inode, offset))
        db.execute("INSERT INTO daily_counts VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT(day, classification, identity, path, referrer_host, status) DO UPDATE SET count=count+1",
                   (record["time"][:10], classification, identity, record["path"], record["referrer_host"], record["status"]))
        db.execute("INSERT INTO cursors VALUES (?, ?, ?, ?) ON CONFLICT(device, inode) DO UPDATE SET offset=excluded.offset, path=excluded.path", (device, inode, offset + len(line), source_path))
        db.execute("INSERT INTO metadata VALUES ('last_processed', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (stamp,))
    return True


def prune(db, now=None):
    now = dt.datetime.now(dt.timezone.utc) if now is None else now
    cutoff = (now - dt.timedelta(days=30)).isoformat()
    with db:
        db.execute("DELETE FROM raw_requests WHERE time < ?", (cutoff,))
