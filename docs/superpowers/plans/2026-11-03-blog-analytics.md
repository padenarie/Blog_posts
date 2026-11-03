# Blog Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure browser acquisition and engagement with Umami, and provide a separate private report of nginx page requests and verified or claimed AI crawlers.

**Architecture:** The static Node build conditionally emits Umami's public script and small event handlers. nginx writes structured page-request records to a private shared volume. A Python collector verifies a small crawler registry, stores 30 days of raw records in SQLite, and maintains address-free daily aggregates; a separate read-only web process renders the private report. Coolify runs Umami and PostgreSQL alongside the existing nginx blog image and the collector/report services.

**Tech Stack:** Node 20+, native `node:test`, browser JavaScript, nginx, Python 3.12 standard library, SQLite, Umami with PostgreSQL, Docker Compose on Coolify.

**Spec:** [2026-11-03-blog-analytics-design.md](../specs/2026-11-03-blog-analytics-design.md)

## Global Constraints

- Keep the public blog a static build served by nginx. The analytics services must never be on its request path.
- Browser events contain only article path and milestone, or work identifier and action; an outbound event may also contain the destination host. Send no names, email, form values, session replay, arbitrary URL query strings, cookies, or cross-site identity.
- Treat Umami visits and nginx requests as separate measures. Call the article metric **depth reached**, not reading completion.
- Verify crawler identity using an operator-published method. A matching user-agent alone is only a claim. Do not infer AI-agent status from ordinary browser behavior or claim that a fetch led to an AI answer.
- Retain raw request records and source log files for 30 days. Keep daily aggregates longer without client addresses or full user-agent strings.
- Keep the Umami dashboard and crawler report private. Do not commit hostnames, passwords, tokens, production IP ranges, or visitor logs.
- Coordinate edits to `src/build.mjs`, `src/layout.html`, and the demo page with the [blog refresh plan](./2026-11-03-blog-refresh.md). Execute that plan's page creation before testing demo events; neither plan creates the Token Economy article.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/analytics-config.mjs` | Validate the two public Umami build values and render safe layout tags |
| `src/layout.html`, `src/build.mjs` | Place optional tracking on every page and add stable event data attributes to post, work, and demo markup |
| `assets/js/analytics.js` | Emit deduplicated article-depth and work-activation events without delaying navigation or iframe launch |
| `test/analytics-build.test.mjs`, `test/analytics-browser.test.mjs` | Verify opt-in build output, invalid configuration, and browser event behavior |
| `nginx.conf`, `Dockerfile`, `deploy/analytics/logrotate.conf` | Emit sanitized JSONL page records and rotate private source logs |
| `analytics/registry.py` | Match explicit crawler user agents and verify OpenAI crawler IP ranges from published JSON feeds |
| `analytics/store.py`, `analytics/collector.py` | Parse and validate logs, commit raw records/aggregates/cursors atomically, expire raw data, and record gaps |
| `analytics/report.py` | Serve escaped, read-only HTML trends from aggregates with freshness and limitations |
| `analytics/Dockerfile`, `deploy/analytics/compose.yaml`, `deploy/analytics/report-gateway.conf` | Package and wire private services, PostgreSQL, Umami, and the protected report ingress |
| `analytics/tests/`, `test/nginx-analytics.test.mjs` | Exercise classification, ingestion, retention, report, and proxy-header behavior |
| `docs/operations/blog-analytics.md` | Coolify setup, TLS, proxy trust, backup, rotation, verification, outage, and upgrade runbook |

## Task 1: Conditional Umami page tracking

**Files:** Create `src/lib/analytics-config.mjs`, `test/analytics-build.test.mjs`; modify `src/layout.html`, `src/build.mjs`, `Dockerfile`.

**Interfaces:** `readAnalyticsConfig(env)` returns `null` or `{ scriptUrl, websiteId }`. `renderAnalyticsTags(config)` returns HTML for the common layout. Build inputs are `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID`; they are public configuration, never credentials. Use the same config for Home, About, 404, demo, and posts.

