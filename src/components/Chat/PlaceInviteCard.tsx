import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceDialog } from '@/components/PlaceDialog';
import { useProjectStore } from '@/store/project-store';
import { placeSummary } from '@/project/place';

/**
 * "Where will this serve?" — the invitation at the start of a build to say
 * what area the software is for and whether its boundary is strict or rough.
 *
 * It sits above the composer from the first empty screen until something is
 * built, so the very first plan can stand on the place: its names, its data,
 * what its neighbors already keep. Skippable (the skip rides on the project,
 * so it stays skipped), and once an area is set the card shrinks to one line
 * with a way to change it. After the first build it steps aside; the project
 * menu keeps the same dialog from then on.
 */
export function PlaceInviteCard({ variant = 'chat' }: { variant?: 'hero' | 'chat' }) {
  const lineage = useProjectStore(s => s.lineage);
  const setLineage = useProjectStore(s => s.setLineage);
  const fileCount = useProjectStore(s => s.getFileCount());
  const [open, setOpen] = useState(false);

  const place = lineage?.place;
  const dialog = <PlaceDialog open={open} onOpenChange={setOpen} />;
  const wrap = variant === 'hero' ? '' : 'mx-4 mb-2 ';

  // Once something is built, the area is changed from the project menu
  if (fileCount > 0) return open ? dialog : null;

  if (place) {
    return (
      <>
        <div className={`${wrap}flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-1.5 text-xs min-w-0`}>
          <MapPin className="size-3.5 text-primary shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={placeSummary(place)}>
            <span className="text-muted-foreground">Serves </span>{placeSummary(place)}
          </span>
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-primary hover:underline">Change</button>
        </div>
        {dialog}
      </>
    );
  }

  if (lineage?.placeSkipped) return open ? dialog : null;

  return (
    <>
      <div className={`${wrap}rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-left`}>
        <div className="flex items-start gap-2.5">
          <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium">Where will this serve?</p>
            <p className="text-xs text-muted-foreground leading-snug">
              A block, a few blocks, a neighborhood, a watershed. Set the area and whether its boundary is strict or rough,
              and the Builder designs from what that place already knows: its names, its history, its own data.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>Set the area</Button>
              <button
                type="button"
                onClick={() => setLineage({ ...(lineage ?? { source: null }), placeSkipped: true })}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLineage({ ...(lineage ?? { source: null }), placeSkipped: true })}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Skip for now"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {dialog}
    </>
  );
}
