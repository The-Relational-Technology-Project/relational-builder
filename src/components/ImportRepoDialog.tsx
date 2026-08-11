import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSyncStore } from '@/store/sync-store';
import { useUIStore } from '@/store/ui-store';
import { FORGES, forgeClient, type ForgeId, type ForgeRepo } from '@/project/forge';
import { importRepoAsProject } from '@/project/import-repo';
import { ForgePickerView, ConnectView } from '@/components/CodeSync';
import { Loader2, ArrowLeft, ArrowDownToLine, ShieldCheck } from 'lucide-react';

/**
 * Bring an existing repo you control into the Builder as its own project —
 * connected for two-way sync, not forked. This is the door for work that
 * started in Lovable or anywhere else and is moving here: pick the repo
 * once, and from then on it's an ordinary Builder project whose repo keeps
 * itself up to date.
 *
 * Shares the forge auth flow (and saved tokens) with the sync panel, so
 * connecting here means never entering the token again there.
 */
interface DialogControl {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportRepoDialog({ open, onOpenChange }: DialogControl) {
  const [forge, setForge] = useState<ForgeId | null>(null);
  const [pendingRepo, setPendingRepo] = useState<ForgeRepo | null>(null);
  const tokens = useSyncStore(s => s.tokens);
  const instanceUrls = useSyncStore(s => s.instanceUrls);

  const view = !forge
    ? 'pick'
    : !tokens[forge] || (FORGES[forge].needsInstanceUrl && !instanceUrls[forge])
      ? 'connect'
      : pendingRepo
        ? 'live-question'
        : 'repos';

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        onOpenChange(v);
        if (!v) {
          setForge(null);
          setPendingRepo(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === 'connect' && forge
              ? `Connect to ${FORGES[forge].name}`
              : view === 'live-question'
                ? 'One question first'
                : 'Import your own project'}
          </DialogTitle>
        </DialogHeader>
        {view === 'pick' && (
          <ForgePickerView
            onPick={setForge}
            intro={
              'Already have a project on GitHub — from Lovable, another builder, or your own editor? ' +
              'Import it and it becomes a Builder project connected to that repo: your edits here ' +
              'push back, and commits from anywhere else come in with a summary. Nothing is forked.'
            }
          />
        )}
        {view === 'connect' && forge && (
          <ConnectView forge={forge} onBack={() => setForge(null)} />
        )}
        {view === 'repos' && forge && (
          <ImportRepoList
            forge={forge}
            onBack={() => setForge(null)}
            onPickRepo={setPendingRepo}
          />
        )}
        {view === 'live-question' && forge && pendingRepo && (
          <LiveQuestionView
            forge={forge}
            repo={pendingRepo}
            onBack={() => setPendingRepo(null)}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The one question that decides the import's posture, asked in the
 * builder's language ("is it live?") rather than git's ("which branch?").
 * A live app gets a safe copy and a Publish button; anything else syncs
 * straight to the default branch like before.
 */
function LiveQuestionView({
  forge,
  repo,
  onBack,
  onDone,
}: {
  forge: ForgeId;
  repo: ForgeRepo;
  onBack: () => void;
  onDone: () => void;
}) {
  const setView = useUIStore(s => s.setView);
  const [busy, setBusy] = useState<'safe' | 'direct' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runImport = async (safeCopy: boolean) => {
    setBusy(safeCopy ? 'safe' : 'direct');
    setError(null);
    try {
      await importRepoAsProject(forge, repo, { safeCopy });
      onDone();
      setView('builder');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <p className="text-sm">
        Is <span className="font-medium">{repo.fullName.split('/')[1]}</span>{' '}
        live for your community right now?
      </p>
      <div className="space-y-1.5">
        <button
          onClick={() => runImport(true)}
          disabled={busy !== null}
          className="w-full text-left rounded-lg border-2 border-primary/40 px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-60"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              Yes, people use it — keep my live site safe
            </span>
            {busy === 'safe' ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <ShieldCheck className="size-4 shrink-0 text-primary" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your edits stay on a separate safe copy. Nothing reaches the live
            site until you press <strong>Publish</strong> — recommended for
            anything with real visitors.
          </p>
        </button>
        <button
          onClick={() => runImport(false)}
          disabled={busy !== null}
          className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-60"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Not live yet — keep it simple</span>
            {busy === 'direct' && (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Changes sync straight to <code>{repo.defaultBranch}</code>, the
            same way Builder-born projects work.
          </p>
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        onClick={onBack}
        disabled={busy !== null}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Different repo
      </button>
    </div>
  );
}

function ImportRepoList({
  forge,
  onBack,
  onPickRepo,
}: {
  forge: ForgeId;
  onBack: () => void;
  onPickRepo: (repo: ForgeRepo) => void;
}) {
  const token = useSyncStore(s => s.tokens[forge]) ?? '';
  const username = useSyncStore(s => s.usernames[forge]) ?? null;
  const signOut = useSyncStore(s => s.signOut);
  const baseUrl =
    useSyncStore.getState().instanceUrls[forge] ?? FORGES[forge].defaultBaseUrl ?? '';
  const meta = FORGES[forge];

  const [repos, setRepos] = useState<ForgeRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    forgeClient(forge, baseUrl || undefined)
      .listRepos(token)
      .then(setRepos)
      .catch(() => setError("Couldn't list your repos — the saved token may have expired."))
      .finally(() => setLoading(false));
  }, [forge, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = filter
    ? repos.filter(r => r.fullName.toLowerCase().includes(filter.toLowerCase()))
    : repos;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {username ? (
            <>
              Signed in to {meta.name} as{' '}
              <span className="font-medium text-foreground">{username}</span>
            </>
          ) : (
            <>Connected to {meta.name}</>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Different service
          </button>
          <button
            onClick={() => signOut(forge)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Sign out
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Pick the repo to bring in. Your current work is saved first — importing
        never loses anything. Organization repos you're a member of are listed
        too.
      </p>

      <Input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Search your repos..."
        className="h-8 text-sm"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* A visible box around the scroll area: rows clip at a border, not
          mid-air — a half-visible row reads as "scroll for more" instead of
          broken layout */}
      <div className="max-h-56 overflow-y-auto rounded-lg border p-1 space-y-0.5">
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
              onClick={() => onPickRepo(repo)}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{repo.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}
                  </div>
                </div>
                <ArrowDownToLine className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>

      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Back
      </button>
    </div>
  );
}
