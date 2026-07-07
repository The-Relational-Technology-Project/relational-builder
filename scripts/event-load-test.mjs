#!/usr/bin/env node
/**
 * Event load test — fires N small concurrent community builds at the
 * production LLM proxy, the way a room of workshop builders would.
 *
 * The one prep step before a build jam: prove the proxy, the community
 * gate, and the shared Anthropic key hold up under concurrent builds,
 * and that the model your UI defaults to is actually covered by the
 * COMMUNITY_MODELS secret.
 *
 * Usage:
 *   1. Sign in at https://relationalbuilder.org, then in DevTools console:
 *        JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('-auth-token')))).access_token
 *      (or: copy from Application → Local Storage → sb-…-auth-token → access_token)
 *   2. RB_SESSION_TOKEN=<that token> node scripts/event-load-test.mjs
 *
 * Options (env):
 *   RB_CONCURRENCY   parallel builds (default 8 — the brief's "5-10")
 *   RB_MODEL         model to test (default claude-opus-4-8, the UI default)
 *   RB_PROXY_URL     override proxy URL
 *
 * Cost: N tiny completions (~200 output tokens each) — cents, metered
 * against your own daily community budget.
 */

const PROXY =
  process.env.RB_PROXY_URL ??
  'https://texakzqqenzpxawktbgx.supabase.co/functions/v1/llm-proxy';
const TOKEN = process.env.RB_SESSION_TOKEN;
const N = Number(process.env.RB_CONCURRENCY ?? 8);
const MODEL = process.env.RB_MODEL ?? 'claude-opus-4-8';

if (!TOKEN) {
  console.error('Set RB_SESSION_TOKEN (see usage notes at the top of this file).');
  process.exit(1);
}

console.log(`Firing ${N} concurrent community builds on ${MODEL}…\n`);

async function oneBuild(i) {
  const t0 = Date.now();
  let firstTokenMs = null;
  let chars = 0;
  try {
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-llm-provider': 'anthropic',
        'x-community-token': TOKEN,
        Origin: 'https://relationalbuilder.org',
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Reply with a two-sentence idea for neighborhood tool #${i}. Nothing else.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { i, ok: false, status: res.status, ms: Date.now() - t0, note: text.slice(0, 140) };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk.includes('"content"') && firstTokenMs === null) firstTokenMs = Date.now() - t0;
      chars += chunk.length;
    }
    return { i, ok: true, status: 200, ms: Date.now() - t0, ttft: firstTokenMs, chars };
  } catch (e) {
    return { i, ok: false, status: 'ERR', ms: Date.now() - t0, note: String(e).slice(0, 140) };
  }
}

const results = await Promise.all(Array.from({ length: N }, (_, i) => oneBuild(i)));

for (const r of results) {
  console.log(
    r.ok
      ? `  #${r.i}  OK    total ${(r.ms / 1000).toFixed(1)}s   first token ${((r.ttft ?? 0) / 1000).toFixed(1)}s`
      : `  #${r.i}  ${r.status}  after ${(r.ms / 1000).toFixed(1)}s   ${r.note}`,
  );
}

const ok = results.filter(r => r.ok);
const failed = results.filter(r => !r.ok);
console.log(`\n${ok.length}/${N} succeeded.`);
if (ok.length > 0) {
  const ttfts = ok.map(r => r.ttft ?? 0).sort((a, b) => a - b);
  console.log(
    `first-token latency: median ${(ttfts[Math.floor(ttfts.length / 2)] / 1000).toFixed(1)}s, worst ${(ttfts[ttfts.length - 1] / 1000).toFixed(1)}s`,
  );
}
if (failed.some(r => r.status === 403)) {
  console.log(
    `\n⚠️  403s above usually mean ${MODEL} is missing from the proxy's COMMUNITY_MODELS secret — the UI defaults members to it, so fix before the event.`,
  );
}
if (failed.some(r => r.status === 429)) {
  console.log(
    '\n⚠️  429s above: either the per-minute rate limit (all testers share your one credential here — the room tomorrow will each have their own) or an Anthropic-side limit on the shared key. Re-run with RB_CONCURRENCY=4 to compare.',
  );
}
process.exit(failed.length > 0 ? 1 : 0);
