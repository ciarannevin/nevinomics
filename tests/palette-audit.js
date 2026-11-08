'use strict';

// Palette audit: every chart's series colours must follow the order
// spruce -> marigold -> heather -> fjord (NEVINOMICS palette order).
// Allowed exceptions: colours chosen per-point by sign (functions or
// spruce/heather backgroundColor arrays), which indicate high/low or
// increasing/decreasing. Run: node tests/palette-audit.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PALETTE = ['#3E7C59', '#E8A33D', '#8C5A7A', '#4A6FA5'];
const SIGN_RICH = /^rgba\(62,124,89,|^rgba\(140,90,122,|^#3E7C59$|^#8C5A7A$/; // per-point sign colours
const NEUTRAL_BAND = /^rgba\(62,124,89,/; // range-plot translucent bar band (neutral family colour)

const PAGES = ['index.html', 'output.html', 'labour.html', 'prices.html', 'fiscal.html', 'financial.html', 'preview.html'];

function makeElement(id) {
  return {
    id, innerHTML: '', textContent: '', className: '', style: {}, attrs: {}, width: 0, height: 0,
    classList: { add() {}, remove() {}, toggle() {} },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener() {}, append() {}, prepend() {},
  };
}

function makeDom(html) {
  const elements = {};
  for (const m of html.matchAll(/id="([^"]+)"/g)) elements[m[1]] = makeElement(m[1]);
  const sparkCanvases = [];
  for (const m of html.matchAll(/<canvas class="sparkline" data-spark="([^"]+)"/g)) {
    const el = makeElement('spark:' + m[1]);
    el.attrs['data-spark'] = m[1];
    sparkCanvases.push(el);
  }
  let domReady = null;
  const document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => (sel === '.sparkline' ? sparkCanvases : []),
    createElement: () => makeElement('anon'),
    body: { prepend() {}, append() {} },
    addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') domReady = fn; },
  };
  return { document, elements, fireReady: () => domReady && domReady() };
}

function loadPage(pageFile) {
  const html = fs.readFileSync(path.join(ROOT, pageFile), 'utf8');
  const dom = makeDom(html);
  const charts = [];
  class ChartStub {
    constructor(canvas, config) { this.canvas = canvas; this.config = config; charts.push(this); }
  }
  const sandbox = { document: dom.document, location: { pathname: '/' + pageFile }, Chart: ChartStub, console, Date, Math, JSON, Number, String, Array, Object, RegExp, Set, Map, isNaN, parseFloat, parseInt };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
    if (m[1].startsWith('http')) continue;
    vm.runInContext(fs.readFileSync(path.join(ROOT, m[1].split('?')[0]), 'utf8'), ctx, { filename: m[1] });
  }
  dom.fireReady();
  return charts;
}

function colourOf(ds) {
  return ds.borderColor !== undefined ? ds.borderColor : ds.backgroundColor;
}

function auditChart(page, chart) {
  const id = chart.canvas.id || chart.canvas.attrs['data-spark'] || '?';
  const problems = [];
  // palette order applies to series (line charts) and bar overlays; pies/doughnuts
  // are categorical slices and may use palette tints beyond the four series colours
  if (chart.config.type !== 'line' && chart.config.type !== 'bar') return { page, id, problems, summary: 'skipped (non-series chart)' };
  const isLine = chart.config.type === 'line';
  const seenLabel = new Map(); // actual/forecast pairs share a label and a colour
  let groupIdx = 0;
  for (const ds of chart.config.data.datasets) {
    const c = colourOf(ds);
    if (typeof c === 'function') continue; // per-point sign colouring: allowed
    if (Array.isArray(c)) {
      if (c.every((x) => typeof x === 'string' && SIGN_RICH.test(x))) continue; // sign-coloured bars: allowed
      problems.push(`dataset "${ds.label}": mixed/non-sign array colours [${c.slice(0, 3).join(', ')}...]`);
      continue;
    }
    if (typeof c !== 'string') continue;
    if (!isLine && (NEUTRAL_BAND.test(c) || SIGN_RICH.test(c))) continue; // bar charts: neutral band / sign bars allowed
    if (isLine) {
      if (seenLabel.has(ds.label)) {
        if (seenLabel.get(ds.label).toLowerCase() !== c.toLowerCase()) {
          problems.push(`series "${ds.label}": duplicate label with different colour ${c} vs ${seenLabel.get(ds.label)}`);
        }
        continue;
      }
      if (groupIdx >= PALETTE.length) {
        problems.push(`series "${ds.label}": ${c} (more than 4 logical series - palette exhausted)`);
        continue;
      }
      const expected = PALETTE[groupIdx];
      if (c.toLowerCase() !== expected.toLowerCase()) {
        problems.push(`series ${groupIdx + 1} "${ds.label}": ${c} (expected ${expected})`);
      }
      seenLabel.set(ds.label, c);
      groupIdx++;
    } else {
      if (!PALETTE.some((p) => p.toLowerCase() === c.toLowerCase())) {
        problems.push(`dataset "${ds.label}": ${c} is outside the palette`);
      }
    }
  }
  return { page, id, problems, summary: chart.config.data.datasets.map((d) => `${d.label}=${typeof colourOf(d) === 'function' ? 'fn(sign)' : Array.isArray(colourOf(d)) ? 'array(sign)' : colourOf(d)}`).join(' | ') };
}

let bad = 0;
for (const page of PAGES) {
  for (const chart of loadPage(page)) {
    const r = auditChart(page, chart);
    if (r.problems.length) {
      bad++;
      console.log(`FLAG ${page} #${r.id}`);
      console.log(`     ${r.summary}`);
      for (const p of r.problems) console.log(`     - ${p}`);
    } else {
      console.log(`ok   ${page} #${r.id}: ${r.summary}`);
    }
  }
}
console.log(bad ? `\n${bad} chart(s) out of palette order` : '\nAll charts follow spruce -> marigold -> heather -> fjord (sign-coloured uses excepted)');
process.exit(bad ? 1 : 0);
