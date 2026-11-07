import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Heart, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { useFridge } from '@/store';
import { people, type FridgeStatus, type Update, type UpdateKind, type PersonId } from '@/data/seed';

export function ago(at: number) {
  return Date.now() - at < 60_000 ? 'just now' : formatDistanceToNowStrict(at, { addSuffix: true });
}
const nameOf = (id: PersonId) => people[id].name;

const STATUS: Record<FridgeStatus, { title: string; hint: string; color: string; button: string }> = {
  full: { title: 'Fridge is full', hint: 'Come take what you need.', color: 'var(--full)', button: 'Full' },
  some: { title: 'Some food inside', hint: 'Worth a look — and room for more.', color: 'var(--some)', button: 'Some' },
  empty: { title: 'Fridge is empty', hint: 'Anything helps: sealed, labeled, dated.', color: 'var(--empty)', button: 'Empty' },
};

export function StatusCard() {
  const status = useFridge((s) => s.status);
  const setStatus = useFridge((s) => s.setStatus);
  const m = STATUS[status.value];
  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-sm">
      <div className="px-5 py-6 text-[var(--on-status)] transition-colors" style={{ background: m.color }} aria-live="polite">
        <p className="text-sm font-bold uppercase tracking-wider opacity-90">Right now</p>
        <h1 className="font-display text-5xl font-extrabold leading-[1.05] md:text-6xl">{m.title}</h1>
        <p className="mt-2 text-xl">{m.hint}</p>
        <p className="mt-3 text-sm opacity-90">
          {nameOf(status.by)} checked {ago(status.at)}
        </p>
      </div>
      <div className="p-4">
        <p className="mb-2 font-bold">Just looked inside? Tap what you saw.</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(STATUS) as FridgeStatus[]).map((v) => (
            <Button
              key={v}
              size="lg"
              variant={status.value === v ? 'default' : 'outline'}
              aria-pressed={status.value === v}
              onClick={() => setStatus(v)}
            >
              {STATUS[v].button}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

const KINDS: { v: UpdateKind; label: string; placeholder: string }[] = [
  { v: 'stocked', label: 'I stocked', placeholder: 'What did you leave? e.g. a dozen eggs, apples, two loaves' },
  { v: 'low', label: 'Running low', placeholder: "What's missing? e.g. milk, diapers size 4" },
  { v: 'note', label: 'Fridge note', placeholder: 'Anything neighbors should know' },
];

export function PostForm() {
  const post = useFridge((s) => s.post);
  const [kind, setKind] = useState<UpdateKind>('stocked');
  const [text, setText] = useState('');
  const [posted, setPosted] = useState(false);
  const current = KINDS.find((k) => k.v === kind)!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    post(kind, text.trim());
    setText('');
    setPosted(true);
    setTimeout(() => setPosted(false), 3000);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="font-display text-2xl font-extrabold">Post an update</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of update">
          {KINDS.map((k) => (
            <button
              key={k.v}
              type="button"
              role="radio"
              aria-checked={kind === k.v}
              onClick={() => setKind(k.v)}
              className={`min-h-11 rounded-full border px-4 font-bold transition-colors ${
                kind === k.v
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-secondary'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Label htmlFor="update-text" className="sr-only">Update</Label>
          <Textarea
            id="update-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={current.placeholder}
            rows={3}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" disabled={!text.trim()}>Post update</Button>
            {posted && (
              <span className="flex items-center gap-1 font-bold text-primary" role="status">
                <Check className="size-5" /> Posted — thank you.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const BADGE: Record<UpdateKind, { label: string; variant: 'default' | 'destructive' | 'secondary' }> = {
  stocked: { label: 'Stocked', variant: 'default' },
  low: { label: 'Running low', variant: 'destructive' },
  note: { label: 'Note', variant: 'secondary' },
};

function UpdateCard({ u }: { u: Update }) {
  const me = useFridge((s) => s.me);
  const bring = useFridge((s) => s.bring);
  const toggleThanks = useFridge((s) => s.toggleThanks);
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState('');
  const mine = u.authorId === me;
  const myBring = u.bringing.find((b) => b.personId === me);
  const thanked = u.thanks.includes(me);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={nameOf(u.authorId)} />
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight">{nameOf(u.authorId)}</p>
            <p className="text-sm text-muted-foreground">{ago(u.at)}</p>
          </div>
          <Badge variant={BADGE[u.kind].variant}>{BADGE[u.kind].label}</Badge>
        </div>
        <p className="text-lg">{u.text}</p>

        {u.bringing.length > 0 && (
          <ul className="space-y-1">
            {u.bringing.map((b) => (
              <li key={b.personId} className="flex items-start gap-2 rounded-[calc(var(--radius)/2)] bg-accent px-3 py-2 text-accent-foreground">
                <Check className="mt-1 size-4 shrink-0" />
                <span>
                  <strong>{b.personId === 'you' ? "You're" : `${nameOf(b.personId)} is`}</strong> bringing {b.what}
                </span>
              </li>
            ))}
          </ul>
        )}

        {u.kind === 'low' && !mine && !open && (
          <Button variant="secondary" onClick={() => { setWhat(myBring?.what ?? ''); setOpen(true); }}>
            <MessageCircle className="size-4" /> {myBring ? 'Change what I’m bringing' : "I'll bring some"}
          </Button>
        )}
        {u.kind === 'low' && open && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => { e.preventDefault(); if (what.trim()) { bring(u.id, what.trim()); setOpen(false); } }}
          >
            <Input autoFocus value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What and when? e.g. milk, tonight" aria-label="What you're bringing" />
            <div className="flex gap-2">
              <Button type="submit" disabled={!what.trim()}>Count me in</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {u.kind !== 'low' && (
          <div className="flex items-center gap-3">
            {!mine && (
              <Button variant={thanked ? 'default' : 'outline'} size="sm" aria-pressed={thanked} onClick={() => toggleThanks(u.id)}>
                <Heart className={`size-4 ${thanked ? 'fill-current' : ''}`} /> Thank you
              </Button>
            )}
            {u.thanks.length > 0 && (
              <span className="text-sm text-muted-foreground">Thanked by {u.thanks.map(nameOf).join(' & ')}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UpdateFeed() {
  const updates = useFridge((s) => s.updates);
  return (
    <section className="space-y-3">
      <h2 className="font-display px-1 text-2xl font-extrabold">What's in, what's out</h2>
      {updates.length === 0 ? (
        <EmptyState icon={<Heart />} title="Quiet at the fridge" hint="Dropped something off? Let the block know — be the first update." />
      ) : (
        updates.map((u) => <UpdateCard key={u.id} u={u} />)
      )}
    </section>
  );
}