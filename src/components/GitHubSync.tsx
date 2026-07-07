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
import { useGitHubStore } from '@/store/github-store';
import { useProjectStore } from '@/store/project-store';
import { useCloudStore } from '@/store/cloud-store';
import {
  getUser,
  listRepos,
  createRepo,
  pushFiles,
  addReltechTopic,
  type GitHubRepo,
} from '@/project/github-api';
import { projectRepoKey, checkPushSafety, pullRemoteChanges } from '@/project/github-sync';
import { generateManifest } from '@/project/export';
import {
  GitBranch,
  ArrowUpFromLine,
  ArrowDownToLine,
  Plus,
  Check,
  Loader2,
  ExternalLink,
  Unplug,
  AlertTriangle,
} from 'lucide-react';

type View = 'connect' | 'repos' | 'connected';

export function GitHubSync() {
  const [open, setOpen] = useState(false);
  const token = useGitHubStore(s => s.token);
  const username = useGitHubStore(s => s.username);
  const repos = useGitHubStore(s => s.repos);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const connectedRepo = repos[currentProjectId ?? 'local'] ?? null;

  // The token is stored ONCE, globally, and persisted. A saved token alone
  // means "connected to GitHub" — the username is cosmetic and gets backfilled
  // in the repo list. Each project still picks its own repo, but the token is
  // never asked for again. (Previously this also required `username`, so any
  // persisted state that lost it re-prompted for the token on every project.)
  void username;
  const view: View = connectedRepo ? 'connected' : token ? 'repos' : 'connect';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-1 rounded-md px-3 h-7 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <GitBranch className="size-3" />
        {connectedRepo ? connectedRepo.fullName.split('/')[1] : 'GitHub'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === 'connect' && 'Connect to GitHub'}
            {view === 'repos' && 'Select Repository'}
            {view === 'connected' && 'GitHub Sync'}
          </DialogTitle>
        </DialogHeader>
        {view === 'connect' && <ConnectView onConnected={() => {}} />}
        {view === 'repos' && <RepoListView />}
        {view === 'connected' && <ConnectedView />}
      </DialogContent>
    </Dialog>
  );
}

// ── Connect View ──────────────────────────────────────────────────────

function ConnectView({ onConnected }: { onConnected: () => void }) {
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setToken = useGitHubStore(s => s.setToken);
  const setUsername = useGitHubStore(s => s.setUsername);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const login = await getUser(tokenInput);
      setToken(tokenInput);
      setUsername(login);
      onConnected();
    } catch {
      setError('Invalid token — check that it has repo access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-muted-foreground">
        Connect a repo and your project syncs both ways. Edit in Claude Code or any
        editor, push, and the Builder notices — pulling the changes back in and telling
        you if anything (like a migration) needs a hand.
      </p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Personal access token</label>
        <Input
          type="password"
          value={tokenInput}
          onChange={e => setTokenInput(e.target.value)}
          placeholder="ghp_..."
          className="h-8 text-sm font-mono"
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
        />
        <p className="text-xs text-muted-foreground">
          Needs <code className="bg-muted px-1 rounded">repo</code> scope.{' '}
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=Relational+Builder"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Create one
          </a>
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={handleConnect} disabled={loading || !tokenInput.trim()} className="w-full gap-2">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
        Connect
      </Button>
    </div>
  );
}

// ── Repo List View ────────────────────────────────────────────────────

function RepoListView() {
  const token = useGitHubStore(s => s.token);
  const username = useGitHubStore(s => s.username);
  const connectRepo = useGitHubStore(s => s.connectRepo);
  const setUsername = useGitHubStore(s => s.setUsername);
  const clearAll = useGitHubStore(s => s.clearAll);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badToken, setBadToken] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    listRepos(token)
      .then(setRepos)
      // A saved token that no longer works (expired/revoked) is the one case
      // where we DO need a new token — offer that explicitly.
      .catch(() => { setError('That saved token didn\'t work — it may have expired.'); setBadToken(true); })
      .finally(() => setLoading(false));
  }, [token]);

  // Backfill the display name from the saved token (older sessions persisted a
  // token without it). Cosmetic — never blocks the repo list.
  useEffect(() => {
    if (!username && token) getUser(token).then(setUsername).catch(() => {});
  }, [username, token, setUsername]);

  const handleSelectRepo = (repo: GitHubRepo) => {
    connectRepo(projectRepoKey(), {
      fullName: repo.full_name,
      branch: repo.default_branch,
      htmlUrl: repo.html_url,
      lastSyncSha: null,
    });
  };

  const handleCreateRepo = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const repo = await createRepo(token, newName, 'Built with Relational Builder');
      // Add relational-tech topic
      await addReltechTopic(token, repo.full_name).catch(() => {});
      connectRepo(projectRepoKey(), {
        fullName: repo.full_name,
        branch: repo.default_branch,
        htmlUrl: repo.html_url,
        lastSyncSha: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repo');
    } finally {
      setCreating(false);
    }
  };

  const filtered = filter
    ? repos.filter(r => r.full_name.toLowerCase().includes(filter.toLowerCase()))
    : repos;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {username ? <>Signed in as <span className="font-medium text-foreground">{username}</span></> : 'Connected to GitHub'}
        </p>
        <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline">
          {badToken ? 'Use a different token' : 'Sign out'}
        </button>
      </div>

      {badToken && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2.5">
          <p className="text-xs">
            Your saved token didn't work — it may have expired or been revoked.{' '}
            <button onClick={clearAll} className="underline font-medium">Enter a new token</button>.
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
              key={repo.full_name}
              onClick={() => handleSelectRepo(repo)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors"
            >
              <div className="text-xs font-medium truncate">{repo.full_name}</div>
              <div className="text-xs text-muted-foreground">
                {repo.private ? 'Private' : 'Public'} · {repo.default_branch}
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
  const token = useGitHubStore(s => s.token);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const repoKey = currentProjectId ?? 'local';
  const connectedRepo = useGitHubStore(s => s.repos[repoKey])!;
  const updateLastSync = useGitHubStore(s => s.updateLastSync);
  const disconnectRepo = useGitHubStore(s => s.disconnectRepo);

  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const fileCount = useProjectStore(s => s.getFileCount());

  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState('');
  const [commitMsg, setCommitMsg] = useState('Update from Relational Builder');
  const [error, setError] = useState<string | null>(null);
  // When GitHub is ahead of us, confirm before overwriting
  const [pushWarning, setPushWarning] = useState<{ aheadBy: number } | null>(null);

  const doPush = useCallback(async () => {
    const files = getAllFiles();
    if (files.length === 0) return;

    setPushing(true);
    setError(null);
    setMessage('');
    setPushWarning(null);
    try {
      // Include the .reltech.yml manifest (with lineage) unless the project
      // already carries its own — the network watcher reads it from the repo.
      const filesToPush = [...files];
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
      const result = await pushFiles(
        token,
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
  }, [token, connectedRepo, commitMsg, getAllFiles, updateLastSync, repoKey]);

  const handlePush = useCallback(async () => {
    // Don't clobber work that landed on GitHub since we last synced
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
            Branch: {connectedRepo.branch}
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
              GitHub has{' '}
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
