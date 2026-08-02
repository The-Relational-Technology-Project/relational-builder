import { useEffect, useState } from 'react';
import { Undo2, Check, Loader2, CloudOff, Info } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { useCloudStore } from '@/store/cloud-store';
import { useAuthStore } from '@/store/auth-store';
import { useDeployStore } from '@/store/deploy-store';
import { resolveStage } from '@/project/stage';

/**
 * "Where am I, is my work safe, and what happens next" — answered continuously
 * rather than on request.
 *
 * This replaces a deliberate earlier decision (see ProjectStatus: "saving is
 * the quiet baseline, so there's no always-on saved indicator"). That was a
 * reasonable call for someone who assumes autosave; the first non-technical
 * builder to use the tool in anger asked for exactly the opposite — "a clearer
 * visual indication of whether changes are saved automatically and whether
 * there is a way to return to an earlier version." Quiet reads as unknown when
 * you don't already trust the system.
 *
 * A strip, not a tour. The confusion it answers is situational and recurring —
 * it shows up at unpredictable moments, long after any onboarding would have
 * been clicked through and forgotten. So the answer has to be standing in the
 * room, referenceable at the moment of doubt.
 */
export function ProjectStageStrip() {
  const fileCount = useProjectStore(s => s.getFileCount());
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeCheckpointId = useProjectStore(s => s.activeCheckpointId);
  const undoLastChange = useProjectStore(s => s.undoLastChange);

  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  const syncStatus = useCloudStore(s => s.syncStatus);
  const members = useCloudStore(s => s.members);
  const user = useAuthStore(s => s.user);
  const publishNames = useDeployStore(s => s.publishNames);

  const [open, setOpen] = useState(false);
  const [undone, setUndone] = useState<string | null>(null);
  useEffect(() => {
    if (!undone) return;
    const t = setTimeout(() => setUndone(null), 4000);
    return () => clearTimeout(t);
  }, [undone]);

  const publishKey = cloudProjectId ?? 'local';
  const currentIdx = activeCheckpointId
    ? checkpoints.findIndex(c => c.id === activeCheckpointId)
    : checkpoints.length - 1;
  const canUndo = currentIdx > 0;

  const info = resolveStage({
    fileCount,
    signedIn: !!user,
    inCloud: !!cloudProjectId,
    collaborators: Math.max(0, members.length - 1),
    publishedName: publishNames[publishKey] ?? null,
    canUndo,
  });

  // Nothing built yet: the strip would be noise next to an empty canvas, and
  // "nothing to lose" is already obvious when there is visibly nothing.
  if (info.stage === 'sketching') return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60"
          title="Where this project lives and who can see it"
        >
          <span className="font-medium text-foreground">{info.label}</span>
          <span className="hidden sm:inline">· {info.visibility}</span>
          <Info className="size-3 shrink-0" />
        </button>
        {open && (
          <>
            {/* Click-away. A panel you can't dismiss is its own small trap. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-50 mt-1 w-72 space-y-2 rounded-lg border bg-card p-3 text-sm shadow-lg">
              <p className="font-medium">{info.label}</p>
              <p className="text-muted-foreground">{info.visibility}.</p>
              <p className="text-muted-foreground">{info.home}.</p>
              <p className="text-muted-foreground">{info.safety}</p>
              {info.next && (
                <p className="border-t pt-2 text-muted-foreground">
                  <span className="text-foreground">When you're ready: </span>
                  {info.next}.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save state. Only ever says saved when it is — a save indicator that
          can lie is worse than none, because it is trusted at exactly the
          moment it matters. */}
      {cloudProjectId && syncStatus === 'saving' && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Saving…
        </span>
      )}
      {cloudProjectId && syncStatus === 'error' && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <CloudOff className="size-3" /> Not saved
        </span>
      )}
      {cloudProjectId && syncStatus === 'saved' && (
        <span className="hidden md:inline-flex items-center gap-1 text-muted-foreground/70">
          <Check className="size-3" /> Saved
        </span>
      )}

      {undone ? (
        <span className="text-muted-foreground">Put back {undone}</span>
      ) : (
        canUndo && (
          <button
            onClick={() => {
              const label = undoLastChange();
              if (label) setUndone(label);
            }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline decoration-dotted"
            title="Put the files back the way they were before the last change"
          >
            <Undo2 className="size-3" /> Undo last change
          </button>
        )
      )}
    </div>
  );
}
