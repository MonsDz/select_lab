import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ensureBundle } from './fixtures/build-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(path.join(here, 'fixtures/a11y.html')).href;
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

await ensureBundle();

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('  ✓ ' + m); pass++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1200 });
const errors = [];
page.on('pageerror', (e) => errors.push('' + e));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const axe = async (label) => {
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      resultTypes: ['violations'],
    });
    return result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].target}`);
  });
  ok(violations.length === 0, `axe: ${label}${violations.length ? ' → ' + violations.join('; ') : ''}`);
};
const focusIn = (id) => page.evaluate((id) => document.getElementById(id).shadowRoot.querySelector('.control').focus(), id);
const openWithKeyboard = async (id) => {
  await focusIn(id);
  await page.keyboard.press('ArrowDown');
  await wait(120);
};
const focused = () =>
  page.evaluate(() => {
    const host = document.activeElement;
    const inner = host?.shadowRoot?.activeElement;
    return { host: host?.id || host?.tagName, inner: inner?.classList?.[0] ?? null };
  });
const inRoot = (id, fn, ...args) =>
  page.evaluate((id, source, args) => new Function('root', 'el', 'args', `return (${source})(root, el, ...args)`)(document.getElementById(id).shadowRoot, document.getElementById(id), args), id, fn.toString(), args);
const axNode = async (id) => {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: false, root: await page.evaluateHandle((id) => document.getElementById(id).shadowRoot.querySelector('.control'), id) });
  return snapshot;
};

try {
  await page.goto(FILE, { waitUntil: 'load', timeout: 15000 });
  await page.addScriptTag({ path: AXE });
  await page.waitForFunction(() => !!document.getElementById('labelled')?.shadowRoot, { timeout: 5000 });
  await wait(100);

  // --- automated audit, in every state that renders something different
  await axe('every select closed');
  await page.evaluate(() => (document.getElementById('multi').value = ['id-1', 'id-2']));
  await wait(60);
  await axe('multi with chips');
  await openWithKeyboard('labelled');
  await axe('open with results');
  await page.keyboard.press('Escape');
  await wait(60);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluate(() => { document.body.style.background = '#18181b'; document.body.style.color = '#f4f4f5'; });
  await axe('every select closed, dark');
  await openWithKeyboard('labelled');
  await axe('open with results, dark');
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluate(() => { document.body.style.background = '#fff'; document.body.style.color = '#18181b'; });
  await wait(60);

  // --- accessible name and description, as the browser computes them
  ok((await axNode('labelled'))?.name === 'Segment', 'name comes from <label for>');
  ok((await axNode('named'))?.name === 'Named explicitly', 'name comes from the label attribute');
  ok((await axNode('placeholder-only'))?.name === 'Search client', 'name falls back to the placeholder');
  ok((await axNode('described'))?.description === 'Choose who follows up', 'described-by reaches across the shadow boundary');
  const described = await inRoot('described', (root) => { const c = root.querySelector('.control'); return { required: c.getAttribute('aria-required'), invalid: c.getAttribute('aria-invalid') }; });
  ok(described.required === 'true' && described.invalid === 'true', 'required and invalid are exposed on the control');
  await page.evaluate(() => {
    const hint = document.getElementById('described-hint');
    const next = document.createElement('p');
    next.id = 'described-hint';
    next.textContent = 'Replaced message';
    hint.replaceWith(next);
    document.getElementById('described').invalid = false;
  });
  await wait(60);
  ok((await axNode('described'))?.description === 'Replaced message', 'a replaced message is picked up on the next update');

  // --- a <label> focuses the field
  await page.click('label[for="labelled"]');
  await wait(60);
  let f = await focused();
  ok(f.host === 'labelled' && f.inner === 'control', 'clicking the <label> focuses the field');
  ok((await inRoot('labelled', (root) => root.querySelectorAll('[role=option]').length)) === 0, 'clicking the <label> does not open the list');

  // --- active option belongs to the element that has focus
  await page.keyboard.press(' ');
  await wait(120);
  ok(await inRoot('labelled', (root) => root.querySelectorAll('[role=option]').length > 0), 'Space opens the list from the control');
  f = await focused();
  ok(f.inner === 'search', 'focus moves to the search box');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await wait(60);
  const aria = await inRoot('labelled', (root) => {
    const search = root.querySelector('.search');
    const id = search.getAttribute('aria-activedescendant');
    const option = id ? root.getElementById(id) : null;
    return {
      role: search.getAttribute('role'),
      name: search.getAttribute('aria-label'),
      activeExists: !!option,
      activeIsOption: option?.getAttribute('role'),
      onControl: root.querySelector('.control').getAttribute('aria-activedescendant'),
      setsize: option?.getAttribute('aria-setsize'),
      posinset: option?.getAttribute('aria-posinset'),
    };
  });
  ok(aria.role === 'combobox' && aria.name === 'Segment', 'the search box is a named combobox');
  ok(aria.activeExists && aria.activeIsOption === 'option', 'aria-activedescendant on the focused box points at a real option');
  ok(aria.onControl === null, 'the control does not also claim the active option');
  ok(aria.setsize === '1000' && Number(aria.posinset) >= 1, `options report their position in the whole list (${aria.posinset} of ${aria.setsize})`);

  // --- focus comes back
  await page.keyboard.press('Enter');
  await wait(100);
  f = await focused();
  ok(f.host === 'labelled' && f.inner === 'control', 'choosing with Enter returns focus to the field');
  await openWithKeyboard('labelled');
  await page.keyboard.press('Escape');
  await wait(100);
  f = await focused();
  ok(f.host === 'labelled' && f.inner === 'control', 'Escape returns focus to the field');
  await page.evaluate(() => (document.getElementById('labelled').open = true));
  await wait(120);
  await inRoot('labelled', (root) => root.querySelector('[role=option]').click());
  await wait(100);
  f = await focused();
  ok(f.host === 'labelled' && f.inner === 'control', 'choosing with the mouse returns focus to the field');
  await openWithKeyboard('labelled');
  await page.click('#after');
  await wait(100);
  f = await focused();
  ok(f.host === 'after', 'clicking another control keeps focus on that control');
  await openWithKeyboard('labelled');
  await page.keyboard.press('Tab');
  await wait(100);
  f = await focused();
  ok(f.host === 'named', 'Tab closes the list and moves on to the next field');

  // --- Escape stays inside
  await page.evaluate(() => {
    window.bodyEscapes = 0;
    document.body.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.bodyEscapes += 1; });
    document.getElementById('dialog').showModal();
  });
  await openWithKeyboard('in-dialog');
  await page.keyboard.press('Escape');
  await wait(100);
  ok(await inRoot('in-dialog', (root) => root.querySelectorAll('[role=option]').length === 0), 'Escape closes the list');
  ok((await page.evaluate(() => window.bodyEscapes)) === 0, 'Escape on an open list never reaches the page');
  ok(await page.evaluate(() => document.getElementById('dialog').open), 'the dialog around the list stays open');
  await page.keyboard.press('Escape');
  await wait(100);
  ok(!(await page.evaluate(() => document.getElementById('dialog').open)), 'a second Escape, with the list closed, closes the dialog as usual');

  // --- saved value while its name loads
  await page.evaluate(() => {
    const el = document.getElementById('resolved');
    el.resolveValue = (id) => new Promise((resolve) => setTimeout(() => resolve({ id, name: id === 'stale' ? 'Stale' : 'Real name' }), id === 'stale' ? 500 : 200));
    el.value = 'saved-id';
  });
  await wait(40);
  let shown = await inRoot('resolved', (root) => ({ text: root.querySelector('.value').textContent.trim(), spinner: !!root.querySelector('.value .spinner'), busy: root.querySelector('.control').getAttribute('aria-busy') }));
  ok(shown.text === '' && shown.spinner, 'the raw id never shows while the name loads');
  ok(shown.busy === 'true', 'the field reports it is busy');
  await wait(260);
  shown = await inRoot('resolved', (root) => ({ text: root.querySelector('.value').textContent.trim(), busy: root.querySelector('.control').getAttribute('aria-busy') }));
  ok(shown.text === 'Real name' && shown.busy === null, 'the name replaces the indicator');
  await page.evaluate(() => { const el = document.getElementById('resolved'); el.value = 'stale'; });
  await wait(30);
  await page.evaluate(() => { const el = document.getElementById('resolved'); el.value = 'latest'; });
  await wait(620);
  shown = await inRoot('resolved', (root) => root.querySelector('.value').textContent.trim());
  ok(shown === 'Real name', 'a slow answer for an old value does not overwrite the current one');

  // --- long names
  await page.evaluate(() => (document.getElementById('multi').value = []));
  await page.evaluate(() => (document.getElementById('labelled').value = null));
  await openWithKeyboard('labelled');
  const title = await inRoot('labelled', (root) => root.querySelector('[role=option] .label').getAttribute('title'));
  ok(title?.startsWith('A very long name'), 'a long name can be read in full');
  await page.keyboard.press('Escape');

  // --- failure, retry, and the status region
  await page.evaluate(() => {
    window.attempts = 0;
    window.healthy = false;
    document.getElementById('failing').dataSource = (params) => {
      window.attempts += 1;
      if (!window.healthy) throw new Error('500');
      return window.source(params);
    };
  });
  await openWithKeyboard('failing');
  await wait(60);
  let status = await inRoot('failing', (root) => {
    const region = root.querySelector('[role=status]');
    return { text: region?.textContent.replace(/\s+/g, ' ').trim(), inList: !!region?.closest('[role=listbox]'), retry: !!root.querySelector('.retry') };
  });
  ok(status.retry && status.text.startsWith('Failed to load'), 'a failure shows the message and a retry button');
  ok(!status.inList, 'the status region is outside the listbox');
  await axe('failure with its retry button');
  await page.keyboard.press('Enter');
  await wait(100);
  ok((await page.evaluate(() => window.attempts)) === 2, 'Enter retries');
  await page.keyboard.press('Escape');
  await wait(60);
  await openWithKeyboard('failing');
  await wait(60);
  ok((await page.evaluate(() => window.attempts)) === 3, 'reopening retries');
  await page.evaluate(() => (window.healthy = true));
  await inRoot('failing', (root) => root.querySelector('.retry').click());
  await wait(120);
  ok(await inRoot('failing', (root) => root.querySelectorAll('[role=option]').length > 0), 'the retry button loads the list');
  await page.keyboard.press('Escape');
  await wait(60);

  // --- texts
  await page.evaluate(() => { document.getElementById('translated').dataSource = () => ({ items: [], total: 0 }); });
  await openWithKeyboard('translated');
  await wait(60);
  ok((await inRoot('translated', (root) => root.querySelector('[part=empty]').textContent.trim())) === 'Sin resultados', 'the empty message is translatable');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const el = document.getElementById('translated');
    el.items = [{ id: 'a', name: 'Uno' }];
    el.dataSource = undefined;
    el.value = ['a'];
  });
  await wait(80);
  ok((await inRoot('translated', (root) => root.querySelector('.chip-x').getAttribute('aria-label'))) === 'Quitar Uno', 'the remove button is translatable and names its chip');
  await focusIn('translated');
  await inRoot('translated', (root) => root.querySelector('.chip-x').focus());
  await page.keyboard.press('Enter');
  await wait(80);
  const chip = await inRoot('translated', (root, el) => ({ value: el.value, options: root.querySelectorAll('[role=option]').length, validation: el.internals.validationMessage }));
  ok(chip.value.length === 0 && chip.options === 0, 'Enter on a chip removes it and does not open the list');
  ok(chip.validation === 'Elige una opción.', 'the required message is translatable');

  // --- non-searchable list keeps the active option on the control
  await openWithKeyboard('plain');
  await page.keyboard.press('ArrowDown');
  await wait(60);
  const plain = await inRoot('plain', (root) => {
    const control = root.querySelector('.control');
    return { search: !!root.querySelector('.search'), active: control.getAttribute('aria-activedescendant'), setsize: root.querySelector('[role=option]').getAttribute('aria-setsize') };
  });
  ok(!plain.search && plain.active?.startsWith('sl-opt-'), 'without a search box the control holds the active option');
  ok(plain.setsize === '5', 'a static list reports its real size');
  await axe('open without a search box');
  await page.keyboard.press('Escape');

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nAccessibility OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
