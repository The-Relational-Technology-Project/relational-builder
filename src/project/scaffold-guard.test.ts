import { describe, expect, it } from 'vitest';
import { hoistRouter, isKitStub, repairEntry } from './scaffold-guard';
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

describe('hoistRouter', () => {
  const main = { path: 'src/main.tsx', content: "import App from './App';\ncreateRoot(el).render(<React.StrictMode><App /></React.StrictMode>);" };
  it('moves a router that App renders around its own useLocation up into main', () => {
    const app = { path: 'src/App.tsx', content: "import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';\nexport default function App() { const l = useLocation(); return <HashRouter><Routes><Route path=\"/\" element={<p>{l.pathname}</p>} /></Routes></HashRouter>; }" };
    const r = hoistRouter([main, app]);
    expect(r.hoisted).toBe(true);
    expect(r.writes[0].content).toContain("import { HashRouter } from 'react-router-dom';");
    expect(r.writes[0].content).toContain('<HashRouter><App /></HashRouter>');
    expect(r.writes[1].content).not.toContain('HashRouter');
    expect(r.writes[1].content).toContain("import { Routes, Route, useLocation } from 'react-router-dom';");
    expect(r.writes[1].content).toContain('return <><Routes>');
  });
  it('adds the missing router when Routes has none', () => {
    const app = { path: 'src/App.tsx', content: "import { Routes, Route } from 'react-router-dom';\nexport default function App() { return <Routes><Route path=\"/\" element={<p />} /></Routes>; }" };
    expect(hoistRouter([main, app]).writes[0].content).toContain('<HashRouter><App /></HashRouter>');
  });
  it('leaves a main that already has a router, and apps without react-router', () => {
    const ok = { path: 'src/main.tsx', content: "import App from './App';\nroot.render(<HashRouter><App /></HashRouter>);" };
    const app = { path: 'src/App.tsx', content: "import { Routes } from 'react-router-dom';" };
    expect(hoistRouter([ok, app]).hoisted).toBe(false);
    expect(hoistRouter([main, { path: 'src/App.tsx', content: 'export default () => null;' }]).hoisted).toBe(false);
  });
});
