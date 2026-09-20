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
