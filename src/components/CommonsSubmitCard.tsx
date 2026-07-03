import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import { submitToCommons } from '@/project/commons-submit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Sprout } from 'lucide-react';

/**
 * "Share it to the RT Commons" — shown after a successful publish.
 * Consent-first: the builder sees exactly what will be shared and must
 * check the box before anything is sent. Submissions are reviewed by a
 * steward before becoming public.
 */
export function CommonsSubmitCard({
  projectName,
  sourceUrl,
}: {
  projectName: string;
  sourceUrl?: string;
}) {
  const lineage = useProjectStore(s => s.lineage);
  const user = useAuthStore(s => s.user);

  const [expanded, setExpanded] = useState(false);
  const [builderName, setBuilderName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [summary, setSummary] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveUrl = sourceUrl || manualUrl.trim() || undefined;

  if (done) {
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <Check className="size-3.5 text-green-600" />
          <p className="text-xs font-medium">Shared with the commons</p>
        </div>
        <p className="text-xs text-muted-foreground">
          A steward will review it — once approved it joins the library and
          appears in the network feed, credited to {builderName}.
        </p>
      </div>
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const lineageNote = lineage?.planTitle
      ? ` Started from the "${lineage.planTitle}" build plan.`
      : '';
    const result = await submitToCommons({
      title: projectName,
      summary: summary.trim(),
      body: `Built with Relational Builder.${lineageNote}`,
      builderName: builderName.trim(),
      neighborhood: neighborhood.trim() || undefined,
      contactEmail: user?.email,
      sourceUrl: effectiveUrl,
      tags: ['community-tool', 'relational-builder'],
    });
    setSubmitting(false);
    if (result.ok) setDone(true);
    else setError(result.error ?? 'Submission failed');
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium w-full text-left"
      >
        <Sprout className="size-3.5 text-green-600" />
        Share it to the RT Commons
        <span className="text-muted-foreground font-normal ml-auto">
          {expanded ? 'close' : 'optional'}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Offer this build back to the network so other neighborhoods can
            find and remix it. A steward reviews every contribution before it
            becomes public. You'll be credited by name.
          </p>
          <Input
            value={builderName}
            onChange={e => setBuilderName(e.target.value)}
            placeholder="Your name (credited in the commons)"
            className="h-7 text-xs"
          />
          <Input
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            placeholder="Neighborhood (optional) — e.g. Outer Sunset, SF"
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
              placeholder="Link to the live tool or repo (optional)"
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
              I've reviewed what will be shared (name, neighborhood, summary,
              and link{lineage?.planTitle ? ', plus its build-plan lineage' : ''})
              and I want it offered to the commons.
            </span>
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            disabled={!consented || !builderName.trim() || !summary.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="size-3 animate-spin" /> : <Sprout className="size-3" />}
            Offer to the commons
          </Button>
        </div>
      )}
    </div>
  );
}
