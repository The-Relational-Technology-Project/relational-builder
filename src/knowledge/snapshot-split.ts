/**
 * The project-files snapshot, split for prompt caching.
 *
 * The snapshot used to be one cache segment re-rendered from current files on
 * every send — so every edit turn re-wrote the whole thing at the 2× 1-hour
 * cache-write rate and read it back almost never (observed: 673k cache-write
 * vs 414k cache-read tokens in one heavy day; writes were 57% of its cost).
 *
 * Now the snapshot is generational:
 *
 *  - The BASE is rendered once, at a "fold point", and reused byte-identically
 *    on every send after — so its cache segment actually gets read. Files
 *    edited since the fold still appear in it, stale.
 *  - The CHANGED TAIL carries the current contents of files edited since the
 *    fold. It rides in the volatile per-turn context (after every cache
 *    breakpoint), billed at plain input rates — 1× on a few small files
 *    instead of 2× on the whole snapshot.
 *  - When the tail outgrows REFOLD_RATIO of the base (or a file is deleted or
 *    renamed, which the tail can't express), everything folds into a fresh
 *    base: one full 2× write, amortized over the turns since the last fold.
 *
 * State is a module-level singleton: the Builder works one project at a time,
 * and a project switch, restore, or import shows up as mass churn/deletions,
 * which triggers a re-fold on its own. Losing the state (page reload) costs
 * exactly one extra fold — the cache TTL is an hour anyway.
 */

export interface SnapshotFile {
  path: string;
  content: string;
  updatedAt?: number;
}

// Keep the file snapshot bounded: big files get truncated, and past the total
// budget only paths are listed. Generous on purpose — a complex app the model
// can't fully see becomes a complex app it silently breaks. Community budgets
// are sized for this (5M tokens/day).
const MAX_FILE_CHARS = 16000;
const MAX_TOTAL_FILE_CHARS = 120000;

/** Tail may grow to this fraction of the base before everything re-folds. */
const REFOLD_RATIO = 0.35;

interface FoldState {
  /** Path → content as of the fold, for change detection */
  contents: Map<string, string>;
  /** The rendered base snapshot, reused verbatim for byte-stable caching */
  baseText: string;
}

let fold: FoldState | null = null;

/**
 * Paths the assistant asked to see in full (a NEED-FILES marker line — see
 * the howto rendered into the snapshot header). Omitted files used to be a
 * dead end the person had to bridge by hand-pasting code out of the Files
 * tab; now the assistant asks the Builder instead. Requested files ride in
 * the volatile tail UNTRUNCATED until the next fold, whose content budget
 * then keeps them ahead of mere recency.
 */
let requestedPaths = new Set<string>();

/** Pin files the assistant asked for (exact VFS paths) into the tail. */
export function markFilesRequested(paths: string[]): void {
  for (const p of paths) requestedPaths.add(p);
}

/** Test/reset hook — drops the fold so the next split starts fresh. */
export function resetSnapshotFold(): void {
  fold = null;
  requestedPaths = new Set();
}

const promptCost = (content: string) => Math.min(content.length, MAX_FILE_CHARS);

/**
 * Returns the frozen base snapshot (for the cached system segment) and the
 * files changed since the fold (for the volatile per-turn context).
 */
export function splitProjectSnapshot(
  files: SnapshotFile[],
): { baseText: string; changedFiles: SnapshotFile[] } {
  const refold = () => {
    fold = {
      contents: new Map(files.map(f => [f.path, f.content])),
      baseText: formatProjectFilesForPrompt(files, requestedPaths),
    };
    // The fresh base carries the requested files with bodies (the budget
    // keeps them first) — the standing request has served its purpose.
    requestedPaths = new Set();
    return { baseText: fold.baseText, changedFiles: [] };
  };

  if (!fold) return refold();

  // Deleted or renamed files can't be expressed as a tail entry — re-fold.
  const currentPaths = new Set(files.map(f => f.path));
  for (const path of fold.contents.keys()) {
    if (!currentPaths.has(path)) return refold();
  }

  const changedFiles = files.filter(
    f => fold!.contents.get(f.path) !== f.content || requestedPaths.has(f.path),
  );
  const changedChars = changedFiles.reduce((sum, f) => sum + promptCost(f.content), 0);
  const baseChars = [...fold.contents.values()].reduce((sum, c) => sum + promptCost(c), 0);
  if (changedChars > REFOLD_RATIO * Math.max(baseChars, 1)) return refold();

  return { baseText: fold.baseText, changedFiles };
}

// Base64 payloads (builder photo assets, images pulled from a connected
// repo) are named in one line each, never inlined — so they must not eat
// the content budget either.
const isPhotoAsset = (p: string) => /^\/?assets\/[\w-]+\.js$/.test(p);
const isRepoImage = (p: string) => /\.(png|jpe?g|gif|webp|avif|ico)$/i.test(p);

