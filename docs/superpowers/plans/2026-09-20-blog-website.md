# Personal Blog Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lean, file-based personal blog (Markdown posts → static site) with a distinctive Three.js "tensor" identity, deployable to Hetzner via Coolify with Docker Compose.

**Architecture:** A tiny custom Node build (`src/build.mjs`) converts `content/posts/*.md` + `content/about.md` + `content/site.json` into a static `dist/` using `markdown-it` and a single `layout.html` template. Vanilla ES-module JS provides the effects and the 3D tensor background. `docker build` produces an nginx image that serves `dist/`.

**Tech Stack:** Node 20+ (ES modules), `markdown-it`, `three` (vendored), vanilla JS + hand-written CSS, nginx, Docker Compose. No framework, no server runtime, no database.

**Spec:** `docs/superpowers/specs/2026-09-20-blog-website-design.md`

## Global Constraints

Every task's requirements implicitly include these (copied verbatim from the spec):

- **Dependencies:** the only npm dependencies are `markdown-it` and `three`. Do not add frameworks (React/Vue/etc.), CSS frameworks, or SSGs.
- **ES modules only.** `package.json` has `"type": "module"`. All `.mjs`/`.js` source files use `import`/`export`.
- **No CDN at runtime.** Three.js is vendored locally into `dist/assets/js/vendor/three.module.js` by the build. No external `<script src="https://...">`.
- **Content is files in the repo.** Adding a post = dropping one `.md` in `content/posts/`. No CMS, no backend.
- **Accessibility:** respect `prefers-reduced-motion`; AA contrast in both themes; visible focus styles; skip-to-content link; alt text on figures.
- **Dark theme is the default;** light is an alternate via `data-theme="light"` on `<html>`.
- **Reading column max-width ~68ch.** Headings/nav/meta/code are monospace; body text is the sans stack.
- **Output dir is `dist/`** and is gitignored. The build is a **one-shot** `node src/build.mjs`; watching/serving is `src/serve.mjs --watch`.
- **Slug rule:** filename without `.md`. `2025-01-15-intro.md` → `dist/posts/2025-01-15-intro.html`.
- **Coolify wiring is out of scope.** We only guarantee `docker build` produces an image serving `dist/` on port 80, and `docker compose up` works.
- **Commits:** each task ends with a commit. Use conventional-commit-style messages.

## Review Focus

Five input classes / failure modes the spec implies but a happy-path build won't exercise. Each is pinned to a task below.

1. **Post with no front-matter** (a `.md` that is pure prose, no `---` block). Expected: renders as a post with `title = slug`, empty date/tags, no crash. → pinned to **Task 3** (`posts.test.mjs`).
2. **Titles/meta containing HTML or special characters** (`<`, `&`, quotes). Expected: escaped in titles/descriptions/meta so no broken markup; Markdown *body* still renders raw HTML (figure escape hatch). → pinned to **Task 5** (`build.test.mjs`).
3. **Zero posts** (empty `content/posts/`). Expected: home page renders with an empty "Writing" section; build succeeds; no crash. → pinned to **Task 5** (`build.test.mjs`).
4. **Post referencing a missing image** (`cover` or `![](img/...)` that doesn't exist). Expected: page still renders; build does not fail (broken image degrades gracefully). → exercised in **Task 5**: the sample post references a non-existent `img/placeholder.png`, and the "build produces the expected dist/ structure" test builds with it present and must still pass.
5. **`prefers-reduced-motion` / mobile** on the tensor background. Expected: static or gentle single frame, reduced node count, no animation; text stays readable over the background. → pinned to **Task 8** (manual verification checklist).

---

## Task 1: Project scaffold & content

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `content/site.json`
- Create: `content/about.md`
- Create: `content/posts/2025-01-15-hello-world.md`
- Create (stubs, replaced in later tasks): `assets/css/main.css`, `assets/js/main.js`, `assets/js/figures.js`, `assets/js/tensor.js`
- Create: `assets/js/vendor/.gitkeep`
- Create: `test/scaffold.test.mjs`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the directory tree every later task assumes; a working `npm install`; sample content the build (Task 5) consumes. `content/site.json` schema used by Task 5: `{ name, tagline, intro, footer, accent }`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "blog-website",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node src/build.mjs",
    "dev": "node src/serve.mjs --watch",
    "test": "node --test"
  },
  "dependencies": {
    "markdown-it": "^14.1.0",
    "three": "^0.160.0"
  }
}
```

- [ ] **Step 2: Replace `.gitignore`** (the current one is Python-oriented; this is a Node project)

```
node_modules/
dist/
.DS_Store
*.log
```

- [ ] **Step 3: Write `content/site.json`**

```json
{
  "name": "Your Name",
  "tagline": "Notes on control & tensors",
  "intro": "I'm a control engineer who thinks in tensors. This is where I write about both.",
  "footer": "© 2026 Your Name",
  "accent": "#22d3ee"
}
```

- [ ] **Step 4: Write `content/about.md`** (plain Markdown, no front-matter)

```markdown
I'm a control engineer who has spent the last few years thinking about
dynamical systems, feedback, and the geometry of high-dimensional data.

This site is a place to write clearly about the two things I care about most:
**control engineering** and **tensor algebra** — and occasionally where they
meet.

Reach out via the links in the footer.
```

- [ ] **Step 5: Write the sample post `content/posts/2025-01-15-hello-world.md`**

```markdown
---
title: "Hello, world"
date: 2025-01-15
description: "The first post — what this site is and how it works."
tags: [meta]
hero: true
---

This is the first post on the site. It exists to exercise every feature the
build supports: a title, metadata, tags, a static figure, and an interactive
one.

## A static figure

![A placeholder static figure](img/placeholder.png)

## An interactive figure

