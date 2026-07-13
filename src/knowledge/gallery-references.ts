/**
 * Gallery connections — cross-references between gallery entries, wherever
 * they live: KB tools and stories (RT Studio project), commons items (RT
 * Commons project), and studio library items (Builder backend). The rows
 * live in the Builder backend's gallery_references table because it's the
 * only backend this app can migrate; entries are addressed by (source, id)
 * with titles denormalized onto the link.
 *
 * One row links two entries and reads in both directions — a story that
 * mentions a tool is also the tool's "mentioned in". This module is the
 * pure half (types + direction-aware helpers) so the context builder can
 * use it without importing from cloud/; fetching and steward writes live
 * in src/cloud/gallery-references.ts.
 */

export type RefSource = 'kb_tool' | 'kb_story' | 'commons' | 'studio';
export type RefRelation = 'mentions' | 'used_in' | 'paired_with' | 'related';
export type RefStatus = 'suggested' | 'confirmed';

export interface GalleryReference {
  id: string;
  from_source: RefSource;
  /** uuid for kb_tool/kb_story/studio; slug for commons */
  from_id: string;
  from_title: string;
  from_kind: string | null;
  to_source: RefSource;
  to_id: string;
  to_title: string;
  to_kind: string | null;
  relation: RefRelation;
  note: string | null;
  status: RefStatus;
}

export function refKey(source: RefSource, id: string): string {
  return `${source}:${id}`;
}

/** A reference seen from one of its two entries' point of view */
export interface EntryConnection {
  reference: GalleryReference;
  /** Relationship phrase from this entry's side ("mentioned in", "pairs with") */
  phrase: string;
  otherSource: RefSource;
  otherId: string;
  otherTitle: string;
  otherKind: string | null;
  note: string | null;
}

// How each relation reads from the from-side and the to-side of the link
const PHRASES: Record<RefRelation, [fromSide: string, toSide: string]> = {
  mentions: ['mentions', 'mentioned in'],
  used_in: ['used in', 'features'],
  paired_with: ['pairs with', 'pairs with'],
  related: ['related to', 'related to'],
};

function fromSideOf(ref: GalleryReference): EntryConnection {
  return {
    reference: ref,
    phrase: PHRASES[ref.relation]?.[0] ?? 'related to',
    otherSource: ref.to_source,
    otherId: ref.to_id,
    otherTitle: ref.to_title,
    otherKind: ref.to_kind,
    note: ref.note,
  };
}

function toSideOf(ref: GalleryReference): EntryConnection {
  return {
    reference: ref,
    phrase: PHRASES[ref.relation]?.[1] ?? 'related to',
    otherSource: ref.from_source,
    otherId: ref.from_id,
    otherTitle: ref.from_title,
    otherKind: ref.from_kind,
    note: ref.note,
  };
}

/** Every connection touching one entry, both directions */
export function connectionsFor(
  references: GalleryReference[],
  source: RefSource,
  id: string,
): EntryConnection[] {
  const out: EntryConnection[] = [];
  for (const ref of references) {
    if (ref.from_source === source && ref.from_id === id) out.push(fromSideOf(ref));
    else if (ref.to_source === source && ref.to_id === id) out.push(toSideOf(ref));
  }
  return out;
}

/** Connections indexed by entry key — for prompt building over many items */
export function connectionIndex(references: GalleryReference[]): Map<string, EntryConnection[]> {
  const index = new Map<string, EntryConnection[]>();
  const push = (key: string, conn: EntryConnection) => {
    const list = index.get(key);
    if (list) list.push(conn);
    else index.set(key, [conn]);
  };
  for (const ref of references) {
    push(refKey(ref.from_source, ref.from_id), fromSideOf(ref));
    push(refKey(ref.to_source, ref.to_id), toSideOf(ref));
  }
  return index;
}
