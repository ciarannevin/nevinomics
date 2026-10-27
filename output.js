'use strict';

function pickLatest(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].yoy !== null && records[i].qoq !== null) return records[i];
  }
  return null;
}

function stripKpi(label, rec, growth) {
  if (!rec) return '';
  const v = growth === 'yoy' ? rec.yoy : rec.qoq;
  if (v === null || v === undefined) return '';
  const dir = v >= 0 ? 'up' : 'down';
  return `<div class="kpi"><span class="label">${label}</span><div class="value ${dir}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</div></div>`;
}

function initSummaryStrip() {
  const host = document.getElementById('summary-strip');
  if (!host) return;

  const series = [
    { data: typeof GDP_DATA !== 'undefined' ? GDP_DATA : null, label: 'GDP' },
    { data: typeof GNP_DATA !== 'undefined' ? GNP_DATA : null, label: 'GNP' },
    { data: typeof MDD_DATA !== 'undefined' ? MDD_DATA : null, label: 'Modified domestic demand' },
  ];

  let latestQuarter = null;
  const latest = series.map((s) => {
    if (!s.data || s.data.length === 0) return { ...s, rec: null };
    const rec = pickLatest(s.data);
    if (rec && (!latestQuarter || rec.quarter > latestQuarter)) latestQuarter = rec.quarter;
    return { ...s, rec };
  });

  const tiles = [];
  for (const s of latest) {
    tiles.push(stripKpi(`${s.label} — YoY`, s.rec, 'yoy'));
    tiles.push(stripKpi(`${s.label} — QoQ`, s.rec, 'qoq'));
  }
  host.innerHTML = tiles.join('');

  const badge = document.getElementById('strip-updated');
  if (badge && latestQuarter) badge.textContent = `Data through ${latestQuarter}`;
}

document.addEventListener('DOMContentLoaded', initSummaryStrip);
