'use strict';

function initPriceHighlights() {
  const host = document.getElementById('prices-highlights');
  if (!host || typeof PRICES_DATA === 'undefined') return;
  const P = PRICES_DATA;

  const cpi = P.cpi || [];
  const hicp = P.hicp || [];
  const cpiLatest = cpi.length ? cpi[cpi.length - 1] : null;
  const hicpLatest = hicp.length ? hicp[hicp.length - 1] : null;
  const coreEnergy = ((P.core || {}).excl_energy || {}).series || [];
  const coreEnergyLatest = coreEnergy.length ? coreEnergy[coreEnergy.length - 1] : null;

  const latestMonth = cpiLatest ? cpiLatest.month : '';

  const rateTiles = [];
  if (cpiLatest) {
    rateTiles.push(
      tile('CPI inflation', 'Consumer Price Index, annual rate of change, all items (CSO CPM20)', [
        { label: 'YoY', value: fmtPctV(cpiLatest.value), dir: cpiLatest.value >= 2 ? 'up' : 'down' },
        { label: 'M-o-M', value: `${cpiLatest.mom >= 0 ? '+' : ''}${cpiLatest.mom.toFixed(1)}%`, dir: cpiLatest.mom < 0 ? 'down' : 'up' },
      ])
    );
  }
  if (hicpLatest) {
    rateTiles.push(
      tile('HICP inflation', 'EU Harmonised Index of Consumer Prices, annual rate of change, all items (CSO CPM23)', [
        { label: 'YoY', value: fmtPctV(hicpLatest.value), dir: hicpLatest.value >= 2 ? 'up' : 'down' },
        { label: 'M-o-M', value: `${hicpLatest.mom >= 0 ? '+' : ''}${hicpLatest.mom.toFixed(1)}%`, dir: hicpLatest.mom < 0 ? 'down' : 'up' },
      ])
    );
  }
  if (coreEnergyLatest) {
    rateTiles.push(
      tile('CPI excluding energy', 'Consumer Price Index excluding energy products, annual rate of change (CSO CPM21)', [
        { label: 'YoY', value: fmtPctV(coreEnergyLatest.value), dir: coreEnergyLatest.value >= 2 ? 'up' : 'down' },
      ])
    );
  }

  const forecastTiles = [];
  if (typeof FORECAST_DATA !== 'undefined' && FORECAST_DATA.series) {
    for (const [key, label] of [
      ['HICP', 'HICP inflation — forecast'],
      ['Core HICP', 'Core HICP (excluding food and energy) — forecast'],
    ]) {
      const pts = (FORECAST_DATA.series[key] || []).filter((p) => p.forecast && p.value !== null).slice(0, 3);
      if (pts.length) {
        forecastTiles.push(
          tile(
            label,
            `Central Bank of Ireland Quarterly Bulletin forecasts, annual HICP inflation (%)`,
            pts.map((p) => ({ label: p.year, value: fmtPctV(p.value), dir: p.value >= 2 ? 'up' : '' }))
          )
        );
      }
    }
  }

  host.innerHTML =
    (rateTiles.length
      ? kpiHeadingRow('Inflation rates', latestMonth ? monthLabel(latestMonth) : '') + `<div class="kpis">${rateTiles.join('')}</div>`
      : '') +
    (forecastTiles.length
      ? kpiHeadingRow('Annual forecasts (Central Bank of Ireland)', bulletinName()) + `<div class="kpis">${forecastTiles.join('')}</div>`
      : '');
}

