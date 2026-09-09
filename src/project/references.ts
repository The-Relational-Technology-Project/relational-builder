import { useReferencesStore, type ReferenceDoc, type ReferenceKind } from '@/store/references-store';
import { useAuthStore } from '@/store/auth-store';

/**
 * Adding a reference document: extract its text in the browser and keep it
 * in the references store. The text — never the file — is what the model
 * reads, and it works the same for every provider (Claude's native PDF
 * blocks would not survive the proxy's OpenAI-format translation or the
 * community fallback models). Nothing here touches the project files.
 */

/** Largest original file accepted — a scanned brochure can hit this */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Stored text per document. ~50k tokens: room for a long report, while a
 *  runaway extraction (a data dump saved as PDF) can't swamp the project. */
export const MAX_REFERENCE_CHARS = 200_000;

const ACCEPTED: Record<string, ReferenceKind> = {
  pdf: 'pdf',
  docx: 'docx',
  md: 'md',
  markdown: 'md',
  txt: 'txt',
};

/** The accept attribute for the file picker */
export const REFERENCE_ACCEPT = '.pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain';

export function referenceKindFor(file: File): ReferenceKind | null {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (ACCEPTED[ext]) return ACCEPTED[ext];
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (file.type === 'text/markdown') return 'md';
  if (file.type === 'text/plain') return 'txt';
  return null;
}

export function isReferenceFile(file: File): boolean {
  return referenceKindFor(file) !== null;
}

/** Collapse the whitespace noise extraction leaves behind without touching
 *  paragraph structure: runs of spaces to one, three+ newlines to two. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+\n/g, '\n')
    .replace(/[ \t\u00a0]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(file: File): Promise<{ text: string; pages: number }> {
  // Loaded on demand — pdf.js is a megabyte the app never needs until a
  // PDF shows up. The worker ships as its own asset (Vite's ?url import).
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  let chars = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Items carry their own line breaks (hasEOL) — honor them so headings
    // and list items don't run together
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      } else if (item.str && !item.str.endsWith(' ')) {
        line += ' ';
      }
    }
    if (line) lines.push(line);
    const pageText = lines.join('\n').trim();
    parts.push(pageText ? `[page ${i}]\n${pageText}` : `[page ${i}]`);
    chars += pageText.length;
    page.cleanup();
    // Enough text stored already — later pages would only be cut anyway
    if (chars > MAX_REFERENCE_CHARS * 1.2) break;
  }
  const pages = pdf.numPages;
  await loadingTask.destroy();
  // A scanned PDF has pages but no text layer. Say so instead of storing
  // a reference the model can't read anything from.
  if (chars < 40 * Math.min(pages, 3)) {
    throw new Error(
      'This PDF has no selectable text — it looks scanned. Run it through OCR (most scanners and Preview/Acrobat can), or paste the text into a .txt file.',
    );
  }
  return { text: parts.join('\n\n'), pages };
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (!result.value.trim()) {
    throw new Error('No text found in that document — is it empty, or an older .doc file? Save it as .docx or .txt and try again.');
  }
  return result.value;
}

/** Extract a document's text. Exposed for tests and for anything that wants
 *  the text without storing it. */
export async function extractReferenceText(
  file: File,
): Promise<{ text: string; kind: ReferenceKind; pages?: number; truncated: boolean }> {
  const kind = referenceKindFor(file);
  if (!kind) throw new Error('Add a PDF, Word document (.docx), Markdown, or plain text file.');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`That file is ${Math.round(file.size / 1024 / 1024)} MB — references are capped at ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  let text: string;
  let pages: number | undefined;
  if (kind === 'pdf') {
    ({ text, pages } = await extractPdf(file));
  } else if (kind === 'docx') {
    text = await extractDocx(file);
  } else {
    text = await file.text();
  }
  text = tidy(text);
  if (!text) throw new Error('That file has no text in it.');
  const truncated = text.length > MAX_REFERENCE_CHARS;
  if (truncated) text = text.slice(0, MAX_REFERENCE_CHARS);
  return { text, kind, pages, truncated };
}

/** Extract and store. Returns the stored document. */
export async function addReferenceDoc(file: File): Promise<ReferenceDoc> {
  const { text, kind, pages, truncated } = await extractReferenceText(file);
  const { profile, user } = useAuthStore.getState();
  const addedBy = profile?.display_name?.trim() || user?.email || undefined;
  return useReferencesStore.getState().addDoc({
    name: file.name,
    kind,
    text,
    truncated,
    bytes: file.size,
    ...(pages ? { pages } : {}),
    ...(addedBy ? { addedBy } : {}),
  });
}

/** Rough word count for the panel and the prompt's one-line summaries */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
