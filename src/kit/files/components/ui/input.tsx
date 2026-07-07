import * as React from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // 16px font prevents iOS zoom; 44px height is a comfortable touch target
        'flex h-11 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-base',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