function fileLine(file: SnapshotFile): string | null {
  if (isPhotoAsset(file.path)) {
    const name = file.path.replace(/^\/?assets\//, '').replace(/\.js$/, '');
    return `- ${file.path} — the builder's own photo asset "${name}". React apps: just <img data-asset="${name}" alt="..."> anywhere (the builder wires it up). Plain HTML pages: <script src="./assets/${name}.js"></script> plus the same img tag. NEVER re-output or modify this file.`;
  }
  if (isRepoImage(file.path)) {
    const kb = Math.max(1, Math.round((file.content.length * 0.75) / 1024));
    const hint = file.path.startsWith('/src/')
      ? ` Reference it the Vite way: \`import img from '@${file.path.slice(4)}'\`.`
      : '';
    return `- ${file.path} — image from the connected repo (~${kb} KB), previewable.${hint} NEVER output, edit, or delete this file — the repo keeps the original.`;
  }
  return null;
}

function fileBody(file: SnapshotFile, untruncated = false): string[] {
  let body = file.content;
  let note = '';
  if (!untruncated && body.length > MAX_FILE_CHARS) {
    body = body.slice(0, MAX_FILE_CHARS);
    note = '\n... (truncated — ask for the whole file with a NEED-FILES line if your change touches what was cut)';
  }
  return [`### ${file.path}`, '```', body + note, '```', ''];
}

/** How the assistant asks the Builder for files instead of asking the person
 *  to copy-paste them. Rendered into the snapshot only when something is
 *  actually omitted; ChatPanel answers the marker with an automatic
 *  continuation carrying the full contents. */
const NEED_FILES_HOWTO = [
  'Some long, untouched files below appear as just their path with contents omitted. You can ALWAYS get their contents: end your reply with a single line naming every file you need, exactly like',
  '',
  '  `NEED-FILES: /src/pages/Home.tsx, /src/pages/About.tsx`',
  '',
  'then stop — the Builder sends their full current contents automatically and asks you to continue. Never ask the person to open or paste code themselves, and never guess at or rewrite a file you cannot see.',
].join('\n');

export function formatProjectFilesForPrompt(
  files: SnapshotFile[],
  requested?: Set<string>,
): string {
  const sections: string[] = [
    '## Current Project Files',
    '',
    'These are the project\'s files. If a "Files changed since this snapshot" section appears later in this conversation\'s context, the contents THERE are the current truth for the files it lists — this snapshot lags behind for exactly those files. Edit blocks must match the newest version shown of each file.',
    '',
    'Earlier replies in this chat show their code blocks collapsed to `⟨file /path — N lines, already applied⟩` placeholders — that content is not lost: the newest version of every file is in this snapshot or the changed-files section.',
    '',
  ];

  // Files arrive least-recently-touched first, so the cached prefix survives
  // (see getFilesForPrompt). That is the wrong order to spend the content
  // budget in — it would drop the file they are working on right now. Pick
  // what gets full content by recency FIRST (explicitly requested files
  // ahead of everything — being asked for beats being recently touched),
  // then emit in the cache order.
  const withBody = new Set(
    [...files]
      .filter(f => !isPhotoAsset(f.path) && !isRepoImage(f.path))
      .sort((a, b) => {
        const req = (requested?.has(b.path) ? 1 : 0) - (requested?.has(a.path) ? 1 : 0);
        return req !== 0 ? req : (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      })
      .reduce<{ keep: string[]; left: number }>(
        (acc, f) => {
          const cost = promptCost(f.content);
          if (acc.left > 0) {
            acc.keep.push(f.path);
            acc.left -= cost;
          }
          return acc;
        },
        { keep: [], left: MAX_TOTAL_FILE_CHARS },
      ).keep,
  );

  const anyOmitted = files.some(
    f => !isPhotoAsset(f.path) && !isRepoImage(f.path) && !withBody.has(f.path),
  );
  if (anyOmitted) sections.push(NEED_FILES_HOWTO, '');

  for (const file of files) {
    // Photo assets and repo images are named, never inlined
    const line = fileLine(file);
    if (line) {
      sections.push(line);
      continue;
    }
    if (!withBody.has(file.path)) {
      sections.push(`- ${file.path} (contents omitted — ask for it with a NEED-FILES line before changing it)`);
      continue;
    }
    sections.push(...fileBody(file));
  }

  return sections.join('\n');
}

/**
 * The volatile tail: current contents of files edited since the fold, plus
 * any files the assistant asked for with NEED-FILES (those untruncated —
 * "the full contents" is the whole promise). Rides in the per-turn context
 * after every cache breakpoint — never cached, never persisted into history.
 */
export function formatChangedFilesForPrompt(files: SnapshotFile[]): string {
  const sections: string[] = [
    '## Files changed since this snapshot',
    '',
    'These files have changed since the Current Project Files snapshot in your instructions was taken — or you asked for them with a NEED-FILES line. The contents below are their CURRENT truth and override the snapshot\'s version — edit blocks for these files must match what is shown here:',
    '',
  ];
  for (const file of files) {
    const line = fileLine(file);
    if (line) {
      sections.push(line);
      continue;
    }
    sections.push(...fileBody(file, requestedPaths.has(file.path)));
  }
  return sections.join('\n');
}
