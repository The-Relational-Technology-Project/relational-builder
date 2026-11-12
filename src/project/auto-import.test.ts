import { describe, expect, it } from 'vitest';
import { addMissingImports, repairKitImports } from './auto-import';
import { checkImports } from './import-check';
import { KIT_FILES } from '@/kit';

describe('adding a forgotten import', () => {
  it('adds kit components and lucide icons, joining an existing lucide import', () => {
    const src = "import { Plus } from 'lucide-react';\nexport const A = () => <Card><Badge>new</Badge><Plus /><Calendar /></Card>;";
    const r = addMissingImports('/src/A.tsx', src, KIT_FILES);
    expect(r.added.sort()).toEqual(['Badge', 'Calendar', 'Card']);
    expect(r.content).toContain("import { Plus, Calendar } from 'lucide-react';");
    expect(r.content).toContain("import { Card } from '@/components/ui/card';");
    expect(r.content).toContain("import { Badge } from '@/components/ui/badge';");
    expect(checkImports({ '/src/A.tsx': r.content }, { kitFiles: KIT_FILES })).toEqual([]);
  });

  it('leaves a name that is neither kit nor icon for the fix pass', () => {
    const src = 'export const A = () => <ShiftCard />;';
    expect(addMissingImports('/src/A.tsx', src, KIT_FILES)).toEqual({ content: src, added: [] });
  });
  it('adds the React namespace when React.* is used as a value without an import', () => {
    const src = "import { useState } from 'react';\nexport default function App() { const [n] = useState(0); return React.createElement('div', null, n); }";
    const r = addMissingImports('/src/App.tsx', src, KIT_FILES);
    expect(r.added).toContain('React');
    expect(r.content.startsWith("import * as React from 'react';\n")).toBe(true);
    expect(checkImports({ '/src/App.tsx': r.content }, { kitFiles: KIT_FILES }).some(i => i.includes('React is not defined'))).toBe(false);
  });
  it('leaves a file that only uses React types alone', () => {
    const src = "export function F(e: React.FormEvent) { return e; }";
    expect(addMissingImports('/src/F.tsx', src, KIT_FILES).added).toEqual([]);
  });
});

describe('repairKitImports', () => {
  it('fixes the case of a kit name', () => {
    const r = repairKitImports("import { textarea } from '@/components/ui/textarea';", KIT_FILES);
    expect(r.content).toBe("import { Textarea } from '@/components/ui/textarea';");
  });
  it('moves a name to the kit file that exports it', () => {
    const r = repairKitImports("import { Input, Textarea } from '@/components/ui/input';", KIT_FILES);
    expect(r.content).toBe("import { Input } from '@/components/ui/input';\nimport { Textarea } from '@/components/ui/textarea';");
  });
  it('leaves a line with an unplaceable name for the fix pass', () => {
    const src = "import { Input, Wizard } from '@/components/ui/input';";
    expect(repairKitImports(src, KIT_FILES).content).toBe(src);
  });
});
