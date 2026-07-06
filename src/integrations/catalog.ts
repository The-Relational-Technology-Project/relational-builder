import type { EnvVar } from '@/store/env-store';

/**
 * Integration catalog for the apps people build (not the builder itself).
 * Connecting a service writes its env vars through the existing Env plumbing:
 * public vars flow into the live preview and shared links, secret vars only
 * reach deploy platforms (Netlify/Vercel) as server-side environment variables.
 * The AI's system prompt is told which services are connected so generated
 * code uses them correctly.
 */

export interface IntegrationField {
  envKey: string;
  label: string;
  placeholder: string;
  isSecret: boolean;
}

export interface IntegrationDef {
  id: string;
  name: string;
  tagline: string;
  /** Where to create an account / get credentials */
  keysUrl: string;
  keysLabel: string;
  fields: IntegrationField[];
  /** Injected into the AI system prompt when this service is connected */
  aiGuidance: string;
  /** Shown in the panel under the fields */
  setupHint: string;
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    tagline: 'Database, auth, storage, and realtime for your app',
    keysUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    keysLabel: 'Project settings → API',
    fields: [
      { envKey: 'SUPABASE_URL', label: 'Project URL', placeholder: 'https://xyz.supabase.co', isSecret: false },
      { envKey: 'SUPABASE_ANON_KEY', label: 'Anon (public) key', placeholder: 'eyJ...', isSecret: false },
    ],
    aiGuidance: [
      '- **Supabase is connected.** Generate code that creates a client with `createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)` from `@supabase/supabase-js` (import from "https://esm.sh/@supabase/supabase-js@2" in vanilla apps, or as a package import in React apps).',
      '  When the app needs tables, include the schema as a `supabase-schema.sql` file with CREATE TABLE statements and row-level-security policies, and tell the user to run it in the Supabase SQL editor.',
      '  **RLS rules — this is where AI-generated apps most often leak data, so follow them strictly:**',
      '  1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on EVERY table, no exceptions — a table without RLS is fully readable and writable by anyone with the anon key.',
      '  2. Write a separate policy per action (SELECT, INSERT, UPDATE, DELETE) — never one FOR ALL policy.',
      '  3. `USING (true)` is acceptable ONLY on SELECT for genuinely public data. Never on UPDATE or DELETE — that lets anyone modify anyone\'s rows. For anonymous community apps without auth, prefer insert-only designs (no update/delete policies at all) and moderate via the Supabase dashboard.',
      '  4. When the app has Supabase auth, scope writes with `auth.uid()` (e.g. `USING (auth.uid() = owner_id)` and matching `WITH CHECK`).',
      '  5. Never put the service_role key in app code, and add a comment block at the top of supabase-schema.sql summarizing in plain language who can read and write each table, so the builder can sanity-check it.',
    ].join('\n'),
    setupHint: 'The URL and anon key are safe for the browser when your tables use row-level security. The AI will generate a supabase-schema.sql for you to run in the Supabase SQL editor.',
  },
  {
    id: 'neon',
    name: 'Neon',
    tagline: 'Serverless Postgres for server-side data',
    keysUrl: 'https://console.neon.tech',
    keysLabel: 'Neon console → Connection details',
    fields: [
      { envKey: 'DATABASE_URL', label: 'Connection string', placeholder: 'postgresql://user:pass@...neon.tech/db', isSecret: true },
    ],
    aiGuidance: [
      '- **Neon (serverless Postgres) is connected.** The connection string lives in the secret env var `DATABASE_URL` — it must NEVER appear in browser code.',
      '  Use it only inside serverless functions (`netlify/functions/*.mts` for Netlify or `api/*.ts` for Vercel) with the `@neondatabase/serverless` driver, and have the browser call those functions with `fetch`.',
      '  Include the SQL schema as a `neon-schema.sql` file and tell the user to run it in the Neon SQL editor.',
    ].join('\n'),
    setupHint: 'Stored as a secret — never included in previews or shared links, only sent to Netlify/Vercel at deploy time for serverless functions.',
  },
  {
    id: 'resend',
    name: 'Resend',
    tagline: 'Transactional email (invites, notifications, digests)',
    keysUrl: 'https://resend.com/api-keys',
    keysLabel: 'resend.com → API Keys',
    fields: [
      { envKey: 'RESEND_API_KEY', label: 'API key', placeholder: 're_...', isSecret: true },
    ],
    aiGuidance: [
      '- **Resend (email) is connected.** The API key lives in the secret env var `RESEND_API_KEY` — never call Resend from the browser.',
      '  Generate a serverless function (`netlify/functions/send-email.mts` for Netlify or `api/send-email.ts` for Vercel) that POSTs to `https://api.resend.com/emails` with the `Authorization: Bearer` header, and have the browser call it with `fetch`.',
      '  Until the user verifies their own domain in Resend, use `onboarding@resend.dev` as the from address and mention that limitation.',
    ].join('\n'),
    setupHint: 'Stored as a secret. Email sending works once the project is deployed to Netlify or Vercel (serverless functions carry the key). Verify a sending domain in Resend for production.',
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    tagline: 'Scrape community calendars and websites into your app',
    keysUrl: 'https://www.firecrawl.dev/app/api-keys',
    keysLabel: 'firecrawl.dev → API Keys',
    fields: [
      { envKey: 'FIRECRAWL_API_KEY', label: 'API key', placeholder: 'fc-...', isSecret: true },
    ],
    aiGuidance: [
      '- **Firecrawl (web scraping) is connected.** The API key lives in the secret env var `FIRECRAWL_API_KEY` — never call Firecrawl from the browser.',
      '  Generate a serverless function (`netlify/functions/scrape.mts` for Netlify or `api/scrape.ts` for Vercel) that POSTs to `https://api.firecrawl.dev/v2/scrape` with the `Authorization: Bearer` header, passing the target URL and `formats: ["markdown"]`, and have the browser call it with `fetch`.',
      '  Be respectful: scrape public community pages (calendars, org sites), cache results, and avoid tight polling loops.',
    ].join('\n'),
    setupHint: 'Stored as a secret. Scraping runs in serverless functions once deployed — the AI wires the browser to call your function, not Firecrawl directly.',
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    tagline: 'AI features inside your app — summaries, drafting, Q&A',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keysLabel: 'console.anthropic.com → API Keys',
    fields: [
      { envKey: 'ANTHROPIC_API_KEY', label: 'API key', placeholder: 'sk-ant-...', isSecret: true },
    ],
    aiGuidance: [
      '- **Claude (Anthropic) is connected** for AI features inside the app. The key lives in the secret env var `ANTHROPIC_API_KEY` — it must NEVER appear in browser code or be sent to the browser.',
      '  Generate a serverless function (`netlify/functions/ai.mts` for Netlify or `api/ai.ts` for Vercel) that POSTs to `https://api.anthropic.com/v1/messages` with headers `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`, and body `{ model, max_tokens, system, messages }`. The browser calls that function with `fetch` — never Anthropic directly.',
      '  Model choice: `claude-haiku-4-5` for everyday in-app features (summaries, rewording, simple Q&A — fast and cheap); `claude-sonnet-5` when the feature needs real reasoning or longer writing.',
      '  Keep max_tokens modest (500–2000) for app features, pass user content in `messages` (never concatenated into the system prompt), and show a friendly loading state — responses take a few seconds.',
      '  Say clearly: AI features run once the app is deployed (Netlify/Vercel carry the secret); they will not work in the builder preview.',
    ].join('\n'),
    setupHint: 'Stored as a secret. AI features run in serverless functions once the app is deployed — the key never reaches the browser or the preview.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'AI text + image generation for your app',
    keysUrl: 'https://aistudio.google.com/apikey',
    keysLabel: 'aistudio.google.com → Get API key',
    fields: [
      { envKey: 'GEMINI_API_KEY', label: 'API key', placeholder: 'AIza...', isSecret: true },
    ],
    aiGuidance: [
      '- **Google Gemini is connected** for AI features inside the app. The key lives in the secret env var `GEMINI_API_KEY` — it must NEVER appear in browser code.',
      '  Generate a serverless function (`netlify/functions/ai.mts` for Netlify or `api/ai.ts` for Vercel) that POSTs to `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` with the `x-goog-api-key` header. The browser calls that function with `fetch` — never Google directly.',
      '  Use a current Gemini Flash model for text features; Gemini also generates and edits images (useful for flyers and artwork) via its image-capable models — return the base64 image data from the function.',
      '  Say clearly: AI features run once the app is deployed (Netlify/Vercel carry the secret); they will not work in the builder preview.',
    ].join('\n'),
    setupHint: 'Stored as a secret. AI features (including image generation) run in serverless functions once deployed — the key never reaches the browser.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'AI text + image generation for your app',
    keysUrl: 'https://platform.openai.com/api-keys',
    keysLabel: 'platform.openai.com → API keys',
    fields: [
      { envKey: 'OPENAI_API_KEY', label: 'API key', placeholder: 'sk-...', isSecret: true },
    ],
    aiGuidance: [
      '- **OpenAI is connected** for AI features inside the app. The key lives in the secret env var `OPENAI_API_KEY` — it must NEVER appear in browser code.',
      '  Generate a serverless function (`netlify/functions/ai.mts` for Netlify or `api/ai.ts` for Vercel) that calls `https://api.openai.com/v1/chat/completions` (text) or `https://api.openai.com/v1/images/generations` (images) with the `Authorization: Bearer` header. The browser calls that function with `fetch` — never OpenAI directly.',
      '  Say clearly: AI features run once the app is deployed (Netlify/Vercel carry the secret); they will not work in the builder preview.',
    ].join('\n'),
    setupHint: 'Stored as a secret. AI features (including image generation) run in serverless functions once deployed — the key never reaches the browser.',
  },
];

