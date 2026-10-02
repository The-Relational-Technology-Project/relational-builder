import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth-store';
import { useStudioStore } from '@/store/studio-store';
import {
  submitStudioItem, STUDIO_ITEM_KINDS, type StudioItemKind,
} from '@/cloud/studio-library';
import { Check, Library, Loader2, Plus } from 'lucide-react';

/**
 * Contribute something to a studio's gallery that isn't a build.
 *
 * The publish flow's StudioSubmitCard covers "I made this app, put it on the
 * shelf". It does not cover the other half of what a studio collects: a
 * model from someone's town, a practice that works, a prompt, a recipe, a
 * story. Those arrived only through a Studio Admin typing them in, which
 * does not survive contact with a roomful of people at a conference.
 *
 * Everything filed here lands `pending` and studio-private; an admin
 * approves it onto the shelf. The commons checkbox records what the
 * contributor wants and publishes nothing by itself — see
 * `offer_to_commons` in the schema.
 */
export function StudioContributeDialog({
  open,
  onOpenChange,
  studioSlug,
  studioLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studioSlug: string;
  studioLabel: string;
}) {
  const profile = useAuthStore(s => s.profile);
  const loadLibrary = useStudioStore(s => s.loadLibrary);

  const [kind, setKind] = useState<StudioItemKind>('example');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [attribution, setAttribution] = useState(profile?.display_name ?? '');
  const [tags, setTags] = useState('');
  // Default OFF. An offer is to the studio unless its author says otherwise.
  const [offerToCommons, setOfferToCommons] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setKind('example'); setTitle(''); setSummary(''); setBody('');
    setUrl(''); setTags(''); setOfferToCommons(false);
    setDone(false); setError(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await submitStudioItem({
        studio_slug: studioSlug,
        kind,
        title: title.trim(),
        summary: summary.trim() || null,
        body: body.trim() || null,
        url: url.trim() || null,
        attribution: attribution.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 8),
        offer_to_commons: offerToCommons,
      });
      await loadLibrary();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The contribution did not go through');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Library className="size-4 text-primary" />
            Add to the {studioLabel} gallery
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-600" />
              <p className="text-sm font-medium">Offered to {studioLabel}</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Studio Admin reviews it. Once approved it joins the gallery for
              members to find, build from, and remix.
              {offerToCommons
                ? ' You asked for it to go to the broader commons too — the admin will take that step.'
                : ' It stays inside the studio.'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={reset}>
                <Plus className="size-3 mr-1" /> Add another
              </Button>
              <Button size="sm" className="text-xs" onClick={() => { reset(); onOpenChange(false); }}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Something that belongs in this studio's shared shelf — a model
              from your town, a practice that works, a prompt, a recipe, a
              story. It doesn't have to be something you built.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">What kind of thing is it?</label>
              <Select value={kind} onValueChange={v => setKind(v as StudioItemKind)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDIO_ITEM_KINDS.map(k => (
                    <SelectItem key={k.key} value={k.key} className="text-xs">{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Name it — e.g. Tionesta Market Village" className="h-8 text-xs" />
            <textarea value={summary} onChange={e => setSummary(e.target.value)}
              placeholder="One or two sentences. This is the line other members (and the AI) see first."
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring" />
            <textarea value={body} onChange={e => setBody(e.target.value)}
              placeholder="The detail, if you have it: how it works, what it cost, who runs it, what another town would change. Optional."
              rows={4}
              className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring" />
            <Input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="Link, if there is one" className="h-8 text-xs" />
            <Input value={attribution} onChange={e => setAttribution(e.target.value)}
              placeholder="Who this comes from (credited on the shelf)" className="h-8 text-xs" />
            <Input value={tags} onChange={e => setTags(e.target.value)}
              placeholder="Tags, comma separated — e.g. childcare, main street, vt" className="h-8 text-xs" />

            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer rounded-md border border-dashed p-2.5">
              <input type="checkbox" checked={offerToCommons}
                onChange={e => setOfferToCommons(e.target.checked)} className="mt-0.5" />
              <span>
                <strong className="text-foreground font-medium">
                  Also offer this to the broader RT Commons
                </strong>
                <br />
                Leave unchecked and it stays inside {studioLabel}. Either way a
                Studio Admin reviews it first — checking this doesn't publish
                anything, it tells the admin what you'd like.
              </span>
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button size="sm" className="w-full text-xs gap-1.5"
              disabled={!title.trim() || submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 className="size-3 animate-spin" /> : <Library className="size-3" />}
              Offer to {studioLabel}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
