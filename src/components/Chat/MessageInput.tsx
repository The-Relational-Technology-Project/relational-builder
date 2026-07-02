import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizontal, Square, Map, Hammer, ImagePlus, X } from 'lucide-react';
import type { ChatMode } from '@/store/chat-store';
import { fileToDataUrl, isImageFile } from '@/lib/image';

const MAX_ATTACHMENTS = 3;

interface MessageInputProps {
  onSend: (message: string, attachments?: string[]) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
}

export function MessageInput({ onSend, onStop, isGenerating, disabled, mode = 'build', onModeChange }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(trimmed || 'Here’s an image for reference.', attachments);
    setInput('');
    setAttachments([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, attachments, disabled, onSend]);

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

  async function addFiles(files: FileList | File[]) {
    const images = [...files].filter(isImageFile).slice(0, MAX_ATTACHMENTS - attachments.length);
    for (const file of images) {
      try {
        const dataUrl = await fileToDataUrl(file);
        setAttachments(prev =>
          prev.length < MAX_ATTACHMENTS ? [...prev, dataUrl] : prev,
        );
      } catch {
        // unsupported image — skip quietly
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = [...e.clipboardData.items]
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
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
          <span className="text-[11px] text-muted-foreground ml-1.5 hidden sm:inline">
            {mode === 'plan' ? 'Sketch the plan together before any code' : 'Generate working code into your project'}
          </span>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2">
          {attachments.map((url, i) => (
            <div key={i} className="relative group">
              <img
                src={url}
                alt={`Attachment ${i + 1}`}
                className="h-14 w-14 object-cover rounded-md border"
              />
              <button
                onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                title="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
          title="Attach an image — a sketch, screenshot, or mockup"
          className="shrink-0"
        >
          <ImagePlus className="size-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
            disabled={(!input.trim() && attachments.length === 0) || disabled}
            title="Send message"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
