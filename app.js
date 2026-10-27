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

function initKpis(data) {
  const latest = latestComplete(data);
  const prevQ = data.find((d) => d.quarter === `${Number(latest.quarter.slice(0, 4)) - 1}Q4`);
  const yearAvg = data
    .filter((d) => d.quarter.startsWith(latest.quarter.slice(0, 4)) && d.gdp !== null)
    .reduce((sum, d) => sum + d.gdp, 0) / 4;
  const kpis = [
    { label: `YoY growth (${latest.quarter})`, value: fmtPct(latest.yoy), dir: latest.yoy >= 0 ? 'up' : 'down' },
    { label: 'GDP, latest quarter', value: fmtMillions(latest.gdp), dir: '' },
    { label: `GDP avg ${latest.quarter.slice(0, 4)}`, value: fmtMillions(yearAvg), dir: '' },
  ];
  if (prevQ && prevQ.yoy !== null) {
    kpis.push({ label: `YoY growth (${prevQ.quarter})`, value: fmtPct(prevQ.yoy), dir: prevQ.yoy >= 0 ? 'up' : 'down' });
  }
  const container = document.getElementById('gdp-kpis');
  container.innerHTML = kpis
    .map((k) => `<div class="kpi"><span class="label">${k.label}</span><div class="value ${k.dir}">${k.value}</div></div>`)
    .join('');
}

function initChart(data) {
  const ctx = document.getElementById('gdp-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const makeDataset = (metric) => {
    const points = data.filter((d) => d[metric] !== null);
    return {
      datasets: [
        {
          label: metric === 'yoy' ? 'Year-on-year growth (%)' : 'GDP level (€m)',
          data: points.map((d) => ({ x: quarterToDate(d.quarter).getTime(), y: d[metric] })),
          borderColor: '#2b6cb0',
          backgroundColor: metric === 'yoy' ? 'rgba(43,108,176,0.08)' : 'rgba(43,108,176,0.05)',
          fill: metric === 'yoy',
          pointRadius: 1.5,
          pointHitRadius: 8,
          borderWidth: 2,
          tension: 0.1,
        },
      ],
    };
  };

  const config = {
    type: 'line',
    data: makeDataset('yoy'),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'year', tooltipFormat: 'yyyy QQQ' },
          grid: { display: false },
        },
        y: {
          ticks: { callback: (v) => (Math.abs(v) >= 1000 ? `${v / 1000}k` : v) },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const d = new Date(items[0].parsed.x);
              return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
            },
            label: (item) =>
              item.dataset.label.includes('%')
                ? `${item.dataset.label}: ${fmtPct(item.parsed.y)}`
                : `${item.dataset.label}: ${fmtMillions(item.parsed.y)}`,
          },
        },
      },
    },
  };

  const chart = new Chart(ctx, config);

  document.querySelectorAll('input[name="gdp-metric"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      chart.data = makeDataset(radio.value);
      chart.options.scales.y.ticks.callback =
        radio.value === 'gdp' ? (v) => (Math.abs(v) >= 1000 ? `${v / 1000}k` : v) : (v) => `${v}%`;
      chart.update();
    });
  });
}

function init() {
  if (typeof GDP_DATA === 'undefined' || GDP_DATA.length === 0) {
    document.getElementById('gdp-card').innerHTML = '<h2>GDP Growth — Ireland</h2><p>No data loaded.</p>';
    return;
  }
  const latest = GDP_DATA[GDP_DATA.length - 1];
  document.getElementById('gdp-updated').textContent = `Data through ${latest.quarter}`;
  initKpis(GDP_DATA);
  initChart(GDP_DATA);
}

document.addEventListener('DOMContentLoaded', init);
