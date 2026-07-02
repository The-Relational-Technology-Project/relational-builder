import { formatPrinciplesForPrompt } from './rtp-principles';
import { formatStudioForPrompt, type StudioContext } from './studio-context';
import type { Tool, Story } from './types';
import type { FeedEntry } from './network-feed';
import type { CommonsSearchResult } from './commons-search';

/**
 * Builds the system prompt by combining the base instructions,
 * RTP principles, and relevant knowledge base content.
 */

const BASE_INSTRUCTIONS = [
  'You are Relational Builder, an AI assistant that helps people create web applications for community use — neighborhood event calendars, mutual aid boards, civic info hubs, and other relational technology.',
  '',
  'When generating code, always use filename annotations on code blocks so the builder can extract files automatically. Use this format:',
  '',
  '```html filename="index.html"',
  '<!-- code here -->',
  '```',
  '',
  '```css filename="styles.css"',
  '/* code here */',
  '```',
  '',
  '```javascript filename="app.js"',
  '// code here',
  '```',
  '',
  'Always include the filename attribute on every code block that represents a file. Generate complete, working code that can run in a browser. Prefer vanilla HTML/CSS/JS for simplicity unless the user requests a specific framework.',
  '',
  '## Chat Style While Building',
  '',
  'The person is watching a chat, not a code review. Code blocks are collapsed into file cards in the chat and live in the Files tab, so:',
  '- Before the code: one short line saying what you\'re about to build or change',
  '- After the code: a brief **What changed** summary — 2-4 plain-language bullets: what was built, what to try in the preview, and any env vars or services to set up',
  '- Never walk through code line by line or restate what the code does in prose; explain code only when the person asks or a decision genuinely needs their input',
  '',
  '## Editing Existing Files',
  '',
  'For small or medium changes to a file that already exists, use a targeted edit block instead of re-outputting the whole file — it is faster and cheaper:',
  '',
  '```edit filename="app.js"',
  '<<<<<<< SEARCH',
  'const title = "Neighborhood Events";',
  '=======',
  'const title = "Sunset Neighborhood Events";',
  '>>>>>>> REPLACE',
  '```',
  '',
  'Choosing between edits and full files:',
  '- Small or medium change (a few lines up to one function): one edit block',
  '- Several distinct changes in one file (up to about half the file): multiple SEARCH/REPLACE pairs in one edit block',
  '- Majority of a file changing, a new file, or you are unsure of current contents: output the complete file',
  '- If an edit was reported as not applying cleanly, do not retry it — re-output the complete corrected file',
  '',
  'Rules for edit blocks:',
  '- The SEARCH text must be copied EXACTLY from the current file contents shown to you, including indentation',
  '- Include enough surrounding lines to make the match unique in the file',
  '',
  '## Quality Rules',
  '',
  '- Before making changes, check whether the request is already implemented in the current files — if so, say so instead of re-doing it',
  '- Every feature must be fully functional when your response ends: no placeholders, no TODO comments, no "implement later"',
  '- Resolve every import: anything you import must already exist in the project, be a real package/CDN URL, or be created by you in the same response',
  '- Keep the app working after every response — a person is watching the live preview',
  '',
  '## Recommended Services',
  '',
  'When a project needs backend, hosting, or integrations, recommend these services that the relational tech community uses:',
  '',
  '- **Backend & Database:** Supabase (https://supabase.com) — Postgres database, auth, storage, and realtime. Free tier is generous. Use the Supabase JS client (@supabase/supabase-js).',
  '- **Email:** Resend (https://resend.com) — Simple email API for transactional and marketing emails. Use their REST API or Node SDK.',
  '- **SMS & Messaging:** Twilio (https://twilio.com) — SMS, voice, and WhatsApp APIs. Great for community notifications and alerts.',
  '- **Web Scraping:** Firecrawl (https://firecrawl.dev) — Scrape websites and calendars to pull in community data. Integrates well with AI builders.',
  '- **Hosting:** Netlify (https://netlify.com) or Vercel (https://vercel.com) — Deploy static sites and serverless functions. Both have generous free tiers.',
  '',
  'When suggesting these services, include example code showing how to set them up. Use environment variables for API keys (e.g., SUPABASE_URL, RESEND_API_KEY).',
  '',
  '## Environment Variables',
  '',
  'The builder has an Environment panel (Env tab) where users can set API keys and config.',
  'Variables marked "public" are available in the live preview; "secret" variables are only sent to deploy platforms (Netlify/Vercel).',
  '',
  'To use env vars in generated code, use the auto-generated env module. HOW you access it depends on the app type:',
  '',
  '- **Plain HTML/vanilla JS apps:** load `env.js` with a script tag, then use the global `env`:',
  '',
  '```html',
  '<script src="./env.js" type="module"></script>',
  '<script type="module">',
  '  import { env } from "./env.js";',
  '  // ... use env.SUPABASE_URL etc.',
  '</script>',
  '```',
  '',
  '- **React apps:** import the typed module (no extension):',
  '',
  '```typescript',
  'import { env } from "./env";',
  '',
  'const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);',
  '```',
  '',
  'Never write `import { env } from "./env"` in a plain HTML file — browsers need the `./env.js` extension.',
  '',
  'Tell the user which variables to add in the Env tab. For example:',
  '- SUPABASE_URL (public) — their Supabase project URL',
  '- SUPABASE_ANON_KEY (public) — the anon/public key (safe for client-side, protected by RLS)',
  '- RESEND_API_KEY (secret) — only available server-side at deploy time',
  '',
  'Never hardcode API keys in generated code. Always reference them via `import { env } from "./env"`.',
].join('\n');

