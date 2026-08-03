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
  pullRemoteChanges,
  pushToRepo,
  forgeNameForRepo,
} from '@/project/code-sync';
import { syncNow } from '@/project/auto-sync';
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
  RefreshCw,
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
  const pushStatus = useSyncStore(s => s.pushStatus);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const repoKey = currentProjectId ?? 'local';
  const connectedRepo = repos[repoKey] ?? null;
  const autoOn = useSyncStore(s => s.autoPush[repoKey] !== false);

  // The trigger carries the sync's state, so nobody has to open a panel to
  // find out whether their work is safely on the repo
  const attention =
    !!connectedRepo && (pushStatus === 'held' || pushStatus === 'error');
  const syncing = !!connectedRepo && pushStatus === 'pushing';

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
        className={
          'inline-flex items-center justify-center gap-1 rounded-md px-3 h-7 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground' +
          (attention ? ' text-amber-600' : '')
        }
        title={
          connectedRepo
            ? attention
              ? `${connectedRepo.fullName} — needs a moment`
              : `${connectedRepo.fullName} — ${autoOn ? 'syncing automatically' : 'automatic sync is off'}`
            : 'Sync this project with a repo'
        }
      >
        {syncing ? (
          <Loader2 className="size-3 shrink-0 animate-spin" />
        ) : attention ? (
          <AlertTriangle className="size-3 shrink-0" />
        ) : (
          <GitBranch className="size-3 shrink-0" />
        )}
        {/* Bounded: a repo name is someone else's string, and an unbounded one
            grows the header group until Share loses its edge. */}
        <span className="max-w-[9rem] truncate">
          {connectedRepo ? connectedRepo.fullName.split('/')[1] : 'Sync'}
        </span>
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

  const connect = (repo: ForgeRepo, lastSyncSha: string | null = null) => {
    connectRepo(projectRepoKey(), {
      forge,
      baseUrl: baseUrl || undefined,
      fullName: repo.fullName,
      branch: repo.defaultBranch,
      htmlUrl: repo.htmlUrl,
      lastSyncSha,
    });
  };

  const handleCreateRepo = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const repo = await client.createRepo(token, newName, 'Built with Relational Builder');
      await client.addReltechTopic(token, repo.fullName).catch(() => {});
      // A repo we just made holds nothing but its initial commit, so there's
      // no "whose version wins" question to ask: treat it as already in sync
      // and let the first automatic push fill it.
      const head = await client
        .getBranchHead(token, repo.fullName, repo.defaultBranch)
        .catch(() => null);
      connect(repo, head);
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

// ── Connected View ────────────────────────────────────────────────────

