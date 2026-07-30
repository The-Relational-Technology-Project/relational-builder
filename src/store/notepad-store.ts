import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The project Notepad — a place to jot what the code can't hold: an idea,
 * a neighbor's words, something that happened when the tool met the street.
 * Notes are timestamped and editable just by typing; no save buttons.
 *
 * The notes feed the Project Story: an AI-drafted, builder-edited account
 * of how the project came to be, which can be offered to the RT Commons as
 * a first-class contribution — whether or not the tool itself is shared.
 *
 * Like chat and files, this is one global store swapped per project: local
 * shelf snapshots and cloud project rows carry it, and a fresh project
 * starts blank (see clearProject / local-projects / cloud-store).
 */

export interface ProjectNote {
  id: string;
  /** Plain text, edited in place */
  text: string;
  /** Epoch ms — shown on the note */
  createdAt: number;
  /** Epoch ms of the last edit */
  updatedAt: number;
}

export interface ProjectStory {
  title: string;
  /** Markdown body — AI-drafted, then the builder's to edit */
  body: string;
  /** When the AI last drafted it */
  draftedAt: number;
  /** When the builder last edited it (null = untouched draft) */
  editedAt: number | null;
  /** Model that drafted it — travels as provenance, never as authorship */
  draftedWith?: string;
}

interface NotepadState {
  notes: ProjectNote[];
  story: ProjectStory | null;

  /** Add a note; returns its id so the UI can focus it */
  addNote: (text: string) => string;
  updateNote: (id: string, text: string) => void;
  deleteNote: (id: string) => void;

  setStory: (story: ProjectStory | null) => void;
  updateStoryTitle: (title: string) => void;
  updateStoryBody: (body: string) => void;

  /** Replace wholesale (cloud project load / shelf restore) */
  hydrateNotepad: (notes: ProjectNote[], story: ProjectStory | null) => void;
  /** A fresh project starts with a blank notepad */
  clearNotepad: () => void;
}

export const useNotepadStore = create<NotepadState>()(persist((set) => ({
  notes: [],
  story: null,

  addNote: (text) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    set(s => ({ notes: [{ id, text, createdAt: now, updatedAt: now }, ...s.notes] }));
    return id;
  },

  updateNote: (id, text) =>
    set(s => ({
      notes: s.notes.map(n => (n.id === id ? { ...n, text, updatedAt: Date.now() } : n)),
    })),

  deleteNote: (id) => set(s => ({ notes: s.notes.filter(n => n.id !== id) })),

  setStory: (story) => set({ story }),

  updateStoryTitle: (title) =>
    set(s => (s.story ? { story: { ...s.story, title, editedAt: Date.now() } } : s)),

  updateStoryBody: (body) =>
    set(s => (s.story ? { story: { ...s.story, body, editedAt: Date.now() } } : s)),

  hydrateNotepad: (notes, story) => set({ notes: notes ?? [], story: story ?? null }),

  clearNotepad: () => set({ notes: [], story: null }),
}), {
  name: 'rb-notepad',
  partialize: (state) => ({ notes: state.notes, story: state.story } as unknown as NotepadState),
}));

/** The shape a notepad travels in — shelf snapshots and the cloud row */
export interface NotepadSnapshot {
  notes: ProjectNote[];
  story: ProjectStory | null;
}

export function captureNotepad(): NotepadSnapshot {
  const { notes, story } = useNotepadStore.getState();
  return { notes, story };
}
