import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildStaticSite } from '@/project/build-for-publish';
import type { FileEntry } from '@/project/virtual-fs';
import type { SessionResult } from './session';
import type { MechanicalResult } from './pipeline';

/**
 * Per-trial artifacts (gitignored — the run.json/report.md carry the durable
 * record):
 *   artifacts/<alias>-t<N>/transcript.md   full reply, segments marked
 *   artifacts/<alias>-t<N>/files/…         the generated project
 *   artifacts/<alias>-t<N>/preview.html    self-contained page via the SAME
 *                                          build publish ships (or the raw
 *                                          index.html for sandpack projects)
 */

function toEntries(files: Record<string, string>): FileEntry[] {
  const now = Date.now();
  return Object.entries(files).map(([p, content]) => ({
    path: p,
    content,
    language: 'text',
    createdAt: now,
    updatedAt: now,
  }));
}

export async function writeTrialArtifacts(
  runDir: string,
  taskId: string,
  alias: string,
  trial: number,
  planText: string | null,
  session: SessionResult,
  mech: MechanicalResult,
): Promise<string> {
  const rel = path.join('artifacts', taskId, `${alias}-t${trial}`);
  const dir = path.join(runDir, rel);
  await mkdir(dir, { recursive: true });

  const build = session.segmentTexts
    .map((t, i) => (i === 0 ? t : `\n\n---\n*[automatic continuation ${i}]*\n---\n\n${t}`))
    .join('');
  const transcript = planText
    ? `# Plan (plan-mode reply)\n\n${planText}\n\n---\n\n# Build\n\n${build}`
    : build;
  await writeFile(path.join(dir, 'transcript.md'), transcript, 'utf8');

  for (const [p, content] of Object.entries(mech.files)) {
    const target = path.join(dir, 'files', p.replace(/^\//, ''));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }

  const preview = await buildPreviewHtml(mech);
  if (preview) {
    await writeFile(path.join(dir, 'preview.html'), preview, 'utf8');
  }

  return rel;
}

async function buildPreviewHtml(mech: MechanicalResult): Promise<string | null> {
  if (mech.previewKind === 'framework' && mech.bundle?.ok) {
    try {
      const site = await buildStaticSite(toEntries(mech.files), []);
      return site.find(f => f.path === '/index.html')?.content ?? null;
    } catch {
      return null; // bundle passed but shell assembly failed — no preview
    }
  }
  if (mech.previewKind === 'sandpack') {
    return (
      mech.files['/index.html'] ??
      Object.entries(mech.files).find(([p]) => p.endsWith('.html'))?.[1] ??
      null
    );
  }
  return null;
}
