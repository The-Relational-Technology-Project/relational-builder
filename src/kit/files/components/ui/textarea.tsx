import * as React from 'react';
import { cn } from '../../lib/utils';

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[88px] w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-base',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
