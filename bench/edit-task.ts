import type { TaskCheck } from './task';

/**
 * Edit bench — the v2 gap the README named: the headline task measures
 * first-build quality, this one measures EDIT DISCIPLINE against a frozen
 * seed project.
 *
 * Why it needs to exist separately: editing is where community volume lives
 * (a build happens once, edits happen all afternoon), and it rewards almost
 * the opposite instincts. A first build is judged on ambition and finish; an
 * edit is judged on restraint — change exactly what was asked, touch nothing
 * else, and use a surgical SEARCH/REPLACE rather than re-emitting a 200-line
 * file. Those failures are invisible to the build task: a model that rewrites
 * every file on every edit still bundles ✓ and still passes every check, while
 * costing several times as much and quietly reformatting the builder's app.
 *
 * The seed below is deliberately hand-written and frozen rather than lifted
 * from a live build, so numbers stay comparable across runs (same stability
 * rule as the headline task). It is split across files on purpose: "which
 * file did it touch" is only measurable if there is more than one.
 */

export const EDIT_SEED_VERSION = 'edit-seed-v1';

const INDEX_HTML = `<!doctype html>
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
`;

const INDEX_CSS = `@import "tailwindcss";

@theme inline {
  --color-background: #faf6f0;
  --color-foreground: #2d2a26;
  --color-card: #fffdfa;
  --color-card-foreground: #2d2a26;
  --color-primary: #b4532a;
  --color-primary-foreground: #fffdfa;
  --color-muted: #f0e8dd;
  --color-muted-foreground: #6b6156;
  --color-border: #e2d6c7;
  --radius: 0.5rem;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: 'Iowan Old Style', Georgia, serif;
}
`;

const MAIN_TSX = `import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
`;

const SEED_TS = `export interface Post {
  id: number;
  kind: 'offer' | 'need';
  category: string;
  text: string;
  who: string;
  block: string;
  fulfilled: boolean;
}

export const CATEGORIES = ['childcare', 'tools', 'rides', 'food'];

export const SEED_POSTS: Post[] = [
  { id: 1, kind: 'offer', category: 'tools', text: 'Ladder and drill to lend, most weekends', who: 'Marisol', block: 'Elm St', fulfilled: false },
  { id: 2, kind: 'need', category: 'rides', text: 'Ride to the clinic Thursday morning', who: 'Gene', block: '4th Ave', fulfilled: false },
  { id: 3, kind: 'offer', category: 'food', text: 'Extra tomatoes from the garden, porch pickup', who: 'The Okafors', block: 'Elm St', fulfilled: true },
  { id: 4, kind: 'need', category: 'childcare', text: 'After-school pickup help on Tuesdays', who: 'Dana', block: 'Oak Ct', fulfilled: false },
];
`;

const POST_CARD_TSX = `import { Button } from '@/components/ui/button';
import type { Post } from '@/data/seed';

export function PostCard({ post, onToggle }: { post: Post; onToggle: (id: number) => void }) {
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="text-sm uppercase tracking-wide text-muted-foreground">
        {post.kind} · {post.category}
      </div>
      <div className={post.fulfilled ? 'line-through opacity-50' : ''}>{post.text}</div>
      <div className="text-sm text-muted-foreground">
        {post.who} · {post.block}
      </div>
      <Button size="sm" variant="ghost" onClick={() => onToggle(post.id)}>
        {post.fulfilled ? 'Reopen' : 'Mark fulfilled'}
      </Button>
    </li>
  );
}
`;

const APP_TSX = `import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/PostCard';
import { CATEGORIES, SEED_POSTS } from '@/data/seed';

export function App() {
  const [posts, setPosts] = useState(SEED_POSTS);
  const [category, setCategory] = useState<string | null>(null);
  const shown = posts.filter(p => !category || p.category === category);

  const toggle = (id: number) =>
    setPosts(ps => ps.map(x => (x.id === id ? { ...x, fulfilled: !x.fulfilled } : x)));

  return (
    <main className="mx-auto max-w-xl p-4 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Corner Commons</h1>
        <p className="text-muted-foreground">Offers and needs from the neighborhood.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant={category === null ? 'default' : 'outline'} onClick={() => setCategory(null)}>
          All
        </Button>
        {CATEGORIES.map(c => (
          <Button key={c} variant={category === c ? 'default' : 'outline'} onClick={() => setCategory(c)}>
            {c}
          </Button>
        ))}
      </div>

      <ul className="space-y-3">
        {shown.map(p => (
          <PostCard key={p.id} post={p} onToggle={toggle} />
        ))}
      </ul>
    </main>
  );
}
`;

