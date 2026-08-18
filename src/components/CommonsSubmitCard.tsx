import { useMemo, useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import {
  submitToCommons, detectProjectOutputs, composeProgramBody,
} from '@/project/commons-submit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Map as MapIcon, Sprout, Wrench } from 'lucide-react';

/**
 * "Share it to the Civic Commons" — shown after a successful publish.
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
  const version = useProjectStore(s => s.version);
  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const user = useAuthStore(s => s.user);

  // What this project actually holds decides what can be offered: a working
  // tool, a program (plan docs + printable materials), or either
  const outputs = useMemo(() => {
    void version;
    return detectProjectOutputs(getAllFiles().map(f => ({ path: f.path, content: f.content })));
  }, [version, getAllFiles]);
  const hasProgram = outputs.docs.length > 0 || outputs.materials.length > 0;
  const [shareAs, setShareAs] = useState<'tool' | 'program' | null>(null);
  const effectiveType: 'tool' | 'program' =
    shareAs ?? (hasProgram && (!outputs.hasApp || outputs.docs.length > 0) ? 'program' : 'tool');

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
      ? `Started from the "${lineage.planTitle}" build plan.`
      : lineage?.promptTitle
        ? `Grown from "${lineage.promptTitle}" in the commons.`
        : '';
    // The project's frames travel as tags, so a civic media program lands on
    // the civic media shelf of the commons
    const frameTags = (lineage?.frames ?? []).filter(f => f !== 'practice-first');
    const result = await submitToCommons({
      title: projectName,
      summary: summary.trim(),
      body:
        effectiveType === 'program'
          ? composeProgramBody(outputs, lineageNote)
          : `Built with Relational Builder.${lineageNote ? ` ${lineageNote}` : ''}`,
      builderName: builderName.trim(),
      neighborhood: neighborhood.trim() || undefined,
      contactEmail: user?.email,
      sourceUrl: effectiveUrl,
      contributionType: effectiveType,
      tags: [
        effectiveType === 'program' ? 'program' : 'community-tool',
        'relational-builder',
        ...frameTags,
      ],
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
        Share it to the Civic Commons
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
          {hasProgram && outputs.hasApp && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Share as:</span>
              {(['program', 'tool'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setShareAs(t)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    effectiveType === t
                      ? 'bg-foreground text-background border-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'program' ? <MapIcon className="size-3" /> : <Wrench className="size-3" />}
                  {t === 'program' ? 'Program (plan + materials)' : 'Working tool'}
                </button>
              ))}
            </div>
          )}
          {effectiveType === 'program' && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              A program contribution shares the substance itself:{' '}
              {outputs.docs.length > 0 &&
                `${outputs.docs.length} plan ${outputs.docs.length === 1 ? 'doc' : 'docs'}`}
              {outputs.docs.length > 0 && outputs.materials.length > 0 && ' and '}
              {outputs.materials.length > 0 &&
                `${outputs.materials.length} printable ${outputs.materials.length === 1 ? 'material' : 'materials'}`}
              {' '}go into the commons entry, remixable by the next neighborhood.
            </p>
          )}
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
              {effectiveType === 'program' ? ' link, and the program docs and materials themselves' : ' and link'}
              {lineage?.planTitle || lineage?.promptTitle ? ', plus its lineage' : ''})
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
