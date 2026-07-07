/**
 * Dev-only spike harness for the in-browser bundler (spike.html).
 * Bundles a realistic shadcn-style project — @/ aliases, cva button,
 * lucide icon, HashRouter, @theme tokens — and renders it in an iframe,
 * reporting timing to #status for the Playwright run to assert on.
 */
import { bundleProject, findFrameworkEntry } from './bundle';
import { buildShellHtml, ERROR_RELAY } from './shell';

const SAMPLE: Record<string, string> = {
  '/index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Community Shelf</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&display=swap" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,

  '/vite.config.ts': `import { defineConfig } from 'vite';
export default defineConfig({ resolve: { alias: { '@': '/src' } } });`,

  '/src/main.tsx': `import { createRoot } from 'react-dom/client';
import App from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<App />);`,

  '/src/index.css': `:root {
  --background: #faf6ef;
  --foreground: #1c1917;
  --primary: #166534;
  --primary-foreground: #f0fdf4;
  --card: #ffffff;
  --border: #e7e0d3;
  --radius: 0.625rem;
}
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --font-serif: "Fraunces", serif;
}
body { background: var(--background); color: var(--foreground); }
.masthead { font-family: var(--font-serif); }`,

  '/src/lib/utils.ts': `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,

  '/src/components/ui/button.tsx': `import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        outline: 'border border-border bg-card hover:bg-background',
      },
      size: { default: 'h-10 px-4 py-2', sm: 'h-9 px-3' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className, variant, size, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}`,

  '/src/App.tsx': `import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Hammer, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Nav() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky top-0 border-b border-border bg-background/80 backdrop-blur px-6 py-3 flex items-center gap-4">
      <span className="masthead text-xl font-bold">Community Shelf</span>
      <Link to="/"><Button variant={pathname === '/' ? 'default' : 'outline'} size="sm"><Hammer size={16} /> Shelf</Button></Link>
      <Link to="/neighbors"><Button variant={pathname === '/neighbors' ? 'default' : 'outline'} size="sm"><Users size={16} /> Neighbors</Button></Link>
    </nav>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Nav />
      <main className="p-6">
        <Routes>
          <Route path="/" element={
            <div className="rounded-lg border border-border bg-card p-6 max-w-md">
              <h1 className="masthead text-2xl font-bold">Cordless drill</h1>
              <p className="mt-2 text-sm">18V with a full bit set. Battery holds a charge.</p>
              <Button className="mt-4">Ask to borrow</Button>
            </div>
          } />
          <Route path="/neighbors" element={<h1 id="neighbors-page" className="masthead text-2xl font-bold">12 neighbors</h1>} />
        </Routes>
      </main>
    </HashRouter>
  );
}`,
};

const status = document.getElementById('status')!;
const frame = document.getElementById('frame') as HTMLIFrameElement;

async function run() {
  const t0 = performance.now();
  const entry = findFrameworkEntry(SAMPLE)!;
  const result = await bundleProject({ files: SAMPLE, entry });
  const bundleMs = Math.round(performance.now() - t0);

  if (!result.ok) {
    status.textContent = `BUILD FAILED after ${bundleMs}ms: ${result.errors.join(' | ')}`;
    status.setAttribute('data-state', 'error');
    return;
  }

  const html = buildShellHtml({
    bundle: result,
    indexHtml: SAMPLE['/index.html'],
    bodyExtra: [ERROR_RELAY],
  });
  const blob = new Blob([html], { type: 'text/html' });
  frame.src = URL.createObjectURL(blob);

  window.addEventListener('message', e => {
    if (e.data?.type === 'rb-runtime-error') {
      status.textContent = `RUNTIME ERROR: ${e.data.message}`;
      status.setAttribute('data-state', 'error');
    }
  });

  status.textContent = `bundled in ${bundleMs}ms (js ${(result.js.length / 1024).toFixed(0)}kb, imports: ${JSON.parse(result.importMap).imports && Object.keys(JSON.parse(result.importMap).imports).join(', ')})`;
  status.setAttribute('data-state', 'ok');
  status.setAttribute('data-bundle-ms', String(bundleMs));
}

run().catch(err => {
  status.textContent = `SPIKE CRASH: ${err?.stack ?? err}`;
  status.setAttribute('data-state', 'error');
});
