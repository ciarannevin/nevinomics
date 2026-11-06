'use strict';

// Node DOM harness: loads each page's real HTML + local scripts into a shimmed
// DOM, fires DOMContentLoaded, and asserts the page rendered (highlights HTML,
// badges populated, one Chart per canvas). Run: node tests/dom-harness.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const PAGES = ['index.html', 'output.html', 'labour.html', 'prices.html', 'fiscal.html', 'financial.html', 'global.html', 'about.html'];

function makeElement(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    attrs: {},
    width: 0,
    height: 0,
    classList: { add() {}, remove() {}, toggle() {} },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener() {},
    append() {},
    prepend() {},
  };
}

function makeDom(html, pageFile) {
  const elements = {};
  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    elements[m[1]] = makeElement(m[1]);
  }
  const sparkCanvases = [];
  for (const m of html.matchAll(/<canvas class="sparkline" data-spark="([^"]+)"/g)) {
    const el = makeElement('spark:' + m[1]);
    el.attrs['data-spark'] = m[1];
    sparkCanvases.push(el);
  }
  const radioInputs = [];
  for (const m of html.matchAll(/<input[^>]*name="growth-metric"[^>]*>/g)) {
    const el = makeElement('radio:' + radioInputs.length);
    el.checked = /checked/.test(m[0]);
    radioInputs.push(el);
  }
  let domReady = null;
  const document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '.sparkline') return sparkCanvases;
      if (sel === 'input[name="growth-metric"]') return radioInputs;
      return [];
    },
    createElement: () => makeElement('anon'),
    body: { prepend() {}, append() {} },
    addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') domReady = fn; },
  };
  return { document, elements, sparkCanvases, fireReady: () => domReady && domReady() };
}

function localScripts(html) {
  const srcs = [];
  for (const m of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
    if (!m[1].startsWith('http')) srcs.push(m[1].split('?')[0]);
  }
  return srcs;
}

function runPage(pageFile) {
  const html = fs.readFileSync(path.join(ROOT, pageFile), 'utf8');
  const dom = makeDom(html, pageFile);
  const chartInstances = [];
  class ChartStub {
    constructor(canvas, config) {
      this.canvas = canvas;
      this.config = config;
      chartInstances.push(this);
    }
  }
  const sandbox = {
    document: dom.document,
    location: { pathname: '/' + pageFile },
    Chart: ChartStub,
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Array,
    Object,
    RegExp,
    Set,
    Map,
    isNaN,
    parseFloat,
    parseInt,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const errors = [];
  for (const src of localScripts(html)) {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    try {
      vm.runInContext(code, context, { filename: src });
    } catch (e) {
      errors.push(`load ${src}: ${e.message}`);
    }
  }
  try {
    dom.fireReady();
  } catch (e) {
    errors.push(`DOMContentLoaded: ${e.message}`);
  }

  // assertions
  const canvasIds = [...html.matchAll(/<canvas id="([^"]+)"/g)].map((m) => m[1]);
  for (const cid of canvasIds) {
    if (!chartInstances.some((c) => c.canvas === dom.elements[cid])) {
      errors.push(`canvas #${cid} has no Chart instance`);
    }
  }
  for (const cid of [...html.matchAll(/<canvas id="([^"]+)"/g)].map((m) => m[1])) {
    const inst = chartInstances.find((c) => c.canvas === dom.elements[cid]);
    if (inst && (!inst.config.data || !inst.config.data.datasets || !inst.config.data.datasets.length)) {
      errors.push(`chart #${cid} has no datasets`);
    }
    if (inst && inst.config.data && inst.config.data.datasets) {
      for (const ds of inst.config.data.datasets) {
        if (!ds.data || !ds.data.length) errors.push(`chart #${cid} dataset "${ds.label}" is empty`);
      }
    }
  }
  for (const id of Object.keys(dom.elements)) {
    if (id.endsWith('-updated') && !dom.elements[id].textContent) {
      errors.push(`badge #${id} not populated`);
    }
    if (id.endsWith('-highlights') && !dom.elements[id].innerHTML.trim()) {
      errors.push(`highlights #${id} empty`);
    }
  }
  if (pageFile === 'index.html') {
    if (!dom.elements['hero-strip'].innerHTML.trim()) errors.push('hero-strip empty');
    if (!dom.elements['readings-tiles'].innerHTML.trim()) errors.push('readings-tiles empty');
    if (chartInstances.length !== dom.sparkCanvases.length) {
      errors.push(`expected ${dom.sparkCanvases.length} sparklines, got ${chartInstances.length} charts`);
    }
  }
  return { errors, charts: chartInstances.length, sparklines: dom.sparkCanvases.length };
}

let failed = 0;
for (const page of PAGES) {
  const { errors, charts, sparklines } = runPage(page);
  if (errors.length) {
    failed++;
    console.log(`FAIL ${page}`);
    for (const e of errors) console.log(`   - ${e}`);
  } else {
    console.log(`PASS ${page} (charts=${charts}${sparklines ? ', sparklines=' + sparklines : ''})`);
  }
}
process.exit(failed ? 1 : 0);
