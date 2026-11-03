# Personal Blog Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the existing static blog a stronger tensor editorial home page, feature the public ICA demo on a dedicated embedded page, and replace placeholder personal copy with accurate About content.

**Architecture:** Keep `content/` as the source of truth. `src/build.mjs` renders semantic static HTML using the existing layout; `assets/css/main.css` and `assets/js/tensor.js` handle presentation. Docker and nginx continue serving generated `dist/` files without a runtime API.

**Tech Stack:** Node 20+, ES modules, `markdown-it`, Three.js, native `node:test`, CSS.

**Spec:** [2026-11-03-blog-refresh-design.md](../specs/2026-11-03-blog-refresh-design.md)

## Global Constraints

- Keep the dark base, cyan accent, monospace details, coordinate grid, and interactive tensor.
- Keep prose around 65–72 characters wide; allow a wider presentation canvas on the home page.
- Preserve dark and light themes, visible focus, sufficient contrast, and reduced-motion behavior.
- Keep the blog static: no frontend framework, CMS, runtime API, database, or new blog service.
- Publish no Token Economy article or numerical claims in this change.
- On the ICA card and demo page, state that the external demo may take a moment to start. Load the iframe only after a visitor clicks Launch; run no Gradio backend on Hetzner.

---

## File map

| File | Responsibility |
| --- | --- |
| `content/site.json` | Site identity, hero/preview copy, featured ICA work and embed metadata |
| `content/about.md` | Personal About narrative and LinkedIn link |
| `content/drafts/2025-01-15-hello-world.md` | Preserve the sample post outside the published post directory |
| `content/posts/.gitkeep` | Keep the empty posts directory present for the existing build and tests |
| `src/build.mjs` | Validate required site copy, render home/feature/writing/About/demo HTML, and let light-theme CSS override the accent |
| `assets/js/demo.js` | Insert the Hugging Face iframe only after Launch is activated |
| `assets/css/main.css` | Wider home layout, featured work card, reading column, responsive styling and contrast |
| `assets/js/tensor.js` | Adjust tensor placement and color to complement home text |
| `test/build.test.mjs` | Verify generated pages, ICA links and deferred iframe, sample exclusion, and missing-content failure |
| `test/scaffold.test.mjs` | Align scaffold expectations with the archived sample and new site schema |

## Task 1: Publish real site identity and featured work

**Files:** Modify `content/site.json`, `content/about.md`, `src/build.mjs`, `test/build.test.mjs`, `test/scaffold.test.mjs`; move `content/posts/2025-01-15-hello-world.md` to `content/drafts/2025-01-15-hello-world.md`; create `content/posts/.gitkeep`.

**Interfaces:** `site.featuredWork` is `{ title: string, description: string, url: string, embedUrl: string, note: string }`. `site.aboutPreview` is a string. `src/build.mjs` consumes those fields and produces a `featured-work` section in `dist/index.html` plus `dist/demo.html`. Existing `loadPosts(postsDir)` continues to read only `.md` files in `content/posts/`.

- [ ] **Step 1: Write a failing generated-page test.** In `test/build.test.mjs`, replace the sample-post expectation in the first test with these assertions after reading the generated home page:

```js
assert.match(home, /Pierre-Antoine Denarié/);
assert.match(home, /Making complex systems tangible/);
assert.match(home, /class="featured-work/);
assert.match(home, /https:\/\/huggingface\.co\/spaces\/Padenarie\/The_Cocktail_Party_Problem/);
assert.match(home, /href="\/demo\.html"/);
assert.match(home, /may take a moment to start/i);
assert.doesNotMatch(home, /Hello, world/);
const demo = await readFile(join(root, 'dist/demo.html'), 'utf8');
assert.match(demo, /Launch interactive demo/);
assert.match(demo, /padenarie-the-cocktail-party-problem\.hf\.space/);
assert.match(demo, /Open on Hugging Face/);
assert.doesNotMatch(demo, /<iframe[^>]+src=/);
const about = await readFile(join(root, 'dist/about.html'), 'utf8');
assert.match(about, /Systems and Control/);
assert.match(about, /AI Consultant/);
assert.match(about, /linkedin\.com\/in\/pierre-antoine-denari/);
```

  Also change the `expect` list to include `dist/demo.html`, omit `dist/posts/2025-01-15-hello-world.html`, and assert that the sample file does **not** exist using `assert.rejects(access(...))`. Keep the existing special-character escaping test. Change the zero-post test's expected empty-state text to `Writing is on its way.` Add a validation regression test:

