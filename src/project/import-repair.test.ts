import { describe, expect, it } from 'vitest';
import { repairImportLine, repairImports } from './import-repair';

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
});
