import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTES, filterPrompts, dailySeries, sizeBinSeries, scatterSeries, tooltipLines, coverageText,
} from '../assets/js/local-ai-explorer/model.js';

const P = (o) => ({ period: 'hybrid', route: 'local', input_tokens: 10, agent_depth: 1,
  prompt_position: 1, tool_calls: 0, subagent_runs: 0, score: 1.5, ...o });

test('filterPrompts by period and route', () => {
  const ps = [P({}), P({ period: 'local_only' }), P({ route: 'mixed' })];
  assert.equal(filterPrompts(ps).length, 3);
  assert.equal(filterPrompts(ps, { period: 'local_only' }).length, 1);
  assert.deepEqual(filterPrompts(ps, { routes: ['mixed'] }).map((p) => p.route), ['mixed']);
  assert.deepEqual(ROUTES, ['local', 'cloud', 'mixed']);
});

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

test('scatterSeries drops unscored prompts and clamps x for the log axis', () => {
  const s = scatterSeries([P({ input_tokens: 0 }), P({ score: null }), P({ route: 'cloud' })], {});
  assert.deepEqual(s.map((x) => x.name), ['local', 'cloud', 'mixed']);
  assert.deepEqual(s[0].data.map((d) => d.value), [[1, 1.5]]);
  assert.equal(s[1].data.length, 1);
  assert.equal(s[2].data.length, 0);
});

test('tooltipLines lists raw components and never reasoning tokens', () => {
  const lines = tooltipLines(P({ input_tokens: 12345, agent_depth: 7, prompt_position: 3,
    tool_calls: 9, subagent_runs: 1, score: 6.789 }));
  assert.deepEqual(lines, [
    '12,345 initial input tokens', 'Trajectory score 6.79', 'Agent depth 7',
    'Prompt 3 in its chat session', '9 linked tool calls', '1 subagent run',
  ]);
  assert.ok(!lines.join(' ').toLowerCase().includes('reasoning'));
});

test('coverageText', () => {
  assert.equal(coverageText({ prompts: 1479, scored: 1400 }),
    '1,400 of 1,479 prompts have every score component.');
});
