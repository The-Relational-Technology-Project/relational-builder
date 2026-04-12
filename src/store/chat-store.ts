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

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  isGenerating: false,
  abortController: null,
  systemPrompt: '',

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
