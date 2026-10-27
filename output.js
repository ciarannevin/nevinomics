'use strict';

function getSeriesData(varName) {
  if (varName === 'GDP_DATA' && typeof GDP_DATA !== 'undefined') return GDP_DATA;
  if (varName === 'GNP_DATA' && typeof GNP_DATA !== 'undefined') return GNP_DATA;
  if (varName === 'MDD_DATA' && typeof MDD_DATA !== 'undefined') return MDD_DATA;
  return null;
}

const OUTPUT_SERIES = [
  { varName: 'GDP_DATA', short: 'GDP', full: 'Gross Domestic Product' },
  { varName: 'GNP_DATA', short: 'GNP', full: 'Gross National Product' },
  { varName: 'MDD_DATA', short: 'MDD', full: 'Modified Final Domestic Demand' },
];

function pickLatest(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].yoy !== null && records[i].qoq !== null) return records[i];
  }
  return null;
}

function stripKpi(series, rec, growth) {
  if (!rec) return '';
  const v = growth === 'yoy' ? rec.yoy : rec.qoq;
  if (v === null || v === undefined) return '';
  const dir = v >= 0 ? 'up' : 'down';
  return `<div class="kpi"><span class="label" title="${series.full}">${series.short} — ${growth === 'yoy' ? 'YoY' : 'QoQ'}</span><div class="value ${dir}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</div></div>`;
}

function initSummaryStrip() {
  const host = document.getElementById('summary-strip');
  if (!host) return;

  let latestQuarter = null;
  const tiles = [];
  for (const def of OUTPUT_SERIES) {
    const data = getSeriesData(def.varName);
    const rec = data && data.length ? pickLatest(data) : null;
    if (rec && (!latestQuarter || rec.quarter > latestQuarter)) latestQuarter = rec.quarter;
    tiles.push(stripKpi(def, rec, 'yoy'));
    tiles.push(stripKpi(def, rec, 'qoq'));
  }
  let growthHtml = tiles.join('');

  let forecastHtml = '';
  if (typeof FORECAST_DATA !== 'undefined' && FORECAST_DATA.series) {
    const forecastTiles = [];
    for (const key of ['GDP', 'GNI*', 'MDD']) {
      const pts = (FORECAST_DATA.series[key] || []).filter((p) => p.forecast && p.value !== null);
      if (!pts.length) continue;
      const years = pts.slice(0, 3);
      const cells = years
        .map(
          (p) =>
            `<div class="fy-col"><span class="fy-year">${p.year}</span><span class="fy-val ${p.value < 0 ? 'down' : 'up'}">${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%</span></div>`
        )
        .join('');
      forecastTiles.push(
        `<div class="kpi kpi-wide"><span class="label" title="Central Bank of Ireland Quarterly Bulletin forecasts, annual growth">${key} — forecast annual growth</span><div class="forecast-years">${cells}</div></div>`
      );
    }
    forecastHtml = forecastTiles.join('');
  }

  host.innerHTML =
    (growthHtml ? `<div class="kpi-heading">Growth rates</div><div class="kpis">${growthHtml}</div>` : '') +
    (forecastHtml ? `<div class="kpi-heading">Annual growth forecasts</div><div class="kpis">${forecastHtml}</div>` : '');

  const badge = document.getElementById('strip-updated');
  if (badge && latestQuarter) badge.textContent = `Data through ${latestQuarter}`;
}

function quarterToDate(q) {
  const [year, qn] = [q.slice(0, 4), q.slice(5)];
  return new Date(Date.UTC(Number(year), (Number(qn) - 1) * 3, 1));
}

function fmtMillions(v) {
  return `€${Math.round(v).toLocaleString('en-IE')}m`;
}

function lastNYears(records, years) {
  if (!records || !records.length) return [];
  const last = records[records.length - 1];
  const cutoffYear = Number(last.quarter.slice(0, 4)) - years;
  return records.filter((r) => Number(r.quarter.slice(0, 4)) >= cutoffYear);
}

function buildGrowthDatasets(metric) {
  const palette = { GDP: '#009a44', GNP: '#0e5c8a', MDD: '#c28a00' };
  const datasets = [];
  for (const def of OUTPUT_SERIES) {
    const data = lastNYears(getSeriesData(def.varName), 5).filter((d) => d[metric] !== null);
    if (!data.length) continue;
    datasets.push(
      nvLineDataset(
        def.short,
        data.map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d[metric] })),
        { color: palette[def.short], fill: false }
      )
    );
  }
  return datasets;
}