- [ ] **Step 1: Write focused build tests.** Spawn `node src/build.mjs` with an explicit environment in `test/analytics-build.test.mjs`. Assert that neither key is emitted with both variables absent; with `https://analytics.example.test/script.js` and a UUID, assert exactly one script on Home, About, and a fixture post. Assert rejection when only one value is set, the URL is HTTP or has credentials/query/hash, or the ID is not a UUID. Assert `APP_SECRET` and `DATABASE_URL` from the test environment never appear in generated HTML. Restore fixture posts in `finally`.
- [ ] **Step 2: Confirm failure.** Run `node --test test/analytics-build.test.mjs`; the configured-script case must fail before code changes.
- [ ] **Step 3: Implement validation and layout insertion.** In `src/lib/analytics-config.mjs`, trim both values; return `null` if both absent; throw if exactly one exists. Parse the URL with `new URL`, require `https:`, no username/password/search/hash, and a pathname ending in `/script.js`. Require `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` for the website ID. Escape both values for HTML attributes and render `<script defer src="..." data-website-id="..."></script>` plus `/assets/js/analytics.js`. Add `{{ANALYTICS}}` once in `src/layout.html` and pass it through every `fill(layout, ...)` call in `src/build.mjs`. Validate before `rm(dist, ...)`, preserving the previous build on bad configuration. In the Docker build stage, declare `ARG UMAMI_SCRIPT_URL` and `ARG UMAMI_WEBSITE_ID`, pass them only to `RUN npm run build`, and do not copy them into the final image as environment variables. Never pass secrets as build args.
- [ ] **Step 4: Verify.** Run `node --test test/analytics-build.test.mjs` and `npm test`. Inspect `dist/index.html`, `dist/about.html`, and a fixture post for the script and absence of secrets. A no-config build must contain no Umami tag.
- [ ] **Step 5: Commit.** `git add src/lib/analytics-config.mjs src/layout.html src/build.mjs Dockerfile test/analytics-build.test.mjs && git commit -m "feat: add conditional Umami page tracking"`.

## Task 2: Article-depth and featured-work events

**Files:** Create `assets/js/analytics.js`, `test/analytics-browser.test.mjs`; modify `src/build.mjs` and, after the refresh plan creates it, `assets/js/demo.js` only if its launch handler cannot expose a click target.

**Interfaces:** Post markup has `.post-body` and `data-analytics-article-path="/posts/<slug>.html"` on the article. Featured work links carry `data-analytics-work="cocktail-party-problem"` and `data-analytics-action="open-demo"` or `"open-hugging-face"`. The demo Launch button carries the same work identifier and action `"launch-demo"`. The event names are `article_depth_reached` with `{ article_path, milestone }` and `featured_work_activate` with `{ work_id, action, destination_host? }`.

- [ ] **Step 1: Add browser behavior tests.** Use a small fake DOM and stub `window.umami.track` in `test/analytics-browser.test.mjs`, or a browser test if the fake cannot reproduce viewport geometry. For one post load, exercise 25, 50, 75, and 90 percent of `.post-body`; assert each milestone fires once even after repeated scroll/resize events. Assert an event never includes location search/hash. Click a featured link and Launch button with Umami present and absent; assert click behavior continues in both cases. Test a short article and dynamically growing body.
- [ ] **Step 2: Confirm failure.** Run `node --test test/analytics-browser.test.mjs` and record the missing-event failure.
- [ ] **Step 3: Add stable markup hooks.** In `src/build.mjs`, put the normalized, generated article path on each post article. Add the work data attributes to the refresh plan's Home card, demo fallback link, and Launch button. Keep real `href` values and the existing demo handler; event delivery cannot call `preventDefault()` or wait on a promise. Avoid deriving identifiers from text or external URL query strings.
- [ ] **Step 4: Implement events.** In `assets/js/analytics.js`, attach listeners even if Umami has not loaded; check `window.umami?.track` when each event fires and silently skip unavailable delivery. For post pages, compute `(window.innerHeight - body.getBoundingClientRect().top) / body.getBoundingClientRect().height`, clamp to `[0,1]`, and send each newly crossed milestone once from a `Set`; recompute on passive scroll, resize, and image load. Use `.post-body`, not whole-page scroll progress. Attach a delegated click listener to the work data attributes, allow only the three fixed actions, and read the host from a validated `https:` link when applicable. Catch tracking errors so links and Launch still work. Keep properties exactly as the interface above.
- [ ] **Step 5: Verify.** Run focused tests and `npm test`; in a browser, check one event per threshold, short articles, keyboard activation of links/button, blocked Umami script, and a functioning demo iframe. Check that no event property includes the full outbound URL.
- [ ] **Step 6: Commit.** `git add assets/js/analytics.js src/build.mjs assets/js/demo.js test/analytics-browser.test.mjs && git commit -m "feat: track article depth and work activation"` (omit unchanged files).

