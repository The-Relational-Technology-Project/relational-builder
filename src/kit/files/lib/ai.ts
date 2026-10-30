/**
 * AI for a built app, as named jobs rather than an open prompt box.
 *
 *   import { summarize, match, resurface, ask, aiRuntimeLabel } from "@/lib/ai";
 *
 * Where the calls go is the project's runtime setting, carried in the app's
 * public env (AI_RUNTIME, AI_RUNTIME_ENDPOINT, AI_RUNTIME_MODEL,
 * AI_RUNTIME_FALLBACK), written by the Builder's "Where this app's AI runs"
 * card:
 *
 *   community  an open-weight model the community can host, through the
 *              Community Cloud ai_chat capability (no key in the app)
 *   local      an OpenAI-compatible endpoint on this device or a box in the
 *              room (Ollama, llama.cpp, LM Studio), called straight from the
 *              browser; when it is unreachable the error says so plainly
 *              and, unless the setting asks for the community fallback,
 *              nothing is sent anywhere else
 *   byok       the key the builder connected, through the same capability
 *
 * Every result says where it ran (`ran`), so the app can show it. Text the
 * model wrote carries the `sources` it was given back out, so the app can
 * link each summary to the notes it came from.
 */

export type AIRuntimeKind = 'community' | 'local' | 'byok';

export interface AIRuntime {
  kind: AIRuntimeKind;
  endpoint?: string;
  model?: string;
  fallback: 'none' | 'community';
}

export interface AIRan {
  kind: AIRuntimeKind;
  /** 'local' is this device or the room; 'community' and 'hosted' left it */
  host: 'local' | 'community' | 'hosted';
  model?: string;
  /** True when a local endpoint failed and the community answered instead */
  fellBack?: boolean;
}

