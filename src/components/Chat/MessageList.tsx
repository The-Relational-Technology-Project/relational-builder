import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore, type DisplayMessage } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { CodeBlock } from './CodeBlock';
import { ConnectionSuggestion } from './ConnectionSuggestion';
import { Button } from '@/components/ui/button';
import { Hammer, History, FileCode, ChevronDown, ChevronRight, Loader2, Copy, Check, ArrowDown } from 'lucide-react';

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

/**
 * What's happening during the wait — the phase, elapsed time, and the model's
 * own summarized thinking streaming past. Long waits should never look dead.
 */
function GenerationStatus() {
  const progress = useChatStore(s => s.progress);
  const startedAt = progress?.startedAt;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!progress) return null;

  const secs = Math.max(0, Math.floor((Date.now() - progress.startedAt) / 1000));
  const elapsed = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  const label =
    progress.phase === 'waiting'
      ? 'Reaching Claude…'
      : progress.phase === 'thinking'
        ? 'Thinking it through…'
        : 'Writing — files land in the chat and Files tab as they finish…';
  const snippet =
    progress.phase === 'thinking'
      ? progress.thinking.replace(/\s+/g, ' ').trim().slice(-140)
      : '';

  return (
    <div className="pl-1 space-y-1">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin shrink-0" />
        <span>{label}</span>
        {secs >= 3 && <span className="text-muted-foreground/60 tabular-nums">{elapsed}</span>}
      </p>
      {snippet && (
        <p className="text-sm text-muted-foreground/70 italic truncate">…{snippet}</p>
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

  if (messages.length === 0) {
    return null;
  }

  const lastMessage = messages[messages.length - 1];
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
            <div key={msg.id}>
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
        {reviewing && (
          <p className="text-sm text-muted-foreground pl-1 animate-pulse">
            Giving the build a quick once-over…
          </p>
        )}
        {showBuildAction && (
          <div className="flex justify-start pl-1">
            <Button size="sm" onClick={onBuildPlan}>
              <Hammer className="size-3.5 mr-1.5" />
              Build this plan
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

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeCheckpointId = useProjectStore(s => s.activeCheckpointId);
  const restoreCheckpoint = useProjectStore(s => s.restoreCheckpoint);

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
              : 'w-full px-1'
        }`}
      >
        {message.isPlan && (
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
            Build plan
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
        <PlanQuestionChips content={message.content} />
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

/**
 * Pull the "Question for you" out of a plan. The question renders ONLY as a
 * tappable chip (the section is stripped from the message body so it never
 * appears twice). Tapping prefills the input so the person just types their
 * answer. Plans now ask one question per reply.
 */
export function extractPlanQuestions(content: string): string[] {
  const section = content.split(QUESTION_HEADING_RE)[1];
  if (!section) return [];
  // Numbered items until the next heading
  return (section.split(/^#{2,3}\s/m)[0].match(/^\s*\d+\.\s+(.+)$/gm) ?? [])
    .map(line => line.replace(/^\s*\d+\.\s+/, '').replace(/\*\*/g, '').trim())
    .filter(q => q.length > 5)
    .slice(0, 3);
}

/** Remove the question section from the rendered body (chips replace it) */
export function stripPlanQuestions(content: string): string {
  const idx = content.search(QUESTION_HEADING_RE);
  if (idx === -1) return content;
  const after = content.slice(idx);
  // Keep anything after the question list's following heading (rare)
  const rest = after.split(/^#{2,3}\s/m).slice(2).join('## ');
  return (content.slice(0, idx).trimEnd() + (rest ? `\n\n## ${rest}` : '')).trimEnd();
}

function PlanQuestionChips({ content }: { content: string }) {
  const setDraftMessage = useChatStore(s => s.setDraftMessage);
  const questions = extractPlanQuestions(content);
  if (questions.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-col items-start gap-1.5 max-w-[85%]">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => setDraftMessage(`${q}\n→ `)}
          className="text-left text-xs border border-dashed border-primary/50 rounded-lg px-3 py-2 text-foreground hover:bg-primary/10 transition-colors"
          title="Tap to answer this question"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
