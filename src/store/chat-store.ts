import { create } from 'zustand';
import type { ChatMessage } from '@/providers/types';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatState {
  messages: DisplayMessage[];
  isGenerating: boolean;
  abortController: AbortController | null;
  systemPrompt: string;

  addUserMessage: (content: string) => void;
  startAssistantMessage: () => string;
  appendToMessage: (id: string, token: string) => void;
  finalizeMessage: (id: string) => void;
  setIsGenerating: (generating: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  setSystemPrompt: (prompt: string) => void;
  clearMessages: () => void;

  /** Build the message array for sending to the LLM */
  toChatMessages: () => ChatMessage[];
}

let messageCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageCounter}`;
}

const DEFAULT_SYSTEM_PROMPT = [
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

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isGenerating: false,
  abortController: null,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,

  addUserMessage: (content: string) => {
    const msg: DisplayMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set(state => ({ messages: [...state.messages, msg] }));
  },

  startAssistantMessage: () => {
    const id = nextId();
    const msg: DisplayMessage = {
      id,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    set(state => ({ messages: [...state.messages, msg] }));
    return id;
  },

  appendToMessage: (id: string, token: string) => {
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, content: m.content + token } : m,
      ),
    }));
  },

  finalizeMessage: (id: string) => {
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, isStreaming: false } : m,
      ),
    }));
  },

  setIsGenerating: (generating: boolean) => set({ isGenerating: generating }),

  setAbortController: (controller: AbortController | null) =>
    set({ abortController: controller }),

  setSystemPrompt: (prompt: string) => set({ systemPrompt: prompt }),

  clearMessages: () => set({ messages: [] }),

  toChatMessages: (): ChatMessage[] => {
    const { systemPrompt, messages } = get();
    const chatMsgs: ChatMessage[] = [];

    if (systemPrompt) {
      chatMsgs.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      chatMsgs.push({ role: msg.role, content: msg.content });
    }

    return chatMsgs;
  },
}));
