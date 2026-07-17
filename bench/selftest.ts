import { executeRun } from './lib/execute';
import type { SessionResult } from './lib/session';
import { TASKS } from './tasks';
import type { BenchModel } from './types';

/**
 * `npm run bench -- selftest` — pushes a canned model reply through the FULL
 * downstream pipeline (extraction → edit application → kit merge → esbuild →
 * checks → artifacts → screenshots → review page → report) with zero API
 * calls. Verifies harness health before spending money, and after upgrades.
 *
 * Output goes to bench/results/selftest/ (gitignored).
 */

const MOCK_REPLY = `I'll build a warm little mutual aid board.

\`\`\`html filename="index.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Corner Commons</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
\`\`\`

\`\`\`css filename="src/index.css"
@import "tailwindcss";

@theme inline {
  --color-background: #faf6f0;
  --color-foreground: #2d2a26;
  --color-primary: #b4532a;
}
\`\`\`

\`\`\`tsx filename="src/main.tsx"
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
\`\`\`

\`\`\`tsx filename="src/App.tsx"
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Post {
  id: number;
  kind: 'offer' | 'need';
  category: string;
  text: string;
  who: string;
  fulfilled: boolean;
}

const seedPosts: Post[] = [
  { id: 1, kind: 'offer', category: 'tools', text: 'Ladder and drill to lend, most weekends', who: 'Marisol (Elm St)', fulfilled: false },
  { id: 2, kind: 'need', category: 'rides', text: 'Ride to the clinic Thursday morning', who: 'Gene (4th Ave)', fulfilled: false },
  { id: 3, kind: 'offer', category: 'food', text: 'Extra tomatoes from the garden, porch pickup', who: 'The Okafors', fulfilled: true },
  { id: 4, kind: 'need', category: 'childcare', text: 'After-school pickup help on Tuesdays', who: 'Dana (Oak Ct)', fulfilled: false },
];

export function App() {
  const [posts, setPosts] = useState(seedPosts);
  const [category, setCategory] = useState<string | null>(null);
  const shown = posts.filter(p => !category || p.category === category);
  const categories = ['childcare', 'tools', 'rides', 'food'];

  return (
    <main className="mx-auto max-w-xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Corner Commons</h1>
      <p className="opacity-70">Offers and needs from the neighborhood.</p>
      <div className="flex gap-2 flex-wrap">
        <Button variant={category === null ? 'default' : 'outline'} onClick={() => setCategory(null)}>All</Button>
        {categories.map(c => (
          <Button key={c} variant={category === c ? 'default' : 'outline'} onClick={() => setCategory(c)}>{c}</Button>
        ))}
      </div>
      <ul className="space-y-3">
        {shown.map(p => (
          <li key={p.id} className="rounded-lg border p-3">
            <div className="text-sm uppercase opacity-60">{p.kind} · {p.category}</div>
            <div className={p.fulfilled ? 'line-through opacity-50' : ''}>{p.text}</div>
            <div className="text-sm opacity-70">{p.who}</div>
            <Button size="sm" variant="ghost" onClick={() =>
              setPosts(ps => ps.map(x => x.id === p.id ? { ...x, fulfilled: !x.fulfilled } : x))
            }>
              {p.fulfilled ? 'Reopen' : 'Mark fulfilled'}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
\`\`\`

One refinement to the heading:

\`\`\`edit filename="src/App.tsx"
<<<<<<< SEARCH
      <h1 className="text-2xl font-semibold">Corner Commons</h1>
=======
      <h1 className="text-2xl font-semibold">Corner Commons — Mutual Aid Board</h1>
>>>>>>> REPLACE
\`\`\`

All set — seeded posts, category filter, fulfilled toggle.`;

const MOCK_MODEL: BenchModel = {
  alias: 'mock-model',
  providerId: 'claude',
  modelId: 'mock',
  pricing: { inputPerMTok: 3, outputPerMTok: 15, asOf: 'selftest' },
  enabled: true,
};

const mockSession = async (): Promise<SessionResult> => ({
  segmentTexts: [MOCK_REPLY],
  segments: [{ finishReason: 'stop', latencyMs: 1234, chars: MOCK_REPLY.length }],
  continuations: 0,
  truncatedFinal: false,
  ttftMs: 321,
  latencyMs: 1234,
  sentChars: 4321,
});

export async function runSelftest(): Promise<number> {
  const code = await executeRun({
    models: [MOCK_MODEL],
    tasks: [TASKS[0]],
    trials: 1,
    systemPrompt: '(selftest — no prompt sent anywhere)',
    planSystemPrompt: '',
    planFirst: false,
    outDir: 'bench/results/selftest',
    screenshots: true,
    sessioner: mockSession,
  });
  if (code !== 0) return code;
  console.log(
    '\nSelftest expectations: bundle ✓, 4 files, 0 failed edits, 5/5 checks — inspect the report above.',
  );
  return 0;
}