## Task 3: Structured nginx page logs and trusted address

**Files:** Modify `nginx.conf`, `Dockerfile`; create `deploy/analytics/logrotate.conf`, `test/nginx-analytics.test.mjs`.

**Interfaces:** One JSON object per request in `/var/log/nginx/analytics/page.jsonl` with keys `time`, `path`, `method`, `status`, `referrer_host`, `user_agent`, and `client_address`. No raw request URI or full referrer. The collector in Task 4 reads `page.jsonl*` from a shared private volume. Only the *actual* Coolify reverse-proxy network CIDR may be put in nginx `set_real_ip_from` through deployment configuration.

- [ ] **Step 1: Write an integration test.** Build/run the nginx image with a temporary log volume. Request `/`, `/about.html?secret=gone`, and `/assets/css/main.css`; send a cookie, a referrer with a query, and a forged `X-Forwarded-For`. Parse the JSONL lines. Assert query/cookie/body values never appear, page requests have normalized paths, asset requests are identifiable and excluded by the collector, and the forged address is not accepted without a configured trusted proxy. Check an HTTP 404 status record too.
- [ ] **Step 2: Confirm failure.** Run `node --test test/nginx-analytics.test.mjs`; expect no JSONL records yet.
- [ ] **Step 3: Add nginx format and safe trust.** Define `log_format analytics escape=json` in `nginx.conf` using `$time_iso8601`, `$uri`, `$request_method`, `$status`, a `map` that extracts only the hostname from `$http_referer`, `$http_user_agent`, and `$remote_addr`. Add `access_log /var/log/nginx/analytics/page.jsonl analytics;`. Use no `$request`, `$request_uri`, `$args`, `$http_cookie`, or `$http_authorization`. Do not enable `real_ip_header` with a broad `set_real_ip_from`. Put the exact trusted CIDR in a Coolify-mounted nginx include once the proxy topology is inspected; test direct spoofing and a legitimate proxy hop. Count only `GET`/`HEAD` document paths in the collector.
- [ ] **Step 4: Rotate source logs.** Install `logrotate` in the nginx final image. Add a daily root cron entry and `deploy/analytics/logrotate.conf` with `daily`, `rotate 30`, `maxage 30`, `dateext`, `missingok`, `notifempty`, `create`, and `postrotate nginx -s reopen`. Start `crond` via an executable `/docker-entrypoint.d/` script, leaving nginx as the main process. Mount only the private analytics log directory to the collector; no public route to it.
- [ ] **Step 5: Verify.** Run `nginx -t` in the image and the integration test. Force one rotation in a test container, request another page, and confirm the new record lands in the newly opened file. Check permission to read rotated files from the collector container.
- [ ] **Step 6: Commit.** `git add nginx.conf Dockerfile deploy/analytics/logrotate.conf test/nginx-analytics.test.mjs && git commit -m "feat: emit private structured page request logs"`.

## Task 4: Crawler classification and resilient aggregation

**Files:** Create `analytics/registry.py`, `analytics/store.py`, `analytics/collector.py`, `analytics/tests/test_registry.py`, `analytics/tests/test_collector.py`, `analytics/Dockerfile`.

**Interfaces:** `classify(user_agent: str, address: str, ranges: dict) -> tuple[str, str]` returns `(verified|claimed|unknown, identity)`. Recognize `GPTBot`, `ChatGPT-User`, and `OAI-SearchBot` with their matching published feeds at `https://openai.com/gptbot.json`, `https://openai.com/chatgpt-user.json`, and `https://openai.com/searchbot.json`. Recognize `ClaudeBot` and `PerplexityBot` as claimed until a documented verification source is implemented. No feed, stale feed, malformed address, or unmatched range can produce `verified`. `ingest_line(source_id, offset, line)` commits a raw record, one daily aggregate increment, and cursor advancement in one SQLite transaction.

