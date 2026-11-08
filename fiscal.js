'use strict';

// Fiscal page: highlights (Latest + Forecasts) and six charts from FISCAL_DATA.

function initFiscalHighlights() {
  const host = document.getElementById('fiscal-highlights');
  if (!host || typeof FISCAL_DATA === 'undefined') return;

  const F = FISCAL_DATA;
  const lastIdx = (arr) => arr.length - 1;

  const latestTiles = [];

  const bal = F.balance_sa[lastIdx(F.balance_sa)];
  if (bal) {
    latestTiles.push(
      tile('Government balance', 'General government net lending (B9), seasonally adjusted, EUR millions (CSO GFQ01)', [
        { label: 'Level', value: `${bal.value >= 0 ? '+' : ''}€${(bal.value / 1000).toFixed(1)}bn`, dir: bal.value >= 0 ? 'up' : 'down' },
        { label: 'QoQ', value: `${bal.qoq >= 0 ? '+' : ''}€${(Math.abs(bal.qoq) / 1000).toFixed(1)}bn`, dir: bal.qoq >= 0 ? 'up' : 'down' },
        { label: 'YoY', value: `${bal.yoy >= 0 ? '+' : ''}€${(Math.abs(bal.yoy) / 1000).toFixed(1)}bn`, dir: bal.yoy >= 0 ? 'up' : 'down' },
      ])
    );
  }
  const rev = F.revenue_sa[lastIdx(F.revenue_sa)];
  if (rev) {
    latestTiles.push(
      tile('Revenue', 'General government revenue, seasonally adjusted, EUR millions (CSO GFQ01)', [
        { label: 'Level', value: `€${(rev.value / 1000).toFixed(1)}bn`, dir: '' },
        { label: 'QoQ', value: `${rev.qoq >= 0 ? '+' : ''}${rev.qoq.toFixed(1)}%`, dir: rev.qoq < 0 ? 'down' : 'up' },
        { label: 'YoY', value: `${rev.yoy >= 0 ? '+' : ''}${rev.yoy.toFixed(1)}%`, dir: rev.yoy < 0 ? 'down' : 'up' },
      ])
    );
  }
  const exp = F.expenditure_sa[lastIdx(F.expenditure_sa)];
  if (exp) {
    latestTiles.push(
      tile('Expenditure', 'General government expenditure, seasonally adjusted, EUR millions (CSO GFQ01)', [
        { label: 'Level', value: `€${(exp.value / 1000).toFixed(1)}bn`, dir: '' },
        { label: 'QoQ', value: `${exp.qoq >= 0 ? '+' : ''}${exp.qoq.toFixed(1)}%`, dir: exp.qoq < 0 ? 'down' : 'up' },
        { label: 'YoY', value: `${exp.yoy >= 0 ? '+' : ''}${exp.yoy.toFixed(1)}%`, dir: exp.yoy < 0 ? 'down' : 'up' },
      ])
    );
  }
  const dGni = F.debt_gni_star[lastIdx(F.debt_gni_star)];
  if (dGni) {
    latestTiles.push(
      tile('Debt to GNI*', 'End-year gross general government debt (EDP face value) as a share of Modified GNI - nevinomics derivation from CSO data (GFQ02, NA001)', [
        { label: dGni.year, value: `${dGni.value.toFixed(1)}%`, dir: dGni.value <= 100 ? '' : 'down' },
        { label: 'YoY', value: `${dGni.yoy >= 0 ? '+' : ''}${dGni.yoy.toFixed(1)}pp`, dir: dGni.yoy < 0 ? 'up' : 'down' },
      ])
    );
  }

  // Forecasts row: CBI, % of GNI*
  const forecastTiles = [];
  if (typeof FORECAST_DATA !== 'undefined' && FORECAST_DATA.series) {
    const fc = (key, label, tip, dp = 1) => {
      const pts = (FORECAST_DATA.series[key] || []).filter((p) => p.forecast && p.value !== null).slice(0, 3);
      if (!pts.length) return;
      forecastTiles.push(
        tile(label, tip, pts.map((p) => ({ label: p.year, value: `${p.value >= 0 ? '+' : ''}${p.value.toFixed(dp)}%`, dir: p.value < 0 ? 'down' : 'up' })))
      );
    };
    fc('GG balance', 'Government balance', 'Central Bank of Ireland Quarterly Bulletin forecast, general government balance, % of GNI*');
    fc('GG balance underlying', 'Balance excluding one-offs', 'Central Bank of Ireland Quarterly Bulletin forecast, underlying general government balance (excludes one-off items such as the Apple state-aid receipts), % of GNI*');
    fc('GG debt', 'Gross debt', 'Central Bank of Ireland Quarterly Bulletin forecast, general government gross debt, % of GNI*');
  }

  const latestBadge = bal ? bal.quarter : '';
  host.innerHTML =
    (latestTiles.length ? `<div class="kpi-heading-row"><span class="kpi-heading">Latest</span><span class="badge live">${latestBadge}</span></div><div class="kpis">${latestTiles.join('')}</div>` : '') +
    (forecastTiles.length ? `<div class="kpi-heading-row"><span class="kpi-heading">Forecasts</span><span class="badge live">${bulletinName()}</span></div><div class="kpis">${forecastTiles.join('')}</div>` : '');
}

