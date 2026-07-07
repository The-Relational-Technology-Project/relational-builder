import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Minimal Slot: render the child element itself, merging in the props the
 * parent wants to add (shadcn's asChild pattern, without a dependency).
 */
export function Slot({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (React.isValidElement(children)) {
    const childProps = children.props as { className?: string };
    return React.cloneElement(children, {
      ...props,
      className: cn(className, childProps.className),
    } as Partial<unknown>);
  }
  return <span className={className} {...props}>{children}</span>;
}
