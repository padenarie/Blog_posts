// main.js — site effects, loaded on every page (see layout.html).

// ---- theme toggle (persisted) ----
const toggle = document.getElementById('theme-toggle');
function syncIcon() {
  if (!toggle) return;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  toggle.textContent = light ? '☾' : '☀';
}
toggle?.addEventListener('click', () => {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const next = light ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  syncIcon();
});
syncIcon();

// ---- reading progress (post pages only) ----
const bar = document.getElementById('reading-progress');
if (bar && document.body.dataset.page === 'post') {
  const onScroll = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? h.scrollTop / max : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---- scroll reveal ----
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealEls = document.querySelectorAll('.reveal');
if (!reduced && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('revealed'));
}

// ---- copy buttons on code blocks ----
document.querySelectorAll('pre').forEach((pre) => {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.type = 'button';
  btn.textContent = 'copy';
  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.innerText ?? pre.innerText;
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = 'copied!';
    } catch {
      btn.textContent = 'error';
    }
    setTimeout(() => (btn.textContent = 'copy'), 1500);
  });
  pre.appendChild(btn);
});
