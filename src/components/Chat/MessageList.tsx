import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildNotifyGranted } from '@/notify/build-ready';
import { useChatStore, type DisplayMessage } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { CodeBlock } from './CodeBlock';
import { ConnectionSuggestion } from './ConnectionSuggestion';
import { Button } from '@/components/ui/button';
import { Hammer, History, FileCode, ChevronDown, ChevronRight, Loader2, Copy, Check, ArrowDown, ArrowRight, GitBranch, Sparkles, MessagesSquare } from 'lucide-react';

/** "Today at 4:26 PM" / "Tuesday at 9:12 AM" — calm dividers between sittings */
function formatSitting(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `Today at ${time}`;
  const yesterday = new Date(now.getTime() - 86400_000);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  const withinWeek = now.getTime() - d.getTime() < 6 * 86400_000;
  const day = withinWeek
    ? d.toLocaleDateString(undefined, { weekday: 'long' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day} at ${time}`;
}

/** A new sitting starts after 20 quiet minutes */
const SITTING_GAP_MS = 20 * 60 * 1000;

/** Small copy affordance for assistant replies */
function CopyMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="text-muted-foreground/60 hover:text-foreground transition-colors"
      title="Copy message"
    >
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
    </button>
  );
}

/**
 * Code in chat renders as a compact file card — the code itself lives in the
 * Files tab. Expanding is one click for the times it matters.
 */
function CollapsedCode({
  code,
  language,
  meta,
  streaming,
}: {
  code: string;
  language?: string;
  meta?: string;
  streaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const filename = meta?.match(/(?:filename|title|file)\s*=\s*"?([^"\s]+)"?/)?.[1];
  const isEdit = language === 'edit';
  const lines = code.split('\n').length;
  const title = filename ?? (language && language !== 'text' ? `${language} code` : 'code');

  return (
    <div className="not-prose my-2 rounded-md border bg-background/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/60 transition-colors"
      >
        {streaming ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <FileCode className="size-3 text-muted-foreground shrink-0" />
        )}
        <span className="font-mono truncate">{title}</span>
        <span className="text-muted-foreground shrink-0">
          {streaming ? 'writing…' : isEdit ? `edited (${lines} lines)` : `${lines} lines`}
        </span>
        <span className="ml-auto text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </span>
      </button>
      {expanded && <CodeBlock code={code} language={language === 'edit' ? 'diff' : language} />}
    </div>
  );
}

/** Three quiet dots taking turns — says "still working" without a spinner */
function WorkingDots() {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="size-1 rounded-full bg-current rb-working-dot"
          style={{ animationDelay: `${i * 220}ms` }}
        />
      ))}
    </span>
  );
}

function formatSecs(secs: number): string {
  return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
}

/**
 * What's happening during the wait — calm phases, not a feed. The current
 * phase sits with softly pulsing dots; a finished thinking phase settles into
 * a quiet checked line. No text streams past.
 */
function GenerationStatus() {
  const phase = useChatStore(s => s.progress?.phase);
  const startedAt = useChatStore(s => s.progress?.startedAt);
  const thinkingAt = useChatStore(s => s.progress?.thinkingAt);
  const writingAt = useChatStore(s => s.progress?.writingAt);
  const notice = useChatStore(s => s.progress?.notice);
  const mode = useChatStore(s => s.mode);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!phase || !startedAt) return null;

  const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const label =
    notice ??
    (phase === 'waiting'
      ? 'Reaching Claude'
      : phase === 'thinking'
        ? 'Thinking it through'
        : mode === 'plan'
          ? 'Writing your plan — it appears here once it’s finished'
          : 'Writing — files land in the chat and Files tab as they finish');
  // Thinking wrapped up → it settles into a quiet done line above the writing
  const thoughtSecs =
    phase === 'writing' && thinkingAt && writingAt
      ? Math.max(1, Math.round((writingAt - thinkingAt) / 1000))
      : null;

  return (
    <div className="pl-1 space-y-1.5">
      {thoughtSecs !== null && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground/60">
          <Check className="size-3 shrink-0" />
          <span>Thought it through · {formatSecs(thoughtSecs)}</span>
        </p>
      )}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        <WorkingDots />
        {secs >= 3 && <span className="text-muted-foreground/60 tabular-nums">{formatSecs(secs)}</span>}
      </p>
    </div>
  );
}

/** Drafts survive reloads and tab switches mid-build */
const SHARING_PLAN_DRAFT_KEY = 'rb-sharing-plan-draft';

/** Show the wait activity once a build has clearly become a wait */
const WAIT_ACTIVITY_AFTER_S = 20;

/**
 * Something worth doing while the build runs: sketch who this is for.
 * First builds can take minutes — instead of a dead wait, the person plans
 * how the tool meets its neighbors. Notes written here land in the chat as
 * a sharing plan when the build finishes, so the thinking isn't lost (and
 * the AI sees it too). Once per project — after the plan is saved, waits
 * are quiet again.
 */
function WaitActivity() {
  const isGenerating = useChatStore(s => s.isGenerating);
  const mode = useChatStore(s => s.mode);
  const saved = useChatStore(s => s.sharingPlanSaved);
  const startedAt = useChatStore(s => s.progress?.startedAt);
  const [notes, setNotes] = useState(() => localStorage.getItem(SHARING_PLAN_DRAFT_KEY) ?? '');
  const [elapsed, setElapsed] = useState(0);
  const wasGenerating = useRef(false);

  // One-second heartbeat while waiting, to cross the show threshold
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [startedAt]);

  // Build finished → any notes become a sharing plan in the conversation
  useEffect(() => {
    if (isGenerating) {
      wasGenerating.current = true;
      return;
    }
    if (!wasGenerating.current) return;
    wasGenerating.current = false;
    const text = (localStorage.getItem(SHARING_PLAN_DRAFT_KEY) ?? '').trim();
    if (!text || useChatStore.getState().sharingPlanSaved) return;
    useChatStore.getState().addSyncMessage(
      `**Sharing plan** (written while your app was building)\n\n${text}`,
      'Sharing plan · your notes from the build',
    );
    useChatStore.getState().markSharingPlanSaved();
    localStorage.removeItem(SHARING_PLAN_DRAFT_KEY);
    setNotes('');
  }, [isGenerating]);

  const show =
    isGenerating && mode === 'build' && !saved && elapsed >= WAIT_ACTIVITY_AFTER_S;
  if (!show) return null;

  const update = (value: string) => {
    setNotes(value);
    localStorage.setItem(SHARING_PLAN_DRAFT_KEY, value);
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 space-y-2">
      <p className="text-sm font-medium">While this builds — a two-minute plan for sharing it</p>
      <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
        <li>Who else cares about what you're building?</li>
        <li>Who would have good ideas to make it better?</li>
        <li>Who would spread the word about it?</li>
      </ul>
      <textarea
        value={notes}
        onChange={e => update(e.target.value)}
        placeholder="A few names, a few notes — this saves into your project when the build finishes"
        rows={3}
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      {buildNotifyGranted() && (
        <p className="text-xs text-muted-foreground/70">
          Feel free to switch tabs — you'll get a notification when it's ready.
        </p>
      )}
    </div>
  );
}

interface MessageListProps {
  messages: DisplayMessage[];
  onBuildPlan?: () => void;
  isGenerating?: boolean;
}

export function MessageList({ messages, onBuildPlan, isGenerating }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reviewing = useChatStore(s => s.reviewing);
  // On an existing project a plan is a change to something built — the action
  // reads as approval of that change, not a first build
  const hasProject = useProjectStore(s => s.getFileCount() > 0);
  // Reading back through history shouldn't fight the auto-scroll — only
  // follow the stream while the person is already near the bottom
  const [nearBottom, setNearBottom] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages[messages.length - 1]?.content, nearBottom]);

  // A plan stays hidden while it's written and lands in one piece — when it
  // does, start the reader at its top instead of letting the bottom-follow
  // drop them at the end of a document they haven't read yet.
  const lastMessage = messages[messages.length - 1];
  const streamingPlanId = useRef<string | null>(null);
  useEffect(() => {
    if (lastMessage?.isPlan && lastMessage.isStreaming) {
      streamingPlanId.current = lastMessage.id;
      return;
    }
    if (lastMessage && streamingPlanId.current === lastMessage.id && !lastMessage.isStreaming) {
      streamingPlanId.current = null;
      const el = scrollRef.current?.querySelector(`[data-msg-id="${lastMessage.id}"]`);
      // After the bottom-follow above has had its say — this jump wins
      requestAnimationFrame(() => {
        setNearBottom(false); // hand the scroll back to the reader
        el?.scrollIntoView({ block: 'start' });
      });
    }
  }, [lastMessage]);

  if (messages.length === 0) {
    return null;
  }

  const showBuildAction =
    !isGenerating &&
    !!onBuildPlan &&
    lastMessage?.role === 'assistant' &&
    lastMessage.isPlan &&
    !lastMessage.isStreaming;

  return (
    <div className="flex-1 relative min-h-0">
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto py-4 px-4 space-y-4">
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const newSitting = !prev || msg.timestamp - prev.timestamp > SITTING_GAP_MS;
          return (
            <div key={msg.id} data-msg-id={msg.id}>
              {newSitting && (
                <p className="text-center text-xs text-muted-foreground/70 pt-2 pb-3">
                  {formatSitting(msg.timestamp)}
                </p>
              )}
              <MessageBubble message={msg} />
            </div>
          );
        })}
        {isGenerating && <GenerationStatus />}
        <WaitActivity />
        {reviewing && (
          <p className="text-sm text-muted-foreground pl-1 animate-pulse">
            Giving the build a quick once-over…
          </p>
        )}
        {showBuildAction && (
          <div className="flex justify-start pl-1">
            <Button size="sm" onClick={onBuildPlan}>
              {hasProject ? (
                <>
                  <Check className="size-3.5 mr-1.5" />
                  Approve this plan
                </>
              ) : (
                <>
                  <Hammer className="size-3.5 mr-1.5" />
                  Build this plan
                </>
              )}
            </Button>
          </div>
        )}
        {/* When the conversation overlaps with what another builder is up
            for, offer the connection — only after the reply settles */}
        {!isGenerating && lastMessage?.role === 'assistant' && !lastMessage.isStreaming && (
          <ConnectionSuggestion
            conversationText={messages.slice(-3).map(m => (typeof m.content === 'string' ? m.content : '')).join('\n')}
          />
        )}
        <div ref={bottomRef} />
        </div>
      </div>
      {!nearBottom && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 rounded-full border bg-background/95 shadow-md p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Jump to the latest"
        >
          <ArrowDown className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * A send the Builder made automatically on the person's behalf — a quality
 * review, an error auto-fix, a length-limit continue. It rides the chat as a
 * user turn so the model acts on it, but it is NOT the person's message, so it
 * renders as a calm, distinct Builder note (collapsed by default — the body is
 * a machine instruction the person rarely needs to read).
 */
function AutoMessage({ message }: { message: DisplayMessage }) {
  const [expanded, setExpanded] = useState(false);
  const label = message.autoLabel ?? 'Automatic fix';
  // First non-empty line reads as a human summary of what the Builder is doing
  const summary = message.content.split('\n').map(l => l.trim()).find(Boolean) ?? '';

  return (
    <div className="flex flex-col items-start">
      <div className="w-full rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2.5">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-1.5 text-left"
          title={expanded ? 'Hide details' : 'Show what the Builder sent'}
        >
          <Sparkles className="size-3 text-muted-foreground shrink-0" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground shrink-0">
            {label} · from Relational Builder
          </span>
          <span className="ml-auto text-muted-foreground shrink-0">
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </span>
        </button>
        {!expanded && summary && (
          <p className="mt-1 text-sm text-muted-foreground/80 truncate">{summary}</p>
        )}
        {expanded && (
          <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A message from one human to the others on a shared project. It travels
 * with the conversation (so collaborators see it in place, in order) but the
 * AI never receives it — the header says both things at a glance, and the
 * violet dress matches the Message mode that wrote it.
 */
function CollabNote({ message }: { message: DisplayMessage }) {
  return (
    <div className="flex flex-col items-start">
      <div className="w-full rounded-xl border border-violet-500/40 bg-violet-500/5 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1.5">
          <MessagesSquare className="size-3 shrink-0" />
          <span className="truncate">
            {message.authorName ? `${message.authorName} · to collaborators` : 'Note to collaborators'}
          </span>
          <span className="ml-auto shrink-0 normal-case tracking-normal text-muted-foreground/70">
            not sent to the AI
          </span>
        </div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex gap-1.5 mb-1.5">
            {message.attachments.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Attached image ${i + 1}`}
                className="h-20 max-w-[160px] object-cover rounded-md border"
              />
            ))}
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeCheckpointId = useProjectStore(s => s.activeCheckpointId);
  const restoreCheckpoint = useProjectStore(s => s.restoreCheckpoint);

  // Auto sends (quality review, error fix, length continue) render as a
  // distinct Builder note — after the hooks above, to keep hook order stable.
  if (message.isAuto) return <AutoMessage message={message} />;

  // A note from one collaborator to the others — human-to-human, the AI
  // never saw it, and it must not read as anyone's ask to the Builder
  if (message.isCollabNote) return <CollabNote message={message} />;

  // A plan being written stays out of view until it's done — watching a
  // document assemble line by line is disorienting. The status line says
  // it's coming; it lands whole, and MessageList starts the reader at its top.
  if (message.isPlan && message.isStreaming) return null;

  const checkpoint = !isUser ? checkpoints.find(c => c.msgId === message.id) : undefined;
  const isLatest = checkpoint &&
    (activeCheckpointId ? checkpoint.id === activeCheckpointId
      : checkpoints[checkpoints.length - 1]?.id === checkpoint.id);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`text-[0.9375rem] ${
          isUser
            ? 'max-w-[85%] rounded-xl px-4 py-2.5 bg-primary text-primary-foreground'
            : message.isPlan
              ? 'w-full rounded-xl px-4 py-3 bg-muted/60 border border-dashed border-primary/40'
              : message.isSync
                ? 'w-full rounded-xl px-4 py-3 bg-primary/5 border border-primary/20'
                : 'w-full px-1'
        }`}
      >
        {message.isPlan && (
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
            Build plan
          </div>
        )}
        {message.isSync && (
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-primary/80 mb-1.5">
            {message.syncLabel ? <Sparkles className="size-3" /> : <GitBranch className="size-3" />}
            {message.syncLabel ?? 'Synced from your repo'}
          </div>
        )}
        {isUser ? (
          <div>
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex gap-1.5 mb-1.5">
                {message.attachments.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Attached image ${i + 1}`}
                    className="h-20 max-w-[160px] object-cover rounded-md border border-primary-foreground/20"
                  />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-p:text-[0.9375rem] prose-li:text-[0.9375rem]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, node, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeStr = String(children).replace(/\n$/, '');

                  // Inline code vs block code
                  if (!match && !codeStr.includes('\n')) {
                    return (
                      <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-xs" {...props}>
                        {children}
                      </code>
                    );
                  }

                  // Fence meta (filename="...") survives remark→rehype in node.data.meta
                  const meta = (node?.data as { meta?: string } | undefined)?.meta;
                  return (
                    <CollapsedCode
                      code={codeStr}
                      language={match?.[1]}
                      meta={meta}
                      streaming={message.isStreaming && message.content.trimEnd().endsWith(codeStr.slice(-40))}
                    />
                  );
                },
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {message.isPlan && !message.isStreaming
                ? stripPlanQuestions(message.content)
                : message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
      {message.isPlan && !message.isStreaming && (
        <PlanQuestionCards message={message} />
      )}
      {!isUser && !message.isStreaming && message.content.trim() && (
        <div className="mt-1 pl-1 flex items-center gap-2">
          <CopyMessage content={message.content} />
        </div>
      )}
      {checkpoint && (
        <div className="mt-1 pl-1">
          {isLatest ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <History className="size-2.5" />
              {checkpoint.label} · current
            </span>
          ) : (
            <button
              onClick={() => {
                if (window.confirm(`Restore the project files to ${checkpoint.label}? Your chat stays as-is.`)) {
                  restoreCheckpoint(checkpoint.id);
                }
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
              title="Put the project files back to how they were after this change"
            >
              <History className="size-2.5" />
              Restore {checkpoint.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const QUESTION_HEADING_RE = /^#{2,3}\s+Questions?\s+for\s+you\s*$/im;

export interface PlanQuestion {
  question: string;
  /** Tappable answer choices (dash bullets under the question); may be empty */
  options: string[];
}

/**
 * Pull the "Question for you" section out of a plan. Questions render ONLY
 * as answer cards (the section is stripped from the message body so it never
 * appears twice). Each numbered item is a question; dash bullets directly
 * under it become one-tap answer options.
 */
export function extractPlanQuestions(content: string): PlanQuestion[] {
  const section = content.split(QUESTION_HEADING_RE)[1];
  if (!section) return [];
  const body = section.split(/^#{2,3}\s/m)[0];
  const questions: PlanQuestion[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const qMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (qMatch) {
      const question = qMatch[1].replace(/\*\*/g, '').trim();
      if (question.length > 5) questions.push({ question, options: [] });
      continue;
    }
    const oMatch = /^[-*]\s+(.+)$/.exec(line);
    if (oMatch && questions.length > 0) {
      const option = oMatch[1].replace(/\*\*/g, '').trim();
      const current = questions[questions.length - 1];
      if (option && current.options.length < 4) current.options.push(option);
    }
  }
  return questions.slice(0, 3);
}

/** Remove the question section from the rendered body (cards replace it) */
export function stripPlanQuestions(content: string): string {
  const idx = content.search(QUESTION_HEADING_RE);
  if (idx === -1) return content;
  const after = content.slice(idx);
  // Keep anything after the question list's following heading (rare)
  const rest = after.split(/^#{2,3}\s/m).slice(2).join('## ');
  return (content.slice(0, idx).trimEnd() + (rest ? `\n\n## ${rest}` : '')).trimEnd();
}

/**
 * Plan questions as one-tap answer cards: options are pills, free text is one
 * tap away, and the composed "question → answer" lines send themselves — no
 * copying questions into the composer. One question sends on tap; several
 * stage and send together once all are answered (or early via Send answers).
 * Only the newest plan's cards are live; older plans keep a quiet transcript
 * of what was asked.
 */
function PlanQuestionCards({ message }: { message: DisplayMessage }) {
  const questions = useMemo(() => extractPlanQuestions(message.content), [message.content]);
  const isNewest = useChatStore(s => s.messages[s.messages.length - 1]?.id === message.id);
  const isGenerating = useChatStore(s => s.isGenerating);
  const queueMessage = useChatStore(s => s.queueMessage);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);

  if (questions.length === 0) return null;

  const send = (final: Record<number, string>) => {
    const lines = questions
      .map((q, i) => (final[i] ? `${q.question} → ${final[i]}` : null))
      .filter(Boolean) as string[];
    if (lines.length === 0) return;
    setSent(true);
    queueMessage(lines.join('\n'));
  };

  const answer = (i: number, value: string) => {
    const next = { ...answers, [i]: value };
    setAnswers(next);
    // One question sends on tap; several send once the last one is answered
    if (questions.length === 1 || questions.every((_, idx) => next[idx])) send(next);
  };

  if (!isNewest || sent) {
    return (
      <div className="mt-1.5 space-y-1 max-w-[85%] pl-1">
        {questions.map((q, i) => (
          <p key={i} className="text-xs text-muted-foreground">{q.question}</p>
        ))}
      </div>
    );
  }

  const answeredCount = questions.filter((_, i) => answers[i]).length;

  return (
    <div className="mt-2 flex flex-col items-start gap-2 max-w-[85%]">
      {questions.map((q, i) => (
        <PlanQuestionCard
          key={i}
          question={q}
          staged={answers[i] ?? null}
          disabled={isGenerating}
          onAnswer={value => answer(i, value)}
        />
      ))}
      {questions.length > 1 && answeredCount > 0 && answeredCount < questions.length && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={isGenerating}
          onClick={() => send(answers)}
        >
          <ArrowRight className="size-3 mr-1" />
          Send {answeredCount === 1 ? 'answer' : 'answers'} — skip the rest
        </Button>
      )}
    </div>
  );
}

