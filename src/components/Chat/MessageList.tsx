import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DisplayMessage } from '@/store/chat-store';
import { CodeBlock } from './CodeBlock';
import { Button } from '@/components/ui/button';
import { Hammer } from 'lucide-react';

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
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : message.isPlan
              ? 'bg-muted border border-dashed border-primary/40'
              : 'bg-muted'
        }`}
      >
        {message.isPlan && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            Build plan
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
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

                  return <CodeBlock code={codeStr} language={match?.[1]} />;
                },
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
