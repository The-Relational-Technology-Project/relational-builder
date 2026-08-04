import { parseArgs } from 'node:util';
import { buildSystemPrompt, type StudioLibraryPromptItem } from '@/knowledge/context-builder';
import type { StudioContext } from '@/knowledge/studio-context';
import { KIT_FILES } from '@/kit';
import { bundleProject, findFrameworkEntry } from '@/preview/bundler/bundle';
import { BENCH_MODELS, ENV_KEYS, resolveModels } from './models';
import { resolveTasks, TASKS, type TaskSpec } from './tasks';
import { charsToTokens, EST_OUTPUT_TOKENS, estimateCostUsd } from './lib/cost';
import type { BenchModel } from './types';

/**
 * Bench CLI (executed inside Vite SSR by bench/bootstrap.mjs).
 *
 *   npm run bench -- --dry-run                 prompt + matrix + cost, no API calls
 *   npm run bench -- --models a,b --trials 2   live run
 *   npm run bench -- report <runDir>           regenerate report.md (merges scores.json)
 *   npm run bench -- --list-models
 */

/** Prove esbuild-wasm bundles under Node before any money is spent. */
async function bundlerSelfTest(): Promise<void> {
  const files: Record<string, string> = {
    ...KIT_FILES,
    '/index.html':
      '<!doctype html><html><body><div id="root"></div>' +
      '<script type="module" src="/src/main.tsx"></script></body></html>',
    '/src/index.css': '@import "tailwindcss";\n@theme { --color-ink: #222; }',
    '/src/main.tsx':
      "import { createRoot } from 'react-dom/client';\n" +
      "import './index.css';\nimport { App } from './App';\n" +
      "createRoot(document.getElementById('root')!).render(<App />);",
    '/src/App.tsx':
      "import { Button } from '@/components/ui/button';\n" +
      'export function App() { return <Button>hello</Button>; }',
  };
  const entry = findFrameworkEntry(files);
  if (!entry) throw new Error('bundler self-test: no entry found');
  const result = await bundleProject({ files, entry });
  if (!result.ok) {
    throw new Error(`bundler self-test failed:\n${result.errors.join('\n')}`);
  }
  if (!result.js.includes('hello')) {
    throw new Error('bundler self-test: fixture code missing from output');
  }
}

function keyStatus(model: BenchModel): string {
  return process.env[ENV_KEYS[model.providerId]] ? 'key ✓' : `needs ${ENV_KEYS[model.providerId]}`;
}

function printMatrix(
  models: BenchModel[],
  tasks: TaskSpec[],
  inputTokens: number,
  trials: number,
  planFirst: boolean,
) {
  const cells = tasks.length * trials;
  console.log(
    `\nTasks: ${tasks.map(t => `${t.id} (${t.version})`).join(', ')} · trials per model per task: ${trials}` +
      (planFirst ? ' · plan-first' : ''),
  );
  console.log(`System prompt + task: ~${inputTokens.toLocaleString()} input tokens per generation\n`);
  // Plan-first roughly doubles input (two generations) and adds a plan reply
  const inPerCell = planFirst ? inputTokens * 2 : inputTokens;
  const outPerCell = planFirst ? EST_OUTPUT_TOKENS + 4_000 : EST_OUTPUT_TOKENS;
  let total = 0;
  for (const m of models) {
    const cost = estimateCostUsd(m, inPerCell * cells, outPerCell * cells);
    if (cost != null) total += cost;
    const costStr = cost != null ? `~$${cost.toFixed(2)}` : 'price unknown';
    console.log(
      `  ${m.alias.padEnd(20)} ${m.providerId.padEnd(10)} ${costStr.padEnd(14)} ${keyStatus(m)}`,
    );
  }
  console.log(`\nEstimated run total: ~$${total.toFixed(2)} (chars/4 heuristic, list prices)\n`);
}

