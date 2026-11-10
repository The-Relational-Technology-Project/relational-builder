import * as React from 'react';
import { cn } from '../../lib/utils';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-base' } as const;

/**
 * Avatar with graceful fallback: shows the image when it loads, otherwise
 * initials derived from `name` on a tinted background.
 */
export function Avatar({
  src,
  name,
  size = 'md',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { src?: string; name?: string; size?: 'sm' | 'md' | 'lg' | string }) {
  const [failed, setFailed] = React.useState(false);
  // A missing name (a lookup that found nobody yet) must not crash the page:
  // show a neutral mark instead (gpt-oss, Nov 4: `name={users[id]?.name}`)
  const initials = (name ?? '')
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-secondary-foreground font-medium',
        SIZES[size as keyof typeof SIZES] ?? SIZES.md,
        className,
      )}
      {...props}
    >
      {src && !failed ? (
        <img src={src} alt={name ?? ''} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{initials || '·'}</span>
      )}
    </div>
  );
}
