import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Dialog, shadcn-shaped without a dependency:
 *
 *   <Dialog open={open} onOpenChange={setOpen}>
 *     <DialogTrigger>Ask to borrow</DialogTrigger>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Ask to borrow</DialogTitle>
 *         <DialogDescription>Maria will get a note.</DialogDescription>
 *       </DialogHeader>
 *       …
 *       <DialogFooter>…</DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 *
 * Works uncontrolled (trigger opens it) or controlled via open/onOpenChange.
 * Esc and clicking the backdrop close it.
 */

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
} | null>(null);

export function Dialog({
  open: controlled,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = controlled ?? uncontrolled;
  const setOpen = (v: boolean) => {
    if (controlled === undefined) setUncontrolled(v);
    onOpenChange?.(v);
  };
  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(DialogContext);
  return (
    <button
      className={className}
      onClick={e => { onClick?.(e); ctx?.setOpen(true); }}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(DialogContext);
  const open = ctx?.open ?? false;

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') ctx?.setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={() => ctx?.setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={cn(
          'relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-background text-foreground shadow-lg',
          'rounded-t-[var(--radius)] sm:rounded-[var(--radius)] border border-border p-5',
          className,
        )}
        {...props}
      >
        {children}
        <button
          aria-label="Close"
          onClick={() => ctx?.setOpen(false)}
          className="absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 pb-3 pr-8', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4', className)} {...props} />;
}

export function DialogClose({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(DialogContext);
  return (
    <button
      className={className}
      onClick={e => { onClick?.(e); ctx?.setOpen(false); }}
      {...props}
    />
  );
}
