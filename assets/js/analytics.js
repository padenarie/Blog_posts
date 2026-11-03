const track = (name, data) => {
  try {
    if (!window.umami?.track) return false;
    const result = window.umami.track(name, data);
    result?.catch?.(() => {});
    return true;
  } catch { return false; /* analytics never blocks the site */ }
};

const post = document.querySelector('[data-analytics-article-path]');
const body = post?.querySelector('.post-body');
if (body) {
  const reached = new Set();
  const path = post.dataset.analyticsArticlePath;
  const check = () => {
    const bounds = body.getBoundingClientRect();
    if (bounds.height <= 0) return;
    const depth = Math.max(0, Math.min(1, (innerHeight - bounds.top) / bounds.height));
    for (const milestone of [25, 50, 75, 90]) {
      if (depth >= milestone / 100 && !reached.has(milestone)) {
        if (track('article_depth_reached', { article_path: path, milestone })) reached.add(milestone);
      }
    }
  };
  addEventListener('scroll', check, { passive: true });
  addEventListener('resize', check);
  addEventListener('load', check);
  body.querySelectorAll('img').forEach((img) => img.addEventListener('load', check));
  check();
}

document.addEventListener('click', (event) => {
  const target = event.target.closest?.('[data-analytics-work][data-analytics-action]');
  if (!target) return;
  const work_id = target.dataset.analyticsWork;
  const action = target.dataset.analyticsAction;
  if (work_id !== 'cocktail-party-problem' || !['open-demo', 'open-hugging-face', 'launch-demo'].includes(action)) return;
  const data = { work_id, action };
  if (action === 'open-hugging-face' && target.href) {
    try {
      const url = new URL(target.href);
      if (url.protocol === 'https:') data.destination_host = url.hostname;
    } catch { /* no destination property */ }
  }
  track('featured_work_activate', data);
});
