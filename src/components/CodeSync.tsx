import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSyncStore } from '@/store/sync-store';
import { useProjectStore } from '@/store/project-store';
import { useCloudStore } from '@/store/cloud-store';
import { FORGES, forgeClient, type ForgeId, type ForgeRepo } from '@/project/forge';
import {
  projectRepoKey,
  checkPushSafety,
  pullRemoteChanges,
  clientForRepo,
  tokenForRepo,
  forgeNameForRepo,
} from '@/project/code-sync';
import { generateManifest } from '@/project/export';
import { needsBuild, materializeSource } from '@/project/build-for-publish';
import {
  GitBranch,
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowLeft,
  Plus,
  Check,
  Loader2,
  ExternalLink,
  Unplug,
  AlertTriangle,
} from 'lucide-react';

/** The instance URL a forge connection should use */
function instanceUrlFor(forge: ForgeId): string {
  return useSyncStore.getState().instanceUrls[forge] ?? FORGES[forge].defaultBaseUrl ?? '';
}

export function CodeSync() {
  const [open, setOpen] = useState(false);
  const [forge, setForge] = useState<ForgeId | null>(null);
  const tokens = useSyncStore(s => s.tokens);
  const instanceUrls = useSyncStore(s => s.instanceUrls);
  const repos = useSyncStore(s => s.repos);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const connectedRepo = repos[currentProjectId ?? 'local'] ?? null;

  // A saved token alone means "connected" to that forge — the username is
  // cosmetic and gets backfilled in the repo list. Each project still picks
  // its own repo, but tokens are never asked for again.
  const view = connectedRepo
    ? 'connected'
    : !forge
      ? 'pick'
      : !tokens[forge] || (FORGES[forge].needsInstanceUrl && !instanceUrls[forge])
        ? 'connect'
        : 'repos';

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        setOpen(v);
        if (!v) setForge(null);
      }}
    >
      <DialogTrigger
        className="inline-flex items-center justify-center gap-1 rounded-md px-3 h-7 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <GitBranch className="size-3" />
        {connectedRepo ? connectedRepo.fullName.split('/')[1] : 'Sync'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === 'pick' && 'Sync your code'}
            {view === 'connect' && forge && `Connect to ${FORGES[forge].name}`}
            {view === 'repos' && 'Select repository'}
            {view === 'connected' && 'Sync your code'}
          </DialogTitle>
        </DialogHeader>
        {view === 'pick' && <ForgePickerView onPick={setForge} />}
        {view === 'connect' && forge && (
          <ConnectView forge={forge} onBack={() => setForge(null)} />
        )}
        {view === 'repos' && forge && (
          <RepoListView forge={forge} onBack={() => setForge(null)} />
        )}
        {view === 'connected' && <ConnectedView />}
      </DialogContent>
    </Dialog>
  );
}

// ── Forge Picker ──────────────────────────────────────────────────────

const FORGE_BLURBS: Record<ForgeId, string> = {
  github: 'The most common home for code — easiest if collaborators are already there.',
  gitlab: 'gitlab.com or your own self-managed instance.',
  forgejo: "A community-run instance on your own infrastructure — you set the rules.",
};

