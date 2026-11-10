// model.js — pure data shaping for the local-ai-explorer figure (no DOM).
export const DEPLOYMENTS = ['local', 'cloud', 'copilot', 'other'];
export const BIN_LABELS = ['<1k', '1–10k', '10–100k', '100k+'];
export const COLORS = {
  local: '#3ddc97', cloud: '#ff7a66', mixed: '#f5c542', copilot: '#c792ea', other: '#8a94ab',
};

const fmt = (n) => n.toLocaleString('en-US');
const inPeriod = (period) => (x) => period === 'all' || x.period === period;

export function dailySeries(dailyCalls) {
  const presentDays = [...new Set(dailyCalls.map((d) => d.day))].sort();
  const days = [];
  if (presentDays.length) {
    const end = Date.parse(`${presentDays[presentDays.length - 1]}T00:00:00Z`);
    // walk every UTC calendar day so gaps are not collapsed on a category axis
    for (let t = Date.parse(`${presentDays[0]}T00:00:00Z`); t <= end; t += 86400000) {
      days.push(new Date(t).toISOString().slice(0, 10));
    }
  }
  const index = new Map(dailyCalls.map((d) => [`${d.day}|${d.deployment}`, d.calls]));
  const present = DEPLOYMENTS.filter((dep) => dailyCalls.some((d) => d.deployment === dep));
  return {
    days,
    series: present.map((name) => ({ name, data: days.map((day) => index.get(`${day}|${name}`) ?? 0) })),
  };
}

export function sizeBinSeries(sizeBins, { period = 'all' } = {}) {
  const rows = sizeBins.filter(inPeriod(period));
  return {
    bins: BIN_LABELS,
    series: ['local', 'cloud'].map((name) => ({
      name,
      data: BIN_LABELS.map((bin) => rows
        .filter((r) => r.deployment === name && r.bin === bin)
        .reduce((s, r) => s + r.calls, 0)),
    })),
  };
}

export const CALL_DEPLOYMENTS = ['local', 'cloud', 'copilot'];
export const PANELS = [['local_only', 'Local only · Jul 9–31, 2026'], ['hybrid', 'Hybrid · Aug 1–Sep 9, 2026']];

export function callPoints(data) {
  const out = Object.fromEntries(PANELS.map(([p]) => [p, Object.fromEntries(CALL_DEPLOYMENTS.map((d) => [d, []]))]));
  for (const [period, deployment, tokens, promptIdx] of data.calls) {
    const prompt = data.prompts[promptIdx];
    out[period][deployment].push({ value: [tokens, prompt.score], tokens, prompt });
  }
  return out;
}

export function logRange(values, base = 10) {
  const log = (v) => Math.log(v) / Math.log(base);
  let lo = Infinity; let hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { min: base ** Math.floor(log(lo)), max: base ** Math.ceil(log(hi)) };
}

export function callTooltipLines(tokens, p) {
  return [
    `${fmt(tokens)} input tokens in this call`,
    `Prompt trajectory score ${p.score.toFixed(2)}`,
    `Agent depth ${p.agent_depth}`,
    `Prompt ${p.prompt_position} in its chat session`,
    `${fmt(p.tool_calls)} linked tool call${p.tool_calls === 1 ? '' : 's'}`,
    `${p.subagent_runs} subagent run${p.subagent_runs === 1 ? '' : 's'}`,
  ];
}

export function callCoverageText({ plotted, zero_tokens: zero, no_score: noScore }) {
  return `${fmt(plotted)} calls plotted; ${fmt(zero)} without recorded input tokens and `
    + `${fmt(noScore)} without a scored prompt are omitted.`;
}

export function coverageText({ prompts, scored }) {
  return `${fmt(scored)} of ${fmt(prompts)} prompts have every score component.`;
}

export const SYMBOLS = { local: 'circle', cloud: 'triangle', copilot: 'diamond' };

export function resolveView(view, ids) {
  return ids.includes(view) ? view : 'daily';
}

export function excludedCallsText(disabled) {
  return `${fmt(disabled)} cloud calls during Jul 9–31 that were not part of the experiment are excluded.`;
}

export function unbinnedText(unknown) {
  return `${fmt(unknown)} calls without recorded input tokens are not binned.`;
}
