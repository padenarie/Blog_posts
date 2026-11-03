# Blog Analytics — Design

**Date:** 2026-11-03
**Status:** Written spec approved by user in VS Code Ask Questions; ready for implementation planning

## Purpose and scope

Measure how people find and use Pierre-Antoine Denarié's blog, and separately observe which automated clients request its pages. The first release starts measuring at deployment; it does not reconstruct historical traffic. It supports later decisions about which writing or demonstrations attract interest, without treating traffic as proof of commercial demand.

The blog remains a static site served by nginx on Coolify. This project adds browser analytics and a private crawler report. It does not publish analytics to the blog, change article content, or create the Token Economy article.

## Approach and alternatives

Use **Umami plus structured nginx request logs**. Umami covers browser visits and engagement. Server logs cover crawlers that do not execute JavaScript. Keep the two reports separate because a request and a browser visit are different measures.

| Approach | Benefit | Cost |
| --- | --- | --- |
| Umami plus request logs | Covers human browsing and JavaScript-free crawlers | Two data pipelines and a private report to operate |
| Matomo plus request logs | Broader built-in analytics | More setup and maintenance for the current scope |
| Request logs alone | Fewer services | Weak visitor, session, reading-depth, and campaign reporting |

## Browser analytics

Run Umami with PostgreSQL as separate Coolify services. Use a dedicated analytics hostname with TLS. Keep its dashboard private and change the default admin password during setup. Store database credentials and the Umami app secret in Coolify; use persistent database storage and a configured backup. Register the blog as one Umami website.

The static build injects Umami's script URL and public website ID into the common HTML layout only when both production configuration values are present. Validate both values at build time. Local builds omit the script. Neither database credentials nor dashboard credentials enter the blog image. If the script is blocked or Umami is unavailable, the blog still loads and links work.

Collect:

- Visits, unique-visitor estimates, page views, popular pages, referrers, and UTM campaign dimensions available from Umami.
- Country and region where Umami can derive them. Treat location as approximate; do not add precise location collection.
- On post pages, one custom event per page load when the reader reaches each of 25%, 50%, 75%, and 90% of the article body. Event properties contain the article path and milestone only. Label the metric **depth reached**; scrolling does not prove reading.
- One custom event when a visitor activates a featured work link or clicks **Launch interactive demo** on the dedicated demo page. Event properties contain a stable work identifier and action; outbound link events may include the destination host, not arbitrary URL query strings. Links and the iframe launch still work if event delivery fails.

Do not send names, email addresses, form values, or session replay data. Do not add a cookie or cross-site identity system for this project. Browser blocking and consent behavior may make reports undercount visits.

## Crawler request pipeline

Configure nginx to emit structured access records for page requests. The record contains timestamp, normalized path, method, status, referrer host when present, user-agent string, and a client network address used only for bot verification and short-term abuse analysis. Exclude query strings, cookies, authorization headers, and request bodies. Asset requests may be counted separately for operational checks but are excluded from page-request totals. The reverse-proxy configuration must supply the actual client address through a trusted proxy path; do not accept arbitrary forwarded IP headers from the internet.

A small collector consumes the nginx records, classifies page requests, and writes aggregates for a private report. Classification has three states:

1. **Verified crawler:** the claimed operator has a documented verification method, and the request address passes it.
2. **Claimed crawler:** the user-agent names a crawler, but verification is unavailable or fails.
3. **Unknown:** no supported identity can be established.

Verification can use an operator's published IP ranges or documented forward-confirmed reverse DNS. It must not infer identity solely from a user-agent string. The first release supports a small, explicit registry of relevant AI crawlers; other bot names can appear as claimed or unknown. Do not label normal browser traffic as an AI agent based on behavior alone. A crawler request cannot show whether its fetched page later appeared in an AI answer.

Store raw request records for 30 days, then delete them. Keep daily aggregates longer for trend reporting, without client network addresses or full user-agent strings. The collector should avoid storing request addresses in aggregates. A collector outage may create a gap in crawler reporting; it must not block nginx or page delivery. Document this gap in the report.

## Private crawler report

Provide a simple private web report, protected at the Coolify-facing proxy and served on a hostname separate from the public blog. It shows daily request trends, crawler classification and identity, most requested page paths, referrer hosts when present, and status-code breakdowns. It displays the freshness of the last processed log and a clear notice that counts are **requests**, not unique visitors. The report does not expose raw IP addresses or raw request records.

Do not combine Umami visits and nginx request counts into a single total. Umami is the place to inspect browser acquisition and engagement; the crawler report is the place to inspect automated fetching.

## Deployment and configuration boundaries

- The blog's existing Docker build and nginx service continue to serve static files. Add only the analytics script, article-depth script, work-link events, and structured page logging to that service.
- Deploy Umami, PostgreSQL, the log collector, and the protected report through Coolify-managed configuration with persistent storage where required. Keep secrets out of the repository. Pin service image versions in the deployment configuration.
- The bot report must require authentication or equivalent access control at the proxy. Its backing store and collector are not publicly reachable.
- Document hostname, TLS, trusted proxy, backup, retention, credential rotation, and upgrade steps in an operator runbook. Do not commit live hostnames, tokens, passwords, or raw visitor logs.

## Verification

- Build locally without analytics configuration and confirm no tracking script is emitted. Build with valid test configuration and confirm the script appears on Home, About, and posts, with no secret values in generated HTML.
- In a deployed test, visit Home, About, and an article; confirm Umami reports page views, referrer or UTM data, approximate country/region where available, article milestones at most once per page load, and a featured work-link event.
- Request a page with a known test user-agent and check that the collector records and classifies it without calling it verified solely from the string. Check the report's page paths, statuses, freshness, and request-count label.
- Confirm query strings and cookies are absent from stored records and the private report; check raw-record expiry and backups. Test proxy header trust with a forged forwarded-IP header.
- Make Umami and the collector temporarily unavailable in a test deployment; confirm the public blog still serves pages and links normally.

## Deferred work and limits

No historical recovery, public analytics dashboard, individual visitor profiles, session replay, exact city location, conversion or payment tracking, or automated commercial attribution in this release. Later commercialization can use the baseline reports to select experiments, but requires its own goals and consent review. Bot identity remains incomplete where operators lack verification data or route through ordinary browsers or intermediaries.
