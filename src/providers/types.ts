export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
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
  ): Promise<void>;
}
