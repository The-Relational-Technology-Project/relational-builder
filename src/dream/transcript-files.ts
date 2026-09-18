/**
 * Reading a transcript someone already has: the text a phone's voice memo
 * app produced, a Zoom/Otter/Granola export, notes typed on the train
 * home. Text formats read directly; Word and PDF go through the same
 * extractor the builder's reference documents use. Caption files (VTT,
 * SRT) are rewritten into Dream Recorder's own "[m:ss] …" lines so the
 * distill prompt can follow the arc of time the same way it does for a
 * live session.
 */

import { extractReferenceText, referenceKindFor } from '@/project/references';

/** The accept attribute for the transcript picker */
export const TRANSCRIPT_ACCEPT =
  '.txt,.md,.markdown,.vtt,.srt,.docx,.pdf,text/plain,text/markdown,text/vtt,application/x-subrip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Files that hold a spoken conversation as text (as opposed to audio) */
export function isTranscriptFile(file: File): boolean {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  return ext === 'vtt' || ext === 'srt' || referenceKindFor(file) !== null;
}

/** "00:12:40.500" / "12:40,500" → seconds */
function parseStamp(raw: string): number | null {
  const m = raw.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function stamp(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Caption cues → "[m:ss] text" lines; cue numbering and styling stripped */
export function captionsToTranscript(raw: string): string {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let pendingStart: number | null = null;
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) out.push(pendingStart === null ? text : `[${stamp(pendingStart)}] ${text}`);
    buffer = [];
    pendingStart = null;
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (/^WEBVTT/.test(trimmed) || /^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue;
    const arrow = trimmed.match(/^(\S+)\s+-->\s+(\S+)/);
    if (arrow) {
      flush();
      pendingStart = parseStamp(arrow[1]);
      continue;
    }
    if (/^\d+$/.test(trimmed) && buffer.length === 0 && pendingStart === null) continue; // SRT cue index
    buffer.push(trimmed);
  }
  flush();
  return out.join('\n');
}

/** The transcript text of a file, in a shape the distill prompt reads well */
export async function readTranscriptFile(file: File): Promise<string> {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (ext === 'vtt' || ext === 'srt') {
    const text = captionsToTranscript(await file.text());
    if (!text) throw new Error('That caption file has no text in it.');
    return text;
  }
  const { text } = await extractReferenceText(file);
  return text;
}
