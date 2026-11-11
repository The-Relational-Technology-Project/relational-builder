import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Page layout with the laptop breakpoint built in, so a phone-first app
 * uses the width on a laptop without hand-written `md:` classes:
 *
 *   <Page>
 *     <PageGrid>
 *       <PageMain>…the main question and its list…</PageMain>
 *       <PageAside>…the second column: activity, people, what's next…</PageAside>
 *     </PageGrid>
 *   </Page>
 *
 * Phone: one column, main first. Laptop (md+): main about 60%, aside 40%.
 * TopNav goes inside AppBar and shows from md up; pair it with BottomNav,
 * which apps hide at md with `className="md:hidden"`.
 */
export function Page({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <main className={cn('mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:py-8 md:pb-8', className)} {...props} />;
}

export function PageGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-8', className)}
      {...props}
    />
  );
}

export function PageMain({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex min-w-0 flex-col gap-6', className)} {...props} />;
}

export function PageAside({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <aside className={cn('flex min-w-0 flex-col gap-4 md:sticky md:top-24 md:self-start', className)} {...props} />;
}

/** Laptop navigation for the AppBar; hidden on phones, where BottomNav leads */
export function TopNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav className={cn('ml-auto hidden items-center gap-1 md:flex', className)} {...props} />;
}

/** A route ("/shifts") becomes a hash link, as in BottomNavItem */
export function TopNavItem({
  to,
  active,
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; active?: boolean }) {
  return (
    <a
      href={to.startsWith('/') ? '#' + to : to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-md px-3 py-2 text-sm font-medium',
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}
