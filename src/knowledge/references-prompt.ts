import { referencePath, type ReferenceDoc } from '@/store/references-store';

/**
 * Reference documents in the prompt. They ride in the cacheable half (the
 * snapshot segment — see context-builder), so a long document costs its
 * cache write once and cache reads after. The budget decides which appear
 * in full: anything the assistant asked for by NEED-FILES first, then the
 * newest; the rest get a one-line summary with an opening excerpt and the
 * path to ask for.
 */

/** A document at or under this many characters appears in full by default */
const INLINE_DOC_CHARS = 30_000;
/** Total characters of full text across all documents (before requests) */
const INLINE_TOTAL_CHARS = 120_000;
/** Opening excerpt on a summarized document */
const EXCERPT_CHARS = 400;

const KIND_LABEL: Record<ReferenceDoc['kind'], string> = {
  pdf: 'PDF',
  docx: 'Word document',
  md: 'Markdown',
  txt: 'Text',
};

/** Documents the assistant asked to read in full (NEED-FILES). Once asked,
 *  a document stays in full for the rest of the session — the prompt
 *  segment rewrites once and caches from there. Paths embed the document
 *  id, so a stale entry from another project matches nothing. */
let requestedPaths = new Set<string>();

export function markReferenceDocsRequested(paths: string[]): void {
  for (const p of paths) requestedPaths.add(p);
}

/** Test/reset hook */
export function resetReferenceRequests(): void {
  requestedPaths = new Set();
}

function words(text: string): string {
  const n = text.split(/\s+/).filter(Boolean).length;
  return n >= 1000 ? `~${(Math.round(n / 100) / 10).toLocaleString()}k words` : `~${n} words`;
}

function describe(doc: ReferenceDoc): string {
  const bits = [KIND_LABEL[doc.kind]];
  if (doc.pages) bits.push(`${doc.pages} page${doc.pages === 1 ? '' : 's'}`);
  bits.push(words(doc.text));
  if (doc.truncated) bits.push('stored text cut at the cap');
  return bits.join(', ');
}

function excerpt(text: string): string {
  const head = text.slice(0, EXCERPT_CHARS).replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_CHARS ? `${head}…` : head;
}

export function formatReferenceDocsForPrompt(docs: ReferenceDoc[]): string {
  if (docs.length === 0) return '';

  // Full text: requested first (asked beats everything), then newest, until
  // the budget runs out. Requested documents are never budgeted out.
  const inFull = new Set<string>();
  let left = INLINE_TOTAL_CHARS;
  const ordered = [...docs].sort((a, b) => {
    const req = (requestedPaths.has(referencePath(b)) ? 1 : 0) - (requestedPaths.has(referencePath(a)) ? 1 : 0);
    return req !== 0 ? req : b.addedAt - a.addedAt;
  });
  for (const doc of ordered) {
    const path = referencePath(doc);
    if (requestedPaths.has(path)) {
      inFull.add(path);
      continue;
    }
    if (doc.text.length <= INLINE_DOC_CHARS && doc.text.length <= left) {
      inFull.add(path);
      left -= doc.text.length;
    }
  }
  const anySummarized = docs.some(d => !inFull.has(referencePath(d)));

  const sections: string[] = [
    '## Reference Documents the Builder Shared',
    '',
    'The builder added these documents for you to read — background for planning and building, in their words and their community\'s. Draw on them for the real names, dates, places, program details, constraints, and voice instead of inventing any of it. They are NOT app files: never output a reference document as a file, never paste one wholesale into the app, and never say you cannot open one — its text is right here. Quote briefly when the exact wording matters. Documents often name real people; keep personal details out of anything that gets published unless the builder asks for them.',
  ];
  if (anySummarized) {
    sections.push(
      '',
      'A long document appears below as a summary line with its opening. To read one in full, end your reply with a single NEED-FILES line naming its path — the same way you ask for project files — for example',
      '',
      '  `NEED-FILES: /references/grant-proposal-3f2a1b.pdf`',
      '',
      'then stop; the Builder sends the full text automatically and asks you to continue. Never ask the person to paste a document in.',
    );
  }
  sections.push('');

  // Emit in added order — stable across turns, so the segment caches
  for (const doc of docs) {
    const path = referencePath(doc);
    const added = new Date(doc.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const by = doc.addedBy ? `, added ${added} by ${doc.addedBy}` : `, added ${added}`;
    if (inFull.has(path)) {
      sections.push(`### ${path} — "${doc.name}" (${describe(doc)}${by})`, '', '```', doc.text, '```', '');
    } else {
      sections.push(
        `- ${path} — "${doc.name}" (${describe(doc)}${by}; full text omitted — ask with a NEED-FILES line). Opens: "${excerpt(doc.text)}"`,
      );
    }
  }
  return sections.join('\n').trimEnd();
}
