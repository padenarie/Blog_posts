import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/js/analytics.js', import.meta.url), 'utf8');

test('depth reached is emitted once per milestone and work links remain normal', () => {
  const events = [];
  const listeners = {};
  const documentListeners = {};
  let top = 600;
  const body = { getBoundingClientRect: () => ({ top, height: 400 }),
    querySelectorAll: () => [] };
  const post = { dataset: { analyticsArticlePath: '/posts/example.html' },
    querySelector: () => body };
  const document = { querySelector: () => post,
    addEventListener: (name, fn) => { documentListeners[name] = fn; } };
  const window = { umami: { track: (...args) => events.push(args) } };
  vm.runInNewContext(source, { document, window, innerHeight: 500,
    addEventListener: (name, fn) => { listeners[name] = fn; }, URL, Set });
  for (top of [400, 300, 200, 100, 100]) listeners.scroll();
  assert.deepEqual(events.filter(([name]) => name === 'article_depth_reached').map(([, data]) => data.milestone), [25, 50, 75, 90]);
  const link = { dataset: { analyticsWork: 'cocktail-party-problem', analyticsAction: 'open-hugging-face' },
    href: 'https://huggingface.co/spaces/example?secret=discarded' };
  documentListeners.click({ target: { closest: () => link } });
  assert.equal(events.at(-1)[1].destination_host, 'huggingface.co');
  assert.ok(!JSON.stringify(events).includes('secret=discarded'));
  window.umami = undefined;
  assert.doesNotThrow(() => documentListeners.click({ target: { closest: () => link } }));
});
