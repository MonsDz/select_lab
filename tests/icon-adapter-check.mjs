import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ensureBundle } from './fixtures/build-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(path.join(here, 'fixtures/icon-adapter.html')).href;

await ensureBundle();

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('  ✓ ' + m); pass++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('' + e));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

try {
  await page.goto(FILE, { waitUntil: 'load', timeout: 15000 });

  // (A) third-party custom-element icon library upgrades inside our shadow root
  await page.evaluate(() => document.getElementById('ce').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('ce').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  const a = await page.evaluate(() => {
    const s = document.getElementById('ce').shadowRoot;
    const custom = s.querySelector('fake-lib-icon');
    return {
      tagFound: !!custom,
      upgraded: custom ? custom.matches(':defined') : false,
      renderedInner: custom ? !!custom.querySelector('svg.upgraded-mark') : false,
    };
  });
  ok(a.tagFound, 'a foreign <fake-lib-icon> tag placed in the icon field made it into the shadow DOM');
  ok(a.upgraded, 'that element is :defined (the global custom-element registry upgraded it inside our shadow root)');
  ok(a.renderedInner, "the library's own connectedCallback() ran and rendered its markup");

  // (B) iconRenderer hook: fully custom rendering path, e.g. an FA-style API
  await page.evaluate(() => document.getElementById('fn').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('fn').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  const b = await page.evaluate(() => {
    const s = document.getElementById('fn').shadowRoot;
    const svg = s.querySelector('svg.fa-generated');
    return { found: !!svg, color: svg ? getComputedStyle(svg).color : '(none)' };
  });
  ok(b.found, 'iconRenderer hook output (simulated FA-style API) rendered inside the option row');
  ok(b.color === 'rgb(245, 158, 11)', `iconRenderer result still receives the per-item icon color (${b.color})`);

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nIcon adapter OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
