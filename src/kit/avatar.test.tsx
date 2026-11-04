import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from './files/components/ui/avatar';

describe('kit Avatar', () => {
  it('draws initials from a name', () => {
    expect(renderToStaticMarkup(<Avatar name="Maya Okafor" />)).toContain('MO');
  });
  it('does not crash when the name is missing (a lookup that found nobody)', () => {
    const html = renderToStaticMarkup(<Avatar name={undefined} />);
    expect(html).toContain('·');
  });
});
