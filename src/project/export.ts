import JSZip from 'jszip';
import type { FileEntry } from './virtual-fs';
import type { ProjectLineage } from '@/store/project-store';
import { buildEnvJs, type PublicEnvVar } from './env-module';
import { isBinaryFilePath } from './app-icon';

const yamlEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Generate a .reltech.yml manifest (spec version 2).
 * Lineage keeps the chain of credit unbroken when a project starts from a
 * Studio build plan or a commons remix — the network watcher surfaces it.
 */
export function generateManifest(
  projectName: string,
  lineage?: ProjectLineage | null,
  buildPrompt?: { title: string; body: string } | null,
): string {
  const lines = [
    '# .reltech.yml — see github.com/The-Relational-Technology-Project/watcher',
    'version: 2',
    '',
    'project:',
    `  name: "${yamlEscape(projectName)}"`,
    '  description: "Built with Relational Builder"',
    '',
  ];

  if (lineage?.source || lineage?.studioSlug) {
    lines.push('lineage:');
    if (lineage.planTitle) {
      lines.push(`  remixed_from: "${yamlEscape(lineage.planTitle)}"`);
    }
    if (lineage.promptTitle) {
      lines.push(`  grown_from_prompt: "${yamlEscape(lineage.promptTitle)}"`);
      if (lineage.promptSlug) {
        lines.push(`  grown_from_prompt_id: "${yamlEscape(lineage.promptSlug)}"`);
      }
    }
    if (lineage.sourceUrl) {
      lines.push(`  remixed_from_url: "${yamlEscape(lineage.sourceUrl)}"`);
    }
    if (lineage.studioSlug) {
      lines.push(`  studio: "${yamlEscape(lineage.studioSlug)}"`);
      if (lineage.studioLabel) {
        lines.push(`  studio_name: "${yamlEscape(lineage.studioLabel)}"`);
      }
    }
    if (lineage.source) {
      const noteBits =
        lineage.source === 'rtp-studio-plan'
          ? 'Started from an RTP Studio build plan'
          : lineage.source === 'prompt'
            ? 'Grown from a shared build prompt'
            : lineage.source === 'repo-import'
              ? 'Imported from its own existing repo'
              : lineage.source === 'dream'
                ? 'Began as a spoken conversation, distilled by Dream Recorder'
                : 'Remixed from a relational tech commons project';
      const dateBit = lineage.importedAt ? ` on ${lineage.importedAt.slice(0, 10)}` : '';
      lines.push(`  note: "${yamlEscape(`${noteBits}${dateBit}, built with Relational Builder.`)}"`);
    } else if (lineage.studioLabel) {
      lines.push(`  note: "${yamlEscape(`Built within ${lineage.studioLabel}, with Relational Builder.`)}"`);
    }
    lines.push('');
  }

  // The prompt travels with the code: anyone holding this repo can grow a
  // fresh version of the app — new models, their place, their aesthetics
  if (buildPrompt?.body) {
    lines.push(
      'prompt:',
      `  title: "${yamlEscape(buildPrompt.title)}"`,
      '  body: |',
      ...buildPrompt.body.split('\n').map(l => `    ${l}`),
      '',
    );
  }

  lines.push(
    'tags:',
    '  - community-tool',
    '',
    'watch:',
    '  branches: ["main"]',
    '  signals: ["releases", "prs", "commits"]',
    '  threshold: "minor"',
    '',
    'preferences:',
    '  summarize_commits: true',
    '  public_link: true',
    '',
  );

  return lines.join('\n');
}

/** Package project files into a downloadable zip */
export async function exportProjectZip(
  files: FileEntry[],
  projectName: string,
  lineage?: ProjectLineage | null,
  publicEnvVars?: PublicEnvVar[],
  buildPrompt?: { title: string; body: string } | null,
): Promise<Blob> {
  const zip = new JSZip();

  // Add all project files
  for (const file of files) {
    // Remove leading slash for zip paths
    const zipPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    // Binary files (e.g. generated home-screen icons) live in the text-only
    // VFS as base64 — decode them into real bytes in the zip
    if (isBinaryFilePath(zipPath)) {
      zip.file(zipPath, file.content, { base64: true });
    } else {
      zip.file(zipPath, file.content);
    }
  }

  // Public env vars ship as env.js so apps work outside the builder
  // (public = safe for the browser by definition; secrets never go here)
  if (publicEnvVars && publicEnvVars.length > 0 && !files.some(f => f.path.replace(/^\//, '') === 'env.js')) {
    zip.file('env.js', buildEnvJs(publicEnvVars));
  }

  // Add .reltech.yml manifest
  zip.file('.reltech.yml', generateManifest(projectName, lineage, buildPrompt));

  // Add a basic README
  zip.file(
    'README.md',
    [
      `# ${projectName}`,
      '',
      'Built with [Relational Builder](https://github.com/The-Relational-Technology-Project/relational-builder).',
      '',
      '## Join the Network',
      '',
      'This project includes a `.reltech.yml` manifest. To share it with the relational tech community:',
      '',
      '1. Push this code to a GitHub repository',
      '2. Add the `relational-tech` topic to your repo',
      '3. Your project will appear on [updates.relationaltechproject.org](https://updates.relationaltechproject.org)',
      '',
    ].join('\n'),
  );

  return zip.generateAsync({ type: 'blob' });
}

/** Trigger a browser download of a blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
