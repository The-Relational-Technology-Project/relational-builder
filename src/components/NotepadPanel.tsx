import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNotepadStore, type ProjectNote } from '@/store/notepad-store';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import { draftProjectStory } from '@/project/draft-story';
import { submitToCommons } from '@/project/commons-submit';
import { connectedRepoForCurrentProject } from '@/project/github-sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookOpenText, Check, Loader2, NotebookPen, Sparkles, Sprout, X,
} from 'lucide-react';

/**
 * The Notepad — jot what the code can't hold, then let the AI draft the
 * Project Story from everything the project remembers (first ask, chat,
 * build timeline, what got built, and these notes). The story is the
 * builder's to edit, and only they decide if it's offered to the commons.
 */

function fmtStamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Keep a textarea exactly as tall as its text — editing feels like paper */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export function NotepadPanel() {
  const notes = useNotepadStore(s => s.notes);
  const story = useNotepadStore(s => s.story);
  const [view, setView] = useState<'notes' | 'story'>('notes');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  // Redrafting throws away the builder's edits — that needs a second click
  const [confirmRedraft, setConfirmRedraft] = useState(false);

  async function handleDraft() {
    if (story?.editedAt && !confirmRedraft) {
      setConfirmRedraft(true);
      return;
    }
    setConfirmRedraft(false);
    setDrafting(true);
    setDraftError(null);
    try {
      const draft = await draftProjectStory();
      useNotepadStore.getState().setStory({
        title: draft.title,
        body: draft.body,
        draftedAt: Date.now(),
        editedAt: null,
        draftedWith: draft.draftedWith,
      });
      setView('story');
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Drafting failed — try again');
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-3 space-y-3">
        {/* Header: what this is + the story actions */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium flex items-center gap-1.5">
              <NotebookPen className="size-3.5" />
              Notepad
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ideas, neighbors' words, things that happened — the project's memory.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {story && (
              <Button
                size="sm"
                variant={view === 'story' ? 'default' : 'outline'}
                className="h-7 text-xs gap-1"
                onClick={() => { setView(view === 'story' ? 'notes' : 'story'); setConfirmRedraft(false); }}
              >
                <BookOpenText className="size-3" />
                {view === 'story' ? 'Notes' : 'Story'}
              </Button>
            )}
            <Button
              size="sm"
              variant={story ? 'outline' : 'default'}
              className="h-7 text-xs gap-1"
              disabled={drafting}
              onClick={handleDraft}
            >
              {drafting ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {drafting ? 'Drafting…' : story ? 'Re-draft' : 'Draft Story'}
            </Button>
          </div>
        </div>

        {confirmRedraft && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs flex items-center justify-between gap-2">
            <span>Re-drafting replaces the edits you've made to the story.</span>
            <span className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setConfirmRedraft(false)}>
                Keep mine
              </Button>
              <Button size="sm" className="h-6 text-xs" onClick={handleDraft}>
                Re-draft
              </Button>
            </span>
          </div>
        )}
        {draftError && <p className="text-xs text-destructive">{draftError}</p>}

        {view === 'story' && story ? <StoryView /> : <NotesView notes={notes} />}
      </div>
    </div>
  );
}

// ── Notes ──────────────────────────────────────────────────────────────

function NotesView({ notes }: { notes: ProjectNote[] }) {
  const [draft, setDraft] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);

  function addDraft() {
    const text = draft.trim();
    if (!text) return;
    useNotepadStore.getState().addNote(text);
    setDraft('');
    autoGrow(composerRef.current);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-muted/30 focus-within:border-ring">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={e => { setDraft(e.target.value); autoGrow(e.target); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Jot a note… (Enter to keep it)"
          rows={2}
          className="w-full resize-none bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-muted-foreground"
        />
        {draft.trim() && (
          <div className="px-2 pb-1.5 flex justify-end">
            <Button size="sm" className="h-6 text-xs" onClick={addDraft}>Keep it</Button>
          </div>
        )}
      </div>

      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No notes yet. A quote from a neighbor, an idea at 2am, what happened
          at the block party — it all belongs here.
        </p>
      ) : (
        notes.map(n => <NoteCard key={n.id} note={n} />)
      )}
    </div>
  );
}

