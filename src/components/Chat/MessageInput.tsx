import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizontal, Square, Map, Hammer } from 'lucide-react';
import type { ChatMode } from '@/store/chat-store';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
}

export function MessageInput({ onSend, onStop, isGenerating, disabled, mode = 'build', onModeChange }: MessageInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, disabled, onSend]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) return;
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  return (
    <div className="border-t bg-background p-3">
      {onModeChange && (
        <div className="flex items-center gap-1 mb-2">
          <div className="inline-flex rounded-md border p-0.5 gap-0.5" role="group" aria-label="Chat mode">
            <button
              type="button"
              onClick={() => onModeChange('plan')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                mode === 'plan'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Plan first — the AI drafts a build plan instead of code"
            >
              <Map className="size-3" />
              Plan
            </button>
            <button
              type="button"
              onClick={() => onModeChange('build')}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                mode === 'build'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Build — the AI generates working code into your project"
            >
              <Hammer className="size-3" />
              Build
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground ml-1.5">
            {mode === 'plan' ? 'Sketch the plan together before any code' : 'Generate working code into your project'}
          </span>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'plan' ? 'Describe what you want to plan...' : 'Describe what you want to build...'}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        {isGenerating ? (
          <Button size="icon" variant="ghost" onClick={onStop} title="Stop generating">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            title="Send message"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
