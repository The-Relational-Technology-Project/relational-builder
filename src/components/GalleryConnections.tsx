import { useState } from 'react';
import {
  connectionsFor,
  RELATION_LABELS,
  type GalleryReference,
  type RefRelation,
  type RefSource,
} from '@/knowledge/gallery-references';
import { adminAddReference, adminRemoveReference } from '@/cloud/gallery-references';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Loader2, Plus, X } from 'lucide-react';

/** An entry that can be offered as the other end of a connection */
export interface ConnectableEntry {
  source: RefSource;
  id: string;
  title: string;
  kind: string | null;
  /** Shelf name for the picker's optgroup */
  group: string;
}

/** Present when the viewer is the steward: curate connections in place */
export interface ConnectionsCuration {
  options: ConnectableEntry[];
  /** Called after any add/remove so the parent refetches references */
  onChanged: () => void;
}

/**
 * The connections block inside a gallery detail dialog: every entry this one
 * references and every entry that references it, with the note that says why
 * the pairing mattered. Entries still on the shelves are click-through;
 * anything the viewer can't currently see (e.g. another studio's private
 * item) renders as plain text. For the steward the block is also the place
 * to correct the record — remove a wrong link, add a missing one — right
 * where the connection is seen in context.
 */
export function ConnectionsSection({
  source, id, title, kind, references, onOpen, curation,
}: {
  source: RefSource;
  id: string;
  /** This entry's own title/kind — denormalized onto links the steward adds */
  title: string;
  kind?: string | null;
  references: GalleryReference[];
  /** Try to open another entry's detail; returns false when it isn't on the shelves */
  onOpen?: (source: RefSource, id: string) => boolean;
  curation?: ConnectionsCuration;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toKey, setToKey] = useState('');
  const [relation, setRelation] = useState<RefRelation>('related');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connections = connectionsFor(references, source, id);
  if (connections.length === 0 && !curation) return null;

  const optionKey = (o: { source: RefSource; id: string }) => `${o.source}:${o.id}`;
  const options = (curation?.options ?? []).filter(o => optionKey(o) !== `${source}:${id}`);
  const groups = new Map<string, ConnectableEntry[]>();
  for (const o of options) groups.set(o.group, [...(groups.get(o.group) ?? []), o]);

  async function remove(refId: string) {
    setBusyId(refId);
    setError(null);
    try {
      await adminRemoveReference(refId);
      curation?.onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the connection');
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    const to = options.find(o => optionKey(o) === toKey);
    if (!to) return;
    setSaving(true);
    setError(null);
    try {
      await adminAddReference({
        from_source: source, from_id: id, from_title: title, from_kind: kind ?? null,
        to_source: to.source, to_id: to.id, to_title: to.title, to_kind: to.kind,
        relation, note: note.trim() || null,
      });
      setToKey(''); setNote(''); setAdding(false);
      curation?.onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the connection');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Link2 className="size-3" /> Connections
        {curation && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-primary hover:underline"
          >
            <Plus className="size-3" /> Add
          </button>
        )}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {connections.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">
          Nothing linked here yet — connect it to the tools, stories, and
          practices it belongs with.
        </p>
      )}

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
            {curation && (
              <button
                disabled={busyId !== null}
                onClick={() => remove(c.reference.id)}
                className="text-muted-foreground hover:text-destructive"
                title="Remove connection"
              >
                {busyId === c.reference.id
                  ? <Loader2 className="size-3 animate-spin" />
                  : <X className="size-3" />}
              </button>
            )}
          </p>
          {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
        </div>
      ))}

      {curation && adding && (
        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={relation}
              onChange={e => setRelation(e.target.value as RefRelation)}
              className="h-8 rounded-md border bg-background px-2 text-xs shrink-0"
            >
              {RELATION_LABELS.map(r => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <select
              value={toKey}
              onChange={e => setToKey(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs min-w-0 flex-1"
            >
              <option value="">Choose an entry…</option>
              {[...groups.entries()].map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map(o => (
                    <option key={optionKey(o)} value={optionKey(o)}>{o.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Why the pairing mattered (optional)"
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" className="h-8 text-xs shrink-0" disabled={saving || !toKey} onClick={add}>
              {saving ? <Loader2 className="size-3 animate-spin mr-1" /> : <Link2 className="size-3 mr-1" />}
              Connect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs shrink-0"
              onClick={() => { setAdding(false); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