/** The frozen project every edit task starts from. Paths are VFS-absolute,
 *  exactly as the project store holds them. */
export const EDIT_SEED_FILES: Record<string, string> = {
  '/index.html': INDEX_HTML,
  '/src/index.css': INDEX_CSS,
  '/src/main.tsx': MAIN_TSX,
  '/src/data/seed.ts': SEED_TS,
  '/src/components/PostCard.tsx': POST_CARD_TSX,
  '/src/App.tsx': APP_TSX,
};

/** Files an edit legitimately needs to touch, per task. Anything else the
 *  model rewrites counts as collateral. */
export interface EditSpec {
  id: string;
  prompt: string;
  /** Paths the change can reasonably land in */
  targets: string[];
  checks: TaskCheck[];
}

const stillBundlesCheck: TaskCheck = {
  id: 'seed-intact',
  description: 'Seed data still present (edit did not wipe the project)',
  test: files => /Marisol/.test(files['/src/data/seed.ts'] ?? ''),
};

export const EDIT_TASKS: EditSpec[] = [
  {
    // The single most common edit a non-technical builder makes, and the one
    // Leslie made repeatedly: change words on the page, nothing else.
    id: 'edit-copy',
    prompt:
      'Change the heading from "Corner Commons" to "Maple Street Commons", and ' +
      'change the line underneath it to "What neighbors have, and what neighbors need." ' +
      'Leave everything else exactly as it is.',
    targets: ['/src/App.tsx'],
    checks: [
      {
        id: 'copy-landed',
        description: 'Both new strings present',
        test: files => {
          const app = files['/src/App.tsx'] ?? '';
          return (
            app.includes('Maple Street Commons') &&
            app.includes('What neighbors have, and what neighbors need.')
          );
        },
      },
      {
        id: 'old-copy-gone',
        description: 'Old heading text removed',
        test: files => !/>Corner Commons</.test(files['/src/App.tsx'] ?? ''),
      },
      stillBundlesCheck,
    ],
  },
  {
    // A small feature add: touches data + a component, so it tests whether
    // the model can thread a change through two files without rewriting six.
    id: 'edit-feature',
    prompt:
      'Add an "urgent" flag to posts. Urgent needs should show a small badge on ' +
      'their card so they stand out. Mark Gene\'s clinic ride as urgent in the ' +
      'seeded data. Keep the existing look and don\'t change anything else.',
    targets: ['/src/data/seed.ts', '/src/components/PostCard.tsx'],
    checks: [
      {
        id: 'urgent-in-data',
        description: 'urgent field added to the Post data',
        test: files => /urgent/i.test(files['/src/data/seed.ts'] ?? ''),
      },
      {
        id: 'urgent-in-ui',
        description: 'Card renders something for urgent',
        test: files => /urgent/i.test(files['/src/components/PostCard.tsx'] ?? ''),
      },
      stillBundlesCheck,
    ],
  },
  {
    // A restyle: the theme contract says this should be a values-only edit to
    // index.css. A model that instead rewrites every component's classNames
    // has misunderstood the whole token design.
    id: 'edit-restyle',
    prompt:
      'Make it feel cooler and more coastal — foggy blues and sea glass instead ' +
      'of the warm browns — and square off the corners. Keep the layout and the ' +
      'content exactly as they are.',
    targets: ['/src/index.css'],
    checks: [
      {
        id: 'palette-changed',
        description: 'Theme values differ from the seed',
        test: files => (files['/src/index.css'] ?? '').indexOf('#b4532a') === -1,
      },
      {
        id: 'layout-untouched',
        description: 'App.tsx structure preserved (max-w-xl container still there)',
        test: files => /max-w-xl/.test(files['/src/App.tsx'] ?? ''),
      },
      stillBundlesCheck,
    ],
  },
];