<div class="fig" data-figure="tensor-wave" data-config='{"freq":1}'></div>
```

- [ ] **Step 6: Write stub assets** (each is a valid placeholder that Task 5's build will copy; Tasks 6–9 replace them with real code)

`assets/css/main.css`:
```css
/* design system — replaced in Task 6 */
body { margin: 0; font-family: system-ui, sans-serif; }
```

`assets/js/main.js`:
```js
// effects — replaced in Task 7
export {};
```

`assets/js/figures.js`:
```js
// figure registry — replaced in Task 9
export {};
```

`assets/js/tensor.js`:
```js
// three.js background — replaced in Task 8
export {};
```

`assets/js/vendor/.gitkeep`: empty file.

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: completes; `node_modules/markdown-it` and `node_modules/three/build/three.module.js` exist.

- [ ] **Step 8: Write the scaffold test `test/scaffold.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const mustExist = [
  'package.json', '.gitignore',
  'content/site.json', 'content/about.md',
  'content/posts/2025-01-15-hello-world.md',
  'assets/css/main.css', 'assets/js/main.js',
  'assets/js/figures.js', 'assets/js/tensor.js',
];

test('package.json is ESM with the required scripts', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.ok(pkg.scripts.build && pkg.scripts.dev && pkg.scripts.test);
  assert.ok(pkg.dependencies['markdown-it'] && pkg.dependencies['three']);
});

test('all scaffold files exist', async () => {
  for (const p of mustExist) {
    await access(join(root, p));
  }
});

test('site.json has the schema the build relies on', async () => {
  const site = JSON.parse(await readFile(join(root, 'content/site.json'), 'utf8'));
  for (const k of ['name', 'tagline', 'intro', 'footer', 'accent']) {
    assert.ok(typeof site[k] === 'string' && site[k].length > 0, `site.${k}`);
  }
});
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `node --test test/scaffold.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add package.json .gitignore content assets test/scaffold.test.mjs
git commit -m "chore: scaffold project, content, and asset stubs"
```

---

## Task 2: Front-matter parser

**Files:**
- Create: `src/lib/frontmatter.mjs`
- Test: `test/frontmatter.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseFrontmatter(markdown: string) => { data: object, body: string }`.
  - `data` supports: string values, booleans (`true`/`false`), and inline string lists (`[a, b]`). Unknown/absent keys are simply absent.
  - `body` is the Markdown after the closing `---`.
  - If there is no front-matter block, returns `{ data: {}, body: <whole input> }`.
  - Consumed by Task 3 (`posts.mjs`).

- [ ] **Step 1: Write the failing test `test/frontmatter.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../src/lib/frontmatter.mjs';

test('parses scalars, booleans, and inline lists', () => {
  const src = [
    '---',
    'title: "Hello, world"',
    'date: 2025-01-15',
    'description: First post',
    'tags: [meta, hello]',
    'hero: true',
    'cover: img/x.png',
    '---',
    '',
    'Body text here.',
  ].join('\n');
  const { data, body } = parseFrontmatter(src);
  assert.equal(data.title, 'Hello, world');
  assert.equal(data.date, '2025-01-15');
  assert.deepEqual(data.tags, ['meta', 'hello']);
  assert.equal(data.hero, true);
  assert.equal(data.cover, 'img/x.png');
  assert.equal(body.trim(), 'Body text here.');
});

test('boolean false is parsed as false', () => {
  const { data } = parseFrontmatter('---\nhero: false\n---\nbody');
  assert.equal(data.hero, false);
});

test('no front-matter returns empty data and full body', () => {
  const { data, body } = parseFrontmatter('Just a plain post.\n\nMore.');
  assert.deepEqual(data, {});
  assert.equal(body, 'Just a plain post.\n\nMore.');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/frontmatter.test.mjs`
Expected: FAIL — `Cannot find module .../src/lib/frontmatter.mjs`.

- [ ] **Step 3: Write `src/lib/frontmatter.mjs`**

```js
// Minimal YAML-front-matter parser for the constrained schema we use.
// Supports: `key: value` strings, booleans, and inline lists `[a, b]`.
const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(markdown) {
  const match = FENCE.exec(markdown);
  if (!match) return { data: {}, body: markdown };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    data[key] = coerce(line.slice(idx + 1).trim());
  }
  return { data, body: markdown.slice(match[0].length) };
}

function coerce(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
  }
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/frontmatter.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/frontmatter.mjs test/frontmatter.test.mjs
git commit -m "feat: add minimal YAML front-matter parser"
```

---

## Task 3: Post loading, sorting & reading time

**Files:**
- Create: `src/lib/posts.mjs`
- Test: `test/posts.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter` from `src/lib/frontmatter.mjs` (Task 2).
- Produces:
  - `loadPosts(postsDir: string): Promise<Post[]>` — reads every `*.md` in `postsDir`, returns posts sorted by `date` **descending**. An empty or missing dir returns `[]`.
  - `Post` shape: `{ slug, title, date, description, tags: string[], hero: boolean, cover: string, body: string, readingTime: number }`.
  - `readingTime(body: string): number` — words / 200, rounded up, minimum 1.
  - Consumed by Task 5 (`build.mjs`).

- [ ] **Step 1: Write the failing test `test/posts.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPosts, readingTime } from '../src/lib/posts.mjs';

async function makeDir(files) {
  const dir = await mkdtemp(join(tmpdir(), 'posts-'));
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

test('sorts by date descending and parses fields', async () => {
  const dir = await makeDir({
    '2024-01-01-older.md': '---\ntitle: Older\ndate: 2024-01-01\ntags: [a]\n---\nOld body',
    '2025-06-01-newer.md': '---\ntitle: Newer\ndate: 2025-06-01\ntags: [b, c]\nhero: true\n---\nNew body',
  });
  const posts = await loadPosts(dir);
  assert.deepEqual(posts.map((p) => p.slug), ['2025-06-01-newer', '2024-01-01-older']);
  const newer = posts[0];
  assert.equal(newer.title, 'Newer');
  assert.deepEqual(newer.tags, ['b', 'c']);
  assert.equal(newer.hero, true);
  assert.equal(newer.cover, '');
});

test('post with no front-matter: title falls back to slug, no crash', async () => {
  const dir = await makeDir({
    'plain-post.md': 'Just prose.\n\nNo metadata here at all.',
  });
  const [post] = await loadPosts(dir);
  assert.equal(post.slug, 'plain-post');
  assert.equal(post.title, 'plain-post');
  assert.deepEqual(post.tags, []);
  assert.equal(post.hero, false);
  assert.equal(post.readingTime, 1);
});

test('missing dir returns empty array', async () => {
  const posts = await loadPosts(join(tmpdir(), 'does-not-exist-' + Date.now()));
  assert.deepEqual(posts, []);
});

test('readingTime is words/200 rounded up, min 1', () => {
  assert.equal(readingTime(''), 1);
  assert.equal(readingTime('x'.repeat(1).padEnd(1, 'a')), 1);
  const body = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ');
  assert.equal(readingTime(body), 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/posts.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/posts.mjs`**

