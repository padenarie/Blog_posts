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
