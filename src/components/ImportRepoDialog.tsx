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
import { Loader2, ArrowLeft, ArrowDownToLine } from 'lucide-react';

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
  const tokens = useSyncStore(s => s.tokens);
  const instanceUrls = useSyncStore(s => s.instanceUrls);

  const view = !forge
    ? 'pick'
    : !tokens[forge] || (FORGES[forge].needsInstanceUrl && !instanceUrls[forge])
      ? 'connect'
      : 'repos';

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        onOpenChange(v);
        if (!v) setForge(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === 'connect' && forge
              ? `Connect to ${FORGES[forge].name}`
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
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportRepoList({
  forge,
  onBack,
  onDone,
}: {
  forge: ForgeId;
  onBack: () => void;
  onDone: () => void;
}) {
  const token = useSyncStore(s => s.tokens[forge]) ?? '';
  const username = useSyncStore(s => s.usernames[forge]) ?? null;
  const signOut = useSyncStore(s => s.signOut);
  const setView = useUIStore(s => s.setView);
  const baseUrl =
    useSyncStore.getState().instanceUrls[forge] ?? FORGES[forge].defaultBaseUrl ?? '';
  const meta = FORGES[forge];

  const [repos, setRepos] = useState<ForgeRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busyRepo, setBusyRepo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    forgeClient(forge, baseUrl || undefined)
      .listRepos(token)
      .then(setRepos)
      .catch(() => setError("Couldn't list your repos — the saved token may have expired."))
      .finally(() => setLoading(false));
  }, [forge, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImport = async (repo: ForgeRepo) => {
    setBusyRepo(repo.fullName);
    setError(null);
    try {
      await importRepoAsProject(forge, repo);
      onDone();
      // Land in the builder with the imported project open
      setView('builder');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setBusyRepo(null);
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

      <div className="max-h-56 overflow-y-auto space-y-1 -mx-1">
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
              onClick={() => handleImport(repo)}
              disabled={busyRepo !== null}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{repo.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {repo.private ? 'Private' : 'Public'} · {repo.defaultBranch}
                  </div>
                </div>
                {busyRepo === repo.fullName ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ArrowDownToLine className="size-3.5 shrink-0 text-muted-foreground" />
                )}
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
