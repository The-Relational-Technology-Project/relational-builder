import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { searchCommons, type CommonsSearchResult } from '@/knowledge/commons-search';
import {
  selectRelevant,
  deriveTopicQuery,
  blendQuery,
  isMachineTurn,
  findMentionedResults,
  MIN_SEMANTIC_SIMILARITY,
} from '@/knowledge/retrieval';
import { GOLDEN, GOLDEN_VERSION, type GoldenCase } from './retrieval-golden';

/**
 * Retrieval eval (layer 1) — no LLM, a couple hundred free HTTP calls.
 *
 *   npm run bench -- retrieval
 *
 * Runs the golden set (bench/retrieval-golden.ts) through the LIVE commons
 * search plus the production client pipeline (selectRelevant — the relevance
 * floor and mode-aware ranking from src/knowledge/retrieval.ts), and reports:
 *
 *  - recall: did asks surface their expected entries in the top K?
 *  - MRR: how high did the first expected entry rank?
 *  - noise leakage: did edits / off-topic asks survive the floor?
 *  - text-arm canary: do exact keyword queries produce text/both matches?
 *    (the silent failure mode of the hybrid search — semantic alone looks
 *    fine until you measure it)
 *  - similarity distributions for kept vs dropped, so floor drift is visible
 *    as the corpus and embeddings evolve
 *
 * Pure pipeline selftests (gating, topic derivation, query blending, mention
 * matching) run first with no network. Exit code 1 when any threshold fails,
 * so this can gate CI.
 */

const TOP_K: Record<GoldenCase['category'], number> = {
  build: 5,
  'plan-seed': 8,
  'exact-term': 5,
  edit: 8,
  'off-topic': 8,
};

// Failing thresholds — deliberately looser than current measured performance
// (recall ~0.9, leakage 0) so the bench flags real regressions, not jitter.
const MIN_RECALL = 0.7;
const MAX_LEAKAGE = 0.25;

interface CaseResult {
  id: string;
  category: GoldenCase['category'];
  raw: number;
  kept: { slug: string; similarity?: number; match: string }[];
  hit: boolean | null; // null = case has no expectation of either kind
  firstExpectedRank: number | null;
  emptyOk: boolean | null;
  canaryOk: boolean | null;
}

function pipelineSelftests(): string[] {
  const failures: string[] = [];
  const t = (name: string, ok: boolean) => { if (!ok) failures.push(name); };

  t('gates copy-change turns', isMachineTurn('Copy change — this text in the preview:\n"Old" → "New"'));
  t('gates element-point turns', isMachineTurn('About this element in the preview: `button` ("RSVP")'));
  t('gates preview-error turns', isMachineTurn('The live preview is showing this error:\n\n```\nboom\n```'));
  t('does not gate real asks', !isMachineTurn('build a board where neighbors post offers'));

  const ask = 'I want to build a mutual aid board for my street where neighbors post asks and offers';
  t('topic = first substantive ask', deriveTopicQuery([
    { role: 'user', content: ask },
    { role: 'assistant', content: 'Here are three directions…' },
  ]) === ask);
  t('topic skips answer lines', deriveTopicQuery([
    { role: 'user', content: 'Who posts? → Any neighbor can post it themselves' },
  ]) === null);
  t('topic skips auto sends', deriveTopicQuery([
    { role: 'user', content: 'Continue the build with the remaining files you listed and do not repeat any', isAuto: true },
  ]) === null);
  const plan = `Here is the plan.\n\n## The vision\n\nMrs. Chen posts the beach cleanup and four households she has never met show up to help.\n\n## Features\n\n- a board`;
  t('topic prefers the plan vision', (deriveTopicQuery([
    { role: 'user', content: ask },
    { role: 'assistant', content: plan, isPlan: true },
  ]) ?? '').startsWith('Mrs. Chen posts the beach cleanup'));

  t('blend keeps a lone message', blendQuery(null, 'make it blue') === 'make it blue');
  t('blend joins topic and message', blendQuery('a mutual aid board', 'add a way to claim offers')
    === 'a mutual aid board\nadd a way to claim offers');
  t('blend dedupes topic === message', blendQuery(ask, ask) === ask.slice(0, 500));

  const surfaced = [
    { slug: 'mutual-aid-pod', title: 'Mutual Aid Pod', kind: 'recipe', match: 'semantic' },
    { slug: 'time-banking', title: 'Time Banking', kind: 'recipe', match: 'semantic' },
  ] as unknown as CommonsSearchResult[];
  const mentioned = findMentionedResults('This borrows from the Mutual Aid Pod recipe: five to twenty neighbors…', surfaced);
  t('mention matching finds cited titles', mentioned.length === 1 && mentioned[0].slug === 'mutual-aid-pod');
  t('mention matching ignores unmentioned', findMentionedResults('A plain reply.', surfaced).length === 0);

  // The floor itself, on a synthetic result set shaped like real responses
  const synth = (sim: number, match: 'semantic' | 'text' | 'both' = 'semantic') =>
    ({ slug: `s${sim}`, title: 't', kind: 'recipe', match, similarity: sim }) as unknown as CommonsSearchResult;
  const kept = selectRelevant([synth(0.72), synth(0.55), synth(0.5, 'both'), synth(0.61)], 'plan');
  t('floor drops weak semantic hits', !kept.some(r => r.similarity === 0.55));
  t('floor keeps text/both matches regardless', kept.some(r => r.match === 'both'));
  t('floor keeps strong semantic hits', kept.some(r => r.similarity === 0.72));

  return failures;
}

