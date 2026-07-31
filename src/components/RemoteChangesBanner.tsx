import { useCallback, useEffect, useRef, useState } from 'react';
import { GitBranch, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSyncStore } from '@/store/sync-store';
import { useCloudStore } from '@/store/cloud-store';
import { checkRemoteChanges, pullRemoteChanges, forgeNameForRepo } from '@/project/code-sync';

/** Re-check when the tab regains focus, at most this often */
const FOCUS_THROTTLE_MS = 30_000;
/** Background re-check while the tab stays open */
const POLL_INTERVAL_MS = 4 * 60_000;

/**
 * Watches the connected repo for commits made outside the Builder — from
 * Claude Code, an editor, a collaborator — and offers to pull them in.
 * Working on your project in both places is normal here, not a workaround.
 */
export function RemoteChangesBanner() {
  const tokens = useSyncStore(s => s.tokens);
  const repos = useSyncStore(s => s.repos);
  const remote = useSyncStore(s => s.remote);
  const dismissedHead = useSyncStore(s => s.dismissedHead);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const repoKey = currentProjectId ?? 'local';
  const repo = repos[repoKey] ?? null;
  const token = repo ? tokens[repo.forge] : undefined;

  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCheckRef = useRef(0);

  const runCheck = useCallback(() => {
    if (!token || !repo?.lastSyncSha) return;
    if (Date.now() - lastCheckRef.current < FOCUS_THROTTLE_MS) return;
    lastCheckRef.current = Date.now();
    checkRemoteChanges();
  }, [token, repo?.lastSyncSha, repo?.fullName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !repo) return;
    runCheck();
    const onFocus = () => runCheck();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => {
      lastCheckRef.current = 0; // interval checks always go through
      runCheck();
    }, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [token, repo, runCheck]);

  if (!repo || !remote) return null;
  if (remote.headSha === dismissedHead) return null;
  if (!remote.fullResync && remote.aheadBy === 0) return null;

  const forgeName = forgeNameForRepo(repo);

  const handlePull = async () => {
    setPulling(true);
    setError(null);
    try {
      await pullRemoteChanges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setPulling(false);
    }
  };

  const commitWord = remote.aheadBy === 1 ? 'commit' : 'commits';
  const authors = [...new Set(remote.commits.map(c => c.author))];

  return (
    <div className="mx-4 mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <GitBranch className="size-4 shrink-0 text-primary" />
        <p className="text-sm flex-1 min-w-0">
          {remote.fullResync ? (
            <>The repo's history changed on {forgeName} — pull to refresh your copy.</>
          ) : (
            <>
              <span className="font-medium">
                {remote.aheadBy} new {commitWord}
              </span>{' '}
              on {forgeName}{authors.length > 0 && <> from {authors.join(', ')}</>} — pull them in to
              keep building from the latest.
            </>
          )}
        </p>
        <Button size="sm" onClick={handlePull} disabled={pulling} className="shrink-0">
          {pulling ? (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          ) : (
            <GitBranch className="size-3.5 mr-1.5" />
          )}
          Pull changes
        </Button>
        <button
          onClick={() => useSyncStore.getState().dismissRemote(remote.headSha)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Later"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {!remote.fullResync && remote.commits.length > 0 && (
        <ul className="mt-1.5 ml-7 space-y-0.5">
          {remote.commits.slice(-3).map(c => (
            <li key={c.sha} className="text-xs text-muted-foreground truncate">
              <code className="text-[0.7rem]">{c.sha.slice(0, 7)}</code> {c.message}
            </li>
          ))}
          {remote.commits.length > 3 && (
            <li className="text-xs text-muted-foreground">
              …and {remote.commits.length - 3} more
            </li>
          )}
        </ul>
      )}
      {error && <p className="mt-1.5 ml-7 text-xs text-destructive">{error}</p>}
    </div>
  );
}