function initPriceCharts() {
  if (typeof Chart === 'undefined' || typeof PRICES_DATA === 'undefined') return;
  const P = PRICES_DATA;

  // 1. Headline: CPI vs HICP
  const ctx1 = document.getElementById('headline-chart');
  if (ctx1 && P.cpi && P.hicp) {
    const datasets = [];
    if (P.cpi.length) {
      datasets.push(nvLineDataset('CPI', P.cpi.map((d) => ({ x: monthToDate(d.month).getTime(), y: d.value })), { color: '#009a44', fill: false }));
    }
    if (P.hicp.length) {
      datasets.push(nvLineDataset('HICP', P.hicp.map((d) => ({ x: monthToDate(d.month).getTime(), y: d.value })), { color: '#0e5c8a', fill: false }));
    }
    const config = quarterlyLineConfig(datasets, {
      yTitle: 'Annual rate, %',
      tooltipFormat: 'MMM yyyy',
      tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
    });
    config.options.plugins.tooltip.callbacks.title = (items) => {
      const d = new Date(items[0].parsed.x);
      return d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    };
    new Chart(ctx1, config);
    if (P.cpi.length) setBadge('headline-updated', monthLabel(P.cpi[P.cpi.length - 1].month));
  }

  // 2. Inflation by commodity group (range plot)
  const ctx2 = document.getElementById('groups-chart');
  if (ctx2 && P.cpi_groups && P.cpi_groups.groups) {
    const fmt = (g) =>
      g
        .replace('Housing, water, electricity, gas and other fuels', 'Housing, water, electricity, gas & other fuels')
        .replace('Furnishings, household equipment and routine household maintenance', 'Furnishings & household equipment')
        .replace('Personal care, social protection and miscellaneous goods and services', 'Personal care & miscellaneous')
        .replace('Restaurants and accommodation services', 'Restaurants & accommodation')
        .replace('Alcoholic beverages, tobacco and narcotics', 'Alcohol & tobacco')
        .replace('Food and non-alcoholic beverages', 'Food & non-alcoholic beverages')
        .replace('Recreation, sport and culture', 'Recreation, sport & culture')
        .replace('Information and communication', 'Information & communication')
        .replace('Education services', 'Education')
        .replace('All Items', 'All items');
    const config = rangePlotConfig(P.cpi_groups, fmt, {
      dotLabel: 'Latest annual rate',
      xTitle: 'Annual rate, %',
      barLabel: '5-year range of annual rates',
    });
    config.data.datasets[1].label = 'Latest annual rate';
    new Chart(ctx2, config);
    setBadge('groups-updated', monthLabel(P.cpi_groups.month));
  }

  // 3. Contributions (horizontal bars)
  const ctx3 = document.getElementById('contributions-chart');
  if (ctx3 && P.contributions && P.contributions.groups) {
    const items = [...P.contributions.groups].reverse();
    const fmt = (g) =>
      g
        .replace('Housing, Water, Electricity, Gas and Other Fuels', 'Housing, water, electricity, gas & other fuels')
        .replace('Furnishings, Household Equipment and Routine Household Maintenance', 'Furnishings & household equipment')
        .replace('Personal Care, Social Protection and Miscellaneous Goods and Services', 'Personal care & miscellaneous')
        .replace('Restaurants and Accommodation Services', 'Restaurants & accommodation')
        .replace('Food and Non-Alcoholic Beverages', 'Food & non-alcoholic beverages')
        .replace('Alcoholic Beverages and Tobacco', 'Alcohol & tobacco')
        .replace('Recreation, Sport and Culture', 'Recreation, sport & culture')
        .replace('Information and Communication', 'Information & communication')
        .replace('Education Services', 'Education')
        .replace('Insurance and Financial Services', 'Insurance & financial services');
    const data = {
      labels: items.map((g) => fmt(g.group)),
      datasets: [
        {
          label: `Contribution, pp`,
          data: items.map((g) => g.contribution),
          backgroundColor: items.map((g) => (g.contribution >= 0 ? 'rgba(0,154,68,0.35)' : 'rgba(192,57,43,0.35)')),
          borderColor: items.map((g) => (g.contribution >= 0 ? 'rgba(0,154,68,0.8)' : 'rgba(192,57,43,0.8)')),
          borderWidth: 1,
          borderRadius: 3,
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
            ticks: { color: NEVINOMICS.muted, padding: 14 },
            grid: { color: 'rgba(0,0,0,0.05)' },
            title: { display: true, text: 'Contribution to annual CPI inflation, pp' },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#16241c', font: { size: 11 }, autoSkip: false, autoSkipPadding: 0 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.parsed.x >= 0 ? '+' : ''}${item.parsed.x.toFixed(2)}pp`,
            },
          },
        },
      },
      plugins: [nevinomicsWatermark],
    };
    new Chart(ctx3, config);
    setBadge('contributions-updated', monthLabel(P.contributions.month));
  }

  // 4. Core measures vs headline
  const ctx4 = document.getElementById('core-chart');
  if (ctx4 && P.cpi) {
    const datasets = [];
    if (P.cpi.length) {
      const headline = nvLineDataset('CPI (headline)', P.cpi.map((d) => ({ x: monthToDate(d.month).getTime(), y: d.value })), { color: '#009a44', fill: false });
      headline.borderDash = [4, 4];
      datasets.push(headline);
    }
    const palette = { excl_energy: '#0e5c8a' };
    const names = { excl_energy: 'CPI excl. energy' };
    for (const key of ['excl_energy']) {
      const series = ((P.core || {})[key] || {}).series || [];
      if (series.length) {
        datasets.push(nvLineDataset(names[key], series.map((d) => ({ x: monthToDate(d.month).getTime(), y: d.value })), { color: palette[key], fill: false }));
      }
    }
    const config = quarterlyLineConfig(datasets, {
      yTitle: 'Annual rate, %',
      tooltipFormat: 'MMM yyyy',
      tooltipLabel: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
    });
    config.options.plugins.tooltip.callbacks.title = (items) => {
      const d = new Date(items[0].parsed.x);
      return d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    };
    new Chart(ctx4, config);
    const ce = ((P.core || {}).excl_energy || {}).series || [];
    if (ce.length) setBadge('core-updated', ce[ce.length - 1].month ? monthLabel(ce[ce.length - 1].month) : '');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPriceHighlights();
  initPriceCharts();
});
