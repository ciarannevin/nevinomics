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

function sectorLabel(s) {
  return s
    .replace(/\s*\([A-Z0-9]+(?: to [A-Z0-9]+)?\)\s*$/, '')
    .replace('Public administration and defence; compulsory social security', 'Public administration and defence')
    .replace('Public Administration and Defence; Compulsory Social Security', 'Public administration and defence')
    .replace('Wholesale and retail trade; repair of motor vehicles and motorcycles', 'Wholesale and retail trade')
    .replace('Wholesale and Retail Trade', 'Wholesale and retail trade')
    .replace('Professional, scientific and technical activities', 'Professional, scientific and technical')
    .replace('Professional, Scientific and Technical Activities', 'Professional, scientific and technical')
    .replace('Administrative and support service activities', 'Administrative and support services')
    .replace('Administrative and Support Service Activities', 'Administrative and support services')
    .replace('Publishing, Broadcasting, and Content Production and Distribution Activities', 'Publishing and broadcasting')
    .replace('Telecommunication, Computer Programming, Consulting, Computing Infrastructure and Other Information Service Activities', 'Telecom and computer services')
    .replace('Human health and social work activities', 'Human health and social work')
    .replace('Human Health and Social Work Activities', 'Human health and social work')
    .replace('Accommodation and food service activities', 'Accommodation and food service')
    .replace('Accommodation and Food Service Activities', 'Accommodation and food service')
    .replace('Transportation and storage', 'Transportation and storage')
    .replace('Transportation and Storage', 'Transportation and storage');
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
    const comp = (FORECAST_DATA.series['Compensation per employee'] || []).filter((p) => p.forecast && p.value !== null).slice(0, 3);
    if (comp.length) {
      forecastTiles.push(
        tile('Compensation per employee — forecast', 'Central Bank of Ireland Quarterly Bulletin forecasts, annual growth in compensation per employee (%)', comp.map((p) => ({ label: p.year, value: `${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%`, dir: p.value < 0 ? 'down' : 'up' })))
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
      options: nvBaseOptions(),
      plugins: [nevinomicsWatermark],
    };
    config.options.scales.y.title = { display: true, text: '%' };
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
      options: nvBaseOptions(),
      plugins: [nevinomicsWatermark],
    };
    config.options.scales.y.title = { display: true, text: '%' };
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
          { color: '#009a44', fill: false }
        )
      );
    }
    if (partM.length) {
      datasets.push(
        nvLineDataset(
          'Male (15+)',
          lastNYearsQuarterly(partM, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
          { color: '#0e5c8a', fill: false }
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
      options: nvBaseOptions(),
      plugins: [nevinomicsWatermark],
    };
    config.options.scales.y.title = { display: true, text: '%' };
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

function setBadge(id, text) {
  const el = document.getElementById(id);
  if (el && text) el.textContent = text;
}

function initChartBadges() {
  if (typeof LABOUR_DATA === 'undefined') return;
  const L = LABOUR_DATA;
  const mu = ((L.monthly_unemployment || {})['15-74'] || {}).both || [];
  if (mu.length) setBadge('unemployment-updated', monthLabel(mu[mu.length - 1].month));
  const ilo = (L.ilo_unemployment || {}).both || [];
  if (ilo.length) setBadge('ilo-unemployment-updated', ilo[ilo.length - 1].quarter);
  const demo = L.demographics || {};
  for (const key of ['sex', 'age', 'education']) {
    const b = demo[key];
    if (b && b.quarter) setBadge(`demo-${key}-updated`, b.quarter);
  }
  const part = (L.participation || {}).both || [];
  if (part.length) setBadge('participation-updated', part[part.length - 1].quarter);
  const emp = (L.employment_levels || {}).both || [];
  if (emp.length) setBadge('employment-updated', emp[emp.length - 1].quarter);
  const hrs = (L.hours || {}).both || [];
  if (hrs.length) setBadge('hours-updated', hrs[hrs.length - 1].quarter);
  if (L.sector_change && L.sector_change.quarter) setBadge('sector-updated', L.sector_change.quarter);
  if (L.sector_earnings && L.sector_earnings.quarter) setBadge('sector-earnings-updated', L.sector_earnings.quarter);
  if (L.earnings && L.earnings.length) setBadge('hourly-earnings-updated', L.earnings[L.earnings.length - 1].quarter);
  if (L.labour_costs && L.labour_costs.length) setBadge('labour-costs-updated', L.labour_costs[L.labour_costs.length - 1].quarter);
  if (L.occupation_earnings && L.occupation_earnings.quarter) setBadge('occupation-earnings-updated', L.occupation_earnings.quarter);
  if (L.vacancies && L.vacancies.overall && L.vacancies.overall.length) {
    setBadge('vacancies-updated', L.vacancies.overall[L.vacancies.overall.length - 1].quarter);
    setBadge('vacancy-rates-updated', L.vacancies.quarter);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initHighlights();
  initChartBadges();
  initCharts();
  initSectorChart();
  initEmploymentChart();
  initHoursChart();
  initDemographicsCharts();
  initEarningsChart();
  initSectorEarningsChart();
  initOccupationEarningsChart();
  initLabourCostsChart();
  initVacanciesChart();
  initVacancyRatesChart();
});

function initSectorChart() {
  const ctx = document.getElementById('sector-chart');
  const sc = typeof LABOUR_DATA !== 'undefined' ? LABOUR_DATA.sector_change : null;
  if (!ctx || typeof Chart === 'undefined' || !sc || !sc.sectors || !sc.sectors.length) return;

  const label = sectorLabel;
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
      layout: { padding: { left: 8 } },
      scales: {
        x: {
          ticks: { callback: (v) => v.toLocaleString('en-IE'), color: NEVINOMICS.muted },
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: { display: true, text: 'Thousands of persons' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#16241c', font: { size: 11 }, autoSkip: false, autoSkipPadding: 0 },
        },
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (item) => {
              if (item.dataset.type === 'scatter') {
                const v = item.parsed.x;
                return `${item.dataset.label}: ${v >= 0 ? '+' : ''}${v.toLocaleString('en-IE', { maximumFractionDigits: 1 })} thousand`;
              }
              const r = item.raw.x;
              return `${item.dataset.label}: ${r[0].toLocaleString('en-IE', { maximumFractionDigits: 1 })} to +${r[1].toLocaleString('en-IE', { maximumFractionDigits: 1 })}`;
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
    options: nvBaseOptions((v) => v.toLocaleString('en-IE')),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.y.title = { display: true, text: 'Thousands of persons' };
  config.options.scales.x.time.unit = 'year';
  config.options.scales.x.time.tooltipFormat = 'yyyy QQQ';
  config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
  config.options.plugins.tooltip.callbacks = {
    title: (items) => {
      const d = new Date(items[0].parsed.x);
      return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    },
    label: (item) => `${item.dataset.label}: ${item.parsed.y.toLocaleString('en-IE', { maximumFractionDigits: 1 })} thousand`,
  };
  new Chart(ctx, config);
}

function initHoursChart() {
  const ctx = document.getElementById('hours-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const hours = LABOUR_DATA.hours;
  if (!hours) return;

  const palette = { both: '#009a44', male: '#0e5c8a', female: '#c28a00' };
  const names = { both: 'All', male: 'Male', female: 'Female' };
  const datasets = [];
  for (const key of ['both', 'male', 'female']) {
    const series = hours[key] || [];
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
    options: nvBaseOptions(),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.y.title = { display: true, text: 'Hours per week' };
  config.options.scales.x.time.unit = 'year';
  config.options.scales.x.time.tooltipFormat = 'yyyy QQQ';
  config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
  config.options.plugins.tooltip.callbacks = {
    title: (items) => {
      const d = new Date(items[0].parsed.x);
      return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    },
    label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)} hours`,
  };
  new Chart(ctx, config);
}

function rangePlotConfig(breakdown, labelFmt, opts = {}) {
  const groups = [...breakdown.groups].reverse();
  const labels = groups.map((g) => labelFmt(g.group));
  const isChange = groups.some((g) => g.change !== undefined);
  const dotLabel = opts.dotLabel || `Latest value, ${breakdown.quarter}`;
  const data = {
    labels,
    datasets: [
      {
        label: 'Range of rates, past 5 years',
        data: groups.map((g) =>
          g.min5 === null || g.max5 === null ? null : { x: [g.min5, g.max5], y: labelFmt(g.group) }
        ),
        backgroundColor: 'rgba(0,154,68,0.14)',
        borderColor: 'rgba(0,154,68,0.35)',
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
      },
      {
        label: dotLabel,
        type: 'scatter',
        data: groups.map((g) => ({ x: g.change !== undefined ? g.change : g.rate, y: labelFmt(g.group) })),
        backgroundColor: (ctx) => {
          const v = ctx.raw ? ctx.raw.x : 0;
          return v >= 0 ? '#009a44' : '#c0392b';
        },
        pointRadius: 5,
        pointHoverRadius: 7,
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
      layout: { padding: { left: 8 } },
      scales: {
        x: {
          ticks: { color: NEVINOMICS.muted },
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: { display: true, text: '%' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#16241c', font: { size: 11 }, autoSkip: false, autoSkipPadding: 0 },
        },
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (item) => {
              if (item.dataset.type === 'scatter') {
                const v = item.parsed.x;
                return `${item.dataset.label}: ${isChange && v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
              }
              const r = item.raw.x;
              return `${item.dataset.label}: ${r[0].toFixed(1)}% to ${r[1].toFixed(1)}%`;
            },
          },
        },
      },
    },
    plugins: [nevinomicsWatermark],
  };
  return config;
}

function initDemographicsCharts() {
  if (typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const demo = LABOUR_DATA.demographics;
  if (!demo) return;

  const specs = [
    { key: 'sex', id: 'demo-sex-chart', fmt: (g) => g },
    { key: 'age', id: 'demo-age-chart', fmt: (g) => g.replace(' years', '').replace(' and over', '+') },
    { key: 'education', id: 'demo-edu-chart', fmt: (g) => g.replace('Third level honours degree or higher', 'Third level (honours)+').replace('Third level non-honours degree', 'Third level (non-honours)') },
  ];
  for (const spec of specs) {
    const ctx = document.getElementById(spec.id);
    const breakdown = demo[spec.key];
    if (!ctx || !breakdown || !breakdown.groups || !breakdown.groups.length) continue;
    new Chart(ctx, rangePlotConfig(breakdown, spec.fmt, { dotLabel: `Unemployment rate, ${breakdown.quarter}` }));
  }
}

function initEarningsChart() {
  const ctx = document.getElementById('earnings-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const earnings = LABOUR_DATA.earnings;
  if (!earnings || !earnings.length) return;

  const five = lastNYearsQuarterly(earnings, 5);
  const level = nvLineDataset(
    'Average hourly earnings (€)',
    five.map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
    { color: '#009a44', fill: false }
  );
  const change = nvLineDataset(
    'Quarterly change (%)',
    five.filter((d) => d.qoq !== null).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.qoq })),
    { color: '#c28a00', fill: false }
  );
  change.yAxisID = 'yChange';

  const config = {
    type: 'line',
    data: { datasets: [level, change] },
    options: nvBaseOptions((v) => v.toLocaleString('en-IE', { maximumFractionDigits: 2 })),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.y.title = { display: true, text: '€ per hour' };
  config.options.scales.yChange = {
    position: 'right',
    ticks: { callback: (v) => `${v}`, color: NEVINOMICS.muted },
    grid: { drawOnChartArea: false },
    title: { display: true, text: 'Quarterly change, %' },
  };
  config.options.scales.x.time.unit = 'year';
  config.options.scales.x.time.tooltipFormat = 'yyyy QQQ';
  config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
  config.options.plugins.tooltip.callbacks = {
    title: (items) => {
      const d = new Date(items[0].parsed.x);
      return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    },
    label: (item) => {
      const v = item.parsed.y;
      return item.dataset.yAxisID === 'yChange'
        ? `${item.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
        : `${item.dataset.label}: €${v.toFixed(2)}`;
    },
  };
  new Chart(ctx, config);
}

function initSectorEarningsChart() {
  const ctx = document.getElementById('sector-earnings-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const se = LABOUR_DATA.sector_earnings;
  if (!se || !se.sectors || !se.sectors.length) return;

  const label = sectorLabel;
  const sectors = [...se.sectors].reverse();
  const data = {
    labels: sectors.map((s) => label(s.sector)),
    datasets: [
      {
        label: '5-year range of annual changes',
        data: sectors.map((s) =>
          s.min5 === null || s.max5 === null ? null : { x: [s.min5, s.max5], y: label(s.sector) }
        ),
        backgroundColor: 'rgba(0,154,68,0.14)',
        borderColor: 'rgba(0,154,68,0.35)',
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
      },
      {
        label: `Year-on-year, ${se.quarter}`,
        type: 'scatter',
        data: sectors.map((s) => ({ x: s.change, y: label(s.sector) })),
        backgroundColor: sectors.map((s) => (s.change >= 0 ? '#009a44' : '#c0392b')),
        pointRadius: 5,
        pointHoverRadius: 7,
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
          ticks: { callback: (v) => `${v}`, color: NEVINOMICS.muted },
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: { display: true, text: 'Year-on-year change, %' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#16241c', font: { size: 11 }, autoSkip: false, autoSkipPadding: 0 },
        },
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (item) => {
              if (item.dataset.type === 'scatter') {
                const v = item.parsed.x;
                return `${item.dataset.label}: ${isChange && v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
              }
              const r = item.raw.x;
              return `${item.dataset.label}: ${r[0].toFixed(1)}% to ${r[1].toFixed(1)}%`;
            },
          },
        },
      },
    },
    plugins: [nevinomicsWatermark],
  };
  new Chart(ctx, config);
}


