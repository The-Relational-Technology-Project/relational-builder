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

export function BottomNavItem({
  icon,
  label,
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-xs font-medium',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        '[&_svg]:size-5',
        className,
      )}
      {...props}
    >
      {icon}
      {label}
    </button>
  );
}
