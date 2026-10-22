import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Send, X } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { STUDIO_STEWARD_EMAIL } from '@/knowledge/studio-brief';
import {
  assembleStudioBriefShare,
  currentProjectKey,
  isStudioBriefProject,
  readLiveSiteUrl,
  readStudioBrief,
  readStudioPage,
  sendStudioBriefShare,
  summarizeStudioBrief,
  useStudioShareStore,
} from '@/report/studio-brief-share';

/**
 * The door at the end of the "design your studio" journey: once the Studio
 * Brief exists in the project, this card offers to send it — and the
 * one-page site — to Josh at the Relational Tech Project.
 *
 * Consent design:
 * - Appears only on a studio-brief project that has its brief, and never
 *   while a reply streams.
 * - Nothing is read or sent until the button is pressed; "see exactly what
 *   we'd send" shows the brief itself and names the page and its live link.
 * - A signed-in builder's name and email start filled in from their profile
 *   (clearing a box is the opt-out). The email is how Josh replies.
 * - Closing the card puts it away for this project; Share → "Send to Josh
 *   at RTP" brings it back. Sending retires it with a note that it went.
 */
const inputClass =
  'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring';

export function StudioBriefShareCard() {
  const fileCount = useProjectStore(s => s.getFileCount());
  const lineage = useProjectStore(s => s.lineage);
  const isGenerating = useChatStore(s => s.isGenerating);
  const cooking = useChatStore(s => s.cookingSince !== null);
  const statuses = useStudioShareStore(s => s.status);
  const setStatus = useStudioShareStore(s => s.setStatus);
  const key = currentProjectKey();
  const status = statuses[key] ?? 'offered';

  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const profileName = (profile?.display_name ?? profile?.full_name ?? '').trim();
  const [name, setName] = useState(profileName);
  const [email, setEmail] = useState(user?.email ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  useEffect(() => {
    if (!nameTouched && profileName && !name) setName(profileName);
  }, [profileName, nameTouched, name]);
  useEffect(() => {
    if (!emailTouched && user?.email && !email) setEmail(user.email);
  }, [user?.email, emailTouched, email]);

  const [note, setNote] = useState('');
  const [includeSite, setIncludeSite] = useState(true);
  const [showPayload, setShowPayload] = useState(false);
  const [phase, setPhase] = useState<'ask' | 'sending' | 'error'>('ask');
  const [error, setError] = useState<string | null>(null);

  // Re-read on every render: the brief appears with the first build and the
  // store's fileCount and lineage subscriptions above re-render this card
  const inStudio = Boolean(lineage) && isStudioBriefProject();
  const brief = inStudio && fileCount > 0 ? readStudioBrief() : null;
  if (!brief) return null;
  if ((isGenerating || cooking) && phase === 'ask') return null;

  if (status === 'sent') {
    return (
      <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
        <Send className="size-4 text-primary shrink-0" />
        <p className="text-sm flex-1">
          Sent. Your Studio Brief is on its way to Josh at the Relational Tech Project; expect a reply within a few days.
        </p>
        <button
          onClick={() => setStatus(key, 'dismissed')}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }
  if (status === 'dismissed') return null;

  const summary = summarizeStudioBrief(brief);
  const page = readStudioPage();
  const liveUrl = readLiveSiteUrl();
  const studioName = summary.studioName ?? 'your studio';

  const share = async () => {
    setPhase('sending');
    setError(null);
    try {
      const payload = assembleStudioBriefShare({
        builderName: name.trim() || null,
        builderEmail: email.trim() || null,
        note: note.trim() || null,
        includeSite: includeSite && Boolean(page),
      });
      if (!payload) throw new Error('The brief is not in the project yet');
      await sendStudioBriefShare(payload);
      setStatus(key, 'sent');
      setPhase('ask');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the brief');
      setPhase('error');
    }
  };

  const canSend = phase !== 'sending' && email.trim().length > 0;

  return (
    <div className="mx-4 mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <Send className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-sm font-medium">Ready to share {studioName} with RTP?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Send your Studio Brief{page ? ' and the one-page site' : ''} to Josh at the Relational
            Tech Project ({STUDIO_STEWARD_EMAIL}). He sets studios up from the brief and replies to
            you directly. Nothing goes until you press the button; edit the brief first if you like,
            and send again any time from Share.
          </p>
        </div>
        <button
          onClick={() => setStatus(key, 'dismissed')}
          disabled={phase === 'sending'}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Not now (Share → Send to Josh at RTP brings this back)"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={name}
          onChange={e => { setNameTouched(true); setName(e.target.value); }}
          placeholder="Your name"
          aria-label="Your name"
          className={inputClass}
        />
        <input
          type="email"
          value={email}
          onChange={e => { setEmailTouched(true); setEmail(e.target.value); }}
          placeholder="Your email (so Josh can reply)"
          aria-label="Your email"
          className={inputClass}
        />
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="A note for Josh (optional): what you still want to decide together, when you hope to open the studio"
        rows={2}
        className={`${inputClass} resize-none`}
      />

      {page && (
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={includeSite}
            onChange={e => setIncludeSite(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span className="text-muted-foreground leading-relaxed">
            Include the one-page site as an attachment
            {liveUrl ? <> and its live address ({liveUrl})</> : <>. Publish it from Share to send a live link too</>}
          </span>
        </label>
      )}

      <button
        onClick={() => setShowPayload(v => !v)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {showPayload ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        See exactly what we'd send
      </button>
      {showPayload && (
        <div className="space-y-2 rounded-md border border-primary/20 bg-background/60 p-2.5 text-xs">
          <p className="text-muted-foreground">
            Goes to {STUDIO_STEWARD_EMAIL} by email, with your name and email as the reply address, and is kept in the Builder's database so it can be found again (ask any time and it is deleted).
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
            <li>The Studio Brief below, as the email and as <code>studio-brief.md</code></li>
            {page && includeSite && <li>The one-page site, as <code>studio-page.html</code>{liveUrl ? ` and its link ${liveUrl}` : ''}</li>}
            {note.trim() && <li>Your note</li>}
            <li>Nothing from the chat</li>
          </ul>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 font-mono text-[11px] leading-snug">
            {brief}
          </pre>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8 text-xs" onClick={share} disabled={!canSend}>
          {phase === 'sending' ? 'Sending…' : 'Send to Josh at RTP'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => setStatus(key, 'dismissed')}
          disabled={phase === 'sending'}
        >
          Not now
        </Button>
        {!email.trim() && (
          <span className="text-xs text-muted-foreground">Add an email so Josh can reply.</span>
        )}
      </div>
    </div>
  );
}
