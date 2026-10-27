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
  host.innerHTML = tiles.join('');

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
  config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
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

  const palette = { GDP: '#009a44', MDD: '#c28a00' };
  const datasets = [];
  for (const key of ['GDP', 'MDD']) {
    const pts = FORECAST_DATA.series[key] || [];
    if (!pts.length) continue;
    datasets.push(
      nvLineDataset(
        key,
        pts.filter((p) => p.value !== null).map((p) => ({ x: Date.UTC(Number(p.year), 0, 1), y: p.value })),
        { color: palette[key], fill: false }
      )
    );
  }

  const config = {
    type: 'line',
    data: { datasets },
    options: nvBaseOptions((v) => `${v}%`),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.x.time.unit = 'year';
  config.options.scales.x.time.tooltipFormat = 'yyyy';
  config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
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
});
