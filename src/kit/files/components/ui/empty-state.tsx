import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * A warm empty state — every list in a community tool starts empty, and
 * that first render should invite, not apologize.
 *
 *   <EmptyState
 *     icon={<Hammer />}
 *     title="Nothing on the shelf yet"
 *     hint="Add the first item — a ladder, a wagon, a waffle iron."
 *     action={<Button>Add an item</Button>}
 *   />
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
