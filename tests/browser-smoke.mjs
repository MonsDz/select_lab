import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:5173/';

let pass = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg);
  console.log('  ✓ ' + msg);
  pass++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 800 });

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('pageerror: ' + String(e)));
page.on('console', (m) => {
  // ignore network resource 404s (favicon / external demo font) — only real JS errors matter
  if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) {
    pageErrors.push('console.error: ' + m.text());
  }
});

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 15000 });

  // Element upgraded?
  await page.waitForFunction(() => !!document.querySelector('#single')?.shadowRoot, { timeout: 5000 });
  ok(true, 'custom element <select-lab> upgraded (has shadowRoot)');

  const sr = () => 0; // marker; real work happens in evaluate below

  // A) Open the dropdown, first page loads.
  await page.evaluate(() => document.querySelector('#single').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.querySelector('#single').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  const A = await page.evaluate(() => {
    const s = document.querySelector('#single').shadowRoot;
    return {
      opts: s.querySelectorAll('.option').length,
      sizer: parseInt(s.querySelector('.sizer').style.height) || 0,
    };
  });
  ok(A.opts > 0 && A.opts < 60, `panel open, options virtualized (${A.opts} DOM nodes, not thousands)`);
  ok(A.sizer >= 44 * 40, `sizer sized to loaded buffer (${A.sizer}px ≈ 50 rows × 44px)`);

  // B) Scroll to bottom → next page appends (buffer grows) while DOM stays bounded.
  await page.evaluate(() => {
    const lb = document.querySelector('#single').shadowRoot.querySelector('.listbox');
    lb.scrollTop = lb.scrollHeight;
    lb.dispatchEvent(new Event('scroll'));
  });
  await page.waitForFunction(
    (prev) => (parseInt(document.querySelector('#single').shadowRoot.querySelector('.sizer').style.height) || 0) > prev,
    { timeout: 5000 },
    A.sizer
  );
  const B = await page.evaluate(() => {
    const s = document.querySelector('#single').shadowRoot;
    return {
      opts: s.querySelectorAll('.option').length,
      sizer: parseInt(s.querySelector('.sizer').style.height) || 0,
    };
  });
  ok(B.sizer > A.sizer, `continuous pagination: buffer grew on scroll (${A.sizer}px → ${B.sizer}px)`);
  ok(B.opts < 60, `DOM node count still bounded after paging (${B.opts})`);

  // C) Click outside closes the panel.
  await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForFunction(
    () => !document.querySelector('#single').shadowRoot.querySelector('.panel'),
    { timeout: 3000 }
  );
  ok(true, 'click outside collapses the dropdown');

  // D) Reopen and pick an option → emits scalar value (display ≠ returned value), then closes.
  await page.evaluate(() => document.querySelector('#single').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.querySelector('#single').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  const picked = await page.evaluate(() => {
    const s = document.querySelector('#single').shadowRoot;
    const first = s.querySelector('.option');
    const labelText = first.querySelector('.label')?.textContent ?? '';
    first.click();
    return { labelText };
  });
  await page.waitForFunction(
    () => /value:\s*\d+/.test(document.querySelector('#single-out').textContent),
    { timeout: 3000 }
  );
  const out = await page.$eval('#single-out', (e) => e.textContent);
  ok(/value:\s*\d+/.test(out), `selecting emits the scalar id — displayed "${picked.labelText.trim()}", returned ${out}`);
  ok(
    await page.evaluate(() => !document.querySelector('#single').shadowRoot.querySelector('.panel')),
    'single-select closes after choosing'
  );

  // E) Server-side search filters results.
  await page.evaluate(() => document.querySelector('#single').shadowRoot.querySelector('.control').click());
  await page.waitForFunction(
    () => document.querySelector('#single').shadowRoot.querySelector('.search'),
    { timeout: 3000 }
  );
  await page.evaluate(() => {
    const inp = document.querySelector('#single').shadowRoot.querySelector('.search');
    inp.value = '#100';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(
    () => {
      const opts = document.querySelector('#single').shadowRoot.querySelectorAll('.option');
      return opts.length > 0 && [...opts].some((o) => o.textContent.includes('100'));
    },
    { timeout: 5000 }
  );
  ok(true, 'debounced search returns filtered results');

  // F) Multi-select emits an array.
  await page.evaluate(() => {
    const m = document.querySelector('#multi').shadowRoot;
    m.querySelector('.control').click();
  });
  await page.waitForFunction(
    () => document.querySelector('#multi').shadowRoot.querySelectorAll('.option').length > 0,
    { timeout: 5000 }
  );
  await page.evaluate(() => {
    const opts = document.querySelector('#multi').shadowRoot.querySelectorAll('.option');
    opts[0].click();
    opts[1].click();
  });
  await page.waitForFunction(
    () => /value:\s*\[.+\]/.test(document.querySelector('#multi-out').textContent),
    { timeout: 3000 }
  );
  const mout = await page.$eval('#multi-out', (e) => e.textContent);
  ok(/value:\s*\[\s*\d+\s*,\s*\d+\s*\]/.test(mout), `multi-select emits an array — ${mout}`);
  const chips = await page.evaluate(
    () => document.querySelector('#multi').shadowRoot.querySelectorAll('.chip').length
  );
  ok(chips === 2, `multi-select renders ${chips} chips`);

  ok(pageErrors.length === 0, 'no runtime/page errors during the whole flow');
  console.log(`\nAll ${pass} browser assertions passed.`);
} catch (err) {
  console.error('\n✗ ' + err.message);
  if (pageErrors.length) console.error('Page errors:\n' + pageErrors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
