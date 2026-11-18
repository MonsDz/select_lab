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

  // --- CASE 3: the user scrolling a NESTED scrollable ancestor (not window) must also close it ---
  await page.evaluate(() => document.getElementById('nested').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate(() => document.getElementById('s2').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s2').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  ok(await isOpen('s2'), 'second select (inside a nested overflow:auto container) opens');
  // a real wheel over the OUTER nested container, away from the select and its panel
  const nestedPoint = await page.evaluate(() => {
    const r = document.getElementById('nested').getBoundingClientRect();
    return { x: r.right - 40, y: r.top + 40 };
  });
  await page.mouse.move(nestedPoint.x, nestedPoint.y);
  await page.mouse.wheel({ deltaY: 100 });
  await new Promise((r) => setTimeout(r, 150));
  ok(!(await isOpen('s2')), 'the user scrolling a nested scrollable ANCESTOR (outside the select) also closes it');

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

  // --- CASE 6: the page moving on its own (no wheel, no finger) must NOT close it; the panel follows ---
  await page.evaluate(() => {
    const el = document.getElementById('s');
    el.closeOnScroll = true;
    el.shadowRoot.querySelector('.control').click(); // close the one case 5 left open
  });
  await page.evaluate(() => document.getElementById('s').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 300)); // well past the last wheel of case 5
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await page.evaluate(() => window.scrollBy(0, 60)); // as iOS does to show a focused field over its keyboard
  await new Promise((r) => setTimeout(r, 200));
  ok(await isOpen('s'), 'the page moving on its own (a phone keyboard, a focus, a layout change) does NOT close it');
  const gap = await page.evaluate(() => {
    const root = document.getElementById('s').shadowRoot;
    const panel = root.querySelector('.panel').getBoundingClientRect();
    const control = root.querySelector('.control').getBoundingClientRect();
    return Math.min(Math.abs(panel.top - control.bottom), Math.abs(panel.bottom - control.top));
  });
  ok(gap < 12, `…and the panel stays attached to its control (${Math.round(gap)}px away)`);

  // --- CASE 7: a mouse open still lands in the search, as before ---
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click()); // close
  await new Promise((r) => setTimeout(r, 100));
  const controlCenter = await page.evaluate(() => {
    const r = document.getElementById('s').shadowRoot.querySelector('.control').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(controlCenter.x, controlCenter.y);
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await new Promise((r) => setTimeout(r, 100));
  ok(
    await page.evaluate(() => document.getElementById('s').shadowRoot.activeElement?.classList.contains('search') ?? false),
    'a mouse open still lands in the search, as before'
  );

  // --- CASE 8: a finger opens it WITHOUT focusing the search (no phone keyboard over the list) ---
  const touch = await browser.newPage();
  await touch.setViewport({ width: 390, height: 700, hasTouch: true });
  touch.on('pageerror', (e) => errors.push('' + e));
  await touch.goto(FILE, { waitUntil: 'load', timeout: 15000 });
  await touch.waitForFunction(() => !!document.getElementById('s')?.shadowRoot, { timeout: 5000 });
  await touch.evaluate(() => document.getElementById('s').scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 150));
  const centerOf = (selector) =>
    touch.evaluate((selector) => {
      const r = document.getElementById('s').shadowRoot.querySelector(selector).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, selector);
  const touchOpen = () => touch.evaluate(() => !!document.getElementById('s').shadowRoot.querySelector('.panel'));
  const searchFocused = () =>
    touch.evaluate(() => document.getElementById('s').shadowRoot.activeElement?.classList.contains('search') ?? false);
  const tapControl = await centerOf('.control');
  await touch.touchscreen.tap(tapControl.x, tapControl.y);
  await touch.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await new Promise((r) => setTimeout(r, 100));
  ok(await touchOpen(), 'a finger opens it');
  ok(!(await searchFocused()), 'a finger opens it WITHOUT focusing the search (no phone keyboard over the list)');
  const tapSearch = await centerOf('.search');
  await touch.touchscreen.tap(tapSearch.x, tapSearch.y);
  await new Promise((r) => setTimeout(r, 100));
  ok(await searchFocused(), 'tapping the search focuses it (the keyboard comes only then)');
  await touch.evaluate(() => window.scrollBy(0, 120)); // what iOS does to keep the focused search above its keyboard
  await new Promise((r) => setTimeout(r, 200));
  ok(await touchOpen(), 'the page making room for the keyboard does NOT close it');
  // a finger dragging the page, outside the select, does close it
  const cdp = await touch.createCDPSession();
  await cdp.send('Input.synthesizeScrollGesture', { x: 15, y: 650, yDistance: -200, gestureSourceType: 'touch', speed: 800 });
  await touch.waitForFunction(() => !document.getElementById('s').shadowRoot.querySelector('.panel'), { timeout: 3000 });
  ok(!(await touchOpen()), 'a finger dragging the page closes it');
  await touch.close();

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nScroll-dismiss OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