/** Which integrations are fully connected, given the current env vars */
export function getConnectedIntegrations(vars: EnvVar[]): IntegrationDef[] {
  const keys = new Set(vars.filter(v => v.value.trim()).map(v => v.key));
  return INTEGRATIONS.filter(def => def.fields.every(f => keys.has(f.envKey)));
}

// ── Community Cloud (zero-setup, RTP-hosted — not BYOK) ─────────────

export const COMMUNITY_CLOUD_KEYS = ['COMMUNITY_CLOUD_URL', 'APP_ID', 'APP_KEY'];

export function communityCloudConnected(vars: EnvVar[]): boolean {
  const keys = new Set(vars.filter(v => v.value.trim()).map(v => v.key));
  return COMMUNITY_CLOUD_KEYS.every(k => keys.has(k));
}

export const COMMUNITY_CLOUD_GUIDANCE = [
  '- **Community Cloud is connected** — zero-setup shared storage hosted by the Relational Tech Project. The app stores JSON documents in named collections via POST requests (get `env` per the Environment Variables rules — `import { env } from "./env.js"` in plain HTML, `from "./env"` in React):',
  '  ```javascript',
  '  async function cloudRequest(action, collection, extra = {}) {',
  '    const res = await fetch(env.COMMUNITY_CLOUD_URL, {',
  '      method: "POST",',
  '      headers: { "Content-Type": "application/json" },',
  '      body: JSON.stringify({ app_id: env.APP_ID, app_key: env.APP_KEY, action, collection, ...extra }),',
  '    });',
  '    return res.json();',
  '  }',
  '  // list:   await cloudRequest("list", "offers")            → {documents: [{id, data, created_at}]} newest first',
  '  // create: await cloudRequest("create", "offers", {data})  → {document}',
  '  // update: await cloudRequest("update", "offers", {id, data})',
  '  // delete: await cloudRequest("delete", "offers", {id})',
  '  ```',
  '  Documents are JSON objects up to 32KB; lists return up to 100; each app backend holds up to 5000 documents / 20MB on the free community tier. Prefer this over asking the user to set up Supabase for simple shared data (boards, calendars, signups, RSVPs). The builder can browse and moderate everything stored here in the Cloud tab.',
  '',
  '- **Neighbor sign-in (built into Community Cloud).** When the app needs people to have identities — RSVP with a name, edit your own posts, members-only content — use the email-code sign-in. No OAuth, no configuration:',
  '  ```javascript',
  '  // 1) Ask for email (+ optional name), send a 6-digit code:',
  '  await cloudRequest("auth_request", "any", { email, name });',
  '  // 2) They type the code from their email:',
  '  const { member_token, member } = await cloudRequest("auth_verify", "any", { email, code });',
  '  localStorage.setItem("member_token", member_token);   // lasts 30 days',
  '  // 3) Who am I? (member is null when signed out/expired)',
  '  const { member: me } = await cloudRequest("auth_me", "any", { member_token });',
  '  // 4) Sign out: await cloudRequest("auth_signout", "any", { member_token });',
  '  ```',
  '  Pass `member_token` with create/update/delete and the platform enforces the rules for you:',
  '  - Documents created while signed in are stamped with the member (documents carry `member_name` — use it to show who posted)',
  '  - Member-created documents can ONLY be updated/deleted by their creator — do not build your own permission checks on top',
  '  - `create` with `{visibility: "members"}` makes a document visible only to signed-in members (lists hide it from everyone else)',
  '  Build sign-in as a small inline flow (email → "check your email" → 6-digit code input), not a separate page. Keep reading open to everyone unless the person asks for members-only.',
  '',
  '  IMPORTANT: public documents are community-public — anyone using the app can read them, and anonymous writes stay open. Members-only visibility and creator-owned edits are real access control; everything else is openly shared neighborhood info. Add gentle norms in the UI for the open parts, never store secrets, and say this to the user when you first use it.',
].join('\n');
