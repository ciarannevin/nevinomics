'use strict';

// Financial page: highlights (Latest) and seven charts from FINANCIAL_DATA.

function initFinancialHighlights() {
  const host = document.getElementById('financial-highlights');
  if (!host || typeof FINANCIAL_DATA === 'undefined') return;

  const F = FINANCIAL_DATA;
  const last = (arr) => arr[arr.length - 1];
  const fmtPp = (v, dp = 2) => (v === null || v === undefined ? '\u2014' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}pp`);
  const fmtBn = (v) => `\u20ac${(v / 1000).toFixed(1)}bn`;

  const tiles = [];

  const rateTile = (recs, label, tip) => {
    const r = last(recs);
    if (!r) return;
    tiles.push(
      tile(label, tip, [
        { label: 'Level', value: `${r.value.toFixed(2)}%`, dir: '' },
        { label: 'MoM', value: fmtPp(r.mom), dir: r.mom < 0 ? 'down' : 'up' },
        { label: 'YoY', value: fmtPp(r.yoy), dir: r.yoy < 0 ? 'down' : 'up' },
      ])
    );
  };

  if (F.rates && F.rates.mortgage_ie) {
    rateTile(
      F.rates.mortgage_ie,
      'New mortgage rate',
      'Interest rate on new loans to households for house purchase, Ireland, annualised agreed rate, % per annum (ECB MIR, series MIR.M.IE.B.A2C.A.R.A.2250.EUR.N)'
    );
  }
  if (F.rates && F.rates.loans_nfc_ie) {
    rateTile(
      F.rates.loans_nfc_ie,
      'New corporate loan rate',
      'Cost of borrowing on new loans to non-financial corporations, Ireland, annualised agreed rate, % per annum (ECB MIR, series MIR.M.IE.B.A2I.AM.R.A.2240.EUR.N)'
    );
  }
  if (F.rates && F.rates.dep_overnight_ie) {
    rateTile(
      F.rates.dep_overnight_ie,
      'Overnight deposit rate',
      'Interest rate on new overnight deposits from households, Ireland, annualised agreed rate, % per annum (ECB MIR, series MIR.M.IE.B.L21.A.R.A.2250.EUR.N)'
    );
  }

  if (F.credit && F.credit.hh_house_outstanding && F.credit.hh_house_outstanding.length) {
    const r = last(F.credit.hh_house_outstanding);
    tiles.push(
      tile('Mortgage debt outstanding', 'Outstanding loans to Irish households for house purchase, end of month, EUR millions (ECB BSI, series BSI.M.IE.N.A.A22.A.1.U2.2250.Z01.E)', [
        { label: 'Level', value: fmtBn(r.value), dir: '' },
        { label: 'YoY', value: `${r.yoy >= 0 ? '+' : ''}${r.yoy.toFixed(1)}%`, dir: r.yoy < 0 ? 'down' : 'up' },
      ])
    );
  }

  if (F.policy && F.policy.dfr && F.policy.dfr.length) {
    const dfr = F.policy.dfr;
    const latest = last(dfr);
    const tLast = new Date(latest.date + 'T00:00:00Z').getTime();
    const yearAgo = dfr.filter((d) => new Date(d.date + 'T00:00:00Z').getTime() <= tLast - 365 * 24 * 3600 * 1000).pop();
    const yoy = yearAgo ? round2(latest.value - yearAgo.value) : null;
    tiles.push(
      tile('ECB deposit facility rate', 'ECB deposit facility rate, euro area, % per annum, latest daily observation (ECB FM, series FM/D.U2.EUR.4F.KR.DFR.LEV)', [
        { label: 'Level', value: `${latest.value.toFixed(2)}%`, dir: '' },
        { label: 'YoY', value: fmtPp(yoy), dir: yoy !== null && yoy < 0 ? 'down' : 'up' },
      ])
    );
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  const latestMonth = F.rates && F.rates.mortgage_ie && F.rates.mortgage_ie.length ? last(F.rates.mortgage_ie).month : '';
  host.innerHTML =
    tiles.length
      ? kpiHeadingRow('Latest', latestMonth ? monthLabel(latestMonth) : '') + `<div class="kpis">${tiles.join('')}</div>`
      : '';
}

function initFinancialCharts() {
  if (typeof Chart === 'undefined' || typeof FINANCIAL_DATA === 'undefined') return;
  const F = FINANCIAL_DATA;
  const palette = NEVINOMICS;
  const fmtBn = (v) => `\u20ac${(v / 1000).toFixed(1)}bn`;

  const mPoints = (recs, field) =>
    recs.filter((r) => r[field] !== null && r[field] !== undefined).map((r) => ({ x: monthToDate(r.month).getTime(), y: r[field] }));
  const dPoints = (recs) => recs.map((r) => ({ x: new Date(r.date + 'T00:00:00Z').getTime(), y: r.value }));

  // Monthly line chart with month tooltip titles (prices-page pattern).
  const monthlyLineConfig = (datasets, opts = {}) => {
    const config = quarterlyLineConfig(datasets, {
      yTitle: opts.yTitle || '%',
      tooltipFormat: 'MMM yyyy',
      tooltipLabel: opts.tooltipLabel || ((i) => `${i.dataset.label}: ${i.parsed.y.toFixed(2)}%`),
    });
    config.options.plugins.tooltip.callbacks.title = (items) => {
      const d = new Date(items[0].parsed.x);
      return d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    };
    return config;
  };

  // 1. ECB policy rates, daily since 2015
  const c1 = document.getElementById('policy-chart');
  if (c1 && F.policy && F.policy.dfr && F.policy.mro) {
    const dfr = nvLineDataset('Deposit facility rate', dPoints(F.policy.dfr), { color: palette.accent, fill: false });
    const mro = nvLineDataset('Main refinancing rate', dPoints(F.policy.mro), { color: '#E8A33D', fill: false });
    const cfg = monthlyLineConfig([dfr, mro], {
      yTitle: '% per annum',
      tooltipFormat: 'dd MMM yyyy',
      tooltipLabel: (i) => `${i.dataset.label}: ${i.parsed.y.toFixed(2)}%`,
    });
    cfg.options.scales.x.time.tooltipFormat = 'dd MMM yyyy';
    new Chart(c1, cfg);
    const lastDate = F.policy.dfr[F.policy.dfr.length - 1].date;
    setBadge('policy-updated', monthLabel(lastDate.slice(0, 7)));
  }

  // 2. New lending rates: households (IE mortgage, IE consumer, EA mortgage)
  const c2 = document.getElementById('lending-hh-chart');
  if (c2 && F.rates) {
    const datasets = [];
    if (F.rates.mortgage_ie) datasets.push(nvLineDataset('Mortgages (Ireland)', mPoints(F.rates.mortgage_ie, 'value'), { color: palette.accent, fill: false }));
    if (F.rates.consumer_ie) datasets.push(nvLineDataset('Consumer credit (Ireland)', mPoints(F.rates.consumer_ie, 'value'), { color: '#E8A33D', fill: false }));
    if (F.rates.mortgage_ea) datasets.push(nvLineDataset('Mortgages (euro area)', mPoints(F.rates.mortgage_ea, 'value'), { color: '#8C5A7A', fill: false }));
    if (datasets.length) {
      new Chart(c2, monthlyLineConfig(datasets, { yTitle: '%, annualised agreed rate' }));
      setBadge('lending-hh-updated', monthLabel(F.rates.mortgage_ie[F.rates.mortgage_ie.length - 1].month));
    }
  }

  // 3. New lending rates: NFCs (IE vs EA)
  const c3 = document.getElementById('lending-nfc-chart');
  if (c3 && F.rates) {
    const datasets = [];
    if (F.rates.loans_nfc_ie) datasets.push(nvLineDataset('Corporate loans (Ireland)', mPoints(F.rates.loans_nfc_ie, 'value'), { color: palette.accent, fill: false }));
    if (F.rates.loans_nfc_ea) datasets.push(nvLineDataset('Corporate loans (euro area)', mPoints(F.rates.loans_nfc_ea, 'value'), { color: '#E8A33D', fill: false }));
    if (datasets.length) {
      new Chart(c3, monthlyLineConfig(datasets, { yTitle: '%, annualised agreed rate' }));
      setBadge('lending-nfc-updated', monthLabel(F.rates.loans_nfc_ie[F.rates.loans_nfc_ie.length - 1].month));
    }
  }

  // 4. Household deposit rates (IE overnight, IE agreed maturity, EA overnight)
  const c4 = document.getElementById('deposits-chart');
  if (c4 && F.rates) {
    const datasets = [];
    if (F.rates.dep_overnight_ie) datasets.push(nvLineDataset('Overnight deposits (Ireland)', mPoints(F.rates.dep_overnight_ie, 'value'), { color: palette.accent, fill: false }));
    if (F.rates.dep_agreed_ie) datasets.push(nvLineDataset('Agreed-maturity deposits (Ireland)', mPoints(F.rates.dep_agreed_ie, 'value'), { color: '#E8A33D', fill: false }));
    if (F.rates.dep_overnight_ea) datasets.push(nvLineDataset('Overnight deposits (euro area)', mPoints(F.rates.dep_overnight_ea, 'value'), { color: '#8C5A7A', fill: false }));
    if (datasets.length) {
      new Chart(c4, monthlyLineConfig(datasets, { yTitle: '%, annualised agreed rate' }));
      setBadge('deposits-updated', monthLabel(F.rates.dep_overnight_ie[F.rates.dep_overnight_ie.length - 1].month));
    }
  }

  // 5. Loans outstanding, EUR m
  const c5 = document.getElementById('loans-chart');
  if (c5 && F.credit) {
    const datasets = [];
    if (F.credit.hh_house_outstanding) datasets.push(nvLineDataset('House purchase loans (households)', mPoints(F.credit.hh_house_outstanding, 'value'), { color: palette.accent, fill: false }));
    if (F.credit.nfc_outstanding) datasets.push(nvLineDataset('Loans to non-financial corporations', mPoints(F.credit.nfc_outstanding, 'value'), { color: '#E8A33D', fill: false }));
    if (datasets.length) {
      new Chart(c5, monthlyLineConfig(datasets, { yTitle: '\u20acm', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
      setBadge('loans-updated', monthLabel(F.credit.hh_house_outstanding[F.credit.hh_house_outstanding.length - 1].month));
    }
  }

  // 6. Annual growth in lending, %
  const c6 = document.getElementById('growth-chart');
  if (c6 && F.credit) {
    const datasets = [];
    if (F.credit.hh_house_outstanding) datasets.push(nvLineDataset('House purchase loans (households)', mPoints(F.credit.hh_house_outstanding, 'yoy'), { color: palette.accent, fill: false }));
    if (F.credit.nfc_outstanding) datasets.push(nvLineDataset('Loans to non-financial corporations', mPoints(F.credit.nfc_outstanding, 'yoy'), { color: '#E8A33D', fill: false }));
    if (datasets.length) {
      new Chart(c6, monthlyLineConfig(datasets, { yTitle: 'Annual growth, %', tooltipLabel: (i) => `${i.dataset.label}: ${i.parsed.y.toFixed(1)}%` }));
      setBadge('growth-updated', monthLabel(F.credit.nfc_outstanding[F.credit.nfc_outstanding.length - 1].month));
    }
  }

  // 7. Net mortgage lending, trailing 3 months, EUR m
  const c7 = document.getElementById('flows-chart');
  if (c7 && F.credit && F.credit.hh_house_flows) {
    const flows = F.credit.hh_house_flows;
    const pts = [];
    for (let i = 2; i < flows.length; i++) {
      const sum = flows[i].value + flows[i - 1].value + flows[i - 2].value;
      pts.push({ x: monthToDate(flows[i].month).getTime(), y: round0(sum) });
    }
    const ds = nvLineDataset('Net lending, trailing 3 months', pts, { color: palette.accent });
    new Chart(c7, monthlyLineConfig([ds], { yTitle: '\u20acm', tooltipLabel: (i) => `${i.dataset.label}: ${fmtBn(i.parsed.y)}` }));
    setBadge('flows-updated', monthLabel(flows[flows.length - 1].month));
  }

  function round0(v) {
    return Math.round(v);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initFinancialHighlights();
  initFinancialCharts();
});
