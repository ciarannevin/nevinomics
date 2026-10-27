'use strict';

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
    const data = typeof window[def.varName] !== 'undefined' ? window[def.varName] : null;
    const rec = data && data.length ? pickLatest(data) : null;
    if (rec && (!latestQuarter || rec.quarter > latestQuarter)) latestQuarter = rec.quarter;
    tiles.push(stripKpi(def, rec, 'yoy'));
    tiles.push(stripKpi(def, rec, 'qoq'));
  }
  host.innerHTML = tiles.join('');

  const badge = document.getElementById('strip-updated');
  if (badge && latestQuarter) badge.textContent = `Data through ${latestQuarter}`;
}

document.addEventListener('DOMContentLoaded', initSummaryStrip);
