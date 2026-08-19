import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth-store';
import { submitToCommons } from '@/project/commons-submit';
import { sendContactMessage } from '@/cloud/contact';
import { Check, Loader2, Plus, Sprout, X } from 'lucide-react';

/**
 * The front door for giving to the commons — reachable from the header
 * everywhere, not just buried at the bottom of the Publish flow. Modeled on
 * Relational Tech Studio's Contribute dialog: pick what kind of gift it is,
 * describe it, attach links, and it goes to the stewards for review.
 *
 * Most categories land in the commons review queue (submit-contribution →
 * steward email); Feedback is a message to the stewards rather than a
 * commons entry, so it rides the contact channel instead.
 */

type Category = 'story' | 'tool' | 'resource' | 'idea' | 'feedback';

const CATEGORIES: {
  key: Category;
  label: string;
  hint: string;
}[] = [
  {
    key: 'story',
    label: 'Story',
    hint:
      'Add your insights and learnings (and mistakes!) from your neighborhood. ' +
      'RTP stewards will tag it to the appropriate Commons collection — then your ' +
      'contribution shapes the journey of other neighborhood stewards around the world.',
  },
  {
    key: 'tool',
    label: 'Tool',
    hint:
      'A tool or app that helps neighbors — built in Relational Builder or anywhere ' +
      'else. Link the live version or the code if you have one.',
  },
  {
    key: 'resource',
    label: 'Resource',
    hint:
      'A link or doc worth sharing — an article, a guide, a template, an example ' +
      'from another neighborhood. Stewards will shelve it where the next builder can find it.',
  },
  {
    key: 'idea',
    label: 'Idea',
    hint:
      'Something you wish existed. Ideas become build prompts in the commons — ' +
      'starting points another neighborhood can pick up and run with.',
  },
  {
    key: 'feedback',
    label: 'Feedback',
    hint:
      'Thoughts on Relational Builder or the commons itself — what worked, what ' +
      "didn't, what you wish it did. This one goes straight to the stewards.",
  },
];

/** Where each category lands in the commons queue. Feedback never gets here. */
const KIND_FOR: Record<Exclude<Category, 'feedback'>, 'story' | 'tool' | 'reference' | 'prompt'> = {
  story: 'story',
  tool: 'tool',
  resource: 'reference',
  idea: 'prompt',
};

