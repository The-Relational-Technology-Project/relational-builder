import { memo, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { buildNotifyGranted } from '@/notify/build-ready';
import { useChatStore, type DisplayMessage } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { usePanelStore } from '@/store/panel-store';
import { artifactDisplay } from '@/project/display-name';
import { useUIStore } from '@/store/ui-store';
import { isReadyToBuildOption, startBuildFromPlan } from './build-from-plan';
import { renderableContent } from './display';
import { CodeBlock } from './CodeBlock';
import { ConnectionSuggestion } from './ConnectionSuggestion';
import { Button } from '@/components/ui/button';
import { Hammer, History, FileCode, ChevronDown, ChevronRight, Loader2, Copy, Check, ArrowDown, ArrowRight, Code2, GitBranch, Sparkles, MessagesSquare, BookOpen } from 'lucide-react';

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

  // Plain-language identity for real project files; snippets keep the
  // technical fallback. An edit block's body is a SEARCH/REPLACE diff,
  // never file content — its title comes from the path alone.
  const display = filename ? artifactDisplay(filename, isEdit ? undefined : code) : null;

  // Whether the card can open in the preview: the file must actually be in
  // the project. Snapshot read, no subscription — bubbles stay memoized;
  // the click handler re-checks, so a stale answer degrades to expand.
  const inProject = useMemo(
    () => !!filename && !streaming && !!useProjectStore.getState().getFile(filename),
    [filename, streaming],
  );

  function onRowClick() {
    if (filename && !streaming && useProjectStore.getState().getFile(filename)) {
      usePanelStore.getState().openArtifact(filename);
    } else {
      setExpanded(e => !e);
    }
  }

  return (
    <div className="not-prose my-2 rounded-md border bg-background/60 overflow-hidden">
      <div className="flex items-center text-xs">
        <button
          onClick={onRowClick}
          title={inProject ? 'See it in the preview' : undefined}
          className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/60 transition-colors"
        >
          {streaming ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <FileCode className="size-3 text-muted-foreground shrink-0" />
          )}
          {display ? (
            <>
              <span className="font-medium truncate">{display.name}</span>
              <span className="text-muted-foreground shrink-0">
                {streaming ? 'writing…' : isEdit ? 'updated' : display.kindLabel}
              </span>
            </>
          ) : (
            <>
              <span className="font-mono truncate">
                {language && language !== 'text' ? `${language} code` : 'code'}
              </span>
              <span className="text-muted-foreground shrink-0">
                {streaming ? 'writing…' : `${lines} lines`}
              </span>
            </>
          )}
          {!inProject && (
            <span className="ml-auto text-muted-foreground shrink-0">
              {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </span>
          )}
        </button>
        {inProject && (
          <button
            onClick={() => setExpanded(e => !e)}
            title="View the code"
            className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          >
            <Code2 className="size-3" />
          </button>
        )}
      </div>
      {expanded && (
        <>
          {filename && (
            <div className="flex items-center gap-2 border-t px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
              <span className="truncate">{filename}</span>
              <span className="shrink-0 ml-auto">
                {isEdit ? `edited (${lines} lines)` : `${lines} lines`}
              </span>
            </div>
          )}
          <CodeBlock code={code} language={language === 'edit' ? 'diff' : language} />
        </>
      )}
    </div>
  );
}

/** Markdown headings that aren't the question section — the tell of a
 *  drafted document rather than a conversational reply */
function docHeadingCount(content: string): number {
  const headings = content.match(/^#{1,3}\s+.+$/gm) ?? [];
  return headings.filter(h => !QUESTION_HEADING_RE.test(h)).length;
}

/**
 * Plan-mode replies come in two registers. Conversation — exploring an idea,
 * asking the shaping questions as one-tap cards — renders like any chat
 * message, streaming live. The drafted plan document (sections under
 * markdown headings) gets the plan dress: it lands whole, wears the "Build
 * plan" chip, and carries the Build/Approve action.
 */
function isPlanDocument(content: string): boolean {
  return docHeadingCount(content) >= 2;
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
  // Plan mode writes in two registers: conversation streams live (the label
  // stays light), while a plan document hides until it lands whole — the
  // first document heading in the stream is the earliest reliable tell.
  const draftingPlanDoc = useChatStore(s => {
    if (s.mode !== 'plan') return false;
    const last = s.messages[s.messages.length - 1];
    return !!last?.isPlan && !!last.isStreaming && docHeadingCount(last.content) >= 1;
  });
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
      ? 'Reaching the model'
      : phase === 'thinking'
        ? 'Thinking it through'
        : mode === 'plan'
          ? draftingPlanDoc
            ? 'Drafting your plan — it appears here once it’s finished'
            : 'Writing'
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

/**
 * The whole first build behind one calm line: something's on the stove, and
 * nothing about it needs the person's attention until it's served. Persists
 * across the chain's quiet gaps (between continuations, while the preview
 * bundles) so the wait never flickers between states.
 */
function CookingStatus() {
  const since = useChatStore(s => s.cookingSince);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!since) return;
    const update = () => setSecs(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => {
      clearInterval(t);
      setSecs(0);
    };
  }, [since]);
  if (!since) return null;

  return (
    <div className="pl-1 space-y-1">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="rb-cooking-pot text-base leading-none" aria-hidden="true">🍲</span>
        <span>It’s cooking</span>
        <WorkingDots />
        {secs >= 3 && <span className="text-muted-foreground/60 tabular-nums">{formatSecs(secs)}</span>}
      </p>
      <p className="text-xs text-muted-foreground/60">
        Your first version appears here — and in the preview — once it’s fully ready.
      </p>
    </div>
  );
}