```js
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

export function readingTime(body) {
  const words = body.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 200));
}

export async function loadPosts(postsDir) {
  let files = [];
  try {
    files = await readdir(postsDir);
  } catch {
    return [];
  }
  const posts = [];
  for (const file of files.filter((f) => f.endsWith('.md')).sort()) {
    const raw = await readFile(join(postsDir, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const slug = basename(file, '.md');
    posts.push({
      slug,
      title: data.title ?? slug,
      date: data.date ?? '',
      description: data.description ?? '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      hero: data.hero === true,
      cover: data.cover ?? '',
      body,
      readingTime: readingTime(body),
    });
  }
  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/posts.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/posts.mjs test/posts.test.mjs
git commit -m "feat: load, sort, and compute reading time for posts"
```

---

## Task 4: Markdown rendering

**Files:**
- Create: `src/lib/render.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: `markdown-it` (installed in Task 1).
- Produces: `renderMarkdown(body: string): string` — returns HTML. **Raw inline HTML is preserved** (required for the `data-figure` escape hatch). Consumed by Task 5.

- [ ] **Step 1: Write the failing test `test/render.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/lib/render.mjs';

test('renders headings and emphasis', () => {
  const html = renderMarkdown('## Title\n\nSome **bold** text.');
  assert.ok(html.includes('<h2'));
  assert.ok(html.includes('<strong>bold</strong>'));
});

test('preserves raw inline HTML (figure escape hatch)', () => {
  const src = '<div class="fig" data-figure="tensor-wave" data-config=\'{"freq":1}\'></div>';
  const html = renderMarkdown(src);
  assert.ok(html.includes('data-figure="tensor-wave"'));
});

