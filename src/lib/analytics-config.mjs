const escapeAttr = (value) => String(value).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function readAnalyticsConfig(env = process.env) {
  const scriptUrl = env.UMAMI_SCRIPT_URL?.trim() || '';
  const websiteId = env.UMAMI_WEBSITE_ID?.trim() || '';
  if (!websiteId) return null;
  if (!scriptUrl) throw new Error('UMAMI_SCRIPT_URL is required when UMAMI_WEBSITE_ID is set');
  let url;
  try { url = new URL(scriptUrl); } catch { throw new Error('UMAMI_SCRIPT_URL must be a valid HTTPS script URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !url.pathname.endsWith('/script.js')) {
    throw new Error('UMAMI_SCRIPT_URL must be an HTTPS script URL without credentials, query, or hash');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(websiteId)) {
    throw new Error('UMAMI_WEBSITE_ID must be a UUID');
  }
  return { scriptUrl: url.href, websiteId };
}

export function renderAnalyticsTags(config) {
  if (!config) return '';
  return `<script defer src="${escapeAttr(config.scriptUrl)}" data-website-id="${escapeAttr(config.websiteId)}"></script>
  <script type="module" src="/assets/js/analytics.js"></script>`;
}
