import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  applyProfileRefresh,
  previewProfileRefresh,
  type ProfileChange,
  type ProfileData,
} from '@/project/builder-profile';
import { Check, Loader2, RefreshCw } from 'lucide-react';

/**
 * Refresh from RB: re-seed the builder page's data file from the account
 * and show exactly what would change before writing anything. Fields the
 * builder wrote (practice highlights, ideas, sections, descriptions) never
 * move; only RB-sourced facts do. Opens on the page project itself.
 */
export function RefreshBuilderPageDialog({
  open,
  onOpenChange,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied?: () => void;
}) {
  const [preview, setPreview] = useState<{ next: ProfileData; changes: ProfileChange[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreview(null);
    setError(null);
    setDone(false);
    previewProfileRefresh()
      .then(r => {
        if (cancelled) return;
        if ('error' in r) setError(r.error);
        else setPreview(r);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read your account'); });
    return () => { cancelled = true; };
  }, [open]);

  async function apply() {
    if (!preview) return;
    setApplying(true);
    try {
      await applyProfileRefresh(preview.next);
      setDone(true);
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the page');
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-4" />
            Refresh from Relational Builder
          </DialogTitle>
          <DialogDescription>
            Re-reads your profile, projects, live sites, and commons activity.
            Anything you wrote on the page yourself stays as it is.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && !preview && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" /> Comparing…
          </p>
        )}

        {preview && preview.changes.length === 0 && !done && (
          <p className="text-sm text-muted-foreground">Nothing has changed since the page was last seeded.</p>
        )}

        {preview && preview.changes.length > 0 && !done && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {preview.changes.length} change{preview.changes.length === 1 ? '' : 's'} in <code>/data/profile.json</code>:
            </p>
            <ul className="divide-y rounded-md border text-xs">
              {preview.changes.map((c, i) => (
                <li key={i} className="p-2 space-y-0.5">
                  <p className="font-medium">{c.field}</p>
                  <p className="text-muted-foreground line-through break-words">{c.before}</p>
                  <p className="break-words">{c.after}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {done && (
          <p className="text-sm flex items-center gap-1.5">
            <Check className="size-4 text-green-700" />
            Updated. Publish again when you want the live page to follow.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {done || (preview && preview.changes.length === 0) ? 'Close' : 'Cancel'}
          </Button>
          {preview && preview.changes.length > 0 && !done && (
            <Button size="sm" disabled={applying} onClick={apply}>
              {applying ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              Apply to my page
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
