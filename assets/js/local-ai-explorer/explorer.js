// explorer.js — DOM + ECharts wiring for the local-ai-explorer figure.
import {
  COLORS, CALL_DEPLOYMENTS, PANELS, dailySeries, sizeBinSeries, coverageText,
  callPoints, logRange, callTooltipLines, callCoverageText,
} from './model.js';

const VIEWS = [
  ['daily', 'Daily model calls'],
  ['sizes', 'Prompt sizes'],
  ['trajectory', 'Prompt size vs trajectory'],
];
const PERIODS = [['all', 'Both periods'], ['local_only', 'Local only (Jul 9–31)'], ['hybrid', 'Hybrid (Aug 1–Sep 9)']];
const PERIOD_MARKS = [
  ['2026-07-09', '2026-07-31', 'Local only', COLORS.local],
  ['2026-08-01', '2026-09-09', 'Hybrid', COLORS.mixed],
];

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function theme() {
  return { text: css('--text-muted') || '#9aa3b2', grid: css('--border') || '#2a3140' };
}

function axis(t, extra = {}) {
  return { axisLabel: { color: t.text }, axisLine: { lineStyle: { color: t.grid } },
    splitLine: { lineStyle: { color: t.grid } }, nameTextStyle: { color: t.text }, ...extra };
}

function periodSeries(days, t) {
  const at = (day) => days.indexOf(day);
  const marks = PERIOD_MARKS.filter(([a, b]) => at(a) >= 0 && at(b) >= 0);
  // a hidden value axis over the category bands lets each area span whole bars (index ± 0.5)
  return {
    name: 'periods', type: 'line', data: [], xAxisIndex: 1, silent: true, tooltip: { show: false },
    markArea: {
      silent: true,
      label: { color: t.text, position: 'insideTop', distance: 6 },
      data: marks.map(([a, b, name, color]) => [
        { name, xAxis: at(a) - 0.5, itemStyle: { color, opacity: 0.18 } },
        { xAxis: at(b) + 0.5 },
      ]),
    },
    markLine: {
      silent: true, symbol: 'none', label: { show: false },
      lineStyle: { color: t.text, type: 'dashed', width: 1, opacity: 0.8 },
      data: marks.slice(1).map(([a]) => ({ xAxis: at(a) - 0.5 })),
    },
  };
}

function dailyOption(data, t) {
  const { days, series } = dailySeries(data.daily_calls);
  return {
    aria: { enabled: true },
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: t.text }, bottom: 0, data: series.map((s) => s.name) },
    grid: { left: 48, right: 16, top: 36, bottom: 64 },
    xAxis: [
      axis(t, { type: 'category', data: days }),
      { type: 'value', show: false, min: -0.5, max: days.length - 0.5, axisPointer: { show: false } },
    ],
    yAxis: axis(t, { type: 'value', name: 'inference calls' }),
    series: [
      ...series.map((s) => ({ ...s, type: 'bar', stack: 'calls', itemStyle: { color: COLORS[s.name] } })),
      periodSeries(days, t),
    ],
  };
}

function sizesOption(data, state, t) {
  const { bins, series } = sizeBinSeries(data.size_bins, state);
  return {
    aria: { enabled: true },
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: t.text }, top: 0 },
    grid: { left: 56, right: 16, top: 36, bottom: 40 },
    xAxis: axis(t, { type: 'category', data: bins, name: 'input tokens per call', nameLocation: 'middle', nameGap: 28 }),
    yAxis: axis(t, { type: 'log', name: 'inference calls' }),
    // log axis cannot show 0; empty bins become gaps
    series: series.map((s) => ({
      ...s, data: s.data.map((v) => (v > 0 ? v : null)), type: 'bar', itemStyle: { color: COLORS[s.name] },
    })),
  };
}

