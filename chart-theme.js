'use strict';

const NEVINOMICS = {
  accent: '#3E7C59',
  accentSoft: 'rgba(62,124,89,0.08)',
  negative: '#8C5A7A',
  muted: '#5b6b62',
};

const nevinomicsWatermark = {
  id: 'nevinomicsWatermark',
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    ctx.save();
    // Match the header/footer lockup: C mark (ink N, spruce+heather circles) + all-spruce
    // uppercase NEVINOMICS in Sora.
    const fontSize = 9;
    ctx.font = `600 ${fontSize}px "Sora", "Space Grotesk", system-ui, sans-serif`;
    const text = 'NEVINOMICS';
    const textW = ctx.measureText(text).width;
    // mark geometry (30x30 viewBox scaled to ~12px, like the 22px header mark at small size)
    const m = 0.4;                // scale factor: 30 -> 12
    const ox = chartArea.right - textW - 16;  // mark origin x
    const oy = chartArea.bottom + 5;          // mark origin y (band centre)
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(m, m);
    ctx.beginPath();
    ctx.moveTo(8, 25); ctx.lineTo(8, 5); ctx.lineTo(22, 25); ctx.lineTo(22, 5);
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = 'rgba(26,26,26,0.8)';   // ink
    ctx.lineCap = 'square';
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(62,124,89,0.7)';    // spruce
    ctx.arc(19.6, 7.4, 3.4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(140,90,122,0.7)';   // heather
    ctx.arc(22.4, 5.2, 3.4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    // text after the mark
    ctx.fillStyle = 'rgba(62,124,89,0.65)';    // spruce, subtle
    ctx.fillText(text, ox + 14, oy + 9);
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
        ticks: { color: NEVINOMICS.muted, padding: 14 },
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
