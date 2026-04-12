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
import {
  getUser,
  listRepos,
  createRepo,
  pushFiles,
  pullFiles,
  addReltechTopic,
  type GitHubRepo,
} from '@/project/github-api';
import {
  GitBranch,
  ArrowUpFromLine,
  ArrowDownToLine,
  Plus,
  Check,
  Loader2,
  ExternalLink,
  Unplug,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'connect' | 'repos' | 'connected';

export function GitHubSync() {
  const [open, setOpen] = useState(false);
  const token = useGitHubStore(s => s.token);
  const username = useGitHubStore(s => s.username);
  const connectedRepo = useGitHubStore(s => s.connectedRepo);

  const view: View = connectedRepo ? 'connected' : token && username ? 'repos' : 'connect';

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
        <p className="text-[11px] text-muted-foreground">
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
  const clearAll = useGitHubStore(s => s.clearAll);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    listRepos(token)
      .then(setRepos)
      .catch(() => setError('Failed to load repos'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSelectRepo = (repo: GitHubRepo) => {
    connectRepo({
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
      connectRepo({
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
        <p className="text-xs text-muted-foreground">Signed in as <span className="font-medium text-foreground">{username}</span></p>
        <button onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-foreground underline">
          Sign out
        </button>
      </div>

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

      {error && <p className="text-xs text-destructive">{error}</p>}

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
              <div className="text-[11px] text-muted-foreground">
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
  const connectedRepo = useGitHubStore(s => s.connectedRepo)!;
  const updateLastSync = useGitHubStore(s => s.updateLastSync);
  const disconnectRepo = useGitHubStore(s => s.disconnectRepo);

  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const writeFile = useProjectStore(s => s.writeFile);
  const fileCount = useProjectStore(s => s.getFileCount());

  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState('');
  const [commitMsg, setCommitMsg] = useState('Update from Relational Builder');
  const [error, setError] = useState<string | null>(null);

  const handlePush = useCallback(async () => {
    const files = getAllFiles();
    if (files.length === 0) return;

    setPushing(true);
    setError(null);
    setMessage('');
    try {
      const result = await pushFiles(
        token,
        connectedRepo.fullName,
        connectedRepo.branch,
        files,
        commitMsg,
      );
      updateLastSync(result.commitSha);
      setMessage(`Pushed ${result.filesChanged} files`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setPushing(false);
    }
  }, [token, connectedRepo, commitMsg, getAllFiles, updateLastSync]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    setError(null);
    setMessage('');
    try {
      const result = await pullFiles(
        token,
        connectedRepo.fullName,
        connectedRepo.branch,
      );
      // Write all fetched files into VFS
      for (const file of result.files) {
        writeFile(file.path, file.content);
      }
      updateLastSync(result.commitSha);
      setMessage(`Pulled ${result.files.length} files`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setPulling(false);
    }
  }, [token, connectedRepo, writeFile, updateLastSync]);

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
          <p className="text-[11px] text-muted-foreground">
            Branch: {connectedRepo.branch}
            {connectedRepo.lastSyncSha && (
              <> · Last sync: {connectedRepo.lastSyncSha.slice(0, 7)}</>
            )}
          </p>
        </div>
        <button
          onClick={disconnectRepo}
          className="text-[11px] text-muted-foreground hover:text-foreground"
          title="Disconnect"
        >
          <Unplug className="size-3.5" />
        </button>
      </div>

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
