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

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Alma Street Tool Library</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const indexCss = `@import "tailwindcss";

:root {
  /* Vary these values per project — never the names */
  --background: #faf7ee;
  --foreground: #24301f;
  --card: #fffdf6;
  --card-foreground: #24301f;
  --primary: #2f5d3a;
  --primary-foreground: #f3f8ef;
  --secondary: #eee8d6;
  --secondary-foreground: #47523c;
  --muted: #f2edde;
  --muted-foreground: #7d7a66;
  --accent: #e0a028;
  --accent-foreground: #3a2c07;
  --destructive: #b34324;
  --destructive-foreground: #fdf1ec;
  --border: #e6dfc8;
  --input: #d8d0b4;
  --ring: #2f5d3a;
  --radius: 1rem;
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
  font-family: 'Nunito Sans', system-ui, sans-serif;
}

.font-display {
  font-family: 'Young Serif', Georgia, serif;
}`;

const appTsx = `import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Category = 'Yard' | 'Kitchen' | 'Fix-it' | 'Party';

interface Item {
  id: number;
  name: string;
  lender: string;
  door: string;
  note?: string;
  category: Category;
  status: 'available' | 'borrowed';
  statusNote?: string;
}

const seed: Item[] = [
  { id: 1, name: '6-foot ladder', lender: 'Rosa', door: '#214', note: '"just knock"', category: 'Fix-it', status: 'available' },
  { id: 2, name: 'Stand mixer', lender: 'Devon', door: '#208', category: 'Kitchen', status: 'borrowed', statusNote: 'back Friday' },
  { id: 3, name: 'Folding tables (3)', lender: 'Marcus', door: '#202', note: 'great for block parties', category: 'Party', status: 'available' },
  { id: 4, name: 'Pressure washer', lender: 'Nia', door: '#221', note: 'weekends only', category: 'Yard', status: 'available' },
  { id: 5, name: 'Tamale steamer', lender: 'Lupe', door: '#217', note: 'fits 5 dozen', category: 'Kitchen', status: 'available' },
  { id: 6, name: 'Hedge trimmer', lender: 'Sam', door: '#211', category: 'Yard', status: 'borrowed', statusNote: 'back Sunday' },
  { id: 7, name: 'Projector + screen', lender: 'Amara', door: '#205', note: 'movie nights!', category: 'Party', status: 'available' },
  { id: 8, name: 'Stud finder & drill', lender: 'Theo', door: '#219', category: 'Fix-it', status: 'available' },
];

const wanted = [
  { id: 1, name: 'Sewing machine', who: 'Priya', door: '#206', note: 'hemming curtains, any weekend' },
  { id: 2, name: 'Wheelbarrow', who: 'Jules', door: '#224', note: 'moving compost to the corner garden' },
];

const CATEGORIES: Array<'All' | Category> = ['All', 'Yard', 'Kitchen', 'Fix-it', 'Party'];

const catStyles: Record<Category, string> = {
  Yard: 'bg-primary/10 text-primary',
  Kitchen: 'bg-accent/20 text-accent-foreground',
  'Fix-it': 'bg-secondary text-secondary-foreground',
  Party: 'bg-destructive/10 text-destructive',
};

export default function App() {
  const [items, setItems] = useState(seed);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | Category>('All');

  const households = new Set(items.map(i => i.door)).size + 8;

  const visible = useMemo(
    () => items.filter(i =>
      (category === 'All' || i.category === category) &&
      i.name.toLowerCase().includes(query.toLowerCase())
    ),
    [items, query, category],
  );

  function toggle(id: number) {
    setItems(items.map(i => i.id === id
      ? { ...i, status: i.status === 'available' ? 'borrowed' : 'available', statusNote: undefined }
      : i));
  }

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground px-6 pt-10 pb-8 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary-foreground/70">Borrow before you buy</p>
        <h1 className="font-display text-4xl mt-2">Alma Street Tool Library</h1>
        <p className="mt-3 text-sm text-primary-foreground/85">
          {items.length} things shared · {households} households · 41 borrows this spring
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Tabs defaultValue="borrow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="borrow">Borrow</TabsTrigger>
              <TabsTrigger value="wanted">Wanted</TabsTrigger>
              <TabsTrigger value="rules">How it works</TabsTrigger>
            </TabsList>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">＋ Share something</Button>
          </div>

          <TabsContent value="borrow" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search the shelf…"
                className="bg-card max-w-56"
              />
              <div className="flex gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ' +
                      (category === c
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40')
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map(item => (
                <Card key={item.id} className="py-0">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="font-display grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-base text-secondary-foreground">
                      {item.lender[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.lender} · {item.door}{item.note ? ' · ' + item.note : ''}
                      </p>
                      <span className={'mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ' + catStyles[item.category]}>
                        {item.category}
                      </span>
                    </div>
                    <Badge
                      onClick={() => toggle(item.id)}
                      variant="outline"
                      className={item.status === 'available'
                        ? 'cursor-pointer border-primary/30 bg-primary/10 text-primary'
                        : 'cursor-pointer border-accent/40 bg-accent/15 text-accent-foreground'}
                    >
                      {item.statusNote ?? item.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            {visible.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing on the shelf matches yet — maybe yours is the first?
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              One tap on a tag marks it borrowed or returned. Door numbers, not accounts.
            </p>
          </TabsContent>

          <TabsContent value="wanted" className="mt-4 space-y-3">
            {wanted.map(w => (
              <Card key={w.id} className="py-0">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{w.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{w.who} · {w.door} · {w.note}</p>
                  </div>
                  <Button size="sm" variant="outline">I have one</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <Card className="py-0">
              <CardContent className="space-y-2 p-5 text-sm leading-relaxed">
                <p><b>1.</b> Knock, don't ghost — the point is meeting the neighbor, not just getting the ladder.</p>
                <p><b>2.</b> Bring it back how you found it (or cleaner).</p>
                <p><b>3.</b> Broke it? Say so — we'll figure it out together. Nobody keeps score.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
  fe('/index.html', indexHtml, 'html'),
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
      '- A full lending shelf with **Borrow**, **Wanted**, and **How it works** tabs — post what you can lend, and one tap on a tag marks it borrowed or returned',
      '- Search and category chips (Yard, Kitchen, Fix-it, Party) so the shelf stays findable as it grows; door numbers instead of accounts',
      "- The look draws from Alma Street's garden gates: deep green and butter cream with a marigold accent, Young Serif on the headboard",
      '',
      'Try adding your ladder. When it feels right, the **Cloud** tab gives the shelf shared storage so every household sees the same list — then **Publish** puts it on the block.',
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

// ONLY=workspace (comma-separated) re-shoots a subset
const only = process.env.ONLY?.split(',').map(s => s.trim());

async function shoot(label, { width, height }, prepare) {
  if (only && !only.includes(label)) return;
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
