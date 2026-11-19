/**
 * Supabase Edge Function: lot-plan — the server half of the Library of Things
 * Launch Plan prototype (prototypes/lot-launch-plan).
 *
 * The page guides a housing developer through a launch plan, one section at a
 * time. This function is the only thing that talks to a model, and it owns
 * everything that decides what the model sees: the toolkit, the search over
 * it, and the prompts. The page sends structured answers, never a prompt, so
 * the endpoint cannot be used as a general-purpose model proxy.
 *
 * POST JSON:
 *   { action: 'draft', section, project, answers: [{q, a}], done?: [{title, text}],
 *     current?, note? }
 *       — draft (or redraft, when `current`/`note` are given) one plan section
 *   { action: 'ask', question, project? }
 *       — answer one question from the toolkit
 *
 * Replies as newline-delimited JSON so the draft appears as it is written:
 *   {"type":"sources","sources":[{id, heading, section, chapter, url}]}
 *   {"type":"delta","text":"..."}            (many)
 *   {"type":"done"}  |  {"type":"error","error":"..."}
 *
 * The toolkit text is Shareable's (CC BY-NC-ND 4.0) and is not in this repo.
 * It is fetched once per cold start from the prototype's own site
 * (LOT_TOOLKIT_URL), where prototypes/lot-launch-plan/build-toolkit.py put it.
 *
 * Spend: runs on ANTHROPIC_COMMUNITY_KEY. Guarded by an origin allowlist,
 * input caps, a per-address hourly limit and a daily ceiling. The counters
 * live in memory, which is enough for a demo and not for a public launch.
 *
 * Deploy: see CLAUDE.md (Management API), verify_jwt false.
 */

const TOOLKIT_URL = Deno.env.get('LOT_TOOLKIT_URL') ?? 'https://lot-launch-plan.vercel.app/toolkit.json';
const MODEL = Deno.env.get('LOT_PLAN_MODEL') ?? Deno.env.get('COMMUNITY_APP_MODEL') ?? 'claude-opus-5-5';
const EFFORT = Deno.env.get('LOT_PLAN_EFFORT') ?? 'low';
// Thinking shares the output budget, so leave headroom above a ~600 word draft
const MAX_TOKENS = 4096;

const ALLOWED_ORIGINS = (Deno.env.get('LOT_PLAN_ORIGINS') ?? 'https://lot-launch-plan.vercel.app')
  .split(',').map((o) => o.trim()).filter(Boolean);
const PER_ADDRESS_PER_HOUR = 40;
const PER_DAY = 600;
const MAX_FIELD_CHARS = 1500;
const MAX_EXCERPTS = 8;
const MAX_EXCERPT_WORDS = 4200;
const MAX_PER_CHAPTER = 3;

interface Chunk {
  id: string;
  section: string;
  chapter: string;
  heading: string;
  text: string;
  url: string;
  words: number;
}

interface SectionSpec {
  title: string;
  /** What this part of the plan has to settle */
  brief: string;
  /** Words that find the right toolkit pages, on top of what the person wrote */
  query: string;
  /** Toolkit sections that get a lift, matched on the start of the name */
  lift: string[];
  /** Chapters always included, matched anywhere in the chapter name */
  pin?: string;
}

const APARTMENT = 'Apartment building';

