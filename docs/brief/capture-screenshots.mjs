/**
 * Regenerates the three product screenshots in images/ against a local dev
 * server, using the real app and the real preview engine — no mockups.
 *
 *   VITE_ACCESS_CODE=6767 npm run dev -- --port 5199 --strictPort   # in the repo root
 *   npm i playwright-core                                            # anywhere once
 *   NODE_USE_ENV_PROXY=1 node docs/brief/capture-screenshots.mjs
 *
 * Staging notes (all local-only, nothing is sent anywhere):
 * - A placeholder API key is planted in localStorage so the composer renders
 *   the way a signed-in community builder sees it (no "add your API key" hint).
 * - The workspace shot injects a small demo project (Alma Street Tool Library,
 *   built on the RB kit) plus its chat transcript; the preview genuinely
 *   bundles and runs it via the esbuild engine.
 * - The gallery shot removes the one library card that has no screenshot,
 *   so the grid starts clean; everything else is live commons data.
 */
import { chromium } from 'playwright-core';

const OUT = new URL('./images/', import.meta.url).pathname;
const APP = process.env.APP_URL ?? 'http://localhost:5199/';
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';

const indexCss = `@import "tailwindcss";

:root {
  /* Vary these values per project — never the names */
  --background: #faf5ec;
  --foreground: #292018;
  --card: #fffdf8;
  --card-foreground: #292018;
  --primary: #b4552d;
  --primary-foreground: #fdf3ec;
  --secondary: #efe6d6;
  --secondary-foreground: #4a3a2c;
  --muted: #f2ebdd;
  --muted-foreground: #85715c;
  --accent: #3d6b4f;
  --accent-foreground: #f0f7f1;
  --destructive: #b91c1c;
  --destructive-foreground: #fef2f2;
  --border: #e8ddc9;
  --input: #d9ccb4;
  --ring: #b4552d;
  --radius: 0.75rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

body {
  background: var(--background);
  color: var(--foreground);
}`;

const appTsx = `import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Item {
  id: number;
  name: string;
  lender: string;
  door: string;
  note?: string;
  status: 'available' | 'borrowed';
  statusNote?: string;
}

const seed: Item[] = [
  { id: 1, name: '6-foot ladder', lender: 'Rosa', door: '#214', note: '"just knock"', status: 'available' },
  { id: 2, name: 'Stand mixer', lender: 'Devon', door: '#208', status: 'borrowed', statusNote: 'back Friday' },
  { id: 3, name: 'Folding tables (3)', lender: 'Marcus', door: '#202', note: 'great for block parties', status: 'available' },
  { id: 4, name: 'Pressure washer', lender: 'Nia', door: '#221', note: 'weekends only', status: 'available' },
];

export default function App() {
  const [items, setItems] = useState(seed);
  const [draft, setDraft] = useState('');

  const households = new Set(items.map(i => i.door)).size + 10;

  function share() {
    const name = draft.trim();
    if (!name) return;
    setItems([{ id: Date.now(), name, lender: 'You', door: '#—', status: 'available' }, ...items]);
    setDraft('');
  }

  function toggle(id: number) {
    setItems(items.map(i => i.id === id
      ? { ...i, status: i.status === 'available' ? 'borrowed' : 'available', statusNote: undefined }
      : i));
  }

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground px-6 py-8 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Alma Street Tool Library</h1>
        <p className="mt-1 text-sm opacity-90">Borrow before you buy — {households} households sharing so far</p>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6 space-y-5">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && share()}
            placeholder="What can you lend? e.g. 6-foot ladder"
            className="bg-card"
          />
          <Button onClick={share} className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
            Share it
          </Button>
        </div>

        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <span className={item.status === 'available' ? 'size-2.5 rounded-full bg-accent shrink-0' : 'size-2.5 rounded-full bg-primary/50 shrink-0'} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.lender} · {item.door}{item.note ? ' · ' + item.note : ''}
                  </p>
                </div>
                <Badge
                  onClick={() => toggle(item.id)}
                  className={item.status === 'available'
                    ? 'cursor-pointer bg-accent/15 text-accent border-accent/30'
                    : 'cursor-pointer bg-secondary text-secondary-foreground'}
                  variant="outline"
                >
                  {item.statusNote ?? item.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          One tap on a tag marks it borrowed or returned. Door numbers, not accounts.
        </p>
      </main>
    </div>
  );
}`;

