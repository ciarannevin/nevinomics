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
  const setBadge = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const palette = NEVINOMICS;
  const fmtBn = (v) => `€${(v / 1000).toFixed(1)}bn`;

  // 1. Revenue vs expenditure, past 5 years (SA)
  const c1 = document.getElementById('revexp-chart');
  if (c1) {
    const rev = nvLineDataset('Revenue', qPoints(lastNYears(F.revenue_sa, 5)), { color: palette.accent, fill: false });
    const exp = nvLineDataset('Expenditure', qPoints(lastNYears(F.expenditure_sa, 5)), { color: '#4A6FA5', fill: false });
    new Chart(c1, quarterlyLineConfig([rev, exp], { yTitle: '€m', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
    const last = F.revenue_sa[F.revenue_sa.length - 1];
    setBadge('revexp-updated', last ? last.quarter : '');
  }

  // 2. Government balance, trailing 4 quarters, since 2000 (SA)
  const c2 = document.getElementById('balance-chart');
  if (c2) {
    const bal = nvLineDataset('Balance (trailing 4 quarters)', trailing4(F.balance_sa), { color: palette.accent });
    new Chart(c2, quarterlyLineConfig([bal], { yTitle: '€m', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
    const last = F.balance_sa[F.balance_sa.length - 1];
    setBadge('balance-updated', last ? last.quarter : '');
  }

  // 3. Balance and primary balance, trailing 4 quarters, since 2000 (NSA)
  const c3 = document.getElementById('primary-chart');
  if (c3) {
    const overall = nvLineDataset('Overall balance', trailing4(F.balance), { color: palette.accent, fill: false });
    const primary = nvLineDataset('Primary balance', trailing4(F.primary_balance), { color: '#E8A33D', fill: false });
    new Chart(c3, quarterlyLineConfig([overall, primary], { yTitle: '€m', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
    const last = F.primary_balance[F.primary_balance.length - 1];
    setBadge('primary-updated', last ? last.quarter : '');
  }

  // 4. Debt ratios, annual since 2009
  const c4 = document.getElementById('ratios-chart');
  if (c4) {
    const yPoints = (recs) => recs.map((r) => ({ x: Date.UTC(Number(r.year), 0, 1), y: r.value }));
    const gdp = nvLineDataset('Debt to GDP', yPoints(F.debt_gdp), { color: '#4A6FA5', fill: false });
    const gni = nvLineDataset('Debt to GNI*', yPoints(F.debt_gni_star), { color: palette.accent, fill: false });
    const cfg = quarterlyLineConfig([gdp, gni], {
      yTitle: '%',
      tooltipLabel: (i) => {
        const d = new Date(i.parsed.x);
        return `${i.dataset.label} (${d.getUTCFullYear()}): ${i.parsed.y.toFixed(1)}%`;
      },
    });
    new Chart(c4, cfg);
    const last = F.debt_gni_star[F.debt_gni_star.length - 1];
    setBadge('ratios-updated', last ? last.year : '');
  }

  // 5. Debt level, quarterly since 2009
  const c5 = document.getElementById('debt-chart');
  if (c5) {
    const debt = nvLineDataset('Gross debt', qPoints(F.debt), { color: palette.accent, fill: false });
    new Chart(c5, quarterlyLineConfig([debt], { yTitle: '€m', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
    const last = F.debt[F.debt.length - 1];
    setBadge('debt-updated', last ? last.quarter : '');
  }

  // 6. Interest expenditure, trailing 4 quarters, since 2000 (NSA)
  const c6 = document.getElementById('interest-chart');
  if (c6) {
    const int = nvLineDataset('Interest (trailing 4 quarters)', trailing4(F.interest), { color: palette.negative, fill: false });
    new Chart(c6, quarterlyLineConfig([int], { yTitle: '€m', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
    const last = F.interest[F.interest.length - 1];
    setBadge('interest-updated', last ? last.quarter : '');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initFiscalHighlights();
  initFiscalCharts();
});
