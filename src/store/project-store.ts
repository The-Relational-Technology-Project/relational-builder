import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VirtualFS, type FileEntry, type TreeNode } from '@/project/virtual-fs';
import { extractOperations, applyEdits, type ExtractedFile } from '@/project/code-extractor';
import { invalidLucideImports, suggestLucideIcons } from '@/preview/lucide-icons';

/** A restorable snapshot of the file system, taken after an AI change */
export interface Checkpoint {
  id: string;
  /** Chat message that produced this version (null for the pre-AI baseline) */
  msgId: string | null;
  label: string;
  timestamp: number;
  files: FileEntry[];
}

/** Keep the last N snapshots — enough to walk back a bad stretch of changes */
const MAX_CHECKPOINTS = 10;

/** Provenance of this project — flows into the .reltech.yml manifest on export */
export interface ProjectLineage {
  /** Where the starting point came from */
  source: 'rtp-studio-plan' | 'remix' | 'prompt' | null;
  /** Title of the imported build plan, if any */
  planTitle?: string;
  /** URL of the build plan or remixed project, if known */
  sourceUrl?: string;
  /** ISO timestamp of import */
  importedAt?: string;
  /** Studio frame the project was built within, if any */
  studioSlug?: string;
  studioLabel?: string;
  /** When grown from a shared build prompt */
  promptSlug?: string;
  promptTitle?: string;
  /** When remixed from a studio library item — powers the studio remix loop */
  studioItemId?: string;
  /** Domain frames whose principles ride with this project (see knowledge/frames.ts) */
  frames?: string[];
}

interface ProjectState {
  /** The virtual file system instance */
  fs: VirtualFS;
  /** Currently selected file path */
  selectedFile: string | null;
  /** Trigger for re-renders when FS changes (incremented on mutation) */
  version: number;
  /** Provenance — set when a Studio build plan is imported or a commons project remixed */
  lineage: ProjectLineage | null;
  /** Restorable versions, newest last */
  checkpoints: Checkpoint[];
  /** Which checkpoint the working files currently correspond to */
  activeCheckpointId: string | null;

  // Actions
  selectFile: (path: string | null) => void;
  writeFile: (path: string, content: string, language?: string) => void;
  deleteFile: (path: string) => void;
  setLineage: (lineage: ProjectLineage | null) => void;
  /** Replace the whole file system (cloud project load / remote sync) */
  hydrateFiles: (entries: FileEntry[], lineage: ProjectLineage | null) => void;
  clearProject: () => void;

  /** Snapshot the current files as a restorable checkpoint (e.g. before a GitHub pull) */
  takeCheckpoint: (label: string) => void;
  /** Extract files from a completed AI message and write them to the FS */
  applyMessageFiles: (markdown: string, msgId?: string) => ExtractedFile[];
  /** Human-readable warnings from the last applyMessageFiles (e.g. edits that didn't match) */
  lastApplyWarnings: string[];
  /** Restore the file system to a checkpoint */
  restoreCheckpoint: (checkpointId: string) => void;

  // Derived (computed on each call, driven by `version`)
  getTree: () => TreeNode;
  getFile: (path: string) => FileEntry | undefined;
  getAllFiles: () => FileEntry[];
  /** Oldest-first — for the prompt snapshot, which caches on byte prefix */
  getFilesInWriteOrder: () => FileEntry[];
  getFileCount: () => number;
}

