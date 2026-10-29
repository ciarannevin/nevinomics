'use strict';











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
    (monthlyTiles.length ? `<div class="kpi-heading-row"><span class="kpi-heading">Monthly unemployment (CSO MUM01)</span><span class="badge live">${muLatest ? monthLabel(muLatest.month) : ''}</span></div><div class="kpis">${monthlyTiles.join('')}</div>` : '') +
    (quarterlyTiles.length ? `<div class="kpi-heading-row"><span class="kpi-heading">ILO labour market (CSO QLF02)</span><span class="badge live">${partLatest ? partLatest.quarter : ''}</span></div><div class="kpis">${quarterlyTiles.join('')}</div>` : '') +
    (forecastTiles.length ? `<div class="kpi-heading-row"><span class="kpi-heading">Annual forecasts (Central Bank of Ireland)</span><span class="badge live">${bulletinName()}</span></div><div class="kpis">${forecastTiles.join('')}</div>` : '');

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
    if (mu.length) {
      datasets.push(nvLineDataset('Unemployment rate (15-74)', lastNYearsMonthly(mu, 5).map((d) => ({ x: monthToDate(d.month).getTime(), y: d.value })), { color: '#009a44', fill: false }));
    }
    if (youth.length) {
      datasets.push(nvLineDataset('Youth unemployment (15-24)', lastNYearsMonthly(youth, 5).map((d) => ({ x: monthToDate(d.month).getTime(), y: d.value })), { color: '#c28a00', fill: false }));
    }
    const config = quarterlyLineConfig(datasets, {
      yTitle: '%',
      tooltipFormat: 'MMM yyyy',
      tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
    });
    config.options.plugins.tooltip.callbacks.title = (items) => {
      const d = new Date(items[0].parsed.x);
      return d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    };
    new Chart(ctx1, config);
  }

  // Chart 2: ILO unemployment rate by sex
  const ctx2 = document.getElementById('ilo-unemployment-chart');
  if (ctx2) {
    const datasets = sexDatasets(L.ilo_unemployment);
    new Chart(ctx2, quarterlyLineConfig(datasets, { yTitle: '%', tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%` }));
  }

  // Chart 3: participation rate by sex
  const ctx3 = document.getElementById('participation-chart');
  if (ctx3) {
    const datasets = sexDatasets(L.participation, { allLabel: 'Participation rate (all, 15+)', suffix: ' (15+)' });
    new Chart(ctx3, quarterlyLineConfig(datasets, { yTitle: '%', tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%` }));
  }
}

