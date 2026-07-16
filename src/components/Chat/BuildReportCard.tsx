import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, HeartHandshake, Loader2, Undo2, X } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { useBuildLogStore, type BuildEvent, type BuildEventType } from '@/report/build-log';
import {
  assembleReport,
  generateBuildSummary,
  sendBuildReport,
  type ReportFeedback,
} from '@/report/build-report';
import { Button } from '@/components/ui/button';

/**
 * The opt-in ask, shown once per project when its initial build lands.
 *
 * Consent design, deliberately:
 * - Asked AFTER the build, so the person can see exactly what exists to share.
 * - "See exactly what we'd send" shows the real payload — the same object
 *   that ships — and any chat message can be struck before sending.
 * - Decline is a first-class button, visually equal to accept, and the card
 *   never comes back for this project either way.
 * - Nothing is assembled, generated, or transmitted until the yes.
 */

const EVENT_LABELS: Record<BuildEventType, string> = {
  build_start: 'Build started',
  reply_cut_off: 'Reply cut off',
  auto_continuation: 'Automatic continuation',
  continuation_cap: 'Continuation limit reached',
  apply_warnings: "Some edits didn't apply",
  preview_error: 'Preview error',
  auto_error_fix: 'Automatic error fix',
  manual_error_fix: 'Fix requested by hand',
  quality_review_fix: 'Quality review queued a fix',
  build_ready: 'Build ready',
};

function eventTime(e: BuildEvent, base: number): string {
  const s = Math.max(0, Math.round((e.at - base) / 1000));
  return `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const inputClass =
  'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring';

export function BuildReportCard() {
  const offer = useBuildLogStore(s => s.offer);
  const events = useBuildLogStore(s => s.events);
  const messages = useChatStore(s => s.messages);
  const fileCount = useProjectStore(s => s.getFileCount());

  const [showPayload, setShowPayload] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [hopedFor, setHopedFor] = useState('');
  const [roughMoments, setRoughMoments] = useState('');
  const [surprises, setSurprises] = useState('');
  const [followUpEmail, setFollowUpEmail] = useState('');
  const [phase, setPhase] = useState<'ask' | 'sending' | 'sent' | 'error'>('ask');

  const files = useMemo(
    () => useProjectStore.getState().getAllFiles().map(f => f.path),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileCount, offer],
  );

  if (offer !== 'pending' && phase !== 'sent') return null;
  if (messages.length === 0) return null;

  const decline = () => useBuildLogStore.getState().setOffer('declined');

  const toggleExcluded = (id: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const share = async () => {
    setPhase('sending');
    try {
      // Consent granted just now — only now does anything get assembled
      const summary = await generateBuildSummary();
      const feedback: ReportFeedback = {};
      if (hopedFor.trim()) feedback.hopedFor = hopedFor.trim();
      if (roughMoments.trim()) feedback.roughMoments = roughMoments.trim();
      if (surprises.trim()) feedback.surprises = surprises.trim();
      const payload = assembleReport({
        excludedIds: excluded,
        feedback: Object.keys(feedback).length > 0 ? feedback : null,
        followUpEmail: followUpEmail.trim() || null,
        summary,
      });
      await sendBuildReport(payload);
      useBuildLogStore.getState().setOffer('sent');
      setPhase('sent');
    } catch {
      setPhase('error');
    }
  };

  if (phase === 'sent') {
    return (
      <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
        <HeartHandshake className="size-4 text-primary shrink-0" />
        <p className="text-sm flex-1">
          Sent — thank you! Your build's story is on its way to Josh and Deb.
        </p>
        <button
          onClick={() => setPhase('ask')}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const timelineBase = events[0]?.at ?? Date.now();

  return (
    <div className="mx-4 mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <HeartHandshake className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-sm font-medium">Thanks for trying Relational Builder!</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Would it be okay to share this build's log with the RTP stewards? Josh and Deb —
            two humans — would see the chat log, any errors, and a summary of what was
            created, for this project's first build only. Nothing is shared unless you say
            yes. If you do, it's stored in Builder's database and emailed to them; ask
            anytime and we'll delete it. Sharing these logs is a real help at this early
            phase.
          </p>
        </div>
      </div>

      <button
        onClick={() => setShowPayload(v => !v)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {showPayload ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        See exactly what we'd send
      </button>

      {showPayload && (
        <div className="space-y-3 rounded-md border bg-background/60 p-2.5 max-h-72 overflow-y-auto">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              The conversation — strike anything you'd rather keep private
            </p>
            {messages.map(m => {
              const struck = excluded.has(m.id);
              const label = m.autoLabel ?? m.syncLabel ?? (m.isPlan ? 'Build plan' : m.role === 'user' ? 'You' : 'Builder AI');
              return (
                <div key={m.id} className="flex items-start gap-2 text-xs">
                  <button
                    onClick={() => toggleExcluded(m.id)}
                    className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                    title={struck ? 'Include this message' : "Don't send this message"}
                  >
                    {struck ? <Undo2 className="size-3" /> : <X className="size-3" />}
                  </button>
                  <div className={`min-w-0 flex-1 ${struck ? 'opacity-40 line-through' : ''}`}>
                    <span className="font-medium">{label}:</span>{' '}
                    <span className="text-muted-foreground break-words">
                      {m.content.slice(0, 200)}
                      {m.content.length > 200 ? '…' : ''}
                    </span>
                    {m.attachments?.length ? (
                      <span className="text-muted-foreground italic">
                        {' '}({m.attachments.length} attached {m.attachments.length === 1 ? 'image stays' : 'images stay'} on your device — only the count travels)
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {events.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Build timeline
              </p>
              {events.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  <span className="font-mono">{eventTime(e, timelineBase)}</span>{' '}
                  {EVENT_LABELS[e.type] ?? e.type}
                  {e.detail ? ` — ${e.detail}` : ''}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              What was created
            </p>
            <p className="text-xs text-muted-foreground break-words">
              {files.length} {files.length === 1 ? 'file' : 'files'}
              {files.length > 0 ? `: ${files.join(', ')}` : ''}
            </p>
            <p className="text-xs text-muted-foreground italic">
              Plus a short AI-written summary of what you built, generated when you share.
              File names and sizes travel — file contents don't.
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowFeedback(v => !v)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {showFeedback ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        Add a minute of feedback (optional)
      </button>

      {showFeedback && (
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">What were you hoping to build?</label>
            <textarea
              value={hopedFor}
              onChange={e => setHopedFor(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">
              Was there a moment it felt broken, stuck, or confusing?
            </label>
            <textarea
              value={roughMoments}
              onChange={e => setRoughMoments(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">What surprised you — good or bad?</label>
            <textarea
              value={surprises}
              onChange={e => setSurprises(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">
              Okay for the stewards to follow up? Leave an email (optional)
            </label>
            <input
              type="email"
              value={followUpEmail}
              onChange={e => setFollowUpEmail(e.target.value)}
              placeholder="you@example.org"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {phase === 'error' && (
        <p className="text-xs text-destructive">
          That didn't go through — nothing was shared. You can try again or say no thanks.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={share} disabled={phase === 'sending'} className="flex-1 sm:flex-none sm:min-w-36">
          {phase === 'sending' ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              Sharing…
            </>
          ) : (
            'Share build log'
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={decline}
          disabled={phase === 'sending'}
          className="flex-1 sm:flex-none sm:min-w-36"
        >
          No thanks
        </Button>
      </div>
    </div>
  );
}
