"""Private aggregate-only crawler report."""
import datetime as dt
import html
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote


def render(db, now=None):
    now = dt.datetime.now(dt.timezone.utc) if now is None else now
    cutoff = (now - dt.timedelta(days=90)).date().isoformat()
    escape = lambda value: html.escape(str(value), quote=True)

    def table(title, headers, rows):
        head = "".join(f"<th scope='col'>{escape(h)}</th>" for h in headers)
        body = "".join("<tr>" + "".join(f"<td>{escape(v)}</td>" for v in row) + "</tr>" for row in rows)
        return f"<section><h2>{escape(title)}</h2><table><thead><tr>{head}</tr></thead><tbody>{body or '<tr><td colspan="' + str(len(headers)) + '">No data yet</td></tr>'}</tbody></table></section>"

    trend = db.execute("SELECT day, SUM(count) FROM daily_counts WHERE day>=? GROUP BY day ORDER BY day DESC", (cutoff,)).fetchall()
    identities = db.execute("SELECT classification, identity, SUM(count) FROM daily_counts WHERE day>=? GROUP BY classification, identity ORDER BY SUM(count) DESC", (cutoff,)).fetchall()
    paths = db.execute("SELECT path, SUM(count) FROM daily_counts WHERE day>=? AND classification!='unknown' GROUP BY path ORDER BY SUM(count) DESC LIMIT 20", (cutoff,)).fetchall()
    referrers = db.execute("SELECT referrer_host, SUM(count) FROM daily_counts WHERE day>=? AND referrer_host!='' GROUP BY referrer_host ORDER BY SUM(count) DESC LIMIT 20", (cutoff,)).fetchall()
    statuses = db.execute("SELECT status, SUM(count) FROM daily_counts WHERE day>=? GROUP BY status ORDER BY status", (cutoff,)).fetchall()
    row = db.execute("SELECT value FROM metadata WHERE key='last_processed'").fetchone()
    last = row[0] if row else None
    stale = not last or (now - dt.datetime.fromisoformat(last)).total_seconds() > 86400
    gaps = db.execute("SELECT time, reason FROM gaps ORDER BY time DESC LIMIT 10").fetchall()
    notice = "<p class='warning'>Crawler report may be incomplete: processing is stale.</p>" if stale else ""
    if gaps:
        notice += "<p class='warning'>Processing gaps were detected; counts may be incomplete.</p>"
    return f"""<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>
<title>Private crawler request report</title><style>body{{font:16px system-ui;max-width:1100px;margin:auto;padding:2rem;color:#17212b}}table{{border-collapse:collapse;width:100%;margin-bottom:2rem}}th,td{{padding:.5rem;text-align:left;border-bottom:1px solid #ccd}}section{{overflow-x:auto}}.warning{{padding:1rem;background:#fff1c9}}</style></head><body>
<h1>Crawler request report</h1><p><strong>Requests, not unique visitors.</strong> Unknown includes ordinary browsers. A fetch does not prove use in an AI answer. Browser visits and engagement belong in Umami.</p>
<p>Last processed log: {escape(last or 'none')} UTC. Daily counts use UTC. Showing the last 90 days.</p>{notice}
{table('Daily page requests', ('Day', 'Requests'), trend)}
{table('Classification and identity', ('Classification', 'Identity', 'Requests'), identities)}
{table('Most requested crawler pages', ('Path', 'Requests'), paths)}
{table('Referrer hosts', ('Host', 'Requests'), referrers)}
{table('Status codes', ('Status', 'Requests'), statuses)}
{table('Processing gaps', ('Time', 'Reason'), gaps)}
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    db_path = "/data/requests.sqlite"

    def do_GET(self):
        if self.path != "/":
            self.send_error(404)
            return
        with sqlite3.connect(f"file:{quote(self.db_path)}?mode=ro", uri=True) as db:
            data = render(db).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    Handler.db_path = os.environ.get("ANALYTICS_DB", "/data/requests.sqlite")
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
