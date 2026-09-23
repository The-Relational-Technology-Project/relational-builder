import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '@/store/safe-storage';
import type { DirectoryBuilder } from '@/knowledge/connections';

/**
 * The cross-project desk — the part of the Notepad that is yours, not the
 * project's. Today it holds matchmaking offers the person chose to keep:
 * an introduction suggested in one project's chat, saved so it stays open
 * and actionable after the pop-up is gone and after they've moved on to
 * another project (the "thinking period" at an event, or a week later).
 *
 * Unlike the project Notepad, this store is never swapped per project and
 * never travels with a project row: it lives with the person, on this
 * device, in localStorage.
 */

export interface DeskIntro {
  id: string;
  /** The builder as they were when saved — the directory can change, the
   *  card the person kept should not */
  builder: DirectoryBuilder;
  /** One sentence: why RB raised this person */
  reason: string;
  /** Where the offer came from — kept with the card so it still makes
   *  sense on the desk, away from that conversation */
  context: {
    projectName: string | null;
    /** Same-event peer at save time — "go find them" framing */
    sameEvent: boolean;
  };
  /** Epoch ms — when it landed on the desk */
  savedAt: number;
  /** An intro request has gone out from this card */
  requestedAt?: number;
}

interface DeskState {
  intros: DeskIntro[];
  /** Keep an offer; returns its id. Re-saving the same builder refreshes
   *  the reason and context in place instead of doubling the card. */
  saveIntro: (intro: Omit<DeskIntro, 'id' | 'savedAt'>) => string;
  markRequested: (id: string) => void;
  removeIntro: (id: string) => void;
}

export const useDeskStore = create<DeskState>()(persist((set, get) => ({
  intros: [],

  saveIntro: (intro) => {
    const existing = get().intros.find(i => i.builder.id === intro.builder.id);
    if (existing) {
      set(s => ({
        intros: s.intros.map(i => (i.id === existing.id ? { ...i, ...intro, savedAt: Date.now() } : i)),
      }));
      return existing.id;
    }
    const id = crypto.randomUUID();
    set(s => ({ intros: [{ ...intro, id, savedAt: Date.now() }, ...s.intros] }));
    return id;
  },

  markRequested: (id) =>
    set(s => ({ intros: s.intros.map(i => (i.id === id ? { ...i, requestedAt: Date.now() } : i)) })),

  removeIntro: (id) => set(s => ({ intros: s.intros.filter(i => i.id !== id) })),
}), {
  name: 'rb-desk',
  storage: createJSONStorage(() => safeLocalStorage),
}));
