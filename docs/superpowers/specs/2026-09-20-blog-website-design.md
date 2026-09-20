# Personal Blog Website — Design

**Date:** 2026-09-20
**Status:** Approved for implementation planning
**Branch:** `feature/blog-website`

## 1. Purpose & goals

A personal, single-author blog website where the owner writes and shares
blog posts. It must be easy to add posts, easy to read, and serve as a
**personal brand / portfolio piece** that signals the owner's background in
**control engineering and tensor algebra**.

### Success criteria
- Adding a new post is a single-file operation (drop a Markdown file, rebuild).
- Posts are easy to read (vertical scrolling, constrained reading column).
- The site has a distinctive, "flashy but tasteful" identity anchored by an
  interactive **3D tensor** background.
- The architecture and code are **lean**: file-based content, no server, no
  database, no frontend framework, minimal dependencies.
- Deployable to the owner's **Hetzner** server via **Coolify** using a
  Docker Compose setup.

### Key constraints
- Content is owned by the owner as **files in this repo** (version-controlled,
  portable). No CMS, no in-browser authoring, no backend.
- "Lean" applies to **architecture and code**, not to **presentation**. The
  visual layer may be rich.
- JavaScript is vanilla (ES modules) — no framework.
- Accessibility: respect `prefers-reduced-motion`, meet AA contrast, provide
  keyboard/focus support.

## 2. Decisions made (record of brainstorming)

| Decision | Choice |
|----------|--------|
| Content source | Files in the repo (Markdown) |
| Authoring | File-based; no in-website editing |
| Writing format | Markdown primary, with an HTML/JS escape hatch for interactive figures |
| Figures | Mix: static images (common) + some interactive/live figures |
| Features (first cut) | Basics + reading-time/progress + dark mode. **Not** search, tags-as-filter, comments, RSS |
| Effects | Dark mode, reading-progress bar, scroll-reveal, smooth scrolling, copy buttons on code blocks |
| Signature visual | Three.js full-3D tensor field reacting to the mouse like a control system (damped wobble / resonance) |
| Aesthetic | Dark base, single cyan accent (+ rare warm secondary), monospace signature details, faint coordinate-grid texture |
| Build approach | Custom minimal Node build (Approach 1) — no SSG framework |
| Deployment | Hetzner via Coolify, Docker Compose (multi-stage Dockerfile + nginx) |

## 3. Directory structure

```
Blog_posts/
├── content/
│   ├── posts/                  # one .md file per post
│   │   └── 2025-01-15-intro-to-tensors.md
│   ├── about.md                # the "about me" content
│   └── site.json               # site config (title, tagline, author, socials, accent, tensor settings)
├── assets/                     # shared web assets → copied to dist as-is
│   ├── css/main.css
│   ├── js/main.js              # effects (always loaded)
│   ├── js/tensor.js            # Three.js background (only on hero pages)
│   ├── js/figures.js           # initializes in-post interactive figures
│   ├── js/vendor/three.module.js   # vendored Three.js (no CDN at runtime)
│   └── img/                    # static figures/images referenced by posts
├── src/                        # build tooling (NOT shipped to the site)
│   ├── build.mjs               # the build entry point
│   ├── serve.mjs               # tiny local dev server
│   ├── layout.html             # shared <head>/nav/footer template
│   └── lib/                    # frontmatter.mjs, render.mjs, posts.mjs
├── dist/                       # BUILD OUTPUT (gitignored) — what nginx serves
├── package.json
├── Dockerfile
├── docker-compose.yml
├── nginx.conf                  # custom nginx config for the serve stage
└── README.md
```