async function runCase(c: GoldenCase): Promise<CaseResult> {
  const raw = await searchCommons(c.query);
  const kept = selectRelevant(raw, c.mode);
  const topK = kept.slice(0, TOP_K[c.category]);
  const slugs = topK.map(r => r.slug);

  let hit: boolean | null = null;
  let firstExpectedRank: number | null = null;
  if (c.expect && c.expect.length > 0) {
    hit = c.expect.some(s => slugs.includes(s));
    const idx = slugs.findIndex(s => c.expect!.includes(s));
    firstExpectedRank = idx >= 0 ? idx + 1 : null;
  }
  const emptyOk = c.expectEmpty ? kept.length === 0 : null;
  const canaryOk = c.textArmCanary
    ? kept.length > 0 && (kept[0].match === 'both' || kept[0].match === 'text')
    : null;

  return {
    id: c.id,
    category: c.category,
    raw: raw.length,
    kept: kept.map(r => ({ slug: r.slug, similarity: r.similarity, match: r.match })),
    hit,
    firstExpectedRank,
    emptyOk,
    canaryOk,
  };
}

function quantiles(xs: number[]): string {
  if (xs.length === 0) return '—';
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return `min ${s[0].toFixed(2)} · p50 ${q(0.5).toFixed(2)} · max ${s[s.length - 1].toFixed(2)}`;
}

export async function runRetrievalEval(): Promise<number> {
  console.log(`Retrieval eval — golden set ${GOLDEN_VERSION}, floor ${MIN_SEMANTIC_SIMILARITY}\n`);

  const selftestFailures = pipelineSelftests();
  if (selftestFailures.length > 0) {
    console.error('Pipeline selftests FAILED:');
    for (const f of selftestFailures) console.error(`  ✗ ${f}`);
    return 1;
  }
  console.log('Pipeline selftests passed (gating, topic, blending, mentions, floor).\n');

  // Live cases, small batches — kind to the shared edge function
  const results: CaseResult[] = [];
  for (let i = 0; i < GOLDEN.length; i += 4) {
    results.push(...await Promise.all(GOLDEN.slice(i, i + 4).map(runCase)));
  }

  const keptSims: number[] = [];
  const droppedCount = { total: 0 };
  for (const r of results) {
    for (const k of r.kept) if (k.similarity != null) keptSims.push(k.similarity);
    droppedCount.total += r.raw - r.kept.length;
  }

  console.log('case                     cat         raw  kept  outcome');
  for (const r of results) {
    const outcome =
      r.emptyOk !== null ? (r.emptyOk ? 'clean (no leakage)' : `LEAKED: ${r.kept.map(k => k.slug).join(', ')}`)
      : r.hit !== null ? (r.hit ? `hit @${r.firstExpectedRank}` : `MISS (top: ${r.kept.slice(0, 3).map(k => k.slug).join(', ')})`)
      : `open — kept ${r.kept.map(k => `${k.slug}${k.similarity ? ` ${k.similarity.toFixed(2)}` : ''}`).slice(0, 3).join(', ')}`;
    const canary = r.canaryOk === null ? '' : r.canaryOk ? ' · text-arm ✓' : ' · TEXT-ARM DEAD';
    console.log(`${r.id.padEnd(24)} ${r.category.padEnd(11)} ${String(r.raw).padStart(3)}  ${String(r.kept.length).padStart(4)}  ${outcome}${canary}`);
  }

  const expectCases = results.filter(r => r.hit !== null);
  const recall = expectCases.filter(r => r.hit).length / Math.max(1, expectCases.length);
  const mrr =
    expectCases.reduce((acc, r) => acc + (r.firstExpectedRank ? 1 / r.firstExpectedRank : 0), 0) /
    Math.max(1, expectCases.length);
  const emptyCases = results.filter(r => r.emptyOk !== null);
  const leakage = emptyCases.filter(r => !r.emptyOk).length / Math.max(1, emptyCases.length);
  const canaries = results.filter(r => r.canaryOk !== null);
  const canaryDead = canaries.filter(r => !r.canaryOk).length;

  console.log(`\nrecall@K   ${(recall * 100).toFixed(0)}%  (${expectCases.filter(r => r.hit).length}/${expectCases.length} expected-slug cases hit; threshold ≥ ${MIN_RECALL * 100}%)`);
  console.log(`MRR        ${mrr.toFixed(2)}`);
  console.log(`leakage    ${(leakage * 100).toFixed(0)}%  (${emptyCases.filter(r => !r.emptyOk).length}/${emptyCases.length} edit/off-topic cases leaked; threshold ≤ ${MAX_LEAKAGE * 100}%)`);
  console.log(`text arm   ${canaries.length - canaryDead}/${canaries.length} exact-term canaries fired`);
  console.log(`kept sims  ${quantiles(keptSims)} · dropped ${droppedCount.total} raw hits below the floor`);

  const outDir = path.resolve('bench/results/retrieval');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
  const outFile = path.join(outDir, `${stamp}.json`);
  await writeFile(outFile, JSON.stringify({
    goldenVersion: GOLDEN_VERSION,
    floor: MIN_SEMANTIC_SIMILARITY,
    at: new Date().toISOString(),
    recall, mrr, leakage,
    textArm: { total: canaries.length, dead: canaryDead },
    results,
  }, null, 2));
  console.log(`\nWritten: ${outFile}`);

  const failed = recall < MIN_RECALL || leakage > MAX_LEAKAGE || canaryDead > 0;
  if (failed) console.error('\nRETRIEVAL EVAL FAILED — see thresholds above.');
  return failed ? 1 : 0;
}
