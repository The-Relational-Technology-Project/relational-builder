import { describe, expect, it } from 'vitest';
import { addMissingImports } from './auto-import';
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
});
