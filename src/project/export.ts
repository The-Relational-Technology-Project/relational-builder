import JSZip from 'jszip';
import type { FileEntry } from './virtual-fs';
import type { ProjectLineage } from '@/store/project-store';
import { buildEnvJs, type PublicEnvVar } from './env-module';

const yamlEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Generate a .reltech.yml manifest (spec version 2).
 * Lineage keeps the chain of credit unbroken when a project starts from a
 * Studio build plan or a commons remix — the network watcher surfaces it.
 */
export function generateManifest(projectName: string, lineage?: ProjectLineage | null): string {
  const lines = [
    '# .reltech.yml — see github.com/The-Relational-Technology-Project/watcher',
    'version: 2',
    '',
    'project:',
    `  name: "${yamlEscape(projectName)}"`,
    '  description: "Built with Relational Builder"',
    '',
  ];

  if (lineage?.source) {
    lines.push('lineage:');
    if (lineage.planTitle) {
      lines.push(`  remixed_from: "${yamlEscape(lineage.planTitle)}"`);
    }
    if (lineage.sourceUrl) {
      lines.push(`  remixed_from_url: "${yamlEscape(lineage.sourceUrl)}"`);
    }
    const noteBits =
      lineage.source === 'rtp-studio-plan'
        ? 'Started from an RTP Studio build plan'
        : 'Remixed from a relational tech commons project';
    const dateBit = lineage.importedAt ? ` on ${lineage.importedAt.slice(0, 10)}` : '';
    lines.push(`  note: "${yamlEscape(`${noteBits}${dateBit}, built with Relational Builder.`)}"`);
    lines.push('');
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
): Promise<Blob> {
  const zip = new JSZip();

  // Add all project files
  for (const file of files) {
    // Remove leading slash for zip paths
    const zipPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    zip.file(zipPath, file.content);
  }

  // Public env vars ship as env.js so apps work outside the builder
  // (public = safe for the browser by definition; secrets never go here)
  if (publicEnvVars && publicEnvVars.length > 0 && !files.some(f => f.path.replace(/^\//, '') === 'env.js')) {
    zip.file('env.js', buildEnvJs(publicEnvVars));
  }

  // Add .reltech.yml manifest
  zip.file('.reltech.yml', generateManifest(projectName, lineage));

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