**Rationale:** content (what the owner writes) is separated from assets (the
site's code/styles) and `src/` (the build machinery). Adding a post is a
single file in `content/posts/`. `dist/` is disposable build output.

## 4. Build flow (`src/build.mjs`)

1. Load `content/site.json` → site config.
2. Scan `content/posts/*.md`:
   - Parse YAML front-matter with a small custom parser (no extra dependency).
   - Render the Markdown body with **`markdown-it`** (HTML enabled so the
     figure escape hatch works).
   - Compute reading time from word count and inject it as meta.
3. Build a post list sorted by date, descending.
4. For each post → fill the post template (wrapped in `layout.html`) →
   `dist/posts/<slug>.html`.
5. Build the home page (hero + about excerpt + post list) → `dist/index.html`.
6. Build `dist/about.html` from `content/about.md`.
7. Copy `assets/` → `dist/assets/`.
8. Emit `dist/404.html`.

**Dependencies:** the only real runtime dependency is `markdown-it`.
Front-matter is parsed by a ~20-line helper supporting the constrained schema
(title, date, description, tags, `hero`, `cover`). If front-matter needs to
grow more complex, swap in `js-yaml`.

`build.mjs` performs a **one-shot** build only. Watching and local serving are
handled by `serve.mjs` (see Section 8).

**Slug rule:** derived from the filename (without extension). A file named
`2025-01-15-intro-to-tensors.md` produces `dist/posts/2025-01-15-intro-to-tensors.html`.

## 5. Content model

Post front-matter (YAML between `---` delimiters):

```yaml
---
title: "Intro to Tensors"
date: 2025-01-15
description: "What a tensor actually is, without the hand-waving."
tags: [linear-algebra, tensors]
hero: true              # show the 3D tensor hero on this post page
cover: img/tensors.png  # optional static cover image
---
```

Body is standard Markdown.

- **Static figure:** a normal Markdown image reference, e.g.
  `![A static figure](img/tensors.png)`.
- **Interactive figure:** declare a `<div>` with a `data-figure` type and an
  optional `data-config` JSON string:

  ```html
  <div class="fig" data-figure="tensor-wave" data-config='{"freq":0.6}'></div>
  ```

  `figures.js` keeps a small registry mapping a figure type to an initializer
  function. At first we ship a couple of Three.js-based figure types (kept
  consistent with the background, no extra heavy library). Adding a new figure
  type later is one function added to the registry; post bodies stay clean.

## 6. Client-side JavaScript

All vanilla ES modules, no framework. Loaded with `<script type="module">`
(non-blocking by default).

- **`main.js`** (loaded on every page):
  - Dark mode: auto-detect `prefers-color-scheme`, manual toggle, persist the
    choice to `localStorage`, apply via `data-theme` on `<html>`.
  - Reading-progress bar: a thin top bar whose width tracks scroll position
    (post pages only, detected via a `data-page` attribute).
  - Scroll-reveal: `IntersectionObserver` adds a `.revealed` class to
    `.reveal` elements (headings, figures, cards). Skipped when
    `prefers-reduced-motion` is set.
  - Copy buttons: added to code blocks, using `navigator.clipboard`.
  - Smooth scrolling for in-page anchors is handled primarily in CSS
    (`scroll-behavior: smooth`), with a small JS offset if the sticky header
    requires it.

- **`tensor.js`** (loaded only where `hero: true` or on the home page):
  - Builds the 3D tensor field (a lattice of nodes) and animates it with
    spring/damped motion that responds to the mouse (the cursor acts as an
    input signal; the field responds with a damped wobble / resonance).
  - `prefers-reduced-motion`: render a static or very gentle frame.
  - Mobile: reduced node count, capped device-pixel-ratio, throttled updates.
  - Pauses when the tab is hidden (`visibilitychange`) and when scrolled
    off-screen (`IntersectionObserver`) to save battery.
  - Three.js is **vendored locally** (installed via npm, copied into
    `dist/assets/js/vendor/`) so there is no CDN dependency at runtime; the
    site works offline and is privacy-friendly.

- **`figures.js`** (loaded on post pages): the figure registry + initializer
  that scans for `[data-figure]` elements and initializes them.

**Loading strategy:** `main.js` always; `tensor.js` + Three.js only on hero
pages; `figures.js` on post pages.

## 7. Styling system

- **One hand-written `assets/css/main.css`** (no CSS framework).
- **Design tokens** as CSS custom properties, with a **dark theme (default)**
  and a **light alternate** via `data-theme`:
  - Colors: `--bg`, `--bg-elevated`, `--text`, `--text-muted`, `--accent`
    (cyan), `--accent-warm` (magenta/amber, used rarely), `--border`,
    `--grid-line`.
  - Scales for spacing, type size, and border radius; a reading-column
    max-width of ~68ch.
- **Layout:**
  - A constrained, centered **reading column** for text (readability first).
  - The **tensor canvas** is a fixed, full-viewport, dimmed background behind
    everything; content sits above it at a higher z-index with a subtle
    backdrop for contrast.
  - A sticky minimal header (site name + nav: Home / About) and a footer on
    every page.
  - **Home page:** hero (tensor background + tagline + intro) → about-me
    section → post list (cards showing title, date, reading time, description,
    tags).
  - **Post page:** hero (tensor if `hero: true`, else a clean title block) →
    title + meta (date, reading time, tags) → article body → prev/next post
    navigation.
- **Technical motifs:**
  - A faint coordinate-grid background using pure CSS gradients.
  - Monospace for navigation, section labels/eyebrows, meta (dates, tags), and
    code. Large headings remain in the sans-serif for readability, with mono
    accents. (Owner may opt for fully monospace headings later.)
  - The cyan accent is used sparingly: links, hover states, the tensor glow,
    and the reading-progress bar.
- **Typography:** system font stacks for both the sans and the mono (no
  web-font download → fast and lean). A specific self-hosted font can be
  swapped in later.
- **Accessibility:** semantic HTML, AA contrast in both themes,
  `prefers-reduced-motion` handling, visible focus styles, a skip-to-content
  link, and alt text on figures. Mobile-first responsive layout.

## 8. Deployment (Hetzner + Coolify)

- **`package.json`** — `"type": "module"`, scripts:
  - `build`: `node src/build.mjs` (one-shot build → `dist/`)
  - `dev`: `node src/serve.mjs --watch` (serve `dist/` and rebuild on change)
  - Dependencies: `markdown-it`, `three`.
- **`Dockerfile`** (multi-stage):
  - *build stage:* `node:20-alpine` → copy manifests → `npm ci` → copy
    `content/`, `src/`, `assets/`, `package.json` → `npm run build` → produces
    `dist/`.
  - *serve stage:* `nginx:alpine` → copy `dist/` to
    `/usr/share/nginx/html` → copy custom `nginx.conf` (gzip, asset caching,
    correct MIME types) → expose port 80.
- **`docker-compose.yml`** — a single `blog` service that builds from the
  Dockerfile. Coolify consumes the repo, builds the image, maps the owner's
  domain, and provisions HTTPS/TLS automatically via its reverse proxy.
- **Workflow:** write a post → commit → push → Coolify auto-redeploys → live.
- **Local development:** `npm run dev` runs `src/serve.mjs --watch`: it serves
  `dist/` on a local port (Node built-in `http`, no extra dependency) and
  rebuilds (by calling the same build logic as `build.mjs`) whenever
  `content/` or `assets/` change, using Node's built-in `fs.watch` (no watcher
  library).