```js
test('invalid featured work URL fails before replacing the built site', async () => {
  const { writeFile } = await import('node:fs/promises');
  const configPath = join(root, 'content/site.json');
  const original = await readFile(configPath, 'utf8');
  const site = JSON.parse(original);
  site.featuredWork = {
    title: 'Demo', description: 'Interactive work',
    url: 'http://example.test/demo',
    embedUrl: 'https://padenarie-the-cocktail-party-problem.hf.space/',
    note: 'May take a moment to start.',
  };
  await writeFile(configPath, JSON.stringify(site));
  try {
    await assert.rejects(run('node', ['src/build.mjs']), /site\.featuredWork\.url must use HTTPS/);
    await access(join(root, 'dist/index.html'));
  } finally {
    await writeFile(configPath, original);
  }
});
```

- [ ] **Step 2: Run the focused test and confirm it fails.** Run `node --test test/build.test.mjs`. Expect the new home/feature/About assertions to fail against the placeholder site.

- [ ] **Step 3: Replace placeholder data and copy.** Set `content/site.json` to the following shape. Replace `content/about.md` with the Markdown below; it uses the verified current role and degree, describes the ICA demo, and mentions karate briefly. It does not repeat the outdated SAP-focused LinkedIn About summary as the current job description.

```json
{
  "name": "Pierre-Antoine Denarié",
  "tagline": "Making complex systems tangible.",
  "intro": "I’m an AI consultant with a background in Systems and Control. I explore practical AI, local models, and the mathematical ideas behind useful tools.",
  "aboutPreview": "From control engineering and tensor methods to building practical AI tools, I like turning complex ideas into things people can use.",
  "footer": "© 2026 Pierre-Antoine Denarié",
  "accent": "#22d3ee",
  "featuredWork": {
    "title": "The Cocktail Party Problem",
    "description": "Explore how independent component analysis separates mixed audio signals, using an interactive demo built from my tensor-based blind source separation work.",
    "url": "https://huggingface.co/spaces/Padenarie/The_Cocktail_Party_Problem",
    "embedUrl": "https://padenarie-the-cocktail-party-problem.hf.space/",
    "note": "The demo may take a moment to start."
  }
}
```

```markdown
I’m Pierre-Antoine Denarié, an AI consultant with a background in Systems and Control. I like making difficult ideas concrete: something you can test, see, or use.

I graduated cum laude from TU Delft with a master’s degree in Systems and Control. That work drew me toward tensors, optimization, and the behavior of complex systems. My thesis explored independent component analysis through implicit cumulant tensor decomposition. I later turned those ideas into [The Cocktail Party Problem](https://huggingface.co/spaces/Padenarie/The_Cocktail_Party_Problem), an interactive way to hear how mixed signals can be separated.

At Deloitte, I’ve worked on practical data tooling and now work as an AI Consultant. Outside my day job, I’m exploring local AI tools and what their capabilities, costs, and tradeoffs look like in everyday use. I write here to share the experiments and the reasoning behind them.

Karate has been part of my life since childhood. It taught me patience with hard problems and the value of sustained practice.

You can find my professional background on [LinkedIn](https://www.linkedin.com/in/pierre-antoine-denari%C3%A9/).
```

  Move the sample post to `content/drafts/` and create `content/posts/.gitkeep`. Do not change `loadPosts()` because it already ignores non-`.md` files.

- [ ] **Step 4: Add exact site-data validation and render the new home sections.** In `src/build.mjs`, validate `name`, `tagline`, `intro`, `aboutPreview`, `footer`, `accent`, and each `featuredWork` string before deleting `dist/`. Parse `featuredWork.url` and `featuredWork.embedUrl` with `new URL(...)` and require `https:`; require the embed hostname to be `hf.space` or end in `.hf.space`. Use the existing `escapeHtml()` for every content string placed into HTML text or attributes. Replace `homeContent` with semantic `hero`, `featured-work`, `posts`, and `about-preview` sections. The hero's first link points to `#work`; the second points to `/about.html`. The primary featured link goes to `/demo.html`; add a direct Hugging Face fallback link using `work.url`. Render `Writing is on its way.` when there are no posts. Keep the existing post-card mapping for real posts. Start with this validation and feature fragment:

