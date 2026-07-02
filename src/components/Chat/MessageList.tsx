import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore, type DisplayMessage } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { CodeBlock } from './CodeBlock';
import { ConnectionSuggestion } from './ConnectionSuggestion';
import { Button } from '@/components/ui/button';
import { Hammer, History, FileCode, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

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

interface MessageListProps {
  messages: DisplayMessage[];
  onBuildPlan?: () => void;
  isGenerating?: boolean;
}

export function MessageList({ messages, onBuildPlan, isGenerating }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, messages[messages.length - 1]?.content]);

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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-4 px-4 space-y-4">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
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
        className={`text-sm ${
          isUser
            ? 'max-w-[85%] rounded-xl px-4 py-2.5 bg-primary text-primary-foreground'
            : message.isPlan
              ? 'w-full rounded-xl px-4 py-3 bg-muted/60 border border-dashed border-primary/40'
              : 'w-full px-1'
        }`}
      >
        {message.isPlan && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
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
          <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent">
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
      {checkpoint && (
        <div className="mt-1 pl-1">
          {isLatest ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
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
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted"
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