function initLevelsChart() {
  const ctx = document.getElementById('levels-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const config = {
    type: 'line',
    data: { datasets: buildGrowthDatasets('yoy') },
    options: nvBaseOptions((v) => `${v}%`),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.x.time.unit = 'quarter';
  config.options.scales.x.time.tooltipFormat = 'yyyy QQQ';
  config.options.plugins.legend = {
    display: true,
    position: 'bottom',
    labels: { boxWidth: 12, usePointStyle: true },
  };
  config.options.plugins.tooltip.callbacks = {
    title: (items) => {
      const d = new Date(items[0].parsed.x);
      return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    },
    label: (item) => {
      const v = item.parsed.y;
      return `${item.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    },
  };

  const chart = new Chart(ctx, config);

  document.querySelectorAll('input[name="growth-metric"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      chart.data.datasets = buildGrowthDatasets(radio.value);
      chart.update();
    });
  });
}


function initForecastChart() {
  const ctx = document.getElementById('forecast-chart');
  const host = document.getElementById('forecast-placeholder');
  if (!ctx || typeof Chart === 'undefined' || typeof FORECAST_DATA === 'undefined') return;

  if (host) host.style.display = 'none';
  const wrap = document.getElementById('forecast-chart-wrap');
  if (wrap) wrap.style.display = 'block';
  const foot = document.getElementById('forecast-footnote');
  if (foot) foot.style.display = 'block';

  const palette = { GDP: '#009a44', 'GNI*': '#0e5c8a', MDD: '#c28a00' };
  const points = (pts) => pts.filter((p) => p.value !== null).map((p) => ({ x: Date.UTC(Number(p.year), 0, 1), y: p.value }));
  const actuals = (pts) => points(pts.filter((p) => !p.forecast));
  const forecastFrom = (pts) => {
    const firstForecast = pts.find((p) => p.forecast && p.value !== null);
    if (!firstForecast) return [];
    const anchor = pts.find((p) => !p.forecast && p.value !== null && Number(p.year) === Number(firstForecast.year) - 1);
    const anchorPt = anchor ? [{ x: Date.UTC(Number(anchor.year), 0, 1), y: anchor.value }] : [];
    return anchorPt.concat(points(pts.filter((p) => p.forecast)));
  };
  const datasets = [];
  for (const key of ['GDP', 'GNI*', 'MDD']) {
    const pts = FORECAST_DATA.series[key] || [];
    if (!pts.length) continue;
    const actual = nvLineDataset(key, actuals(pts), { color: palette[key], fill: false });
    const forecast = nvLineDataset(key, forecastFrom(pts), { color: palette[key], fill: false });
    forecast.borderDash = [6, 4];
    datasets.push(actual, forecast);
  }

  const config = {
    type: 'line',
    data: { datasets },
    options: nvBaseOptions((v) => `${v}%`),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.x.time.unit = 'year';
  config.options.scales.x.time.tooltipFormat = 'yyyy';
  config.options.plugins.legend = {
    display: true,
    position: 'bottom',
    labels: { boxWidth: 12, usePointStyle: true },
    onClick: (e, legendItem, legend) => {
      const idx = legendItem.datasetIndex;
      const chart = legend.chart;
      const pair = [idx, idx + 1];
      const hidden = !chart.isDatasetVisible(idx);
      pair.forEach((i) => {
        if (i < chart.data.datasets.length && chart.data.datasets[i].label === chart.data.datasets[idx].label) {
          chart.setDatasetVisibility(i, hidden);
        }
      });
      chart.update();
    },
  };
  config.options.plugins.legend.labels.filter = (item) => item.text !== undefined && item.datasetIndex % 2 === 0;
  config.options.plugins.tooltip.callbacks = {
    title: (items) => String(new Date(items[0].parsed.x).getUTCFullYear()),
    label: (item) => {
      const v = item.parsed.y;
      return `${item.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    },
  };

  new Chart(ctx, config);

  const badge = document.getElementById('forecast-updated');
  if (badge) {
    const m = (FORECAST_DATA.title || '').match(/Q([1-4])\s*(\d{4})/);
    badge.textContent = m ? `CBI Bulletin Q${m[1]} ${m[2]}` : 'CBI forecasts';
    badge.classList.add('live');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSummaryStrip();
  initLevelsChart();
  initForecastChart();
  initComponentsTable();
});

function initComponentsTable() {
  const host = document.getElementById('components-table');
  if (!host || typeof COMPONENT_DATA === 'undefined') return;

  const rows = [
    { label: 'Personal consumption', key: 'Personal consumption' },
    { label: 'Government consumption', key: 'Government consumption' },
    { label: 'Investment (gross fixed capital formation)', key: 'Investment (GFCF)', group: true },
    { label: 'Machinery & equipment', key: 'Investment: Machinery & equipment', indent: true, group: true },
    { label: 'Intangible assets', key: 'Investment: Intangible assets', indent: true, group: true },
    { label: 'Building & construction', key: 'Investment: Building & construction', indent: true, group: true },
    { label: 'Stocks (change in inventories)', key: 'Stocks (changes in inventories)' },
    { label: 'Exports', key: 'Exports' },
    { label: 'Less: Imports', key: 'Imports', sign: -1 },
    { label: 'GDP', key: 'GDP', strong: true },
  ];

  const fmt = (v) => (v === null || v === undefined ? '—' : `€${Math.round(v).toLocaleString('en-IE')}m`);
  const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`);
  const cls = (v) => (v === null || v === undefined ? '' : v >= 0 ? 'up' : 'down');

  const gdpSeries = COMPONENT_DATA['GDP'] || [];
  const gdpByQuarter = {};
  gdpSeries.forEach((d) => { gdpByQuarter[d.quarter] = d.value; });
  const gdpHist = gdpSeries.map((d) => d.value);

  let latestQuarter = null;
  const table = rows.map((r) => {
    const series = COMPONENT_DATA[r.key];
    if (!series || !series.length) return { ...r, latest: null, total4: null, yoy: null, qoq: null, qoqC: null, yoyC: null };
    const latest = series[series.length - 1];
    if (!latestQuarter || latest.quarter > latestQuarter) latestQuarter = latest.quarter;
    // quarterly contributions to GDP growth, pp; last 4 quarters kept for averaging
    const contrib = (d, i) => {
      if (i < 1 || !gdpHist.length) return null;
      const prevVal = series[i - 1].value;
      const gdpThen = gdpHist[i - 1];
      return gdpThen ? ((d.value - prevVal) / gdpThen) * 100 : null;
    };
    // CSO stores imports as negative values; for the "Less: Imports" row use magnitudes
    const magnitude = r.sign === -1;
    const latestVal = magnitude ? Math.abs(latest.value) : latest.value;
    const prev = series.length > 1 ? series[series.length - 2].value : null;
    const prevVal = prev === null ? null : magnitude ? Math.abs(prev) : prev;
    const yoySeries = series.filter((d) => d.yoy !== null);
    const yoyRec = yoySeries.length ? yoySeries[yoySeries.length - 1] : null;
    const yoy = yoyRec ? Math.abs(yoyRec.yoy) * Math.sign(yoyRec.value || 1) * (yoyRec.yoy >= 0 ? 1 : -1) : null;
    const yoyFinal = yoyRec ? (magnitude ? Math.abs(yoyRec.yoy) : yoyRec.yoy) : null;
    const qoq = prevVal !== null && prevVal !== 0 ? ((latestVal - prevVal) / Math.abs(prevVal)) * 100 : null;
    // per-quarter contributions over the last 4 quarters (aligned to component quarters)
    const quarters = series.slice(-4).map((d) => d.quarter);
    const contribs = quarters.map((q) => {
      const idx = series.findIndex((d) => d.quarter === q);
      return idx > 0 ? contrib(series[idx], idx) : null;
    });
    const valid = contribs.filter((c) => c !== null);
    const avgContrib = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    const latestContrib = contribs[contribs.length - 1];
    const qoqC = latestContrib;
    const yoyC = avgContrib;
    if (r.indent) {
      return { ...r, latest: latestVal, yoy: yoyFinal, qoq, qoqC: null, yoyC: null };
    }
    return { ...r, latest: latestVal, yoy: yoyFinal, qoq, qoqC, yoyC };
  });

  host.innerHTML =
    `<table class="data-table"><thead><tr>` +
    `<th>Component</th><th>Latest quarter (€m)</th><th>Growth, QoQ (%)</th><th>Growth, YoY (%)</th><th>Contrib. to QoQ GDP growth (pp)</th><th>Contrib. to 4-qtr GDP growth (pp)</th>` +
    `</tr></thead><tbody>` +
    table
      .map(
        (r) =>
          `<tr${r.strong ? ' class="strong"' : ''}${r.indent ? ' class="indent"' : ''}>` +
          `<td>${r.indent ? '· ' : ''}${r.label}</td>` +
          `<td>${fmt(r.latest)}</td>` +
          `<td class="${cls(r.qoq)}">${fmtPct(r.qoq)}</td>` +
          `<td class="${cls(r.yoy)}">${fmtPct(r.yoy)}</td>` +
          `<td class="${cls(r.qoqC)}">${fmtPct(r.qoqC)}</td>` +
          `<td class="${cls(r.yoyC)}">${fmtPct(r.yoyC)}</td>` +
          `</tr>`
      )
      .join('') +
    `</tbody></table>`;

  const badge = document.getElementById('components-updated');
  if (badge && latestQuarter) badge.textContent = latestQuarter;
}
