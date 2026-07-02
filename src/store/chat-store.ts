import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '@/providers/types';
import { buildSystemPrompt } from '@/knowledge/context-builder';

export type ChatMode = 'plan' | 'build';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  /** True for assistant messages produced in plan mode (renders a "Build this plan" action) */
  isPlan?: boolean;
  /** Attached images as data URLs (downscaled client-side) */
  attachments?: string[];
}

interface ChatState {
  messages: DisplayMessage[];
  isGenerating: boolean;
  abortController: AbortController | null;
  systemPrompt: string;
  mode: ChatMode;

  setMode: (mode: ChatMode) => void;
  /** Replace chat wholesale (cloud project load / remote sync) */
  hydrateChat: (messages: DisplayMessage[], mode: ChatMode) => void;
  /** A message queued from outside the chat (e.g. "fix this preview error") */
  queuedMessage: string | null;
  queueMessage: (content: string) => void;
  clearQueuedMessage: () => void;
  addUserMessage: (content: string, attachments?: string[]) => void;
  startAssistantMessage: (isPlan?: boolean) => string;
  /** Add an imported build plan (e.g. from RTP Studio) as a plan message */
  importBuildPlan: (planMarkdown: string) => void;
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

// System prompt now built dynamically via buildSystemPrompt() from knowledge/context-builder.ts
// Includes base instructions, RTP principles, and optionally relevant KB content

export const useChatStore = create<ChatState>()(persist((set, get) => ({
  messages: [],
  isGenerating: false,
  abortController: null,
  systemPrompt: buildSystemPrompt(),
  mode: 'build' as ChatMode,

  setMode: (mode: ChatMode) => set({ mode }),

  queuedMessage: null,
  queueMessage: (content: string) => set({ queuedMessage: content }),
  clearQueuedMessage: () => set({ queuedMessage: null }),

  hydrateChat: (messages: DisplayMessage[], mode: ChatMode) =>
    set({ messages: messages.map(m => ({ ...m, isStreaming: false })), mode }),

  addUserMessage: (content: string, attachments?: string[]) => {
    const msg: DisplayMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments?.length ? attachments : undefined,
    };
    set(state => ({ messages: [...state.messages, msg] }));
  },

  startAssistantMessage: (isPlan?: boolean) => {
    const id = nextId();
    const msg: DisplayMessage = {
      id,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      isPlan,
    };
    set(state => ({ messages: [...state.messages, msg] }));
    return id;
  },

  importBuildPlan: (planMarkdown: string) => {
    const userMsg: DisplayMessage = {
      id: nextId(),
      role: 'user',
      content: 'I brought a build plan from RTP Studio to start from.',
      timestamp: Date.now(),
    };
    const planMsg: DisplayMessage = {
      id: nextId(),
      role: 'assistant',
      content: planMarkdown,
      timestamp: Date.now(),
      isPlan: true,
    };
    set(state => ({
      messages: [...state.messages, userMsg, planMsg],
      mode: 'plan',
    }));
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
      if (msg.attachments?.length) {
        chatMsgs.push({
          role: msg.role,
          content: [
            { type: 'text' as const, text: msg.content },
            ...msg.attachments.map(url => ({
              type: 'image_url' as const,
              image_url: { url },
            })),
          ],
        });
      } else {
        chatMsgs.push({ role: msg.role, content: msg.content });
      }
    }

    return chatMsgs;
  },
}), {
  name: 'relational-builder-chat',
  partialize: (state) => ({
    messages: state.messages.map(m => ({ ...m, isStreaming: false })),
    mode: state.mode,
  } as unknown as ChatState),
}));
