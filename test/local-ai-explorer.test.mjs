import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  dailySeries, sizeBinSeries, coverageText,
  callPoints, logRange, callTooltipLines, callCoverageText, PANELS, CALL_DEPLOYMENTS,
} from '../assets/js/local-ai-explorer/model.js';

const PR = (o) => ({ period: 'hybrid', route: 'local', input_tokens: 10, agent_depth: 2,
  prompt_position: 3, tool_calls: 4, subagent_runs: 1, score: 3.5, ...o });

test('dailySeries fills missing days with zero and orders deployments', () => {
  const r = dailySeries([
    { day: '2026-07-11', deployment: 'cloud', calls: 2 },
    { day: '2026-07-09', deployment: 'local', calls: 5 },
  ]);
  assert.deepEqual(r.days, ['2026-07-09', '2026-07-10', '2026-07-11']);
  assert.deepEqual(r.series, [
    { name: 'local', data: [5, 0, 0] },
    { name: 'cloud', data: [0, 0, 2] },
  ]);
  assert.deepEqual(dailySeries([]), { days: [], series: [] });
});

test('sizeBinSeries sums periods when period is all', () => {
  const bins = [
    { period: 'local_only', deployment: 'local', bin: '<1k', calls: 1 },
    { period: 'hybrid', deployment: 'local', bin: '<1k', calls: 2 },
    { period: 'hybrid', deployment: 'cloud', bin: '100k+', calls: 4 },
  ];
  assert.deepEqual(sizeBinSeries(bins).series, [
    { name: 'local', data: [3, 0, 0, 0] },
    { name: 'cloud', data: [0, 0, 0, 4] },
  ]);
  assert.deepEqual(sizeBinSeries(bins, { period: 'local_only' }).series[0].data, [1, 0, 0, 0]);
});

test('callPoints groups calls by panel and deployment with prompt score as y', () => {
  const data = { prompts: [PR({}), PR({ score: 6 })],
    calls: [['hybrid', 'cloud', 90000, 1], ['local_only', 'local', 300, 0], ['hybrid', 'copilot', 1600, 0]] };
  const pts = callPoints(data);
  assert.deepEqual(Object.keys(pts), PANELS.map(([p]) => p));
  assert.deepEqual(Object.keys(pts.hybrid), CALL_DEPLOYMENTS);
  assert.deepEqual(pts.hybrid.cloud.map((p) => p.value), [[90000, 6]]);
  assert.deepEqual(pts.local_only.local.map((p) => p.value), [[300, 3.5]]);
  assert.equal(pts.hybrid.copilot[0].prompt, data.prompts[0]);
  assert.deepEqual(pts.local_only.cloud, []);
});

test('logRange brackets values with powers of the base', () => {
  assert.deepEqual(logRange([250, 380000]), { min: 100, max: 1000000 });
  assert.deepEqual(logRange([1.39, 11.2], 2), { min: 1, max: 16 });
});

test('callTooltipLines describes the call and its prompt, never reasoning tokens', () => {
  const lines = callTooltipLines(12345, PR({ score: 6.789, tool_calls: 1, subagent_runs: 0 }));
  assert.deepEqual(lines, [
    '12,345 input tokens in this call', 'Prompt trajectory score 6.79', 'Agent depth 2',
    'Prompt 3 in its chat session', '1 linked tool call', '0 subagent runs',
  ]);
  assert.ok(!lines.join(' ').toLowerCase().includes('reasoning'));
});

test('callCoverageText', () => {
  assert.equal(callCoverageText({ plotted: 6288, zero_tokens: 44, no_score: 249 }),
    '6,288 calls plotted; 44 without recorded input tokens and 249 without a scored prompt are omitted.');
});

test('coverageText', () => {
  assert.equal(coverageText({ prompts: 1479, scored: 1400 }),
    '1,400 of 1,479 prompts have every score component.');
});

const root = join(import.meta.dirname, '..');

test('build ships explorer module, data snapshot, and figure registration', async () => {
  await new Promise((res, rej) => execFile('node', ['src/build.mjs'], { cwd: root },
    (e) => (e ? rej(e) : res())));
  await access(join(root, 'dist/assets/js/local-ai-explorer/explorer.js'));
  await access(join(root, 'dist/assets/data/local-ai-explorer-2026-09-09.json'));
  const figures = await readFile(join(root, 'dist/assets/js/figures.js'), 'utf8');
  assert.match(figures, /registerFigure\('local-ai-explorer'/);
});
