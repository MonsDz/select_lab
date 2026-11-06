import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { ensureBundle } from './fixtures/build-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FILE = pathToFileURL(path.join(here, 'fixtures/icon-security.html')).href;

await ensureBundle();

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('  ✓ ' + m); pass++; };

const RUN = 'window.pwned=1';
const hostile = [
  `<img src=x onerror="${RUN}">`,
  `<img src="/a.png" onload="${RUN}">`,
  `<svg onload="${RUN}"></svg>`,
  `<svg><script>${RUN}</script></svg>`,
  `<svg><animate onbegin="${RUN}" attributeName="x" dur="1s"></animate></svg>`,
  `<svg><set attributeName="onmouseover" to="${RUN}"></set></svg>`,
  `<svg><a href="javascript:${RUN}"><circle r="4"></circle></a></svg>`,
  `<svg><use href="data:image/svg+xml,x"></use></svg>`,
  `<svg><foreignObject><iframe srcdoc="<script>parent.${RUN}</script>"></iframe></foreignObject></svg>`,
  `<svg><title><img src=x onerror="${RUN}"></title></svg>`,
  `<svg><style>@import url(https://example.invalid/x.css);</style></svg>`,
  `<svg style="background:url(https://example.invalid/x)"></svg>`,
  `<svg><circle fill="url(https://example.invalid/x#a)" r="4"></circle></svg>`,
  `<svg></p><style><a id="</style><img src=1 onerror=${RUN}>">`,
  `<math><mtext><table><mglyph><style><img src=1 onerror=${RUN}>`,
  `<iframe srcdoc="<script>parent.${RUN}</script>"></iframe>`,
  `<div onclick="${RUN}">x</div>`,
  `<span onmouseover="${RUN}"></span>`,
  `<i style="position:fixed;inset:0"></i>`,
  `<span><img src=x onerror="${RUN}"></span>`,
  `<x-icon onclick="${RUN}"></x-icon>`,
  `<x-icon name="<img src=x onerror=${RUN}>"></x-icon>`,
  `<x-icon src="https://example.invalid/x.svg"></x-icon>`,
  `<img src="javascript:${RUN}">`,
  `<svg></svg><img src=x onerror="${RUN}">`,
];

const safe = [
  ['status dot used by estimates', '<svg viewBox="0 0 8 8" width="8" height="8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>', 'svg'],
  ['Font Awesome SVG', '<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="house" class="svg-inline--fa" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M0 0h576v512H0z"></path></svg>', 'svg'],
  ['icon library tag', '<ion-icon name="home-outline" size="large"></ion-icon>', 'ion-icon'],
  ['iconify tag', '<iconify-icon icon="mdi:home" width="24"></iconify-icon>', 'iconify-icon'],
  ['class-based glyph', '<i class="fa fa-home"></i>', 'i'],
  ['ligature in a span', '<span class="material-symbols-rounded">home</span>', 'span'],
  ['image tag', '<img src="/logo.png" alt="">', 'img'],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const errors = [];
const warnings = [];
page.on('pageerror', (e) => errors.push('' + e));
page.on('console', (m) => {
  if (m.type() === 'warn') warnings.push(m.text());
  if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
});

const show = (id, icon) =>
  page.evaluate(
    async (id, icon) => {
      const el = document.getElementById(id);
      el.items = [{ value: '1', label: 'Row', icon }];
      el.open = true;
      await el.updateComplete;
      await new Promise((r) => setTimeout(r, 60));
      const row = el.shadowRoot.querySelector('.option');
      const iconEl = row?.querySelector('.icon-html');
      const out = { rendered: !!iconEl, tag: iconEl?.firstElementChild?.localName ?? null };
      el.open = false;
      await el.updateComplete;
      return out;
    },
    id,
    icon
  );

try {
  await page.goto(FILE, { waitUntil: 'load', timeout: 15000 });
  await page.waitForFunction(() => !!document.getElementById('strict')?.shadowRoot, { timeout: 5000 });

  for (const value of hostile) {
    const r = await show('strict', value);
    ok(!r.rendered, `blocked by default: ${value.slice(0, 66)}`);
  }
  await new Promise((r) => setTimeout(r, 200));
  ok((await page.evaluate(() => window.pwned)) === undefined, 'no hostile value ran any code');
  ok(warnings.filter((w) => w.includes('allow-icon-html')).length === 1, 'the developer is told once how to allow markup');

  for (const [name, value, tag] of safe) {
    const r = await show('strict', value);
    ok(r.rendered && r.tag === tag, `still works with no attribute: ${name}`);
  }

  const trusted = await show('trusted', '<b>custom</b>');
  ok(trusted.rendered && trusted.tag === 'b', 'allow-icon-html renders any markup, as a deliberate choice');

  ok(errors.length === 0, 'no runtime errors');
  console.log(`\nIcon security OK — ${pass} checks passed.`);
} catch (e) {
  console.error('\n✗ ' + e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