```js
for (const key of ['name', 'tagline', 'intro', 'aboutPreview', 'footer', 'accent']) {
  if (typeof site[key] !== 'string' || !site[key].trim()) {
    throw new Error(`site.${key} must be a non-empty string`);
  }
}
if (!/^#[0-9a-fA-F]{6}$/.test(site.accent)) {
  throw new Error('site.accent must be a six-digit hex color');
}
for (const key of ['title', 'description', 'url', 'embedUrl', 'note']) {
  if (typeof site.featuredWork?.[key] !== 'string' || !site.featuredWork[key].trim()) {
    throw new Error(`site.featuredWork.${key} must be a non-empty string`);
  }
}
let workUrl;
try { workUrl = new URL(site.featuredWork.url); }
catch { throw new Error('site.featuredWork.url must be a valid HTTPS URL'); }
if (workUrl.protocol !== 'https:') {
  throw new Error('site.featuredWork.url must use HTTPS');
}
let embedUrl;
try { embedUrl = new URL(site.featuredWork.embedUrl); }
catch { throw new Error('site.featuredWork.embedUrl must be a valid HTTPS URL'); }
if (embedUrl.protocol !== 'https:' || !embedUrl.hostname.endsWith('.hf.space')) {
  throw new Error('site.featuredWork.embedUrl must use HTTPS on an hf.space subdomain');
}
const work = site.featuredWork;
const featured = `<section class="section featured-work" id="work">
  <p class="eyebrow">Featured work</p>
  <h2>${escapeHtml(work.title)}</h2>
  <p>${escapeHtml(work.description)}</p>
  <p class="muted">${escapeHtml(work.note)}</p>
  <a class="work-link" href="/demo.html">Try the demo <span aria-hidden="true">↗</span></a>
  <a href="${escapeHtml(work.url)}">Open on Hugging Face</a>
</section>`;
```

  Render the About preview from `site.aboutPreview` and add a text link to `/about.html`. Also render `dist/demo.html` with an intro, startup note, Launch button, empty frame container carrying the escaped `embedUrl` as data, and direct `work.url` fallback link. Add `/assets/js/demo.js` only to that page. `demo.js` creates a titled iframe with its `src` set from the validated data attribute when Launch is clicked; it must not construct an iframe before the click. Give the frame a responsive, generous height and an obvious focus state. Do not interpolate raw Markdown into attributes.

- [ ] **Step 5: Align scaffold tests with the new schema.** In `test/scaffold.test.mjs`, replace the sample-post path in `mustExist` with `content/drafts/2025-01-15-hello-world.md` and `content/posts/.gitkeep`. Extend the site schema assertion to require non-empty `aboutPreview` and each `featuredWork` string, assert both URLs use HTTPS, and assert `embedUrl` is on an `hf.space` subdomain.

- [ ] **Step 6: Run tests and build.** Run `node --test test/build.test.mjs test/scaffold.test.mjs`, then `npm test` and `npm run build`. Expect all tests to pass, a generated home page with the ICA card and empty writing state, a click-to-load demo page, and an About page with no placeholder identity.

- [ ] **Step 7: Commit the content and rendering work.** Run `git add content src/build.mjs assets/js/demo.js test/build.test.mjs test/scaffold.test.mjs && git commit -m "feat: add personal blog identity and ICA demo"`.

## Task 2: Apply the tensor editorial visual system

**Files:** Modify `assets/css/main.css`, `assets/js/tensor.js`, `src/build.mjs`; update `test/build.test.mjs` only if a concrete generated markup regression is found.

**Interfaces:** Consumes Task 1's `.hero`, `.featured-work`, `.posts`, `.about-preview`, `.work-link`, and existing `.prose` selectors. Produces responsive styling and keeps `#tensor-bg` and `prefers-reduced-motion` behavior intact.

- [ ] **Step 1: Establish a visual baseline.** Copy the archived sample temporarily with `cp content/drafts/2025-01-15-hello-world.md content/posts/2025-01-15-hello-world.md`, run `npm run dev`, then inspect the generated home, About, demo, and sample article at approximately 390px and 1440px widths. Note any overlap, contrast, or focus problems before changing styles. The development server runs on `http://localhost:4173` by default. Keep the temporary copy only for the visual checks in this task.

- [ ] **Step 2: Style the editorial home layout.** In `assets/css/main.css`, retain existing tokens but add a home-only presentation width and constrain text separately. Use the existing `body[data-page="home"]` attribute from `src/layout.html`. The key rules should have this shape:

