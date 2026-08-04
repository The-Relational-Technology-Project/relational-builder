import { useEffect, useMemo, useState } from 'react';
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
import { capturePreviewScreenshot } from '@/preview/screenshot';
import { Button } from '@/components/ui/button';

/**
 * The opt-in ask, shown once per project when its initial build lands.
 *
 * Consent design, deliberately:
 * - Asked AFTER the build, at a CALM moment: the offer arms when the build
 *   lands but the card only appears once things have settled — nothing
 *   generating, no fix queued or review running, and a quiet stretch since
 *   the last activity. Never in the middle of error churn.
 * - Asked ONCE. Declining, dismissing (X), or simply building on past the
 *   card all retire it for good — it never re-surfaces after the next
 *   answer. (Feedback someone started typing keeps it alive.)
 * - "See exactly what we'd send" shows the real payload — the same object
 *   that ships — and any chat message can be struck before sending.
 * - Decline is a first-class button, visually equal to accept.
 * - Nothing is assembled, generated, or transmitted until the yes.
 */

/** Quiet time after the last build/fix/review activity before the ask appears */
const SETTLE_MS = 60_000;

const EVENT_LABELS: Record<BuildEventType, string> = {
  build_start: 'Build started',
  gen_start: 'Generation started',
  gen_end: 'Generation ended',
  reply_cut_off: 'Reply cut off',
  auto_continuation: 'Automatic continuation',
  continuation_cap: 'Continuation limit reached',
  apply_warnings: "Some edits didn't apply",
  preview_error: 'Preview error',
  preview_recovered: 'Preview recovered',
  auto_error_fix: 'Automatic error fix',
  manual_error_fix: 'Fix requested by hand',
  quality_review_fix: 'Quality review queued a fix',
  build_ready: 'Build ready',
  retrieval: 'Commons knowledge searched',
  commons_mentions: 'Reply drew on the commons',
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
  const isGenerating = useChatStore(s => s.isGenerating);
  const reviewing = useChatStore(s => s.reviewing);
  const pendingFixSend = useChatStore(s => s.pendingFixSend);
  const queuedMessage = useChatStore(s => s.queuedMessage);
  const fileCount = useProjectStore(s => s.getFileCount());

  const [showPayload, setShowPayload] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [hopedFor, setHopedFor] = useState('');
  const [roughMoments, setRoughMoments] = useState('');
  const [surprises, setSurprises] = useState('');
  const [builderName, setBuilderName] = useState('');
  const [builderEmail, setBuilderEmail] = useState('');
  // The snapshot is captured on-device the moment the card appears, so the
  // checkbox and the payload preview show the REAL image — it never travels
  // unless the box stays ticked and the builder shares.
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotTries, setScreenshotTries] = useState(0);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [phase, setPhase] = useState<'ask' | 'sending' | 'sent' | 'error'>('ask');

  const files = useMemo(
    () => useProjectStore.getState().getAllFiles().map(f => f.path),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileCount, offer],
  );

  const busy = isGenerating || reviewing || pendingFixSend || Boolean(queuedMessage);
  // Started feedback, struck a message, or is mid-send — the ask stays alive
  const engaged =
    phase !== 'ask' ||
    excluded.size > 0 ||
    Boolean(
      hopedFor.trim() || roughMoments.trim() || surprises.trim() ||
      builderName.trim() || builderEmail.trim(),
    );

  // armed → pending: only after a quiet stretch. Any new activity re-runs
  // this effect and restarts the clock, so the ask lands when the build has
  // genuinely settled — never between error fixes or mid-review.
  useEffect(() => {
    if (offer !== 'armed' || busy) return;
    const t = setTimeout(() => {
      const chat = useChatStore.getState();
      const quiet = !chat.isGenerating && !chat.reviewing && !chat.pendingFixSend && !chat.queuedMessage;
      if (quiet && useBuildLogStore.getState().offer === 'armed') {
        useBuildLogStore.getState().setOffer('pending');
      }
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [offer, busy]);

  // Ask once: building on past the visible card (a new send while it shows,
  // untouched) is an answer — retire it instead of re-surfacing later.
  useEffect(() => {
    if (offer === 'pending' && isGenerating && !engaged) {
      useBuildLogStore.getState().setOffer('declined');
    }
  }, [offer, isGenerating, engaged]);

  // Snapshot of the running app, captured locally once the card is up. The
  // preview may still be bundling when the card mounts (a reload with the
  // ask already pending), so a null capture retries a few times before the
  // card settles for offering no snapshot — the report ships without a
  // picture either way.
  useEffect(() => {
    if (offer !== 'pending' || busy || screenshot || screenshotTries >= 5) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const shot = await capturePreviewScreenshot();
      if (cancelled) return;
      setScreenshotTries(n => n + 1);
      if (shot) setScreenshot(shot);
    }, screenshotTries === 0 ? 0 : 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [offer, busy, screenshot, screenshotTries]);

  if (offer !== 'pending' && phase !== 'sent') return null;
  if (messages.length === 0) return null;
  // Never sit on screen while a reply streams (engaged cards come back after)
  if (busy && phase !== 'sent') return null;

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
        builderName: builderName.trim() || null,
        builderEmail: builderEmail.trim() || null,
        screenshot: includeScreenshot ? screenshot : null,
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
            Would it be okay to share this build's log with the RTP stewards? Josh and Deb
            would see the chat log, any errors, a summary of what was created, and — if
            you leave the box ticked — a snapshot image of your app, for this
            project's first build only. Nothing is shared unless you say
            yes. If you do, it's stored in Builder's database and emailed to them; ask
            anytime and we'll delete it. Sharing these logs is a real help at this early
            phase.
          </p>
        </div>
        <button
          onClick={decline}
          disabled={phase === 'sending'}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="No thanks — don't ask again for this project"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">
          Who's building? Your name and email travel with the report so the stewards
          know who to thank — and can follow up (optional)
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={builderName}
            onChange={e => setBuilderName(e.target.value)}
            placeholder="Your name"
            className={inputClass}
          />
          <input
            type="email"
            value={builderEmail}
            onChange={e => setBuilderEmail(e.target.value)}
            placeholder="you@example.org"
            className={inputClass}
          />
        </div>
      </div>

      {screenshot && (
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={includeScreenshot}
            onChange={e => setIncludeScreenshot(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span className="text-muted-foreground leading-relaxed">
            Attach a snapshot image of the app as it looks right now — it's under
            "see exactly what we'd send" below
          </span>
        </label>
      )}

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

          {screenshot && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                App snapshot
              </p>
              {includeScreenshot ? (
                <>
                  <img
                    src={screenshot}
                    alt="Snapshot of your app that would travel with the report"
                    className="max-h-44 w-auto rounded border"
                  />
                  <p className="text-xs text-muted-foreground italic">
                    This image travels with the report — untick the snapshot box above to
                    leave it out.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Not included — the snapshot box above is unticked.
                </p>
              )}
            </div>
          )}
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