function initOccupationEarningsChart() {
  const ctx = document.getElementById('occupation-earnings-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const oe = LABOUR_DATA.occupation_earnings;
  if (!oe || !oe.groups || !oe.groups.length) return;

  const fmt = (g) =>
    g
      .replace('Managers, professionals and associated professionals', 'Managers, professionals')
      .replace('Clerical, sales and service employees', 'Clerical, sales and service')
      .replace('Production, transport, craft and other manual workers', 'Production, transport, craft');
  const config = rangePlotConfig(oe, fmt);
  config.data.datasets[0].label = '5-year range of annual changes';
  config.data.datasets[1].label = `Year-on-year, ${oe.quarter}`;
  config.options.scales.x.title.text = 'Year-on-year change, %';
  new Chart(ctx, config);
}

function initLabourCostsChart() {
  const ctx = document.getElementById('labour-costs-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const lc = LABOUR_DATA.labour_costs;
  if (!lc || !lc.length) return;

  const five = lastNYearsQuarterly(lc, 5);
  const level = nvLineDataset(
    'Other labour costs (€ per hour)',
    five.map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
    { color: '#009a44', fill: false }
  );
  const change = nvLineDataset(
    'Quarterly change (%)',
    five.filter((d) => d.qoq !== null).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.qoq })),
    { color: '#c28a00', fill: false }
  );
  change.yAxisID = 'yChange';

  const config = {
    type: 'line',
    data: { datasets: [level, change] },
    options: nvBaseOptions((v) => v.toLocaleString('en-IE', { maximumFractionDigits: 2 })),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.y.title = { display: true, text: '€ per hour' };
  config.options.scales.yChange = {
    position: 'right',
    ticks: { color: NEVINOMICS.muted },
    grid: { drawOnChartArea: false },
    title: { display: true, text: 'Quarterly change, %' },
  };
  config.options.scales.x.time.unit = 'year';
  config.options.scales.x.time.tooltipFormat = 'yyyy QQQ';
  config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
  config.options.plugins.tooltip.callbacks = {
    title: (items) => {
      const d = new Date(items[0].parsed.x);
      return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    },
    label: (item) => {
      const v = item.parsed.y;
      return item.dataset.yAxisID === 'yChange'
        ? `${item.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
        : `${item.dataset.label}: €${v.toFixed(2)}`;
    },
  };
  new Chart(ctx, config);
}

function initVacanciesChart() {
  const ctx = document.getElementById('vacancies-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const va = LABOUR_DATA.vacancies;
  if (!va || !va.overall || !va.overall.length) return;

  const five = lastNYearsQuarterly(va.overall, 5);
  const dataset = nvLineDataset(
    'Job vacancy rate, all sectors',
    five.map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
    { color: '#009a44', fill: false }
  );
  const config = {
    type: 'line',
    data: { datasets: [dataset] },
    options: nvBaseOptions(),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.y.title = { display: true, text: '%' };
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
  new Chart(ctx, config);
}

function initVacancyRatesChart() {
  const ctx = document.getElementById('vacancy-rates-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const va = LABOUR_DATA.vacancies;
  if (!va || !va.sectors || !va.sectors.length) return;

  const label = sectorLabel;
  const sectors = [...va.sectors].reverse();
  const data = {
    labels: sectors.map((s) => label(s.sector)),
    datasets: [
      {
        label: `Year-on-year change, ${va.quarter} (pp)`,
        data: sectors.map((s) => ({ x: s.yoy, y: label(s.sector) })),
        backgroundColor: sectors.map((s) => ((s.yoy ?? 0) >= 0 ? 'rgba(0,154,68,0.35)' : 'rgba(192,57,43,0.35)')),
        borderColor: sectors.map((s) => ((s.yoy ?? 0) >= 0 ? 'rgba(0,154,68,0.8)' : 'rgba(192,57,43,0.8)')),
        borderWidth: 1,
        borderRadius: 3,
        order: 2,
      },
      {
        label: `Quarter-on-quarter change, ${va.quarter} (pp)`,
        type: 'scatter',
        data: sectors.map((s) => ({ x: s.qoq, y: label(s.sector) })),
        backgroundColor: '#0e5c8a',
        pointRadius: 5,
        pointHoverRadius: 7,
        order: 1,
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
      layout: { padding: { left: 8 } },
      scales: {
        x: {
          ticks: { color: NEVINOMICS.muted },
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: { display: true, text: 'Change in vacancy rate, pp' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#16241c', font: { size: 11 }, autoSkip: false, autoSkipPadding: 0 },
        },
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (item) => {
              const v = item.parsed.x;
              return `${item.dataset.label}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}pp`;
            },
          },
        },
      },
    },
    plugins: [nevinomicsWatermark],
  };
  new Chart(ctx, config);
}
