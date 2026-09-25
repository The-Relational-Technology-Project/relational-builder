import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '@/store/safe-storage';
import type { ChatMessage } from '@/providers/types';
import { buildSystemPrompt } from '@/knowledge/context-builder';
import { collapseFileBlocks } from '@/project/code-extractor';
import { recordBuildEvent } from '@/report/build-log';

/** `message` is human-to-human: a note for collaborators the AI never sees */
export type ChatMode = 'plan' | 'build' | 'message';

/** A photo attached to a build message, compressed for the project (see
 * `compressToDataUrl` in project/assets.ts) and waiting to be stored as an
 * asset the moment the message sends. `name` is the original file name. */
export interface QueuedPhoto {
  name: string;
  dataUrl: string;
}

export interface GenerationProgress {
  startedAt: number;
  /** waiting → thinking (reasoning streams) → writing (reply streams) */
  phase: 'waiting' | 'thinking' | 'writing';
  /** When the thinking phase began — lets the status show how long it took */
  thinkingAt?: number;
  /** When the first reply token arrived */
  writingAt?: number;
  /** A deliberate wait (e.g. busy upstream, retrying) — shown instead of the
   *  phase label until the stream actually starts */
  notice?: string | null;
}

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
  /** Badge label for an isSync note. Defaults to "Synced from GitHub" so
   * existing sync messages keep their chip; other Builder notes (model
   * step-down, sharing plan) pass their own so they aren't mislabeled. */
  syncLabel?: string;
  /** True for automatic sends the Builder makes on the person's behalf
   * (quality-review fixes, error auto-fixes, length-limit continues). These
   * ride as role:'user' so the model acts on them, but must render as a
   * distinct Builder note — never as the person's own chat bubble. */
  isAuto?: boolean;
  /** Short badge label for an isAuto message (e.g. "Quality review") */
  autoLabel?: string;
  /** Attached images as data URLs (downscaled client-side) */
  attachments?: string[];
  /** For a build message whose attached photos were stored as project
   * assets: the wiring note the model sees after the message text (asset
   * names, paths, how to reference them). Persisted with the message so
   * later turns still know which image is which file. */
  photoNote?: string;
  /** True for assistant replies that ended in a provider/network error —
   * the reply's files were never applied, so a retry loses nothing */
  errored?: boolean;
  /** A note from one human to the others on a shared project. Lives in the
   * conversation (and syncs with it) but is never sent to the AI. */
  isCollabNote?: boolean;
  /** Who wrote a collaborator note — display name or email at write time */
  authorName?: string;
  /** Commons entries this reply actually drew on (surfaced by retrieval AND
   * named in the reply) — rendered as "Drew on the commons" chips that open
   * the entry's gallery card */
  commonsRefs?: { slug: string; title: string; kind: string }[];
  /** Studio library items this reply drew on (in the builder's studio AND
   * named in the reply) — "Drew on the studio" chips that open the item's
   * card in the gallery. Studio shelves never reach the commons matcher, so
   * without this the reply could credit FixMyStreet in prose while the chips
   * showed only public entries. */
  studioRefs?: { id: string; title: string; kind: string }[];
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
  /** Images that rode along with a queued follow-up. Attachments used to be
   *  the one input the composer silently refused mid-generation — the person
   *  pressed send, nothing happened, and nothing said why. */
  queuedAttachments: string[];
  /** Attached photos (already compressed for the project) waiting to be
   * stored as assets when the queued message sends */
  queuedPhotos: QueuedPhoto[];
  /** Photos attached while PLANNING that are for the app itself. No project
   * file exists yet to hold them (an asset before the first build would
   * make every "is there a project" check say yes), so they wait here and
   * become assets on the build send that follows. Persisted: a plan can
   * sit overnight before its build. */
  heldPhotos: QueuedPhoto[];
  holdPhotos: (photos: QueuedPhoto[]) => void;
  /** Claim the held photos for a build send — the slot empties */
  takeHeldPhotos: () => QueuedPhoto[];
  queueMessage: (content: string, attachments?: string[], photos?: QueuedPhoto[]) => void;
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
  /** Fingerprint of the last preview error a fix was attempted for, and how
   * many attempts it's had — repeated attempts at the SAME error escalate the
   * fix prompt instead of repeating it. Transient (never persisted). */
  lastFixSignature: string | null;
  fixAttempts: number;
  /** True while the queued/current send continues a cut-off build reply.
   * Continuations are fix sends (they never re-arm the error pass mid-chain)
   * but unlike error fixes they may chain — bounded by continuationCount. */
  pendingContinuationSend: boolean;
  /** Consecutive automatic continuations in the current build chain. Reset on
   * a clean completion or a fresh ask; the cap lives in ChatPanel. */
  continuationCount: number;
  /** The original ask of a first build whose reply was cut off — held so the
   * build-ready notification and quality review fire when the continuation
   * chain finishes, not after the first (incomplete) reply. */
  chainFirstBuildAsk: string | null;
  queueContinuation: (content: string, label?: string) => void;
  /** True while the background quality review reads the build */
  reviewing: boolean;
  /** When the current first build started "cooking" — from the initial build
   * send until the whole chain (continuations, auto-fixes) lands AND the
   * preview builds cleanly. While set, the chat hides the build's churn
   * (streaming files, cut-off notes, fix sends) behind one calm status line
   * and reveals the finished result all at once. Transient: never persisted —
   * a reload mid-build falls back to the normal message view. */
  cookingSince: number | null;
  startCooking: () => void;
  endCooking: () => void;
  /** Live generation progress — what's happening during the wait
   *  (transient: never persisted, cleared when generation ends) */
  progress: GenerationProgress | null;
  beginProgress: () => void;
  /** Reasoning is streaming — flips the phase to "thinking" (the text itself
   *  isn't kept: the status shows calm phases, not a feed) */
  progressReasoning: () => void;
  /** First reply token — flips the phase to "writing" */
  progressWriting: () => void;
  /** Explain a deliberate wait (busy upstream, automatic retry) */
  progressNotice: (text: string) => void;
  endProgress: () => void;
  /** Prefill the input without sending (e.g. answering a plan question) */
  draftMessage: string | null;
  setDraftMessage: (content: string | null) => void;
  /** Prefill image attachments alongside the draft (e.g. a gallery tool's
   *  screenshots riding along as visual reference for a remix) */
  draftAttachments: string[] | null;
  setDraftAttachments: (urls: string[] | null) => void;
  addUserMessage: (
    content: string,
    attachments?: string[],
    auto?: { label?: string },
    photoNote?: string,
  ) => void;
  /** Add a Builder-generated note (e.g. GitHub pull summary) to the conversation */
  addSyncMessage: (content: string, label?: string) => void;
  /** Add a human-to-human note for collaborators — stays out of the AI's history */
  addCollabNote: (content: string, author?: string, attachments?: string[]) => void;
  startAssistantMessage: (isPlan?: boolean) => string;
  /** Add an imported build plan (e.g. from RTP Studio) as a plan message */
  importBuildPlan: (planMarkdown: string) => void;
  appendToMessage: (id: string, token: string) => void;
  finalizeMessage: (id: string) => void;
  /** Mark an assistant reply as ended-in-error (renders a retry offer) */
  markErrored: (id: string) => void;
  /** Record which surfaced commons entries a finished reply drew on */
  setCommonsRefs: (id: string, refs: { slug: string; title: string; kind: string }[]) => void;
  setStudioRefs: (id: string, refs: { id: string; title: string; kind: string }[]) => void;
  setIsGenerating: (generating: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  setSystemPrompt: (prompt: string) => void;
  clearMessages: () => void;

  /** Where the model's view of the conversation begins — the index (into
   * the model-facing messages) that the last person-initiated send used.
   * Auto sends (continuations, fixes) reuse it rather than recomputing:
   * a build's own continuation passes add messages, and a window that
   * re-trims per pass drops the very turns the build was asked to follow.
   * A real report showed it: the plan said "Home, as shown" over ten mockup
   * screenshots, the first pass wrote only the shell, and by the second
   * pass eight of the ten screens had left the window — every UI file was
   * written blind. Transient. */
  historyWindowStart: number | null;
  /** Build the message array for sending to the LLM. `keepWindow` reuses
   * the window of the previous person-initiated send (auto sends). */
  toChatMessages: (keepWindow?: boolean) => ChatMessage[];
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
  // Plan is the default for a fresh start: new builders bring seeds of ideas,
  // and plan mode now meets them conversationally. "Build this plan" (or the
  // toggle) moves to build mode when the vision is ready.
  mode: 'plan' as ChatMode,

  setMode: (mode: ChatMode) => set({ mode }),

  queuedMessage: null,
  queuedAttachments: [],
  queuedPhotos: [],
  heldPhotos: [],
  holdPhotos: (photos: QueuedPhoto[]) =>
    set(state => ({ heldPhotos: [...state.heldPhotos, ...photos].slice(0, 4) })),
  takeHeldPhotos: () => {
    const held = get().heldPhotos;
    if (held.length > 0) set({ heldPhotos: [] });
    return held;
  },
  // A person's queued follow-up supersedes any pending auto-fix — their
  // intent wins, and it must not inherit the fix send's special handling.
  // Appends rather than replaces. A person who gets no clear acknowledgement
  // types it again — and the old single-slot queue silently overwrote the
  // earlier attempt, so a builder who rephrased between tries lost the first
  // wording outright. Joining them keeps every word they wrote; the queued
  // chip shows the combined text, so nothing is lost invisibly. Auto sends
  // (fixes, continuations) still replace: those are the Builder's own and
  // must not accumulate.
  queueMessage: (content: string, attachments?: string[], photos?: QueuedPhoto[]) =>
    set(state => ({
      queuedMessage:
        state.queuedMessage && !state.pendingFixSend && !state.pendingContinuationSend
          ? `${state.queuedMessage}\n\n${content}`
          : content,
      queuedAttachments:
        [...(state.queuedAttachments ?? []), ...(attachments ?? [])].slice(0, 4),
      queuedPhotos: [...(state.queuedPhotos ?? []), ...(photos ?? [])].slice(0, 4),
      pendingFixSend: false,
      pendingFixLabel: null,
      pendingContinuationSend: false,
    })),
  clearQueuedMessage: () => set({ queuedMessage: null, queuedAttachments: [], queuedPhotos: [] }),
  pendingFixSend: false,
  autoFixArmed: false,
  pendingFixLabel: null,
  queueFix: (content: string, label?: string) =>
    set({
      queuedMessage: content,
      queuedAttachments: [],
  queuedPhotos: [],
      pendingFixSend: true,
      pendingFixLabel: label ?? 'Automatic fix',
    }),
  lastFixSignature: null,
  fixAttempts: 0,
  pendingContinuationSend: false,
  continuationCount: 0,
  chainFirstBuildAsk: null,
  queueContinuation: (content: string, label?: string) =>
    set(state => ({
      queuedMessage: content,
      queuedAttachments: [],
  queuedPhotos: [],
      pendingFixSend: true,
      pendingFixLabel: label ?? 'Finishing the build',
      pendingContinuationSend: true,
      continuationCount: state.continuationCount + 1,
    })),
  reviewing: false,

  cookingSince: null,
  startCooking: () => set({ cookingSince: Date.now() }),
  endCooking: () => set(state => (state.cookingSince ? { cookingSince: null } : state)),

  progress: null,
  beginProgress: () =>
    set({ progress: { startedAt: Date.now(), phase: 'waiting' } }),
  progressReasoning: () =>
    set(state => {
      if (!state.progress) return state;
      // Already showing "thinking" with no notice → nothing to change; bail
      // without an update so per-token reasoning doesn't churn re-renders
      if (state.progress.phase === 'thinking' && !state.progress.notice) return state;
      return {
        progress: {
          ...state.progress,
          phase: 'thinking' as const,
          thinkingAt: state.progress.thinkingAt ?? Date.now(),
          notice: null,
        },
      };
    }),
  progressWriting: () =>
    set(state =>
      state.progress && state.progress.phase !== 'writing'
        ? {
            progress: {
              ...state.progress,
              phase: 'writing' as const,
              writingAt: Date.now(),
              notice: null,
            },
          }
        : state,
    ),
  progressNotice: (text: string) =>
    set(state =>
      state.progress ? { progress: { ...state.progress, notice: text } } : state,
    ),
  endProgress: () => set({ progress: null }),

  draftMessage: null,
  setDraftMessage: (content: string | null) => set({ draftMessage: content }),

  draftAttachments: null,
  setDraftAttachments: (urls: string[] | null) => set({ draftAttachments: urls }),

  hydrateChat: (messages: DisplayMessage[], mode: ChatMode) =>
    set({
      messages: messages.map(m => ({ ...m, isStreaming: false })),
      mode,
    }),

  addUserMessage: (content: string, attachments?: string[], auto?: { label?: string }, photoNote?: string) => {
    const msg: DisplayMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments?.length ? attachments : undefined,
      photoNote: photoNote || undefined,
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

  addSyncMessage: (content: string, label?: string) => {
    const msg: DisplayMessage = {
      id: nextId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      isSync: true,
      ...(label ? { syncLabel: label } : {}),
    };
    set(state => ({ messages: [...state.messages, msg] }));
  },

  addCollabNote: (content: string, author?: string, attachments?: string[]) => {
    const msg: DisplayMessage = {
      id: nextId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      isCollabNote: true,
      ...(author ? { authorName: author } : {}),
      attachments: attachments?.length ? attachments : undefined,
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

  markErrored: (id: string) => {
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, errored: true } : m,
      ),
    }));
  },

  setCommonsRefs: (id: string, refs: { slug: string; title: string; kind: string }[]) => {
    if (refs.length === 0) return;
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, commonsRefs: refs } : m,
      ),
    }));
  },

  setStudioRefs: (id: string, refs: { id: string; title: string; kind: string }[]) => {
    if (refs.length === 0) return;
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, studioRefs: refs } : m,
      ),
    }));
  },

  setIsGenerating: (generating: boolean) => set({ isGenerating: generating }),

  setAbortController: (controller: AbortController | null) =>
    set({ abortController: controller }),

  setSystemPrompt: (prompt: string) => set({ systemPrompt: prompt }),

  // Every fresh start (new project, planted prompt, gallery start) clears the
  // conversation — and returns to plan mode, the default for new builds.
  // Paths that want a different mode set it right after (fix sends and
  // "Build this plan" already flip to build themselves).
  clearMessages: () => set({ messages: [], mode: 'plan', historyWindowStart: null, heldPhotos: [] }),

  historyWindowStart: null,

  toChatMessages: (keepWindow = false): ChatMessage[] => {
    const { systemPrompt, messages: allMessages, historyWindowStart } = get();
    const chatMsgs: ChatMessage[] = [];

    if (systemPrompt) {
      chatMsgs.push({ role: 'system', content: systemPrompt });
    }

    // Collaborator notes are human-to-human by contract — they never reach
    // the model, in the window or anywhere else
    const messages = allMessages.filter(m => !m.isCollabNote);

    // Context discipline: long chats don't need full history — the Current
    // Project Files snapshot in the system prompt is authoritative for state.
    // Keep the recent window plus the original ask, and stay role-alternating.
    //
    // The window start moves in ERA_STEP jumps, not one message per turn: the
    // conversation history is a prompt-cache prefix (the proxy puts a cache
    // breakpoint on the latest user message), and a window that slides every
    // send would change the first cached byte every turn — writing history at
    // the 2× cache rate and never reading it. Stepped trimming keeps the
    // prefix byte-stable for ERA_STEP/2 turns at a time; the window breathes
    // between HISTORY_LIMIT and HISTORY_LIMIT + ERA_STEP − 1 messages, and
    // the extra breadth is mostly 0.1× cache reads.
    //
    // An auto send (continuation, fix) keeps the window its build request
    // used — see historyWindowStart. Messages only append, so the index
    // stays valid; a pin from a longer conversation than this one (cleared
    // history) is ignored.
    const HISTORY_LIMIT = 14;
    const ERA_STEP = 8;
    let window = messages;
    let omittedNote: string | null = null;
    const computed =
      messages.length > HISTORY_LIMIT
        ? Math.floor((messages.length - HISTORY_LIMIT) / ERA_STEP) * ERA_STEP
        : 0;
    const pinned =
      keepWindow && historyWindowStart !== null && historyWindowStart <= computed
        ? historyWindowStart
        : null;
    const start = pinned ?? computed;
    if (start > 0) {
      window = messages.slice(start);
      while (window.length > 0 && window[0].role !== 'user') {
        window = window.slice(1);
      }
      const dropped = messages.slice(0, messages.length - window.length);
      const droppedImages = dropped.reduce((n, m) => n + (m.attachments?.length ?? 0), 0);
      const firstUser = messages.find(m => m.role === 'user');
      // The model is told what it can no longer see — an image count in
      // particular, so a build that was told to match screenshots knows
      // they are gone rather than guessing that nothing was ever attached
      const scope = `${dropped.length} earlier messages omitted to save context${
        droppedImages > 0 ? `, including ${droppedImages} attached image${droppedImages === 1 ? '' : 's'} you can no longer see` : ''
      }`;
      omittedNote = firstUser
        ? `(${scope}. The project began with this request: "${firstUser.content.slice(0, 280)}". The Current Project Files in your instructions reflect all work so far.)`
        : `(${scope}. The Current Project Files in your instructions reflect all work so far.)`;
      // The trim is a build event: a report that can't show it leaves a
      // reader unable to tell why a build stopped matching its mockups
      if (historyWindowStart !== start) {
        recordBuildEvent(
          'context_trimmed',
          `${dropped.length} earlier messages left the model's view${
            droppedImages > 0 ? ` (${droppedImages} image${droppedImages === 1 ? '' : 's'} among them)` : ''
          }`,
        );
      }
    }
    if (pinned === null) set({ historyWindowStart: start });

    let injectedNote = false;
    for (const msg of window) {
      // A reply's own code is already in the project snapshot — send the
      // conversation, not a second copy of every file (see collapseFileBlocks)
      const body =
        msg.role === 'assistant'
          ? collapseFileBlocks(msg.content)
          : msg.photoNote
            ? `${msg.content}\n\n${msg.photoNote}`
            : msg.content;
      // Prefix the omission note onto the first user message in the window
      const text =
        !injectedNote && omittedNote && msg.role === 'user'
          ? ((injectedNote = true), `${omittedNote}\n\n${body}`)
          : body;

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
  storage: createJSONStorage(() => safeLocalStorage),
  // The code is the artifact — far history isn't worth a quota failure.
  // Attachments are base64 data URLs (the heaviest thing in the store);
  // only recent ones are worth the storage — older messages reload as
  // text-only. Cloud rows and shelf snapshots keep their own copies.
  partialize: (state) => ({
    messages: state.messages.slice(-200).map((m, i, arr) => {
      const { attachments, ...rest } = m;
      const keep = attachments?.length && i >= arr.length - 20;
      return { ...rest, ...(keep ? { attachments } : {}), isStreaming: false };
    }),
    mode: state.mode,
    heldPhotos: state.heldPhotos,
  } as unknown as ChatState),
}));
