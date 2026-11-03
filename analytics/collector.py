"""Tail nginx JSONL files without participating in public page delivery."""
import datetime as dt
import glob
import os
import time

from analytics.registry import refresh
from analytics.store import connect, ingest_line, prune


def process_once(db, log_dir, ranges):
    files = sorted(glob.glob(os.path.join(log_dir, "page.jsonl*")), key=os.path.getmtime)
    identities = {(os.stat(path).st_dev, os.stat(path).st_ino): path for path in files}
    for device, inode, offset, path in db.execute("SELECT device, inode, offset, path FROM cursors").fetchall():
        current = identities.get((device, inode))
        if current is None or os.stat(current).st_size < offset:
            reason = "tracked source log disappeared" if current is None else "tracked source log was truncated"
            with db:
                db.execute("INSERT INTO gaps VALUES (?, ?)", (dt.datetime.now(dt.timezone.utc).isoformat(), reason))
                db.execute("DELETE FROM cursors WHERE device=? AND inode=?", (device, inode))
    for (device, inode), path in identities.items():
        row = db.execute("SELECT offset FROM cursors WHERE device=? AND inode=?", (device, inode)).fetchone()
        offset = row[0] if row else 0
        with open(path, "rb") as source:
            source.seek(offset)
            while True:
                start = source.tell()
                line = source.readline()
                if not line or not line.endswith(b"\n"):
                    break
                ingest_line(db, device, inode, start, path, line, ranges)
    prune(db)


def main():
    db_path = os.environ.get("ANALYTICS_DB", "/data/requests.sqlite")
    db = connect(db_path)
    while True:
        try:
            ranges = refresh(os.environ.get("CRAWLER_CACHE", "/data/crawler-ranges.json"))
            process_once(db, os.environ.get("ANALYTICS_LOG_DIR", "/logs"), ranges)
        except Exception as error:
            # Keep the collector alive and make the failure visible to operators.
            print(f"collector error: {type(error).__name__}: {error}", flush=True)
        time.sleep(int(os.environ.get("POLL_SECONDS", "5")))


if __name__ == "__main__":
    main()
