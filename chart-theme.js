'use strict';

const NEVINOMICS = {
  accent: '#009a44',
  accentSoft: 'rgba(0,154,68,0.08)',
  negative: '#c0392b',
  muted: '#5b6b62',
};

const nevinomicsWatermark = {
  id: 'nevinomicsWatermark',
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const text = 'nevinomics';
    ctx.save();
    ctx.font = '600 11px "Space Grotesk", system-ui, sans-serif';
    const w = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,154,68,0.55)';
    ctx.fillText(text, chartArea.right - w, chartArea.bottom - 4);
    ctx.restore();
  },
};

function nvLineDataset(label, points, opts = {}) {
  return {
    label,
    data: points,
    borderColor: opts.color || NEVINOMICS.accent,
    backgroundColor: opts.fill === false ? 'transparent' : NEVINOMICS.accentSoft,
    fill: opts.fill !== false,
    pointRadius: 1.5,
    pointHitRadius: 8,
    borderWidth: 2,
    tension: 0.1,
  };
}

function nvBaseOptions(yTicksCallback) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'year', tooltipFormat: 'yyyy QQQ' },
        grid: { display: false },
        ticks: { color: NEVINOMICS.muted },
      },
      y: {
        ticks: { callback: yTicksCallback, color: NEVINOMICS.muted },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {},
    },
  };
}
