import { describe, expect, it } from 'vitest';
import { runawayReason } from './runaway';

const file = (p: string) => '```tsx filename="' + p + '"\nexport const x = 1;\n```\n';

describe('runawayReason', () => {
  it('lets a chain that adds new files continue', () => {
    expect(runawayReason([file('src/App.tsx'), file('src/pages/Home.tsx')], 60_000)).toBeNull();
  });
  it('stops a continuation that only rewrites earlier files', () => {
    expect(runawayReason([file('src/App.tsx') + file('src/components/ui/button.tsx'), file('src/components/ui/button.tsx')], 60_000))
      .toMatch(/only rewrote/);
  });
  it('stops past the write cap or the time cap', () => {
    const many = Array.from({ length: 61 }, (_, i) => file(`src/f${i}.ts`)).join('');
    expect(runawayReason([many], 1000)).toMatch(/more than 60/);
    expect(runawayReason([file('src/App.tsx')], 16 * 60 * 1000)).toMatch(/passed 15 minutes/);
  });
});
