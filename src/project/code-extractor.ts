/**
 * Extracts file operations from AI-generated markdown responses.
 *
 * Supports these patterns for associating filenames with code blocks:
 *
 * 1. Fence info string with filename:
 *    ```tsx filename="src/App.tsx"
 *    ```tsx title="src/App.tsx"
 *    ```tsx file="src/App.tsx"
 *
 * 2. Filename path on the line immediately before the fence:
 *    `src/App.tsx`:
 *    ```tsx
 *
 * 3. Filename in backticks on preceding line:
 *    Here's `src/App.tsx`:
 *    ```tsx
 */

export interface ExtractedFile {
  path: string;
  content: string;
  language: string;
}

/** One search/replace pair inside an edit block */
export interface FileEdit {
  search: string;
  replace: string;
}

/** A targeted edit to an existing file (```edit filename="...") */
export interface ExtractedEdit {
  path: string;
  edits: FileEdit[];
}

export interface ExtractionResult {
  writes: ExtractedFile[];
  edits: ExtractedEdit[];
  /** Path of a final block whose fence never closed (the stream was cut off
   * mid-file) — excluded from writes/edits: applying half a file breaks the
   * preview worse than waiting for the continuation to re-send it whole. */
  truncatedPath?: string;
}

/** Extract all file blocks from a complete markdown string (writes only) */
export function extractFiles(markdown: string): ExtractedFile[] {
  return extractOperations(markdown).writes;
}

/**
 * Extract both whole-file writes and targeted edit blocks.
 * Edit blocks use the fence language `edit` and contain one or more
 * SEARCH/REPLACE pairs (`<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE`).
 */
