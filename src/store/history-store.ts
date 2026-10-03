import { create } from 'zustand';
import { useProjectStore, type Checkpoint } from '@/store/project-store';
import { usePanelStore } from '@/store/panel-store';

/**
 * The project's version history, as a place you can stand.
 *
 * Two things live here, and neither touches the working files:
 *
 * - `open` — the chat pane shows the list of versions instead of the
 *   conversation. One button in the header toggles it, the way Lovable's
 *   History does: click to look, click again to get the chat back.
 * - `previewCheckpointId` — the Preview pane shows THAT version's files
 *   rather than the current ones. Looking is free and reversible; the
 *   working files, the cloud copy, the connected repo all stay exactly as
 *   they are until the person explicitly reverts (project-store's
 *   restoreCheckpoint, which the History panel confirms first).
 *
 * Reverting is the one write, and it goes through the project store — this
 * store only knows what's being looked at.
 */
interface HistoryState {
  open: boolean;
  previewCheckpointId: string | null;
  toggle: () => void;
  close: () => void;
  /** Look at a version in the Preview pane (and turn the pane toward it) */
  preview: (checkpointId: string) => void;
  /** Back to the current files in the Preview pane */
  clearPreview: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  open: false,
  previewCheckpointId: null,
  toggle: () => {
    const next = !get().open;
    // Closing history is also leaving the version you were looking at —
    // a preview of an old version with no list beside it to explain it
    // would read as the project having silently changed
    set({ open: next, previewCheckpointId: next ? get().previewCheckpointId : null });
  },
  close: () => set({ open: false, previewCheckpointId: null }),
  preview: (checkpointId) => {
    set({ previewCheckpointId: checkpointId });
    usePanelStore.getState().setRightTab('preview');
  },
  clearPreview: () => set({ previewCheckpointId: null }),
}));

/** The checkpoint being looked at, or null when the Preview shows the
 *  current files (nothing selected, or the selection was trimmed away). */
export function usePreviewedCheckpoint(): Checkpoint | null {
  const id = useHistoryStore(s => s.previewCheckpointId);
  const checkpoints = useProjectStore(s => s.checkpoints);
  if (!id) return null;
  return checkpoints.find(c => c.id === id) ?? null;
}

/** Which checkpoint the working files correspond to right now — with the
 *  same stale-id fallback the store's undo uses (a trimmed or reloaded id
 *  must not make every version look like "not current"). */
export function currentCheckpointId(checkpoints: Checkpoint[], activeId: string | null): string | null {
  if (activeId && checkpoints.some(c => c.id === activeId)) return activeId;
  return checkpoints[checkpoints.length - 1]?.id ?? null;
}

/** "Today, 3:47 PM" / "Sep 21, 3:47 PM" */
export function formatVersionTime(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day}, ${time}`;
}
