import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ForgeId, RemoteCommit, RemoteFileChange } from '@/project/forge/types';

export interface ConnectedRepo {
  forge: ForgeId;
  /** Instance base URL for self-hosted forges; unset for the hosted default */
  baseUrl?: string;
  fullName: string;
  /** The branch sync reads and writes. In safe-copy mode this is the safe
   *  copy, and `liveBranch` names the branch the live site follows. */
  branch: string;
  htmlUrl: string;
  lastSyncSha: string | null;
  /**
   * Safe-copy mode (imported live apps): the branch the live site deploys
   * from. Present = everything syncs to `branch`, and only "Publish to your
   * live site" merges it here.
   */
  liveBranch?: string;
  /** Last live-branch commit we've folded in or published — the fold check's
   *  "anything new over there?" baseline */
  lastLiveSha?: string | null;
}

/** What's sitting on the repo that the Builder hasn't seen yet */
export interface RemoteChanges {
  headSha: string;
  aheadBy: number;
  commits: RemoteCommit[];
  files: RemoteFileChange[];
  /** True when we couldn't diff — never synced, or history was rewritten */
  fullResync: boolean;
}

/** How a push ended, for the sync panel to narrate */
export type PushStatus = 'idle' | 'pushing' | 'pushed' | 'held' | 'error';

interface SyncState {
  /** One saved token per forge (Forgejo's belongs to its instanceUrl) */
  tokens: Partial<Record<ForgeId, string>>;
  usernames: Partial<Record<ForgeId, string>>;
  /** Instance URLs for self-hosted forges, remembered per forge */
  instanceUrls: Partial<Record<ForgeId, string>>;
  /** Repo connection per project — keyed by cloud project id, or 'local' */
  repos: Record<string, ConnectedRepo>;
  /**
   * Whether a project's changes push themselves. Absent means on: connecting
   * a repo is the decision, and everything after it is the tool's job.
   */
  autoPush: Record<string, boolean>;
  /** Fingerprint of the files at the last successful push, per project */
  pushedFingerprint: Record<string, string>;
  /** When the last successful push landed, per project */
  lastPushedAt: Record<string, number>;
  /** Safe-copy mode: pushes landed on the safe copy since the last publish */
  unpublished: Record<string, boolean>;

  // Transient remote awareness (never persisted)
  remote: RemoteChanges | null;
  checkingRemote: boolean;
  lastCheckedAt: number;
  /** Head SHA the person chose "Later" on — don't re-show that banner */
  dismissedHead: string | null;
  /** True while a pull is applying files (suppresses cloud auto-save echo churn) */
  pulling: boolean;
  /**
   * True from the moment an automatic pull is judged safe until it's done —
   * so the "new commits" banner never flashes for changes already on their
   * way in.
   */
  autoPulling: boolean;
  /** Why the last automatic pull didn't land, if it didn't */
  pullError: string | null;
  /** Where the current (or last) push got to */
  pushStatus: PushStatus;
  pushError: string | null;
  /**
   * Safe-copy mode: the live branch has changes that COLLIDE with the safe
   * copy — a person has to choose. Pauses folding until resolved.
   */
  liveConflict: boolean;

  setToken: (forge: ForgeId, token: string) => void;
  setUsername: (forge: ForgeId, username: string) => void;
  setInstanceUrl: (forge: ForgeId, url: string) => void;
  /** Forget one forge's token and its projects' repo connections */
  signOut: (forge: ForgeId) => void;
  connectRepo: (key: string, repo: ConnectedRepo) => void;
  disconnectRepo: (key: string) => void;
  updateLastSync: (key: string, sha: string) => void;
  setAutoPush: (key: string, on: boolean) => void;
  /** Remember what a successful push sent, so an unchanged project stays quiet */
  recordPush: (key: string, sha: string, fingerprint: string) => void;
  setPushStatus: (status: PushStatus, error?: string | null) => void;
  /** Safe-copy mode: record the live-branch commit last folded/published */
  updateLastLive: (key: string, sha: string) => void;
  setUnpublished: (key: string, on: boolean) => void;
  setLiveConflict: (on: boolean) => void;
  /** Move a repo connection when a local project becomes a cloud project */
  moveRepo: (fromKey: string, toKey: string) => void;
  setRemote: (remote: RemoteChanges | null) => void;
  setCheckingRemote: (checking: boolean) => void;
  dismissRemote: (headSha: string) => void;
  setPulling: (pulling: boolean) => void;
  setAutoPulling: (autoPulling: boolean) => void;
  setPullError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      tokens: {},
      usernames: {},
      instanceUrls: {},
      repos: {},
      autoPush: {},
      pushedFingerprint: {},
      lastPushedAt: {},
      unpublished: {},

      remote: null,
      checkingRemote: false,
      lastCheckedAt: 0,
      dismissedHead: null,
      pulling: false,
      autoPulling: false,
      pullError: null,
      pushStatus: 'idle',
      pushError: null,
      liveConflict: false,

      setToken: (forge, token) =>
        set((s) => ({ tokens: { ...s.tokens, [forge]: token } })),
      setUsername: (forge, username) =>
        set((s) => ({ usernames: { ...s.usernames, [forge]: username } })),
      setInstanceUrl: (forge, url) =>
        set((s) => ({ instanceUrls: { ...s.instanceUrls, [forge]: url } })),