```css
body[data-page="home"] main { max-width: 1160px; }
body[data-page="home"] .hero { min-height: min(74vh, 760px); max-width: 76ch; }
.hero-title { font-size: clamp(2.5rem, 7vw, 6rem); line-height: 1.02; letter-spacing: -0.045em; }
.hero-sub, .about-preview .prose { max-width: 70ch; }
.featured-work { max-width: 960px; padding: clamp(24px, 5vw, 56px); border: 1px solid var(--border); background: var(--bg-elevated); }
.featured-work h2 { font-size: clamp(1.7rem, 4vw, 3rem); line-height: 1.12; }
.post-body, body[data-page="about"] .prose { max-width: 70ch; }
.work-link { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; border-bottom: 1px solid var(--accent); }
.work-link:hover { gap: 14px; text-decoration: none; }
body[data-page="demo"] main { max-width: 1160px; }
.demo-frame { display: block; width: 100%; min-height: 850px; border: 1px solid var(--border); border-radius: var(--radius); }
[data-theme="light"] { --accent: #087c92; }
@media (max-width: 719px) {
  body[data-page="home"] .hero { min-height: 58vh; }
  .featured-work { padding: 24px; }
}
```

  The existing `:focus-visible` rule provides the keyboard focus outline; confirm it remains unobscured. Keep the dark-theme cyan `#22d3ee`. The inline accent override in `src/build.mjs` currently forces `site.accent` onto the light theme too; replace its selector with `:root:not([data-theme="light"])` so the darker CSS token above takes effect in light mode.

- [ ] **Step 3: Rebalance the tensor.** In `assets/js/tensor.js`, make the mobile cluster cyan (`0x22d3ee`). Set the three desktop cluster anchors and colors to the following values, retaining their current motion parameters and sizes. Keep all existing guards: reduced-motion static frame, mobile node reduction, capped pixel ratio, visibility pause, and intersection pause.

```js
const LAYOUT = isMobile
  ? [{ ndc: [0.42, 0.18], n: 7, color: 0x22d3ee,
       spinAxis: [0.3, 1, 0.2], spinSpeed: 0.10,
       waveFreq: 0.7, waveAmp: 0.20, waveSpeed: 1.8 }]
  : [
      { ndc: [0.56, 0.28], n: 6, color: 0x22d3ee,
        spinAxis: [0, 1, 0], spinSpeed: 0.15,
        waveFreq: 0.8, waveAmp: 0.18, waveSpeed: 2.0 },
      { ndc: [0.76, -0.22], n: 7, color: 0xf472b6,
        spinAxis: [1, 0, 0], spinSpeed: -0.11,
        waveFreq: 1.1, waveAmp: 0.15, waveSpeed: 1.6 },
      { ndc: [0.30, -0.54], n: 4, color: 0x22d3ee,
        spinAxis: [0.4, 0.8, 0.3], spinSpeed: 0.18,
        waveFreq: 0.6, waveAmp: 0.22, waveSpeed: 2.4 },
    ];
```

- [ ] **Step 4: Verify visual and interaction behavior.** With `npm run dev` running and the temporary sample copy present, inspect home, About, demo, and the sample article at narrow and wide widths in dark and light themes. Use keyboard-only navigation to check the hero and ICA links, demo Launch button, About link, theme toggle, and post link. Enable reduced motion and confirm the tensor stops animating. Check that the tensor never covers text. Confirm the iframe is absent before Launch, loads from `hf.space` after Launch, and the direct Hugging Face fallback works. Check the embed on the actual deployed blog origin; inspect network requests to verify that Gradio API calls go to Hugging Face rather than Hetzner. Adjust CSS or cluster coordinates until these checks pass. Remove only the temporary copy from `content/posts/` with `rm content/posts/2025-01-15-hello-world.md` when finished; the archived original remains in `content/drafts/`.

- [ ] **Step 5: Run the suite and production build.** Run `npm test` and `npm run build`. Expect passing tests and no console errors on generated pages. Confirm the sample post is absent from `dist/posts/`.

- [ ] **Step 6: Commit the visual work.** Run `git add assets/css/main.css assets/js/tensor.js src/build.mjs && git commit -m "style: refresh blog with tensor editorial layout"`.

## Environment note

At plan-writing time, the current shell could not invoke `git` or `node`: Apple developer tools were missing and Node was not on `PATH`. Before executing the plan, make those commands available in the execution environment. Do not treat unrun tests or commits as completed steps.
