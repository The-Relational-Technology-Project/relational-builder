import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Tabs, shadcn-shaped without a dependency:
 *
 *   <Tabs defaultValue="shelf">
 *     <TabsList>
 *       <TabsTrigger value="shelf">Shelf</TabsTrigger>
 *       <TabsTrigger value="mine">My items</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="shelf">…</TabsContent>
 *     <TabsContent value="mine">…</TabsContent>
 *   </Tabs>
 */

const TabsContext = React.createContext<{
  value: string;
  setValue: (v: string) => void;
} | null>(null);

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? '');
  const value = controlled ?? uncontrolled;
  const setValue = (v: string) => {
    if (controlled === undefined) setUncontrolled(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn('flex flex-col gap-3', className)} {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex h-11 w-fit items-center rounded-[var(--radius)] bg-muted p-1 text-muted-foreground', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => ctx?.setValue(value)}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  value,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return <div role="tabpanel" className={className} {...props} />;
}
