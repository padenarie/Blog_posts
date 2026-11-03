import { mkdir, writeFile, cp, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPosts } from './lib/posts.mjs';
import { renderMarkdown } from './lib/render.mjs';
import { readAnalyticsConfig, renderAnalyticsTags } from './lib/analytics-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fill = (tpl, vars) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? ''), tpl);

async function main() {
  const layout = await readFile(join(__dirname, 'layout.html'), 'utf8');
  const site = JSON.parse(await readFile(join(root, 'content', 'site.json'), 'utf8'));
  const aboutBody = await readFile(join(root, 'content', 'about.md'), 'utf8');
  const analytics = renderAnalyticsTags(readAnalyticsConfig());
  for (const key of ['name', 'tagline', 'intro', 'aboutPreview', 'footer', 'accent']) {
    if (typeof site[key] !== 'string' || !site[key].trim()) throw new Error(`site.${key} must be a non-empty string`);
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(site.accent)) throw new Error('site.accent must be a six-digit hex color');
  for (const key of ['title', 'description', 'url', 'embedUrl', 'note']) {
    if (typeof site.featuredWork?.[key] !== 'string' || !site.featuredWork[key].trim()) {
      throw new Error(`site.featuredWork.${key} must be a non-empty string`);
    }
  }
  const workUrl = new URL(site.featuredWork.url);
  const embedUrl = new URL(site.featuredWork.embedUrl);
  if (workUrl.protocol !== 'https:') throw new Error('site.featuredWork.url must use HTTPS');
  if (embedUrl.protocol !== 'https:' || !embedUrl.hostname.endsWith('.hf.space')) {
    throw new Error('site.featuredWork.embedUrl must use HTTPS on an hf.space subdomain');
  }
  const accentStyle = site.accent
    ? `<style>:root:not([data-theme="light"]){--accent:${site.accent}}</style>`
    : '';

  await rm(dist, { recursive: true, force: true });
  await mkdir(join(dist, 'posts'), { recursive: true });

  const posts = await loadPosts(join(root, 'content', 'posts'));

  // --- posts ---
  for (const p of posts) {
    const tags = p.tags.length
      ? `<ul class="tags">${p.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
      : '';
    const content = `
    <article class="post" data-analytics-article-path="/posts/${escapeHtml(p.slug)}.html">
      ${p.hero ? '<div class="post-hero" aria-hidden="true"></div>' : ''}
      <header class="post-head">
        <h1 class="post-title">${escapeHtml(p.title)}</h1>
        <p class="post-meta">
          ${p.date ? `<time datetime="${escapeHtml(p.date)}">${escapeHtml(p.date)}</time><span class="dot">·</span>` : ''}
          <span>${p.readingTime} min read</span>
        </p>
        ${tags}
      </header>
      <div class="post-body prose">
        ${renderMarkdown(p.body)}
      </div>
    </article>`;
    const scripts =
      '<script type="module" src="/assets/js/figures.js"></script>' +
      (p.hero ? '<script type="module" src="/assets/js/tensor.js"></script>' : '');
    await writeFile(join(dist, 'posts', p.slug + '.html'), fill(layout, {
      TITLE: `${escapeHtml(p.title)} — ${site.name}`,
      DESCRIPTION: escapeHtml(p.description),
      PAGE: 'post',
      SITE_NAME: site.name,
      FOOTER_TEXT: site.footer,
      CONTENT: content,
      HEAD_EXTRA: accentStyle,
      ANALYTICS: analytics,
      SCRIPTS: scripts,
    }));
  }

  // --- home ---
  const cards = posts.map((p) => `
    <a class="card reveal" href="/posts/${p.slug}.html">
      <h2 class="card-title">${escapeHtml(p.title)}</h2>
      <p class="card-meta">${p.date ? `<time datetime="${escapeHtml(p.date)}">${escapeHtml(p.date)}</time> · ` : ''}${p.readingTime} min read</p>
      <p class="card-desc">${escapeHtml(p.description)}</p>
      ${p.tags.length ? `<ul class="tags">${p.tags.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
    </a>`).join('');
  const work = site.featuredWork;
  const taglineParts = site.tagline.trim().split(/\s+/);
  const taglineAccent = taglineParts.pop();
  const heroTitle = taglineParts.length
    ? `${escapeHtml(taglineParts.join(' '))} <span>${escapeHtml(taglineAccent)}</span>`
    : escapeHtml(taglineAccent);
  const homeContent = `
  <section class="hero">
    <p class="eyebrow reveal hero-kicker"><span class="kicker-line" aria-hidden="true"></span>${escapeHtml(site.name)} <span class="kicker-index" aria-hidden="true">/ 01</span></p>
    <h1 class="hero-title reveal">${heroTitle}</h1>
    <p class="hero-sub reveal">${escapeHtml(site.intro)}</p>
    <p class="hero-actions reveal"><a class="button-primary" href="#work">Explore the work <span aria-hidden="true">↗</span></a><a class="text-link" href="/about.html">About me <span aria-hidden="true">→</span></a></p>
    <p class="hero-bottom" aria-hidden="true">AI / SYSTEMS / EXPERIMENTS <span>SCROLL TO EXPLORE ↓</span></p>
  </section>
  <section class="section featured-work" id="work">
    <div class="work-copy">
      <p class="eyebrow">Featured work <span class="section-index">/ 01</span></p>
      <h2>${escapeHtml(work.title)}</h2>
      <p class="work-description">${escapeHtml(work.description)}</p>
      <p class="muted work-note">${escapeHtml(work.note)}</p>
      <p class="work-actions"><a class="button-primary" href="/demo.html" data-analytics-work="cocktail-party-problem" data-analytics-action="open-demo">Try the demo <span aria-hidden="true">↗</span></a>
      <a class="text-link" href="${escapeHtml(work.url)}" data-analytics-work="cocktail-party-problem" data-analytics-action="open-hugging-face">Open on Hugging Face <span aria-hidden="true">→</span></a></p>
    </div>
    <div class="work-visual" aria-hidden="true"><img src="/assets/ica-signals.svg" alt="" loading="lazy"></div>
  </section>
  <section class="section posts">
    <div class="section-heading"><h2 class="eyebrow reveal">Writing</h2><span class="section-index">/ 02</span></div>
    <div class="card-grid">${cards || '<p class="prose muted">Writing is on its way.</p>'}</div>
  </section>
  <section class="section about-preview">
    <div class="section-heading"><h2 class="eyebrow">About</h2><span class="section-index">/ 03</span></div><p class="prose">${escapeHtml(site.aboutPreview)}</p>
    <a class="text-link" href="/about.html">More about me <span aria-hidden="true">→</span></a>
  </section>`;
  await writeFile(join(dist, 'index.html'), fill(layout, {
    TITLE: site.name,
    DESCRIPTION: escapeHtml(site.tagline),
    PAGE: 'home',
    SITE_NAME: site.name,
    FOOTER_TEXT: site.footer,
    CONTENT: homeContent,
    HEAD_EXTRA: accentStyle,
    ANALYTICS: analytics,
    SCRIPTS: '<script type="module" src="/assets/js/tensor.js"></script>',
  }));

  // --- about ---
  const aboutContent = `
  <section class="page about-page">
    <p class="eyebrow page-kicker">The person behind the work <span class="section-index">/ About</span></p>
    <div class="about-header">
      <div class="about-header-copy">
        <h1 class="page-title reveal">About</h1>
        <p class="about-lede reveal">${escapeHtml(site.aboutPreview)}</p>
        <a class="text-link reveal" href="https://www.linkedin.com/in/pierre-antoine-denari%C3%A9/">View my LinkedIn <span aria-hidden="true">↗</span></a>
      </div>
      <figure class="about-portrait"><img src="/assets/profile.jpg" alt="Portrait of Pierre-Antoine Denarié" width="800" height="800" decoding="async"><figcaption>Pierre-Antoine Denarié <span>/ Delft, NL</span></figcaption></figure>
    </div>
    <div class="prose about-body reveal">${renderMarkdown(aboutBody)}</div>
  </section>`;
  await writeFile(join(dist, 'about.html'), fill(layout, {
    TITLE: `About — ${escapeHtml(site.name)}`,
    DESCRIPTION: escapeHtml(site.intro),
    PAGE: 'about',
    SITE_NAME: site.name,
    FOOTER_TEXT: site.footer,
    CONTENT: aboutContent,
    HEAD_EXTRA: accentStyle,
    ANALYTICS: analytics,
    SCRIPTS: '',
  }));

  // --- demo ---
  await writeFile(join(dist, 'demo.html'), fill(layout, {
    TITLE: `The Cocktail Party Problem — ${escapeHtml(site.name)}`,
    DESCRIPTION: escapeHtml(work.description),
    PAGE: 'demo',
    SITE_NAME: escapeHtml(site.name),
    FOOTER_TEXT: escapeHtml(site.footer),
    CONTENT: `<section class="page demo-page"><p class="eyebrow page-kicker">Interactive work <span class="section-index">/ ICA</span></p>
      <h1 class="page-title">${escapeHtml(work.title)}</h1>
      <p class="prose demo-intro">${escapeHtml(work.description)}</p>
      <div class="demo-launch-panel"><div><p class="eyebrow">Ready when you are</p><p class="muted">${escapeHtml(work.note)}</p></div>
      <div class="demo-actions"><button id="launch-demo" type="button" data-analytics-work="cocktail-party-problem" data-analytics-action="launch-demo">Launch interactive demo <span aria-hidden="true">↗</span></button>
      <a class="text-link" href="${escapeHtml(work.url)}" data-analytics-work="cocktail-party-problem" data-analytics-action="open-hugging-face">Open on Hugging Face <span aria-hidden="true">→</span></a></div></div>
      <div id="demo-container" data-embed-url="${escapeHtml(work.embedUrl)}"></div></section>`,
    HEAD_EXTRA: accentStyle,
    ANALYTICS: analytics,
    SCRIPTS: '<script type="module" src="/assets/js/demo.js"></script>',
  }));

  // --- 404 ---
  await writeFile(join(dist, '404.html'), fill(layout, {
    TITLE: `Not found — ${escapeHtml(site.name)}`,
    DESCRIPTION: '',
    PAGE: '404',
    SITE_NAME: site.name,
    FOOTER_TEXT: site.footer,
    CONTENT: `<section class="page"><h1 class="page-title">404</h1><p class="prose">That page doesn't exist. <a href="/">Go home</a>.</p></section>`,
    HEAD_EXTRA: '',
    ANALYTICS: analytics,
    SCRIPTS: '',
  }));

  // --- assets ---
  await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
  await mkdir(join(dist, 'assets', 'js', 'vendor'), { recursive: true });
  await cp(join(root, 'node_modules/three/build/three.module.js'),
    join(dist, 'assets', 'js', 'vendor', 'three.module.js'));

  console.log(`built ${posts.length} post(s) -> ${dist}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
