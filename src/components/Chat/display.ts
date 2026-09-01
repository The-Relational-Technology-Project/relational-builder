import { stripProjectNameMarker } from '@/project/suggest-name';
import { normalizeFenceFilenames } from '@/project/code-extractor';

/** A deliberately chunked build reply ends with this marker line (the system
 *  prompt teaches it). Streams through the community proxy get killed by a
 *  ~400s wall clock — two real builds died mid-file at exactly +6:42 — so
 *  large builds now stop cleanly between files and continue on purpose,
 *  instead of streaming into the wall and paying a mid-file recovery. */
export const CHUNK_MARKER = /^NEXT-FILES:\s*(\S.*)$/m;

/** A reply ends with this marker to ask the Builder for files whose contents
 *  the snapshot omitted (the snapshot header teaches it). The Builder answers
 *  with the full contents automatically — the person never copy-pastes code
 *  out of the Files tab to bridge the model's context. */
export const FILE_REQUEST_MARKER = /^NEED-FILES:\s*(\S.*)$/m;

/** Remove NEXT-FILES / NEED-FILES marker lines from a reply for display —
 *  markers are machinery between the Builder and the model, not something
 *  to read. */
export function stripChunkMarker(content: string): string {
  return content.replace(/^(?:NEXT|NEED)-FILES:[^\n]*$\n?/gm, '');
}

/**
 * Everything a chat bubble strips or folds before ReactMarkdown sees it.
 *
 * Display-only, by design: stored message content keeps every marker.
 * Chunk continuation (ChatPanel tests CHUNK_MARKER against stored content)
 * and history collapse (collapseFileBlocks) both read the raw text — a strip
 * that leaked into storage would break the continuation chain.
 */
export function renderableContent(content: string): string {
  return normalizeFenceFilenames(stripChunkMarker(stripProjectNameMarker(content)));
}
