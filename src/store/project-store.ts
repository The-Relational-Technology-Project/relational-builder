import { create } from 'zustand';
import { VirtualFS, type FileEntry, type TreeNode } from '@/project/virtual-fs';
import { extractFiles, type ExtractedFile } from '@/project/code-extractor';

interface ProjectState {
  /** The virtual file system instance */
  fs: VirtualFS;
  /** Currently selected file path */
  selectedFile: string | null;
  /** Trigger for re-renders when FS changes (incremented on mutation) */
  version: number;

  // Actions
  selectFile: (path: string | null) => void;
  writeFile: (path: string, content: string, language?: string) => void;
  deleteFile: (path: string) => void;
  clearProject: () => void;

  /** Extract files from a completed AI message and write them to the FS */
  applyMessageFiles: (markdown: string) => ExtractedFile[];

  // Derived (computed on each call, driven by `version`)
  getTree: () => TreeNode;
  getFile: (path: string) => FileEntry | undefined;
  getAllFiles: () => FileEntry[];
  getFileCount: () => number;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  fs: new VirtualFS(),
  selectedFile: null,
  version: 0,

  selectFile: (path) => set({ selectedFile: path }),

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
    set({ version: 0, selectedFile: null, fs: new VirtualFS() });
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
}));
