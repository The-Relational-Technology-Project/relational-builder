import { useState } from 'react';
import { History, Eye, Undo2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useHistoryStore, currentCheckpointId, formatVersionTime } from '@/store/history-store';
import { findVersion } from '@/project/version-pointer';

/**
 * The version a reply pointed at, as something to click (see
 * src/project/version-pointer.ts). Looking is one button and changes
 * nothing; going back is another, with the confirmation History uses. The
 * model only ever names the version: the revert is the person's click.
 */
export function VersionPointerCard({ versionRef }: { versionRef: string }) {
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeId = useProjectStore(s => s.activeCheckpointId);
  const restoreCheckpoint = useProjectStore(s => s.restoreCheckpoint);
  const isGenerating = useChatStore(s => s.isGenerating);
  const [confirming, setConfirming] = useState(false);
  const [reverted, setReverted] = useState(false);

  const version = findVersion(checkpoints, versionRef);
  const isCurrent = version?.id === currentCheckpointId(checkpoints, activeId);
  const openHistory = () => {
    if (!useHistoryStore.getState().open) useHistoryStore.getState().toggle();
  };

  if (!version) {
    return (
      <div className="mt-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        That version is no longer saved.{' '}
        <button onClick={openHistory} className="underline decoration-dotted hover:text-foreground">
          Open History
        </button>{' '}
        to see the ones that are.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <History className="size-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{version.label}</span>
        <span className="text-xs text-muted-foreground shrink-0">· {formatVersionTime(version.timestamp)}</span>
      </div>
      {isCurrent ? (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          {reverted && <Check className="size-3 text-green-600" />}
          {reverted
            ? 'Reverted. Your chat stays as it was, and the later versions are still in History.'
            : 'This is the version you are on now.'}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              // History opens beside it, so an old version in the Preview
              // always has the list that explains it
              openHistory();
              useHistoryStore.getState().preview(version.id);
            }}
          >
            <Eye className="size-3" />
            Look at it first
          </Button>
          <Button size="sm" className="gap-1.5" disabled={isGenerating} onClick={() => setConfirming(true)}>
            <Undo2 className="size-3" />
            Revert to this version
          </Button>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert to {version.label}?</DialogTitle>
            <DialogDescription>
              Your project files go back to how they were at {formatVersionTime(version.timestamp)}. Your chat
              stays as it is, and the versions after this one stay in History, so you can come forward again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              className="gap-1.5"
              onClick={() => {
                restoreCheckpoint(version.id);
                useHistoryStore.getState().clearPreview();
                setConfirming(false);
                setReverted(true);
              }}
            >
              <Undo2 className="size-3.5" />
              Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