export interface AIResult {
  text: string;
  ran: AIRan;
  /** Whatever sources the caller passed in, back out, for linking */
  sources?: string[];
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** The AI could not answer. `message` is written for the person using the app. */
export class AIUnavailableError extends Error {
  readonly runtime: AIRuntimeKind;
  constructor(message: string, runtime: AIRuntimeKind) {
    super(message);
    this.name = 'AIUnavailableError';
    this.runtime = runtime;
  }
}

type EnvShape = Record<string, string | undefined>;

const LOCAL_DEFAULT_ENDPOINT = 'http://localhost:11434/v1';
const LOCAL_DEFAULT_MODEL = 'qwen2.5:7b';
const LOCAL_TIMEOUT_MS = 60_000;

let configured: EnvShape | null = null;

/** Hand the helper the app's env explicitly (`configureAI(env)` from
 *  `@/env`). Not needed when the env is on `window.env`, which the
 *  Builder's generated env modules set. */
export function configureAI(env: EnvShape): void {
  configured = env;
}

function readEnv(): EnvShape {
  if (configured) return configured;
  const g = globalThis as { env?: unknown };
  return g.env && typeof g.env === 'object' ? (g.env as EnvShape) : {};
}

/** The runtime this app is set to. Community when nothing says otherwise. */
export function aiRuntime(): AIRuntime {
  const env = readEnv();
  const kind = env.AI_RUNTIME;
  if (kind === 'local') {
    return {
      kind,
      endpoint: env.AI_RUNTIME_ENDPOINT?.trim() || LOCAL_DEFAULT_ENDPOINT,
      model: env.AI_RUNTIME_MODEL?.trim() || LOCAL_DEFAULT_MODEL,
      fallback: env.AI_RUNTIME_FALLBACK === 'community' ? 'community' : 'none',
    };
  }
  if (kind === 'byok') return { kind, fallback: 'none' };
  return { kind: 'community', fallback: 'none' };
}

/** One line for a footer or a settings screen: where this app's AI runs. */
export function aiRuntimeLabel(): string {
  const rt = aiRuntime();
  if (rt.kind === 'local') {
    const onDevice = /localhost|127\.0\.0\.1/.test(rt.endpoint ?? '');
    return `AI runs ${onDevice ? 'on this device' : 'on a computer in the room'} (${rt.model})`;
  }
  if (rt.kind === 'byok') return 'AI runs on the key this app\'s builder connected';
  return 'AI runs on Community AI (an open model the community can host)';
}

function capabilitiesUrl(env: EnvShape): string | null {
  if (env.COMMUNITY_CAPABILITIES_URL) return env.COMMUNITY_CAPABILITIES_URL;
  if (env.COMMUNITY_CLOUD_URL) return env.COMMUNITY_CLOUD_URL.replace(/app-data$/, 'app-capabilities');
  return null;
}

async function askCommunity(
  messages: AIMessage[],
  system: string | undefined,
  maxTokens: number,
  kind: 'community' | 'byok',
): Promise<AIResult> {
  const env = readEnv();
  const url = capabilitiesUrl(env);
  if (!url || !env.APP_ID || !env.APP_KEY) {
    throw new AIUnavailableError(
      'This app is not connected to Community Cloud yet, so its AI has nowhere to run. Open it in the Builder and connect the Cloud tab.',
      kind,
    );
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'ai_chat',
      app_id: env.APP_ID,
      app_key: env.APP_KEY,
      messages,
      system,
      max_tokens: maxTokens,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string; service?: string; model?: string };
  if (!res.ok || data.error || typeof data.text !== 'string') {
    throw new AIUnavailableError(data.error ?? 'The AI did not answer. Please try again in a moment.', kind);
  }
  return {
    text: data.text,
    ran: { kind, host: kind === 'byok' ? 'hosted' : 'community', model: data.model },
  };
}

async function askLocal(
  rt: AIRuntime,
  messages: AIMessage[],
  system: string | undefined,
  maxTokens: number,
): Promise<AIResult> {
  const endpoint = (rt.endpoint ?? LOCAL_DEFAULT_ENDPOINT).replace(/\/+$/, '');
  const model = rt.model ?? LOCAL_DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCAL_TIMEOUT_MS);
  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('empty answer');
    return { text, ran: { kind: 'local', host: 'local', model: data.model ?? model } };
  } finally {
    clearTimeout(timer);
  }
}

function localUnreachableMessage(rt: AIRuntime): string {
  const onDevice = /localhost|127\.0\.0\.1/.test(rt.endpoint ?? '');
  return onDevice
    ? `This app's AI runs on a model on this device (${rt.model}), and it isn't reachable right now. Start it (for example, open Ollama) and try again. Nothing was sent anywhere else.`
    : `This app's AI runs on a computer in the room (${rt.endpoint}), and it isn't reachable right now. Check that it is on and on the same network. Nothing was sent anywhere else.`;
}

/**
 * The one door the named jobs below go through. Prefer those; reach for
 * `ask` when an app needs a job they do not cover, and still give it a
 * name in the UI (a button that does one thing), never a blank prompt box.
 */
export async function ask(
  messages: AIMessage[],
  system?: string,
  opts: { maxTokens?: number; sources?: string[] } = {},
): Promise<AIResult> {
  const maxTokens = opts.maxTokens ?? 1024;
  const rt = aiRuntime();
  let result: AIResult;
  if (rt.kind === 'local') {
    try {
      result = await askLocal(rt, messages, system, maxTokens);
    } catch (err) {
      if (err instanceof AIUnavailableError) throw err;
      if (rt.fallback !== 'community') throw new AIUnavailableError(localUnreachableMessage(rt), 'local');
      const fallback = await askCommunity(messages, system, maxTokens, 'community');
      result = { ...fallback, ran: { ...fallback.ran, fellBack: true } };
    }
  } else {
    result = await askCommunity(messages, system, maxTokens, rt.kind);
  }
  return opts.sources ? { ...result, sources: opts.sources } : result;
}

