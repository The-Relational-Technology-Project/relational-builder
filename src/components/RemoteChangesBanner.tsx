import { useState } from 'react';
import { GitBranch, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSyncStore } from '@/store/sync-store';
import { useCloudStore } from '@/store/cloud-store';
import { pullRemoteChanges, forgeNameForRepo } from '@/project/code-sync';

/**
 * Commits that landed on the repo outside the Builder — and that the Builder
 * won't bring in by itself.
 *
 * Most of the time it doesn't come to this: `auto-sync.ts` watches the repo
 * and pulls outside work in on its own, summary in chat, checkpoint taken.
 * This banner is what's left when that would cost someone something — there
 * are Builder changes the repo hasn't seen, so the repo's version winning is
 * a decision rather than a background task — or when the automatic pull hit
 * an error. Then it's an offer, with the reason it's being offered.
 */
export function RemoteChangesBanner() {
  const repos = useSyncStore(s => s.repos);
  const remote = useSyncStore(s => s.remote);
  const dismissedHead = useSyncStore(s => s.dismissedHead);
  const autoPulling = useSyncStore(s => s.autoPulling);
  const applying = useSyncStore(s => s.pulling);
  const pullError = useSyncStore(s => s.pullError);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const repoKey = currentProjectId ?? 'local';
  const repo = repos[repoKey] ?? null;

  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!repo || !remote) return null;
  // Already on their way in — the banner would be a question nobody needs to
  // answer, and it would vanish a second later
  if (autoPulling || applying) return null;
  if (remote.headSha === dismissedHead) return null;
  if (!remote.fullResync && remote.aheadBy === 0) return null;

  const forgeName = forgeNameForRepo(repo);

  const handlePull = async () => {
    setPulling(true);
    setError(null);
    try {
      await pullRemoteChanges();
      useSyncStore.getState().setPullError(null);
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
              on {forgeName}{authors.length > 0 && <> from {authors.join(', ')}</>} —{' '}
              {pullError
                ? 'the Builder couldn\'t bring them in on its own.'
                : 'you have changes here that haven\'t been pushed yet, so this one\'s your call.'}
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
      {!remote.fullResync && (
        <p className="mt-1 ml-7 text-xs text-muted-foreground">
          {pullError
            ? pullError
            : 'The repo\'s version wins for any file both sides changed — everything from before the pull is kept as a checkpoint.'}
        </p>
      )}
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
