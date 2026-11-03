import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dockerOk = (() => {
  try { execFileSync('docker', ['info'], { stdio: 'ignore' }); return true; }
  catch { return false; }
})();

test('nginx logs page requests without queries, cookies, or forged client address',
  { skip: !dockerOk && 'docker unavailable', timeout: 240000 }, () => {
    const tag = `blog-logging-test-${Date.now()}`;
    execFileSync('docker', ['build', '-q', '-t', tag, root]);
    const id = execFileSync('docker', ['run', '-d', tag], { encoding: 'utf8' }).trim();
    try {
      for (let i = 0; i < 30; i++) {
        try {
          execFileSync('docker', ['exec', id, 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1/'], { stdio: 'ignore' });
          break;
        } catch {
          if (i === 29) throw new Error('nginx did not start');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
      }
      execFileSync('docker', ['exec', id, 'wget', '-q', '-O', '/dev/null',
        '--header', 'Cookie: private=value', '--header', 'Referer: https://example.test/path?secret=hidden',
        '--header', 'X-Forwarded-For: 203.0.113.9',
        'http://127.0.0.1/about.html?secret=hidden']);
      const log = execFileSync('docker', ['exec', id, 'cat', '/var/log/nginx/analytics/page.jsonl'], { encoding: 'utf8' });
      const records = log.trim().split('\n').map(JSON.parse);
      const about = records.find((record) => record.path === '/about.html');
      assert.equal(about.status, 200);
      assert.equal(about.referrer_host, 'example.test');
      assert.equal(about.client_address, '127.0.0.1');
      assert.doesNotMatch(log, /secret=hidden|private=value|203\.0\.113\.9/);
    } finally {
      execFileSync('docker', ['rm', '-f', id]);
      execFileSync('docker', ['rmi', '-f', tag]);
    }
  });
