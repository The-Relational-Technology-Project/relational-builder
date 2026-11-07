import { describe, expect, it } from 'vitest';
import { splitRemoteCssImports } from './shell';

describe('remote CSS imports leave the Tailwind stylesheet', () => {
  it('pulls Google Fonts imports out, in either quoting, and keeps the rest', () => {
    const css = [
      "@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&display=swap');",
      '@import "https://fonts.googleapis.com/css2?family=Sora&display=swap";',
      ':root { --background: #eee; }',
      '@import url(https://fonts.googleapis.com/css2?family=Inter);',
    ].join('\n');
    const { urls, rest } = splitRemoteCssImports(css);
    expect(urls).toEqual([
      'https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&display=swap',
      'https://fonts.googleapis.com/css2?family=Sora&display=swap',
      'https://fonts.googleapis.com/css2?family=Inter',
    ]);
    expect(rest).toContain(':root { --background: #eee; }');
    expect(rest).not.toContain('@import');
  });

  it('leaves local imports and plain CSS alone', () => {
    const css = "@import './theme.css';\nbody { color: red; }";
    expect(splitRemoteCssImports(css)).toEqual({ urls: [], rest: css });
  });

  it('lifts an import whose quotes do not match (gemma, Nov 7)', () => {
    const css = `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600&display=swap");\n:root{}`;
    const { urls, rest } = splitRemoteCssImports(css);
    expect(urls).toEqual(['https://fonts.googleapis.com/css2?family=Sora:wght@400;600&display=swap']);
    expect(rest).not.toContain('@import');
  });
});

