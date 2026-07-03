import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ensureBundle } from './fixtures/build-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(path.join(here, 'fixtures/icon-modes.html')).href;

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
  await page.waitForFunction(() => !!document.getElementById('s')?.shadowRoot, { timeout: 5000 });
  await page.evaluate(() => document.getElementById('s').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.getElementById('s').shadowRoot.querySelectorAll('.option').length >= 3,
    { timeout: 5000 }
  );

  const r = await page.evaluate(() => {
    const s = document.getElementById('s').shadowRoot;
    const opts = s.querySelectorAll('.option');
    const glyph = opts[0].querySelector('.icon-glyph');
    const emoji = opts[1].querySelector('.icon-glyph');
    const svg = opts[2].querySelector('svg');
    return {
      fontFamily: glyph ? getComputedStyle(glyph).fontFamily : '(none)',
      glyphColor: glyph ? getComputedStyle(glyph).color : '(none)',
      emojiText: emoji ? emoji.textContent : '(none)',
      svgTag: svg ? svg.tagName.toLowerCase() : '(none)',
      svgColor: svg ? getComputedStyle(svg).color : '(none)',
    };
  });

  // 1) Icon-font via token pierces Shadow DOM (this is the bug that was breaking Material Symbols)
  ok(/Material Symbols/i.test(r.fontFamily), `ligature icon-font applied inside shadow DOM (font-family = ${r.fontFamily})`);
  // 2) per-item color reaches the glyph
  ok(r.glyphColor === 'rgb(239, 68, 68)', `per-item icon color applied (${r.glyphColor})`);
  // 3) raw SVG markup renders as a real <svg> node, inheriting currentColor
  ok(r.svgTag === 'svg', 'raw SVG markup rendered as an <svg> element');
  ok(r.svgColor === 'rgb(16, 185, 129)', `SVG inherits per-item color via currentColor (${r.svgColor})`);
  // 4) emoji still renders as text
  ok(r.emojiText === '🏢', 'emoji renders as-is');

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nIcon modes OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
