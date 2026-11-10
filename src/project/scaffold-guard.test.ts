import { describe, expect, it } from 'vitest';
import { isKitStub, repairEntry } from './scaffold-guard';
import { KIT_FILES } from '@/kit';

describe('isKitStub', () => {
  it('flags a comment-only kit file', () => {
    const stub = '// (Note: In the actual builder, these are provided via the kit)\n';
    expect(isKitStub('src/components/ui/app-bar.tsx', stub, KIT_FILES)).toBe(true);
  });
  it('keeps a real customization that still exports a kit name', () => {
    const custom = "export function AppBar(props: { children?: unknown }) { return null; }\n";
    expect(isKitStub('/src/components/ui/app-bar.tsx', custom, KIT_FILES)).toBe(false);
  });
  it('ignores paths outside the kit', () => {
    expect(isKitStub('/src/components/Header.tsx', '// nothing', KIT_FILES)).toBe(false);
  });
});

describe('repairEntry', () => {
  it('points a render that lost App back at it', () => {
    const src = "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\n\nconst root = createRoot(document.getElementById('root')!);\nroot.render(<React></React>); // Note: replaced later\n";
    const out = repairEntry('/src/main.tsx', src);
    expect(out.repaired).toBe(true);
    expect(out.content).toContain('root.render(<App />);');
  });
  it('leaves a normal entry alone', () => {
    const src = "import App from './App';\ncreateRoot(el).render(<StrictMode><App /></StrictMode>);\n";
    expect(repairEntry('src/main.tsx', src).repaired).toBe(false);
  });
  it('leaves other files alone', () => {
    expect(repairEntry('/src/App.tsx', "import App from './x';\nroot.render(<div />);").repaired).toBe(false);
  });
});
