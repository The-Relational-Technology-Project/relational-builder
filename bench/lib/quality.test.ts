import { describe, it, expect } from 'vitest';
import { fileStats, classifyFailure, tokensPerSecond, lintPer100 } from './quality';

describe('fileStats', () => {
  it('counts what a reviewer would count', () => {
    const s = fileStats({
      '/src/App.tsx': [
        "import { Button } from '@/components/ui/button';",
        "import { Calendar, CircleHalf } from 'lucide-react';",
        'const x: any = 1; const y = z as any;',
        ...Array(20).fill('// line'),
      ].join('\n'),
      '/src/components/ui/fancy.tsx': 'export const Fancy = () => null;',
      '/src/pages/Old.tsx': '<script src="https://cdn.tailwindcss.com"></script>',
      '/src/index.css': '@theme {}',
      '/data/seed.json': '{}',
    });
    expect(s.files).toBe(5);
    expect(s.codeFiles).toBe(3);
    expect(s.largestFile).toBe('/src/App.tsx');
    expect(s.largestFileLines).toBe(23);
    expect(s.anyCount).toBe(2);
    expect(s.kitImportingFiles).toBe(1);
    expect(s.handRolledUiFiles).toBe(1);
    expect(s.invalidLucide).toEqual(['CircleHalf']);
    expect(s.tailwindV3Habits).toBe(1);
  });
});

describe('classifyFailure', () => {
  it('names the failure kinds the open models actually hit', () => {
    expect(classifyFailure('vfs:/src/App.tsx:4: Could not find "./data/seedData" in the project')).toBe('missing-file');
    expect(classifyFailure("The requested module 'lucide-react' does not provide an export named 'CircleHalf'")).toBe('bad-import');
    expect(classifyFailure('vfs:/src/App.tsx:6: Expected "from" but found "{"')).toBe('syntax');
    expect(classifyFailure('Could not resolve "react-super-grid"')).toBe('unknown-package');
    expect(classifyFailure('something else')).toBe('other');
    expect(classifyFailure(null)).toBeNull();
  });
});

describe('speed and lint density', () => {
  it('computes tokens per second from the chars/4 estimate', () => {
    expect(tokensPerSecond(40_000, 100_000)).toBe(100);
    expect(tokensPerSecond(40_000, 0)).toBeNull();
  });
  it('computes lint findings per 100 lines', () => {
    expect(lintPer100({ errors: 3, warnings: 1 }, 200)).toBe(2);
    expect(lintPer100({ errors: 3, warnings: 1 }, 0)).toBeNull();
  });
});
