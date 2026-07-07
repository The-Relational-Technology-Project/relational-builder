import { useUIStore } from '@/store/ui-store';
import { buttonVariants, Button } from '@/components/ui/button';
import { BuildersDirectory } from '@/components/BuildersDirectory';
import { HeartHandshake, X } from 'lucide-react';

/**
 * The nav affordance that opens the Connections page. Kept next to the page so
 * the toggle lives in one place, mirroring ProjectsButton.
 */
export function ConnectionsButton({ mobile }: { mobile?: boolean }) {
  const connectionsOpen = useUIStore(s => s.connectionsOpen);
  const setConnectionsOpen = useUIStore(s => s.setConnectionsOpen);
  return (
    <button
      onClick={() => setConnectionsOpen(!connectionsOpen)}
      className={
        buttonVariants({ variant: connectionsOpen && !mobile ? 'secondary' : mobile ? 'outline' : 'ghost', size: 'sm' }) +
        (mobile ? ' h-8 gap-1 text-xs' : ' h-7 gap-1 text-xs')
      }
    >
      <HeartHandshake className="size-3.5" />
      Connections
    </button>
  );
}

/**
 * The Connections page — a full-width space for the relational layer of the
 * network: RTP steward support, the directory of builders who opted into
 * connecting, and your own connection settings. This lives in the main nav
 * (it used to sit at the bottom of the home screen) because connecting with
 * other builders is its own destination, not a footnote to a build.
 */
export function ConnectionsPage() {
  const setConnectionsOpen = useUIStore(s => s.setConnectionsOpen);

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HeartHandshake className="size-6 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Connections</h1>
              <p className="text-sm text-muted-foreground">
                Find other builders, get a hand from RTP stewards, and choose how
                you show up to the network.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => setConnectionsOpen(false)}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>

        <BuildersDirectory />
      </div>
    </div>
  );
}
