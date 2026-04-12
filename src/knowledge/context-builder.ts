import { formatPrinciplesForPrompt } from './rtp-principles';
import type { Tool, Story } from './types';
import type { FeedEntry } from './network-feed';

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
  'To use env vars in generated code, import from the auto-generated env module:',
  '',
  '```typescript',
  'import { env } from "./env";',
  '',
  'const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);',
  '```',
  '',
  'Tell the user which variables to add in the Env tab. For example:',
  '- SUPABASE_URL (public) — their Supabase project URL',
  '- SUPABASE_ANON_KEY (public) — the anon/public key (safe for client-side, protected by RLS)',
  '- RESEND_API_KEY (secret) — only available server-side at deploy time',
  '',
  'Never hardcode API keys in generated code. Always reference them via `import { env } from "./env"`.',
].join('\n');

export interface ContextOptions {
  /** Relevant tools from the knowledge base */
  tools?: Tool[];
  /** Relevant stories from the knowledge base */
  stories?: Story[];
  /** Relevant recent network activity */
  networkEntries?: FeedEntry[];
}

/** Build the full system prompt with RTP context */
export function buildSystemPrompt(options: ContextOptions = {}): string {
  const sections = [BASE_INSTRUCTIONS, '', formatPrinciplesForPrompt()];

  if (options.tools && options.tools.length > 0) {
    sections.push('', formatToolsForPrompt(options.tools));
  }

  if (options.stories && options.stories.length > 0) {
    sections.push('', formatStoriesForPrompt(options.stories));
  }

  if (options.networkEntries && options.networkEntries.length > 0) {
    sections.push('', formatNetworkForPrompt(options.networkEntries));
  }

  return sections.join('\n');
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
