import { mkdir, writeFile, cp, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPosts } from './lib/posts.mjs';
import { renderMarkdown } from './lib/render.mjs';

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
  const accentStyle = site.accent
    ? `<style>:root{--accent:${site.accent}}[data-theme="light"]{--accent:${site.accent}}</style>`
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
    <article class="post">
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
  const homeContent = `
  <section class="hero">
    <h1 class="hero-title reveal">${escapeHtml(site.tagline)}</h1>
    <p class="hero-sub reveal">${escapeHtml(site.intro)}</p>
  </section>
  <section class="section about">
    <h2 class="eyebrow reveal">About</h2>
    <div class="prose about-body reveal">${renderMarkdown(aboutBody)}</div>
  </section>
  <section class="section posts">
    <h2 class="eyebrow reveal">Writing</h2>
    <div class="card-grid">${cards || '<p class="prose muted">No posts yet.</p>'}</div>
  </section>`;
  await writeFile(join(dist, 'index.html'), fill(layout, {
    TITLE: site.name,
    DESCRIPTION: escapeHtml(site.tagline),
    PAGE: 'home',
    SITE_NAME: site.name,
    FOOTER_TEXT: site.footer,
    CONTENT: homeContent,
    HEAD_EXTRA: accentStyle,
    SCRIPTS: '<script type="module" src="/assets/js/tensor.js"></script>',
  }));

  // --- about ---
  const aboutContent = `
  <section class="page">
    <h1 class="page-title reveal">About</h1>
    <div class="prose reveal">${renderMarkdown(aboutBody)}</div>
  </section>`;
  await writeFile(join(dist, 'about.html'), fill(layout, {
    TITLE: `About — ${escapeHtml(site.name)}`,
    DESCRIPTION: escapeHtml(site.intro),
    PAGE: 'about',
    SITE_NAME: site.name,
    FOOTER_TEXT: site.footer,
    CONTENT: aboutContent,
    HEAD_EXTRA: accentStyle,
    SCRIPTS: '',
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