export function extractOperations(markdown: string): ExtractionResult {
  const writes: ExtractedFile[] = [];
  const edits: ExtractedEdit[] = [];
  let truncatedPath: string | undefined;
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(\w*)\s*(.*)?$/);

    if (fenceMatch) {
      const language = fenceMatch[1] || 'text';
      const fenceArgs = fenceMatch[2] || '';

      // Collect code block content
      const openIndex = i;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // Reaching end-of-input without a closing fence = the reply was cut off
      // inside this block
      const closed = i < lines.length;
      // Skip closing fence
      i++;

      const content = codeLines.join('\n');
      // Skip empty code blocks
      if (!content.trim()) continue;

      // Try to find filename. Anchor on THIS fence: lines.indexOf(line) finds
      // the first line with the same text, so a second plain ```ts fence read
      // the wrong preceding lines and its file was silently dropped — a lost
      // file costs a whole recovery pass.
      const filename =
        parseFilenameFromFenceArgs(fenceArgs) ??
        parseFilenameFromPrecedingLines(lines, openIndex);

      if (!filename) continue;

      if (!closed) {
        truncatedPath = filename;
        continue;
      }

      if (language === 'edit') {
        const pairs = parseEditPairs(content);
        if (pairs.length > 0) edits.push({ path: filename, edits: pairs });
      } else {
        writes.push({ path: filename, content, language });
      }
    } else {
      // A fence opener glued to the end of a prose line ("…the shell.```html
      // filename=\"index.html\"") hides the block from this line-anchored scan
      // AND inverts fence parity for the rest of the reply — every file in the
      // segment is silently lost (Kimi K3 writes fences this way). Split it
      // back onto its own line; only a fence carrying an explicit file
      // annotation is unambiguous enough to treat as an opener.
      const glued = line.match(/^(.*\S)\s*(```\w*\s+(?:filename|title|file)=.*)$/);
      if (glued) {
        lines.splice(i, 1, glued[1], glued[2]);
        continue;
      }
      i++;
    }
  }

  return { writes, edits, truncatedPath };
}

/** Parse SEARCH/REPLACE pairs out of an edit block's body */
function parseEditPairs(content: string): FileEdit[] {
  const pairs: FileEdit[] = [];
  const lines = content.split('\n');
  let mode: 'idle' | 'search' | 'replace' = 'idle';
  let search: string[] = [];
  let replace: string[] = [];

  for (const line of lines) {
    if (/^<{5,}\s*SEARCH\s*$/.test(line.trim())) {
      mode = 'search';
      search = [];
      replace = [];
    } else if (/^={5,}\s*$/.test(line.trim()) && mode === 'search') {
      mode = 'replace';
    } else if (/^>{5,}\s*REPLACE\s*$/.test(line.trim()) && mode === 'replace') {
      pairs.push({ search: search.join('\n'), replace: replace.join('\n') });
      mode = 'idle';
    } else if (mode === 'search') {
      search.push(line);
    } else if (mode === 'replace') {
      replace.push(line);
    }
  }

  return pairs;
}

/**
 * Apply search/replace edits to file content.
 * Tries an exact match first, then a whitespace-tolerant line match.
 * Returns the new content plus how many edits couldn't be applied.
 */
export function applyEdits(
  original: string,
  edits: FileEdit[],
): { content: string; failed: number } {
  let content = original;
  let failed = 0;

  for (const edit of edits) {
    if (edit.search && content.includes(edit.search)) {
      // Function replacement: a plain string here would have $&, $1 etc.
      // in AI-generated code interpreted as substitution patterns.
      content = content.replace(edit.search, () => edit.replace);
      continue;
    }

    // Whitespace-tolerant fallback: match a window of lines by trimmed equality
    const contentLines = content.split('\n');
    const searchLines = edit.search.split('\n');
    let matched = false;
    if (searchLines.length > 0 && edit.search.trim()) {
      for (let start = 0; start <= contentLines.length - searchLines.length; start++) {
        let ok = true;
        for (let j = 0; j < searchLines.length; j++) {
          if (contentLines[start + j].trim() !== searchLines[j].trim()) {
            ok = false;
            break;
          }
        }
        if (ok) {
          contentLines.splice(start, searchLines.length, ...edit.replace.split('\n'));
          content = contentLines.join('\n');
          matched = true;
          break;
        }
      }
    }
    if (!matched) failed++;
  }

  return { content, failed };
}

/**
 * Incrementally extract files from a growing markdown string.
 * Returns only newly completed file blocks since the last call.
 */
export class IncrementalExtractor {
  private lastProcessedLength = 0;
  private extractedPaths = new Set<string>();

  /** Process the current full markdown content and return new files */
  process(markdown: string): ExtractedFile[] {
    // Only re-extract if content has grown meaningfully
    if (markdown.length - this.lastProcessedLength < 10) return [];

    const allFiles = extractFiles(markdown);
    const newFiles = allFiles.filter(f => !this.extractedPaths.has(f.path));

    for (const file of newFiles) {
      this.extractedPaths.add(file.path);
    }

    // Also check for updated files (same path, different content)
    const updatedFiles = allFiles.filter(f => {
      if (this.extractedPaths.has(f.path)) {
        // Already seen this path — it's an update if content differs
        return false; // We'll handle updates on finalize
      }
      return false;
    });

    this.lastProcessedLength = markdown.length;
    return [...newFiles, ...updatedFiles];
  }

  /** Final extraction — returns all files (for when streaming completes) */
  finalize(markdown: string): ExtractedFile[] {
    this.lastProcessedLength = 0;
    this.extractedPaths.clear();
    return extractFiles(markdown);
  }

  reset(): void {
    this.lastProcessedLength = 0;
    this.extractedPaths.clear();
  }
}

/**
 * Replace filename-annotated code blocks with one-line placeholders, for
 * re-sending chat history to the model.
 *
 * Every send carries the recent conversation verbatim AND a Current Project
 * Files snapshot the instructions call authoritative — so a build reply's
 * code goes up twice, and a chunked build re-sends all of it on every pass.
 * A real 19-file build ran seven passes: by the end each request carried
 * ~3,500 lines of generated code in duplicate, and the duplicate half was
 * the largest line item on the bill. Collapsing history keeps what the
 * conversation is actually for — what was asked, what got built, what
 * changed — and drops the bytes the snapshot already carries.
 *
 * Only annotated blocks collapse. An illustrative snippet with no filename
 * never reached the project, so it isn't in the snapshot and it stays.
 */
export function collapseFileBlocks(markdown: string): string {
  if (!markdown.includes('```')) return markdown;

  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const fenceMatch = lines[i].match(/^```(\w*)\s*(.*)?$/);
    if (!fenceMatch) {
      out.push(lines[i]);
      i++;
      continue;
    }

    const language = fenceMatch[1] || 'text';
    const fenceArgs = fenceMatch[2] || '';
    const openIndex = i;
    const codeLines: string[] = [];
    i++;
    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    const closed = i < lines.length;
    i++; // skip the closing fence

    const filename =
      parseFilenameFromFenceArgs(fenceArgs) ??
      parseFilenameFromPrecedingLines(lines, openIndex);

    if (!filename) {
      out.push(lines[openIndex], ...codeLines);
      if (closed) out.push('```');
      continue;
    }

    // An unterminated block is a reply that was cut off mid-file — the
    // continuation re-outputs it whole, so the partial text is dead weight
    out.push(
      closed
        ? `⟨${language === 'edit' ? 'edit to' : 'file'} ${filename} — ${codeLines.length} lines, already applied to the project⟩`
        : `⟨file ${filename} — cut off mid-file after ${codeLines.length} lines⟩`,
    );
  }

  return out.join('\n');
}

/**
 * Rewrite fences for DISPLAY ONLY: fold a preceding-line filename into fence
 * meta (```tsx filename="src/App.tsx") and drop the bare label line above it,
 * so the chat card gets a real name instead of "tsx code" and the stray
 * `src/App.tsx`: line stops rendering as prose. Uses the same filename
 * resolution as extraction, so display and extraction can never disagree.
 *
 * Never applied to stored message content or anything sent to a model —
 * chunk continuation and history collapse read the raw content.
 */
export function normalizeFenceFilenames(markdown: string): string {
  if (!markdown.includes('```')) return markdown;

  const lines = markdown.split('\n');
  const dropped = new Set<number>();
  let i = 0;

  while (i < lines.length) {
    const fenceMatch = lines[i].match(/^```(\w*)\s*(.*)?$/);
    if (!fenceMatch) {
      i++;
      continue;
    }

    const openIndex = i;
    i++;
    while (i < lines.length && !lines[i].startsWith('```')) i++;
    i++; // past the closing fence (or end of input, mid-stream — only the opener is touched)

    if (parseFilenameFromFenceArgs(fenceMatch[2] || '')) continue;
    const filename = parseFilenameFromPrecedingLines(lines, openIndex);
    if (!filename) continue;

    // A bare language keeps remark's lang/meta split intact: with no lang,
    // filename="…" would be parsed as the language and the card would lose it
    lines[openIndex] = `\`\`\`${fenceMatch[1] || 'text'} filename="${filename}"`;

    // Drop the contributing line only when it's nothing BUT a label —
    // "Here's `src/App.tsx`:" keeps its sentence, only the fence is annotated
    for (let offset = 1; offset <= 2 && openIndex - offset >= 0; offset++) {
      const trimmed = lines[openIndex - offset].trim();
      if (!trimmed) continue;
      if (isBareLabelLine(trimmed, filename)) dropped.add(openIndex - offset);
      break;
    }
  }

  return dropped.size === 0
    ? lines.join('\n')
    : lines.filter((_, idx) => !dropped.has(idx)).join('\n');
}

/** The whole line is just the filename — plain, backticked, or bolded,
 *  with an optional trailing colon. */
function isBareLabelLine(trimmed: string, filename: string): boolean {
  const f = escapeRegExp(filename);
  return new RegExp(`^(?:\`${f}\`|\\*\\*${f}\\*\\*|${f})\\s*:?\\s*$`).test(trimmed);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Internal helpers ---

/** Parse filename from fence info string: ```tsx filename="src/App.tsx" */
function parseFilenameFromFenceArgs(args: string): string | null {
  // Match: filename="...", title="...", file="..."
  const match = args.match(/(?:filename|title|file)\s*=\s*"([^"]+)"/);
  if (match) return match[1];

  // Match: filename=src/App.tsx (no quotes)
  const noQuotes = args.match(/(?:filename|title|file)\s*=\s*(\S+)/);
  if (noQuotes) return noQuotes[1];

  return null;
}

/** Look at lines before the fence for a filename pattern */
function parseFilenameFromPrecedingLines(
  lines: string[],
  fenceIndex: number,
): string | null {
  // Check up to 2 lines before the fence
  for (let offset = 1; offset <= 2 && fenceIndex - offset >= 0; offset++) {
    const line = lines[fenceIndex - offset].trim();
    if (!line) continue; // skip blank lines

    // Pattern: `src/App.tsx`:  or  `src/App.tsx`
    const backtickMatch = line.match(/`([^`]+\.\w+)`\s*:?\s*$/);
    if (backtickMatch && looksLikeFilePath(backtickMatch[1])) {
      return backtickMatch[1];
    }

    // Pattern: src/App.tsx:  or  **src/App.tsx**:
    const boldMatch = line.match(/\*\*([^*]+\.\w+)\*\*\s*:?\s*$/);
    if (boldMatch && looksLikeFilePath(boldMatch[1])) {
      return boldMatch[1];
    }

    // Pattern: plain filepath at end of line: ... src/App.tsx:
    const plainMatch = line.match(/([\w./\-]+\.\w+)\s*:?\s*$/);
    if (plainMatch && looksLikeFilePath(plainMatch[1])) {
      return plainMatch[1];
    }

    // Only check the first non-blank line
    break;
  }

  return null;
}

/** Heuristic: does this string look like a file path? */
function looksLikeFilePath(s: string): boolean {
  // Must have at least one slash or a known extension
  if (s.includes('/')) return true;
  const ext = s.split('.').pop()?.toLowerCase();
  const knownExts = [
    'ts', 'tsx', 'js', 'jsx', 'html', 'css', 'json', 'md',
    'py', 'sql', 'yaml', 'yml', 'sh', 'env', 'svg', 'xml',
    'toml', 'lock', 'config',
  ];
  return knownExts.includes(ext ?? '');
}
