import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './files/components/ui/select';

describe('kit Select', () => {
  it('renders native options as before', () => {
    const html = renderToStaticMarkup(<Select value="b" onChange={() => {}}><option value="a">A</option><option value="b">B</option></Select>);
    expect(html).toContain('<select');
    expect(html).toContain('<option value="a">A</option>');
  });
  it('renders the shadcn shape as a native select with a placeholder', () => {
    const html = renderToStaticMarkup(
      <Select onValueChange={() => {}}>
        <SelectTrigger><SelectValue placeholder="Pick a shift" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="am">Morning</SelectItem>
          <SelectItem value="pm">Evening</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(html).toContain('<select');
    expect(html).toMatch(/<option value="" disabled=""( selected="")?>Pick a shift<\/option>/);
    expect(html).toContain('<option value="am">Morning</option>');
    expect(html).toContain('<option value="pm">Evening</option>');
    expect(html).not.toContain('SelectItem');
  });
});