/** Show the wait pointer once a first build has clearly become a wait */
const WAIT_ACTIVITY_AFTER_S = 20;

/**
 * Something worth doing while a first build runs: the right pane turns
 * toward the Notepad (see RightPanel's intro effect) and this line ties the
 * two together. Notes written there are real project notes — they save with
 * the project and feed its story — where the old in-chat textarea kept a
 * throwaway draft that had to be copied into the conversation to survive.
 */
function WaitActivity() {
  const cookingSince = useChatStore(s => s.cookingSince);
  const [elapsed, setElapsed] = useState(0);

  // One-second heartbeat while cooking, to cross the show threshold
  useEffect(() => {
    if (!cookingSince) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - cookingSince) / 1000)),
      1000,
    );
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [cookingSince]);

  const show = cookingSince !== null && elapsed >= WAIT_ACTIVITY_AFTER_S;
  if (!show) return null;

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 space-y-1.5">
      <p className="text-sm font-medium">Initial builds can take ten minutes or so — a great time to try your Notepad</p>
      <p className="text-sm text-muted-foreground">
        It's in the right pane: jot who else cares about what you're building,
        who might have good ideas, how you'd introduce it to neighbors. Notes
        save with the project.
      </p>
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
  // A first build in progress: hide its churn behind the cooking line
  const cookingSince = useChatStore(s => s.cookingSince);
  const cooking = cookingSince !== null;
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

  // Follow the stream, throttled: this effect fires on every streamed token,
  // and restarting a smooth scroll animation hundreds of times a second turns
  // long builds into jank. One scroll per ~150ms reads identically.
  const lastContent = messages[messages.length - 1]?.content;
  const lastFollowAt = useRef(0);
  const followTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!nearBottom) return;
    const follow = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    const since = Date.now() - lastFollowAt.current;
    if (since >= 150) {
      lastFollowAt.current = Date.now();
      follow();
    } else if (followTimer.current === null) {
      followTimer.current = window.setTimeout(() => {
        followTimer.current = null;
        lastFollowAt.current = Date.now();
        follow();
      }, 150 - since);
    }
    // `cooking` rides the deps so the reveal (hidden chain → visible result)
    // also follows to the bottom, where the summary and next step land
  }, [messages, lastContent, nearBottom, cooking]);
  useEffect(() => () => {
    if (followTimer.current !== null) clearTimeout(followTimer.current);
  }, []);

  // A plan document stays hidden while it's written and lands in one piece —
  // when it does, start the reader at its top instead of letting the
  // bottom-follow drop them at the end of a document they haven't read yet.
  // Conversational plan-mode replies stream live and never jump the scroll.
  const lastMessage = messages[messages.length - 1];
  const streamingPlanId = useRef<string | null>(null);
  useEffect(() => {
    if (lastMessage?.isPlan && lastMessage.isStreaming) {
      streamingPlanId.current = lastMessage.id;
      return;
    }
    if (lastMessage && streamingPlanId.current === lastMessage.id && !lastMessage.isStreaming) {
      streamingPlanId.current = null;
      if (!isPlanDocument(lastMessage.content)) return;
      const el = scrollRef.current?.querySelector(`[data-msg-id="${lastMessage.id}"]`);
      // After the bottom-follow above has had its say — this jump wins
      requestAnimationFrame(() => {
        setNearBottom(false); // hand the scroll back to the reader
        el?.scrollIntoView({ block: 'start' });
      });
    }
  }, [lastMessage]);

  // From scratch, the action arrives with the drafted plan document — but it
  // must not LEAVE with it. Refinements ("also add a lending toggle") come
  // back as short conversational replies, and pinning the action to a
  // document-shaped last message meant the invitation to build outlived the
  // button that does it: the reply said "press Build this plan" and there was
  // nothing to press. Once a plan has been drafted, the plan stands until it
  // is built, and every settled reply carries the action. Refinements ride
  // along with it — the send carries the whole conversation.
  const planDrafted = useMemo(
    () => messages.some(m => m.role === 'assistant' && m.isPlan && !m.isStreaming && isPlanDocument(m.content)),
    [messages],
  );

  if (messages.length === 0) {
    return null;
  }

  // The Build/Approve action belongs to a reply with something to approve.
  // A reply that just asked questions is the exception either way: it wants
  // answers, not approval — and when the question IS the readiness check, its
  // "Ready to build" card is the press.
  const showBuildAction =
    !isGenerating &&
    !!onBuildPlan &&
    lastMessage?.role === 'assistant' &&
    lastMessage.isPlan &&
    !lastMessage.isStreaming &&
    extractPlanQuestions(lastMessage.content).length === 0 &&
    // On an existing project even a two-sentence change IS the plan
    (hasProject || planDrafted);

  return (
    <div className="flex-1 relative min-h-0">
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto py-4 px-4 space-y-4">
        {messages.map((msg, i) => {
          // While a first build cooks, its churn stays off screen — the
          // streaming build reply, the Builder's continuation and fix notes —
          // and everything lands at once when the pot comes off the stove.
          // The person's own messages and model notes (isSync) stay visible.
          if (
            cookingSince !== null &&
            msg.timestamp >= cookingSince &&
            (msg.isAuto || (msg.role === 'assistant' && !msg.isSync))
          ) {
            return null;
          }
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
        {cooking ? <CookingStatus /> : isGenerating && <GenerationStatus />}
        <WaitActivity />
        {reviewing && !cooking && (
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
        {!isGenerating && !cooking && lastMessage?.role === 'assistant' && !lastMessage.isStreaming && (
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

// Memoized: the store appends streamed tokens by remapping the messages
// array, so the list re-renders per token — without this, every bubble in
// the history re-ran its full markdown parse for each token of a long build.
const MessageBubble = memo(function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeCheckpointId = useProjectStore(s => s.activeCheckpointId);
  const restoreCheckpoint = useProjectStore(s => s.restoreCheckpoint);

  // Display-only strips and fence folding (see ./display.ts). Memoized so
  // settled bubbles never re-run it; the streaming bubble re-parses per
  // token anyway, and this pre-pass is small next to the markdown parse.
  const rendered = useMemo(
    () => renderableContent(message.isPlan ? stripPlanQuestions(message.content) : message.content),
    [message.content, message.isPlan],
  );

  // Auto sends (quality review, error fix, length continue) render as a
  // distinct Builder note — after the hooks above, to keep hook order stable.
  if (message.isAuto) return <AutoMessage message={message} />;

  // A note from one collaborator to the others — human-to-human, the AI
  // never saw it, and it must not read as anyone's ask to the Builder
  if (message.isCollabNote) return <CollabNote message={message} />;

  // A plan DOCUMENT being written stays out of view until it's done —
  // watching a document assemble line by line is disorienting. The status
  // line says it's coming; it lands whole, and MessageList starts the reader
  // at its top. Conversational plan-mode replies (exploring, questions)
  // stream live like any other message; the first document heading is the
  // earliest reliable tell that a reply is turning into a plan.
  if (message.isPlan && message.isStreaming && docHeadingCount(message.content) >= 1) {
    return null;
  }
  // The plan dress — chip, dashed border — belongs to the drafted document,
  // not to every plan-mode reply
  const planDoc = !!message.isPlan && isPlanDocument(message.content);

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
            : planDoc
              ? 'w-full rounded-xl px-4 py-3 bg-muted/60 border border-dashed border-primary/40'
              : message.isSync
                ? 'w-full rounded-xl px-4 py-3 bg-primary/5 border border-primary/20'
                : 'w-full px-1'
        }`}
      >
        {planDoc && (
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
              {/* The question section renders as answer cards, never as raw
                  markdown — stripped even mid-stream, so a conversational
                  reply's questions don't flash as text before carding up.
                  PROJECT-NAME, NEXT-FILES, and NEED-FILES are machinery too:
                  one lands in the project header, the others drive chunk
                  continuation and file requests — none is a line to read
                  (see renderableContent) */}
              {rendered}
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
      {!isUser && !message.isStreaming && message.commonsRefs && message.commonsRefs.length > 0 && (
        <CommonsRefChips refs={message.commonsRefs} />
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
});

/**
 * The commons entries a reply actually drew on — surfaced by retrieval AND
 * named in the text. Each chip opens the entry's gallery card, so "we're
 * borrowing from the Mutual Aid Pod recipe" is one tap from the recipe
 * itself. This is the visible half of the commons loop; the build log keeps
 * the measurable half.
 */
function CommonsRefChips({ refs }: { refs: { slug: string; title: string; kind: string }[] }) {
  const openGalleryItem = useUIStore(s => s.openGalleryItem);
  return (
    <div className="mt-1.5 pl-1 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground/70">Drew on the commons:</span>
      {refs.slice(0, 4).map(r => (
        <button
          key={r.slug}
          onClick={() => openGalleryItem(r.slug)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
          title={`Open "${r.title}" in the Commons Gallery`}
        >
          <BookOpen className="size-2.5 shrink-0" />
          {r.title}
        </button>
      ))}
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
 *
 * The readiness check ("Anything else to change, or ready to build?") comes
 * through here like any other question — but its yes is not an answer to
 * relay. It starts the build.
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
    // "Ready to build" IS the press — sending the words instead would spend a
    // whole reply re-offering a button. Only when it stands alone: a yes
    // tapped beside another open question would discard that answer.
    if (questions.length === 1 && isReadyToBuildOption(value)) {
      setSent(true);
      startBuildFromPlan();
      return;
    }
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
