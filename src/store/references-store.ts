import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '@/store/safe-storage';

/**
 * Reference documents — what the builder hands the AI to read, not to ship.
 * A grant proposal, meeting notes, a plan exported from another tool, the
 * neighborhood association's bylaws. The text is extracted in the browser
 * when the file is added (see project/references) and rides in the
 * cacheable half of the prompt for plan and build context.
 *
 * Deliberately NOT project files: nothing here reaches the preview, a
 * published site, a zip export, or a commons contribution. Documents
 * routinely name neighbors and carry details that belong to the project's
 * work, not its public artifact.
 *
 * Like the notepad, one global store swapped per project: shelf snapshots
 * and cloud project rows carry it, and a fresh project starts blank.
 */

export type ReferenceKind = 'pdf' | 'docx' | 'md' | 'txt';

export interface ReferenceDoc {
  id: string;
  /** The original filename, as the builder knows it */
  name: string;
  kind: ReferenceKind;
  /** Extracted plain text (capped — `truncated` says whether it was cut) */
  text: string;
  truncated: boolean;
  /** Size of the original file */
  bytes: number;
  /** PDF page count, when known */
  pages?: number;
  /** Epoch ms */
  addedAt: number;
  /** Who added it — display name (or email) at the time, when signed in */
  addedBy?: string;
}

interface ReferencesState {
  docs: ReferenceDoc[];
  addDoc: (doc: Omit<ReferenceDoc, 'id' | 'addedAt'>) => ReferenceDoc;
  removeDoc: (id: string) => void;
  /** Replace wholesale (cloud project load / shelf restore) */
  hydrateReferences: (docs: ReferenceDoc[]) => void;
  /** A fresh project starts with no references */
  clearReferences: () => void;
}

export const useReferencesStore = create<ReferencesState>()(persist((set) => ({
  docs: [],

  addDoc: (doc) => {
    const full: ReferenceDoc = { ...doc, id: crypto.randomUUID(), addedAt: Date.now() };
    set(s => ({ docs: [...s.docs, full] }));
    return full;
  },

  removeDoc: (id) => set(s => ({ docs: s.docs.filter(d => d.id !== id) })),

  hydrateReferences: (docs) => set({ docs: Array.isArray(docs) ? docs : [] }),

  clearReferences: () => set({ docs: [] }),
}), {
  name: 'rb-reference-docs',
  // Extracted text can run to hundreds of KB — a full quota must not break
  // adding a document (it stays in memory and in the cloud row)
  storage: createJSONStorage(() => safeLocalStorage),
  partialize: (state) => ({ docs: state.docs } as unknown as ReferencesState),
}));

/** The shape references travel in — shelf snapshots and the cloud row */
export type ReferencesSnapshot = ReferenceDoc[];

export function captureReferences(): ReferencesSnapshot {
  return useReferencesStore.getState().docs;
}

/** The virtual path a document is addressed by in the prompt and in
 *  NEED-FILES lines — never a real project file, but the model already
 *  knows how to ask for things by path. Names are slugged so two documents
 *  with the same filename get distinct addresses. */
export function referencePath(doc: ReferenceDoc): string {
  const stem = doc.name.replace(/\.[^.]+$/, '');
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'document';
  return `/references/${slug}-${doc.id.slice(0, 6)}.${doc.kind}`;
}

export function findReferenceByPath(docs: ReferenceDoc[], path: string): ReferenceDoc | undefined {
  const wanted = path.startsWith('/') ? path : `/${path}`;
  return docs.find(d => referencePath(d) === wanted);
}
