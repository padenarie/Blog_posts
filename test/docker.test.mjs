import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  const id = await new Promise((res) => { let o = ''; c.stdout.on('data', d => o += d); c.on('close', () => res(o.trim())); });
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
}, { timeout: 240000 });
