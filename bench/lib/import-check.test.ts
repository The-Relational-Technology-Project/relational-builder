import { describe, it, expect } from 'vitest';
import { checkImports } from './import-check';

const kit = {
  '/src/components/ui/button.tsx': 'export function Button() { return null; }\nexport const buttonVariants = 1;',
  '/src/components/ui/app-bar.tsx': 'export function AppBar() { return null; }\nexport function AppBarTitle() { return null; }',
};

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
    expect(issues[0]).toMatch(/"lucide-react" for import "CircleHalf"/);
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
});
