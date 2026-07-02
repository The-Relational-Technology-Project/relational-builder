import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { remixRepo } from '@/project/remix';
import { Shuffle, Loader2 } from 'lucide-react';

/**
 * Remix a project from the relational tech network — the inbound half of
 * the commons loop. Scale spreads neighborhood to neighborhood through
 * remixing, and lineage keeps the chain of credit unbroken.
 */
export function RemixDialog() {
  const [open, setOpen] = useState(false);
  const [repoRef, setRepoRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileCount = useProjectStore(s => s.getFileCount());

  async function handleRemix() {
    if (!repoRef.trim()) return;
    if (
      fileCount > 0 &&
      !window.confirm('Remixing replaces your current workspace (save it to the cloud first if you want to keep it). Continue?')
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await remixRepo(repoRef);
      setRepoRef('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remix failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs'}>
        <Shuffle className="size-3" />
        Remix
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remix from the network</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Start from a tool another neighborhood already built. Paste any
            public GitHub repo — the Network tab in Settings shows what the
            relational tech network has been shipping. Lineage is recorded
            automatically, so credit travels with your version.
          </p>
          <Input
            value={repoRef}
            onChange={e => setRepoRef(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRemix()}
            placeholder="github.com/owner/repo or owner/repo"
            className="text-xs font-mono"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" disabled={!repoRef.trim() || busy} onClick={handleRemix}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Shuffle className="size-3.5" />}
              {busy ? 'Pulling files...' : 'Remix it'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
