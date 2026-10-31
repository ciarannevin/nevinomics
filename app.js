'use strict';

// Homepage: live hero strip, latest readings, sparklines in theme tiles.

function fmtPctSigned(v, dp = 1) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`;
}

// --- hero strip: one figure per live theme, deep-linked ----------------------

function heroFigures() {
  const figs = [];

  // Output: GDP YoY
  if (typeof GDP_DATA !== 'undefined' && GDP_DATA.length) {
    const withGrowth = GDP_DATA.filter((d) => d.yoy !== null);
    const latest = withGrowth[withGrowth.length - 1] || GDP_DATA[GDP_DATA.length - 1];
    figs.push({
      label: 'GDP growth',
      value: fmtPctSigned(latest.yoy),
      dir: latest.yoy >= 0 ? 'up' : 'down',
      period: `YoY, ${latest.quarter}`,
      href: 'output.html',
    });
  }

  // Labour: unemployment rate (monthly, SA)
  if (typeof LABOUR_DATA !== 'undefined') {
    const mu = ((LABOUR_DATA.monthly_unemployment || {})['15-74'] || {}).both || [];
    if (mu.length) {
      const latest = mu[mu.length - 1];
      figs.push({
        label: 'Unemployment',
        value: `${latest.value.toFixed(1)}%`,
        dir: '',
        period: monthLabel(latest.month),
        href: 'labour.html',
      });
    }
  }

  // Prices: CPI YoY
  if (typeof PRICES_DATA !== 'undefined' && PRICES_DATA.cpi && PRICES_DATA.cpi.length) {
    const latest = PRICES_DATA.cpi[PRICES_DATA.cpi.length - 1];
    figs.push({
      label: 'Inflation (CPI)',
      value: fmtPctSigned(latest.value),
      dir: latest.value >= 2 ? 'up' : 'down',
      period: `YoY, ${monthLabel(latest.month)}`,
      href: 'prices.html',
    });
  }

  // CBI forecast: GDP next-year
  if (typeof FORECAST_DATA !== 'undefined' && FORECAST_DATA.series && FORECAST_DATA.series.GDP) {
    const pts = FORECAST_DATA.series.GDP.filter((p) => p.forecast && p.value !== null).slice(0, 2);
    if (pts.length) {
      figs.push({
        label: `CBI forecast, GDP ${pts[0].year}`,
        value: fmtPctSigned(pts[0].value),
        dir: pts[0].value >= 0 ? 'up' : 'down',
        period: bulletinName(),
        href: 'output.html',
      });
    }
  }
  return figs;
}

function initHeroStrip() {
  const host = document.getElementById('hero-strip');
  if (!host) return;
  const figs = heroFigures();
  host.innerHTML = figs
    .map(
      (f) => `
      <a class="hero-fig" href="${f.href}">
        <span class="hero-label">${f.label}</span>
        <span class="hero-value ${f.dir}">${f.value}</span>
        <span class="hero-period">${f.period}</span>
      </a>`
    )
    .join('');
}

// --- latest readings: one mini-column tile per live theme --------------------

function initLatestReadings() {
  const host = document.getElementById('readings-tiles');
  if (!host) return;
  const tiles = [];

  if (typeof GDP_DATA !== 'undefined' && GDP_DATA.length) {
    const withGrowth = GDP_DATA.filter((d) => d.yoy !== null);
    const latest = withGrowth[withGrowth.length - 1] || GDP_DATA[GDP_DATA.length - 1];
    tiles.push(
      tile('GDP — growth', 'Gross Domestic Product growth (CSO NAQ04)', [
        { label: 'QoQ', value: fmtPctSigned(latest.qoq), dir: latest.qoq < 0 ? 'down' : 'up' },
        { label: 'YoY', value: fmtPctSigned(latest.yoy), dir: latest.yoy < 0 ? 'down' : 'up' },
      ])
    );
    const badge = document.getElementById('readings-updated');
    if (badge) badge.textContent = latest.quarter;
  }

  if (typeof LABOUR_DATA !== 'undefined') {
    const mu = ((LABOUR_DATA.monthly_unemployment || {})['15-74'] || {}).both || [];
    if (mu.length) {
      const latest = mu[mu.length - 1];
      tiles.push(
        tile('Unemployment — monthly', 'Seasonally adjusted monthly unemployment rate, ages 15-74 (CSO MUM01)', [
          { label: 'Rate', value: `${latest.value.toFixed(1)}%`, dir: '' },
          { label: 'M-o-M', value: `${latest.mom >= 0 ? '+' : ''}${latest.mom.toFixed(1)}pp`, dir: latest.mom < 0 ? 'down' : 'up' },
          { label: 'Y-o-Y', value: `${latest.yoy >= 0 ? '+' : ''}${latest.yoy.toFixed(1)}pp`, dir: latest.yoy < 0 ? 'down' : 'up' },
        ])
      );
    }
  }

  if (typeof PRICES_DATA !== 'undefined' && PRICES_DATA.cpi && PRICES_DATA.cpi.length) {
    const latest = PRICES_DATA.cpi[PRICES_DATA.cpi.length - 1];
    tiles.push(
      tile('CPI — inflation', 'Consumer Price Index, annual rate (CSO CPM20)', [
        { label: 'YoY', value: fmtPctSigned(latest.value), dir: latest.value >= 2 ? 'up' : 'down' },
        { label: 'M-o-M', value: fmtPctSigned(latest.mom), dir: latest.mom < 0 ? 'down' : 'up' },
      ])
    );
  }

  host.innerHTML = tiles.join('');
}

// --- sparklines in theme tiles ------------------------------------------------

function sparkSeries(key) {
  // Return the last 5 years of the headline series for a theme sparkline.
  if (key === 'gdp' && typeof GDP_DATA !== 'undefined') {
    return lastNYears(GDP_DATA, 5).filter((d) => d.yoy !== null).map((d) => ({ t: quarterToDate(d.quarter).getTime(), y: d.yoy }));
  }
  if (key === 'unemployment' && typeof LABOUR_DATA !== 'undefined') {
    const mu = ((LABOUR_DATA.monthly_unemployment || {})['15-74'] || {}).both || [];
    return lastNYearsMonthly(mu, 5).map((d) => ({ t: monthToDate(d.month).getTime(), y: d.value }));
  }
  if (key === 'cpi' && typeof PRICES_DATA !== 'undefined') {
    return (PRICES_DATA.cpi || []).map((d) => ({ t: monthToDate(d.month).getTime(), y: d.value }));
  }
  return [];
}

function initSparklines() {
  if (typeof Chart === 'undefined') return;
  document.querySelectorAll('.sparkline').forEach((canvas) => {
    const key = canvas.getAttribute('data-spark');
    const points = sparkSeries(key);
    if (!points.length) return;
    canvas.width = 400;
    canvas.height = 110;
    canvas.style.width = '200px';
    canvas.style.height = '55px';
    new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            // Chart.js 4 line charts need explicit {x, y} points; bare numeric arrays with
            // hidden scales draw nothing (NaN x-positions). x = index, y = value.
            data: points.map((p, i) => ({ x: i, y: p.y })),
            borderColor: '#3E7C59',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 4,
            tension: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        devicePixelRatio: 2,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { type: 'linear', display: false },
          y: { display: false },
        },
      },
    });
    // period label under the sparkline
    const periodEl = document.querySelector(`[data-period="${key}"]`);
    if (periodEl) {
      const last = points[points.length - 1];
      if (key === 'unemployment') {
        periodEl.textContent = monthLabel(lastPtMonth(points));
      } else {
        periodEl.textContent = key === 'gdp' ? lastPtQuarter(points) : monthLabel(lastPtMonth(points));
      }
    }
  });
}

function lastPtQuarter(points) {
  const d = new Date(points[points.length - 1].t);
  return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

function lastPtMonth(points) {
  const d = new Date(points[points.length - 1].t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
  initHeroStrip();
  initLatestReadings();
  initSparklines();
});
