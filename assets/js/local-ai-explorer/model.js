// model.js — pure data shaping for the local-ai-explorer figure (no DOM).
export const ROUTES = ['local', 'cloud', 'mixed'];
export const DEPLOYMENTS = ['local', 'cloud', 'copilot', 'other'];
export const BIN_LABELS = ['<1k', '1–10k', '10–100k', '100k+'];
export const COLORS = {
  local: '#3ddc97', cloud: '#ff7a66', mixed: '#f5c542', copilot: '#c792ea', other: '#8a94ab',
};

const fmt = (n) => n.toLocaleString('en-US');
const inPeriod = (period) => (x) => period === 'all' || x.period === period;

export function filterPrompts(prompts, { period = 'all', routes = ROUTES } = {}) {
  return prompts.filter((p) => inPeriod(period)(p) && routes.includes(p.route));
}

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

const scored = (prompts, opts) => filterPrompts(prompts, opts).filter((p) => p.score !== null);

export function scatterSeries(prompts, { period = 'all', routes = ROUTES } = {}) {
  // log x-axis cannot show 0 tokens; those prompts lack a recorded size and are left out
  const kept = scored(prompts, { period, routes }).filter((p) => p.input_tokens > 0);
  return ROUTES.filter((r) => routes.includes(r)).map((name) => ({
    name,
    data: kept.filter((p) => p.route === name)
      .map((p) => ({ value: [p.input_tokens, p.score], prompt: p })),
  }));
}

export function unplottedCount(prompts, opts = {}) {
  return scored(prompts, opts).filter((p) => !(p.input_tokens > 0)).length;
}

export function tooltipLines(p) {
  return [
    `${fmt(p.input_tokens)} initial input tokens`,
    `Trajectory score ${p.score.toFixed(2)}`,
    `Agent depth ${p.agent_depth}`,
    `Prompt ${p.prompt_position} in its chat session`,
    `${fmt(p.tool_calls)} linked tool call${p.tool_calls === 1 ? '' : 's'}`,
    `${p.subagent_runs} subagent run${p.subagent_runs === 1 ? '' : 's'}`,
  ];
}

export function coverageText({ prompts, scored }) {
  return `${fmt(scored)} of ${fmt(prompts)} prompts have every score component.`;
}
