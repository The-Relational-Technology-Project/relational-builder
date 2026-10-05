import { useEffect, useState } from 'react';
import { History, Eye, Undo2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectStore, type Checkpoint } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useHistoryStore, currentCheckpointId, formatVersionTime } from '@/store/history-store';

/**
 * The project's versions, in the chat pane's place.
 *
 * Every AI change (and every pull from a connected repo) leaves a version
 * here, newest first. Clicking one shows it in the Preview — just looking;
 * nothing changes. Going back to it is a separate, deliberate step with its
 * own confirmation, so a builder can wander through what the project used to
 * be without any risk of ending up somewhere by accident.
 *
 * "Would make me feel more comfortable experimenting" is the whole point:
 * the ceiling on what people try is set by how safe they feel trying it.
 */
export function HistoryPanel() {
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeCheckpointId = useProjectStore(s => s.activeCheckpointId);
  const restoreCheckpoint = useProjectStore(s => s.restoreCheckpoint);
  const isGenerating = useChatStore(s => s.isGenerating);

  const previewId = useHistoryStore(s => s.previewCheckpointId);
  const preview = useHistoryStore(s => s.preview);
  const clearPreview = useHistoryStore(s => s.clearPreview);
  const closeHistory = useHistoryStore(s => s.close);

  const [confirming, setConfirming] = useState<Checkpoint | null>(null);
  const [reverted, setReverted] = useState<string | null>(null);

  const currentId = currentCheckpointId(checkpoints, activeCheckpointId);
  const newestFirst = [...checkpoints].reverse();
  const previewed = previewId ? checkpoints.find(c => c.id === previewId) ?? null : null;

  // A previewed version that got trimmed (or a new project) must not leave
  // the Preview pointing at nothing
  useEffect(() => {
    if (previewId && !previewed) clearPreview();
  }, [previewId, previewed, clearPreview]);

  // Leaving the panel (new project, page change, chat pane unmounting)
  // always puts the Preview back on the current files
  useEffect(() => () => useHistoryStore.getState().clearPreview(), []);

  useEffect(() => {
    if (!reverted) return;
    const t = setTimeout(() => setReverted(null), 6000);
    return () => clearTimeout(t);
  }, [reverted]);

  function revert(checkpoint: Checkpoint) {
    restoreCheckpoint(checkpoint.id);
    setConfirming(null);
    clearPreview();
    setReverted(checkpoint.label);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <History className="size-3.5 text-muted-foreground" />
          History
        </div>
        <button
          onClick={closeHistory}
          className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
        >
          Back to chat
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {newestFirst.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No versions yet</p>
            <p className="text-xs mt-1">
              Each change the AI makes becomes a version here, so you can look back and return to it.
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {newestFirst.map(c => {
              const isCurrent = c.id === currentId;
              const isPreviewed = c.id === previewId;
              return (
                <li key={c.id}>
                  <div
                    className={`group flex items-center gap-2 px-4 py-2 transition-colors ${
                      isPreviewed ? 'bg-accent' : 'hover:bg-muted/60'
                    }`}
                  >
                    <button
                      onClick={() => (isCurrent ? clearPreview() : preview(c.id))}
                      className="flex-1 min-w-0 text-left"
                      title={isCurrent ? 'This is the current version' : 'Show this version in the Preview'}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm">{c.label}</span>
                        {isCurrent && (
                          <span className="shrink-0 rounded-full bg-primary/10 text-primary px-1.5 py-px text-[10px] font-medium">
                            Current
                          </span>
                        )}
                        {isPreviewed && !isCurrent && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Eye className="size-2.5" />
                            Previewing
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatVersionTime(c.timestamp)}</div>
                    </button>
                    {!isCurrent && (
                      <button
                        onClick={() => setConfirming(c)}
                        disabled={isGenerating}
                        title="Put the project files back to this version"
                        className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-opacity disabled:opacity-40 ${
                          isPreviewed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                        } hover:bg-background`}
                      >
                        <Undo2 className="size-3" />
                        Revert
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* The deliberate step. Looking at a version is one click; going back
          to it is a different, clearly labeled one — and then a confirmation. */}
      {reverted ? (
        <div className="px-4 py-3 border-t shrink-0 text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Check className="size-3 text-green-600 shrink-0" />
          <span className="truncate">Reverted to {reverted}. Your chat stays as it was.</span>
        </div>
      ) : previewed && previewed.id !== currentId ? (
        <div className="px-4 py-3 border-t shrink-0 space-y-2 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            The Preview is showing <span className="text-foreground">{previewed.label}</span> from{' '}
            {formatVersionTime(previewed.timestamp)}. Your project hasn't changed.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setConfirming(previewed)} disabled={isGenerating} className="gap-1.5">
              {isGenerating ? <Loader2 className="size-3 animate-spin" /> : <Undo2 className="size-3" />}
              Revert to this version
            </Button>
            <Button size="sm" variant="ghost" onClick={clearPreview}>
              Back to current
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2.5 border-t shrink-0 text-xs text-muted-foreground">
          Click a version to see it in the Preview. Nothing changes until you choose to revert.
        </div>
      )}

      <Dialog open={confirming !== null} onOpenChange={o => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert to {confirming?.label}?</DialogTitle>
            <DialogDescription>
              Your project files go back to how they were at{' '}
              {confirming ? formatVersionTime(confirming.timestamp) : ''}. Your chat stays as it is, and
              the versions after this one stay in History, so you can come forward again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirming && revert(confirming)} className="gap-1.5">
              <Undo2 className="size-3.5" />
              Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
