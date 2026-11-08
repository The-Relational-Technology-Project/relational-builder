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
  label: string;
  /** shotName(trial): the key runtime checks are returned under */
  key: string;
  previewPath: string;
  outPath: string;
}

export type RuntimeCheck = NonNullable<TrialResult['runtime']>;
export type RuntimeChecks = Record<string, RuntimeCheck>;

/** Shot filename shared with report.ts — task-qualified since a run can mix tasks */
export const shotName = (t: Pick<TrialResult, 'taskId' | 'alias' | 'trial'>): string =>
  `${t.taskId}--${t.alias}-t${t.trial}.png`;

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
      label: `${t.taskId} · ${t.alias} t${t.trial}`,
      key: shotName(t),
      previewPath,
      outPath: path.join(shotsDir, shotName(t)),
    });
  }
  return targets;
}

async function captureWithPlaywright(pw: any, chromiumPath: string | null, targets: Target[]): Promise<RuntimeChecks> {
  const checks: RuntimeChecks = {};
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
      // The screenshot is also the runtime check: a build that bundles can
      // still throw on load (an icon never imported, an unknown Tailwind
      // utility that voids the stylesheet). Record what the browser saw.
      const errors: string[] = [];
      const note = (kind: string, text: string) => {
        if (errors.length < 6) errors.push(`${kind}: ${text.replace(/\s+/g, ' ').slice(0, 220)}`);
      };
      page.on('pageerror', (e: Error) => note('pageerror', e.message));
      page.on('console', (m: { type(): string; text(): string }) => {
        // A resource 404 (a stylesheet link or favicon the shell never
        // serves under file://) is not the app failing; the bundle already
        // carries the CSS. Only the app's own errors count.
        if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) note('console', m.text());
      });
      try {
        await page.goto(`file://${t.previewPath}`, { waitUntil: 'networkidle', timeout: 60_000 });
        await page.waitForTimeout(1_500); // let Tailwind's JIT + React settle
        await page.screenshot({ path: t.outPath });
        const bodyText: string = await page
          .evaluate(() => (document.body?.innerText ?? '').trim())
          .catch(() => '');
        const bodyChars = bodyText.length;
        // A page whose Tailwind classes did nothing: the stylesheet failed
        // to compile, so the app opens as raw HTML (Nov 6: a gemma build
        // looked like a 1995 page and still counted as clean)
        const unstyled: boolean = await page
          .evaluate(() => {
            // Form controls carry browser padding and backgrounds of their
            // own, so only plain elements say whether the classes took
            const els = Array.from(document.querySelectorAll('div[class],section[class],main[class],header[class],nav[class],span[class],li[class],ul[class]'))
              .filter(e => /\b(p|px|py|gap|rounded|bg)-/.test(String((e as HTMLElement).className || '')))
              .slice(0, 40);
            if (els.length < 5) return false;
            const styled = els.filter(e => {
              const cs = getComputedStyle(e as HTMLElement);
              return cs.paddingTop !== '0px' || cs.paddingLeft !== '0px' || cs.borderRadius !== '0px' || cs.rowGap !== 'normal' || cs.columnGap !== 'normal' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
            });
            return styled.length === 0;
          })
          .catch(() => false);
        if (unstyled) note('style', 'the page rendered without its styles (Tailwind classes had no effect)');
        // A page that opens on its own 404 is a routing failure the console
        // never reports (BrowserRouter under a file or blob path)
        if (bodyChars < 400 && /\b(page not found|not found|404)\b/i.test(bodyText)) {
          note('route', 'the page opened on "Page not found" (a BrowserRouter under a file or blob path; HashRouter is the rule)');
        }
        // Every comparison prompt asks for seeded content, so a real page
        // carries hundreds of visible characters; a header with nothing
        // under it (gpt-oss, Nov 3: 21 chars, a title and a name picker)
        // is a shell, not a rendered app
        const rendered = bodyChars >= 60;
        const aboveFoldChars: number = await page
          .evaluate(() => {
            const h = window.innerHeight;
            let n = 0;
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const text = (node.textContent ?? '').trim();
              const el = node.parentElement;
              if (!text || !el) continue;
              const cs = getComputedStyle(el);
              if (cs.visibility === 'hidden' || cs.display === 'none') continue;
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0 && r.top < h && r.bottom > 0) n += text.length;
            }
            return n;
          })
          .catch(() => 0);
        checks[t.key] = { rendered, errors, bodyChars, aboveFoldChars };
        const verdict = bodyChars < 20 ? 'blank page' : !rendered ? `shell only (${bodyChars} chars of text)` : errors.length ? `renders, ${errors.length} error(s)` : 'renders clean';
        console.log(`  📸 ${t.label} · ${verdict}`);
      } catch (err) {
        console.warn(
          `  screenshot failed for ${t.label}: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return checks;
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
      console.log(`  📸 ${t.label}`);
    } catch (err) {
      console.warn(
        `  screenshot failed for ${t.label}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Screenshot every trial that has a preview and return what the browser saw
 * per trial (keyed by shotName), for the caller to store on the trials. The
 * plain-Chromium fallback cannot observe errors and returns {}.
 */
export async function captureScreenshots(runDir: string, trials: TrialResult[]): Promise<RuntimeChecks> {
  const targets = await collectTargets(runDir, trials);
  if (targets.length === 0) return {};

  const chromiumPath = await findChromium();
  const pw = await loadPlaywright();
  if (pw) {
    return captureWithPlaywright(pw, chromiumPath, targets);
  }
  if (chromiumPath) {
    console.warn('Playwright not found — falling back to plain Chromium (may miss CDN fetches behind intercepting proxies).');
    await captureWithCli(chromiumPath, targets);
    return {};
  }
  console.warn('Screenshots skipped: no Playwright and no Chromium found (set CHROME_PATH to enable).');
  return {};
}

/** Attach runtime checks to their trials (by shot name). Returns how many matched. */
export function applyRuntimeChecks(trials: TrialResult[], checks: RuntimeChecks): number {
  let n = 0;
  for (const t of trials) {
    const c = checks[shotName(t)];
    if (c) { t.runtime = c; n++; }
  }
  return n;
}