test('renders markdown images as <img>', () => {
  const html = renderMarkdown('![alt text](img/x.png)');
  assert.ok(html.includes('<img'));
  assert.ok(html.includes('img/x.png'));
  assert.ok(html.includes('alt="alt text"'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/render.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/render.mjs`**

```js
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,     // preserve raw inline HTML -> data-figure escape hatch
  linkify: true,
  typographer: false,
});

export function renderMarkdown(body) {
  return md.render(body);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/render.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/render.mjs test/render.test.mjs
git commit -m "feat: render markdown with raw-HTML passthrough"
```

---

## Task 5: Build pipeline & layout template

**Files:**
- Create: `src/layout.html`
- Create: `src/build.mjs`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: `loadPosts` (Task 3), `renderMarkdown` (Task 4), `content/site.json` + `content/posts/*` + `content/about.md` + `assets/` (Task 1), `node_modules/three/build/three.module.js` (Task 1 install).
- Produces: a `dist/` directory containing:
  - `index.html` (home), `about.html`, `404.html`
  - `posts/<slug>.html` for each post
  - `assets/**` (copied from `assets/`) and `assets/js/vendor/three.module.js` (vendored)
  - Layout template placeholders (exact strings): `{{TITLE}} {{DESCRIPTION}} {{PAGE}} {{SITE_NAME}} {{FOOTER_TEXT}} {{CONTENT}} {{HEAD_EXTRA}} {{SCRIPTS}}`.
  - Pages set `data-page` on `<body>` to `home` | `post` | `about` | `404`. `main.js` is included on every page via the layout; `tensor.js` is injected into `{{SCRIPTS}}` on home + hero posts; `figures.js` on all post pages.

- [ ] **Step 1: Write the failing test `test/build.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const run = (cmd, args) =>
  new Promise((res, rej) =>
    execFile(cmd, args, { cwd: root }, (e, so, se) =>
      e ? rej(new Error(`${cmd} ${args.join(' ')}: ${e.message}\n${se}`)) : res({ so, se })));

// Build once, before the per-file assertions.
test('build produces the expected dist/ structure', async () => {
  await run('node', ['src/build.mjs']);
  const expect = [
    'dist/index.html', 'dist/about.html', 'dist/404.html',
    'dist/posts/2025-01-15-hello-world.html',
    'dist/assets/css/main.css', 'dist/assets/js/main.js',
    'dist/assets/js/vendor/three.module.js',
  ];
  for (const p of expect) await access(join(root, p));
  const home = await readFile(join(root, 'dist/index.html'), 'utf8');
  assert.ok(home.includes('data-page="home"'));
  assert.ok(home.includes('/assets/js/tensor.js')); // home always has the hero
});

test('special characters in titles are escaped (Review Focus #2)', async () => {
  // Add a post with HTML-ish title, rebuild, assert it is escaped.
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(join(root, 'content/posts'), { recursive: true });
  await writeFile(join(root, 'content/posts/zz-evil.md'),
    '---\ntitle: "A <b>bold</b> & \\u201cquoted\\u201d title"\ndate: 2025-02-02\n---\nbody\n');
  try {
    await run('node', ['src/build.mjs']);
    const html = await readFile(join(root, 'dist/posts/zz-evil.html'), 'utf8');
    assert.ok(!html.includes('A <b>bold</b>')); // raw tags must not appear in the <title>/h1
    assert.ok(html.includes('&lt;b&gt;'));
  } finally {
    const { rm } = await import('node:fs/promises');
    await rm(join(root, 'content/posts/zz-evil.md'), { force: true });
  }
});

test('zero posts: home still builds (Review Focus #3)', async () => {
  const { rename } = await import('node:fs/promises');
  const postsDir = join(root, 'content/posts');
  const stash = join(root, 'content/posts.stash');
  await rename(postsDir, stash);
  try {
    await run('node', ['src/build.mjs']);
    const home = await readFile(join(root, 'dist/index.html'), 'utf8');
    assert.ok(home.includes('data-page="home"'));
    assert.ok(home.includes('No posts yet.'));
  } finally {
    await rename(stash, postsDir); // always restore the real posts dir
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/build.test.mjs`
Expected: FAIL — `src/build.mjs` not found.

- [ ] **Step 3: Write `src/layout.html`**

```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{TITLE}}</title>
  <meta name="description" content="{{DESCRIPTION}}" />
  <link rel="stylesheet" href="/assets/css/main.css" />
  <script>
    // Set theme before paint to avoid a flash of the wrong theme.
    (function () {
      var t = localStorage.getItem('theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
      else if (matchMedia('(prefers-color-scheme: light)').matches)
        document.documentElement.setAttribute('data-theme', 'light');
    })();
  </script>
  {{HEAD_EXTRA}}
</head>
<body data-page="{{PAGE}}">
  <div id="tensor-bg" class="tensor-bg" aria-hidden="true"></div>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/">{{SITE_NAME}}</a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/">Home</a>
      <a href="/about.html">About</a>
      <button id="theme-toggle" type="button" aria-label="Toggle color theme">☾</button>
    </nav>
  </header>
  <main id="main">
    {{CONTENT}}
  </main>
  <footer class="site-footer">
    <span class="footer-text">{{FOOTER_TEXT}}</span>
  </footer>
  <div id="reading-progress" class="reading-progress" aria-hidden="true"></div>
  <script type="module" src="/assets/js/main.js"></script>
  {{SCRIPTS}}
</body>
</html>
```

- [ ] **Step 4: Write `src/build.mjs`**

```js
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test test/build.test.mjs`
Expected: PASS (3 tests). Then run `npm run build` and open `dist/index.html` in a browser to sanity-check structure (unstyled, since CSS is still a stub).

- [ ] **Step 6: Commit**

```bash
git add src/layout.html src/build.mjs test/build.test.mjs
git commit -m "feat: build pipeline producing home, posts, about, 404, and vendored three"
```

---

## Task 6: CSS design system

**Files:**
- Modify: `assets/css/main.css` (replace the stub from Task 1)

**Interfaces:**
- Consumes: the DOM classes the layout (Task 5) emits — `site-header`, `brand`, `site-nav`, `theme-toggle`, `skip`, `main`, `site-footer`, `footer-text`, `tensor-bg`, `reading-progress`, `hero`, `hero-title`, `hero-sub`, `section`, `eyebrow`, `about-body`, `card-grid`, `card`, `card-title`, `card-meta`, `card-desc`, `tags`, `post`, `post-hero`, `post-head`, `post-title`, `post-meta`, `dot`, `prose`, `page`, `page-title`, `muted`, `fig`, `copy-btn`, and the state classes `.revealed` / `.active`.
- Produces: the visual identity. Design tokens are CSS custom properties on `:root` (dark) and `[data-theme="light"]`.

**Verification note:** CSS has no unit test. The automated check below only asserts the stylesheet is non-trivial and defines the tokens. The real gate is the **manual browser checklist** in Step 3 — run it and do not commit until it passes.

- [ ] **Step 1: Replace `assets/css/main.css`**

```css
/* ============ tokens ============ */
:root {
  --accent: #22d3ee;
  --accent-warm: #f472b6;
  --bg: #0a0e14;
  --bg-elevated: #111722;
  --text: #e6edf3;
  --text-muted: #8b98a5;
  --border: #1f2937;
  --grid-line: rgba(148, 163, 184, 0.06);
  --maxw: 68ch;
  --radius: 10px;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: dark;
}
[data-theme="light"] {
  --bg: #f7f9fb;
  --bg-elevated: #ffffff;
  --text: #0f172a;
  --text-muted: #5b6675;
  --border: #dbe2ea;
  --grid-line: rgba(15, 23, 42, 0.05);
  color-scheme: light;
}

/* ============ base ============ */
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  /* faint coordinate-grid texture */
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 40px 40px;
}
h1, h2, h3, h4, .brand, .eyebrow, .site-nav, .post-meta, .card-meta, .tags {
  font-family: var(--mono);
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

.skip {
  position: absolute; left: -999px; top: 0; z-index: 100;
  background: var(--accent); color: #04121a; padding: 8px 14px; border-radius: 0 0 8px 0;
}
.skip:focus { left: 0; }

/* ============ tensor background ============ */
.tensor-bg {
  display: none;
}
.tensor-bg.active {
  display: block;
  position: fixed; inset: 0; z-index: 0;
  opacity: 0.5;              /* dimmed so text stays readable */
  pointer-events: none;
}
main, .site-header, .site-footer { position: relative; z-index: 1; }

/* ============ header / footer ============ */
.site-header {
  position: sticky; top: 0; z-index: 2;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px clamp(16px, 5vw, 48px);
  backdrop-filter: blur(8px);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  border-bottom: 1px solid var(--border);
}
.brand { font-weight: 700; letter-spacing: 0.02em; color: var(--text); }
.brand:hover { text-decoration: none; color: var(--accent); }
.site-nav { display: flex; align-items: center; gap: 18px; font-size: 0.9rem; }
.site-nav a { color: var(--text-muted); }
.site-nav a:hover { color: var(--text); text-decoration: none; }
#theme-toggle {
  background: none; border: 1px solid var(--border); color: var(--text);
  font-family: var(--mono); border-radius: 8px; padding: 4px 9px; cursor: pointer;
}
#theme-toggle:hover { border-color: var(--accent); color: var(--accent); }
.site-footer {
  border-top: 1px solid var(--border);
  padding: 24px clamp(16px, 5vw, 48px);
  color: var(--text-muted); font-family: var(--mono); font-size: 0.85rem;
}

/* ============ layout ============ */
main { max-width: var(--maxw); margin: 0 auto; padding: clamp(24px, 6vw, 64px) clamp(16px, 5vw, 32px) 80px; }
.section { margin-top: 56px; }
.eyebrow {
  text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.8rem;
  color: var(--accent); margin: 0 0 16px;
}
.prose { font-size: 1.05rem; }
.prose > * + * { margin-top: 1em; }
.prose h1, .prose h2, .prose h3 { line-height: 1.25; margin-top: 1.6em; }
.muted { color: var(--text-muted); }

/* ============ code ============ */
.prose pre {
  position: relative; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px; overflow-x: auto; font-size: 0.9rem;
}
.prose pre code { font-family: var(--mono); }
.prose :not(pre) > code {
  font-family: var(--mono); background: var(--bg-elevated);
  padding: 2px 6px; border-radius: 5px; font-size: 0.9em;
}
.copy-btn {
  position: absolute; top: 8px; right: 8px;
  font-family: var(--mono); font-size: 0.72rem;
  background: var(--bg); color: var(--text-muted);
  border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; cursor: pointer;
}
.copy-btn:hover { color: var(--accent); border-color: var(--accent); }

/* ============ home: hero ============ */
.hero { min-height: 60vh; display: flex; flex-direction: column; justify-content: center; }
.hero-title {
  font-size: clamp(2.2rem, 7vw, 4.5rem); line-height: 1.05;
  margin: 0 0 18px; letter-spacing: -0.02em;
}
.hero-sub { font-size: 1.2rem; color: var(--text-muted); max-width: 46ch; margin: 0; }

/* ============ home: cards ============ */
.card-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 720px) { .card-grid { grid-template-columns: 1fr 1fr; } }
.card {
  display: block; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px; color: var(--text);
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.card:hover { text-decoration: none; transform: translateY(-3px); border-color: var(--accent); }
.card-title { margin: 0 0 8px; font-size: 1.2rem; color: var(--text); }
.card-meta { margin: 0 0 10px; color: var(--text-muted); font-size: 0.82rem; }
.card-desc { margin: 0; color: var(--text-muted); }
.tags { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 12px 0 0; }
.tags li {
  font-size: 0.72rem; letter-spacing: 0.04em; color: var(--accent);
  border: 1px solid var(--border); border-radius: 999px; padding: 2px 10px;
}

/* ============ post page ============ */
.post-hero { height: 32vh; border-radius: var(--radius); margin-bottom: 28px; }
.post-title { font-size: clamp(1.8rem, 5vw, 3rem); line-height: 1.1; margin: 0 0 12px; letter-spacing: -0.02em; }
.post-meta { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 6px; display: flex; gap: 8px; align-items: center; }
.dot { color: var(--border); }

/* ============ figures ============ */
.fig { position: relative; width: 100%; height: 340px; margin: 24px 0;
  border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
  background: var(--bg-elevated); }
.fig canvas { display: block; width: 100%; height: 100%; }

/* ============ reading progress ============ */
.reading-progress {
  position: fixed; top: 0; left: 0; height: 3px; width: 100%; z-index: 3;
  background: var(--accent); transform: scaleX(0); transform-origin: 0 50%;
}

/* ============ reveal animation ============ */
.reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.5s ease, transform 0.5s ease; }
.reveal.revealed { opacity: 1; transform: none; }

/* ============ reduced motion ============ */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal { opacity: 1; transform: none; transition: none; }
  .tensor-bg.active { opacity: 0.35; }
}
```

- [ ] **Step 2: Add a light structural test to `test/build.test.mjs`** (append this test)

```js
test('main.css defines the design tokens', async () => {
  await run('node', ['src/build.mjs']);
  const css = await readFile(join(root, 'dist/assets/css/main.css'), 'utf8');
  assert.ok(css.includes('--accent'));
  assert.ok(css.includes('[data-theme="light"]'));
  assert.ok(css.includes('.tensor-bg'));
  assert.ok(css.includes('prefers-reduced-motion'));
});
```

- [ ] **Step 3: Manual browser checklist (gate — do not commit until all pass)**

Run: `npm run build && npm run dev` and open `http://localhost:4173`. Verify:
- [ ] Dark theme by default; grid texture faintly visible.
- [ ] Toggle button switches to light theme; both themes have comfortable AA contrast for body text.
- [ ] Home: hero, About, and Writing sections render; cards are in a grid on wide screens, single column on mobile (resize the window).
- [ ] Monospace is used for the brand, nav, headings, eyebrows, dates/tags; body text is the sans.
- [ ] The cyan accent appears on links, the toggle hover, tags, and the eyebrow labels — used sparingly.
- [ ] `Ctrl+L`-free: the reading-progress bar is present (thin, top) — it animates on the post page (Task 7 wires it; here it may be static at 0, which is fine).

