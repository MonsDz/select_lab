// What existing integrations rely on, taken from real forms: bare arrays from a service,
// decorated items, resolveValue, status dots, multi with chips, slots, parts and tokens.
// It uses nothing added after 1.0.0, so it also runs against a published build:
//   SELECT_LAB_BUNDLE=/path/to/old-bundle.js node tests/compat-check.mjs
import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ensureBundle } from './fixtures/build-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(path.join(here, 'fixtures/compat.html')).href;
const BUNDLE = process.env.SELECT_LAB_BUNDLE || (await ensureBundle());

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('  ✓ ' + m); pass++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push('' + e));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

const open = (id) => page.evaluate((id) => document.getElementById(id).shadowRoot.querySelector('.control').click(), id);
const root = (id, source) => page.evaluate((id, source) => new Function('root', 'el', `return (${source})(root, el)`)(document.getElementById(id).shadowRoot, document.getElementById(id)), id, source.toString());

try {
  await page.goto(FILE, { waitUntil: 'load', timeout: 15000 });
  await page.addScriptTag({ path: BUNDLE });
  await page.waitForFunction(() => !!document.getElementById('clients')?.shadowRoot, { timeout: 5000 });

  await page.evaluate(() => {
    const clients = Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, company: 'Company ' + i, contact_name: 'Contact ' + i }));
    const decorate = (c) => ({ ...c, icon: 'business', color: '#ef4444' });
    window.requests = [];
    window.events = [];
    const clientsEl = document.getElementById('clients');
    // firstValueFrom(service.getClients(offset, limit, search)).then(list => list.map(decorate)): a bare array
    clientsEl.dataSource = async ({ search, offset, limit }) => {
      window.requests.push({ search, offset, limit });
      return clients.filter((c) => c.company.includes(search)).slice(offset, offset + limit).map(decorate);
    };
    clientsEl.resolveValue = async (id) => decorate(clients.find((c) => c.id === id));
    for (const type of ['change', 'open', 'close', 'search']) {
      clientsEl.addEventListener(type, (e) => window.events.push({ type, detail: e.detail }));
    }
    const dot = '<svg viewBox="0 0 8 8" width="8" height="8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>';
    document.getElementById('status').items = [
      { value: 'Draft', label: 'Draft', icon: dot, color: '#71717a' },
      { value: 'Paid', label: 'Paid', icon: dot, color: '#10b981' },
    ];
    document.getElementById('plain').dataSource = async () => ({ items: [{ id: 1, name: 'One' }], total: 1 });
    document.getElementById('locked').items = [{ id: 1, name: 'One' }];
    document.getElementById('empty').items = [];
    document.getElementById('tags').items = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];
  });
  await wait(60);

  // Closed state and tokens
  const closed = await root('clients', (r) => {
    const control = r.querySelector('.control');
    return { placeholder: r.querySelector('[part=placeholder]').textContent.trim(), bg: getComputedStyle(control).backgroundColor, text: getComputedStyle(r.host).color };
  });
  ok(closed.placeholder === 'Search client…', 'placeholder attribute shows while empty');
  ok(closed.bg === 'rgb(1, 2, 3)' && closed.text === 'rgb(4, 5, 6)', 'theme tokens set from the page apply');
  ok((await page.evaluate(() => window.requests.length)) === 0, 'nothing loads until the list opens');

  // Bare arrays with a page size, infinite scroll
  await open('clients');
  await page.waitForFunction(() => document.getElementById('clients').shadowRoot.querySelectorAll('.option').length > 0, { timeout: 3000 });
  await wait(60);
  ok((await page.evaluate(() => JSON.stringify(window.requests[0]))) === '{"search":"","offset":0,"limit":7}', 'first request: offset 0 with page-size');
  const row = await root('clients', (r) => {
    const option = r.querySelector('.option');
    const glyph = option.querySelector('.icon-glyph');
    return { label: option.querySelector('[part=option-label]').textContent.trim(), desc: option.querySelector('[part=option-description]').textContent.trim(), glyph: glyph.textContent, color: getComputedStyle(glyph).color, font: getComputedStyle(glyph).fontFamily };
  });
  ok(row.label === 'Company 0' && row.desc === 'Contact 0', 'label-field and description-field render');
  ok(row.glyph === 'business' && row.color === 'rgb(239, 68, 68)', 'icon-field and icon-color-field render');
  ok(/Material Symbols/.test(row.font), 'icon-font-family applies');
  await root('clients', (r) => { const list = r.querySelector('.listbox'); list.scrollTop = list.scrollHeight; });
  await wait(100);
  ok((await page.evaluate(() => window.requests.length)) >= 2 && (await page.evaluate(() => window.requests[1].offset)) === 7, 'scrolling asks for the next page by offset');

  // Search resets to the first page
  await page.evaluate(() => (window.requests.length = 0));
  await page.evaluate(() => {
    const input = document.getElementById('clients').shadowRoot.querySelector('.search');
    input.value = 'Company 1';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  await wait(420);
  const searched = await page.evaluate(() => window.requests[0]);
  ok(searched.search === 'Company 1' && searched.offset === 0, 'search is debounced and restarts at offset 0');
  ok(await page.evaluate(() => window.events.some((e) => e.type === 'search' && e.detail.search === 'Company 1')), 'search event fires');

  // Choosing returns a scalar and the whole item, and shows it
  await root('clients', (r) => r.querySelector('.option').click());
  await wait(80);
  const chosen = await page.evaluate(() => {
    const el = document.getElementById('clients');
    const change = window.events.filter((e) => e.type === 'change').pop();
    return { value: el.value, detailValue: change.detail.value, item: change.detail.item.company, shown: el.shadowRoot.querySelector('.value').textContent.trim(), open: el.open, form: new FormData(document.getElementById('form')).get('client_id') };
  });
  ok(chosen.value === 101 && chosen.detailValue === 101, 'value is the scalar value-field');
  ok(chosen.item === 'Company 1', 'change event carries the item');
  ok(chosen.shown.includes('Company 1') && !chosen.open, 'the choice shows and the list closes');
  ok(chosen.form === '101', 'the value reaches the surrounding form');
  ok(await page.evaluate(() => window.events.some((e) => e.type === 'open') && window.events.some((e) => e.type === 'close')), 'open and close events fire');

  // A value set from outside is resolved
  await page.evaluate(() => (document.getElementById('clients').value = 105));
  await wait(80);
  ok((await root('clients', (r) => r.querySelector('.value').textContent.trim())).includes('Company 5'), 'resolveValue names a value set from outside');

  // Status dots
  await open('status');
  await wait(100);
  const dot = await root('status', (r) => {
    const svg = r.querySelector('.option svg');
    return { found: !!svg, color: svg ? getComputedStyle(svg).color : null, options: r.querySelectorAll('.option').length };
  });
  ok(dot.found && dot.color === 'rgb(113, 113, 122)', 'a status dot in SVG renders with its item color');
  ok(dot.options === 2, 'a static list renders all its items');
  await page.evaluate(() => {
    const input = document.getElementById('status').shadowRoot.querySelector('.search');
    input.value = 'Pa';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  });
  await wait(420);
  ok((await root('status', (r) => r.querySelectorAll('.option').length)) === 1, 'a static list filters in the browser');
  await page.keyboard.press('Escape');
  await wait(60);

  // Keyboard path from the control
  await page.evaluate(() => document.getElementById('plain').shadowRoot.querySelector('.control').focus());
  await page.keyboard.press('Enter');
  await wait(100);
  ok(await page.evaluate(() => document.getElementById('plain').open), 'Enter opens the list');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await wait(100);
  ok((await page.evaluate(() => document.getElementById('plain').value)) === 1, 'arrows and Enter choose an option');

  // Disabled and slots
  await open('locked');
  await wait(60);
  ok(!(await page.evaluate(() => document.getElementById('locked').open)), 'a disabled select does not open');
  await open('empty');
  await wait(100);
  const emptyText = await root('empty', (r) => r.querySelector('[part=empty] slot[name=empty]').assignedNodes()[0].textContent);
  ok(emptyText === 'Nada por aquí', 'slots still override the built-in texts');
  await page.keyboard.press('Escape');
  await page.mouse.click(800, 900);
  await wait(60);

  // Multi
  await open('tags');
  await wait(100);
  await root('tags', (r) => r.querySelectorAll('.option')[0].click());
  await wait(40);
  await root('tags', (r) => r.querySelectorAll('.option')[2].click());
  await wait(60);
  const multi = await page.evaluate(() => {
    const el = document.getElementById('tags');
    return { value: el.value, chips: el.shadowRoot.querySelectorAll('.chip').length, open: el.open, form: new FormData(document.getElementById('form')).getAll('tags') };
  });
  ok(JSON.stringify(multi.value) === '["a","c"]' && multi.chips === 2, 'multi keeps an array of values and renders chips');
  ok(multi.open, 'multi stays open while choosing');
  ok(JSON.stringify(multi.form) === '["a","c"]', 'multi reaches the form as repeated values');
  await root('tags', (r) => r.querySelector('.chip-x').click());
  await wait(60);
  ok(JSON.stringify(await page.evaluate(() => document.getElementById('tags').value)) === '["c"]', 'a chip removes its value');

  // Public styling hooks
  const parts = await root('tags', (r) => Array.from(r.querySelectorAll('[part]')).flatMap((node) => node.getAttribute('part').split(' ')).filter(Boolean));
  for (const part of ['control', 'value', 'arrow', 'panel', 'input', 'listbox', 'option', 'option-label', 'chip', 'chip-remove']) {
    ok(parts.includes(part), `::part(${part}) still exists`);
  }

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nCompatibility OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
