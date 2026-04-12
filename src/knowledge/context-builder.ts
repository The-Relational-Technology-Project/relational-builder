import { formatPrinciplesForPrompt } from './rtp-principles';
import type { Tool, Story } from './types';

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
].join('\n');

export interface ContextOptions {
  /** Relevant tools from the knowledge base */
  tools?: Tool[];
  /** Relevant stories from the knowledge base */
  stories?: Story[];
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
