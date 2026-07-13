import {
  connectionsFor,
  type GalleryReference,
  type RefSource,
} from '@/knowledge/gallery-references';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';

/**
 * The connections block inside a gallery detail dialog: every entry this one
 * references and every entry that references it, with the note that says why
 * the pairing mattered. Entries still on the shelves are click-through;
 * anything the viewer can't currently see (e.g. another studio's private
 * item) renders as plain text.
 */
export function ConnectionsSection({
  source, id, references, onOpen,
}: {
  source: RefSource;
  id: string;
  references: GalleryReference[];
  /** Try to open another entry's detail; returns false when it isn't on the shelves */
  onOpen?: (source: RefSource, id: string) => boolean;
}) {
  const connections = connectionsFor(references, source, id);
  if (connections.length === 0) return null;

  return (
    <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Link2 className="size-3" /> Connections
      </p>
      {connections.map(c => (
        <div key={c.reference.id} className="space-y-0.5">
          <p className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{c.phrase}</span>
            {onOpen ? (
              <button
                onClick={() => onOpen(c.otherSource, c.otherId)}
                className="font-medium text-left hover:underline"
              >
                {c.otherTitle}
              </button>
            ) : (
              <span className="font-medium">{c.otherTitle}</span>
            )}
            {c.otherKind && (
              <Badge variant="outline" className="text-[9px]">{c.otherKind}</Badge>
            )}
            {c.reference.status === 'suggested' && (
              <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-600/40">
                suggested
              </Badge>
            )}
          </p>
          {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
        </div>
      ))}
    </div>
  );
}
