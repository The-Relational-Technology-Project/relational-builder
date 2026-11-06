import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const tw = process.argv[2];
const cases = {
  none: `:root{--background:#eee}`,
  fontNoSemi: `@import url('https://fonts.googleapis.com/css2?family=Figtree&display=swap');\n:root{--background:#eee}`,
  fontSemi: `@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&display=swap');\n:root{--background:#eee}`,
  fontSemiAfterRule: `:root{--background:#eee}\n@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&display=swap');`,
};
const browser = await chromium.launch();
for (const [name, css] of Object.entries(cases)) {
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  await page.setContent(`<!doctype html><html><head><script src="${tw}"></script><style type="text/tailwindcss">${css}</style></head><body><div id="x" class="p-8 rounded-lg">hi</div></body></html>`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const pad = await page.evaluate(() => getComputedStyle(document.getElementById('x')).paddingTop);
  console.log(name.padEnd(18), 'padding', pad, errs.length ? 'ERR ' + errs[0] : '');
  await page.close();
}
await browser.close();
