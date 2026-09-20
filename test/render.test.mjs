import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/lib/render.mjs';

test('renders headings and emphasis', () => {
  const html = renderMarkdown('## Title\n\nSome **bold** text.');
  assert.ok(html.includes('<h2'));
  assert.ok(html.includes('<strong>bold</strong>'));
});

test('preserves raw inline HTML (figure escape hatch)', () => {
  const src = '<div class="fig" data-figure="tensor-wave" data-config=\'{"freq":1}\'></div>';
  const html = renderMarkdown(src);
  assert.ok(html.includes('data-figure="tensor-wave"'));
});

test('renders markdown images as <img>', () => {
  const html = renderMarkdown('![alt text](img/x.png)');
  assert.ok(html.includes('<img'));
  assert.ok(html.includes('img/x.png'));
  assert.ok(html.includes('alt="alt text"'));
});
