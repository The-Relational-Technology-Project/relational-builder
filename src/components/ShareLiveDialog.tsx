import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from '@/project/local-projects';
import { createPreviewLink, PREVIEW_DAYS } from '@/project/share-preview';
import { needsBuild, buildStaticSite } from '@/project/build-for-publish';
import { withAppIcons } from '@/project/app-icon';
import { suggestProjectName } from '@/project/suggest-name';
import { capturePreviewScreenshot } from '@/preview/screenshot';
import {
  draftShareLiveCopy,
  shrinkScreenshot,
  hostScreenshot,
  buildDeckHtml,
} from '@/project/share-live';
import { fetchMyEvent, pinToShowcase } from '@/cloud/event-showcase';
import { qrSvgMarkup } from '@/lib/qr-svg';
import QRCode from 'react-qr-code';
import {
  Presentation,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  ImageOff,
  RefreshCw,
} from 'lucide-react';

/**
 * Share Live — turn the current build into a three-slide demo deck for a
 * room: title + one-liner, screenshot + what it does, QR + link. The copy
 * drafts itself from the build record and stays editable; publishing makes
 * two unlisted preview links (the running app, then the deck). Event
 * participants can pin the result to their event's demo wall in the Gallery.
 */
export function ShareLiveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="size-4" />
            Share with the room
          </DialogTitle>
        </DialogHeader>
        <ShareLiveContent />
      </DialogContent>
    </Dialog>
  );
}

interface DoneResult {
  deckUrl: string;
  demoUrl: string;
  pinned: boolean;
  pinError: string | null;
}

