/** OpenAI-style multimodal content parts (all providers speak this shape;
 *  the llm-proxy translates to Anthropic image blocks server-side) */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

/** The text portion of a message's content */
export function contentToText(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map(p => p.text)
    .join('\n');
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  /** Summarized model reasoning streamed while it thinks — a progress
   *  signal for the UI, never part of the reply content */
  onReasoning?: (text: string) => void;
  /** Why generation stopped; "length" means it hit the output cap mid-reply */
  onFinishReason?: (reason: string) => void;
  /** A transient upstream failure (rate limit, overload) is being retried
   *  automatically — a chance to tell the person the wait is deliberate */
  onRetry?: (attempt: number, maxAttempts: number) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface ChatOptions {
  /** Attach Anthropic's server-side web tools (web search + web fetch) so the
   *  model can read linked pages and search for current info. Claude-only —
   *  other providers ignore it. Off by default so internal calls (quality
   *  review, summaries) can never spend money searching the web. */
  webTools?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  isDefault?: boolean;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;

  /** Whether this provider is ready to use (has required config) */
  isConfigured(): boolean;

  /** List available models */
  getModels(): Promise<ModelInfo[]>;

  /** Send a chat completion request with streaming */
  chat(
    messages: ChatMessage[],
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    opts?: ChatOptions,
  ): Promise<void>;
}