/** Summarize notes, a transcript, a thread. `sources` names where the text
 *  came from (note ids, URLs, "Meeting 3 Oct"); they come back on the result
 *  so the app can link the summary to them. */
export function summarize(
  text: string,
  opts: { focus?: string; sources?: string[]; maxTokens?: number } = {},
): Promise<AIResult> {
  const system = [
    'Summarize the text the person gives you, plainly and briefly, in their own words where you can.',
    'Do not add facts that are not in the text. If something is unclear, say so rather than guess.',
    opts.focus ? `Focus on: ${opts.focus}` : '',
  ].filter(Boolean).join(' ');
  return ask([{ role: 'user', content: text }], system, { maxTokens: opts.maxTokens ?? 600, sources: opts.sources });
}

export interface MatchItem {
  id: string;
  text: string;
}

export interface MatchPair {
  need: string;
  offer: string;
  why: string;
}

/** Pair needs with offers (a ride with a driver, a question with a neighbor
 *  who knows). Returns the pairs the model proposed; the app decides. */
export async function match(
  needs: MatchItem[],
  offers: MatchItem[],
  opts: { maxTokens?: number } = {},
): Promise<AIResult & { pairs: MatchPair[] }> {
  const system = [
    'You match needs with offers for a small community. Propose at most one offer per need, only when it genuinely fits.',
    'Answer with one line per match, exactly in this form and nothing else:',
    'NEED <need id> -> OFFER <offer id>: <one short reason>',
    'If nothing fits a need, leave it out.',
  ].join(' ');
  const content = [
    'NEEDS:',
    ...needs.map(n => `- [${n.id}] ${n.text}`),
    '',
    'OFFERS:',
    ...offers.map(o => `- [${o.id}] ${o.text}`),
  ].join('\n');
  const result = await ask([{ role: 'user', content }], system, { maxTokens: opts.maxTokens ?? 800 });
  const pairs: MatchPair[] = [];
  const needIds = new Set(needs.map(n => n.id));
  const offerIds = new Set(offers.map(o => o.id));
  for (const line of result.text.split('\n')) {
    const m = /NEED\s+(\S+?)\s*->\s*OFFER\s+(\S+?)\s*:\s*(.+)/.exec(line);
    if (m && needIds.has(m[1]) && offerIds.has(m[2])) pairs.push({ need: m[1], offer: m[2], why: m[3].trim() });
  }
  return { ...result, pairs };
}

export interface ResurfaceItem {
  id: string;
  text: string;
  /** When it was written or happened, as the app knows it */
  when?: string;
}

/** Bring back the few stored items that matter for a moment ("what did we
 *  decide about the garden gate?", "who offered to drive next week?").
 *  Returns the ids the model picked, in order, plus its one-line reason. */
export async function resurface(
  items: ResurfaceItem[],
  moment: string,
  opts: { limit?: number; maxTokens?: number } = {},
): Promise<AIResult & { picks: string[] }> {
  const limit = opts.limit ?? 3;
  const system = [
    `From the items the person gives you, pick at most ${limit} that matter for what they are asking about now.`,
    'Answer with one line per pick, exactly in this form and nothing else:',
    'PICK <item id>: <one short reason>',
    'Pick nothing if nothing applies.',
  ].join(' ');
  const content = [
    `NOW: ${moment}`,
    '',
    'ITEMS:',
    ...items.map(i => `- [${i.id}]${i.when ? ` (${i.when})` : ''} ${i.text}`),
  ].join('\n');
  const result = await ask([{ role: 'user', content }], system, { maxTokens: opts.maxTokens ?? 500 });
  const known = new Set(items.map(i => i.id));
  const picks: string[] = [];
  for (const line of result.text.split('\n')) {
    const m = /PICK\s+(\S+?)\s*:/.exec(line);
    if (m && known.has(m[1]) && !picks.includes(m[1])) picks.push(m[1]);
  }
  return { ...result, picks: picks.slice(0, limit), sources: picks.slice(0, limit) };
}