function ShareLiveContent() {
  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const getPublicEnvVars = useEnvStore(s => s.getPublic);
  const user = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const cloudProjectName = useCloudStore(s => s.currentProjectName);
  const localProjectName = useLocalProjects(s => s.currentName);
  const projectName = cloudProjectName || localProjectName || suggestProjectName() || 'My build';

  const [title, setTitle] = useState(projectName);
  const [oneLiner, setOneLiner] = useState('');
  const [bulletsText, setBulletsText] = useState('');
  const [drafting, setDrafting] = useState(true);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(true);
  const [event, setEvent] = useState<{ code: string; name: string } | null>(null);
  const [pin, setPin] = useState(true);

  const [publishStep, setPublishStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneResult | null>(null);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // The screenshot comes from whatever the preview is showing right now —
  // retry a few times so a still-bundling preview gets its chance
  const capture = useCallback(async () => {
    setCapturing(true);
    for (let attempt = 0; attempt < 4; attempt++) {
      const shot = await capturePreviewScreenshot();
      if (!alive.current) return;
      if (shot) {
        setScreenshot(shot);
        setCapturing(false);
        return;
      }
      await new Promise(r => setTimeout(r, 2500));
      if (!alive.current) return;
    }
    setCapturing(false);
  }, []);

  useEffect(() => {
    void capture();
    fetchMyEvent().then(e => { if (alive.current) setEvent(e); });
    draftShareLiveCopy()
      .then(copy => {
        if (!alive.current) return;
        setOneLiner(copy.oneLiner);
        setBulletsText(copy.bullets.join('\n'));
      })
      .catch(e => {
        if (!alive.current) return;
        setDraftNote(
          e instanceof Error && e.message
            ? `${e.message} — the fields below are yours to fill.`
            : 'Drafting was unavailable — the fields below are yours to fill.',
        );
      })
      .finally(() => { if (alive.current) setDrafting(false); });
    // Runs once per dialog mount, on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = useCallback(async () => {
    setError(null);
    try {
      // 1. The running app, as an unlisted preview — the deck's demo link
      setPublishStep('Publishing the app preview…');
      const files = getAllFiles();
      const publicVars = getPublicEnvVars();
      const builtFiles = needsBuild(files)
        ? await buildStaticSite(files, publicVars.map(v => ({ key: v.key, value: v.value })))
        : files;
      const demo = await createPreviewLink(withAppIcons(builtFiles, title), title, publicVars);

      // 2. The screenshot, hosted so both deck and wall can point at it
      let screenshotUrl: string | null = null;
      if (screenshot) {
        setPublishStep('Hosting the screenshot…');
        const small = await shrinkScreenshot(screenshot);
        if (small) screenshotUrl = await hostScreenshot(small);
      }

      // 3. The deck — one self-contained page, published the same way
      setPublishStep('Composing the slides…');
      const bullets = bulletsText.split('\n').map(b => b.trim()).filter(Boolean).slice(0, 5);
      const deckHtml = buildDeckHtml({
        title: title.trim() || projectName,
        oneLiner: oneLiner.trim(),
        builderName: profile?.display_name ?? profile?.full_name ?? null,
        eventName: event?.name ?? null,
        bullets,
        screenshotUrl,
        demoUrl: demo.previewUrl,
        qrSvg: qrSvgMarkup(demo.previewUrl, 420),
      });
      setPublishStep('Publishing the deck…');
      const now = Date.now();
      const deck = await createPreviewLink(
        [{ path: '/index.html', content: deckHtml, language: 'html', createdAt: now, updatedAt: now }],
        `${title.trim() || projectName} slides`,
      );

      // 4. The demo wall, if they're at an event and want to be on it
      let pinned = false;
      let pinError: string | null = null;
      if (event && pin && user) {
        setPublishStep('Pinning to the demo wall…');
        try {
          await pinToShowcase({
            eventCode: event.code,
            eventName: event.name,
            ownerId: user.id,
            builderName: profile?.display_name ?? profile?.full_name ?? null,
            projectName: title.trim() || projectName,
            oneLiner: oneLiner.trim() || null,
            screenshotUrl,
            deckUrl: deck.previewUrl,
            demoUrl: demo.previewUrl,
          });
          pinned = true;
        } catch (e) {
          pinError = e instanceof Error ? e.message : 'Could not pin to the wall';
        }
      }

      if (!alive.current) return;
      setDone({ deckUrl: deck.previewUrl, demoUrl: demo.previewUrl, pinned, pinError });
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Could not create the deck');
    } finally {
      if (alive.current) setPublishStep(null);
    }
  }, [getAllFiles, getPublicEnvVars, title, oneLiner, bulletsText, screenshot, event, pin, user, profile, projectName]);

  if (!cloudEnabled || !user) {
    return (
      <p className="text-sm text-muted-foreground pt-2">
        Sign in (top right) to make a demo deck — it's hosted on the same
        community infrastructure as preview links.
      </p>
    );
  }

  if (done) return <DeckResult result={done} />;

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-muted-foreground">
        Three slides for a projector: your title and one-liner, a screenshot
        with what it does, and a QR code the room can scan to try it live.
      </p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium">Title</label>
        <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} className="h-8 text-sm" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium">One-liner</label>
          {drafting && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> drafting…
            </span>
          )}
        </div>
        <Input
          value={oneLiner}
          onChange={e => setOneLiner(e.target.value)}
          maxLength={160}
          placeholder="What this is, for a room of strangers"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium">Main features — one per line</label>
        <textarea
          value={bulletsText}
          onChange={e => setBulletsText(e.target.value)}
          rows={4}
          placeholder={'Sign up for a shift in two taps\nSee who else is coming'}
          className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/70"
        />
      </div>
      {draftNote && <p className="text-xs text-muted-foreground">{draftNote}</p>}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium">Screenshot</label>
          {capturing ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> capturing the preview…
            </span>
          ) : !screenshot ? (
            <button
              onClick={() => void capture()}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3" /> retry
            </button>
          ) : null}
        </div>
        {screenshot ? (
          <img
            src={screenshot}
            alt="Preview screenshot for the deck"
            className="max-h-36 rounded-lg border object-contain"
          />
        ) : !capturing ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ImageOff className="size-3.5" />
            No screenshot yet — make sure the preview has rendered, then retry.
            The deck works without one.
          </p>
        ) : null}
      </div>

      {event && (
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={pin}
            onChange={e => setPin(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            Add it to the <strong className="font-medium">{event.name}</strong> demo
            wall in the Gallery — screenshot, one-liner, and links, visible to everyone.
          </span>
        </label>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <Button onClick={publish} disabled={publishStep !== null} className="w-full gap-2">
        {publishStep ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {publishStep}
          </>
        ) : (
          <>
            <Presentation className="size-4" />
            Create the deck
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Makes two unlisted links — the running app and the slides — live for{' '}
        {PREVIEW_DAYS} days. Click or arrow keys move the slides.
      </p>
    </div>
  );
}

function DeckResult({ result }: { result: DoneResult }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(current => (current === url ? null : current)), 2000);
  }, []);

  const linkRow = (label: string, url: string) => (
    <div className="min-w-0 space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <div className="flex min-w-0 gap-1.5">
        <div className="min-w-0 flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono truncate">{url}</div>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0" onClick={() => copy(url)}>
          {copied === url ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0">
            <ExternalLink className="size-3.5" />
          </Button>
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 space-y-4 pt-2">
      {linkRow('Slides — open this on the projector', result.deckUrl)}
      {linkRow('Live app — what the QR on the last slide opens', result.demoUrl)}

      <div className="flex flex-col items-center gap-2 pt-1">
        {/* White card behind the code keeps it scannable in dark mode */}
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <QRCode
            value={result.deckUrl}
            size={140}
            bgColor="#ffffff"
            fgColor="#1c1917"
            aria-label={`QR code for ${result.deckUrl}`}
          />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Smartphone className="size-3.5" />
          This code opens the slides — handy for grabbing them on the podium laptop
        </p>
      </div>

      {result.pinned && (
        <p className="text-xs text-muted-foreground text-center">
          Pinned to your event's demo wall in the Gallery.
        </p>
      )}
      {result.pinError && (
        <p className="text-xs text-destructive text-center">
          The deck is live, but pinning to the demo wall failed: {result.pinError}
        </p>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Both links stay live for {PREVIEW_DAYS} days. For a permanent home, use{' '}
        <span className="font-medium">Share → Publish</span>.
      </p>
    </div>
  );
}
