import { describe, expect, it } from 'vitest';
import { repairImportLine, repairImports, removeUnusedImports, repairLucideImports } from './import-repair';

describe('stuttered import repair', () => {
  it('keeps the last brace group (the lines Gemma actually wrote)', () => {
    expect(repairImportLine("import { Badge } { Avatar } from '@/components/ui/avatar';")).toBe("import { Avatar } from '@/components/ui/avatar';");
    expect(repairImportLine('import { Button } import { Input } from "@/components/ui/input";')).toBe('import { Input } from "@/components/ui/input";');
    expect(repairImportLine("import { Badge } } from '@/components/ui/badge';")).toBe("import { Badge } from '@/components/ui/badge';");
    expect(repairImportLine("import { Badge } coming from '@/components/ui/badge';")).toBe("import { Badge } from '@/components/ui/badge';");
    expect(repairImportLine("import { StockPage } import { StockPage } from '@/pages/StockPage';")).toBe("import { StockPage } from '@/pages/StockPage';");
  });

  it('never touches a valid import', () => {
    for (const ok of [
      "import React, { useState } from 'react';",
      "import * as React from 'react';",
      "import type { Foo } from './types';",
      "import App from './App'",
      "import { a, b as c } from 'x';",
      "import './index.css';",
      "  import { HashRouter } from 'react-router-dom';",
    ]) expect(repairImportLine(ok)).toBe(ok);
  });

  it('counts repairs across a file and leaves other lines alone', () => {
    const src = "import { Badge } { Badge } from '@/components/ui/badge';\nimport { useState } from 'react';\nconst x = '{ a } { b } from';";
    const r = repairImports(src);
    expect(r.repaired).toBe(1);
    expect(r.content.split('\n')[0]).toBe("import { Badge } from '@/components/ui/badge';");
    expect(r.content.split('\n').slice(1)).toEqual(src.split('\n').slice(1));
  });

  it('repairs a stutter followed by a comment, and an @/src/ alias (Gemma, Nov 9)', () => {
    expect(repairImportLine("import { Badge } badge from '@/components/ui/badge'; // Note: kit")).toBe("import { Badge } from '@/components/ui/badge'; // Note: kit");
    expect(repairImportLine("import { useStore } from '@/src/store';")).toBe("import { useStore } from '@/store';");
  });
});

describe('unused import removal', () => {
  it('drops names the file never uses and keeps the rest', () => {
    const src = [
      "import React, { useState, useEffect } from 'react';",
      "import { Plus, Trash, Heart } from 'lucide-react';",
      "import { Badge } from '@/components/ui/badge';",
      "import './index.css';",
      "import type { Item } from './types';",
      "export function A({ items }: { items: Item[] }) { const [n] = useState(0); return <div><Plus />{n}{items.length}<Heart /></div>; }",
    ].join('\n');
    const r = removeUnusedImports(src);
    const lines = r.content.split('\n');
    expect(lines[0]).toBe("import React, { useState } from 'react';");
    expect(lines[1]).toBe("import { Plus, Heart } from 'lucide-react';");
    expect(lines).not.toContain("import { Badge } from '@/components/ui/badge';");
    expect(lines).toContain("import './index.css';");
    expect(lines).toContain("import type { Item } from './types';");
    expect(r.removed).toBe(3);
  });
  it('keeps aliased names by their local name and leaves a clean file unchanged', () => {
    const src = "import { format as fmt } from 'date-fns';\nexport const d = fmt(new Date(), 'p');";
    expect(removeUnusedImports(src)).toEqual({ content: src, removed: 0 });
  });
});


describe('repairLucideImports', () => {
  it('maps an invented icon to the real one under the same local name', () => {
    const src = "import { Fridge, Heart, ThumbUp } from 'lucide-react';\nexport const A = () => <Fridge />;";
    const r = repairLucideImports(src);
    expect(r.content).toContain("import { Refrigerator as Fridge, Heart, ThumbsUp as ThumbUp } from 'lucide-react';");
    expect(r.repaired).toEqual(['Fridge', 'ThumbUp']);
  });
  it('keeps an existing alias name', () => {
    expect(repairLucideImports("import { Broom as CleanIcon } from 'lucide-react';").content)
      .toBe("import { Brush as CleanIcon } from 'lucide-react';");
  });
  it('leaves real icons and other packages alone', () => {
    const src = "import { Refrigerator } from 'lucide-react';\nimport { Fridge } from './icons';";
    expect(repairLucideImports(src).content).toBe(src);
  });
});
