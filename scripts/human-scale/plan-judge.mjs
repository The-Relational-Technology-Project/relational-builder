#!/usr/bin/env node
/**
 * Score plans blind against the Builder's own planning practice.
 *
 *   OPENROUTER_API_KEY=... node scripts/human-scale/plan-judge.mjs <dir-with-plans-subdirs...> > judged.json
 *
 * Each plan (a .md file under <dir>/plans/) goes to one judge model with the place's design brief
 * and a five-part rubric. The judge never sees which model wrote the plan. The judge is a frontier
 * model, used here only to mark, because marking forty plans by eye is not repeatable; it is not
 * part of the system being tested. Read a sample yourself: a judge has tastes too.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const JUDGE = process.env.PLAN_JUDGE ?? 'anthropic/claude-sonnet-5';
// The judge sees exactly what the planner saw about the place: the design brief as it rode in the
// plan request (the whole brief, with who to talk to), not the shorter block-only fixture. Marking a
// plan against less than the planner was given makes real people look invented.
const request = JSON.parse(readFileSync(new URL('../../bench/fixtures/plan-request-block-sweep.json', import.meta.url), 'utf8'));
const turn = request.messages[request.messages.length - 1].content;
const brief = (turn.match(/<place_brief>([\s\S]*?)<\/place_brief>/)?.[1] ?? readFileSync(new URL('../../bench/fixtures/place-brief-46-moraga.md', import.meta.url), 'utf8')).trim();
const RUBRIC = `You are marking a first planning reply written by an AI app builder for neighborhood tools. A neighbor asked for: "A street cleaning reminder for the neighbors on our block. Each reminder comes with one fun, true fact about the history of our block." The block is 46th Ave between Moraga and Noriega in the Outer Sunset, San Francisco. The builder was given the design brief below from the neighborhood's own commons.

Mark the reply on five things, each 0, 1 or 2:
- exists: Does it open by saying what already exists here that does part of this (the city's published schedule for this block, what the commons holds)? 2 = clearly and early, 1 = mentioned late or vaguely, 0 = not at all.
- people: Does it point the builder to real people or groups to talk to (from the brief), as something to do before or while building? 2 = names them and says why, 1 = a generic "talk to neighbors", 0 = none.
- facts: Are the local facts it states right according to the brief (days, sides, names, dates, who does what)? 2 = uses several and all are right, 1 = uses few, or one is wrong or misattributed, 0 = uses none or several are wrong. Invented local facts are a 0. A person, group or event counts as real only if it is in the brief.
- questions: Does it end with at most two questions, each with concrete options, that would really change what gets built? 2 = yes, 1 = questions are generic, too many, or lack options, 0 = none.
- voice: Plain, warm, short, no flattery ("what a wonderful idea"), no jargon, no code. 2 = yes, 1 = some padding or flattery, 0 = long, gushing or technical.

Reply with JSON only: {"exists":n,"people":n,"facts":n,"questions":n,"voice":n,"wrong":"any wrong or invented fact, quoted, or empty","note":"one short sentence"}

<design_brief>
${brief.slice(0, 14000)}
</design_brief>`;
async function judge(text) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: JUDGE, temperature: 0, max_tokens: 1500, reasoning: { effort: 'low' }, messages: [{ role: 'system', content: RUBRIC }, { role: 'user', content: `<reply_to_mark>\n${text.slice(0, 7000)}\n</reply_to_mark>` }] }), signal: AbortSignal.timeout(120000) });
  const j = await res.json();
  const m = (j.choices?.[0]?.message?.content ?? '').match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { error: JSON.stringify(j).slice(0, 200) };
}
const out = [];
const jobs = [];
for (const dir of process.argv.slice(2)) for (const f of readdirSync(join(dir, 'plans')).filter(n => n.endsWith('.md'))) jobs.push({ dir, f });
for (let i = 0; i < jobs.length; i += 6) {
  await Promise.all(jobs.slice(i, i + 6).map(async ({ dir, f }) => {
    const text = readFileSync(join(dir, 'plans', f), 'utf8');
    if (!text.trim()) { out.push({ dir, model: f.replace(/\.md$/, ''), empty: true, total: 0 }); return; }
    try { const s = await judge(text); out.push({ dir, model: f.replace(/\.md$/, ''), chars: text.length, ...s, total: s.error ? null : s.exists + s.people + s.facts + s.questions + s.voice }); }
    catch (e) { out.push({ dir, model: f.replace(/\.md$/, ''), error: String(e).slice(0, 120) }); }
  }));
}
console.log(JSON.stringify(out, null, 2));