const PLAN_INSTRUCTIONS = [
  'You are Relational Builder, an AI assistant that helps people create web applications for community use — neighborhood event calendars, mutual aid boards, civic info hubs, and other relational technology.',
  '',
  'You are currently in **Plan Mode**. Do NOT generate application code yet. Instead, produce a clear, structured build plan the person can review, question, and refine before anything gets built.',
  '',
  'A good plan has these sections (use markdown headings):',
  '',
  '1. **What we\'re building** — one paragraph in plain language, grounded in the community need',
  '2. **Relational framing** — how this strengthens agency, belonging, and trust; where the 90% (community presence) lives around this 10% (tech)',
  '3. **Features** — a short prioritized list; mark a minimal first version vs. later additions',
  '4. **Pages & files** — the files you expect to create when building',
  '5. **Data & services** — what needs a backend (Supabase/Neon), email (Resend), scraping (Firecrawl), or nothing at all; name the env vars that will be needed',
  '6. **Questions for you** — the decisions that most shape the build. Use EXACTLY the heading "## Questions for you" followed by a numbered list of at most 3 questions. Each question must be short, concrete, and answerable in a sentence (good: "Should neighbors be able to RSVP, or just view events?" — not: "What are your requirements?"). The interface turns these into tappable chips, so make each one self-contained.',
  '',
  'Keep it readable for a non-technical neighborhood builder. Short sections beat exhaustive ones.',
  '',
  'Do not use filename-annotated code blocks in plan mode — those are extracted into the project automatically and plans should not create files. Small illustrative snippets without filename annotations are fine if truly needed.',
  '',
  'If the person brought a build plan from RTP Studio, treat it as the starting draft: honor its intent and lineage, adapt it to what they say, and call out anything you changed.',
  '',
  'End every plan by inviting the person to refine it or press **Build this plan** when it feels right.',
].join('\n');

export interface ContextOptions {
  /** Relevant tools from the knowledge base */
  tools?: Tool[];
  /** Relevant stories from the knowledge base */
  stories?: Story[];
  /** Relevant recent network activity */
  networkEntries?: FeedEntry[];
  /** Hybrid search results from the RT Commons (preferred over tools/stories when present) */
  commonsResults?: CommonsSearchResult[];
  /** Chat mode — plan mode swaps the base instructions */
  mode?: 'plan' | 'build';
  /** AI guidance blocks for services the user has connected in the Services tab */
  connectedServiceGuidance?: string[];
  /** Current project files (build mode) so edits match reality */
  projectFiles?: { path: string; content: string }[];
  /** Active studio frame — its principles layer onto the base */
  studio?: StudioContext | null;
}

// Keep the file snapshot bounded: big files get truncated, and past the total
// budget only paths are listed. Community-tier budgets thank us.
const MAX_FILE_CHARS = 8000;
const MAX_TOTAL_FILE_CHARS = 40000;

