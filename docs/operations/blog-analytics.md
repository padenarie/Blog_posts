# Blog analytics operations

The deployment uses [Compose](../../deploy/analytics/compose.yaml) as a Git-based Docker Compose Application in Coolify, with the repository root as Base Directory and `deploy/analytics/compose.yaml` as Docker Compose Location. Use the normal deployment mode so Coolify generates proxy routes and networks; Raw mode requires manual proxy configuration. The blog remains static; Umami, PostgreSQL, the collector, and the report are separate services. No analytics hostname or password belongs in Git.

## Before deployment

1. In Coolify Domains, create three TLS hostnames: blog to service `blog:80`, analytics to `umami:3000`, and private crawler report to `report-gateway:80`. Do not add a domain or host port for `postgres`, `collector`, or `report`. Review Coolify's generated deployable Compose and verify only the three selected services have routes. The Umami dashboard requires login; change its default `admin` / `umami` password on first start. Keep the dashboard URL and credentials private.
2. Set Coolify secrets `POSTGRES_PASSWORD`, `UMAMI_DATABASE_URL`, and `UMAMI_APP_SECRET`. Use a URL-encoded password in `UMAMI_DATABASE_URL` (`postgresql://umami:<encoded password>@postgres:5432/umami`). Generate the app secret with `openssl rand -hex 32`. Set public build values `UMAMI_SCRIPT_URL=https://<analytics hostname>/script.js` and the website UUID from the Umami website settings. Rebuild the blog after setting the UUID. These two values are public; none of the database or admin credentials are build args.
3. Generate a bcrypt htpasswd line on your own machine with `htpasswd -nB <username>` (it prompts for the password). Save the entire resulting line as the locked, runtime-only Coolify variable `REPORT_HTPASSWD`, with literal interpolation if the UI offers that setting. The gateway writes it to a private tmpfs file at `/run/secrets/report_htpasswd` when starting. Do not paste the line into Git or chat. Only a test password should be used in local validation.
4. Leave `TRUSTED_PROXY_IP` empty for the first deployment. nginx then logs its peer address and ignores forged `X-Forwarded-For` headers. After the stack starts, request a blog page and inspect the `client_address` field in the private nginx JSONL log using Coolify's blog terminal. Confirm that address is the actual Coolify reverse-proxy peer, then set only that exact IPv4 address as the runtime-only `TRUSTED_PROXY_IP` variable and redeploy the blog. The entrypoint writes a narrow `set_real_ip_from` directive; do not trust `0.0.0.0/0`, arbitrary private ranges, or an unverified header hop. Update this value if the proxy address changes.
5. Confirm `docker compose -f deploy/analytics/compose.yaml config --quiet` with the required environment variables. Start services. Confirm TLS, then sign in to Umami and register exactly one blog website. Set the resulting website UUID as the public build value `UMAMI_WEBSITE_ID` and rebuild the blog.

## Verification

- Visit Home, About, and a post with `utm_source=test`; verify Umami page views and campaign/referrer data. Region and country are approximate and may be absent. Scroll a post through 25, 50, 75, and 90 percent and check each `article_depth_reached` event fires at most once. Activate the featured work link and demo Launch button.
- Request a page with a claimed `GPTBot` user-agent from an ordinary address. The report must show **claimed**, never verified. A verified result requires an address in the current published OpenAI range. Browser user agents remain **unknown**, which includes human browsing.
- Send a request with a forged `X-Forwarded-For` header from outside the trusted proxy and inspect the private JSONL record. It must show the real peer, not the forged value. Check the record contains no query, cookie, request body, or full referrer. Check asset paths are absent from page totals.
- Open the report without credentials (expect 401) and with credentials (expect 200). Confirm only aggregate tables and freshness/gap notices are visible. Do not expose `report:8080` or SQLite directly.
- Stop Umami and the collector in a test deployment. The public blog and its links must continue working. After recovery, inspect the report for gaps and freshness.

## Retention and backup

The collector deletes raw SQLite records older than 30 days on every poll. nginx `logrotate` rotates the source JSONL daily and retains at most 30 daily files. Daily aggregate counts have no client address or full user-agent and remain for trends. Back up PostgreSQL and the `collector_data` volume using Coolify's backup facilities; keep backups access-controlled and set their own retention. Back up source logs only if that storage also expires within 30 days. Test a restore to a separate environment before relying on it.

## Maintenance

- Rotate the Umami admin password, PostgreSQL password/URL, app secret, and `REPORT_HTPASSWD` through Coolify secrets. Coordinate database password changes with `UMAMI_DATABASE_URL`, then restart Umami. Rebuild the blog only when its public script URL or website UUID changes. A changed proxy address requires updating `TRUSTED_PROXY_IP` and restarting the blog.
- Check the report's last processed timestamp and gap table. A stale report means request counts may be incomplete; it does not affect the blog. Inspect collector logs and shared-volume permissions. OpenAI feed failures downgrade matching user agents to **claimed** after 48 hours; they never create false verified counts.
- Before upgrading pinned images, review [Umami's install guide](https://docs.umami.is/docs/install), [environment variables](https://docs.umami.is/docs/environment-variables), and release notes. Back up PostgreSQL and SQLite, update pinned versions, run tests and a test deployment, then upgrade. Check database migrations and tracking/event behavior after restart.

Measurement starts on deployment; there is no historical recovery. Browser blockers can undercount visits. Crawler requests are not visitors and cannot prove that an AI answer used a fetched page.
