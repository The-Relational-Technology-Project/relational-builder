import { useState } from 'react';
import { useUIStore } from '@/store/ui-store';
import { ImportPlanDialog } from '@/components/ImportPlanDialog';
import { RemixDialog } from '@/components/RemixDialog';
import { LayoutGrid, FileDown, MessagesSquare, Shuffle } from 'lucide-react';

/**
 * The other ways a build can start, offered right where builds start — under
 * the home composer instead of in the main nav. The gallery is the headline
 * (browse the network's tools and grow your own version); a neighborhood
 * question opens the Deliberation Studio; importing a Studio build plan and
 * forking a repo stay as the quieter options beside them.
 */
export function StartFromOptions() {
  const setView = useUIStore(s => s.setView);
  const [importOpen, setImportOpen] = useState(false);
  const [remixOpen, setRemixOpen] = useState(false);

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
        <button className={optionClass} onClick={() => setView('deliberate')}>
          <MessagesSquare className="size-3" />
          a neighborhood question
        </button>
        <button className={optionClass} onClick={() => setImportOpen(true)}>
          <FileDown className="size-3" />
          a build plan
        </button>
        <button className={optionClass} onClick={() => setRemixOpen(true)}>
          <Shuffle className="size-3" />
          a tool's code
        </button>
      </div>
      <ImportPlanDialog open={importOpen} onOpenChange={setImportOpen} hideTrigger />
      <RemixDialog open={remixOpen} onOpenChange={setRemixOpen} hideTrigger />
    </>
  );
}