export function ContributeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);

  const [category, setCategory] = useState<Category | ''>('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood ?? '');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = CATEGORIES.find(c => c.key === category);
  const effectiveEmail = user?.email ?? (email.trim() || undefined);
  const cleanLinks = links.map(l => l.trim()).filter(Boolean);
  const canSubmit =
    !!category && title.trim().length >= 3 && text.trim().length > 0 && name.trim().length > 0;

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      // A fresh dialog next time — a sent gift shouldn't linger as a draft
      setDone(false);
      setError(null);
      setSubmitting(false);
    }
  };

  async function handleSubmit() {
    if (!category) return;
    setSubmitting(true);
    setError(null);

    if (category === 'feedback') {
      // Feedback is a note to the stewards, not a commons entry
      try {
        await sendContactMessage({
          name: name.trim(),
          email: effectiveEmail,
          neighborhood: neighborhood.trim() || undefined,
          message: [
            `[Feedback] ${title.trim()}`,
            '',
            text.trim(),
            ...(cleanLinks.length ? ['', `Links: ${cleanLinks.join(' ')}`] : []),
          ].join('\n'),
        });
        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not send your feedback');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // The first link is the contribution's source; any extras travel in the body
    const body =
      text.trim() +
      (cleanLinks.length > 1 ? `\n\nMore links:\n${cleanLinks.slice(1).join('\n')}` : '');
    const result = await submitToCommons({
      title: title.trim(),
      summary: text.trim().length <= 1000 ? text.trim() : `${text.trim().slice(0, 297)}…`,
      body,
      builderName: name.trim(),
      neighborhood: neighborhood.trim() || undefined,
      contactEmail: effectiveEmail,
      sourceUrl: cleanLinks[0],
      contributionType: KIND_FOR[category],
      tags: ['relational-builder', `contributed-${category}`],
    });
    setSubmitting(false);
    if (result.ok) setDone(true);
    else setError(result.error ?? 'Submission failed');
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sprout className="size-4 text-green-600" />
            Contribute
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Check className="size-4 text-green-600" />
                <p className="text-sm font-medium">
                  {category === 'feedback' ? 'Sent to the stewards' : 'Offered to the commons'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {category === 'feedback'
                  ? 'Thank you — your feedback went straight to the RTP stewards.'
                  : `Thank you — Deborah Tien, one of the RTP stewards, will review it and tag it
                     into the right Commons collection. Nothing becomes public before a steward
                     has read it${effectiveEmail ? ", and she'll be in touch" : ''}.`}
              </p>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Share a story, a tool, an idea, feedback, resources. All of these are
              gifts to the commons — and to the neighborhood stewards who build from it.
            </p>

            {/* Type of contribution */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Type of contribution</label>
              <Select value={category} onValueChange={v => setCategory(v as Category)}>
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key} className="text-sm">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {active && (
                <p className="text-xs text-muted-foreground leading-relaxed">{active.hint}</p>
              )}
            </div>

            {/* Short description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Short description</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="A short description of your contribution"
                className="h-9 text-sm"
                maxLength={150}
              />
            </div>

            {/* The contribution itself */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Your contribution</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Share what you'd like to add to the commons…"
                rows={5}
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
            </div>

            {/* Links */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Links <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={l}
                    onChange={e => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="https://…"
                    className="h-8 text-sm"
                    type="url"
                  />
                  {links.length > 1 && (
                    <button
                      onClick={() => setLinks(links.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Remove link"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {links.length < 3 && (
                <button
                  onClick={() => setLinks([...links, ''])}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="size-3" /> Add link
                </button>
              )}
            </div>

            {/* Who it's from */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name (credited)"
                className="h-8 text-sm"
              />
              <Input
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                placeholder="Neighborhood (optional)"
                className="h-8 text-sm"
              />
            </div>

            {/* Sending as — the address a steward can reach you at */}
            {user?.email ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Sending as</p>
                <p className="text-sm">
                  {name.trim() || 'You'} · <span className="text-muted-foreground">{user.email}</span>
                </p>
              </div>
            ) : (
              <Input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (optional — so a steward can reach you)"
                className="h-8 text-sm"
                type="email"
              />
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              {category === 'feedback'
                ? "We'll send this to the RTP stewards, and they'll be in touch."
                : "We'll send this to Deborah Tien, one of the stewards — she'll review it, tag it into the right Commons collection, and be in touch. Nothing becomes public until a steward has read it."}
            </p>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button size="sm" className="gap-1.5" disabled={!canSubmit || submitting} onClick={handleSubmit}>
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Sprout className="size-3.5" />}
                Submit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The gallery's invitation to give back — Deb's framing, right where people
 * are already browsing what others gave. Opens the same Contribute dialog
 * as the header button.
 */
export function ContributeCallout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-dashed border-green-600/40 bg-green-600/5 p-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[16rem] space-y-0.5">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Sprout className="size-3.5 text-green-600" />
          Want to share a link, doc, or story from your neighborhood?
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add your insights and learnings (and mistakes!) here. RTP stewards will tag
          it to the appropriate Commons collection — then your contribution shapes the
          journey of other neighborhood stewards around the world.
        </p>
      </div>
      <Button size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => setOpen(true)}>
        <Sprout className="size-3" />
        Contribute
      </Button>
      {open && <ContributeDialog open={open} onOpenChange={setOpen} />}
    </div>
  );
}

/**
 * The header's Contribute door — always visible, like Relational Tech
 * Studio's. Rendered as a quiet outline next to the project's Share CTA so
 * the two never compete, but never hidden behind a publish.
 */
export function ContributeButton({ mobile }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={mobile ? 'h-8 gap-1 text-xs' : 'h-7 gap-1 rounded-full px-3 text-xs'}
        onClick={() => setOpen(true)}
      >
        <Sprout className="size-3 text-green-600" />
        Contribute
      </Button>
      {open && <ContributeDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