function NoteCard({ note }: { note: ProjectNote }) {
  return (
    <div className="group rounded-md border p-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {fmtStamp(note.createdAt)}
          {note.updatedAt > note.createdAt + 60_000 ? ' · edited' : ''}
        </span>
        <button
          onClick={() => useNotepadStore.getState().deleteNote(note.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          title="Delete note"
        >
          <X className="size-3" />
        </button>
      </div>
      <textarea
        value={note.text}
        onChange={e => { useNotepadStore.getState().updateNote(note.id, e.target.value); autoGrow(e.target); }}
        onBlur={e => {
          // An emptied note is a deleted note — same "just type" ethic
          if (!e.target.value.trim()) useNotepadStore.getState().deleteNote(note.id);
        }}
        ref={autoGrow}
        rows={1}
        className="w-full resize-none bg-transparent text-xs outline-none leading-relaxed overflow-hidden"
      />
    </div>
  );
}

// ── Story ──────────────────────────────────────────────────────────────

function StoryView() {
  const story = useNotepadStore(s => s.story);
  const [tab, setTab] = useState<'write' | 'read'>('read');
  if (!story) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Drafted {fmtStamp(story.draftedAt)}
          {story.editedAt ? ` · edited ${fmtStamp(story.editedAt)}` : ''}
        </span>
        <div className="flex rounded-md border overflow-hidden">
          {(['read', 'write'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-0.5 text-[11px] transition-colors ${
                tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'read' ? 'Read' : 'Edit'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'write' ? (
        <div className="space-y-2">
          <Input
            value={story.title}
            onChange={e => useNotepadStore.getState().updateStoryTitle(e.target.value)}
            className="h-8 text-sm font-medium"
            placeholder="Story title"
          />
          <textarea
            value={story.body}
            onChange={e => { useNotepadStore.getState().updateStoryBody(e.target.value); autoGrow(e.target); }}
            ref={autoGrow}
            rows={12}
            className="w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-xs outline-none leading-relaxed focus-visible:border-ring overflow-hidden"
            placeholder="The story, in your words…"
          />
        </div>
      ) : (
        <div className="rounded-md border p-3">
          <h3 className="text-base font-semibold mb-2">{story.title}</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_p]:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{story.body}</ReactMarkdown>
          </div>
        </div>
      )}

      <ShareStoryCard />
    </div>
  );
}

// ── Offer the story to the commons ─────────────────────────────────────

/**
 * Consent-first, like every commons offering: the builder sees exactly what
 * will be shared and must check the box. The story travels as its own
 * commons item (kind "story") — whether or not the tool itself is shared.
 */
function ShareStoryCard() {
  const story = useNotepadStore(s => s.story);
  const lineage = useProjectStore(s => s.lineage);
  const user = useAuthStore(s => s.user);

  const [expanded, setExpanded] = useState(false);
  const [builderName, setBuilderName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [summary, setSummary] = useState('');
  const [toolUrl, setToolUrl] = useState(
    () => {
      const repo = connectedRepoForCurrentProject();
      return repo ? `https://github.com/${repo.fullName}` : '';
    },
  );
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!story) return null;

  if (done) {
    return (
      <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <Check className="size-3.5 text-green-600" />
          <p className="text-xs font-medium">Story offered to the commons</p>
        </div>
        <p className="text-xs text-muted-foreground">
          A steward will review it — once approved it joins the library,
          credited to {builderName}.
        </p>
      </div>
    );
  }

  async function handleSubmit() {
    if (!story) return;
    setSubmitting(true);
    setError(null);
    const frameTags = (lineage?.frames ?? []).filter(f => f !== 'practice-first');
    const result = await submitToCommons({
      title: story.title,
      summary: summary.trim(),
      body: story.body.slice(0, 19000),
      builderName: builderName.trim(),
      neighborhood: neighborhood.trim() || undefined,
      contactEmail: user?.email,
      sourceUrl: toolUrl.trim() || undefined,
      contributionType: 'story',
      tags: ['story', 'relational-builder', ...frameTags],
    });
    setSubmitting(false);
    if (result.ok) setDone(true);
    else setError(result.error ?? 'Submission failed');
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium w-full text-left"
      >
        <Sprout className="size-3.5 text-green-600" />
        Contribute this story to the RT Commons
        <span className="text-muted-foreground font-normal ml-auto">
          {expanded ? 'close' : 'optional'}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Stories are how tools travel: the next neighborhood learns more
            from what happened than from the code. A steward reviews every
            contribution before it becomes public. You'll be credited by name.
          </p>
          <Input
            value={builderName}
            onChange={e => setBuilderName(e.target.value)}
            placeholder="Your name (credited in the commons)"
            className="h-7 text-xs"
          />
          <Input
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            placeholder="Neighborhood (optional) — e.g. Outer Sunset, SF"
            className="h-7 text-xs"
          />
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="One or two sentences on what this story is about…"
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          <Input
            value={toolUrl}
            onChange={e => setToolUrl(e.target.value)}
            placeholder="Link to the tool it's about (optional — live site or repo)"
            className="h-7 text-xs"
          />
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={e => setConsented(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I've reviewed the story as it reads above (plus my name,
              neighborhood, and link) and I want it offered to the commons.
            </span>
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            disabled={!consented || !builderName.trim() || !summary.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="size-3 animate-spin" /> : <Sprout className="size-3" />}
            Offer to the commons
          </Button>
        </div>
      )}
    </div>
  );
}
