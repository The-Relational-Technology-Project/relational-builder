import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizontal, Square, Map, Hammer, ImagePlus, X, FolderOpen, Globe } from 'lucide-react';
import { useChatStore, type ChatMode } from '@/store/chat-store';
import { fileToDataUrl, isImageFile } from '@/lib/image';
import { listMentionables, type Mentionable } from '@/knowledge/mentions';
import { ModelSelector } from '@/components/ModelSelector';

// Room for two seeded reference screenshots (gallery remixes) plus the
// person's own images
const MAX_ATTACHMENTS = 4;

interface MessageInputProps {
  onSend: (message: string, attachments?: string[]) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  /** hero = the big centered composer on the home screen */
  variant?: 'chat' | 'hero';
}

export function MessageInput({
  onSend,
  onStop,
  isGenerating,
  disabled,
  mode = 'build',
  onModeChange,
  variant = 'chat',
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hero = variant === 'hero';
  const maxHeight = hero ? 280 : 220;

  // @ mentions: candidates load on first @, popover filters as you type
  const [mentionables, setMentionables] = useState<Mentionable[] | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  useEffect(() => {
    if (mentionQuery !== null && mentionables === null) {
      listMentionables().then(setMentionables).catch(() => setMentionables([]));
    }
  }, [mentionQuery, mentionables]);

  function updateMentionState(value: string, caret: number) {
    // An @ being typed: "@" preceded by start/whitespace, no ] yet, caret at end of it
    const before = value.slice(0, caret);
    const match = before.match(/(^|\s)@([^\s@[\]]{0,40})$/);
    setMentionQuery(match ? match[2] : null);
  }

  function insertMention(name: string) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? input.length;
    const before = input.slice(0, caret).replace(/(^|\s)@([^\s@[\]]{0,40})$/, `$1@[${name}] `);
    const next = before + input.slice(caret);
    setInput(next);
    setMentionQuery(null);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    }, 0);
  }

  const mentionMatches = (mentionQuery !== null && mentionables)
    ? mentionables.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  // Prefill from elsewhere (e.g. tapping a plan question chip)
  const draftMessage = useChatStore(s => s.draftMessage);
  useEffect(() => {
    if (draftMessage === null) return;
    setInput(draftMessage);
    useChatStore.getState().setDraftMessage(null);
    // Focus after React flushes the new value
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  }, [draftMessage, maxHeight]);

  // Prefilled attachments (e.g. a gallery tool's screenshots riding along
  // as visual reference) — shown as normal attachments, removable, with
  // space left to add your own
  const draftAttachments = useChatStore(s => s.draftAttachments);
  useEffect(() => {
    if (draftAttachments === null) return;
    setAttachments(draftAttachments.slice(0, MAX_ATTACHMENTS));
    useChatStore.getState().setDraftAttachments(null);
  }, [draftAttachments]);

  // A follow-up typed mid-generation queues instead of being lost — it
  // sends the moment the current reply finishes (Lovable's best trick)
  const queuedMessage = useChatStore(s => s.queuedMessage);
  const queuedFollowUp = isGenerating && queuedMessage !== null ? queuedMessage : null;

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    if (isGenerating) {
      // Queue text-only follow-ups; images wait for the next turn
      if (!trimmed || attachments.length > 0) return;
      useChatStore.getState().queueMessage(trimmed);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }
    onSend(trimmed || 'Here’s an image for reference.', attachments);
    setInput('');
    setAttachments([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, attachments, disabled, isGenerating, onSend]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (mentionMatches.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      insertMention(mentionMatches[0].name);
      return;
    }
    if (e.key === 'Escape' && mentionQuery !== null) {
      setMentionQuery(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
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
    <div className={hero ? 'w-full min-w-0' : 'border-t bg-background px-3 pb-3 pt-2 md:px-4'}>
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

      {mentionMatches.length > 0 && (
        <div className="mb-2 rounded-lg border bg-popover shadow-md max-w-sm overflow-hidden">
          <p className="px-2.5 pt-2 pb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Reference one of your apps
          </p>
          {mentionMatches.map(m => (
            <button
              key={`${m.kind}-${m.id}`}
              onClick={() => insertMention(m.name)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-accent transition-colors"
            >
              {m.kind === 'project'
                ? <FolderOpen className="size-3 text-muted-foreground shrink-0" />
                : <Globe className="size-3 text-muted-foreground shrink-0" />}
              <span className="truncate">{m.name}</span>
              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                {m.kind === 'project' ? 'project' : 'live site'}
              </span>
            </button>
          ))}
        </div>
      )}

      {queuedFollowUp && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="shrink-0 font-medium">Sends next:</span>
          <span className="truncate">{queuedFollowUp}</span>
          <button
            onClick={() => useChatStore.getState().clearQueuedMessage()}
            className="ml-auto shrink-0 hover:text-foreground"
            title="Cancel the queued follow-up"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* One quiet container: write on top, act along the bottom */}
      <div
        className={`rounded-xl border bg-background transition-shadow focus-within:border-ring focus-within:ring-1 focus-within:ring-ring ${
          hero ? 'rounded-2xl shadow-sm' : ''
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            hero
              ? 'What does your neighborhood need? Describe it in your own words…'
              : isGenerating
                ? 'Queue a follow-up — it sends when this finishes…'
                : mode === 'plan'
                  ? 'What should we think through?'
                  : 'Describe a change or something new…'
          }
          disabled={disabled}
          rows={hero ? 3 : 2}
          className={`block w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed text-sm ${
            hero ? 'px-4 pt-4 pb-1 min-h-[80px]' : 'px-3.5 pt-3 pb-1 min-h-[64px]'
          }`}
        />
        <div className="flex items-center gap-1 px-2 pb-2 min-w-0">
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
          {hero ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
              title="Screenshots, local art, a photo of your place, a mood board — visuals shape the design"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-full px-3 shrink-0"
            >
              <ImagePlus className="size-4" />
              <span className="hidden sm:inline">Add an image</span>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
              title="Attach an image — a sketch, screenshot, or mockup"
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <ImagePlus className="size-4" />
            </Button>
          )}
          {onModeChange && (
            <div className="inline-flex shrink-0 rounded-full border p-0.5 gap-0.5 ml-0.5" role="group" aria-label="Chat mode">
              <button
                type="button"
                onClick={() => onModeChange('plan')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  mode === 'plan'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Plan first — sketch the idea together before any code"
              >
                <Map className="size-3" />
                Plan
              </button>
              <button
                type="button"
                onClick={() => onModeChange('build')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  mode === 'build'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Build — generate working code into your project"
              >
                <Hammer className="size-3" />
                Build
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1 min-w-0">
            {/* Model choice lives here, with the conversation — not in the main nav.
                Tighter cap on phones so the send button always stays on-screen. */}
            <ModelSelector className="h-8 min-w-0 max-w-[116px] sm:max-w-[150px] gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground" />
            {isGenerating ? (
              <Button
                size="icon"
                variant="outline"
                onClick={onStop}
                title="Stop generating"
                className="size-8 shrink-0 rounded-full"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={(!input.trim() && attachments.length === 0) || disabled}
                title="Send (Enter)"
                className="size-8 shrink-0 rounded-full"
              >
                <SendHorizontal className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