export const useProjectStore = create<ProjectState>()(persist((set, get) => ({
  fs: new VirtualFS(),
  selectedFile: null,
  version: 0,
  lineage: null,
  checkpoints: [],
  activeCheckpointId: null,
  lastApplyWarnings: [],

  selectFile: (path) => set({ selectedFile: path }),

  setLineage: (lineage) => set({ lineage }),

  hydrateFiles: (entries, lineage) => {
    const fs = VirtualFS.fromJSON(entries);
    const paths = fs.getPaths();
    const selected = get().selectedFile;
    set(s => ({
      fs,
      version: s.version + 1,
      lineage,
      selectedFile: selected && paths.includes(selected) ? selected : (paths[0] ?? null),
    }));
  },

  writeFile: (path, content, language) => {
    get().fs.writeFile(path, content, language);
    set(s => ({ version: s.version + 1 }));
  },

  deleteFile: (path) => {
    const { fs, selectedFile } = get();
    fs.deleteFile(path);
    set(s => ({
      version: s.version + 1,
      selectedFile: selectedFile === path ? null : selectedFile,
    }));
  },

  clearProject: () => {
    get().fs.clear();
    set({ version: 0, selectedFile: null, fs: new VirtualFS(), lineage: null, checkpoints: [], activeCheckpointId: null });
    // A model choice is pinned per project — a fresh project gets fresh defaults
    import('@/store/provider-store').then(m => m.useProviderStore.getState().clearModelPin());
    // The build log tells one project's story — a fresh project starts blank
    import('@/report/build-log').then(m => m.useBuildLogStore.getState().reset());
    // So does the notepad — its notes and story belong to the project they were written in
    import('@/store/notepad-store').then(m => m.useNotepadStore.getState().clearNotepad());
  },

  takeCheckpoint: (label) => {
    const { fs, checkpoints } = get();
    if (fs.getPaths().length === 0) return;
    const checkpoint: Checkpoint = {
      id: `ckpt-${Date.now()}-manual`,
      msgId: null,
      label,
      timestamp: Date.now(),
      files: fs.toJSON(),
    };
    set({ checkpoints: [...checkpoints, checkpoint].slice(-MAX_CHECKPOINTS) });
  },

  applyMessageFiles: (markdown, msgId) => {
    const { writes, edits, truncatedPath } = extractOperations(markdown);
    const { fs, checkpoints } = get();
    const warnings: string[] = [];
    if (truncatedPath) {
      warnings.push(
        `${truncatedPath} was cut off mid-stream and wasn't applied — an incomplete file would break the preview.`,
      );
    }

    // Resolve targeted edits against current file contents
    const editResults: ExtractedFile[] = [];
    for (const edit of edits) {
      const existing = fs.getFile(edit.path);
      if (!existing) {
        warnings.push(`Edit to ${edit.path} skipped — that file doesn't exist.`);
        continue;
      }
      const { content, failed } = applyEdits(existing.content, edit.edits);
      if (failed === edit.edits.length) {
        warnings.push(`Edits to ${edit.path} didn't match the current file — ask the AI to re-output the whole file.`);
        continue;
      }
      if (failed > 0) {
        warnings.push(`${failed} of ${edit.edits.length} edits to ${edit.path} didn't match and were skipped.`);
      }
      editResults.push({ path: edit.path, content, language: existing.language });
    }

    const files: ExtractedFile[] = [...writes, ...editResults];

    // Hallucinated lucide icons die at module link time with a blob-URL
    // stack; the import list is checkable right now, with a "did you mean"
    for (const file of files) {
      if (!/lucide-react/.test(file.content)) continue;
      for (const name of invalidLucideImports(file.content)) {
        const close = suggestLucideIcons(name);
        warnings.push(
          `${file.path} imports \`${name}\`, which doesn't exist in lucide-react${
            close.length ? ` — closest real icons: ${close.join(', ')}` : ''
          }.`,
        );
      }
    }

    if (files.length === 0) {
      set({ lastApplyWarnings: warnings });
      return files;
    }

    const nextCheckpoints = [...checkpoints];

    // First AI change to a workspace that already has files (imported, pulled
    // from GitHub, opened from the cloud): keep a pre-AI baseline to return to.
    if (nextCheckpoints.length === 0 && fs.getPaths().length > 0) {
      nextCheckpoints.push({
        id: `ckpt-${Date.now()}-base`,
        msgId: null,
        label: 'Before AI changes',
        timestamp: Date.now(),
        files: fs.toJSON(),
      });
    }

    for (const file of files) {
      fs.writeFile(file.path, file.content, file.language);
    }

    const newCheckpointId = `ckpt-${Date.now()}`;
    nextCheckpoints.push({
      id: newCheckpointId,
      msgId: msgId ?? null,
      label: `Version ${nextCheckpoints.filter(c => c.msgId !== null).length + 1}`,
      timestamp: Date.now(),
      files: fs.toJSON(),
    });

    set(s => ({
      version: s.version + 1,
      checkpoints: nextCheckpoints.slice(-MAX_CHECKPOINTS),
      activeCheckpointId: newCheckpointId,
      lastApplyWarnings: warnings,
    }));
    // Auto-select the first file if nothing is selected
    if (!get().selectedFile) {
      set({ selectedFile: files[0].path });
    }
    return files;
  },

  restoreCheckpoint: (checkpointId) => {
    const { checkpoints, lineage, selectedFile } = get();
    const checkpoint = checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) return;
    const fs = VirtualFS.fromJSON(checkpoint.files);
    const paths = fs.getPaths();
    set(s => ({
      fs,
      version: s.version + 1,
      lineage,
      activeCheckpointId: checkpoint.id,
      selectedFile: selectedFile && paths.includes(selectedFile) ? selectedFile : (paths[0] ?? null),
    }));
  },

  getTree: () => get().fs.getTree(),
  getFile: (path) => get().fs.getFile(path),
  getAllFiles: () => get().fs.getAllFiles(),

  getFilesInWriteOrder: () => get().fs.getFilesInWriteOrder(),
  getFileCount: () => get().fs.getPaths().length,
}), {
  name: 'relational-builder-project',
  storage: {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Rehydrate VirtualFS from serialized file entries
      if (parsed?.state?.fs) {
        parsed.state.fs = VirtualFS.fromJSON(parsed.state.fs);
      }
      return parsed;
    },
    setItem: (name, value) => {
      // Serialize VirtualFS to plain array before storing
      const serializable = {
        ...value,
        state: {
          ...value.state,
          fs: value.state.fs.toJSON(),
        },
      };
      localStorage.setItem(name, JSON.stringify(serializable));
    },
    removeItem: (name) => localStorage.removeItem(name),
  },
  partialize: (state) => ({
    fs: state.fs,
    selectedFile: state.selectedFile,
    version: state.version,
    lineage: state.lineage,
    checkpoints: state.checkpoints,
    activeCheckpointId: state.activeCheckpointId,
  } as unknown as ProjectState),
}));
