import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VirtualFS, type FileEntry, type TreeNode } from '@/project/virtual-fs';
import { extractFiles, type ExtractedFile } from '@/project/code-extractor';

/** Provenance of this project — flows into the .reltech.yml manifest on export */
export interface ProjectLineage {
  /** Where the starting point came from */
  source: 'rtp-studio-plan' | 'remix' | null;
  /** Title of the imported build plan, if any */
  planTitle?: string;
  /** URL of the build plan or remixed project, if known */
  sourceUrl?: string;
  /** ISO timestamp of import */
  importedAt?: string;
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

  // Actions
  selectFile: (path: string | null) => void;
  writeFile: (path: string, content: string, language?: string) => void;
  deleteFile: (path: string) => void;
  setLineage: (lineage: ProjectLineage | null) => void;
  /** Replace the whole file system (cloud project load / remote sync) */
  hydrateFiles: (entries: FileEntry[], lineage: ProjectLineage | null) => void;
  clearProject: () => void;

  /** Extract files from a completed AI message and write them to the FS */
  applyMessageFiles: (markdown: string) => ExtractedFile[];

  // Derived (computed on each call, driven by `version`)
  getTree: () => TreeNode;
  getFile: (path: string) => FileEntry | undefined;
  getAllFiles: () => FileEntry[];
  getFileCount: () => number;
}

export const useProjectStore = create<ProjectState>()(persist((set, get) => ({
  fs: new VirtualFS(),
  selectedFile: null,
  version: 0,
  lineage: null,

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
    set({ version: 0, selectedFile: null, fs: new VirtualFS(), lineage: null });
  },

  applyMessageFiles: (markdown) => {
    const files = extractFiles(markdown);
    const { fs } = get();
    for (const file of files) {
      fs.writeFile(file.path, file.content, file.language);
    }
    if (files.length > 0) {
      set(s => ({ version: s.version + 1 }));
      // Auto-select the first file if nothing is selected
      if (!get().selectedFile && files.length > 0) {
        set({ selectedFile: files[0].path });
      }
    }
    return files;
  },

  getTree: () => get().fs.getTree(),
  getFile: (path) => get().fs.getFile(path),
  getAllFiles: () => get().fs.getAllFiles(),
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
  } as unknown as ProjectState),
}));
