import { execFile } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { TrialResult } from '../types';

const execFileP = promisify(execFile);

/**
 * Screenshot each trial's preview.html so report.md (and Claude Code, in
 * chat) can show what every model actually built. Shots land in
 * <runDir>/shots/ — committed, unlike artifacts/.
 *
 * Two paths, tried in order:
 *
 * 1. Playwright (local devDep, or the global install cloud sandboxes ship):
 *    the page's network is intercepted and fulfilled through Node's fetch.
 *    Previews pull React from esm.sh and Tailwind's browser JIT from
 *    jsdelivr, and in proxied sandboxes Chromium's own TLS stack gets
 *    connection-reset by the egress proxy — Node fetch (which honors
 *    HTTPS_PROXY + NODE_EXTRA_CA_CERTS) does not. Interception also gives
 *    ordinary machines cached, deterministic renders.
 * 2. Plain `chromium --screenshot` CLI — fine wherever there's no
 *    intercepting proxy. Skips gracefully if no Chromium exists either.
 */

const CHROMIUM_CANDIDATES = [
  process.env.CHROME_PATH ?? '',
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function findChromium(): Promise<string | null> {
  for (const candidate of CHROMIUM_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- playwright is an
   optional, dynamically-resolved dependency; no types available */
async function loadPlaywright(): Promise<any | null> {
  const candidates = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright/index.mjs',
    '/usr/lib/node_modules/playwright/index.mjs',
    '/usr/local/lib/node_modules/playwright/index.mjs',
  ];
  for (const spec of candidates) {
    try {
      return await import(/* @vite-ignore */ spec);
    } catch {
      /* keep looking */
    }
  }
  return null;
}

interface Target {
  alias: string;
  trial: number;
  previewPath: string;
  outPath: string;
}

async function collectTargets(runDir: string, trials: TrialResult[]): Promise<Target[]> {
  const shotsDir = path.join(runDir, 'shots');
  await mkdir(shotsDir, { recursive: true });
  const targets: Target[] = [];
  for (const t of trials) {
    if (!t.artifactDir) continue;
    const previewPath = path.join(runDir, t.artifactDir, 'preview.html');
    try {
      await access(previewPath);
    } catch {
      continue; // no preview (build failed)
    }
    targets.push({
      alias: t.alias,
      trial: t.trial,
      previewPath,
      outPath: path.join(shotsDir, `${t.alias}-t${t.trial}.png`),
    });
  }
  return targets;
}

async function captureWithPlaywright(pw: any, chromiumPath: string | null, targets: Target[]): Promise<void> {
  const browser = await pw.chromium.launch(
    chromiumPath ? { executablePath: chromiumPath } : {},
  );
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Fulfill every remote request through Node's fetch; cache across trials
    // (each preview pulls the same pinned esm.sh modules).
    const cache = new Map<string, { status: number; contentType: string; body: Buffer }>();
    await context.route('**/*', async (route: any) => {
      const url: string = route.request().url();
      if (!/^https?:/.test(url)) return route.fallback();
      let entry = cache.get(url);
      if (!entry) {
        try {
          const res = await fetch(url, { redirect: 'follow' });
          entry = {
            status: res.status,
            contentType: res.headers.get('content-type') ?? 'application/octet-stream',
            body: Buffer.from(await res.arrayBuffer()),
          };
          cache.set(url, entry);
        } catch {
          return route.abort();
        }
      }
      return route.fulfill({
        status: entry.status,
        contentType: entry.contentType,
        body: entry.body,
      });
    });

    for (const t of targets) {
      const page = await context.newPage();
      try {
        await page.goto(`file://${t.previewPath}`, { waitUntil: 'networkidle', timeout: 60_000 });
        await page.waitForTimeout(1_500); // let Tailwind's JIT + React settle
        await page.screenshot({ path: t.outPath });
        console.log(`  📸 ${t.alias} t${t.trial}`);
      } catch (err) {
        console.warn(
          `  screenshot failed for ${t.alias} t${t.trial}: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function captureWithCli(chromium: string, targets: Target[]): Promise<void> {
  for (const t of targets) {
    try {
      await execFileP(
        chromium,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--hide-scrollbars',
          '--window-size=1280,900',
          '--virtual-time-budget=15000',
          `--screenshot=${t.outPath}`,
          `file://${t.previewPath}`,
        ],
        { timeout: 60_000 },
      );
      console.log(`  📸 ${t.alias} t${t.trial}`);
    } catch (err) {
      console.warn(
        `  screenshot failed for ${t.alias} t${t.trial}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export async function captureScreenshots(runDir: string, trials: TrialResult[]): Promise<void> {
  const targets = await collectTargets(runDir, trials);
  if (targets.length === 0) return;

  const chromiumPath = await findChromium();
  const pw = await loadPlaywright();
  if (pw) {
    await captureWithPlaywright(pw, chromiumPath, targets);
    return;
  }
  if (chromiumPath) {
    console.warn('Playwright not found — falling back to plain Chromium (may miss CDN fetches behind intercepting proxies).');
    await captureWithCli(chromiumPath, targets);
    return;
  }
  console.warn('Screenshots skipped: no Playwright and no Chromium found (set CHROME_PATH to enable).');
}
