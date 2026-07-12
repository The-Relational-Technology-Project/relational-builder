import { useMemo, useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import { useStudioStore, approvedMemberships } from '@/store/studio-store';
import { submitStudioItem } from '@/cloud/studio-library';
import {
  detectProjectOutputs, composeProgramBody,
} from '@/project/commons-submit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Library } from 'lucide-react';

/**
 * "Share it to your studio's gallery" — the studio remix loop's on-ramp,
 * shown beside the commons offer for builders who belong to a gated studio.
 * The offer lands as pending; a Studio Admin approves it onto the shelf,
 * where the next member finds and remixes it. If this build started from a
 * shelf item, the remix lineage rides along automatically.
 */
export function StudioSubmitCard({
  projectName,
  sourceUrl,
}: {
  projectName: string;
  sourceUrl?: string;
}) {
  const lineage = useProjectStore(s => s.lineage);
  const version = useProjectStore(s => s.version);
  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const profile = useAuthStore(s => s.profile);
  const memberships = useStudioStore(s => s.memberships);
  const accessMap = useStudioStore(s => s.accessMap);
  const library = useStudioStore(s => s.library);
  const loadLibrary = useStudioStore(s => s.loadLibrary);

  // Only gated studios run the review loop — open studios share to the
  // commons like everyone else
  const gatedStudios = useMemo(
    () => approvedMemberships(memberships).filter(m => accessMap.get(m.studio_slug) === 'gated'),
    [memberships, accessMap],
  );

  const [slug, setSlug] = useState<string>('');
  const targetSlug = slug || gatedStudios[0]?.studio_slug || '';
  const target = gatedStudios.find(m => m.studio_slug === targetSlug);

  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState('');
  const [attribution, setAttribution] = useState(profile?.display_name ?? '');
  const [manualUrl, setManualUrl] = useState('');
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gatedStudios.length === 0) return null;

  // The remix thread: only claim lineage the shelf can actually resolve
  const remixOf = lineage?.studioItemId
    ? library.find(i => i.id === lineage.studioItemId) ?? null
    : null;

  if (done && target) {
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <Check className="size-3.5 text-green-600" />
          <p className="text-xs font-medium">Offered to {target.studio_label}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          A Studio Admin will review it — once approved it joins the{' '}
          {target.studio_label} gallery for other members to find and remix.
        </p>
      </div>
    );
  }

  async function handleSubmit() {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      const outputs = detectProjectOutputs(
        getAllFiles().map(f => ({ path: f.path, content: f.content })),
      );
      void version;
      const lineageNote = remixOf ? `Remixed from "${remixOf.title}".` : '';
      const hasProgram = outputs.docs.length > 0 || outputs.materials.length > 0;
      await submitStudioItem({
        studio_slug: target.studio_slug,
        kind: 'example',
        title: projectName,
        summary: summary.trim(),
        body: hasProgram
          ? composeProgramBody(outputs, lineageNote)
          : `Built with Relational Builder.${lineageNote ? ` ${lineageNote}` : ''}`,
        url: sourceUrl || manualUrl.trim() || null,
        attribution: attribution.trim() || null,
        tags: ['relational-builder', ...(remixOf ? ['remix'] : [])],
        remix_of: remixOf?.id ?? null,
      });
      await loadLibrary();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The offer did not go through');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium w-full text-left"
      >
        <Library className="size-3.5 text-primary" />
        Share it to {gatedStudios.length === 1 ? `the ${gatedStudios[0].studio_label} gallery` : 'your studio\'s gallery'}
        <span className="text-muted-foreground font-normal ml-auto">
          {expanded ? 'close' : 'optional'}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Offer this build to your studio's own gallery. A Studio Admin
            reviews it; approved builds appear for studio members only — until
            an admin later shares them with the broader commons.
          </p>
          {gatedStudios.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {gatedStudios.map(m => (
                <button
                  key={m.studio_slug}
                  onClick={() => setSlug(m.studio_slug)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    targetSlug === m.studio_slug
                      ? 'bg-foreground text-background border-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.studio_label}
                </button>
              ))}
            </div>
          )}
          {remixOf && (
            <p className="text-xs text-muted-foreground">
              Lineage travels with it: this build is a remix of{' '}
              <strong>"{remixOf.title}"</strong>.
            </p>
          )}
          <Input
            value={attribution}
            onChange={e => setAttribution(e.target.value)}
            placeholder="Your name (credited in the studio gallery)"
            className="h-7 text-xs"
          />
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="One or two sentences on what this is and who it's for..."
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          {!sourceUrl && (
            <Input
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
              placeholder="Link to the live app (publish above to fill this automatically)"
              className="h-7 text-xs"
            />
          )}
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={e => setConsented(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I've reviewed what will be shared with {target?.studio_label} (name,
              summary, link{remixOf ? ', and its remix lineage' : ''}) and I want
              it offered to the studio gallery.
            </span>
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            disabled={!consented || !summary.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="size-3 animate-spin" /> : <Library className="size-3" />}
            Offer to {target?.studio_label ?? 'the studio'}
          </Button>
        </div>
      )}
    </div>
  );
}
