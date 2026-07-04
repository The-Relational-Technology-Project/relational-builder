import { useState } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2, Sparkles } from 'lucide-react';
import { fetchStudioBuildPlan, studioPlanToMarkdown } from '@/knowledge/studio-plans';

/**
 * Import a build plan from RTP Studio (or anywhere) as the starting point
 * for a project. The plan lands in the chat as a plan-mode message with a
 * "Build this plan" action, and its provenance is recorded as project
 * lineage so it flows into the .reltech.yml manifest on export.
 */
interface DialogControl {
  /** Controlled open state — when provided, the internal trigger is hidden */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
}

export function ImportPlanDialog({ open: controlledOpen, onOpenChange, hideTrigger }: DialogControl = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [plan, setPlan] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [studioRef, setStudioRef] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const importBuildPlan = useChatStore(s => s.importBuildPlan);
  const setLineage = useProjectStore(s => s.setLineage);

  async function handleFetchFromStudio() {
    const ref = studioRef.trim();
    if (!ref) return;
    setFetching(true);
    setFetchError(null);
    const studioPlan = await fetchStudioBuildPlan(ref);
    setFetching(false);
    if (!studioPlan) {
      setFetchError("Couldn't find a shared plan for that link or ID — check that it's shared in Studio.");
      return;
    }
    setPlan(studioPlanToMarkdown(studioPlan));
    if (/^https?:\/\//i.test(ref)) setSourceUrl(ref);
  }

  function handleImport() {
    const trimmed = plan.trim();
    if (!trimmed) return;

    importBuildPlan(trimmed);
    setLineage({
      source: 'rtp-studio-plan',
      planTitle: extractTitle(trimmed),
      sourceUrl: sourceUrl.trim() || undefined,
      importedAt: new Date().toISOString(),
    });

    setPlan('');
    setSourceUrl('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs'}>
          <FileDown className="size-3" />
          Import Plan
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a build plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste a build plan from RTP Studio (or write your own). It becomes the
            starting draft in plan mode — refine it in chat, then press{' '}
            <strong>Build this plan</strong>. Its lineage travels with the project
            when you publish to the commons.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="studio-ref" className="text-xs">Fetch from RTP Studio</Label>
            <div className="flex gap-2">
              <Input
                id="studio-ref"
                value={studioRef}
                onChange={e => setStudioRef(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchFromStudio()}
                placeholder="Paste a Studio share link or plan ID..."
                className="text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1 shrink-0"
                disabled={!studioRef.trim() || fetching}
                onClick={handleFetchFromStudio}
              >
                {fetching ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                Fetch
              </Button>
            </div>
            {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-text" className="text-xs">Build plan (markdown)</Label>
            <textarea
              id="plan-text"
              value={plan}
              onChange={e => setPlan(e.target.value)}
              placeholder="# Build plan: Neighborhood tool library&#10;&#10;## What we're building..."
              rows={10}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-xs font-mono outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-url" className="text-xs">Source link (optional)</Label>
            <Input
              id="plan-url"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://studio.relationaltechproject.org/..."
              className="text-xs"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleImport} disabled={!plan.trim()}>
              Import as starting plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Pull a title from the plan's first markdown heading, if present */
function extractTitle(markdown: string): string | undefined {
  const match = markdown.match(/^#{1,3}\s+(.+)$/m);
  return match ? match[1].replace(/^Build plan:?\s*/i, '').trim() : undefined;
}