/** An option whose wording promises content the tap alone can't carry —
 *  "Here's the title, you search" sent bare cost a real build a round trip
 *  (the model had to reply "the title didn't come through — just the
 *  option"). These open the text field so the promised thing rides along. */
function optionPromisesContent(option: string): boolean {
  return /\b(here'?s|here is|i'?ll (paste|attach|send|share|type|write|describe|summarize)|i will (paste|attach|send|share|type|write|describe|summarize))\b/i.test(option);
}

function PlanQuestionCard({
  question, staged, disabled, onAnswer,
}: {
  question: PlanQuestion;
  staged: string | null;
  disabled: boolean;
  onAnswer: (value: string) => void;
}) {
  // Questions without options open straight into the text field
  const [typing, setTyping] = useState(question.options.length === 0);
  const [text, setText] = useState('');
  // A tapped option waiting for its promised content ("Here's the title…")
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const stagedIsCustom = !!staged && !question.options.includes(staged);

  const submitText = () => {
    const value = text.trim();
    // With a content-promising option staged, empty text still sends the
    // option alone — the person can decline to elaborate
    if (!value && !pendingOption) return;
    setTyping(question.options.length === 0);
    setText('');
    const composed = pendingOption
      ? value ? `${pendingOption} — ${value}` : pendingOption
      : value;
    setPendingOption(null);
    onAnswer(composed);
  };

  const tapOption = (option: string) => {
    if (optionPromisesContent(option)) {
      setPendingOption(option);
      setTyping(true);
    } else {
      setPendingOption(null);
      onAnswer(option);
    }
  };

  const pill = (selected: boolean) =>
    `inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs text-left transition-colors ${
      selected
        ? 'border-primary bg-primary/10 text-foreground'
        : 'border-border text-foreground hover:bg-primary/10 hover:border-primary/50'
    } disabled:opacity-50`;

  return (
    <div className="w-full rounded-lg border border-dashed border-primary/50 px-3 py-2.5 space-y-2">
      <p className="text-sm">{question.question}</p>
      {(question.options.length > 0 || stagedIsCustom) && (
        <div className="flex flex-wrap gap-1.5">
          {question.options.map(option => (
            <button
              key={option}
              disabled={disabled}
              onClick={() => tapOption(option)}
              className={pill(staged === option || pendingOption === option)}
            >
              {(staged === option || pendingOption === option) && <Check className="size-3 shrink-0" />}
              {option}
            </button>
          ))}
          {stagedIsCustom && (
            <button disabled={disabled} onClick={() => setTyping(true)} className={pill(true)}>
              <Check className="size-3 shrink-0" />
              {staged}
            </button>
          )}
          {question.options.length > 0 && !typing && (
            <button
              disabled={disabled}
              onClick={() => setTyping(true)}
              className="inline-flex items-center rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              Something else…
            </button>
          )}
        </div>
      )}
      {typing && (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus={question.options.length > 0}
            value={text}
            disabled={disabled}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitText();
              if (e.key === 'Escape' && question.options.length > 0) {
                setTyping(false);
                setPendingOption(null);
              }
            }}
            placeholder={pendingOption ? 'Add it here (or send as is)…' : 'Your answer…'}
            className="flex-1 min-w-0 rounded-md border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <Button size="sm" className="h-7 text-xs shrink-0" disabled={disabled || (!text.trim() && !pendingOption)} onClick={submitText}>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