const mainTsx = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);`;

// stage the chat at a believable early-evening moment
const eve = new Date();
eve.setHours(18, 7, 0, 0);
const now = eve.getTime();

const fe = (path, content, language) => ({ path, content, language, createdAt: now, updatedAt: now });
const projectFiles = [
  fe('/src/main.tsx', mainTsx, 'tsx'),
  fe('/src/App.tsx', appTsx, 'tsx'),
  fe('/src/index.css', indexCss, 'css'),
];

const chatMessages = [
  {
    id: 'm1',
    role: 'user',
    content: 'Our block keeps buying things we could share. Can you build a tool library board for Alma Street?',
    timestamp: now - 90_000,
  },
  {
    id: 'm2',
    role: 'assistant',
    content: [
      'Love this — a lending board is classic relational tech: the ladder is the excuse, the knock on the door is the point.',
      '',
      '**What changed**',
      '- A warm, single-page board: post what you can lend, one tap to mark it borrowed or returned',
      '- Door numbers, not accounts — neighbors just say who they are',
      '',
      'Try adding your ladder — then we could add a "wanted" list, or print a flyer for the corkboard so the whole block knows.',
    ].join('\n'),
    timestamp: now - 30_000,
  },
];

const projectState = {
  state: {
    fs: projectFiles,
    selectedFile: '/src/App.tsx',
    version: 3,
    lineage: null,
    checkpoints: [
      { id: 'cp1', msgId: 'm2', label: 'Tool library board', timestamp: now - 28_000, files: projectFiles },
    ],
    activeCheckpointId: 'cp1',
  },
  version: 0,
};
const chatState = { state: { messages: chatMessages, mode: 'build', sharingPlanSaved: false }, version: 0 };
const providerState = {
  state: { activeProviderId: 'claude', activeModelId: 'claude-opus-4-8', apiKeys: { claude: 'staged-for-screenshot' }, modelPinned: false },
  version: 0,
};

// In the remote sandbox the browser can't CONNECT out; bridge through Node's fetch.
async function bridge(ctx) {
  await ctx.route(/^https:\/\/(?!localhost)/, async route => {
    const req = route.request();
    try {
      const res = await fetch(req.url(), { method: req.method(), headers: req.headers() });
      const body = Buffer.from(await res.arrayBuffer());
      const headers = {};
      res.headers.forEach((v, k) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) headers[k] = v;
      });
      await route.fulfill({ status: res.status, headers, body });
    } catch {
      await route.abort();
    }
  });
}

const browser = await chromium.launch({ executablePath: CHROMIUM });

async function shoot(label, { width, height }, prepare) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: 'light' });
  await bridge(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error(`[${label}] pageerror:`, e.message));
  await page.goto(APP);
  await page.evaluate(p => {
    localStorage.setItem('rb-entered', '1');
    localStorage.setItem('rb-provider-config', JSON.stringify(p));
  }, providerState);
  await prepare(page);
  await page.screenshot({ path: `${OUT}${label}.png` });
  await ctx.close();
  console.log(`${label} done`);
}

// 1. the front door — home composer
await shoot('home', { width: 1560, height: 800 }, async page => {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
});

// 2. the Studio Gallery, live commons data
await shoot('gallery', { width: 1560, height: 1040 }, async page => {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Gallery' }).first().click();
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('div,article')];
    const el = cards.find(c => c.textContent?.includes('Relational Tech Process Guide') && c.querySelector('button') && c.textContent.length < 600);
    el?.remove();
  });
  // nudge lazy card images into loading, then settle back at the top
  await page.evaluate(() => { const s = document.querySelector('.h-full.overflow-y-auto'); if (s) s.scrollTop = 600; });
  await page.waitForTimeout(1800);
  await page.evaluate(() => { const s = document.querySelector('.h-full.overflow-y-auto'); if (s) s.scrollTop = 0; });
  await page.waitForTimeout(2500);
});

// 3. the workspace — staged project, genuinely bundled and rendered live
await shoot('workspace', { width: 1560, height: 975 }, async page => {
  await page.evaluate(([proj, chat]) => {
    localStorage.setItem('relational-builder-project', JSON.stringify(proj));
    localStorage.setItem('relational-builder-chat', JSON.stringify(chat));
  }, [projectState, chatState]);
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(20000); // esbuild-wasm init + esm.sh fetches
});

await browser.close();
