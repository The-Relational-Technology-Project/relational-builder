import { format, isToday, isTomorrow } from 'date-fns';
import { Sparkles, Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useFridge } from '@/store';
import { people, shiftInfo, type Shift, type PersonId } from '@/data/seed';

const nameOf = (id: PersonId) => people[id].name;
const onIt = (id: PersonId) => (id === 'you' ? "You're on it" : `${nameOf(id)}'s on it`);

function dayLabel(d: number) {
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE');
}

function ShiftRow({ shift }: { shift: Shift }) {
  const me = useFridge((s) => s.me);
  const claim = useFridge((s) => s.claim);
  const drop = useFridge((s) => s.drop);
  const join = useFridge((s) => s.join);
  const leave = useFridge((s) => s.leave);
  const info = shiftInfo[shift.kind];
  const Icon = shift.kind === 'clean' ? Sparkles : Package;
  const helping = shift.helpers.includes(me);

  return (
    <div className="flex flex-col gap-3 border-t border-border py-3 first:border-t-0 sm:flex-row sm:items-center md:flex-col md:items-stretch lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-tight">{info.label}</p>
          <p className="text-sm text-muted-foreground">{info.time}</p>
          {shift.claimedBy && (
            <div className="mt-1 flex items-center gap-2">
              <Avatar name={nameOf(shift.claimedBy)} className="size-6 text-xs" />
              <span className="text-sm">
                <strong>{onIt(shift.claimedBy)}</strong>
                {shift.helpers.length > 0 && <> with {shift.helpers.map(nameOf).join(' & ')}</>}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!shift.claimedBy && (
          <>
            <Badge variant="outline">Open</Badge>
            <Button onClick={() => claim(shift.id)}>Claim it</Button>
          </>
        )}
        {shift.claimedBy === me && (
          <Button variant="outline" onClick={() => drop(shift.id)}>Drop it</Button>
        )}
        {shift.claimedBy && shift.claimedBy !== me && !helping && (
          <Button variant="secondary" onClick={() => join(shift.id)}>
            Join {shift.claimedBy === 'you' ? 'them' : nameOf(shift.claimedBy)}
          </Button>
        )}
        {helping && (
          <>
            <span className="flex items-center gap-1 text-sm font-bold text-primary"><Check className="size-4" /> Helping</span>
            <Button variant="ghost" size="sm" onClick={() => leave(shift.id)}>Leave</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function ShiftBoard() {
  const shifts = useFridge((s) => s.shifts);
  const open = shifts.filter((s) => !s.claimedBy).length;
  const days = Array.from(new Set(shifts.map((s) => s.date)));

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="font-display text-3xl font-extrabold">This week's shifts</h2>
        <p className="text-muted-foreground">
          {open === 0 ? 'Every shift has someone. Thank you, Judah St.' : `${open} of ${shifts.length} still need someone.`} Meet at the fridge out front of the laundromat.
        </p>
      </div>
      {days.map((d) => (
        <Card key={d}>
          <CardContent className="p-4">
            <h3 className="font-display text-xl font-extrabold">
              {dayLabel(d)} <span className="text-base font-semibold text-muted-foreground">{format(d, 'MMM d')}</span>
            </h3>
            {shifts.filter((s) => s.date === d).map((s) => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}