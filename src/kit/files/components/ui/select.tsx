import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Styled NATIVE select — use it exactly like <select>, with <option>
 * children. Native pickers are the most reliable and accessible on phones,
 * which is where community tools live.
 *
 *   <Select value={v} onChange={e => setV(e.target.value)}>
 *     <option value="tools">Tools</option>
 *   </Select>
 */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative w-full', className)}>
      <select
        className={cn(
          'h-11 w-full appearance-none rounded-[var(--radius)] border border-input bg-background px-3 pr-9 text-base',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
