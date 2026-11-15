// One plan request (the Builder's real system prompt and turn context for the block reminder), many models.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
// Usage: OPENROUTER_API_KEY=... node scripts/human-scale/plan-screen.mjs <out-dir> <model> [<model> ...]
// The request is the Builder's own system prompt and turn context for the block reminder, captured from
// main on 2026-11-14 with the place's design brief in the turn (bench/fixtures/plan-request-block-sweep.json).
// Eight plain checks, no model. They are floors; read the plans.
const S = process.argv[2];
const here = new URL('.', import.meta.url);
const req = JSON.parse(readFileSync(new URL('../../bench/fixtures/plan-request-block-sweep.json', here), 'utf8'));
const brief = readFileSync(new URL('../../bench/fixtures/place-brief-46-moraga.md', here), 'utf8');
const models = process.argv.slice(3);
mkdirSync(`${S}/plans`, { recursive: true });
const years = s => new Set([...s.matchAll(/\b(1[89]\d\d|20\d\d)\b/g)].map(m => m[1]));
const briefYears = years(brief + req.messages.map(m => typeof m.content === 'string' ? m.content : '').join(' '));
async function one(model) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      body: JSON.stringify({ model, messages: req.messages, max_tokens: 9000, temperature: 0.4, reasoning: { effort: "low" } }), signal: AbortSignal.timeout(240000) });
    const j = await res.json();
    if (!res.ok) return { model, error: JSON.stringify(j).slice(0, 200) };
    const text = (j.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    writeFileSync(`${S}/plans/${model.replace(/[\/:]/g, '-')}.md`, text);
    const head = text.slice(0, 900).toLowerCase(), low = text.toLowerCase();
    const strange = [...years(text)].filter(y => !briefYears.has(y) && !(+y >= 2025 && +y <= 2028));
    const checks = {
      opens_with_place: /(1st|first).{0,12}(3rd|third)|monday|thursday|doelger|king philip|freedom house|rainbow house|1941/.test(head),
      real_schedule: /mon/.test(low) && /thu/.test(low),
      names_what_exists: /already|existing|public works|sfpublicworks|street (cleaning|sweeping) schedule/.test(low),
      points_to_people: /sunset wave|social club|steward|talk to|neighbors? (on|next|either)|knock|in person/.test(low),
      question_card: /##\s*question for you/i.test(text) && /\n\s*1\./.test(text),
      no_code_dump: !/```(tsx?|jsx?|html|css)/i.test(text),
      no_invented_years: strange.length === 0,
      sane_length: text.length >= 500 && text.length <= 5000,
    };
    return { model, ms: Date.now() - t0, chars: text.length, in: j.usage?.prompt_tokens, out: j.usage?.completion_tokens, passed: Object.values(checks).filter(Boolean).length, of: 8, failed: Object.entries(checks).filter(([, v]) => !v).map(([k]) => k), strange };
  } catch (e) { return { model, error: String(e).slice(0, 160) }; }
}
const out = await Promise.all(models.map(one));
writeFileSync(`${S}/plans.json`, JSON.stringify(out, null, 2));
for (const r of out.sort((a, b) => (b.passed ?? -1) - (a.passed ?? -1))) console.log(r.error ? `${r.model}  ERROR ${r.error}` : `${r.passed}/8  ${(r.ms / 1000).toFixed(0)}s  ${r.chars} chars  ${r.model}  failed: ${r.failed.join(', ') || 'none'} ${r.strange.length ? 'odd years ' + r.strange : ''}`);
