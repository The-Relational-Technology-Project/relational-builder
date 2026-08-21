import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SendHorizontal, Square, Map, Hammer, ImagePlus, X, FolderOpen, Globe, Clock, MessagesSquare } from 'lucide-react';
import { useChatStore, type ChatMode } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { fileToDataUrl, isImageFile } from '@/lib/image';
import { listMentionables, type Mentionable } from '@/knowledge/mentions';
import { ModelSelector } from '@/components/ModelSelector';
import { noteSubmit, recordFriction } from '@/report/friction';

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
  /** This composer starts a *new* project (the Home lobby). No collaborators
   *  exist there yet, so the human-to-human Message mode never applies —
   *  even while a shared project sits open behind the back pill. */
  startsNewProject?: boolean;
}

export function MessageInput({
  onSend,
  onStop,
  isGenerating,
  disabled,
  mode = 'build',
  onModeChange,
  variant = 'chat',
  startsNewProject = false,
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hero = variant === 'hero';
  const maxHeight = hero ? 280 : 220;

  // Message mode exists only on shared projects — it's a note to the other
  // humans, so it needs other humans. A persisted or synced 'message' mode
  // with nobody to read it falls back to build.
  const hasCollaborators = useCloudStore(s => s.members.length > 0) && !startsNewProject;
  useEffect(() => {
    if (mode === 'message' && !hasCollaborators) onModeChange?.('build');
  }, [mode, hasCollaborators, onModeChange]);
  const messageMode = mode === 'message' && hasCollaborators;

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
    noteSubmit(trimmed);
    if (mode === 'message') {
      // A note to collaborators involves no model — it posts immediately,
      // even while the AI is mid-reply, and never rides the AI queue
      onSend(trimmed || 'Here’s an image.', attachments);
      setInput('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }
    if (isGenerating) {
      // Everything queues, images included. This branch used to return
      // silently for an attachment or an empty-after-trim send: the person
      // pressed send, the app did nothing, and nothing explained why. One
      // builder read that as a broken button and sent the same request three
      // times. Silence is the one response a composer may never give.
      recordFriction('submit_while_busy', { hasAttachments: attachments.length > 0 });
      useChatStore
        .getState()
        .queueMessage(trimmed || 'Here’s an image for reference.', attachments);
      setInput('');
      setAttachments([]);
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
  }, [input, attachments, disabled, isGenerating, mode, onSend]);

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

  // Drag a photo anywhere onto the composer and it attaches — the same
  // door the picker and paste use. dragenter/dragleave fire for every
  // child crossed, so a depth counter tells "left the composer" from
  // "moved over the textarea".
  const draggingFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  function handleDragEnter(e: React.DragEvent) {
    if (!draggingFiles(e) || disabled) return;
    e.preventDefault();
    dragDepth.current++;
    setDragOver(true);
  }
  function handleDragOver(e: React.DragEvent) {
    if (!draggingFiles(e) || disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!draggingFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    dragDepth.current = 0;
    setDragOver(false);
    if (!draggingFiles(e) || disabled) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  return (
    <div
      className={`relative ${hero ? 'w-full min-w-0' : 'border-t bg-background px-3 pb-3 pt-2 md:px-4'}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-primary bg-primary/10 ${hero ? 'rounded-2xl' : 'rounded-lg'}`}>
          <p className="rounded-full bg-background/95 border px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
            Drop images to attach
          </p>
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

      {/* The acknowledgement. A builder who gets nothing back assumes the
          button is broken and sends again — so this says plainly that the
          message was received, that the app is still working, and when it
          will go. Emphasised rather than muted for the same reason: it is
          the answer to "did it hear me?", and it only helps if it's seen. */}
      {queuedFollowUp && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-2 text-xs">
          <Clock className="size-3.5 shrink-0 mt-0.5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              Got it — still finishing the last one. This sends next.
            </p>
            <p className="mt-0.5 line-clamp-2 text-muted-foreground">{queuedFollowUp}</p>
          </div>
          <button
            onClick={() => useChatStore.getState().clearQueuedMessage()}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Cancel the queued follow-up"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* One quiet container: write on top, act along the bottom */}
      <div
        className={`rounded-xl border transition-shadow focus-within:ring-1 ${
          messageMode
            ? 'border-violet-500/50 bg-violet-500/5 focus-within:border-violet-500 focus-within:ring-violet-500/40'
            : 'bg-background focus-within:border-ring focus-within:ring-ring'
        } ${hero ? 'rounded-2xl shadow-sm' : ''} ${disabled ? 'opacity-60' : ''}`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            hero
              ? 'A neighborhood project, a dream, or a tool to build — describe it in your own words…'
              : messageMode
                ? 'A note for your collaborators — the AI stays out of this one…'
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
              {/* Human-to-human, so it only appears when other humans are on
                  the project — and wears its own color so a note is never
                  mistaken for an ask to the AI */}
              {hasCollaborators && (
                <button
                  type="button"
                  onClick={() => onModeChange('message')}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                    mode === 'message'
                      ? 'bg-violet-600 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Message collaborators — a note for the people on this project; the AI doesn't see or answer it"
                >
                  <MessagesSquare className="size-3" />
                  Message
                </button>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1 min-w-0">
            {/* Model choice lives here, with the conversation — not in the main nav.
                Tighter cap on phones so the send button always stays on-screen. */}
            <ModelSelector className="h-8 min-w-0 max-w-[116px] sm:max-w-[150px] gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground" />
            {isGenerating && mode !== 'message' ? (
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