const SECTIONS: Record<string, SectionSpec> = {
  purpose: {
    title: 'Purpose and people',
    brief: 'Why this library of things, who it is for, and who will carry it.',
    query: 'why who vision motivation team shared responsibility community challenges guiding questions',
    lift: ['Section 1'],
    pin: APARTMENT,
  },
  residents: {
    title: 'Resident needs and engagement',
    brief: 'How residents shape what the library holds and how it runs, before and after opening.',
    query: 'needs assessment engagement survey community input listening residents outreach',
    lift: ['Section 1'],
  },
  space: {
    title: 'Space and setup',
    brief: 'Where it lives in the building, how the room is laid out, and how people get to it.',
    query: 'space design layout storage shelving access hours apartment building room accessibility',
    lift: ['Section 3'],
    pin: APARTMENT,
  },
  items: {
    title: 'Items: what to stock and how to get them',
    brief: 'The opening inventory, where items come from, and how they are kept in working order.',
    query: 'sourcing items inventory donations purchasing popular items maintenance repair cleaning',
    lift: ['Section 2'],
  },
  policies: {
    title: 'Policies and lending system',
    brief: 'How borrowing works: loan periods, late or broken items, waivers, and the software or ledger that tracks it.',
    query: 'policies lending system loan period late fees damaged items waiver software inventory management checkout',
    lift: ['Section 2', 'Section 5'],
  },
  people: {
    title: 'Staffing, volunteers and resident roles',
    brief: 'Who opens the door, who looks after items, and how residents take on roles.',
    query: 'volunteers staffing roles shifts training membership recruiting coordinator hiring',
    lift: ['Section 6'],
  },
  budget: {
    title: 'Budget and funding',
    brief: 'What it costs to open and to run for a year, and where the money comes from.',
    query: 'budget operational costs income fundraising grants earned revenue startup costs membership fees',
    lift: ['Section 7'],
  },
  risk: {
    title: 'Insurance, risk and governance',
    brief: 'How risk is handled, what cover is needed, and who makes decisions.',
    query: 'insurance liability waiver risk governance decision making board community governance safety',
    lift: ['Section 5'],
  },
  partners: {
    title: 'Partners',
    brief: 'Who to work with nearby, and what each side brings.',
    query: 'partnerships selecting partners nonprofit government business public library tool library ecosystem',
    lift: ['Section 9'],
  },
  launch: {
    title: 'Outreach and launch event',
    brief: 'How residents hear about it, and what opening day looks like.',
    query: 'communications marketing brand outreach launch event workshops repair events flyers social media',
    lift: ['Section 4', 'Section 10'],
  },
  timeline: {
    title: 'Timeline to opening day',
    brief: 'The steps between now and opening, in order, with who does each.',
    query: 'timeline planning steps phases getting started launch opening first year milestones now what',
    lift: ['Section 1', 'Conclusion'],
  },
};

const SYSTEM = `You help a housing developer write the launch plan for a library of things in one of their buildings. They finished Shareable's Library of Things Co-Lab and are opening by the end of spring. You work from Shareable's Library of Things Toolkit 2.0, and only from it.

Rules:
- Use only the toolkit excerpts you are given and what the person told you. If the excerpts do not cover something the plan needs, say so in one plain sentence and put it under "Still to figure out". Never invent costs, prices, legal or insurance requirements, statistics, or the names of organizations or products.
- Cite as you go. After a sentence that draws on an excerpt, add its id in square brackets, like [lot-042]. Cite only ids you were given. Do not cite what the person told you.
- When the toolkit describes what another library did, present it as an example they could adapt, and name that library. It is not a rule.
- Be specific to their building, residents and city. Do not restate their answers back to them at length. Where they left something blank, do not guess: make it an open question.
- Plain language. Short paragraphs and short lists. No em-dashes. No preamble and no closing pep talk.`;

const DRAFT_SHAPE = `Write this section of their plan in their own voice ("We will..."), about 250 to 400 words. Use short sub-headings (### ) or lists where they help. Do not repeat the section title.

End with exactly this heading and a list of 1 to 4 items:
### Still to figure out
- (a decision, a number or a conversation this section still needs, written so they can take it to their team, residents or Shareable)`;

const ASK_SHAPE = `Answer their question in under 200 words, from the excerpts only, with citations. If the excerpts do not answer it, say the toolkit does not cover it and suggest who they could ask. No headings.`;

// ---------- CORS and limits ----------

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    Vary: 'Origin',
  };
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin') ?? '';
  return ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

const hourly = new Map<string, { count: number; start: number }>();
let daily = { day: '', count: 0 };

function overLimit(address: string): string | null {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (daily.day !== day) daily = { day, count: 0 };
  if (daily.count >= PER_DAY) return 'This prototype has reached its limit for today. Try again tomorrow.';
  const bucket = hourly.get(address);
  if (!bucket || now - bucket.start > 3_600_000) {
    hourly.set(address, { count: 1, start: now });
  } else {
    bucket.count += 1;
    if (bucket.count > PER_ADDRESS_PER_HOUR) return 'That is a lot of drafts in one hour. Take a break and try again shortly.';
  }
  daily.count += 1;
  return null;
}

// ---------- The toolkit and the search over it ----------

const STOP = new Set(
  'a an and are as at be but by for from has have how i if in into is it its of on or our so that the their them then there these they this to was we were what when where which who will with you your not no do does can could should would about more most some any all also than'
    .split(' '),
);

function tokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    // A light stem so "volunteers" finds "volunteer" and "policies" finds "policy"
    let t = raw;
    if (t.length > 4 && t.endsWith('ies')) t = t.slice(0, -3) + 'y';
    else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
    out.push(t);
  }
  return out;
}