- [ ] **Step 1: Write classifier tests.** Supply a synthetic OpenAI feed with `prefixes` entries containing `ipv4Prefix` and `ipv6Prefix`. Verify matching address plus matching user-agent is `verified`; same user-agent with another address is `claimed`; a browser user-agent is `unknown`; overlapping names cannot promote the wrong identity. Assert feed download failure and a cache older than 48 hours downgrade to `claimed`. Do not use live network in tests.
- [ ] **Step 2: Write ingestion tests.** Use a temporary SQLite database and JSONL files. Assert only `GET`/`HEAD` page paths are counted; `/assets/`, source maps, icons, and non-document extensions are excluded. Assert repeated `(device, inode, offset)` is idempotent, a restart resumes without double counting, truncation or missing cursor file records a gap, malformed JSON is recorded as a processing error without leaking raw input to the report, and dates use UTC. Insert records with query-like `path` and referrer values and assert they are rejected or reduced to path/host. Advance a fake clock 31 days, prune, and assert raw rows are gone while aggregates remain. Assert aggregate schema has no address or full user-agent field.
- [ ] **Step 3: Confirm failure.** Run `python3 -m unittest discover -s analytics/tests -v`; expect import or assertion failures.
- [ ] **Step 4: Implement the registry.** Parse and validate the three OpenAI JSON feeds over HTTPS with a timeout, size limit, and `ipaddress.ip_network`; refresh once daily and persist last-good ranges with fetch time. Reject stale (>48-hour) ranges for verification. Use exact token boundaries for named user agents; a substring such as `NotGPTBot` is not GPTBot. Keep ClaudeBot and PerplexityBot in the explicit claimed registry. Store no request address in the feed cache.
- [ ] **Step 5: Implement SQLite storage and tailer.** Create `raw_requests` with `time`, sanitized `path`, `method`, `status`, `referrer_host`, `user_agent`, `client_address`, classification, identity, source device/inode/offset and a unique source constraint. Create `daily_counts(day, classification, identity, path, referrer_host, status, count)` without address or user-agent, `cursors`, `processing_errors`, and `gaps`. Enable WAL and busy timeout. Read complete newline-terminated records from `page.jsonl*`, including rotated files, in file order; atomically write raw row, aggregate increment, and cursor. Reject paths with `?`, `#`, control characters, or malformed percent encoding. Cap user-agent/host/path lengths. Every run deletes raw rows older than 30 days. If a previously tracked inode disappears or shrinks, record a gap with time and reason; never block nginx or public delivery.
- [ ] **Step 6: Verify.** Run `python3 -m unittest discover -s analytics/tests -v`; replay the same fixture twice and confirm identical aggregate counts. Confirm a simulated unavailable feed downgrades verification and a simulated collector outage does not affect nginx responses.
- [ ] **Step 7: Commit.** `git add analytics/registry.py analytics/store.py analytics/collector.py analytics/tests analytics/Dockerfile && git commit -m "feat: classify crawler requests and retain daily counts"`.

## Task 5: Private read-only crawler report

**Files:** Create `analytics/report.py`, `analytics/tests/test_report.py`, `deploy/analytics/report-gateway.conf`.

**Interfaces:** The report reads the SQLite aggregate database in read-only mode. `/` shows UTC daily page-request trends, verified and claimed identities, most requested paths, referrer hosts, status breakdown, last processed-log time, and recorded gaps. Unknown includes ordinary browsers and must be labelled accordingly. The report binds only to the internal Compose network; the Coolify-facing gateway is its sole published route.

