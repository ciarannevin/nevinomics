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

function monthLabel(m) {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1));
  return d.toLocaleDateString('en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
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

  const forecastTiles = [];
  if (typeof FORECAST_DATA !== 'undefined' && FORECAST_DATA.series) {
    const un = (FORECAST_DATA.series.Unemployment || []).filter((p) => p.forecast && p.value !== null).slice(0, 3);
    if (un.length) {
      forecastTiles.push(
        tile('Unemployment rate — forecast', 'Central Bank of Ireland Quarterly Bulletin forecasts, unemployment rate (%)', un.map((p) => ({ label: p.year, value: fmtPctV(p.value), dir: '' })))
      );
    }
    const emp = (FORECAST_DATA.series.Employment || []).filter((p) => p.forecast && p.value !== null).slice(0, 3);
    if (emp.length) {
      forecastTiles.push(
        tile('Total employment — forecast', 'Central Bank of Ireland Quarterly Bulletin forecasts, annual growth in total employment (%)', emp.map((p) => ({ label: p.year, value: `${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%`, dir: p.value < 0 ? 'down' : 'up' })))
      );
    }
  }

  host.innerHTML =
    (monthlyTiles.length ? `<div class="kpi-heading">Monthly unemployment, ${muLatest ? monthLabel(muLatest.month) : ''} (CSO MUM01)</div><div class="kpis">${monthlyTiles.join('')}</div>` : '') +
    (quarterlyTiles.length ? `<div class="kpi-heading">ILO labour market, ${partLatest ? partLatest.quarter : ''} (CSO QLF02)</div><div class="kpis">${quarterlyTiles.join('')}</div>` : '') +
    (forecastTiles.length ? `<div class="kpi-heading">Annual forecasts (Central Bank of Ireland)</div><div class="kpis">${forecastTiles.join('')}</div>` : '');

  const badge = document.getElementById('labour-updated');
  if (badge) badge.textContent = '';
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

  // Chart 2: ILO unemployment rate, total + by sex, 5 years
  const ctx2 = document.getElementById('ilo-unemployment-chart');
  if (ctx2) {
    const ilo = (L.ilo_unemployment || {}).both || [];
    const iloM = (L.ilo_unemployment || {}).male || [];
    const iloF = (L.ilo_unemployment || {}).female || [];
    const datasets = [];
    if (ilo.length) {
      datasets.push(
        nvLineDataset(
          'Unemployment rate (15–74, all)',
          lastNYearsQuarterly(ilo, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#009a44', fill: false }
        )
      );
    }
    if (iloM.length) {
      datasets.push(
        nvLineDataset(
          'Male (15–74)',
          lastNYearsQuarterly(iloM, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#0e5c8a', fill: false }
        )
      );
    }
    if (iloF.length) {
      datasets.push(
        nvLineDataset(
          'Female (15–74)',
          lastNYearsQuarterly(iloF, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#c28a00', fill: false }
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

  // Chart 3: participation rate, total + by sex, 5 years
  const ctx3 = document.getElementById('participation-chart');
  if (ctx3) {
    const part = (L.participation || {}).both || [];
    const partM = (L.participation || {}).male || [];
    const partF = (L.participation || {}).female || [];
    const datasets = [];
    if (part.length) {
      datasets.push(
        nvLineDataset(
          'Participation rate (all, 15+)',
          lastNYearsQuarterly(part, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#0e5c8a', fill: false }
        )
      );
    }
    if (partM.length) {
      datasets.push(
        nvLineDataset(
          'Male (15+)',
          lastNYearsQuarterly(partM, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#009a44', fill: false }
        )
      );
    }
    if (partF.length) {
      datasets.push(
        nvLineDataset(
          'Female (15+)',
          lastNYearsQuarterly(partF, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#c28a00', fill: false }
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
    new Chart(ctx3, config);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initHighlights();
  initCharts();
  initSectorChart();
  initEmploymentChart();
});

function initSectorChart() {
  const ctx = document.getElementById('sector-chart');
  const sc = typeof LABOUR_DATA !== 'undefined' ? LABOUR_DATA.sector_change : null;
  const badge = document.getElementById('sector-updated');
  if (badge && sc && sc.quarter) badge.textContent = sc.quarter;
  if (!ctx || typeof Chart === 'undefined' || !sc || !sc.sectors || !sc.sectors.length) return;

  const label = (s) => s.replace(/\s*\([A-Z0-9]+(?: to [A-Z0-9]+)?\)\s*$/, '');
  const sectors = [...sc.sectors].reverse();
  const range = (s) => (s.min5 === null || s.max5 === null ? null : [s.min5, s.max5]);
  const data = {
    labels: sectors.map((s) => label(s.sector)),
    datasets: [
      {
        label: '5-year range of quarterly changes',
        data: sectors.map((s) => {
          const r = range(s);
          return r ? { x: [r[0], r[1]], y: label(s.sector) } : null;
        }),
        backgroundColor: 'rgba(0,154,68,0.14)',
        borderColor: 'rgba(0,154,68,0.35)',
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
      },
      {
        label: `Latest quarter (${sc.quarter})`,
        type: 'scatter',
        data: sectors.map((s) => ({ x: s.change, y: label(s.sector) })),
        backgroundColor: sectors.map((s) => (s.change >= 0 ? '#009a44' : '#c0392b')),
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };
  const config = {
    type: 'bar',
    data,
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          ticks: { callback: (v) => `${v}k`, color: NEVINOMICS.muted },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        y: { grid: { display: false }, ticks: { color: '#16241c', font: { size: 11 } } },
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (item) => {
              if (item.dataset.type === 'scatter') {
                const v = item.parsed.x;
                return `${item.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}k`;
              }
              const r = item.raw.x;
              return `${item.dataset.label}: ${r[0] >= 0 ? '+' : ''}${r[0].toFixed(1)}k to ${r[1] >= 0 ? '+' : ''}${r[1].toFixed(1)}k`;
            },
          },
        },
      },
    },
    plugins: [nevinomicsWatermark],
  };
  new Chart(ctx, config);
}

function initEmploymentChart() {
  const ctx = document.getElementById('employment-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const levels = LABOUR_DATA.employment_levels;
  if (!levels) return;

  const palette = { both: '#009a44', male: '#0e5c8a', female: '#c28a00' };
  const names = { both: 'Total', male: 'Male', female: 'Female' };
  const datasets = [];
  for (const key of ['both', 'male', 'female']) {
    const series = levels[key] || [];
    if (!series.length) continue;
    datasets.push(
      nvLineDataset(
        names[key],
        lastNYearsQuarterly(series, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
        { color: palette[key], fill: false }
      )
    );
  }
  const config = {
    type: 'line',
    data: { datasets },
    options: nvBaseOptions((v) => `${Math.round(v)}k`),
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
    label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}k`,
  };
  new Chart(ctx, config);
}