interface Index {
  chunks: Chunk[];
  tf: Map<string, number>[];
  len: number[];
  avgLen: number;
  df: Map<string, number>;
}

let indexPromise: Promise<Index> | null = null;

function loadIndex(): Promise<Index> {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((err) => {
      indexPromise = null;
      throw err;
    });
  }
  return indexPromise;
}

async function buildIndex(): Promise<Index> {
  const res = await fetch(TOOLKIT_URL);
  if (!res.ok) throw new Error(`toolkit fetch ${res.status}`);
  const doc = await res.json();
  // Credits and the "buy / download" notes are not guidance
  const chunks: Chunk[] = (doc.chunks as Chunk[]).filter(
    (c) => c.section !== 'Credits' && !/^(Buy a Physical Copy|Free Download)/.test(c.heading) && c.words >= 25,
  );
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  const df = new Map<string, number>();
  for (const c of chunks) {
    // Headings say what a passage is about, so they count for more
    const toks = [...tokens(c.heading), ...tokens(c.heading), ...tokens(c.heading), ...tokens(c.chapter), ...tokens(c.chapter), ...tokens(c.text)];
    const counts = new Map<string, number>();
    for (const t of toks) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const t of counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(counts);
    len.push(toks.length);
  }
  const avgLen = len.reduce((a, b) => a + b, 0) / Math.max(1, len.length);
  return { chunks, tf, len, avgLen, df };
}

function search(index: Index, query: string, spec?: SectionSpec): Chunk[] {
  const qCounts = new Map<string, number>();
  for (const t of tokens(query)) qCounts.set(t, (qCounts.get(t) ?? 0) + 1);
  const n = index.chunks.length;
  const k1 = 1.4;
  const b = 0.75;
  const scored: { i: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    let score = 0;
    for (const [t, qf] of qCounts) {
      const f = index.tf[i].get(t);
      if (!f) continue;
      const d = index.df.get(t) ?? 1;
      const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5));
      // A word repeated in the query matters a little more, not linearly more
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * index.len[i]) / index.avgLen))) * Math.min(2, 1 + Math.log(qf) / 2);
    }
    if (score <= 0) continue;
    const c = index.chunks[i];
    if (spec?.lift.some((s) => c.section.startsWith(s))) score *= 1.7;
    // The appendix is link lists: useful, but rarely the best page to draft from
    if (c.section === 'Appendix') score *= 0.6;
    scored.push({ i, score });
  }
  scored.sort((a, b2) => b2.score - a.score);

  const picked: Chunk[] = [];
  const seen = new Set<string>();
  const perChapter = new Map<string, number>();
  let words = 0;
  const take = (c: Chunk, pinned = false) => {
    if (seen.has(c.id) || picked.length >= MAX_EXCERPTS || words + c.words > MAX_EXCERPT_WORDS) return;
    // One chapter should not crowd out the rest of what a section needs
    const chapterKey = `${c.section}/${c.chapter}`;
    const fromChapter = perChapter.get(chapterKey) ?? 0;
    if (!pinned && fromChapter >= MAX_PER_CHAPTER) return;
    perChapter.set(chapterKey, fromChapter + 1);
    seen.add(c.id);
    picked.push(c);
    words += c.words;
  };
  if (spec?.pin) {
    for (const c of index.chunks) if (c.chapter.includes(spec.pin)) take(c, true);
  }
  for (const s of scored) take(index.chunks[s.i]);
  return picked;
}

// ---------- Request shaping ----------

function clip(value: unknown, max = MAX_FIELD_CHARS): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const PROJECT_LABELS: [string, string][] = [
  ['org', 'Organization'],
  ['city', 'City'],
  ['building', 'The building and who lives there'],
  ['space', 'Space in mind'],
  ['team', 'Team'],
  ['budget', 'Budget'],
  ['opening', 'Target opening'],
  ['heard', 'What residents have said so far'],
];

function projectBlock(project: unknown): string {
  const p = (project && typeof project === 'object' ? project : {}) as Record<string, unknown>;
  const lines = PROJECT_LABELS.map(([key, label]) => `${label}: ${clip(p[key], 800) || '(not answered)'}`);
  return lines.join('\n');
}

function excerptBlock(chunks: Chunk[]): string {
  return chunks
    .map((c) => `<excerpt id="${c.id}" from="${c.section}${c.chapter ? ' / ' + c.chapter : ''} / ${c.heading}">\n${c.text}\n</excerpt>`)
    .join('\n\n');
}

