'use strict';

// Shared helpers used across nevinomics pages. Loaded before each page script.

// --- dates ---------------------------------------------------------------

function monthToDate(m) {
  const [y, mo] = [Number(m.slice(0, 4)), Number(m.slice(5, 7))];
  return new Date(Date.UTC(y, mo - 1, 1));
}

function quarterToDate(q) {
  const [year, qn] = [q.slice(0, 4), q.slice(5)];
  return new Date(Date.UTC(Number(year), (Number(qn) - 1) * 3, 1));
}

function monthLabel(m) {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1));
  return d.toLocaleDateString('en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// --- windowing -----------------------------------------------------------

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

// alias used by the Output page
const lastNYears = lastNYearsQuarterly;

// --- formatting ---------------------------------------------------------

function fmtPctV(v, dp = 1) {
  return v === null || v === undefined ? '\u2014' : `${v.toFixed(dp)}%`;
}

function fmtDelta(v, dp = 1) {
  return v === null || v === undefined ? '\u2014' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}pp`;
}

// --- CBI bulletin -------------------------------------------------------

function bulletinName() {
  if (typeof FORECAST_DATA === 'undefined' || !FORECAST_DATA.title) return '';
  const m =
    FORECAST_DATA.title.match(/Q([1-4])\s*(\d{4})/) ||
    (FORECAST_DATA.url || '').match(/quarterly-bulletin-q([1-4])-(\d{4})/);
  return m ? `${m[2]}Q${m[1]}` : '';
}

// --- tiles ---------------------------------------------------------------

function tile(label, tooltip, cols) {
  const cells = cols
    .map(
      (c) =>
        `<div class="fy-col"><span class="fy-year">${c.label}</span><span class="fy-val ${c.dir}">${c.value}</span></div>`
    )
    .join('');
  return `<div class="kpi kpi-wide" title="${tooltip}"><span class="label">${label}</span><div class="mini-cols">${cells}</div></div>`;
}

function kpiHeadingRow(heading, badgeText) {
  return `<div class="kpi-heading-row"><span class="kpi-heading">${heading}</span><span class="badge live">${badgeText || ''}</span></div>`;
}

// --- sector labels -------------------------------------------------------

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
    .replace('Accommodation and Food Service Activities', 'Accommodation and food service');
}

// --- badges --------------------------------------------------------------

function setBadge(id, text) {
  const el = document.getElementById(id);
  if (el && text) el.textContent = text;
  if (el && !text) console.warn(`Badge "${id}" not populated - check the data mapping.`);
}

// --- range plots ---------------------------------------------------------

// One builder for all horizontal bar+dot range plots. Data shape:
//   { quarter, groups: [{group, change|rate, min5, max5}] }  (demographics, occupation)
//   { quarter, sectors: [{sector, change, min5, max5}] }     (sector employment/earnings)
function rangePlotConfig(breakdown, labelFmt, opts = {}) {
  const items = breakdown.groups || breakdown.sectors || [];
  const name = (g) => labelFmt(g.group || g.sector);
  const groups = [...items].reverse();
  const isChange = groups.some((g) => g.change !== undefined);
  const dotLabel = opts.dotLabel || `Latest value, ${breakdown.quarter}`;
  const xTitle = opts.xTitle || '%';
  const dotSeries = groups.map((g) => ({ x: g.change !== undefined ? g.change : g.rate, y: name(g) }));
  const barSeries = groups.map((g) =>
    g.min5 === null || g.max5 === null || g.min5 === undefined
      ? null
      : { x: [g.min5, g.max5], y: name(g) }
  );
  const dotColour = opts.dotColour || ((ctx) => {
    const v = ctx.raw ? ctx.raw.x : 0;
    return v >= 0 ? '#009a44' : '#c0392b';
  });
  const data = {
    labels: groups.map(name),
    datasets: [
      {
        label: opts.barLabel || '5-year range of quarterly changes',
        data: barSeries,
        backgroundColor: 'rgba(0,154,68,0.14)',
        borderColor: 'rgba(0,154,68,0.35)',
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false,
        order: 2,
      },
      {
        label: dotLabel,
        type: 'scatter',
        data: dotSeries,
        backgroundColor: dotColour,
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
          title: { display: true, text: xTitle },
          afterBuildTicks: (axis) => {
            axis.padding = 14;
          },
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
                const unit = opts.dotUnit || '%';
                return `${item.dataset.label}: ${isChange && v >= 0 ? '+' : ''}${v.toFixed(1)}${unit === 'pp' ? 'pp' : '%'}`;
              }
              const r = item.raw.x;
              return `${item.dataset.label}: ${r[0].toFixed(1)}${opts.dotUnit === 'pp' ? 'pp' : '%'} to ${r[1].toFixed(1)}${opts.dotUnit === 'pp' ? 'pp' : '%'}`;
            },
          },
        },
      },
    },
    plugins: [nevinomicsWatermark],
  };
  return config;
}

// --- line chart base (quarterly time series) -----------------------------

function quarterlyLineConfig(datasets, opts = {}) {
  const config = {
    type: 'line',
    data: { datasets },
    options: nvBaseOptions(opts.yTicks),
    plugins: [nevinomicsWatermark],
  };
  config.options.scales.y.title = { display: true, text: opts.yTitle || '%' };
  if (opts.rightAxis) {
    config.options.scales.yChange = {
      position: 'right',
      ticks: { color: NEVINOMICS.muted },
      grid: { drawOnChartArea: false },
      title: { display: true, text: opts.rightAxis },
    };
  }
  config.options.scales.x.time.unit = 'year';
  config.options.scales.x.time.tooltipFormat = opts.tooltipFormat || 'yyyy QQQ';
  config.options.plugins.legend = { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } };
  config.options.plugins.tooltip.callbacks = {
    title: (items) => {
      const d = new Date(items[0].parsed.x);
      return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    },
    label: opts.tooltipLabel || ((item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)}${opts.unit || '%'}`),
  };
  return config;
}
