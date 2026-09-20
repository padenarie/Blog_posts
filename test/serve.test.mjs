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
