#!/usr/bin/env node
/**
 * Five-minute smoke test for the community open-model paths, after the
 * deploy in docs/human-scale/NEXT.md ("Needs Josh"). Prints what served
 * each call; sends nothing anywhere else. Two checks, each skipped when its
 * inputs are missing:
 *
 *   1. App runtime (app-capabilities, ai_chat with runtime_model "open"):
 *        APP_CAPABILITIES_URL  https://<ref>.supabase.co/functions/v1/app-capabilities
 *        APP_ID, APP_KEY       a scratch app with Community AI on
 *   2. Builder (llm-proxy, x-llm-provider openrouter-community):
 *        LLM_PROXY_URL         https://<ref>.supabase.co/functions/v1/llm-proxy
 *        COMMUNITY_TOKEN       a signed-in community member's session token
 *                              (Builder devtools: the supabase auth access_token)
 *
 * Without credentials each check still makes one credential-less call and
 * expects the function's own JSON error (a 4xx with {error}), not a
 * platform 5xx, which proves the new code is deployed and answering.
 *
 *   node scripts/human-scale/smoke-runtime.mjs
 */

const env = process.env;
const out = (label, obj) => console.log(`${label}: ${typeof obj === 'string' ? obj : JSON.stringify(obj)}`);

async function postJson(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

function judgeBare(label, r) {
  const ok = r.status >= 400 && r.status < 500 && r.json && typeof r.json.error === 'string';
  out(label, ok ? `ok, the function answered ${r.status}: ${r.json.error}` : `NOT OK, status ${r.status}: ${r.text.slice(0, 200)}`);
  return ok;
}

let failures = 0;

if (env.APP_CAPABILITIES_URL) {
  const bare = await postJson(env.APP_CAPABILITIES_URL, {}, { action: 'ai_chat' });
  if (!judgeBare('app runtime, no credentials', bare)) failures++;
  if (env.APP_ID && env.APP_KEY) {
    const r = await postJson(env.APP_CAPABILITIES_URL, {}, {
      action: 'ai_chat', app_id: env.APP_ID, app_key: env.APP_KEY, runtime_model: 'open', max_tokens: 60,
      messages: [{ role: 'user', content: 'Say hello to a neighbor in one short sentence.' }],
    });
    if (r.status === 200 && r.json?.text) {
      out('app runtime, open model', { model: r.json.model, host: r.json.host, servedBy: r.json.servedBy ?? '(not reported)', usage: r.json.usage, text: r.json.text.slice(0, 80) });
    } else { failures++; out('app runtime, open model', `NOT OK, status ${r.status}: ${r.text.slice(0, 200)}`); }
  } else out('app runtime, open model', 'skipped (set APP_ID and APP_KEY)');
} else out('app runtime', 'skipped (set APP_CAPABILITIES_URL)');

if (env.LLM_PROXY_URL) {
  const bare = await postJson(env.LLM_PROXY_URL, { 'x-llm-provider': 'openrouter-community' }, { model: 'google/gemma-4-26b-a4b-it', messages: [] });
  if (!judgeBare('builder route, no credentials', bare)) failures++;
  if (env.COMMUNITY_TOKEN) {
    const r = await postJson(env.LLM_PROXY_URL, { 'x-llm-provider': 'openrouter-community', 'x-community-token': env.COMMUNITY_TOKEN }, {
      model: 'google/gemma-4-26b-a4b-it', stream: false, max_tokens: 40,
      messages: [{ role: 'user', content: 'Reply with the word ready.' }],
    });
    if (r.status === 200 && r.json?.choices) {
      out('builder route, open model', { model: r.json.model, servedBy: r.json.provider ?? '(not reported)', usage: r.json.usage, text: String(r.json.choices[0]?.message?.content ?? '').slice(0, 40) });
    } else { failures++; out('builder route, open model', `NOT OK, status ${r.status}: ${r.text.slice(0, 200)}`); }
  } else out('builder route, open model', 'skipped (set COMMUNITY_TOKEN)');
} else out('builder route', 'skipped (set LLM_PROXY_URL)');

process.exit(failures ? 1 : 0);
