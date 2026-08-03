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

  /** A person's click on a tab */
  setRightTab: (tab: RightTab) => void;
  /** An app-driven flip — remembers it owes the pane back */
  autoFlip: (tab: RightTab) => void;
  /** Undo an app-driven flip; a no-op once the person has clicked a tab */
  autoRestore: (tab: RightTab) => void;
}

export const usePanelStore = create<PanelState>((set, get) => ({
  rightTab: 'preview',
  autoFlipped: false,

  setRightTab: (tab) => set({ rightTab: tab, autoFlipped: false }),
  autoFlip: (tab) => set({ rightTab: tab, autoFlipped: true }),
  autoRestore: (tab) => {
    if (get().autoFlipped) set({ rightTab: tab, autoFlipped: false });
  },
}));
