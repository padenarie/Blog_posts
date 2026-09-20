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
