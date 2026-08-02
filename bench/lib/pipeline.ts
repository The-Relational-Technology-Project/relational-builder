import { applyEdits, extractOperations } from '@/project/code-extractor';
import { detectPreviewKind } from '@/preview/detect';
import { bundleProject, findFrameworkEntry } from '@/preview/bundler/bundle';
import { KIT_FILES } from '@/kit';
import { buildEnvJs, buildEnvTs } from '@/project/env-module';
import { runSecurityScan } from '@/project/security-scan';
import type { FileEntry } from '@/project/virtual-fs';
import type { TaskSpec } from '../tasks';
import type { TrialResult } from '../types';

/**
 * Mechanical scoring: the free, objective layer. Everything here reuses the
 * exact modules production runs — extractor, kind detection, esbuild bundler
 * (with kit merge + env stubs, mirroring FrameworkPreview/buildStaticSite),
 * security scan — so a bench "bundle ok" means the app would genuinely
 * preview and publish.
 */

export type MechanicalResult = Pick<
  TrialResult,
  | 'extraction'
  | 'previewKind'
  | 'previewKindMatch'
  | 'bundle'
  | 'securityFindings'
  | 'checks'
  | 'editDiscipline'
> & {
  /** Final project VFS (path → content), for artifacts + preview build */
  files: Record<string, string>;
};

const normalize = (p: string): string => (p.startsWith('/') ? p : '/' + p);

function toEntries(files: Record<string, string>): FileEntry[] {
  const now = Date.now();
  return Object.entries(files).map(([path, content]) => ({
    path,
    content,
    language: 'text',
    createdAt: now,
    updatedAt: now,
  }));
}

export async function scoreOutput(task: TaskSpec, segmentTexts: string[]): Promise<MechanicalResult> {
  // Edit tasks open on a frozen project, exactly as a real edit turn does —
  // so a SEARCH/REPLACE against a seed file can actually apply, and "what did
  // this edit disturb" is measurable against a known starting state.
  const seed = task.seedFiles ?? null;
  const files: Record<string, string> = seed ? { ...seed } : {};
  const rewrittenSeedPaths = new Set<string>();
  let writes = 0;
  let editBlocks = 0;
  let failedEditBlocks = 0;

  // Segments apply in order, like production extracts each reply message:
  // a continuation that re-outputs a cut-off file simply overwrites it.
  for (const text of segmentTexts) {
    const ops = extractOperations(text);
    for (const w of ops.writes) {
      const p = normalize(w.path);
      // A whole-file re-emit of a file that was already in the project is the
      // expensive habit an edit model should not have — count it separately
      // from a legitimately new file.
      if (seed && p in seed) rewrittenSeedPaths.add(p);
      files[p] = w.content;
      writes++;
    }
    for (const e of ops.edits) {
      editBlocks += e.edits.length;
      const path = normalize(e.path);
      if (!(path in files)) {
        failedEditBlocks += e.edits.length;
        continue;
      }
      const applied = applyEdits(files[path], e.edits);
      files[path] = applied.content;
      failedEditBlocks += applied.failed;
    }
  }

  const entries = toEntries(files);
  const previewKind = detectPreviewKind(entries);

  let bundle: MechanicalResult['bundle'] = null;
  if (previewKind === 'framework') {
    // Same VFS shape FrameworkPreview and buildStaticSite hand the bundler
    const vfs: Record<string, string> = { ...KIT_FILES, ...files };
    vfs['/env.js'] = buildEnvJs([]);
    vfs['/src/env.ts'] = buildEnvTs([]);
    const entry = findFrameworkEntry(vfs);
    if (entry) {
      const result = await bundleProject({ files: vfs, entry });
      bundle = { ok: result.ok, errors: result.ok ? [] : result.errors };
    } else {
      bundle = { ok: false, errors: ['No entry module found (no index.html module script or /src/main.tsx)'] };
    }
  }

  const transcript = segmentTexts.join('\n');

  let editDiscipline: MechanicalResult['editDiscipline'] = null;
  if (seed) {
    const targets = new Set(task.editTargets ?? []);
    const changed = Object.keys(seed).filter(p => files[p] !== seed[p]);
    // Bytes rewritten: how much of the original the model displaced. A
    // surgical SEARCH/REPLACE moves a few hundred; a full re-emit moves the
    // file. Measured on the seed side so adding content doesn't inflate it.
    const bytesRewritten = changed.reduce((n, p) => n + seed[p].length, 0);
    editDiscipline = {
      filesChanged: changed.length,
      collateralFiles: changed.filter(p => !targets.has(p)),
      bytesRewritten,
      seedFilesRewritten: rewrittenSeedPaths.size,
      filesAdded: Object.keys(files).filter(p => !(p in seed)).length,
    };
  }

  return {
    files,
    editDiscipline,
    extraction: { writes, editBlocks, failedEditBlocks },
    previewKind,
    previewKindMatch: previewKind === task.expectedPreviewKind,
    bundle,
    securityFindings: runSecurityScan(entries).length,
    checks: task.checks.map(c => ({
      id: c.id,
      description: c.description,
      pass: c.test(files, transcript),
    })),
  };
}
