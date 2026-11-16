import * as React from 'react';
import { cn } from '../../lib/utils';
import { Avatar } from './avatar';

/**
 * A short live list for the second column at laptop width: this week's
 * shifts with who has each, the latest thank-yous, what is next and who
 * is doing it. Three to five rows, each a person, what, and when.
 *
 *   <ListCard title="This week's shifts" action={<Button variant="ghost" size="sm">See all</Button>}>
 *     <ListCardRow name="Rosa Diaz" what="Restock and wipe down" when="Tue 8am" />
 *     <ListCardRow name="Open" what="Evening check" when="Wed 6pm" open />
 *   </ListCard>
 *
 * An `open` row (nobody yet) reads as an invitation, not an empty slot.
 */
export function ListCard({
  title,
  action,
  className,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, 'title'> & { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card text-card-foreground', className)} {...props}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {action}
      </header>
      <ul className="flex flex-col divide-y divide-border px-4 pb-2">{children}</ul>
    </section>
  );
}

export function ListCardRow({
  name,
  what,
  when,
  open,
  action,
  className,
  ...props
}: Omit<React.LiHTMLAttributes<HTMLLIElement>, 'title'> & {
  /** Who: a person's name; left out or `open` for a slot nobody has taken */
  name?: string;
  /** What, in plain words */
  what: React.ReactNode;
  /** When, as people say it ("Tue 8am", "2 hours ago") */
  when?: React.ReactNode;
  open?: boolean;
  /** Optional small action for this row ("Take it") */
  action?: React.ReactNode;
}) {
  const isOpen = open || !name;
  return (
    <li className={cn('flex items-center gap-3 py-3', className)} {...props}>
      {isOpen ? (
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-xs text-muted-foreground">+</span>
      ) : (
        <Avatar name={name} size="sm" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{isOpen ? 'Open: anyone can take it' : name}</p>
        <p className="text-sm text-muted-foreground">{what}{when ? <span> · {when}</span> : null}</p>
      </div>
      {action}
    </li>
  );
}
