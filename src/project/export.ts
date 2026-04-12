import JSZip from 'jszip';
import type { FileEntry } from './virtual-fs';

/** Generate a .reltech.yml manifest for the project */
function generateManifest(projectName: string): string {
  return [
    'project:',
    `  name: "${projectName}"`,
    '  description: "Built with Relational Builder"',
    '',
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
  ].join('\n');
}

/** Package project files into a downloadable zip */
export async function exportProjectZip(
  files: FileEntry[],
  projectName: string,
): Promise<Blob> {
  const zip = new JSZip();

  // Add all project files
  for (const file of files) {
    // Remove leading slash for zip paths
    const zipPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    zip.file(zipPath, file.content);
  }

  // Add .reltech.yml manifest
  zip.file('.reltech.yml', generateManifest(projectName));

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