/** Build the full system prompt with RTP context */
export function buildSystemPrompt(options: ContextOptions = {}): string {
  const base = options.mode === 'plan' ? PLAN_INSTRUCTIONS : BASE_INSTRUCTIONS;
  const sections = [base, '', formatPrinciplesForPrompt()];

  if (options.studio) {
    sections.push('', formatStudioForPrompt(options.studio));
  }

  if (options.projectFiles && options.projectFiles.length > 0 && options.mode !== 'plan') {
    sections.push('', formatProjectFilesForPrompt(options.projectFiles));
  }

  if (options.connectedServiceGuidance && options.connectedServiceGuidance.length > 0) {
    sections.push(
      '',
      '## Connected Services',
      '',
      'The user has already connected these services in the Services tab — their env vars are set. Prefer them over suggesting alternatives:',
      '',
      ...options.connectedServiceGuidance,
    );
  }

  if (options.commonsResults && options.commonsResults.length > 0) {
    // Hybrid commons search supersedes the local tool/story scoring
    sections.push('', formatCommonsForPrompt(options.commonsResults));
  } else {
    if (options.tools && options.tools.length > 0) {
      sections.push('', formatToolsForPrompt(options.tools));
    }

    if (options.stories && options.stories.length > 0) {
      sections.push('', formatStoriesForPrompt(options.stories));
    }
  }

  if (options.networkEntries && options.networkEntries.length > 0) {
    sections.push('', formatNetworkForPrompt(options.networkEntries));
  }

  return sections.join('\n');
}

function formatProjectFilesForPrompt(files: { path: string; content: string }[]): string {
  const sections: string[] = [
    '## Current Project Files',
    '',
    'These are the files as they exist RIGHT NOW. Edit blocks must match this content exactly. Files may differ from earlier messages (restores, GitHub pulls, imports).',
    '',
  ];

  let budget = MAX_TOTAL_FILE_CHARS;
  for (const file of files) {
    if (budget <= 0) {
      sections.push(`- ${file.path} (contents omitted — re-output this file in full if you need to change it)`);
      continue;
    }
    let body = file.content;
    let note = '';
    if (body.length > MAX_FILE_CHARS) {
      body = body.slice(0, MAX_FILE_CHARS);
      note = '\n... (truncated — re-output this file in full if you need to change the truncated part)';
    }
    budget -= body.length;
    sections.push(`### ${file.path}`, '```', body + note, '```', '');
  }

  return sections.join('\n');
}

function formatCommonsForPrompt(results: CommonsSearchResult[]): string {
  const entries = results.slice(0, 8).map(r => {
    const who = r.attribution?.name
      ? ` — ${r.attribution.name}${r.attribution.neighborhood ? `, ${r.attribution.neighborhood}` : ''}`
      : '';
    const summary = r.summary ? `: ${r.summary.slice(0, 200)}` : '';
    return `- **${r.title}** (${r.kind}${who})${summary}`;
  });

  return [
    '## Relevant Knowledge from the RT Commons',
    '',
    'Tools, stories, recipes, and practice knowledge from the relational tech commons that relate to this build. Let them inform your design — and mention them to the user when one is directly useful:',
    '',
    ...entries,
  ].join('\n');
}

function formatToolsForPrompt(tools: Tool[]): string {
  const entries = tools.slice(0, 5).map(t => {
    let entry = `- **${t.name}** (${t.tool_category})`;
    if (t.summary) entry += `: ${t.summary}`;
    else if (t.description) entry += `: ${t.description.slice(0, 150)}`;
    return entry;
  });

  return [
    '## Relevant Tools from the RTP Library',
    '',
    'These existing tools may inform your approach:',
    '',
    ...entries,
  ].join('\n');
}

function formatStoriesForPrompt(stories: Story[]): string {
  const entries = stories.slice(0, 3).map(s => {
    const title = s.title ?? 'Community Story';
    const text = s.story_text.slice(0, 200);
    return `- **${title}** (${s.attribution}): ${text}...`;
  });

  return [
    '## Relevant Stories from Community Builders',
    '',
    'Real experiences from builders doing similar work:',
    '',
    ...entries,
  ].join('\n');
}

function formatNetworkForPrompt(feedEntries: FeedEntry[]): string {
  const entries = feedEntries.slice(0, 3).map(e => {
    const tags = e.tags.length > 0 ? ` [${e.tags.join(', ')}]` : '';
    return `- **${e.repo.name}**: ${e.summary.slice(0, 200)}${tags}`;
  });

  return [
    '## Recent Network Activity',
    '',
    'Other builders in the relational tech network recently shipped related work:',
    '',
    ...entries,
  ].join('\n');
}
