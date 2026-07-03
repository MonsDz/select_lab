import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ensureBundle } from './fixtures/build-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(path.join(here, 'fixtures/dismiss-scroll.html')).href;

await ensureBundle();

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('  ✓ ' + m); pass++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 700 });
const errors = [];
page.on('pageerror', (e) => errors.push('' + e));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

const isOpen = (id) => page.evaluate((id) => !!document.getElementById(id).shadowRoot.querySelector('.panel'), id);

try {
  await page.goto(FILE, { waitUntil: 'load', timeout: 15000 });
  await page.waitForFunction(() => !!document.getElementById('s')?.shadowRoot, { timeout: 5000 });

  // scroll the anchor into the middle of the viewport first (real page scroll, not synthetic)
  await page.evaluate(() => document.getElementById('s').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 150)); // let scrollIntoView's own (async) scroll event settle first

  // --- CASE 1: default config — outer page scroll (mousewheel-style, real scroll) must CLOSE it ---
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  ok(await isOpen('s'), 'select opens on click');

  // real wheel scroll on the page (outside the component entirely)
  await page.mouse.wheel({ deltaY: 300 });
  await page.waitForFunction(() => !document.getElementById('s').shadowRoot.querySelector('.panel'), { timeout: 3000 });
  ok(!(await isOpen('s')), 'DEFAULT: real outer-page wheel scroll closes the dropdown (close-on-scroll is on by default)');

  // --- CASE 2: scrolling the dropdown's OWN option list must NOT close it (still used for pagination) ---
  await page.evaluate(() => document.getElementById('s').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 150)); // let scrollIntoView's own (async) scroll event settle first
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await page.evaluate(() => {
    const lb = document.getElementById('s').shadowRoot.querySelector('.listbox');
    lb.scrollTop = 200; // real scrollTop assignment fires a genuine native 'scroll' event
  });
  await new Promise((r) => setTimeout(r, 150));
  ok(await isOpen('s'), 'scrolling the panel\'s OWN option list (pagination) does NOT close it');
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click()); // close it manually

  // --- CASE 3: a NESTED scrollable ancestor (not window) scrolling must also close it ---
  await page.evaluate(() => document.getElementById('s2').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s2').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  ok(await isOpen('s2'), 'second select (inside a nested overflow:auto container) opens');
  await page.evaluate(() => {
    document.getElementById('nested').scrollTop = 100; // scroll the OUTER nested container, not the select's own list
  });
  await new Promise((r) => setTimeout(r, 150));
  ok(!(await isOpen('s2')), 'scrolling a nested scrollable ANCESTOR (outside the select) also closes it');

  // --- CASE 4: click outside still works (regression) ---
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => !document.getElementById('s').shadowRoot.querySelector('.panel'), { timeout: 3000 });
  ok(!(await isOpen('s')), 'click outside still closes it (regression check)');

  // --- CASE 5: close-on-scroll="false" opt-out still lets the panel follow instead of closing ---
  await page.evaluate(() => {
    const el = document.getElementById('s');
    el.closeOnScroll = false;
  });
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await page.mouse.wheel({ deltaY: 200 });
  await new Promise((r) => setTimeout(r, 150));
  ok(await isOpen('s'), 'opt-out (closeOnScroll=false) still available: panel stays open/follows on outside scroll');

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nScroll-dismiss OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