- [ ] **Step 4: Run the build test and commit**

Run: `node --test test/build.test.mjs`
Expected: PASS (4 tests).

```bash
git add assets/css/main.css test/build.test.mjs
git commit -m "feat: CSS design system (tokens, dark/light, layout, cards, post)"
```

---

## Task 7: Effects JavaScript (`main.js`)

**Files:**
- Modify: `assets/js/main.js` (replace the stub from Task 1)

**Interfaces:**
- Consumes: DOM from `layout.html` (Task 5): `#theme-toggle`, `#reading-progress`, `body[data-page]`, `.reveal` elements, `pre`/`code` blocks, `localStorage`, `matchMedia`.
- Produces: dark-mode toggle (persisted), reading-progress bar (post pages only), scroll-reveal (respects reduced motion), copy buttons on code blocks.

**Verification note:** no unit test (front-end). The automated check only asserts the file is non-trivial. The gate is the manual checklist in Step 3.

- [ ] **Step 1: Replace `assets/js/main.js`**

```js
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
```

- [ ] **Step 2: Add a structural test to `test/build.test.mjs`** (append)

```js
test('main.js implements the expected effects hooks', async () => {
  await run('node', ['src/build.mjs']);
  const js = await readFile(join(root, 'dist/assets/js/main.js'), 'utf8');
  for (const needle of ['theme-toggle', 'reading-progress', 'reveal', 'copy-btn', 'prefers-reduced-motion']) {
    assert.ok(js.includes(needle), `main.js should reference ${needle}`);
  }
});
```

- [ ] **Step 3: Manual browser checklist (gate)**

Run: `npm run build && npm run dev`. Verify:
- [ ] Toggle switches theme and the icon changes (☀/☾); reload the page — the choice persists (localStorage).
- [ ] On a post page, the thin top bar grows as you scroll; on the home page it stays empty.
- [ ] Home sections/cards fade+rise into view as you scroll.
- [ ] With OS "reduce motion" enabled, content is fully visible immediately (no hidden `.reveal`) and the bar is static.
- [ ] A post with a code block shows a `copy` button; clicking it changes to `copied!`.

