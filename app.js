'use strict';

function quarterToDate(q) {
  const [year, qn] = [q.slice(0, 4), q.slice(5)];
  return new Date(Date.UTC(Number(year), (Number(qn) - 1) * 3, 1));
}

function latestComplete(data) {
  const withGrowth = data.filter((d) => d.yoy !== null);
  return withGrowth[withGrowth.length - 1] || data[data.length - 1];
}

function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function fmtMillions(v) {
  return `€${Math.round(v).toLocaleString('en-IE')}m`;
}

function initKpis(data) {
  const latest = latestComplete(data);
  const prevQ = data.find((d) => d.quarter === `${Number(latest.quarter.slice(0, 4)) - 1}Q4`);
  const yearAvg =
    data
      .filter((d) => d.quarter.startsWith(latest.quarter.slice(0, 4)) && d.value !== null)
      .reduce((sum, d) => sum + d.value, 0) / 4;
  const kpis = [
    { label: `YoY growth (${latest.quarter})`, value: fmtPct(latest.yoy), dir: latest.yoy >= 0 ? 'up' : 'down' },
    { label: 'GDP, latest quarter', value: fmtMillions(latest.value), dir: '' },
    { label: `GDP avg ${latest.quarter.slice(0, 4)}`, value: fmtMillions(yearAvg), dir: '' },
  ];
  if (prevQ && prevQ.yoy !== null) {
    kpis.push({ label: `YoY growth (${prevQ.quarter})`, value: fmtPct(prevQ.yoy), dir: prevQ.yoy >= 0 ? 'up' : 'down' });
  }
  const container = document.getElementById('gdp-kpis');
  if (container) {
    container.innerHTML = kpis
      .map((k) => `<div class="kpi"><span class="label">${k.label}</span><div class="value ${k.dir}">${k.value}</div></div>`)
      .join('');
  }
}

function makeDataset(data, metric) {
  const points = data.filter((d) => d[metric] !== null);
  return {
    datasets: [
      nvLineDataset(
        metric === 'yoy' ? 'Year-on-year growth (%)' : 'GDP level (€m)',
        points.map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d[metric] })),
        { fill: metric === 'yoy' }
      ),
    ],
  };
}

function initChart(data) {
  const ctx = document.getElementById('gdp-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const yoyTicks = (v) => `${v}%`;
  const levelTicks = (v) => (Math.abs(v) >= 1000 ? `${v / 1000}k` : v);

  const config = {
    type: 'line',
    data: makeDataset(data, 'yoy'),
    options: nvBaseOptions(yoyTicks),
    plugins: [nevinomicsWatermark],
  };

  config.options.plugins.tooltip.callbacks = {
    title: (items) => {
      const d = new Date(items[0].parsed.x);
      return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    },
    label: (item) =>
      item.dataset.label.includes('%')
        ? `${item.dataset.label}: ${fmtPct(item.parsed.y)}`
        : `${item.dataset.label}: ${fmtMillions(item.parsed.y)}`,
  };

  const chart = new Chart(ctx, config);

  document.querySelectorAll('input[name="gdp-metric"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      chart.data = makeDataset(data, radio.value);
      chart.options.scales.y.ticks.callback = radio.value === 'value' ? levelTicks : yoyTicks;
      chart.update();
    });
  });
}

function initGdpPage() {
  if (typeof GDP_DATA === 'undefined' || GDP_DATA.length === 0) return;
  const latest = GDP_DATA[GDP_DATA.length - 1];
  const badge = document.getElementById('gdp-updated');
  if (badge) badge.textContent = `Data through ${latest.quarter}`;
  initKpis(GDP_DATA);
  initChart(GDP_DATA);
}

function initHomeHero() {
  const el = document.getElementById('hero-gdp');
  if (!el || typeof GDP_DATA === 'undefined') return;
  const latest = latestComplete(GDP_DATA);
  el.innerHTML =
    `<p class="eyebrow">Irish GDP growth, year-on-year (${latest.quarter})</p>` +
    `<div class="big ${latest.yoy >= 0 ? 'up' : 'down'}">${fmtPct(latest.yoy)}</div>` +
    `<p class="sub">GDP of ${fmtMillions(latest.value)} in the latest quarter. ` +
    `<a href="output.html">See the Output page →</a></p>`;
}

document.addEventListener('DOMContentLoaded', () => {
  initGdpPage();
  initHomeHero();
});
