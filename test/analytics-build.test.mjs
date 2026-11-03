import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readAnalyticsConfig, renderAnalyticsTags } from '../src/lib/analytics-config.mjs';

const valid = { UMAMI_SCRIPT_URL: 'https://analytics.example.test/script.js',
  UMAMI_WEBSITE_ID: '123e4567-e89b-42d3-a456-426614174000' };
const root = join(import.meta.dirname, '..');
const build = (env) => new Promise((resolve, reject) => execFile('node', ['src/build.mjs'],
  { cwd: root, env: { ...process.env, UMAMI_SCRIPT_URL: '', UMAMI_WEBSITE_ID: '', ...env } },
  (error, stdout, stderr) => error ? reject(new Error(stderr)) : resolve(stdout)));

test('analytics is omitted without both public values', () => {
  assert.equal(readAnalyticsConfig({}), null);
  assert.equal(renderAnalyticsTags(null), '');
});

test('analytics validates URL and website ID', () => {
  assert.match(renderAnalyticsTags(readAnalyticsConfig(valid)), /data-website-id="123e4567/);
  for (const env of [
    { UMAMI_SCRIPT_URL: valid.UMAMI_SCRIPT_URL },
    { ...valid, UMAMI_SCRIPT_URL: 'http://analytics.example.test/script.js' },
    { ...valid, UMAMI_SCRIPT_URL: 'https://analytics.example.test/script.js?token=secret' },
    { ...valid, UMAMI_WEBSITE_ID: 'wrong' },
  ]) assert.throws(() => readAnalyticsConfig(env));
});

test('build emits tracking only when configured and preserves dist on invalid config', async () => {
  const fixture = join(root, 'content/posts/2026-11-03-analytics-fixture.md');
  await writeFile(fixture, '---\ntitle: Fixture\ndate: 2026-11-03\n---\nBody\n');
  try {
    await build({});
    assert.doesNotMatch(await readFile(join(root, 'dist/index.html'), 'utf8'), /data-website-id/);
    await build({ ...valid, APP_SECRET: 'secret-do-not-emit', DATABASE_URL: 'database-do-not-emit' });
    for (const path of ['index.html', 'about.html', 'demo.html', '404.html', 'posts/2026-11-03-analytics-fixture.html']) {
      const page = await readFile(join(root, 'dist', path), 'utf8');
      assert.equal((page.match(/data-website-id=/g) || []).length, 1, path);
      assert.doesNotMatch(page, /secret-do-not-emit|database-do-not-emit/);
    }
    await assert.rejects(build({ UMAMI_SCRIPT_URL: valid.UMAMI_SCRIPT_URL }));
    assert.match(await readFile(join(root, 'dist/index.html'), 'utf8'), /data-website-id/);
  } finally {
    await rm(fixture, { force: true });
    await build({});
  }
});