- [ ] **Step 4: Run the test and commit**

Run: `node --test test/build.test.mjs`
Expected: PASS (5 tests).

```bash
git add assets/js/main.js test/build.test.mjs
git commit -m "feat: site effects (theme toggle, reading progress, reveal, copy)"
```

---

## Task 8: Three.js tensor background (`tensor.js`)

**Files:**
- Modify: `assets/js/tensor.js` (replace the stub from Task 1)

**Interfaces:**
- Consumes: `#tensor-bg` container (Task 5 layout) and `/assets/js/vendor/three.module.js` (vendored by the build, Task 5). Runs only on home + `hero` posts (the build injects this script there).
- Produces: an animated 3D lattice of glowing points that responds to the mouse with a spring-damped (control-system) motion. Respects reduced motion, mobile, and pauses when hidden/off-screen.

**Verification note:** no unit test. The gate is the manual checklist in Step 3, which includes the reduced-motion / mobile checks (Review Focus #5).

- [ ] **Step 1: Replace `assets/js/tensor.js`**

```js
import * as THREE from '/assets/js/vendor/three.module.js';

const container = document.getElementById('tensor-bg');
if (container) init();

function init() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 768px)').matches;
  const N = isMobile ? 6 : 9;         // lattice nodes per axis
  const SPACING = 1.5;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);
  container.classList.add('active');

  const count = N * N * N;
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  let i = 0;
  const half = (N - 1) / 2;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        base[i * 3] = (x - half) * SPACING;
        base[i * 3 + 1] = (y - half) * SPACING;
        base[i * 3 + 2] = (z - half) * SPACING;
        positions[i * 3] = base[i * 3];
        positions[i * 3 + 1] = base[i * 3 + 1];
        positions[i * 3 + 2] = base[i * 3 + 2];
        i++;
      }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x22d3ee, size: 0.18, transparent: true, opacity: 0.9,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const stiffness = 0.02, damping = 0.9; // spring-damper -> control-system feel
  let running = !document.hidden;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });
  new IntersectionObserver(([e]) => { running = e.isIntersecting && !document.hidden; }, { threshold: 0 }).observe(container);

  function step() {
    if (running) {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      points.rotation.y += (mouse.x * 0.6 - points.rotation.y) * 0.04;
      points.rotation.x += (-mouse.y * 0.6 - points.rotation.x) * 0.04;
      const t = performance.now() * 0.001;
      for (let n = 0; n < count; n++) {
        const ix = n * 3;
        const bx = base[ix], by = base[ix + 1], bz = base[ix + 2];
        const r = Math.hypot(bx, by, bz);
        const wave = Math.sin(r * 0.8 - t * 2) * 0.18 / (1 + r * 0.15);
        vel[ix] = (vel[ix] + (bx + wave - positions[ix]) * stiffness) * damping;
        vel[ix + 1] = (vel[ix + 1] + (by + wave - positions[ix + 1]) * stiffness) * damping;
        vel[ix + 2] = (vel[ix + 2] + (bz + wave - positions[ix + 2]) * stiffness) * damping;
        positions[ix] += vel[ix];
        positions[ix + 1] += vel[ix + 1];
        positions[ix + 2] += vel[ix + 2];
      }
      geo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(step);
  }

  if (reduced) {
    renderer.render(scene, camera); // single static frame
  } else {
    requestAnimationFrame(step);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}
```

- [ ] **Step 2: Add a structural test to `test/build.test.mjs`** (append)

```js
test('tensor.js is a three.js module with the expected guardrails', async () => {
  await run('node', ['src/build.mjs']);
  const js = await readFile(join(root, 'dist/assets/js/tensor.js'), 'utf8');
  assert.ok(js.includes("vendor/three.module.js"));
  assert.ok(js.includes('prefers-reduced-motion'));
  assert.ok(js.includes('visibilitychange'));
  assert.ok(js.includes('IntersectionObserver'));
});
```

- [ ] **Step 3: Manual browser checklist (gate — includes Review Focus #5)**

Run: `npm run build && npm run dev`. On the home page (and any `hero: true` post):
- [ ] A 3D lattice of cyan points fills the background, dimmed, behind the readable text.
- [ ] Moving the mouse tilts the lattice and the nodes wobble with a damped (spring) response.
- [ ] On a non-hero page (e.g., `/about.html`) there is **no** canvas and no `tensor.js` network request.
- [ ] Resize the window — the canvas rescales without distortion.
- [ ] Switch the tab away and back — animation pauses/resumes (watch FPS or a node freeze).
- [ ] **Reduce motion:** enable OS "reduce motion" and reload — the lattice renders a single static frame (no continuous animation).
- [ ] **Mobile:** in a narrow/mobile viewport, the lattice is sparser (6³ nodes) and still smooth; text remains readable over it.

- [ ] **Step 4: Run the test and commit**

Run: `node --test test/build.test.mjs`
Expected: PASS (6 tests).

```bash
git add assets/js/tensor.js test/build.test.mjs
git commit -m "feat: three.js tensor background with spring-damped mouse response"
```

---

## Task 9: Interactive figure registry (`figures.js`)

**Files:**
- Modify: `assets/js/figures.js` (replace the stub from Task 1)

**Interfaces:**
- Consumes: `[data-figure]`/`[data-config]` elements in post bodies (Task 5) and the vendored Three.js (imported **dynamically, only when a three-based figure is present**). Loaded on all post pages by the build.
- Produces: `registerFigure(type, init)` registry + auto-init on load; ships one built-in type `tensor-wave` (a bounded 3D tensor wave inside the `.fig` box). Adding a new figure type = one `registerFigure(...)` call.

**Verification note:** no unit test. The gate is the manual checklist in Step 3.

- [ ] **Step 1: Replace `assets/js/figures.js`**

```js
// figures.js — in-post interactive figures. Loaded on post pages.
const registry = new Map();

export function registerFigure(type, init) {
  registry.set(type, init);
}

let threePromise;
async function three() {
  threePromise ??= import('/assets/js/vendor/three.module.js');
  return threePromise;
}

// --- built-in: tensor-wave (bounded 3D lattice in the .fig box) ---
registerFigure('tensor-wave', async (el, cfg = {}) => {
  const THREE = await three();
  const freq = Number(cfg.freq) || 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 7, SPACING = 1.2;

  const scene = new THREE.Scene();
  const w = el.clientWidth || 320, h = el.clientHeight || 320;
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(0, 0, 11);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  el.appendChild(renderer.domElement);

  const count = N * N * N;
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  let i = 0; const half = (N - 1) / 2;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        base[i * 3] = (x - half) * SPACING;
        base[i * 3 + 1] = (y - half) * SPACING;
        base[i * 3 + 2] = (z - half) * SPACING;
        positions.set(base.subarray(i * 3, i * 3 + 3), i * 3);
        i++;
      }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.22, transparent: true, opacity: 0.95 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  function draw(t) {
    if (!reduced) {
      const time = (t * 0.001) * freq;
      for (let n = 0; n < count; n++) {
        const ix = n * 3;
        const r = Math.hypot(base[ix], base[ix + 1], base[ix + 2]);
        const wv = Math.sin(r * 0.9 - time * 2) * 0.4 / (1 + r * 0.2);
        positions[ix + 1] = base[ix + 1] + wv;
      }
      geo.attributes.position.needsUpdate = true;
      pts.rotation.y = time * 0.3;
    }
    renderer.render(scene, camera);
    if (!reduced) requestAnimationFrame(draw);
  }
  reduced ? renderer.render(scene, camera) : requestAnimationFrame(draw);
});

function initAll() {
  document.querySelectorAll('[data-figure]').forEach((el) => {
    const type = el.dataset.figure;
    let cfg = {};
    try { cfg = el.dataset.config ? JSON.parse(el.dataset.config) : {}; } catch {}
    const fn = registry.get(type);
    if (fn) fn(el, cfg);
    else console.warn(`[figures] unknown data-figure type: ${type}`);
  });
}
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initAll)
  : initAll();
```

- [ ] **Step 2: Add a structural test to `test/build.test.mjs`** (append)

```js
test('figures.js exposes a registry and ships tensor-wave', async () => {
  await run('node', ['src/build.mjs']);
  const js = await readFile(join(root, 'dist/assets/js/figures.js'), 'utf8');
  assert.ok(js.includes('registerFigure'));
  assert.ok(js.includes('tensor-wave'));
  assert.ok(js.includes('data-figure'));
});
```

- [ ] **Step 3: Manual browser checklist (gate)**

Run: `npm run build && npm run dev`. Open the sample post (`/posts/2025-01-15-hello-world.html`):
- [ ] The `<div data-figure="tensor-wave">` renders an animated 3D wave inside its bordered box (sized by the `.fig` CSS).
- [ ] Changing `data-config='{"freq":3}'` in the source and rebuilding makes the wave animate faster.
- [ ] An unknown `data-figure` type logs a console warning but does not throw.
- [ ] Three.js is only fetched when a three-based figure is present (check Network on a post with no figures — none).
- [ ] With reduce-motion on, the figure renders a single static frame.

- [ ] **Step 4: Run the test and commit**

Run: `node --test test/build.test.mjs`
Expected: PASS (7 tests).

```bash
git add assets/js/figures.js test/build.test.mjs
git commit -m "feat: interactive figure registry with tensor-wave type"
```

---

## Task 10: Local dev server (`serve.mjs`)

**Files:**
- Create: `src/serve.mjs`

**Interfaces:**
- Consumes: `dist/` (produced by `build.mjs`, Task 5); `content/` and `assets/` (for watch).
- Produces: `node src/serve.mjs --watch` serves `dist/` on `PORT` (default 4173) and rebuilds on changes to `content/` or `assets/` via `fs.watch`. `node src/serve.mjs` (no `--watch`) serves only.

- [ ] **Step 1: Write `src/serve.mjs`**

```js
import { createServer } from 'node:http';
import { readFile, stat, watch } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const port = Number(process.env.PORT || 4173);
const watchMode = process.argv.includes('--watch');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};

async function handler(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const filePath = normalize(join(dist, p));
  if (!filePath.startsWith(dist)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const s = await stat(filePath);
    const target = s.isDirectory() ? join(filePath, 'index.html') : filePath;
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      const nf = await readFile(join(dist, '404.html'));
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(nf);
    } catch { res.writeHead(404); res.end('Not found'); }
  }
}

const server = createServer(handler);
server.listen(port, () => console.log(`> blog dev server: http://localhost:${port}`));

if (watchMode) {
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('  change detected, rebuilding...');
      execFile('node', [join(__dirname, 'build.mjs')], () => console.log('  rebuilt'));
    }, 120);
  };
  for (const dir of ['content', 'assets']) {
    watch(join(root, dir), { recursive: true }, rebuild);
  }
  console.log('  watching content/ and assets/');
}
```

- [ ] **Step 2: Write the test `test/serve.test.mjs`**

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const PORT = 4599;
let proc;

async function waitFor(url, ms = 5000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { const r = await fetch(url); if (r.status < 500) return r; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not come up at ${url}`);
}