function sexDatasets(seriesMap, opts = {}) {
  const palette = { both: '#009a44', male: '#0e5c8a', female: '#c28a00' };
  const names = { both: opts.allLabel || 'All', male: 'Male', female: 'Female' };
  const datasets = [];
  for (const key of ['both', 'male', 'female']) {
    const series = (seriesMap || {})[key] || [];
    if (!series.length) continue;
    datasets.push(
      nvLineDataset(
        names[key] + (opts.suffix || ''),
        lastNYearsQuarterly(series, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
        { color: palette[key], fill: false }
      )
    );
  }
  return datasets;
}

function initChartBadges() {
  if (typeof LABOUR_DATA === 'undefined') return;
  const L = LABOUR_DATA;
  const mu = ((L.monthly_unemployment || {})['15-74'] || {}).both || [];
  if (mu.length) setBadge('unemployment-updated', monthLabel(mu[mu.length - 1].month));
  const ilo = (L.ilo_unemployment || {}).both || [];
  if (ilo.length) setBadge('ilo-unemployment-updated', ilo[ilo.length - 1].quarter);
  const demo = L.demographics || {};
  for (const [key, id] of [['sex', 'demo-sex-updated'], ['age', 'demo-age-updated'], ['education', 'demo-edu-updated']]) {
    const b = demo[key];
    if (b && b.quarter) setBadge(id, b.quarter);
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
  const config = rangePlotConfig(sc, sectorLabel, {
    barLabel: '5-year range of quarterly changes',
    dotLabel: `Latest quarter (${sc.quarter})`,
    xTitle: 'Thousands of persons',
    dotUnit: 'k',
  });
  new Chart(ctx, config);
}

function initEmploymentChart() {
  const ctx = document.getElementById('employment-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const levels = LABOUR_DATA.employment_levels;
  if (!levels) return;
  const datasets = sexDatasets(levels, { allLabel: 'Total' });
  const config = quarterlyLineConfig(datasets, {
    yTitle: 'Thousands of persons',
    yTicks: (v) => v.toLocaleString('en-IE'),
    tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toLocaleString('en-IE', { maximumFractionDigits: 1 })} thousand`,
  });
  new Chart(ctx, config);
}

function initHoursChart() {
  const ctx = document.getElementById('hours-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const hours = LABOUR_DATA.hours;
  if (!hours) return;
  const datasets = sexDatasets(hours, { allLabel: 'All' });
  const config = quarterlyLineConfig(datasets, {
    yTitle: 'Hours per week',
    tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)} hours`,
  });
  new Chart(ctx, config);
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
    new Chart(ctx, rangePlotConfig(breakdown, spec.fmt, { dotLabel: `Unemployment rate, ${breakdown.quarter}`, xTitle: '%' }));
  }
}

function initEarningsChart() {
  const ctx = document.getElementById('earnings-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const earnings = LABOUR_DATA.earnings;
  if (!earnings || !earnings.length) return;
  new Chart(ctx, dualAxisLevelChangeConfig(earnings, {
    levelLabel: 'Average hourly earnings (€)',
    yTitle: '€ per hour',
    levelFmt: (v) => `€${v.toFixed(2)}`,
  }));
}

function initLabourCostsChart() {
  const ctx = document.getElementById('labour-costs-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const lc = LABOUR_DATA.labour_costs;
  if (!lc || !lc.length) return;
  new Chart(ctx, dualAxisLevelChangeConfig(lc, {
    levelLabel: 'Other labour costs (€ per hour)',
    yTitle: '€ per hour',
    levelFmt: (v) => `€${v.toFixed(2)}`,
  }));
}

function dualAxisLevelChangeConfig(records, opts = {}) {
  const five = lastNYearsQuarterly(records, 5);
  const level = nvLineDataset(
    opts.levelLabel,
    five.map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
    { color: '#009a44', fill: false }
  );
  const change = nvLineDataset(
    'Quarterly change (%)',
    five.filter((d) => d.qoq !== null).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.qoq })),
    { color: '#c28a00', fill: false }
  );
  change.yAxisID = 'yChange';
  const config = quarterlyLineConfig([level, change], {
    yTitle: opts.yTitle,
    yTicks: (v) => v.toLocaleString('en-IE', { maximumFractionDigits: 2 }),
    rightAxis: 'Quarterly change, %',
    tooltipLabel: (item) =>
      item.dataset.yAxisID === 'yChange'
        ? `${item.dataset.label}: ${item.parsed.y >= 0 ? '+' : ''}${item.parsed.y.toFixed(1)}%`
        : `${item.dataset.label}: ${opts.levelFmt ? opts.levelFmt(item.parsed.y) : item.parsed.y.toFixed(2)}`,
  });
  return config;
}

function initVacanciesChart() {
  const ctx = document.getElementById('vacancies-chart');
  if (!ctx || typeof Chart === 'undefined' || typeof LABOUR_DATA === 'undefined') return;
  const va = LABOUR_DATA.vacancies;
  if (!va || !va.overall || !va.overall.length) return;
  const dataset = nvLineDataset(
    'Job vacancy rate, all sectors',
    lastNYearsQuarterly(va.overall, 5).map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d.value })),
    { color: '#009a44', fill: false }
  );
  new Chart(ctx, quarterlyLineConfig([dataset], { yTitle: '%', tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%` }));
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
