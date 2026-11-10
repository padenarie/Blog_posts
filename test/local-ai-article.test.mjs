import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '../src/lib/frontmatter.mjs';
import { renderMarkdown } from '../src/lib/render.mjs';

const root = join(import.meta.dirname, '..');
const draftPath = join(root, 'content/drafts/2026-11-local-ai-hybrid-workflow.md');

async function draft() {
  const { data, body } = parseFrontmatter(await readFile(draftPath, 'utf8'));
  return { data, body, html: renderMarkdown(body) };
}

test('local AI draft has the four redrawn diagrams with captions', async () => {
  const { html } = await draft();
  for (const kind of ['timeline', 'stack', 'sizes', 'workflow']) {
    assert.match(html, new RegExp(`<figure class="diagram diagram--${kind}"`), `missing ${kind} diagram`);
  }
  assert.equal((html.match(/<figcaption/g) || []).length, 4);
});

test('local AI draft embeds the explorer and the orchestrator download', async () => {
  const { html } = await draft();
  assert.match(html, /data-figure="local-ai-explorer"/);
  assert.match(html, /href="\/assets\/downloads\/pi-harness-spec-orchestrator-v9\.zip"/);
});

test('local AI draft body is complete prose of the planned length', async () => {
  const { body } = await draft();
  const prose = body.replace(/<[^>]+>/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean).length;
  assert.ok(words >= 1800 && words <= 2600, `word count ${words}`);
  assert.doesNotMatch(body, /TODO|TBD|lorem/i);
  for (const section of body.split(/^## /m).slice(1)) {
    const [heading, ...rest] = section.split('\n');
    assert.ok(rest.join('\n').replace(/<[^>]+>/g, '').trim().length > 200, `section "${heading}" is empty`);
  }
});