export async function main(argv: string[]): Promise<number> {
  if (argv[0] === 'report') {
    const { generateReport } = await import('./lib/report');
    return generateReport(argv[1]);
  }

  if (argv[0] === 'selftest') {
    const { runSelftest } = await import('./selftest');
    return runSelftest();
  }

  // Commons retrieval eval (layer 1: golden set vs the live hybrid search —
  // free, no LLM) and design eval (layer 2: does surfaced knowledge actually
  // land in plans — needs ANTHROPIC_API_KEY).
  if (argv[0] === 'retrieval') {
    const { runRetrievalEval } = await import('./retrieval-eval');
    return runRetrievalEval();
  }
  if (argv[0] === 'design-eval') {
    const { runDesignEval } = await import('./design-eval');
    return runDesignEval(argv.slice(1));
  }

  // Regenerate review/index.html from run.json (e.g. after merging a
  // retried trial into a run directory).
  if (argv[0] === 'review') {
    if (!argv[1]) {
      console.error('Usage: npm run bench -- review <runDir>');
      return 1;
    }
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { writeReviewPage } = await import('./lib/review-page');
    const run = JSON.parse(await readFile(path.resolve(argv[1], 'run.json'), 'utf8'));
    await writeReviewPage(path.resolve(argv[1]), run.runId, run.trials);
    console.log(`Review page written: ${path.resolve(argv[1], 'review/index.html')}`);
    return 0;
  }

  const { values } = parseArgs({
    args: argv,
    options: {
      models: { type: 'string' },
      tasks: { type: 'string' },
      trials: { type: 'string', default: '1' },
      'plan-first': { type: 'boolean', default: false },
      studio: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'skip-screenshots': { type: 'boolean', default: false },
      'list-models': { type: 'boolean', default: false },
      'list-tasks': { type: 'boolean', default: false },
      out: { type: 'string', default: 'bench/results' },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(
      'npm run bench -- [--models a,b,c] [--tasks x,y] [--trials N] [--plan-first] ' +
        '[--studio slug] [--dry-run] [--skip-screenshots] [--out dir] [--list-models] [--list-tasks]\n' +
        'npm run bench -- report <runDir> | review <runDir> | selftest',
    );
    return 0;
  }

  if (values['list-tasks']) {
    for (const t of TASKS) {
      console.log(`${t.id.padEnd(20)} ${t.version.padEnd(8)} ${t.prompt.slice(0, 80)}…`);
    }
    return 0;
  }

  if (values['list-models']) {
    for (const m of BENCH_MODELS) {
      console.log(
        `${m.alias.padEnd(20)} ${m.providerId.padEnd(10)} ${m.enabled ? '' : '(disabled — name explicitly to run)'}`,
      );
    }
    return 0;
  }

  const models = resolveModels(values.models);
  const tasks = resolveTasks(values.tasks);
  const trials = Math.max(1, parseInt(values.trials ?? '1', 10) || 1);
  const planFirst = values['plan-first'] ?? false;

  console.log('Assembling production system prompts…');
  // Studio-framed runs (--studio thread) build the prompt an approved member
  // sees: the studio frame + its private library woven in. Same buildSystemPrompt
  // production calls, just with the studio inputs populated.
  let studioOpts: { studio: StudioContext; studioLibraryItems: StudioLibraryPromptItem[] } | undefined;
  if (values.studio) {
    const { loadStudioFrame } = await import('./lib/studio');
    const frame = await loadStudioFrame(values.studio);
    studioOpts = { studio: frame.studio, studioLibraryItems: frame.libraryItems };
    const kinds = frame.libraryItems.reduce<Record<string, number>>((acc, i) => {
      acc[i.kind] = (acc[i.kind] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `Studio frame: ${frame.studio.label} (${values.studio}) — library ` +
        Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', '),
    );
  }
  const systemPrompt = buildSystemPrompt({ mode: 'build', ...studioOpts });
  const planSystemPrompt = planFirst ? buildSystemPrompt({ mode: 'plan', ...studioOpts }) : '';
  // Edit tasks get the same production build prompt with their frozen seed
  // rendered into Current Project Files — the snapshot is what lets the model
  // write a SEARCH/REPLACE that actually matches. Cached per task id so a
  // multi-trial run builds each one once.
  const editPromptCache = new Map<string, string>();
  const systemPromptFor = (task: TaskSpec): string => {
    if (!task.seedFiles) return systemPrompt;
    const hit = editPromptCache.get(task.id);
    if (hit) return hit;
    const built = buildSystemPrompt({
      mode: 'build',
      ...studioOpts,
      projectFiles: Object.entries(task.seedFiles).map(([path, content]) => ({
        path,
        content,
      })),
    });
    editPromptCache.set(task.id, built);
    return built;
  };
  const inputTokens = charsToTokens(systemPrompt.length + tasks[0].prompt.length);

  console.log('Bundler self-test (esbuild-wasm under Node)…');
  await bundlerSelfTest();
  console.log('Bundler self-test passed.');

  printMatrix(models, tasks, inputTokens, trials, planFirst);

  if (values['dry-run']) {
    console.log('Dry run — no API calls made.');
    return 0;
  }

  const missing = models.filter(m => !process.env[ENV_KEYS[m.providerId]]);
  if (missing.length > 0) {
    console.error(
      `Missing API keys for: ${missing.map(m => m.alias).join(', ')}. ` +
        'Set the env vars above or narrow --models.',
    );
    return 1;
  }

  const { executeRun } = await import('./lib/execute');
  return executeRun({
    models,
    tasks,
    trials,
    systemPrompt,
    systemPromptFor,
    planSystemPrompt,
    planFirst,
    outDir: values.out ?? 'bench/results',
    screenshots: !values['skip-screenshots'],
    studio: values.studio ?? null,
  });
}
