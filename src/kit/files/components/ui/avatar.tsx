import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Avatar with graceful fallback: shows the image when it loads, otherwise
 * initials derived from `name` on a tinted background.
 */
export function Avatar({
  src,
  name,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { src?: string; name: string }) {
  const [failed, setFailed] = React.useState(false);
  const initials = name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-secondary-foreground text-sm font-medium',
        className,
      )}
      {...props}
    >
      {src && !failed ? (
        <img src={src} alt={name} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  );
}
