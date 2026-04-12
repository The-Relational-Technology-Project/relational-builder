/**
 * Share preview via CodeSandbox.
 *
 * POSTs project files to the CodeSandbox define API (no auth required).
 * Returns a clean preview URL ({id}.csb.app) for sharing with neighbors
 * and an editor URL for developers who want to explore the code.
 */

import type { FileEntry } from './virtual-fs';

const DEFINE_API = 'https://codesandbox.io/api/v1/sandboxes/define';

interface ShareResult {
  /** Clean preview URL — just the running app, no IDE */
  previewUrl: string;
  /** Editor URL — full CodeSandbox IDE with code */
  editorUrl: string;
  sandboxId: string;
}

/**
 * Detect the right CodeSandbox template based on file extensions.
 */
function detectTemplate(files: FileEntry[]): string {
  const paths = files.map(f => f.path);
  if (paths.some(p => p.endsWith('.tsx'))) return 'react-ts';
  if (paths.some(p => p.endsWith('.jsx'))) return 'react';
  if (paths.some(p => p === '/index.html')) return 'static';
  return 'vanilla';
}

/**
 * Build the CodeSandbox files payload from VFS entries.
 * CodeSandbox expects { "files": { "path": { "content": "..." } } }
 */
function buildPayload(files: FileEntry[]) {
  const csFiles: Record<string, { content: string }> = {};

  for (const file of files) {
    // CodeSandbox paths don't have leading slash
    const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    csFiles[path] = { content: file.content };
  }

  // Ensure package.json exists — CodeSandbox needs it for React templates
  if (!csFiles['package.json']) {
    const template = detectTemplate(files);
    const deps: Record<string, string> = {};

    if (template === 'react-ts' || template === 'react') {
      deps['react'] = '^18.2.0';
      deps['react-dom'] = '^18.2.0';
    }

    csFiles['package.json'] = {
      content: JSON.stringify(
        {
          name: 'relational-builder-preview',
          private: true,
          dependencies: deps,
        },
        null,
        2,
      ),
    };
  }

  return csFiles;
}

/**
 * Create a shareable preview by posting to CodeSandbox.
 * No authentication required.
 */
export async function createPreviewLink(files: FileEntry[]): Promise<ShareResult> {
  if (files.length === 0) {
    throw new Error('No files to share');
  }

  const csFiles = buildPayload(files);

  const res = await fetch(`${DEFINE_API}?json=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: csFiles }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create preview: ${text}`);
  }

  const data = await res.json();
  const sandboxId: string = data.sandbox_id;

  return {
    previewUrl: `https://${sandboxId}.csb.app`,
    editorUrl: `https://codesandbox.io/s/${sandboxId}`,
    sandboxId,
  };
}
