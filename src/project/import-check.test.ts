import { describe, it, expect } from 'vitest';
import { checkImports, checkSeedLoops, formatImportIssues } from './import-check';

const kit = {
  '/src/components/ui/button.tsx': 'export function Button() { return null; }\nexport const buttonVariants = 1;',
  '/src/components/ui/app-bar.tsx': 'export function AppBar() { return null; }\nexport function AppBarTitle() { return null; }',
};

describe('formatImportIssues', () => {
  it('is null when clean and one banner text otherwise', () => {
    expect(formatImportIssues([])).toBeNull();
    const text = formatImportIssues(['vfs:/src/A.tsx: <Calendar> is used but never imported or declared in this file']);
    expect(text).toMatch(/compiled, but these imports will fail/);
    expect(text).toMatch(/<Calendar>/);
  });
});

describe('checkImports', () => {
  it('is empty for a clean file', () => {
    const files = {
      '/src/App.tsx': [
        "import { Button } from '@/components/ui/button';",
        "import { Calendar } from 'lucide-react';",
        "import { create } from 'zustand';",
        "import Home from './pages/Home';",
        'export default function App() { return <div><Button /><Calendar /><Home /></div>; }',
      ].join('\n'),
      '/src/pages/Home.tsx': 'export default function Home() { return <p>hi</p>; }',
    };
    expect(checkImports(files, { kitFiles: kit })).toEqual([]);
  });

  it('names a lucide icon that does not exist (gpt-oss, Oct 30)', () => {
    const files = { '/src/A.tsx': "import { CircleHalf, Calendar } from 'lucide-react';\nexport const A = () => <CircleHalf />;" };
    const issues = checkImports(files);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/'lucide-react' does not provide an export named 'CircleHalf'/);
  });

  it('flags a default import from a names-only module (zustand, the kit)', () => {
    const files = {
      '/src/store.ts': "import create from 'zustand';\nexport const useStore = create(() => ({}));",
      '/src/App.tsx': "import AppBar from '@/components/ui/app-bar';\nexport default function App() { return <AppBar />; }",
    };
    const issues = checkImports(files, { kitFiles: kit });
    expect(issues.some(i => i.includes('"zustand" for import "default"'))).toBe(true);
    expect(issues.some(i => i.includes('app-bar.tsx" for import "default"'))).toBe(true);
    expect(issues).toHaveLength(2);
  });

  it('flags a component used without an import (gemma Calendar, glm Button)', () => {
    const files = {
      '/src/Board.tsx': "import { Card } from '@/components/ui/card';\nexport function Board() { return <Card><Calendar className=\"x\" /><Button>go</Button></Card>; }",
      '/src/components/ui/card.tsx': 'export function Card({ children }: { children: unknown }) { return <>{children}</>; }',
    };
    const issues = checkImports(files, { kitFiles: kit });
    expect(issues.map(i => i.match(/<(\w+)>/)![1]).sort()).toEqual(['Button', 'Calendar']);
  });

  it('flags a file imported but never written, and a named export that is not there', () => {
    const files = {
      '/src/pages/Home.tsx': "import { ShiftList } from '../components/ShiftList';\nimport seed from '../data/seedData';\nexport default function Home() { return <ShiftList items={seed} />; }",
      '/src/data/seedData.ts': 'export const seed = [];',
    };
    const issues = checkImports(files);
    expect(issues.some(i => i.includes('Could not find "../components/ShiftList"'))).toBe(true);
    expect(issues.some(i => i.includes('seedData.ts" for import "default"'))).toBe(true);
  });

  it('does not flag locally declared components, member tags, or namespace imports', () => {
    const files = {
      '/src/A.tsx': [
        "import * as Icons from 'lucide-react';",
        'const Row = () => null;',
        'function Cell() { return null; }',
        'export const A = () => <div><Row /><Cell /><Icons.Calendar /></div>;',
      ].join('\n'),
    };
    expect(checkImports(files)).toEqual([]);
  });

  it('treats the generated env module as present (glm, Nov 2: a false positive)', () => {
    const files = { '/src/main.tsx': "import { env } from '@/env';\nimport { createRoot } from 'react-dom/client';\nconsole.log(env, createRoot);" };
    expect(checkImports(files)).toEqual([]);
  });

  it('flags React.* used without importing React (gemma, Nov 1)', () => {
    const bad = { '/src/Wall.tsx': "export function Wall() { const [n, setN] = React.useState(0); return <button onClick={() => setN(n + 1)}>{n}</button>; }" };
    expect(checkImports(bad).some(i => i.includes('React is not defined'))).toBe(true);
    const ok1 = { '/src/Wall.tsx': "import React from 'react';\nexport function Wall() { const [n] = React.useState(0); return <b>{n}</b>; }" };
    const ok2 = { '/src/Wall.tsx': "import * as React from 'react';\nexport function Wall() { const [n] = React.useState(0); return <b>{n}</b>; }" };
    const ok3 = { '/src/Wall.tsx': "import React, { useState } from 'react';\nexport function Wall() { const [n] = useState(0); return <b>{React.version}{n}</b>; }" };
    expect(checkImports(ok1)).toEqual([]);
    expect(checkImports(ok2)).toEqual([]);
    expect(checkImports(ok3)).toEqual([]);
  });

  it('does not mistake type arguments or prop-passed components for undeclared tags (glm, Oct 31)', () => {
    const files = {
      '/src/components/ui/bottom-nav.tsx': [
        "import * as React from 'react';",
        'export const Nav = React.forwardRef<HTMLDivElement, { items: Array<Item> }>((props, ref) => <div ref={ref} />);',
        'type Item = { icon: React.ComponentType; label: string };',
        'export function NavItem({ icon: Icon, label }: Item) { const [open, setOpen] = React.useState<Item[]>([]); return <button><Icon /> {label} {open.length}</button>; }',
      ].join('\n'),
    };
    expect(checkImports(files)).toEqual([]);
  });

  it('flags BrowserRouter, including aliased as HashRouter (gpt-oss, Nov 3)', () => {
    const aliased = { '/src/main.tsx': "import { BrowserRouter as HashRouter } from 'react-router-dom';\nexport const x = <HashRouter />;" };
    expect(checkImports(aliased).some(i => i.includes('BrowserRouter'))).toBe(true);
    const plain = { '/src/main.tsx': "import { BrowserRouter, Routes } from 'react-router-dom';\nexport const x = <BrowserRouter><Routes /></BrowserRouter>;" };
    expect(checkImports(plain).some(i => i.includes('BrowserRouter'))).toBe(true);
    const ok = { '/src/main.tsx': "import { HashRouter, Routes } from 'react-router-dom';\nexport const x = <HashRouter><Routes /></HashRouter>;" };
    expect(checkImports(ok)).toEqual([]);
  });

  it('flags a CommonJS require in an ES module (gemma, Nov 3)', () => {
    const bad = { '/src/App.tsx': "const { Heart } = require('lucide-react');\nexport function App() { return <Heart />; }" };
    expect(checkImports(bad).some(i => i.includes('Dynamic require of "lucide-react"'))).toBe(true);
    const ok = { '/src/App.tsx': "import { Heart } from 'lucide-react';\n// requires nothing: the word required is fine\nexport function App() { return <Heart />; }" };
    expect(checkImports(ok)).toEqual([]);
  });

  it('flags a bare component passed to a kit icon prop (gemma, Nov 3: React #31)', () => {
    const bad = { '/src/App.tsx': "import { Users } from 'lucide-react';\nimport { BottomNavItem } from '@/components/ui/bottom-nav';\nexport const x = <BottomNavItem icon={Users} label='Shifts' to='/shifts' />;" };
    expect(checkImports(bad, { kitFiles: { '/src/components/ui/bottom-nav.tsx': 'export function BottomNavItem() {}' } }).some(i => i.includes('icon={<Users />}'))).toBe(true);
    const ok = { '/src/App.tsx': "import { Users } from 'lucide-react';\nimport { BottomNavItem } from '@/components/ui/bottom-nav';\nexport const x = <BottomNavItem icon={<Users />} label='Shifts' to='/shifts' />;" };
    expect(checkImports(ok, { kitFiles: { '/src/components/ui/bottom-nav.tsx': 'export function BottomNavItem() {}' } })).toEqual([]);
    // The app's own components may take a component; only the kit's contract is checked
    const own = { '/src/App.tsx': "import { Users } from 'lucide-react';\nfunction NavItem({ icon: Icon }: { icon: typeof Users }) { return <Icon />; }\nexport const x = <NavItem icon={Users} />;" };
    expect(checkImports(own)).toEqual([]);
  });

  it('flags a router rendered in two files, even under an alias (gpt-oss, Nov 3)', () => {
    const bad = {
      '/src/main.tsx': "import { HashRouter as Router } from 'react-router-dom';\nimport App from './App';\nexport const x = <Router><App /></Router>;",
      '/src/App.tsx': "import { HashRouter, Routes } from 'react-router-dom';\nexport default function App() { return <HashRouter><Routes /></HashRouter>; }",
    };
    expect(checkImports(bad).some(i => i.includes('a router is rendered in 2 files'))).toBe(true);
    const ok = {
      '/src/main.tsx': "import { HashRouter } from 'react-router-dom';\nimport App from './App';\nexport const x = <HashRouter><App /></HashRouter>;",
      '/src/App.tsx': "import { Routes, Route } from 'react-router-dom';\nexport default function App() { return <Routes><Route /></Routes>; }",
    };
    expect(checkImports(ok)).toEqual([]);
  });

  it('flags an unknown font utility under @apply unless the theme declares it (gpt-oss, Nov 3)', () => {
    const bad = { '/src/index.css': "@import 'tailwindcss';\nbody { @apply bg-background text-foreground font-inter; }" };
    expect(checkImports(bad).some(i => i.includes('font-inter'))).toBe(true);
    const declared = { '/src/index.css': "@theme { --font-inter: 'Inter', sans-serif; }\nbody { @apply font-inter font-semibold font-sans; }" };
    expect(checkImports(declared)).toEqual([]);
  });

  it('does not flag React used only in types, which compile away (Devstral, Nov 5)', () => {
    const typesOnly = { '/src/Form.tsx': "import { useState } from 'react';\nexport function Form({ children }: { children: React.ReactNode }) { const [v] = useState(''); const go = (e: React.FormEvent) => e.preventDefault(); return <form onSubmit={go}>{v}{children}</form>; }" };
    expect(checkImports(typesOnly)).toEqual([]);
    const value = { '/src/main.tsx': "import App from './App';\nexport const x = <React.StrictMode><App /></React.StrictMode>;", '/src/App.tsx': 'export default function App() { return null; }' };
    expect(checkImports(value).some(i => i.includes('React is not defined'))).toBe(true);
  });
});

describe('checkSeedLoops', () => {
  it('flags seed text picked by the loop index', () => {
    expect(checkSeedLoops({ '/src/data/seed.ts': 'for (let i = 0; i < 60; i++) {\n  const text = texts[i % texts.length];\n}' })[0])
      .toMatch(/^vfs:\/src\/data\/seed\.ts:2: seed text is built in a loop/);
    expect(checkSeedLoops({ '/src/store.ts': "    text = i % 2 === 0 ? 'More benches' : 'Better lights';" })).toHaveLength(1);
  });
  it('leaves loops over dates and counts alone', () => {
    const src = "Array.from({ length: 7 }).map((_, i) => ({ date: addDays(start, i), slot: i % 2 ? 'am' : 'pm', meToo: i % 4 }))";
    expect(checkSeedLoops({ '/src/data/seed.ts': src })).toEqual([]);
  });
});
