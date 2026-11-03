import { describe, it, expect } from 'vitest';
import { fixHints, kitExports } from './fix-hints';
import { KIT_FILES } from '@/kit';

describe('kitExports', () => {
  it('reads the real kit', () => {
    const ex = kitExports(KIT_FILES);
    expect(ex['/src/components/ui/select.tsx']).toEqual(['Select']);
    expect(ex['/src/components/ui/button.tsx']).toContain('Button');
    expect(ex['/src/components/ui/app-bar.tsx']).toEqual(expect.arrayContaining(['AppBar', 'AppBarTitle']));
  });
});

describe('fixHints', () => {
  it('names the kit file\'s real exports for an invented name (glm, SelectContent)', () => {
    const h = fixHints('vfs:/src/pages/AdminPage.tsx:8: No matching export in "vfs:/src/components/ui/select.tsx" for import "SelectContent"', KIT_FILES);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatch(/exports exactly: Select\./);
    expect(h[0]).toMatch(/plain `<option>` children/);
  });

  it('explains a default import from a kit file', () => {
    const h = fixHints('No matching export in "vfs:/src/components/ui/app-bar.tsx" for import "default"', KIT_FILES);
    expect(h[0]).toMatch(/has no default export. It exports exactly: AppBar, AppBarTitle/);
  });

  it('gives the exact import line for an undeclared icon or kit component', () => {
    const h = fixHints(
      'vfs:/src/pages/Home.tsx: <Calendar> is used but never imported or declared in this file\nvfs:/src/pages/Home.tsx: <Button> is used but never imported or declared in this file\nvfs:/src/pages/Home.tsx: <Widget> is used but never imported or declared in this file',
      KIT_FILES,
    );
    expect(h).toHaveLength(3);
    expect(h[0]).toContain("import { Calendar } from 'lucide-react';");
    expect(h[1]).toContain("import { Button } from '@/components/ui/button';");
    expect(h[2]).toMatch(/neither imported nor defined/);
  });

  it('names the doubled-quote import mistake (gemma, Nov 2)', () => {
    const h = fixHints('vfs:/src/main.tsx:1: Expected ";" but found "react"', KIT_FILES);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatch(/doubled quote/);
    expect(h[0]).toContain("import X from 'react'");
  });

  it('covers React.* and names-only packages, and is empty otherwise', () => {
    expect(fixHints('vfs:/src/A.tsx: ReferenceError: React is not defined (uses React.*)', KIT_FILES)[0]).toMatch(/import React from 'react'/);
    expect(fixHints('No matching export in "zustand" for import "default"', KIT_FILES)[0]).toMatch(/import \{ create \} from 'zustand'/);
    expect(fixHints('vfs:/src/App.tsx:4: Could not find "./pages/Home" in the project', KIT_FILES)).toEqual([]);
  });

  it('tells the model to use HashRouter when BrowserRouter was flagged (gpt-oss, Nov 3)', () => {
    const h = fixHints(`vfs:/src/main.tsx: BrowserRouter from 'react-router-dom' opens on "Page not found" in the preview and on static hosts; use HashRouter`, KIT_FILES);
    expect(h.join(' ')).toContain('HashRouter');
    expect(h.join(' ')).toContain('do not alias');
  });

  it('turns a CommonJS require into an import hint (gemma, Nov 3)', () => {
    const h = fixHints('vfs:/src/App.tsx: Dynamic require of "lucide-react" is not supported (this is an ES module; use import)', KIT_FILES);
    expect(h.join(' ')).toContain("import { ... } from 'lucide-react'");
  });
});
