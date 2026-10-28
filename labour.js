'use strict';

function monthToDate(m) {
  const [y, mo] = [Number(m.slice(0, 4)), Number(m.slice(5, 7))];
  return new Date(Date.UTC(y, mo - 1, 1));
}

function quarterToDate(q) {
  const [year, qn] = [q.slice(0, 4), q.slice(5)];
  return new Date(Date.UTC(Number(year), (Number(qn) - 1) * 3, 1));
}

function lastNYearsMonthly(records, years) {
  if (!records || !records.length) return [];
  const last = records[records.length - 1];
  const cutoff = Date.UTC(Number(last.month.slice(0, 4)) - years, Number(last.month.slice(5, 7)) - 1, 1);
  return records.filter((r) => monthToDate(r.month).getTime() >= cutoff);
}

function lastNYearsQuarterly(records, years) {
  if (!records || !records.length) return [];
  const last = records[records.length - 1];
  const cutoffYear = Number(last.quarter.slice(0, 4)) - years;
  return records.filter((r) => Number(r.quarter.slice(0, 4)) >= cutoffYear);
}

function fmtPctV(v, dp = 1) {
  return v === null || v === undefined ? '—' : `${v.toFixed(dp)}%`;
}

function fmtDelta(v, dp = 1) {
  return v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}pp`;
}

function tile(label, tooltip, cols) {
  const cells = cols
    .map(
      (c) =>
        `<div class="fy-col"><span class="fy-year">${c.label}</span><span class="fy-val ${c.dir}">${c.value}</span></div>`
    )
    .join('');
  return `<div class="kpi kpi-wide" title="${tooltip}"><span class="label">${label}</span><div class="mini-cols">${cells}</div></div>`;
}

function initHighlights() {
  const host = document.getElementById('labour-highlights');
  if (!host || typeof LABOUR_DATA === 'undefined') return;

  const L = LABOUR_DATA;
  const mu = (L.monthly_unemployment || {})['15-74'] || {};
  const youth = (L.monthly_unemployment || {})['15-24'] || {};
  const part = (L.participation || {}).both || [];
  const ilo = (L.ilo_unemployment || {}).both || [];

  const muLatest = mu.both ? mu.both[mu.both.length - 1] : null;
  const youthLatest = youth.both ? youth.both[youth.both.length - 1] : null;
  const partLatest = part.length ? part[part.length - 1] : null;
  const iloLatest = ilo.length ? ilo[ilo.length - 1] : null;
  const iloMale = ((L.ilo_unemployment || {}).male || []).slice(-1)[0] || null;
  const iloFemale = ((L.ilo_unemployment || {}).female || []).slice(-1)[0] || null;

  let latest = '';
  if (muLatest) latest = muLatest.month;
  if (partLatest && (!latest || partLatest.quarter > latest)) latest = partLatest.quarter;

  const monthlyTiles = [];
  if (muLatest) {
    monthlyTiles.push(
      tile('Unemployment rate — monthly', 'Seasonally adjusted monthly unemployment rate, ages 15–74 (CSO MUM01)', [
        { label: 'Rate', value: fmtPctV(muLatest.value), dir: '' },
        { label: 'M-o-M', value: fmtDelta(muLatest.mom), dir: muLatest.mom < 0 ? 'down' : 'up' },
        { label: 'Y-o-Y', value: fmtDelta(muLatest.yoy), dir: muLatest.yoy < 0 ? 'down' : 'up' },
      ])
    );
  }
  if (youthLatest) {
    monthlyTiles.push(
      tile('Youth unemployment — monthly', 'Seasonally adjusted monthly unemployment rate, ages 15–24 (CSO MUM01)', [
        { label: 'Rate', value: fmtPctV(youthLatest.value), dir: '' },
        { label: 'M-o-M', value: fmtDelta(youthLatest.mom), dir: youthLatest.mom < 0 ? 'down' : 'up' },
        { label: 'Y-o-Y', value: fmtDelta(youthLatest.yoy), dir: youthLatest.yoy < 0 ? 'down' : 'up' },
      ])
    );
  }
  const quarterlyTiles = [];
  if (iloLatest) {
    quarterlyTiles.push(
      tile('ILO unemployment rate', 'ILO unemployment rate, ages 15–74, seasonally adjusted (CSO QLF02)', [
        { label: 'Rate', value: fmtPctV(iloLatest.value), dir: '' },
        { label: 'Q-o-Q', value: fmtDelta(iloLatest.qoq), dir: iloLatest.qoq < 0 ? 'down' : 'up' },
        { label: 'Y-o-Y', value: fmtDelta(iloLatest.yoy), dir: iloLatest.yoy < 0 ? 'down' : 'up' },
      ])
    );
  }
  if (partLatest) {
    quarterlyTiles.push(
      tile('Participation rate', 'ILO participation rate, ages 15 and over, seasonally adjusted (CSO QLF02)', [
        { label: 'Rate', value: fmtPctV(partLatest.value), dir: '' },
        { label: 'Q-o-Q', value: fmtDelta(partLatest.qoq), dir: partLatest.qoq < 0 ? 'down' : 'up' },
        { label: 'Y-o-Y', value: fmtDelta(partLatest.yoy), dir: partLatest.yoy < 0 ? 'down' : 'up' },
      ])
    );
  }
  if (iloMale && iloFemale) {
    quarterlyTiles.push(
      tile('Unemployment by sex', 'ILO unemployment rate by sex, ages 15–74, seasonally adjusted (CSO QLF02)', [
        { label: 'Male', value: fmtPctV(iloMale.value), dir: '' },
        { label: 'Female', value: fmtPctV(iloFemale.value), dir: '' },
      ])
    );
  }

  let forecastHtml = '';
  if (typeof FORECAST_DATA !== 'undefined' && FORECAST_DATA.series && FORECAST_DATA.series.Unemployment) {
    const pts = FORECAST_DATA.series.Unemployment.filter((p) => p.forecast && p.value !== null).slice(0, 3);
    if (pts.length) {
      const cells = pts.map((p) => ({ label: p.year, value: fmtPctV(p.value), dir: '' }));
      forecastHtml = tile('Unemployment rate — forecast', 'Central Bank of Ireland Quarterly Bulletin forecasts, unemployment rate', cells);
    }
  }

  host.innerHTML =
    (monthlyTiles.length ? `<div class="kpi-heading">Monthly unemployment (CSO MUM01)</div><div class="kpis">${monthlyTiles.join('')}</div>` : '') +
    (quarterlyTiles.length ? `<div class="kpi-heading">ILO labour market, ${partLatest ? partLatest.quarter : ''} (CSO QLF02)</div><div class="kpis">${quarterlyTiles.join('')}</div>` : '') +
    (forecastHtml ? `<div class="kpi-heading">Annual forecasts</div><div class="kpis">${forecastHtml}</div>` : '');

  const badge = document.getElementById('labour-updated');
  if (badge && latest) badge.textContent = `Data through ${latest}`;
}

function initCharts() {
  if (typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const L = LABOUR_DATA;

  // Chart 1: monthly unemployment, 5 years, total + youth
  const ctx1 = document.getElementById('unemployment-chart');
  if (ctx1) {
    const mu = ((L.monthly_unemployment || {})['15-74'] || {}).both || [];
    const youth = ((L.monthly_unemployment || {})['15-24'] || {}).both || [];
    const datasets = [];
    const palette = { '15–74 rate': '#009a44', '15–24 rate': '#c28a00' };
    for (const [key, data, label] of [
      [mu, '15–74 rate', 'Unemployment rate (15–74)'],
      [youth, '15–24 rate', 'Youth unemployment (15–24)'],
    ].map(([d, k, l]) => [k, lastNYearsMonthly(d, 5), l])) {
      if (!data.length) continue;
      datasets.push(
        nvLineDataset(
          label,
          data.map((d) => ({ x: monthToDate(d.month).getTime(), y: d.value })),
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
    config.options.scales.x.time.tooltipFormat = 'MMM yyyy';
    config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
    config.options.plugins.tooltip.callbacks = {
      title: (items) => {
        const d = new Date(items[0].parsed.x);
        return d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      },
      label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
    };
    new Chart(ctx1, config);
  }

  // Chart 2: participation + ILO unemployment, 5 years
  const ctx2 = document.getElementById('participation-chart');
  if (ctx2) {
    const part = (L.participation || {}).both || [];
    const ilo = (L.ilo_unemployment || {}).both || [];
    const datasets = [];
    if (part.length) {
      datasets.push(
        nvLineDataset(
          'Participation rate (15+)',
          lastNYearsQuarterly(part, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#0e5c8a', fill: false }
        )
      );
    }
    if (ilo.length) {
      datasets.push(
        nvLineDataset(
          'Unemployment rate (15–74)',
          lastNYearsQuarterly(ilo, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#009a44', fill: false }
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
    config.options.scales.x.time.tooltipFormat = 'yyyy QQQ';
    config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
    config.options.plugins.tooltip.callbacks = {
      title: (items) => {
        const d = new Date(items[0].parsed.x);
        return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
      },
      label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
    };
    new Chart(ctx2, config);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initHighlights();
  initCharts();
});