function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n');
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const fail = (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return fail('POST only', 405);
  if (!originAllowed(req)) return fail('This endpoint only serves the Library of Things Launch Plan page', 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON', 400);
  }

  const action = String(body.action ?? '');
  let userText: string;
  let query: string;
  let spec: SectionSpec | undefined;

  if (action === 'draft') {
    spec = SECTIONS[String(body.section ?? '')];
    if (!spec) return fail('Unknown section', 400);
    const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, 6).map((x) => {
      const pair = (x ?? {}) as Record<string, unknown>;
      return { q: clip(pair.q, 300), a: clip(pair.a) };
    });
    const done = (Array.isArray(body.done) ? body.done : []).slice(0, 12).map((x) => {
      const d = (x ?? {}) as Record<string, unknown>;
      return `${clip(d.title, 80)}: ${clip(d.text, 320)}`;
    });
    const current = clip(body.current, 6000);
    const note = clip(body.note, 600);
    const project = projectBlock(body.project);
    query = [spec.query, spec.query, answers.map((x) => x.a).join(' '), note].join(' ');
    userText = [
      `THEIR PROJECT\n${project}`,
      done.length ? `ALREADY IN THEIR PLAN (the start of each finished section)\n${done.join('\n')}` : '',
      `THIS SECTION: ${spec.title}\n${spec.brief}`,
      `THEIR ANSWERS\n${answers.map((x) => `Q: ${x.q}\nA: ${x.a || '(left blank)'}`).join('\n\n')}`,
      current ? `THE DRAFT THEY HAVE NOW\n${current}` : '',
      note ? `WHAT THEY WANT CHANGED\n${note}` : '',
    ].filter(Boolean).join('\n\n');
  } else if (action === 'ask') {
    const question = clip(body.question, 600);
    if (question.length < 3) return fail('Ask a question first', 400);
    query = question;
    userText = `THEIR PROJECT\n${projectBlock(body.project)}\n\nTHEIR QUESTION\n${question}`;
  } else {
    return fail('Unknown action', 400);
  }

  const address = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const limited = overLimit(address);
  if (limited) return fail(limited, 429);

  const key = Deno.env.get('ANTHROPIC_COMMUNITY_KEY') ?? '';
  if (!key) return fail('The AI is not configured on this server', 503);

  let excerpts: Chunk[];
  try {
    excerpts = search(await loadIndex(), query, spec);
  } catch (err) {
    console.error('lot-plan toolkit load failed', err);
    return fail('The toolkit could not be loaded. Try again in a moment.', 503);
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      output_config: { effort: EFFORT },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `${userText}\n\nTOOLKIT EXCERPTS\n${excerptBlock(excerpts)}\n\n${action === 'draft' ? DRAFT_SHAPE : ASK_SHAPE}`,
        },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('lot-plan upstream error', upstream.status, detail.slice(0, 500));
    return fail(upstream.status === 429 ? 'The AI is busy right now. Try again in a moment.' : 'The AI is unavailable right now. Try again shortly.', 502);
  }

  const sources = excerpts.map((c) => ({ id: c.id, heading: c.heading, section: c.section, chapter: c.chapter, url: c.url }));
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(ndjson({ type: 'sources', sources }));
      let buffer = '';
      let failed = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith('data:')) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(5));
            } catch {
              continue;
            }
            if (event.type === 'content_block_delta') {
              const delta = event.delta as { type?: string; text?: string } | undefined;
              if (delta?.type === 'text_delta' && delta.text) controller.enqueue(ndjson({ type: 'delta', text: delta.text }));
            } else if (event.type === 'message_delta') {
              const stop = (event.delta as { stop_reason?: string } | undefined)?.stop_reason;
              if (stop === 'refusal') {
                failed = true;
                controller.enqueue(ndjson({ type: 'error', error: 'The AI declined this request.' }));
              }
            } else if (event.type === 'error') {
              failed = true;
              console.error('lot-plan stream error', JSON.stringify(event).slice(0, 400));
              controller.enqueue(ndjson({ type: 'error', error: 'The AI stopped part way. Try again.' }));
            }
          }
        }
        if (!failed) controller.enqueue(ndjson({ type: 'done' }));
      } catch (err) {
        console.error('lot-plan stream failed', err);
        controller.enqueue(ndjson({ type: 'error', error: 'The connection dropped part way. Try again.' }));
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { ...cors, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
});