function ForgePickerView({ onPick }: { onPick: (forge: ForgeId) => void }) {
  const usernames = useSyncStore(s => s.usernames);
  const tokens = useSyncStore(s => s.tokens);

  return (
    <div className="space-y-3 pt-2">
      <p className="text-sm text-muted-foreground">
        Connect a repo and your project syncs both ways. Edit in Claude Code or any
        editor, push, and the Builder notices — pulling the changes back in and telling
        you if anything (like a migration) needs a hand.
      </p>
      <p className="text-xs font-medium">Where does your code live?</p>
      <div className="space-y-1.5">
        {(Object.keys(FORGES) as ForgeId[]).map(id => (
          <button
            key={id}
            onClick={() => onPick(id)}
            className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{FORGES[id].name}</span>
              {tokens[id] && (
                <span className="text-xs text-muted-foreground">
                  {usernames[id] ? `Connected as ${usernames[id]}` : 'Connected'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{FORGE_BLURBS[id]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Connect View ──────────────────────────────────────────────────────

function ConnectView({ forge, onBack }: { forge: ForgeId; onBack: () => void }) {
  const meta = FORGES[forge];
  const [tokenInput, setTokenInput] = useState('');
  const [urlInput, setUrlInput] = useState(instanceUrlFor(forge));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setToken = useSyncStore(s => s.setToken);
  const setUsername = useSyncStore(s => s.setUsername);
  const setInstanceUrl = useSyncStore(s => s.setInstanceUrl);

  // Self-hosted forges need an instance URL; GitLab accepts a custom one too
  const showUrlInput = meta.needsInstanceUrl || forge === 'gitlab';
  const baseUrl = showUrlInput ? urlInput.trim().replace(/\/$/, '') : '';
  const canConnect = !!tokenInput.trim() && (!meta.needsInstanceUrl || !!baseUrl);

  const handleConnect = async () => {
    if (!canConnect) return;
    setLoading(true);
    setError(null);
    try {
      const client = forgeClient(forge, baseUrl || undefined);
      const login = await client.getUser(tokenInput.trim());
      if (showUrlInput && baseUrl) setInstanceUrl(forge, baseUrl);
      setToken(forge, tokenInput.trim());
      setUsername(forge, login);
    } catch (err) {
      setError(
        err instanceof Error && meta.needsInstanceUrl
          ? `${err.message} — self-hosted instances must also allow browser (CORS) access`
          : 'Invalid token — check that it has repo access',
      );
    } finally {
      setLoading(false);
    }
  };

  const tokenCreateUrl = meta.needsInstanceUrl
    ? baseUrl && meta.tokenUrl(baseUrl)
    : meta.tokenUrl(baseUrl || meta.defaultBaseUrl!);

  return (
    <div className="space-y-4 pt-2">
      {showUrlInput && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Instance URL</label>
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder={forge === 'gitlab' ? 'https://gitlab.com' : 'https://git.example.org'}
            className="h-8 text-sm"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Personal access token</label>
        <Input
          type="password"
          value={tokenInput}
          onChange={e => setTokenInput(e.target.value)}
          placeholder={meta.tokenPlaceholder}
          className="h-8 text-sm font-mono"
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
        />
        <p className="text-xs text-muted-foreground">
          {meta.tokenHelp}{' '}
          {tokenCreateUrl && (
            <a
              href={tokenCreateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Create one
            </a>
          )}
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={handleConnect} disabled={loading || !canConnect} className="w-full gap-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
        Connect
      </Button>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Different service
      </button>
    </div>
  );
}

// ── Repo List View ────────────────────────────────────────────────────

function RepoListView({ forge, onBack }: { forge: ForgeId; onBack: () => void }) {
  const token = useSyncStore(s => s.tokens[forge]) ?? '';
  const username = useSyncStore(s => s.usernames[forge]) ?? null;
  const connectRepo = useSyncStore(s => s.connectRepo);
  const setUsername = useSyncStore(s => s.setUsername);
  const signOut = useSyncStore(s => s.signOut);

  const baseUrl = instanceUrlFor(forge);
  const client = forgeClient(forge, baseUrl || undefined);
  const meta = FORGES[forge];

  const [repos, setRepos] = useState<ForgeRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badToken, setBadToken] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    client
      .listRepos(token)
      .then(setRepos)
      // A saved token that no longer works (expired/revoked) is the one case
      // where we DO need a new token — offer that explicitly.
      .catch(() => { setError('That saved token didn\'t work — it may have expired.'); setBadToken(true); })
      .finally(() => setLoading(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Backfill the display name from the saved token (older sessions persisted a
  // token without it). Cosmetic — never blocks the repo list.
  useEffect(() => {
    if (!username && token) client.getUser(token).then(u => setUsername(forge, u)).catch(() => {});
  }, [username, token, forge, setUsername]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = (repo: ForgeRepo) => {
    connectRepo(projectRepoKey(), {
      forge,
      baseUrl: baseUrl || undefined,
      fullName: repo.fullName,
      branch: repo.defaultBranch,
      htmlUrl: repo.htmlUrl,
      lastSyncSha: null,
    });
  };

  const handleCreateRepo = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const repo = await client.createRepo(token, newName, 'Built with Relational Builder');
      await client.addReltechTopic(token, repo.fullName).catch(() => {});
      connect(repo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repo');
    } finally {
      setCreating(false);
    }
  };

  const filtered = filter
    ? repos.filter(r => r.fullName.toLowerCase().includes(filter.toLowerCase()))
    : repos;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {username ? (
            <>Signed in to {meta.name} as <span className="font-medium text-foreground">{username}</span></>
          ) : (
            <>Connected to {meta.name}</>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground underline">
            Different service
          </button>
          <button onClick={() => signOut(forge)} className="text-xs text-muted-foreground hover:text-foreground underline">
            {badToken ? 'Use a different token' : 'Sign out'}
          </button>
        </div>
      </div>

      {badToken && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5">
          <p className="text-xs">
            Your saved token didn't work — it may have expired or been revoked.{' '}
            <button onClick={() => signOut(forge)} className="underline font-medium">Enter a new token</button>.
          </p>
        </div>
      )}

      {/* Create new repo */}
      {showCreate ? (
        <div className="flex gap-1.5">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="my-community-app"
            className="h-8 text-sm flex-1"
            onKeyDown={e => e.key === 'Enter' && handleCreateRepo()}
          />
          <Button size="sm" className="h-8 gap-1" onClick={handleCreateRepo} disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            Create
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full gap-1 h-8 text-xs" onClick={() => setShowCreate(true)}>
          <Plus className="size-3" /> New repository
        </Button>
      )}

      {/* Search existing repos */}
      <Input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Search your repos..."
        className="h-8 text-sm"
      />

      {error && !badToken && <p className="text-xs text-destructive">{error}</p>}

      {/* Repo list */}
      <div className="max-h-48 overflow-y-auto space-y-1 -mx-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No repos found</p>
        ) : (
          filtered.map(repo => (
            <button
              key={repo.fullName}
              onClick={() => connect(repo)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors"
            >
              <div className="text-xs font-medium truncate">{repo.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Connected View (Push / Pull) ──────────────────────────────────────

function ConnectedView() {
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const repoKey = currentProjectId ?? 'local';
  const connectedRepo = useSyncStore(s => s.repos[repoKey])!;
  const updateLastSync = useSyncStore(s => s.updateLastSync);
  const disconnectRepo = useSyncStore(s => s.disconnectRepo);
  const forgeName = forgeNameForRepo(connectedRepo);

  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const fileCount = useProjectStore(s => s.getFileCount());

  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState('');
  const [commitMsg, setCommitMsg] = useState('Update from Relational Builder');
  const [error, setError] = useState<string | null>(null);
  // When the repo is ahead of us, confirm before overwriting
  const [pushWarning, setPushWarning] = useState<{ aheadBy: number } | null>(null);

  const doPush = useCallback(async () => {
    const files = getAllFiles();
    if (files.length === 0) return;

    setPushing(true);
    setError(null);
    setMessage('');
    setPushWarning(null);
    try {
      // Framework projects push their full runnable source: the kit files
      // they import plus a Vite scaffold, so a clone runs with npm install.
      const sourceFiles = needsBuild(files) ? materializeSource(files) : files;
      // Include the .reltech.yml manifest (with lineage) unless the project
      // already carries its own — the network watcher reads it from the repo.
      const filesToPush = [...sourceFiles];
      const hasManifest = files.some(f => f.path.replace(/^\//, '') === '.reltech.yml');
      if (!hasManifest) {
        const { lineage } = useProjectStore.getState();
        const repoName = connectedRepo.fullName.split('/')[1] ?? 'my-community-app';
        filesToPush.push({
          path: '.reltech.yml',
          content: generateManifest(repoName, lineage),
          language: 'yaml',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      const result = await clientForRepo(connectedRepo).pushFiles(
        tokenForRepo(connectedRepo),
        connectedRepo.fullName,
        connectedRepo.branch,
        filesToPush,
        commitMsg,
      );
      updateLastSync(repoKey, result.commitSha);
      setMessage(`Pushed ${result.filesChanged} files`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setPushing(false);
    }
  }, [connectedRepo, commitMsg, getAllFiles, updateLastSync, repoKey]);

  const handlePush = useCallback(async () => {
    // Don't clobber work that landed on the repo since we last synced
    setPushing(true);
    setError(null);
    const remote = await checkPushSafety();
    setPushing(false);
    if (remote && (remote.aheadBy > 0 || remote.fullResync)) {
      setPushWarning({ aheadBy: remote.aheadBy });
      return;
    }
    doPush();
  }, [doPush]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    setError(null);
    setMessage('');
    try {
      const summary = await pullRemoteChanges();
      const changed = summary.applied.length + summary.deleted.length;
      setMessage(
        changed > 0
          ? `Pulled ${changed} file${changed > 1 ? 's' : ''} — see the summary in chat`
          : 'Already up to date',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setPulling(false);
    }
  }, []);

  return (
    <div className="space-y-4 pt-2">
      {/* Connected repo info */}
      <div className="flex items-center justify-between">
        <div>
          <a
            href={connectedRepo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium hover:underline inline-flex items-center gap-1"
          >
            {connectedRepo.fullName} <ExternalLink className="size-2.5" />
          </a>
          <p className="text-xs text-muted-foreground">
            {forgeName} · Branch: {connectedRepo.branch}
            {connectedRepo.lastSyncSha && (
              <> · Last sync: {connectedRepo.lastSyncSha.slice(0, 7)}</>
            )}
          </p>
        </div>
        <button
          onClick={() => disconnectRepo(repoKey)}
          className="text-xs text-muted-foreground hover:text-foreground"
          title="Disconnect"
        >
          <Unplug className="size-3.5" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Edit this project anywhere — Claude Code, your own editor — and{' '}
        <span className="text-foreground">Pull</span> brings the changes back with a
        plain-language summary. Push writes your Builder changes on top without deleting
        files that live only in the repo.
      </p>

      {/* Commit message */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Commit message</label>
        <Input
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          placeholder="Update from Relational Builder"
          className="h-8 text-sm"
        />
      </div>

      {/* Push / Pull buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handlePush}
          disabled={pushing || pulling || fileCount === 0}
          className="flex-1 gap-1.5"
          variant="default"
        >
          {pushing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUpFromLine className="size-3.5" />
          )}
          Push ({fileCount} files)
        </Button>
        <Button
          onClick={handlePull}
          disabled={pushing || pulling}
          className="flex-1 gap-1.5"
          variant="outline"
        >
          {pulling ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowDownToLine className="size-3.5" />
          )}
          Pull
        </Button>
      </div>

      {/* Push-would-overwrite warning */}
      {pushWarning && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs">
              {forgeName} has{' '}
              <span className="font-medium">
                {pushWarning.aheadBy > 0
                  ? `${pushWarning.aheadBy} commit${pushWarning.aheadBy > 1 ? 's' : ''}`
                  : 'changes'}
              </span>{' '}
              the Builder hasn't seen. Pull first so you don't lose them — or push anyway
              to keep your version.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setPushWarning(null); handlePull(); }}>
              Pull first
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={() => { setPushWarning(null); doPush(); }}>
              Push anyway
            </Button>
          </div>
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      {message && (
        <div className="rounded-lg border bg-muted/50 p-2.5 flex items-center gap-1.5">
          <Check className="size-3.5 text-green-600 shrink-0" />
          <p className="text-xs">{message}</p>
        </div>
      )}
    </div>
  );
}
