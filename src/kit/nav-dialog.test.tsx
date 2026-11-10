import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BottomNav, BottomNavItem } from './files/components/ui/bottom-nav';
import { Dialog, DialogTrigger } from './files/components/ui/dialog';
import { Button } from './files/components/ui/button';

describe('kit BottomNavItem', () => {
  it('stays a button with onClick', () => {
    const html = renderToStaticMarkup(<BottomNav><BottomNavItem label="Shelf" active onClick={() => {}} /></BottomNav>);
    expect(html).toContain('<button');
    expect(html).toContain('aria-current="page"');
  });
  it('becomes a hash link with to or href', () => {
    const html = renderToStaticMarkup(
      <BottomNav>
        <BottomNavItem label="Shifts" to="/shifts" />
        <BottomNavItem label="Map" href="/map" />
        <BottomNavItem label="Elsewhere" href="https://example.org" />
      </BottomNav>,
    );
    expect(html).toContain('href="#/shifts"');
    expect(html).toContain('href="#/map"');
    expect(html).toContain('href="https://example.org"');
    expect(html).not.toContain('<button');
  });
  it('marks the home route active by default on the server', () => {
    const html = renderToStaticMarkup(<BottomNavItem label="Home" to="/" />);
    expect(html).toContain('aria-current="page"');
  });
});

describe('kit DialogTrigger', () => {
  it('asChild renders the child, not a button around a button', () => {
    const html = renderToStaticMarkup(
      <Dialog><DialogTrigger asChild><Button>Share your thought</Button></DialogTrigger></Dialog>,
    );
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toContain('Share your thought');
  });
  it('still renders its own button without asChild', () => {
    const html = renderToStaticMarkup(<Dialog><DialogTrigger>Open</DialogTrigger></Dialog>);
    expect(html).toBe('<button>Open</button>');
  });
});