function trajectoryOption(t, points, xRange, yRange) {
  const grids = [{ left: 64, right: 24, top: 56, height: '36%' }, { left: 64, right: 24, top: '58%', height: '36%' }];
  return {
    aria: { enabled: true },
    tooltip: { trigger: 'item', formatter: (p) => callTooltipLines(p.data.tokens, p.data.prompt).join('<br>') },
    legend: { textStyle: { color: t.text }, top: 0, data: CALL_DEPLOYMENTS },
    title: PANELS.map(([, label], i) => ({ text: label, left: 'center', top: i === 0 ? 30 : '53%',
      textStyle: { color: t.text, fontSize: 13, fontWeight: 'normal' } })),
    grid: grids,
    xAxis: grids.map((_, i) => axis(t, { type: 'log', gridIndex: i, ...xRange,
      ...(i === 1 ? { name: 'input tokens per call', nameLocation: 'middle', nameGap: 28 } : {}) })),
    yAxis: grids.map((_, i) => axis(t, { type: 'log', logBase: 2, gridIndex: i, ...yRange, name: 'trajectory score' })),
    // series share names across panels so one legend click toggles a deployment in both
    series: PANELS.flatMap(([period], i) => CALL_DEPLOYMENTS.map((dep) => ({
      name: dep, type: 'scatter', xAxisIndex: i, yAxisIndex: i, symbolSize: 5,
      itemStyle: { color: COLORS[dep], opacity: 0.6 }, data: points[period][dep],
    }))),
  };
}

function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text) node.textContent = text;
  return node;
}

export async function mountLocalAiExplorer(root, cfg = {}) {
  try {
    await mount(root, cfg);
  } catch (err) {
    console.error('local-ai-explorer:', err);
    root.classList.add('fig--explorer');
    root.replaceChildren(el('p', { class: 'explorer-error', role: 'status' },
      'The usage explorer could not load.'));
  }
}

async function mount(root, cfg) {
  const [echarts, data] = await Promise.all([
    import('/assets/js/vendor/echarts.esm.min.js'),
    fetch(cfg.src).then((r) => {
      if (!r.ok) throw new Error(`explorer data ${r.status}`);
      return r.json();
    }),
  ]);
  const points = callPoints(data);
  const all = Object.values(points).flatMap((byDep) => Object.values(byDep).flat());
  const xRange = logRange(all.map((p) => p.tokens));
  const yRange = logRange(all.map((p) => p.value[1]), 2);
  const initial = { view: cfg.view || 'daily', period: 'all' };
  const state = structuredClone(initial);

  root.classList.add('fig--explorer');
  root.replaceChildren();
  const controls = el('div', { class: 'explorer-controls', role: 'group', 'aria-label': 'Explorer controls' });
  const viewButtons = VIEWS.map(([id, label]) => {
    const b = el('button', { type: 'button', 'data-view': id }, label);
    b.addEventListener('click', () => { state.view = id; render(); });
    return b;
  });
  const period = el('select', { 'aria-label': 'Period' });
  PERIODS.forEach(([id, label]) => period.append(el('option', { value: id }, label)));
  period.addEventListener('change', () => { state.period = period.value; render(); });
  const reset = el('button', { type: 'button', class: 'explorer-reset' }, 'Reset');
  reset.addEventListener('click', () => {
    Object.assign(state, structuredClone(initial));
    period.value = 'all';
    render();
  });
  controls.append(...viewButtons, period, reset);

  const chartEl = el('div', { class: 'explorer-chart' });
  const note = el('p', { class: 'explorer-note' });
  root.append(controls, chartEl, note);

  const chart = echarts.init(chartEl, null, { renderer: 'canvas' });
  new ResizeObserver(() => chart.resize()).observe(chartEl);

  function render() {
    const t = theme();
    viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    period.disabled = state.view !== 'sizes';
    chartEl.style.height = state.view === 'trajectory' ? '640px' : '';
    chart.resize();
    const option = state.view === 'daily' ? dailyOption(data, t)
      : state.view === 'sizes' ? sizesOption(data, state, t)
        : trajectoryOption(t, points, xRange, yRange);
    chart.setOption(option, true);
    const shown = state.view === 'trajectory' ? ` ${callCoverageText(data.coverage.calls)}` : '';
    note.textContent = `Data through ${data.data_through} (UTC days), with manual corrections applied. `
      + '“copilot” is Copilot’s built-in helper model, not a chosen coding model. '
      + `Score = ${data.score.formula}; reasoning and output tokens are excluded. `
      + `Agent depth is a lower bound for very long runs; tool calls are linked heuristically; `
      + `nested subagent depth is not recorded. ${coverageText(data.coverage)}${shown} `
      + 'Counts show usage, not productivity or code quality.';
  }
  render();
  new MutationObserver(render).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });
}
