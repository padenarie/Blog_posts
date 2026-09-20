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

test('main.css defines the design tokens', async () => {
  await run('node', ['src/build.mjs']);
  const css = await readFile(join(root, 'dist/assets/css/main.css'), 'utf8');
  assert.ok(css.includes('--accent'));
  assert.ok(css.includes('[data-theme="light"]'));
  assert.ok(css.includes('.tensor-bg'));
  assert.ok(css.includes('prefers-reduced-motion'));
});

test('main.js implements the expected effects hooks', async () => {
  await run('node', ['src/build.mjs']);
  const js = await readFile(join(root, 'dist/assets/js/main.js'), 'utf8');
  for (const needle of ['theme-toggle', 'reading-progress', 'reveal', 'copy-btn', 'prefers-reduced-motion']) {
    assert.ok(js.includes(needle), `main.js should reference ${needle}`);
  }
});

test('tensor.js is a three.js module with the expected guardrails', async () => {
  await run('node', ['src/build.mjs']);
  const js = await readFile(join(root, 'dist/assets/js/tensor.js'), 'utf8');
  assert.ok(js.includes("vendor/three.module.js"));
  assert.ok(js.includes('prefers-reduced-motion'));
  assert.ok(js.includes('visibilitychange'));
  assert.ok(js.includes('IntersectionObserver'));
});

test('figures.js exposes a registry and ships tensor-wave', async () => {
  await run('node', ['src/build.mjs']);
  const js = await readFile(join(root, 'dist/assets/js/figures.js'), 'utf8');
  assert.ok(js.includes('registerFigure'));
  assert.ok(js.includes('tensor-wave'));
  assert.ok(js.includes('data-figure'));
});

test('README documents the required workflow', async () => {
  const { readFile } = await import('node:fs/promises');
  const md = await readFile(join(root, 'README.md'), 'utf8');
  for (const needle of ['npm run dev', 'content/posts', 'data-figure', 'Dockerfile']) {
    assert.ok(md.includes(needle), `README should mention ${needle}`);
  }
});
