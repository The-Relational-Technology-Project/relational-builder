import { create } from 'zustand';

/**
 * Which tab the workspace's right pane is showing. Lifted out of the
 * RightPanel component so the build flow can turn the pane toward the
 * Notepad while a first build cooks — and hand it back to the Preview when
 * the files land (see RightPanel's intro effect).
 *
 * A person's own click always wins: it clears `autoFlipped`, and only an
 * automatic flip is ever automatically undone.
 */
export type RightTab = 'preview' | 'files' | 'cloud' | 'services' | 'notepad' | 'env';

interface PanelState {
  rightTab: RightTab;
  /** True while the pane sits somewhere the app put it, not the person */
  autoFlipped: boolean;
  /** One-shot ask to show a specific artifact in the Preview tab — set by a
   *  click on a chat file card, consumed (and cleared) by PreviewPanel. The
   *  nonce lets a repeat click on the same card re-fire the effect. */
  previewRequest: { path: string; nonce: number } | null;

  /** A person's click on a tab */
  setRightTab: (tab: RightTab) => void;
  /** An app-driven flip — remembers it owes the pane back */
  autoFlip: (tab: RightTab) => void;
  /** Undo an app-driven flip; a no-op once the person has clicked a tab */
  autoRestore: (tab: RightTab) => void;
  /** A person's click on an artifact card: show that file in the Preview.
   *  Counts as their click — it clears autoFlipped like setRightTab. */
  openArtifact: (path: string) => void;
  clearPreviewRequest: () => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  rightTab: 'preview',
  autoFlipped: false,
  previewRequest: null,

  setRightTab: (tab) => set({ rightTab: tab, autoFlipped: false }),
  autoFlip: (tab) => set({ rightTab: tab, autoFlipped: true }),
  autoRestore: (tab) => {
    if (get().autoFlipped) set({ rightTab: tab, autoFlipped: false });
  },
  openArtifact: (path) => set(s => ({
    rightTab: 'preview',
    autoFlipped: false,
    previewRequest: { path, nonce: (s.previewRequest?.nonce ?? 0) + 1 },
  })),
  clearPreviewRequest: () => set({ previewRequest: null }),
}));
