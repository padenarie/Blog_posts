import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../src/lib/frontmatter.mjs';

test('parses scalars, booleans, and inline lists', () => {
  const src = [
    '---',
    'title: "Hello, world"',
    'date: 2025-01-15',
    'description: First post',
    'tags: [meta, hello]',
    'hero: true',
    'cover: img/x.png',
    '---',
    '',
    'Body text here.',
  ].join('\n');
  const { data, body } = parseFrontmatter(src);
  assert.equal(data.title, 'Hello, world');
  assert.equal(data.date, '2025-01-15');
  assert.deepEqual(data.tags, ['meta', 'hello']);
  assert.equal(data.hero, true);
  assert.equal(data.cover, 'img/x.png');
  assert.equal(body.trim(), 'Body text here.');
});

test('boolean false is parsed as false', () => {
  const { data } = parseFrontmatter('---\nhero: false\n---\nbody');
  assert.equal(data.hero, false);
});

test('no front-matter returns empty data and full body', () => {
  const { data, body } = parseFrontmatter('Just a plain post.\n\nMore.');
  assert.deepEqual(data, {});
  assert.equal(body, 'Just a plain post.\n\nMore.');
});