- [ ] **Step 1: Write report tests.** Seed aggregates and gaps. Assert the HTML shows `Requests, not unique visitors`, `Unknown includes ordinary browsers`, separate verified/claimed counts, last processed UTC timestamp, and gap notice. Assert a malicious path/referrer is HTML-escaped, no raw address or user-agent appears, and empty data displays an honest no-data state. Request a nonexistent route and assert 404.
- [ ] **Step 2: Confirm failure.** Run `python3 -m unittest analytics.tests.test_report -v`.
- [ ] **Step 3: Implement the report.** Use Python `http.server`, read-only SQLite URI, parameterized aggregate queries, `html.escape`, a fixed 90-day default window, and simple semantic tables. Show aggregate trends beyond the raw 30-day window. Show last processed timestamp and gaps; if freshness exceeds 24 hours, display `Crawler report may be incomplete`. Do not create any endpoint for raw records or client addresses. Bind to `0.0.0.0` only inside the private Compose network.
- [ ] **Step 4: Protect ingress.** Create `report-gateway.conf` with `auth_basic`, an htpasswd file mounted from a Coolify secret, `proxy_pass` to the internal report service, and no direct published report port. Configure TLS at Coolify's public proxy and route only the report hostname to this gateway. Test unauthenticated 401, authenticated 200, and direct public access to the report container failing.
- [ ] **Step 5: Verify and commit.** Run report tests and the gateway integration check, then `git add analytics/report.py analytics/tests/test_report.py deploy/analytics/report-gateway.conf && git commit -m "feat: add protected crawler request report"`.

## Task 6: Coolify deployment and operator runbook

**Files:** Create `deploy/analytics/compose.yaml`, `docs/operations/blog-analytics.md`; modify `README.md` for an operator link.

**Interfaces:** Coolify supplies the blog's public `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` as build args, plus private `DATABASE_URL`, `APP_SECRET`, database credentials, and gateway htpasswd material to the relevant services. Persistent volumes hold PostgreSQL, collector SQLite, and private nginx JSONL logs. Only blog, Umami's public collection endpoint, and authenticated report gateway receive public routes. The database and collector have none.

- [ ] **Step 1: Create the Compose topology.** Define the existing blog Docker build, PostgreSQL, Umami, collector, report, and report gateway with an internal network and named persistent volumes. Pin Umami, PostgreSQL, Python, nginx, and gateway base images to tested immutable tags or digests and record versions in the runbook. Give the collector read-only access to the nginx log volume and write access to its own SQLite volume. Mount SQLite read-write into the report container so SQLite WAL shared-memory works, but open it with `mode=ro` in report code and run that service as an unprivileged user. Add health checks and restart policies. Do not put secrets or production domains in the file; use Coolify secrets and domain settings. Configure `DATABASE_URL` and `APP_SECRET` per the pinned Umami release's official deployment documentation.
- [ ] **Step 2: Write the runbook.** Give exact order: inspect Coolify reverse-proxy container network; set only its CIDR in nginx's real-IP include; verify a direct forged `X-Forwarded-For` is ignored; create TLS hostnames; create Umami website; change default admin password; make dashboard login private; configure blog build args; create report gateway htpasswd secret; set PostgreSQL and SQLite backups; verify restore; set 30-day raw/log retention; rotate credentials; update published OpenAI feed handling and pinned images. Document that initial data begins at deployment and that bot verification is incomplete.
- [ ] **Step 3: Validate configuration and deployed behavior.** Run `docker compose -f deploy/analytics/compose.yaml config --quiet` with non-production fixture env, `npm test`, and Python tests. In a test deployment, visit Home, About, and a post with UTM parameters; inspect Umami page views, referrer/UTM and approximate region if available, and one event per depth milestone. Activate the featured link and demo Launch. Send known and spoofed crawler requests; inspect classification, paths, status, freshness, and gap messaging. Check raw and rotated logs contain no query, cookie, or body values. Temporarily stop Umami and collector and confirm blog pages and links still work. Test unauthorized report access and database/SQLite restore.
- [ ] **Step 4: Commit.** `git add deploy/analytics/compose.yaml docs/operations/blog-analytics.md README.md && git commit -m "docs: deploy and operate private blog analytics"`.

## Execution note

The handoff reported missing Apple developer tools, but this planning session resolves `git`, `node`, `npm`, and `docker` from the shell. Confirm the Docker daemon and test environment when execution begins. The approved specs, refresh plan, and handoff summary are currently untracked; preserve them and include them in a documentation commit rather than discarding them. No analytics implementation or deployment has been performed by this plan.
