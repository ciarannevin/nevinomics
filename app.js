'use strict';

function quarterToDate(q) {
  const [year, qn] = [q.slice(0, 4), q.slice(5)];
  return new Date(Date.UTC(Number(year), (Number(qn) - 1) * 3, 1));
}

function latestComplete(data) {
  const withGrowth = data.filter((d) => d.yoy !== null);
  return withGrowth[withGrowth.length - 1] || data[data.length - 1];
}

function fmtPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function fmtMillions(v) {
  return `€${Math.round(v).toLocaleString('en-IE')}m`;
}

function initHomeHero() {
  const el = document.getElementById('hero-gdp');
  if (!el || typeof GDP_DATA === 'undefined') return;
  const latest = latestComplete(GDP_DATA);
  el.innerHTML =
    `<p class="eyebrow">Irish GDP growth, year-on-year (${latest.quarter})</p>` +
    `<div class="big ${latest.yoy >= 0 ? 'up' : 'down'}">${fmtPct(latest.yoy)}</div>` +
    `<p class="sub">GDP of ${fmtMillions(latest.value)} in the latest quarter. ` +
    `<a href="output.html">See the Output page →</a></p>`;
}

document.addEventListener('DOMContentLoaded', initHomeHero);