/** "2 minutes ago", in the smallest unit that still reads naturally */
function timeAgo(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * A connected repo, once. Connecting is the decision; after that the Builder
 * pushes your changes on its own and this panel is somewhere to *look*, not
 * something to operate — where the code lives, whether it's up to date, and
 * the one deliberate action that remains: pulling work done elsewhere in.
 *
 * The commit-message box and the Push button that used to live here are what
 * made this a chore. Push is still available, quietly, for the moments the
 * automatic path holds back — and it refuses to send an unchanged project, so
 * pressing it twice can't repeat a push you already made.
 */
function ConnectedView() {
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const repoKey = currentProjectId ?? 'local';
  const connectedRepo = useSyncStore(s => s.repos[repoKey])!;
  const disconnectRepo = useSyncStore(s => s.disconnectRepo);
  const setAutoPush = useSyncStore(s => s.setAutoPush);
  const pushStatus = useSyncStore(s => s.pushStatus);
  const pushError = useSyncStore(s => s.pushError);
  const lastPushedAt = useSyncStore(s => s.lastPushedAt[repoKey]);
  const autoOn = useSyncStore(s => s.autoPush[repoKey] !== false);
  const forgeName = forgeNameForRepo(connectedRepo);

  const fileCount = useProjectStore(s => s.getFileCount());

  const [busy, setBusy] = useState<'push' | 'pull' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Never synced with this repo: which side is the starting point is a real
  // question with no safe default, so it gets asked once — and never again.
  const needsFirstSync = !connectedRepo.lastSyncSha;

  const handlePull = useCallback(async () => {
    setBusy('pull');
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
      setBusy(null);
    }
  }, []);

  const handlePush = useCallback(async (force = false) => {
    setBusy('push');
    setError(null);
    setMessage('');
    try {
      const outcome = await pushToRepo({ force });
      if (outcome.status === 'pushed') {
        setMessage(`Pushed ${outcome.filesChanged} files`);
        useSyncStore.getState().setPushStatus('pushed');
      } else if (outcome.status === 'unchanged') {
        setMessage(`${forgeName} already has this version`);
      } else {
        useSyncStore.getState().setPushStatus('held');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed');
    } finally {
      setBusy(null);
    }
  }, [forgeName]);

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

      {needsFirstSync ? (
        /* One-time starting point. After this, sync runs itself. */
        <div className="rounded-lg border p-3 space-y-2.5">
          <p className="text-xs leading-relaxed">
            <span className="font-medium">Where should this start?</span> This
            repo may already have code in it. Pick once — after that, changes
            you make here push themselves.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 gap-1.5 text-xs"
              onClick={handlePull}
              disabled={busy !== null}
            >
              {busy === 'pull' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowDownToLine className="size-3.5" />
              )}
              Start from the repo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 gap-1.5 text-xs"
              onClick={() => handlePush(true)}
              disabled={busy !== null || fileCount === 0}
            >
              {busy === 'push' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUpFromLine className="size-3.5" />
              )}
              Start from this project
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pulling brings the repo's code in here. Pushing writes this project
            on top — it never deletes files that live only in the repo.
          </p>
        </div>
      ) : (
        <>
          {/* Sync state, in one line */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-start gap-2">
              {pushStatus === 'pushing' || busy === 'push' ? (
                <Loader2 className="size-3.5 shrink-0 mt-0.5 animate-spin text-muted-foreground" />
              ) : pushStatus === 'held' ? (
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
              ) : pushStatus === 'error' ? (
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-destructive" />
              ) : (
                <Check className="size-3.5 shrink-0 mt-0.5 text-green-600" />
              )}
              <div className="text-xs space-y-0.5 min-w-0">
                {pushStatus === 'pushing' || busy === 'push' ? (
                  <p className="font-medium">Sending your changes to {forgeName}…</p>
                ) : pushStatus === 'held' ? (
                  <p className="font-medium">
                    Waiting — {forgeName} has changes the Builder hasn't seen
                  </p>
                ) : pushStatus === 'error' ? (
                  <p className="font-medium text-destructive">
                    Couldn't sync: {pushError}
                  </p>
                ) : autoOn ? (
                  <p className="font-medium">Up to date with {forgeName}</p>
                ) : (
                  <p className="font-medium">Automatic sync is off</p>
                )}
                <p className="text-muted-foreground">
                  {pushStatus === 'held'
                    ? 'Pull those changes in and syncing picks up again.'
                    : autoOn
                      ? 'Every change you make here lands on the repo a few seconds later — nothing to press.'
                      : 'Your changes stay here until you push them.'}
                  {lastPushedAt && ` Last synced ${timeAgo(lastPushedAt)}.`}
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 border-t text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autoOn}
                onChange={e => {
                  setAutoPush(repoKey, e.target.checked);
                  if (e.target.checked) syncNow();
                }}
                className="size-3.5 accent-primary"
              />
              <span>Keep {connectedRepo.fullName.split('/')[1]} up to date automatically</span>
            </label>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Edit this project anywhere — Claude Code, your own editor — and{' '}
            <span className="text-foreground">Pull</span> brings the changes back with a
            plain-language summary.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handlePull}
              disabled={busy !== null}
              className="flex-1 gap-1.5"
              variant={pushStatus === 'held' ? 'default' : 'outline'}
            >
              {busy === 'pull' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowDownToLine className="size-3.5" />
              )}
              Pull changes
            </Button>
            {/* The manual path, kept for the moments automatic sync holds
                back. It sends nothing when nothing changed. */}
            <Button
              onClick={() => handlePush(pushStatus === 'held')}
              disabled={busy !== null || fileCount === 0}
              className="gap-1.5"
              variant="ghost"
              title={
                pushStatus === 'held'
                  ? 'Push anyway — your version wins'
                  : 'Push now instead of waiting'
              }
            >
              {busy === 'push' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {pushStatus === 'held' ? 'Push anyway' : 'Push now'}
            </Button>
          </div>
        </>
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
