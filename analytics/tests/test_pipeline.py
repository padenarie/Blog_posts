import datetime as dt
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from analytics.collector import process_once
from analytics.registry import classify, parse_feed
from analytics.report import render
from analytics.store import connect, ingest_line, prune


class PipelineTests(unittest.TestCase):
    def test_verified_requires_current_range_and_matching_agent(self):
        networks = parse_feed(json.dumps({"prefixes": [{"ipv4Prefix": "192.0.2.0/24"}]}))
        ranges = {"GPTBot": {"ranges": networks, "fetched_at": 1000}}
        self.assertEqual(classify("GPTBot/1.0", "192.0.2.4", ranges, 1001), ("verified", "GPTBot"))
        self.assertEqual(classify("GPTBot/1.0", "198.51.100.4", ranges, 1001), ("claimed", "GPTBot"))
        self.assertEqual(classify("GPTBot/1.0", "192.0.2.4", ranges, 1000 + 48 * 3600 + 1), ("claimed", "GPTBot"))
        self.assertEqual(classify("NotGPTBot", "192.0.2.4", ranges, 1001), ("unknown", "unknown"))

    def test_ingestion_is_idempotent_private_and_retained(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = connect(Path(tmp) / "requests.sqlite")
            record = {"time": "2026-11-03T12:00:00+00:00", "path": "/about.html", "method": "GET",
                      "status": 200, "referrer_host": "example.test", "user_agent": "GPTBot/1.0",
                      "client_address": "192.0.2.4"}
            line = (json.dumps(record) + "\n").encode()
            ranges = {"GPTBot": {"ranges": ["192.0.2.0/24"], "fetched_at": 1000}}
            self.assertTrue(ingest_line(db, 1, 2, 0, "page.jsonl", line, ranges, 1001))
            self.assertFalse(ingest_line(db, 1, 2, 0, "page.jsonl", line, ranges, 1001))
            self.assertEqual(db.execute("SELECT count FROM daily_counts").fetchone()[0], 1)
            self.assertNotIn("client_address", [row[1] for row in db.execute("PRAGMA table_info(daily_counts)")])
            page = render(db, dt.datetime(2026, 11, 3, 12, 1, tzinfo=dt.timezone.utc))
            self.assertIn("Requests, not unique visitors", page)
            self.assertNotIn("192.0.2.4", page)
            prune(db, dt.datetime(2026, 12, 5, tzinfo=dt.timezone.utc))
            self.assertEqual(db.execute("SELECT count(*) FROM raw_requests").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT count FROM daily_counts").fetchone()[0], 1)

    def test_tailer_skips_assets_and_resumes(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = connect(Path(tmp) / "requests.sqlite")
            log = Path(tmp) / "page.jsonl"
            base = {"time": "2026-11-03T12:00:00+00:00", "path": "/", "method": "GET",
                    "status": 200, "referrer_host": "", "user_agent": "Mozilla/5.0", "client_address": "192.0.2.5"}
            log.write_text(json.dumps(base) + "\n" + json.dumps({**base, "path": "/assets/main.css"}) + "\n")
            process_once(db, tmp, {})
            process_once(db, tmp, {})
            self.assertEqual(db.execute("SELECT SUM(count) FROM daily_counts").fetchone()[0], 1)

    def test_report_escapes_content_and_reports_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = connect(Path(tmp) / "requests.sqlite")
            db.execute("INSERT INTO daily_counts VALUES (?, ?, ?, ?, ?, ?, ?)",
                       ("2026-11-03", "claimed", "GPTBot", "/<script>alert(1)</script>.html", "evil.test", 404, 1))
            db.execute("INSERT INTO gaps VALUES (?, ?)", ("2026-11-03T12:00:00+00:00", "tracked source log disappeared"))
            page = render(db, dt.datetime(2026, 11, 4, tzinfo=dt.timezone.utc))
            self.assertIn("&lt;script&gt;", page)
            self.assertNotIn("<script>alert(1)</script>", page)
            self.assertIn("Processing gaps were detected", page)
            self.assertIn("Unknown includes ordinary browsers", page)


if __name__ == "__main__":
    unittest.main()