function initFiscalCharts() {
  if (typeof Chart === 'undefined' || typeof FISCAL_DATA === 'undefined') return;
  const F = FISCAL_DATA;

  const qPoints = (recs) => recs.filter((r) => r.value !== null && r.value !== undefined).map((r) => ({ x: quarterToDate(r.quarter).getTime(), y: r.value }));
  const trailing4 = (recs) => {
    // sum of each quarter with the three before it (4-quarter total, EUR m)
    const pts = [];
    const vals = recs.filter((r) => r.value !== null && r.value !== undefined);
    for (let i = 3; i < vals.length; i++) {
      let sum = 0, ok = true;
      for (let j = i - 3; j <= i; j++) {
        if (vals[j].value === null || vals[j].value === undefined) { ok = false; break; }
        sum += vals[j].value;
      }
      if (ok) pts.push({ x: quarterToDate(vals[i].quarter).getTime(), y: sum });
    }
    return pts;
  };
  const lastNYears = (recs, years) => {
    const cutoff = Date.now() - years * 365.25 * 24 * 3600 * 1000;
    return recs.filter((r) => quarterToDate(r.quarter).getTime() >= cutoff);
  };
  const lastNYearsAnnual = (recs, years) => {
    if (!recs.length) return recs;
    const last = recs[recs.length - 1];
    const cutoff = Number(last.year) - years;
    return recs.filter((r) => Number(r.year) >= cutoff);
  };
  const setBadge = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const palette = NEVINOMICS;
  const fmtBn = (v) => `€${(v / 1000).toFixed(1)}bn`;
  const toBn = (pts) => pts.map((p) => ({ x: p.x, y: p.y / 1000 }));

  // 1. Government revenue vs expenditure, past 5 years (SA), EUR billions
  const c1 = document.getElementById('revexp-chart');
  if (c1) {
    const rev = nvLineDataset('Revenue', toBn(qPoints(lastNYears(F.revenue_sa, 5))), { color: palette.accent, fill: false });
    const exp = nvLineDataset('Expenditure', toBn(qPoints(lastNYears(F.expenditure_sa, 5))), { color: '#E8A33D', fill: false });
    new Chart(c1, quarterlyLineConfig([rev, exp], {
      yTitle: '€bn',
      yTicks: (v) => v.toLocaleString('en-IE', { maximumFractionDigits: 0 }),
      tooltipLabel: (i) => `${i.dataset.label}: €${i.parsed.y.toFixed(1)}bn`,
    }));
    const last = F.revenue_sa[F.revenue_sa.length - 1];
    setBadge('revexp-updated', last ? last.quarter : '');
  }

  // 2. Government balance (overall and primary), trailing 4 quarters (NSA), EUR billions
  const c3 = document.getElementById('primary-chart');
  if (c3) {
    const overall = nvLineDataset('Overall balance', toBn(trailing4(lastNYears(F.balance, 5))), { color: palette.accent, fill: false });
    const primary = nvLineDataset('Primary balance', toBn(trailing4(lastNYears(F.primary_balance, 5))), { color: '#E8A33D', fill: false });
    new Chart(c3, quarterlyLineConfig([overall, primary], {
      yTitle: '€bn',
      yTicks: (v) => v.toLocaleString('en-IE', { maximumFractionDigits: 1 }),
      tooltipLabel: (i) => `${i.dataset.label}: €${i.parsed.y.toFixed(1)}bn`,
    }));
    const last = F.primary_balance[F.primary_balance.length - 1];
    setBadge('primary-updated', last ? last.quarter : '');
  }

  // 3. Debt ratios, annual, past 5 years
  const c4 = document.getElementById('ratios-chart');
  if (c4) {
    const yPoints = (recs) => recs.map((r) => ({ x: Date.UTC(Number(r.year), 0, 1), y: r.value }));
    const gni = nvLineDataset('Debt to GNI*', yPoints(lastNYearsAnnual(F.debt_gni_star, 5)), { color: palette.accent, fill: false });
    const gdp = nvLineDataset('Debt to GDP', yPoints(lastNYearsAnnual(F.debt_gdp, 5)), { color: '#E8A33D', fill: false });
    const cfg = quarterlyLineConfig([gni, gdp], {
      yTitle: '%',
      tooltipFormat: 'yyyy',
      tooltipLabel: (i) => {
        const d = new Date(i.parsed.x);
        return `${i.dataset.label} (${d.getUTCFullYear()}): ${i.parsed.y.toFixed(1)}%`;
      },
    });
    new Chart(c4, cfg);
    const last = F.debt_gni_star[F.debt_gni_star.length - 1];
    setBadge('ratios-updated', last ? last.year : '');
  }

  // 4. Debt level, quarterly, past 5 years, EUR billions
  const c5 = document.getElementById('debt-chart');
  if (c5) {
    const debt = nvLineDataset('Gross debt', toBn(qPoints(lastNYears(F.debt, 5))), { color: palette.accent, fill: false });
    new Chart(c5, quarterlyLineConfig([debt], {
      yTitle: '€bn',
      yTicks: (v) => v.toLocaleString('en-IE', { maximumFractionDigits: 0 }),
      tooltipLabel: (i) => `${i.dataset.label}: €${i.parsed.y.toFixed(1)}bn`,
    }));
    const last = F.debt[F.debt.length - 1];
    setBadge('debt-updated', last ? last.quarter : '');
  }

  // 5. Interest expenditure, trailing 4 quarters, past 5 years (NSA), EUR millions
  const c6 = document.getElementById('interest-chart');
  if (c6) {
    const int = nvLineDataset('Interest (trailing 4 quarters)', trailing4(lastNYears(F.interest, 5)), { color: palette.accent, fill: false });
    new Chart(c6, quarterlyLineConfig([int], { yTitle: '€m', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
    const last = F.interest[F.interest.length - 1];
    setBadge('interest-updated', last ? last.quarter : '');
  }

  // 6. Gross National Debt by instrument (NTMA Composition of Debt), doughnut, EUR billions
  const c7 = document.getElementById('debt-pie-chart');
  if (c7 && typeof NTMA_DATA !== 'undefined') {
    const PIE = ['#3E7C59', '#E8A33D', '#8C5A7A', '#4A6FA5', '#6fa287', '#f0c377', '#5b6b62', '#a8c3b5'];
    const labels = NTMA_DATA.instruments.map((i) => i.label);
    const vals = NTMA_DATA.instruments.map((i) => i.value_bn);
    new Chart(c7, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: vals, backgroundColor: PIE.slice(0, labels.length), borderColor: '#ffffff', borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (item) => {
                const pct = ((item.parsed / NTMA_DATA.total_bn) * 100).toFixed(1);
                return `${item.label}: €${item.parsed.toFixed(2)}bn (${pct}%)`;
              },
            },
          },
        },
      },
      plugins: [nevinomicsWatermark],
    });
    const asOf = NTMA_DATA.as_of || '';
    const badge = asOf ? new Date(asOf + '-02T00:00:00Z').toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    setBadge('debt-pie-updated', badge);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initFiscalHighlights();
  initFiscalCharts();
});
