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

/** A remote MCP server the model may query during a chat turn — currently
 *  the live civic-data endpoints (Responsive Cities Network), one per city.
 *  `name` is the server's stable id (the city slug) and doubles as the label
 *  the model addresses it by; `label` is what a person sees in progress. */
export interface McpServerRef {
  name: string;
  url: string;
  label: string;
}

/** Beta header that unlocks Anthropic's server-side MCP connector: Anthropic
 *  holds the MCP session and runs `tools/list` + `tools/call` itself, so the
 *  browser never has to speak JSON-RPC and the chat gets real tool results. */
export const MCP_CONNECTOR_BETA = 'mcp-client-2025-11-20';

/** Only public, TLS-served servers with slug-shaped names ride to Anthropic —
 *  a malformed row in `city_data_endpoints` must never take down a chat. */
export function sanitizeMcpServers(input: unknown): McpServerRef[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: McpServerRef[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const { name, url, label } = raw as Record<string, unknown>;
    if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) continue;
    if (typeof url !== 'string' || !/^https:\/\/[^\s"'<>]+$/.test(url)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, url, label: typeof label === 'string' && label.trim() ? label.trim() : name });
    if (out.length === 4) break;
  }
  return out;
}

/** The two request halves the MCP connector needs together: `mcp_servers`
 *  (where) and one `mcp_toolset` per server (which tools — all of them; the
 *  civic endpoints are read-only by construction). */
export function mcpRequestPartsFor(servers: McpServerRef[]): {
  mcp_servers: { type: 'url'; url: string; name: string }[];
  tools: { type: 'mcp_toolset'; mcp_server_name: string }[];
} | null {
  if (servers.length === 0) return null;
  return {
    mcp_servers: servers.map(s => ({ type: 'url', url: s.url, name: s.name })),
    tools: servers.map(s => ({ type: 'mcp_toolset', mcp_server_name: s.name })),
  };
}

/**
 * Track streamed server_tool_use / mcp_tool_use blocks so the UI can show
 * what the model is doing during an otherwise-silent search, fetch, or
 * civic-data query. Feed it Anthropic SSE events; it returns a human
 * progress line when a tool call's input finishes arriving, and a short
 * note when an MCP call comes back as an error.
 */
export class ServerToolProgress {
  private blocks = new Map<number, { name: string; json: string; server?: string }>();
  private labels: Map<string, string>;

  constructor(servers: McpServerRef[] = []) {
    this.labels = new Map(servers.map(s => [s.name, s.label]));
  }

  handle(event: {
    type?: string;
    index?: number;
    content_block?: { type?: string; name?: string; server_name?: string; is_error?: boolean };
    delta?: { type?: string; partial_json?: string };
  }): string | null {
    const index = event.index ?? -1;
    if (event.type === 'content_block_start' && event.content_block?.type === 'server_tool_use') {
      this.blocks.set(index, { name: event.content_block.name ?? '', json: '' });
      return null;
    }
    if (event.type === 'content_block_start' && event.content_block?.type === 'mcp_tool_use') {
      this.blocks.set(index, {
        name: event.content_block.name ?? '',
        json: '',
        server: event.content_block.server_name ?? '',
      });
      return null;
    }
    if (event.type === 'content_block_start' && event.content_block?.type === 'mcp_tool_result') {
      // Errors are worth a line (the model will say what it did about it);
      // a good result is just the reply continuing.
      return event.content_block.is_error ? '\n[The city data endpoint returned an error]\n' : null;
    }
    if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
      const block = this.blocks.get(index);
      if (block) block.json += event.delta.partial_json ?? '';
      return null;
    }
    if (event.type === 'content_block_stop' && this.blocks.has(index)) {
      const block = this.blocks.get(index)!;
      this.blocks.delete(index);
      if (block.server !== undefined) {
        const where = this.labels.get(block.server) ?? block.server;
        // "arcgis__query_data" → "query data"
        const what = block.name.replace(/^[a-z0-9]+__/, '').replace(/_/g, ' ');
        return `\n[Asking ${where || 'the city'} open data: ${what || 'query'}]\n`;
      }
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