- **Housekeeping:** update `.gitignore` (currently a Python-oriented file) to
  ignore `node_modules/` and `dist/`.

## 9. Testing

A small **`node:test`** suite (Node's built-in test runner, no framework)
covering the build helpers: front-matter parsing, slug generation, and
post-list ordering. All other verification (visual, interaction, accessibility)
is manual. No heavy test infrastructure.

## 10. Out of scope (deliberate, addable later)

- Search
- Tags as a filter/navigation feature
- Comments
- RSS feed
- Internationalization (i18n)
- Per-post asset folders (a post's own subdirectory of images)
- A custom self-hosted web font
- Plotly-based interactive figure types

These are intentionally excluded from the first cut. Each is designed to be
added later without restructuring the core.

## 11. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Three.js background hurts performance / battery on mobile | Reduced node count, capped DPR, throttled updates, pause when hidden/off-screen; reduced-motion fallback |
| Background reduces text readability | Background is dimmed and behind a higher z-index reading column with a subtle backdrop; contrast checked in both themes |
| Interactive figure JS adds weight | Loaded only on pages that use it; figure registry centralizes and lazy-inits |
| Vendored Three.js size | Loaded only on hero pages; single minified module; no CDN round-trips |
| Custom front-matter parser edge cases | Constrained schema; swap to `js-yaml` if complexity grows |
| Coolify/TLS specifics unknown | Keep compose minimal; Coolify handles proxy + TLS; verify during deployment |
