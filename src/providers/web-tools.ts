/**
 * Anthropic server-side web tools — the model can read pages the builder
 * links (their existing site!) and search for current info, no scraping
 * service or extra key needed. Dependency-free so the logic is unit-testable;
 * the llm-proxy edge function mirrors these definitions server-side.
 */

// Models on the adaptive-thinking API surface — the _20260209 tool variants
// require this set, which is exactly where chats run; Haiku (internal calls
// only) never gets web tools.
const WEB_TOOL_MODELS_RE = /opus-(4-[78]|5)|sonnet-5|fable/;

/** Tool definitions for one request, or null when the model doesn't support
 *  them. max_uses bounds per-turn spend — web search bills per search. */
export function webToolsFor(model: string): Record<string, unknown>[] | null {
  if (!WEB_TOOL_MODELS_RE.test(model)) return null;
  return [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
  ];
}

/**
 * Track streamed server_tool_use blocks so the UI can show what the model is
 * doing during an otherwise-silent search/fetch. Feed it Anthropic SSE events;
 * it returns a human progress line when a tool call's input finishes arriving.
 */
export class ServerToolProgress {
  private blocks = new Map<number, { name: string; json: string }>();

  handle(event: {
    type?: string;
    index?: number;
    content_block?: { type?: string; name?: string };
    delta?: { type?: string; partial_json?: string };
  }): string | null {
    const index = event.index ?? -1;
    if (event.type === 'content_block_start' && event.content_block?.type === 'server_tool_use') {
      this.blocks.set(index, { name: event.content_block.name ?? '', json: '' });
      return null;
    }
    if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
      const block = this.blocks.get(index);
      if (block) block.json += event.delta.partial_json ?? '';
      return null;
    }
    if (event.type === 'content_block_stop' && this.blocks.has(index)) {
      const block = this.blocks.get(index)!;
      this.blocks.delete(index);
      try {
        const input = JSON.parse(block.json || '{}') as { query?: string; url?: string };
        if (block.name === 'web_search' && input.query) {
          return `\n[Searching the web: "${input.query}"]\n`;
        }
        if (block.name === 'web_fetch' && input.url) {
          return `\n[Reading ${input.url}]\n`;
        }
      } catch { /* partial input — fall through to the generic line */ }
      return block.name === 'web_fetch' ? '\n[Reading a web page]\n' : '\n[Searching the web]\n';
    }
    return null;
  }
}
