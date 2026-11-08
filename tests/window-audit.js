'use strict';

// Window/axis audit: every time-series (line) chart must show the latest 5 years
// and a year-only x-axis. There are NO footnote exceptions - a longer window is
// only allowed when the site owner explicitly asks for it (then allowlist the
// canvas id here). Run: node tests/window-audit.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['index.html', 'output.html', 'labour.html', 'prices.html', 'fiscal.html', 'financial.html'];

// charts deliberately allowed to span more than 5 years (owner-specified only)
const LONG_WINDOW_ALLOWLIST = new Set([]);

const MAX_SPAN_YEARS = 6.1; // lastNYears(_, 5) keeps 6 calendar-year labels by convention

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
  const radios = [];
  for (const m of html.matchAll(/<input[^>]*name="growth-metric"[^>]*>/g)) {
    const el = makeElement('radio:' + radios.length);
    el.checked = /checked/.test(m[0]);
    radios.push(el);
  }
  let domReady = null;
  const document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => (sel === '.sparkline' ? sparkCanvases : sel === 'input[name="growth-metric"]' ? radios : []),
    createElement: () => makeElement('anon'),
    body: { prepend() {}, append() {} },
    addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') domReady = fn; },
  };
  return { document, fireReady: () => domReady && domReady() };
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

let issues = 0;
for (const page of PAGES) {
  for (const chart of loadPage(page)) {
    if (chart.config.type !== 'line') continue;
    const id = chart.canvas.id || chart.canvas.attrs['data-spark'] || '?';
    const time = chart.config.options.scales.x && chart.config.options.scales.x.time;
    if (time && time.unit !== 'year') {
      console.log(`AXIS  ${page} #${id}: x unit=${time.unit} (want 'year')`);
      issues++;
    }
    if (LONG_WINDOW_ALLOWLIST.has(`${page}#${id}`)) continue;
    for (const ds of chart.config.data.datasets) {
      if (!ds.data || !ds.data.length) continue;
      const xs = ds.data.map((p) => (typeof p === 'object' && p !== null ? p.x : p)).filter((v) => typeof v === 'number');
      if (!xs.length) continue;
      const spanYears = (Math.max(...xs) - Math.min(...xs)) / (365.25 * 24 * 3600 * 1000);
      if (spanYears > MAX_SPAN_YEARS) {
        console.log(`SPAN  ${page} #${id} "${ds.label}": ${spanYears.toFixed(1)}y > 5y window`);
        issues++;
      }
    }
  }
}
console.log(issues ? `${issues} window/axis issue(s)` : 'all time charts: year-only x-axis, latest-5-years window');
process.exit(issues ? 1 : 0);
