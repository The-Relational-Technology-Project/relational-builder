import { useState } from 'react';
import { useUIStore } from '@/store/ui-store';
import { RemixDialog } from '@/components/RemixDialog';
import { ImportRepoDialog } from '@/components/ImportRepoDialog';
import { LayoutGrid, Shuffle, GitBranch, Mic } from 'lucide-react';

/**
 * The other ways a build can start, offered right where builds start — under
 * the home composer instead of in the main nav. The gallery is the headline
 * (browse the network's tools and grow your own version); talking the dream
 * out loud, forking a repo, and importing your own repo stay as the quieter
 * options beside it.
 */
export function StartFromOptions() {
  const setView = useUIStore(s => s.setView);
  const [remixOpen, setRemixOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);

  // Never key-gated: browsing the gallery, importing a plan, and forking a
  // repo all work before any model is configured
  const optionClass =
    'inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors';

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        <span className="text-xs text-muted-foreground/60">or start from</span>
        <button className={optionClass} onClick={() => setView('gallery')}>
          <LayoutGrid className="size-3" />
          the Gallery
        </button>
        <button className={optionClass} onClick={() => setView('dream')}>
          <Mic className="size-3" />
          a conversation
        </button>
        <button className={optionClass} onClick={() => setRemixOpen(true)}>
          <Shuffle className="size-3" />
          a tool's code
        </button>
        <button className={optionClass} onClick={() => setRepoOpen(true)}>
          <GitBranch className="size-3" />
          your own repo
        </button>
      </div>
      <RemixDialog open={remixOpen} onOpenChange={setRemixOpen} hideTrigger />
      <ImportRepoDialog open={repoOpen} onOpenChange={setRepoOpen} />
    </>
  );
}