      signOut: (forge) =>
        set((s) => {
          const tokens = { ...s.tokens };
          const usernames = { ...s.usernames };
          delete tokens[forge];
          delete usernames[forge];
          const repos = Object.fromEntries(
            Object.entries(s.repos).filter(([, r]) => r.forge !== forge),
          );
          return { tokens, usernames, repos, remote: null, dismissedHead: null };
        }),

      connectRepo: (key, repo) =>
        set((s) => ({ repos: { ...s.repos, [key]: repo }, remote: null, dismissedHead: null })),

      disconnectRepo: (key) =>
        set((s) => {
          const repos = { ...s.repos };
          const pushedFingerprint = { ...s.pushedFingerprint };
          delete repos[key];
          delete pushedFingerprint[key];
          return {
            repos,
            pushedFingerprint,
            remote: null,
            dismissedHead: null,
            pushStatus: 'idle' as PushStatus,
            pushError: null,
          };
        }),

      updateLastSync: (key, sha) =>
        set((s) =>
          s.repos[key]
            ? { repos: { ...s.repos, [key]: { ...s.repos[key], lastSyncSha: sha } } }
            : s,
        ),

      setAutoPush: (key, on) =>
        set((s) => ({ autoPush: { ...s.autoPush, [key]: on } })),

      recordPush: (key, sha, fingerprint) =>
        set((s) => ({
          repos: s.repos[key]
            ? { ...s.repos, [key]: { ...s.repos[key], lastSyncSha: sha } }
            : s.repos,
          pushedFingerprint: { ...s.pushedFingerprint, [key]: fingerprint },
          lastPushedAt: { ...s.lastPushedAt, [key]: Date.now() },
        })),

      setPushStatus: (pushStatus, pushError = null) => set({ pushStatus, pushError }),

      updateLastLive: (key, sha) =>
        set((s) =>
          s.repos[key]
            ? { repos: { ...s.repos, [key]: { ...s.repos[key], lastLiveSha: sha } } }
            : s,
        ),
      setUnpublished: (key, on) =>
        set((s) => ({ unpublished: { ...s.unpublished, [key]: on } })),
      setLiveConflict: (liveConflict) => set({ liveConflict }),

      moveRepo: (fromKey, toKey) =>
        set((s) => {
          const repo = s.repos[fromKey];
          if (!repo || fromKey === toKey) return s;
          const repos = { ...s.repos, [toKey]: repo };
          delete repos[fromKey];
          // The connection's settings and push history travel with it —
          // otherwise saving a project to the account silently re-enables
          // auto-push and re-pushes an unchanged tree
          const autoPush = { ...s.autoPush };
          const pushedFingerprint = { ...s.pushedFingerprint };
          const lastPushedAt = { ...s.lastPushedAt };
          const unpublished = { ...s.unpublished };
          if (fromKey in autoPush) {
            autoPush[toKey] = autoPush[fromKey];
            delete autoPush[fromKey];
          }
          if (fromKey in pushedFingerprint) {
            pushedFingerprint[toKey] = pushedFingerprint[fromKey];
            delete pushedFingerprint[fromKey];
          }
          if (fromKey in lastPushedAt) {
            lastPushedAt[toKey] = lastPushedAt[fromKey];
            delete lastPushedAt[fromKey];
          }
          if (fromKey in unpublished) {
            unpublished[toKey] = unpublished[fromKey];
            delete unpublished[fromKey];
          }
          return { repos, autoPush, pushedFingerprint, lastPushedAt, unpublished };
        }),

      setRemote: (remote) => set({ remote, lastCheckedAt: Date.now() }),
      setCheckingRemote: (checkingRemote) => set({ checkingRemote }),
      dismissRemote: (headSha) => set({ dismissedHead: headSha }),
      setPulling: (pulling) => set({ pulling }),
      setAutoPulling: (autoPulling) => set({ autoPulling }),
      setPullError: (pullError) => set({ pullError }),
    }),
    {
      // Historical key — this store began GitHub-only, and renaming it
      // would orphan everyone's saved tokens and repo connections.
      name: 'relational-builder-github',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 && state?.connectedRepo) {
          // The old single global connection becomes the local project's
          state.repos = { local: state.connectedRepo };
          delete state.connectedRepo;
        }
        if (version <= 1) {
          // GitHub-only era: one token/username, repos without a forge
          state.tokens = state.token ? { github: state.token } : {};
          state.usernames = state.username ? { github: state.username } : {};
          state.instanceUrls = {};
          delete state.token;
          delete state.username;
          const repos = (state.repos ?? {}) as Record<string, ConnectedRepo>;
          for (const key of Object.keys(repos)) {
            repos[key] = { ...repos[key], forge: repos[key].forge ?? 'github' };
          }
        }
        return state as unknown as SyncState;
      },
      partialize: (state) => ({
        tokens: state.tokens,
        usernames: state.usernames,
        instanceUrls: state.instanceUrls,
        repos: state.repos,
        autoPush: state.autoPush,
        pushedFingerprint: state.pushedFingerprint,
        lastPushedAt: state.lastPushedAt,
        unpublished: state.unpublished,
      } as unknown as SyncState),
    },
  ),
);
