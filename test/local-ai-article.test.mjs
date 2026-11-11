import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFrontmatter } from '../src/lib/frontmatter.mjs';
import { renderMarkdown } from '../src/lib/render.mjs';

const root = join(import.meta.dirname, '..');
const draftPath = join(root, 'content/posts/2026-11-local-ai-hybrid-workflow.md');

async function draft() {
  const { data, body } = parseFrontmatter(await readFile(draftPath, 'utf8'));
  return { data, body, html: renderMarkdown(body) };
}

test('local AI draft images resolve from the markdown file and from the published page', async () => {
  const { body } = await draft();
  const srcs = [...body.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length >= 4, `only ${srcs.length} images`);
  const { access } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  for (const src of new Set(srcs)) {
    await access(resolve(dirname(draftPath), src));
    const published = new URL(src, 'https://example.test/posts/local-ai.html').pathname;
    await access(join(root, published));
  }
});

test('local AI draft shows the four original slide images with captions', async () => {
  const { html, body } = await draft();
  for (const [kind, file] of [['timeline', 'slide-timeline.png'], ['stack', 'slide-stack.png'], ['sizes', 'slide-model-tiers.png'], ['workflow', 'slide-workflow.png']]) {
    const fig = html.match(new RegExp(`<figure class="diagram diagram--slide diagram--${kind}"[\\s\\S]*?</figure>`));
    assert.ok(fig, `missing ${kind} slide figure`);
    assert.match(fig[0], new RegExp(`class="slide-light"[^>]*src="[^"]*/${file.replace('.', '\\.')}"`));
    assert.match(fig[0], new RegExp(`class="slide-dark"[^>]*src="[^"]*/${file.replace('.png', '-dark\\.png')}"`));
    const alts = [...fig[0].matchAll(/alt="([^"]{80,})"/g)].map((m) => m[1]);
    assert.equal(alts.length, 2, `${kind}: both theme variants need the descriptive alt text`);
    assert.equal(alts[0], alts[1], `${kind}: theme variants describe the same slide`);
  }
  assert.equal((html.match(/<figcaption/g) || []).length, 4);
  assert.doesNotMatch(body, /dg-tl|754|not part of the experiment/);
});

test('local AI draft defines the trajectory score formally', async () => {
  const { html } = await draft();
  const blocks = html.match(/<math[^>]*display="block"[\s\S]*?<\/math>/g) || [];
  assert.ok(blocks.length >= 2, 'needs the weighted sum and the normalization');
  const math = blocks.join('');
  for (const sym of ['d', 'n', 'k']) assert.match(math, new RegExp(`<msub><mover accent="true"><mi>${sym}</mi><mo>\\^</mo></mover><mi>p</mi></msub>`));
  assert.match(math, /<msub><mi>P<\/mi><mn>95<\/mn><\/msub>/);
  assert.match(math, /<mfrac><mn>1<\/mn><mn>3<\/mn><\/mfrac>/);
  assert.match(html, /P<sub>95<\/sub> values? (are|is) 18[^.]*20[^.]*24\.4/);
  assert.match(html, /lowest possible score is (about )?0\.15/);
  assert.match(html, /highest score in this data is 1\.16/);
});

test('local AI draft opens with a reading time and a 3–5 bullet TL;DR', async () => {
  const { body } = await draft();
  const top = body.slice(0, body.indexOf('\n## '));
  assert.match(top, /\d+[-–]?\d*\s*min(ute)?s?\s+read/i);
  const { readingTime } = await import('../src/lib/posts.mjs');
  assert.match(top, new RegExp(`\\b${readingTime(body)} min read`), 'stated reading time must match the site estimate');
  const tldr = top.slice(top.search(/TL;DR/i));
  const bullets = tldr.split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l));
  assert.ok(bullets.length >= 3 && bullets.length <= 5, `${bullets.length} TL;DR bullets`);
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
