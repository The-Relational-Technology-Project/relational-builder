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

/** Extract all file blocks from a complete markdown string */
export function extractFiles(markdown: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^```(\w*)\s*(.*)?$/);

    if (fenceMatch) {
      const language = fenceMatch[1] || 'text';
      const fenceArgs = fenceMatch[2] || '';

      // Collect code block content
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // Skip closing fence
      i++;

      const content = codeLines.join('\n');
      // Skip empty code blocks
      if (!content.trim()) continue;

      // Try to find filename
      const filename =
        parseFilenameFromFenceArgs(fenceArgs) ??
        parseFilenameFromPrecedingLines(lines, lines.indexOf(line));

      if (filename) {
        files.push({ path: filename, content, language });
      }
    } else {
      i++;
    }
  }

  return files;
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