before(async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync('node', [join(root, 'src/build.mjs')], { cwd: root });
  proc = spawn('node', [join(root, 'src/serve.mjs')], { cwd: root, env: { ...process.env, PORT: String(PORT) } });
});
after(() => proc?.kill());

test('serves the home page', async () => {
  const r = await waitFor(`http://localhost:${PORT}/`);
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.ok(body.includes('data-page="home"'));
});

test('serves a post', async () => {
  const r = await fetch(`http://localhost:${PORT}/posts/2025-01-15-hello-world.html`);
  assert.equal(r.status, 200);
});

test('returns the 404 page for unknown routes', async () => {
  const r = await fetch(`http://localhost:${PORT}/nope.html`);
  assert.equal(r.status, 404);
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `node --test test/serve.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 4: Manual watch check**

Run: `npm run dev`, then edit `content/site.json` (change the tagline) and save. Expected: the console prints "change detected, rebuilding..." then "rebuilt"; refresh the browser and the tagline updates.

- [ ] **Step 5: Commit**

```bash
git add src/serve.mjs test/serve.test.mjs
git commit -m "feat: local dev server with file-watch rebuild"
```

---

## Task 11: Docker deployment

**Files:**
- Create: `Dockerfile`
- Create: `nginx.conf`
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: the whole repo (builds `dist/` in-image, Task 5).
- Produces: a Docker image that serves `dist/` on port 80; `docker compose up` runs it. **Coolify wiring is out of scope** — we only guarantee the image builds and serves.

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY content ./content
COPY src ./src
COPY assets ./assets
RUN npm run build

# --- serve stage ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 2: Write `nginx.conf`**

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri.html $uri/ /404.html;
  }
}
```

- [ ] **Step 3: Write `docker-compose.yml`**

```yaml
services:
  blog:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

- [ ] **Step 4: Write the test `test/docker.test.mjs`**

```js
import { test, skip } from 'node:test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dockerOk = (() => {
  try { execFileSync('docker', ['version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
})();

test('docker: image builds and serves the home page', { skip: !dockerOk && 'docker not available' }, async () => {
  const tag = 'blog-test-' + Date.now();
  execFileSync('docker', ['build', '-t', tag, root], { stdio: 'inherit' });
  const port = 8091;
  const { spawn } = await import('node:child_process');
  const c = spawn('docker', ['run', '-d', '-p', `${port}:80`, tag], { encoding: 'utf8' });
  const id = await new Promise((res, rej) => { let o = ''; c.stdout.on('data', d => o += d); c.on('close', () => res(o.trim())); rej; });
  try {
    let body = '';
    for (let i = 0; i < 50 && !body; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try { body = await (await fetch(`http://localhost:${port}/`)).text(); } catch {}
    }
    assert.ok(body.includes('data-page="home"'), 'home page served from the image');
  } finally {
    execFileSync('docker', ['rm', '-f', id]);
    execFileSync('docker', ['rmi', '-f', tag]);
  }
}, { timeout: 180000 });
```

- [ ] **Step 5: Run to verify**

Run: `node --test test/docker.test.mjs`
Expected: PASS (1 test) if Docker is available; SKIPPED with "docker not available" otherwise. Confirm the image serves the home page on port 8091 before it is torn down.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile nginx.conf docker-compose.yml test/docker.test.mjs
git commit -m "feat: multi-stage Docker build + nginx serve + compose"
```

---

## Task 12: README & final integration

**Files:**
- Create: `README.md`
- Modify: `test/build.test.mjs` (add a full-suite sanity test)

**Interfaces:**
- Consumes: everything (final task).
- Produces: a README documenting the workflow; a final green full test run.

- [ ] **Step 1: Write `README.md`**

````markdown
# Blog Website

A lean, file-based personal blog. Markdown in → static site out, with a
Three.js "tensor" identity. No framework, no server, no database.

## Quick start

```bash
npm install
npm run dev        # builds, then serves at http://localhost:4173 (watch mode)
```

Other commands:

```bash
npm run build      # one-shot build to dist/
npm test           # run the test suite
```

## Writing a post

Drop a file in `content/posts/`:

```
content/posts/2026-02-01-my-post.md
```

```markdown
---
title: "My post"
date: 2026-02-01
description: "One-line summary shown on the home page."
tags: [control, tensors]
hero: true                # optional: show the 3D tensor hero on this post
cover: img/something.png  # optional: static cover image
---

Write in **Markdown**.

![A static figure](img/something.png)

<!-- an interactive figure (type + JSON config) -->
<div class="fig" data-figure="tensor-wave" data-config='{"freq":1}'></div>
```

That's it — the post appears on the home page, sorted by date.

## Site config

`content/site.json` holds the site name, tagline, intro, footer text, and the
accent color. `content/about.md` is the About page (plain Markdown).

## Interactive figures

Declare `<div data-figure="TYPE" data-config='JSON'>` in a post. Built-in
types live in `assets/js/figures.js` (`registerFigure(...)`). Add a new type by
registering one function there.

## Project layout

```
content/    what you write (posts, about, site config)
assets/     site code (css, js, images) copied straight into dist/
src/        the build (build.mjs, serve.mjs, layout.html, lib/)
dist/       build output (gitignored) — what nginx serves
```

## Deploy

`Dockerfile` + `docker-compose.yml` produce an nginx image serving `dist/` on
port 80. Link this repo to Coolify and configure the domain there.
````

- [ ] **Step 2: Add a final sanity test to `test/build.test.mjs`** (append)

```js
test('README documents the required workflow', async () => {
  const { readFile } = await import('node:fs/promises');
  const md = await readFile(join(root, 'README.md'), 'utf8');
  for (const needle of ['npm run dev', 'content/posts', 'data-figure', 'Dockerfile']) {
    assert.ok(md.includes(needle), `README should mention ${needle}`);
  }
});
```

- [ ] **Step 3: Run the entire suite**

Run: `npm test`
Expected: ALL tests PASS across `scaffold`, `frontmatter`, `posts`, `render`, `build`, `serve`, `docker` (docker may skip if unavailable). Fix anything that fails before committing.

- [ ] **Step 4: Final end-to-end manual check**

Run: `npm run build && npm run dev`, then click through: home → a post → about → a 404. Confirm the tensor background, theme toggle, reading progress, reveal, copy buttons, and the interactive figure all work; confirm both themes look correct on mobile width.

- [ ] **Step 5: Commit**

```bash
git add README.md test/build.test.mjs
git commit -m "docs: README + final integration sanity test"
```

---

## Task dependency map

| Task | Depends on | Front-end gate? |
|------|-----------|-----------------|
| 1 Scaffold | — | no |
| 2 Front-matter | 1 | no |
| 3 Posts | 2 | no |
| 4 Render | 1 | no |
| 5 Build | 2,3,4,1 | structural test only |
| 6 CSS | 5 | **manual browser checklist** |
| 7 main.js | 5 | **manual browser checklist** |
| 8 tensor.js | 5 | **manual browser checklist** |
| 9 figures.js | 5 | **manual browser checklist** |
| 10 serve | 5 | manual watch check |
| 11 Docker | 5 | docker build/run |
| 12 README + final | all | full manual pass |

Tasks 2, 3, 4 are independent of each other (all depend only on 1) and can be dispatched in any order. Tasks 6–9 are independent of each other (all depend only on 5) and can be done in any order.
