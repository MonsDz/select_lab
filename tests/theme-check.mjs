import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ensureBundle } from './fixtures/build-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(path.join(here, 'fixtures/theme.html')).href;

await ensureBundle();

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('  ✓ ' + m); pass++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('' + e));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

const computed = async () =>
  page.evaluate(() => {
    const c = document.getElementById('s').shadowRoot.querySelector('.control');
    const s = getComputedStyle(c);
    return { bg: s.backgroundColor, border: s.borderColor };
  });

try {
  await page.goto(FILE, { waitUntil: 'load', timeout: 15000 });
  await page.waitForFunction(() => !!document.getElementById('s')?.shadowRoot, { timeout: 5000 });

  // LIGHT: the outer-page class must win over the component's internal white/gray defaults
  const light = await computed();
  ok(light.bg === 'rgba(249, 250, 251, 0.3)', `light control bg = boutique translucent neutral-50/30 (got ${light.bg})`);
  ok(light.border === 'rgba(229, 231, 235, 0.3)', `light control border = boutique translucent neutral-200/30 (got ${light.border})`);

  // DARK: toggling the app's .dark class on <html> must flip the tokens too.
  // .control has `transition: border-color .15s ease`, so give it time to settle
  // before reading — otherwise we'd observe a mid-animation interpolated color.
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await new Promise((r) => setTimeout(r, 400));
  const dark = await computed();
  ok(dark.bg === 'rgba(9, 9, 11, 0.3)', `dark control bg = boutique translucent neutral-900/30 (got ${dark.bg})`);
  ok(dark.border === 'rgba(39, 39, 42, 0.3)', `dark control border = boutique translucent neutral-800/30 (got ${dark.border})`);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));

  // HAS-VALUE: picking an option should turn the border to the accent color persistently,
  // even after closing (no focus/open needed) — matching the rest of the app's selects.
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.option').click());
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').blur());
  await new Promise((r) => setTimeout(r, 400));
  const filled = await computed();
  ok(filled.border === 'rgb(99, 102, 241)', `filled (blurred, closed) control border = accent indigo-500 (got ${filled.border})`);

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nTheme cascade OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
