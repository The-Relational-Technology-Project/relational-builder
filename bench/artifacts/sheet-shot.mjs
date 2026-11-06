import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(1000);
await p.screenshot({ path: process.argv[3], fullPage: false }); await b.close();
