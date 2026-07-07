import { create } from 'zustand';
import type { FileEntry } from './virtual-fs';
import { useProjectStore, type ProjectLineage } from '@/store/project-store';
import { useChatStore, type ChatMode, type DisplayMessage } from '@/store/chat-store';
import { useEnvStore, type EnvVar } from '@/store/env-store';
import { useCloudStore } from '@/store/cloud-store';
import { suggestProjectName } from './suggest-name';

/**
 * The local project shelf: every project is continuously saved ON THIS
 * DEVICE under a name, signed in or not — so "New Project" stashes the
 * current work instead of destroying it, and nothing a builder makes can
 * be lost by a stray click. Cloud projects remain the opt-in layer on
 * top (they autosave to Supabase already; while one is open, the local
 * autosaver stands down).
 *
 * Storage: one small index + one localStorage entry per project, so a
 * single oversized project can't take the whole shelf down with it.
 */

export interface LocalProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  fileCount: number;
}

interface LocalProjectSnapshot extends LocalProjectMeta {
  files: FileEntry[];
  chat: DisplayMessage[];
  mode: ChatMode;
  lineage: ProjectLineage | null;
  envVars: EnvVar[];
}

const INDEX_KEY = 'rb-local-projects-index';
const CURRENT_KEY = 'rb-local-project-current';
const projectKey = (id: string) => `rb-local-project:${id}`;

/** Reactive save state for the header indicator. */
interface LocalProjectsState {
  currentId: string | null;
  currentName: string;
  savedAt: number | null;
  shelf: LocalProjectMeta[];
}

export const useLocalProjects = create<LocalProjectsState>(() => ({
  currentId: localStorage.getItem(CURRENT_KEY),
  currentName: '',
  savedAt: null,
  shelf: readIndex(),
}));

function readIndex(): LocalProjectMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as LocalProjectMeta[]) : [];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeIndex(list: LocalProjectMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  useLocalProjects.setState({ shelf: [...list].sort((a, b) => b.updatedAt - a.updatedAt) });
}

function setCurrent(id: string | null, name = '') {
  if (id) localStorage.setItem(CURRENT_KEY, id);
  else localStorage.removeItem(CURRENT_KEY);
  useLocalProjects.setState({ currentId: id, currentName: name });
}

function readSnapshot(id: string): LocalProjectSnapshot | null {
  try {
    const raw = localStorage.getItem(projectKey(id));
    return raw ? (JSON.parse(raw) as LocalProjectSnapshot) : null;
  } catch {
    return null;
  }
}

/** A name for the current work: what the builder called it, the app's own
 * title, or a dated fallback — never a blank. */
function deriveName(files: FileEntry[]): string {
  const suggested = suggestProjectName();
  if (suggested) return suggested;
  const html = files.find(f => /(^|\/)index\.html$/.test(f.path))?.content ?? '';
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (title) return title.slice(0, 60);
  return `Untitled — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/**
 * Save the current workspace to its shelf slot. No-ops while a cloud
 * project is open (cloud autosync owns it) or when there's nothing yet.
 */
export function saveCurrentLocally(): void {
  if (useCloudStore.getState().currentProjectId) return;

  const project = useProjectStore.getState();
  const chat = useChatStore.getState();
  const files = project.fs.toJSON();
  if (files.length === 0 && chat.messages.length === 0) return;

  let id = useLocalProjects.getState().currentId;
  if (!id) {
    id = crypto.randomUUID();
  }
  const existing = readSnapshot(id);
  const name = existing?.name ?? deriveName(files);

  const snapshot: LocalProjectSnapshot = {
    id,
    name,
    updatedAt: Date.now(),
    fileCount: files.length,
    files,
    // Chat travels with the project (capped — the code is the artifact,
    // the far history isn't worth a quota failure)
    chat: chat.messages.slice(-200).map(m => ({ ...m, isStreaming: false })),
    mode: chat.mode,
    lineage: project.lineage,
    envVars: useEnvStore.getState().vars,
  };

  try {
    localStorage.setItem(projectKey(id), JSON.stringify(snapshot));
  } catch (err) {
    // Quota — drop the oldest OTHER project and retry once
    console.warn('Local save hit storage quota', err);
    const oldest = readIndex().filter(m => m.id !== id).pop();
    if (!oldest) return;
    localStorage.removeItem(projectKey(oldest.id));
    writeIndex(readIndex().filter(m => m.id !== oldest.id));
    try {
      localStorage.setItem(projectKey(id), JSON.stringify(snapshot));
    } catch {
      return;
    }
  }

  const meta: LocalProjectMeta = { id, name, updatedAt: snapshot.updatedAt, fileCount: files.length };
  writeIndex([meta, ...readIndex().filter(m => m.id !== id)]);
  setCurrent(id, name);
  useLocalProjects.setState({ savedAt: snapshot.updatedAt });
}

/**
 * Stash whatever is open and point the autosaver at a fresh slot —
 * this is what makes "New Project" safe.
 */
export function stashAndStartFresh(): void {
  saveCurrentLocally();
  setCurrent(null);
  useLocalProjects.setState({ savedAt: null });
}

/** Open a shelf project: stash current work first, then restore. */
export function openLocalProject(id: string): boolean {
  const snapshot = readSnapshot(id);
  if (!snapshot) return false;

  saveCurrentLocally();
  useCloudStore.getState().closeProject();

  useProjectStore.getState().hydrateFiles(snapshot.files, snapshot.lineage ?? null);
  useChatStore.getState().hydrateChat(snapshot.chat ?? [], snapshot.mode ?? 'build');
  useEnvStore.setState({ vars: snapshot.envVars ?? [] });
  setCurrent(id, snapshot.name);
  useLocalProjects.setState({ savedAt: snapshot.updatedAt });
  return true;
}

export function deleteLocalProject(id: string): void {
  localStorage.removeItem(projectKey(id));
  writeIndex(readIndex().filter(m => m.id !== id));
  if (useLocalProjects.getState().currentId === id) {
    setCurrent(null);
    useLocalProjects.setState({ savedAt: null });
  }
}

export function renameLocalProject(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const snapshot = readSnapshot(id);
  if (snapshot) {
    snapshot.name = trimmed;
    localStorage.setItem(projectKey(id), JSON.stringify(snapshot));
  }
  writeIndex(readIndex().map(m => (m.id === id ? { ...m, name: trimmed } : m)));
  if (useLocalProjects.getState().currentId === id) {
    useLocalProjects.setState({ currentName: trimmed });
  }
}

/** When a cloud project takes over the workspace, the local slot lets go. */
export function detachLocalTracking(): void {
  setCurrent(null);
  useLocalProjects.setState({ savedAt: null });
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/** Start the debounced local autosaver (idempotent; call once at app boot). */
export function initLocalAutosave(): void {
  if (started) return;
  started = true;

  // Adopt the current slot's name for the header on boot
  const currentId = useLocalProjects.getState().currentId;
  if (currentId) {
    const snap = readSnapshot(currentId);
    if (snap) useLocalProjects.setState({ currentName: snap.name, savedAt: snap.updatedAt });
  }

  const schedule = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveCurrentLocally, 1500);
  };
  useProjectStore.subscribe((state, prev) => {
    if (state.version !== prev.version) schedule();
  });
  useChatStore.subscribe((state, prev) => {
    if (state.messages !== prev.messages && !state.isGenerating) schedule();
  });
}
