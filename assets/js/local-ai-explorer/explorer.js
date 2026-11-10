// explorer.js — DOM + ECharts wiring for the local-ai-explorer figure.
import {
  ROUTES, COLORS, filterPrompts, dailySeries, sizeBinSeries, scatterSeries, tooltipLines, coverageText,
} from './model.js';

const VIEWS = [
  ['daily', 'Daily model calls'],
  ['sizes', 'Prompt sizes'],
  ['trajectory', 'Prompt size vs trajectory'],
];
const PERIODS = [['all', 'Both periods'], ['local_only', 'Local only (Jul 9–31)'], ['hybrid', 'Hybrid (Aug 1–Sep 9)']];
const PERIOD_MARKS = [['2026-07-09', '2026-07-31', 'Local only'], ['2026-08-01', '2026-09-09', 'Hybrid']];

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

function dailyOption(data, t) {
  const { days, series } = dailySeries(data.daily_calls);
  return {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: t.text }, top: 0 },
    grid: { left: 48, right: 16, top: 36, bottom: 40 },
    xAxis: axis(t, { type: 'category', data: days }),
    yAxis: axis(t, { type: 'value', name: 'inference calls' }),
    series: series.map((s, i) => ({
      ...s, type: 'bar', stack: 'calls', itemStyle: { color: COLORS[s.name] },
      ...(i === 0 ? { markArea: {
        itemStyle: { color: 'rgba(255,255,255,0.04)' },
        label: { color: t.text },
        data: PERIOD_MARKS.map(([a, b, name]) => [{ name, xAxis: a }, { xAxis: b }]),
      } } : {}),
    })),
  };
}

function sizesOption(data, state, t) {
  const { bins, series } = sizeBinSeries(data.size_bins, state);
  return {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: t.text }, top: 0 },
    grid: { left: 56, right: 16, top: 36, bottom: 40 },
    xAxis: axis(t, { type: 'category', data: bins, name: 'input tokens per call', nameLocation: 'middle', nameGap: 28 }),
    yAxis: axis(t, { type: 'log', name: 'inference calls' }),
    series: series.map((s) => ({ ...s, type: 'bar', itemStyle: { color: COLORS[s.name] } })),
  };
}

function trajectoryOption(data, state, t) {
  return {
    tooltip: { trigger: 'item', formatter: (p) => tooltipLines(p.data.prompt).join('<br>') },
    legend: { textStyle: { color: t.text }, top: 0 },
    grid: { left: 56, right: 16, top: 36, bottom: 48 },
    xAxis: axis(t, { type: 'log', name: 'initial prompt input tokens', nameLocation: 'middle', nameGap: 30 }),
    yAxis: axis(t, { type: 'value', name: 'trajectory score' }),
    series: scatterSeries(data.prompts, state).map((s) => ({
      ...s, type: 'scatter', symbolSize: 7, itemStyle: { color: COLORS[s.name], opacity: 0.7 },
    })),
  };
}

function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text) node.textContent = text;
  return node;
}

export async function mountLocalAiExplorer(root, cfg = {}) {
  const [echarts, data] = await Promise.all([
    import('/assets/js/vendor/echarts.esm.min.js'),
    fetch(cfg.src).then((r) => {
      if (!r.ok) throw new Error(`explorer data ${r.status}`);
      return r.json();
    }),
  ]);
  const routes = ROUTES.filter((r) => data.prompts.some((p) => p.route === r));
  const initial = { view: cfg.view || 'daily', period: 'all', routes: [...routes] };
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
  const routeBoxes = routes.map((r) => {
    const label = el('label', { class: 'explorer-route' });
    const box = el('input', { type: 'checkbox', value: r });
    box.checked = true;
    box.addEventListener('change', () => {
      state.routes = routeBoxes.filter(([, b]) => b.checked).map(([id]) => id);
      render();
    });
    label.append(box, ` ${r}`);
    return [r, box, label];
  });
  const reset = el('button', { type: 'button', class: 'explorer-reset' }, 'Reset');
  reset.addEventListener('click', () => {
    Object.assign(state, structuredClone(initial));
    period.value = 'all';
    routeBoxes.forEach(([, b]) => { b.checked = true; });
    render();
  });
  const routesGroup = el('span', { class: 'explorer-routes', role: 'group', 'aria-label': 'Routes' });
  routesGroup.append(...routeBoxes.map(([, , l]) => l));
  controls.append(...viewButtons, period, routesGroup, reset);

  const chartEl = el('div', { class: 'explorer-chart' });
  const note = el('p', { class: 'explorer-note' });
  root.append(controls, chartEl, note);

  const chart = echarts.init(chartEl, null, { renderer: 'canvas' });
  new ResizeObserver(() => chart.resize()).observe(chartEl);

  function render() {
    const t = theme();
    viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    period.disabled = state.view === 'daily';
    routesGroup.hidden = state.view !== 'trajectory';
    const option = state.view === 'daily' ? dailyOption(data, t)
      : state.view === 'sizes' ? sizesOption(data, state, t)
        : trajectoryOption(data, state, t);
    chart.setOption(option, true);
    const shown = state.view === 'trajectory'
      ? ` Showing ${filterPrompts(data.prompts, state).filter((p) => p.score !== null).length} prompts.` : '';
    note.textContent = `Data through ${data.data_through} (UTC days), with manual corrections applied. `
      + '“copilot” is Copilot’s built-in helper model, not a chosen coding model. '
      + `Score = ${data.score.formula}; reasoning and output tokens are excluded. `
      + `Agent depth is a lower bound for very long runs; tool calls are linked heuristically; `
      + `nested subagent depth is not recorded. ${coverageText(data.coverage)}${shown} `
      + 'Counts show usage, not productivity or code quality.';
  }
  render();
}
