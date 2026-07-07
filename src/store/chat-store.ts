import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '@/providers/types';
import { buildSystemPrompt } from '@/knowledge/context-builder';

export type ChatMode = 'plan' | 'build';

export interface GenerationProgress {
  startedAt: number;
  /** waiting → thinking (reasoning streams) → writing (reply streams) */
  phase: 'waiting' | 'thinking' | 'writing';
  /** Rolling tail of the model's summarized reasoning */
  thinking: string;
}

/** Keep only the readable tail of the reasoning feed */
const THINKING_TAIL_CHARS = 600;

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  /** True for assistant messages produced in plan mode (renders a "Build this plan" action) */
  isPlan?: boolean;
  /** True for Builder-generated notes (e.g. a GitHub pull summary) — shown
   * with a badge, included in history so the AI knows what happened */
  isSync?: boolean;
  /** True for automatic sends the Builder makes on the person's behalf
   * (quality-review fixes, error auto-fixes, length-limit continues). These
   * ride as role:'user' so the model acts on them, but must render as a
   * distinct Builder note — never as the person's own chat bubble. */
  isAuto?: boolean;
  /** Short badge label for an isAuto message (e.g. "Quality review") */
  autoLabel?: string;
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
  /** True while the queued/current send is an error-fix request — fix
   * attempts never re-arm the automatic pass, so it can't loop */
  pendingFixSend: boolean;
  /** One automatic error→fix pass is allowed after each normal build */
  autoFixArmed: boolean;
  /** Badge label for the pending auto-fix send, so the chat can mark it as a
   * Builder action rather than one of the person's own messages */
  pendingFixLabel: string | null;
  queueFix: (content: string, label?: string) => void;
  /** True while the background quality review reads the build */
  reviewing: boolean;
  /** The wait-time sharing plan has been saved into this conversation */
  sharingPlanSaved: boolean;
  markSharingPlanSaved: () => void;
  /** Live generation progress — what's happening during the wait
   *  (transient: never persisted, cleared when generation ends) */
  progress: GenerationProgress | null;
  beginProgress: () => void;
  /** Streamed reasoning summary — flips the phase to "thinking" */
  progressReasoning: (text: string) => void;
  /** First reply token — flips the phase to "writing" */
  progressWriting: () => void;
  endProgress: () => void;
  /** Prefill the input without sending (e.g. answering a plan question) */
  draftMessage: string | null;
  setDraftMessage: (content: string | null) => void;
  addUserMessage: (
    content: string,
    attachments?: string[],
    auto?: { label?: string },
  ) => void;
  /** Add a Builder-generated note (e.g. GitHub pull summary) to the conversation */
  addSyncMessage: (content: string) => void;
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
  // A person's queued follow-up replaces any pending auto-fix — their
  // intent wins, and it must not inherit the fix send's special handling
  queueMessage: (content: string) =>
    set({ queuedMessage: content, pendingFixSend: false, pendingFixLabel: null }),
  clearQueuedMessage: () => set({ queuedMessage: null }),
  pendingFixSend: false,
  autoFixArmed: false,
  pendingFixLabel: null,
  queueFix: (content: string, label?: string) =>
    set({ queuedMessage: content, pendingFixSend: true, pendingFixLabel: label ?? 'Automatic fix' }),
  reviewing: false,
  sharingPlanSaved: false,
  markSharingPlanSaved: () => set({ sharingPlanSaved: true }),

  progress: null,
  beginProgress: () =>
    set({ progress: { startedAt: Date.now(), phase: 'waiting', thinking: '' } }),
  progressReasoning: (text: string) =>
    set(state => {
      if (!state.progress) return state;
      const thinking = (state.progress.thinking + text).slice(-THINKING_TAIL_CHARS);
      return { progress: { ...state.progress, phase: 'thinking' as const, thinking } };
    }),
  progressWriting: () =>
    set(state =>
      state.progress && state.progress.phase !== 'writing'
        ? { progress: { ...state.progress, phase: 'writing' as const } }
        : state,
    ),
  endProgress: () => set({ progress: null }),

  draftMessage: null,
  setDraftMessage: (content: string | null) => set({ draftMessage: content }),

  hydrateChat: (messages: DisplayMessage[], mode: ChatMode) =>
    set({
      messages: messages.map(m => ({ ...m, isStreaming: false })),
      mode,
      // Cloud-loaded chats carry the plan inside the messages themselves
      sharingPlanSaved: messages.some(
        m => m.isSync && m.content.startsWith('**Sharing plan**'),
      ),
    }),

  addUserMessage: (content: string, attachments?: string[], auto?: { label?: string }) => {
    const msg: DisplayMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments?.length ? attachments : undefined,
      isAuto: auto ? true : undefined,
      autoLabel: auto?.label,
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

  addSyncMessage: (content: string) => {
    const msg: DisplayMessage = {
      id: nextId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      isSync: true,
    };
    set(state => ({ messages: [...state.messages, msg] }));
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

  clearMessages: () => set({ messages: [], sharingPlanSaved: false }),

  toChatMessages: (): ChatMessage[] => {
    const { systemPrompt, messages } = get();
    const chatMsgs: ChatMessage[] = [];

    if (systemPrompt) {
      chatMsgs.push({ role: 'system', content: systemPrompt });
    }

    // Context discipline: long chats don't need full history — the Current
    // Project Files snapshot in the system prompt is authoritative for state.
    // Keep the recent window plus the original ask, and stay role-alternating.
    const HISTORY_LIMIT = 14;
    let window = messages;
    let omittedNote: string | null = null;
    if (messages.length > HISTORY_LIMIT) {
      window = messages.slice(-HISTORY_LIMIT);
      while (window.length > 0 && window[0].role !== 'user') {
        window = window.slice(1);
      }
      const firstUser = messages.find(m => m.role === 'user');
      omittedNote = firstUser
        ? `(Earlier conversation omitted to save context. The project began with this request: "${firstUser.content.slice(0, 280)}". The Current Project Files in your instructions reflect all work so far.)`
        : '(Earlier conversation omitted to save context. The Current Project Files in your instructions reflect all work so far.)';
    }

    let injectedNote = false;
    for (const msg of window) {
      // Prefix the omission note onto the first user message in the window
      const text =
        !injectedNote && omittedNote && msg.role === 'user'
          ? ((injectedNote = true), `${omittedNote}\n\n${msg.content}`)
          : msg.content;

      if (msg.attachments?.length) {
        chatMsgs.push({
          role: msg.role,
          content: [
            { type: 'text' as const, text },
            ...msg.attachments.map(url => ({
              type: 'image_url' as const,
              image_url: { url },
            })),
          ],
        });
      } else {
        // Builder-generated notes (GitHub pull summaries) can land right
        // after an assistant reply — merge consecutive same-role text
        // messages so providers always see alternating roles
        const prev = chatMsgs[chatMsgs.length - 1];
        if (
          prev &&
          prev.role === msg.role &&
          typeof prev.content === 'string'
        ) {
          prev.content = `${prev.content}\n\n${text}`;
        } else {
          chatMsgs.push({ role: msg.role, content: text });
        }
      }
    }

    return chatMsgs;
  },
}), {
  name: 'relational-builder-chat',
  partialize: (state) => ({
    messages: state.messages.map(m => ({ ...m, isStreaming: false })),
    mode: state.mode,
    sharingPlanSaved: state.sharingPlanSaved,
  } as unknown as ChatState),
}));
