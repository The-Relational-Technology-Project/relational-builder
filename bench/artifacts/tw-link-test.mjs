import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&display=swap">
<style type="text/tailwindcss">:root{--font-sans:'Figtree',sans-serif}</style></head><body><div id="x" class="p-8 font-sans">hi</div></body></html>`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log(await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('x')); return cs.paddingTop + ' | ' + cs.fontFamily; }));
await browser.close();
