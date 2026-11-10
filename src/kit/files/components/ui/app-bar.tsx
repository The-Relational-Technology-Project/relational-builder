import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * The app's top bar: sticky, with a real surface (solid token background +
 * blur) so it never renders transparent over content, and a safe-area pad
 * for phones.
 *
 *   <AppBar>
 *     <AppBarTitle>Community Shelf</AppBarTitle>
 *     <nav className="ml-auto flex items-center gap-1">…</nav>
 *   </AppBar>
 */
export function AppBar({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center gap-3 border-b border-border',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
        className,
      )}
      {...props}
    />
  );
}

export function AppBarTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-lg font-semibold tracking-tight', className)} {...props} />;
}

/**
 * Bottom tab bar for phone-first apps (the SHELF / INBOX pattern):
 * fixed, solid surface, generous touch targets.
 *
 *   <BottomNav>
 *     <BottomNavItem active icon={<Hammer />} label="Shelf" onClick={…} />
 *   </BottomNav>
 */
export function BottomNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
      {...props}
    />
  );
}

/** The app's routes are hash routes (HashRouter), so "/themes" lives at "#/themes" */
function hashHref(target: string): string {
  if (target.startsWith('/')) return '#' + target;
  return target;
}

function currentRoute(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.hash.replace(/^#/, '') || '/';
}

function useHashRoute(): string {
  return React.useSyncExternalStore(
    cb => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    currentRoute,
    () => '/',
  );
}

type BottomNavItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  /** A route ("/shifts") or URL; renders a link instead of a button */
  href?: string;
  /** Same as href, in react-router's spelling */
  to?: string;
};

/**
 * One tab. Give it onClick, or a route with `to` / `href` (it becomes a
 * link, and works out `active` from the current route when you leave it off).
 */
export function BottomNavItem({ icon, label, active, href, to, className, ...props }: BottomNavItemProps) {
  const route = useHashRoute();
  const target = to ?? href;
  const path = target?.replace(/^#/, '');
  const isActive = active ?? (path?.startsWith('/') ? (path === '/' ? route === '/' : route.startsWith(path)) : false);
  const classes = cn(
    'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-xs font-medium',
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
    '[&_svg]:size-5',
    className,
  );
  if (target !== undefined) {
    const { onClick, id, style, title } = props;
    return (
      <a
        href={hashHref(target)}
        aria-current={isActive ? 'page' : undefined}
        className={classes}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
        id={id}
        style={style}
        title={title}
      >
        {icon}
        {label}
      </a>
    );
  }
  return (
    <button aria-current={isActive ? 'page' : undefined} className={classes} {...props}>
      {icon}
      {label}
    </button>
  );
}
