import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  CONTACT_KINDS,
  type BuilderContact,
} from '@/project/share-live';
import {
  listShareArtifacts,
  renderArtifactHtml,
  captureHtmlScreenshot,
  demoFilesFor,
  type ShareArtifact,
} from '@/project/share-live-artifacts';
import { artifactName } from '@/project/display-name';
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
} from 'lucide-react';

/**
 * Share Live — turn the current build into a demo deck for a room: title +
 * one-liner, a slide per artifact the builder picks (the app, a flyer, a
 * plan), QR + link. The copy drafts itself from the build record and stays
 * editable; publishing makes two unlisted preview links (the demo site,
 * then the deck). Event participants can pin the result to their event's
 * demo wall in the Gallery.
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

/** The Select value for a builder-named contact method */
const OTHER_KIND = 'other';

const CONTACT_PLACEHOLDERS: Record<string, string> = {
  Email: 'you@example.org',
  Phone: '(555) 555-0123',
  Website: 'yourname.org',
};

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
  // What the project can put in front of the room, all ticked to start.
  // Read once: the list is for this dialog's lifetime, the files for its publish.
  const [artifacts] = useState<ShareArtifact[]>(() => {
    const files = getAllFiles();
    const app = files.find(f => f.path.replace(/^\//, '') === 'index.html');
    return listShareArtifacts(files, app ? artifactName(app.path, app.content) : projectName);
  });
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(artifacts.map(a => a.id)));
  const [shots, setShots] = useState<Record<string, string | null>>({});
  const [capturing, setCapturing] = useState<Set<string>>(() => new Set(artifacts.map(a => a.id)));
  const [event, setEvent] = useState<{ code: string; name: string } | null>(null);
  const [pin, setPin] = useState(true);
  // A way to reach them — optional, empty by default: the deck and the wall
  // are public enough that nothing should land there unasked
  const [contactKind, setContactKind] = useState<string>(CONTACT_KINDS[0]);
  const [contactOtherLabel, setContactOtherLabel] = useState('');
  const [contactValue, setContactValue] = useState('');
  const contact = useMemo<BuilderContact | null>(
    () =>
      contactValue.trim()
        ? {
            label: (contactKind === OTHER_KIND ? contactOtherLabel.trim() : contactKind) || 'Contact',
            value: contactValue.trim(),
          }
        : null,
    [contactKind, contactOtherLabel, contactValue],
  );

  const [publishStep, setPublishStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneResult | null>(null);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // The app's screenshot comes from whatever the preview is showing right
  // now — retry a few times so a still-bundling preview gets its chance.
  // Flyers and docs render offscreen for theirs, so a paper-only build
  // gets pictures too.
  const capture = useCallback(async (artifact: ShareArtifact) => {
    setCapturing(c => new Set(c).add(artifact.id));
    let shot: string | null = null;
    if (artifact.kind === 'app') {
      for (let attempt = 0; attempt < 4 && !shot; attempt++) {
        shot = await capturePreviewScreenshot();
        if (!alive.current) return;
        if (!shot) await new Promise(r => setTimeout(r, 2500));
        if (!alive.current) return;
      }
    } else {
      const html = renderArtifactHtml(getAllFiles(), artifact);
      shot = html ? await captureHtmlScreenshot(html) : null;
      if (!alive.current) return;
    }
    setShots(prev => ({ ...prev, [artifact.id]: shot }));
    setCapturing(c => {
      const next = new Set(c);
      next.delete(artifact.id);
      return next;
    });
  }, [getAllFiles]);

  useEffect(() => {
    for (const a of artifacts) void capture(a);
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
    const picked = artifacts.filter(a => chosen.has(a.id));
    if (picked.length === 0) {
      setError('Pick at least one thing to share');
      return;
    }
    const withApp = picked.some(a => a.kind === 'app');
    const deckTitle = title.trim() || projectName;
    try {
      // 1. The demo site, as an unlisted preview — the deck's QR link. The
      // app when it's chosen (plus a page per chosen doc); otherwise just
      // the chosen pages, with the flyer itself as the front page.
      setPublishStep(withApp ? 'Publishing the app preview…' : 'Publishing the pages…');
      const files = getAllFiles();
      const publicVars = getPublicEnvVars();
      const siteFiles = withApp
        ? withAppIcons(
            needsBuild(files)
              ? await buildStaticSite(files, publicVars.map(v => ({ key: v.key, value: v.value })))
              : files,
            deckTitle,
          )
        : [];
      const demoFiles = demoFilesFor(siteFiles, files, picked, deckTitle);
      const demo = await createPreviewLink(demoFiles, deckTitle, withApp ? publicVars : []);

      // 2. The screenshots, hosted so both deck and wall can point at them
      const slides: { kindLabel: string; name: string; screenshotUrl: string | null }[] = [];
      for (const a of picked) {
        let screenshotUrl: string | null = null;
        const shot = shots[a.id];
        if (shot) {
          setPublishStep(`Hosting the ${a.kind === 'app' ? 'screenshot' : a.name + ' picture'}…`);
          const small = await shrinkScreenshot(shot);
          if (small) screenshotUrl = await hostScreenshot(small);
        }
        slides.push({ kindLabel: a.kindLabel, name: a.name, screenshotUrl });
      }
      const screenshotUrl = slides.find(s => s.screenshotUrl)?.screenshotUrl ?? null;

      // 3. The deck — one self-contained page, published the same way
      setPublishStep('Composing the slides…');
      const bullets = bulletsText.split('\n').map(b => b.trim()).filter(Boolean).slice(0, 5);
      const deckHtml = buildDeckHtml({
        title: deckTitle,
        oneLiner: oneLiner.trim(),
        builderName: profile?.display_name ?? profile?.full_name ?? null,
        eventName: event?.name ?? null,
        bullets,
        artifacts: slides,
        demoUrl: demo.previewUrl,
        qrSvg: qrSvgMarkup(demo.previewUrl, 420),
        contact,
      });
      setPublishStep('Publishing the deck…');
      const now = Date.now();
      const deck = await createPreviewLink(
        [{ path: '/index.html', content: deckHtml, language: 'html', createdAt: now, updatedAt: now }],
        `${deckTitle} slides`,
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
            projectName: deckTitle,
            oneLiner: oneLiner.trim() || null,
            screenshotUrl,
            deckUrl: deck.previewUrl,
            demoUrl: demo.previewUrl,
            contact,
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
  }, [getAllFiles, getPublicEnvVars, title, oneLiner, bulletsText, artifacts, chosen, shots, event, pin, user, profile, projectName, contact]);

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
        Slides for a projector: your title and one-liner, a slide for each thing
        you're sharing, and a QR code the room can scan to open it.
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
        <label className="text-xs font-medium">
          {artifacts.length > 1 ? 'What to share' : 'What the room sees'}
        </label>
        {artifacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing to show yet — build something first, then share it.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {artifacts.map(a => {
              const on = chosen.has(a.id);
              const busy = capturing.has(a.id);
              const shot = shots[a.id];
              return (
                <li key={a.id}>
                  <label
                    className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
                      artifacts.length > 1 ? 'cursor-pointer' : ''
                    } ${on ? '' : 'opacity-60'}`}
                  >
                    {artifacts.length > 1 && (
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={e =>
                          setChosen(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(a.id);
                            else next.delete(a.id);
                            return next;
                          })
                        }
                        className="accent-primary"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.kindLabel}</div>
                    </div>
                    {busy ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> capturing…
                      </span>
                    ) : shot ? (
                      <img
                        src={shot}
                        alt={`${a.name} screenshot`}
                        className="h-12 w-16 rounded border object-cover object-top bg-white"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault();
                          void capture(a);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="No picture yet — the slide works without one"
                      >
                        <ImageOff className="size-3.5" /> retry
                      </button>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {artifacts.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Each gets its own slide. The QR opens the app if it's ticked, otherwise
            the page{artifacts.filter(a => a.kind !== 'app').length > 1 ? 's' : ''} you chose.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium">
          A way to reach you <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <div className="flex gap-1.5">
          <Select value={contactKind} onValueChange={v => setContactKind(v ?? CONTACT_KINDS[0])}>
            <SelectTrigger className="h-8 w-28 shrink-0 text-sm" aria-label="Contact method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_KINDS.map(k => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
              <SelectItem value={OTHER_KIND}>Other</SelectItem>
            </SelectContent>
          </Select>
          {contactKind === OTHER_KIND && (
            <Input
              value={contactOtherLabel}
              onChange={e => setContactOtherLabel(e.target.value)}
              maxLength={24}
              placeholder="Label (Signal, Instagram…)"
              className="h-8 w-40 text-sm"
              aria-label="Contact label"
            />
          )}
          <Input
            value={contactValue}
            onChange={e => setContactValue(e.target.value)}
            maxLength={120}
            type={contactKind === 'Email' ? 'email' : contactKind === 'Phone' ? 'tel' : contactKind === 'Website' ? 'url' : 'text'}
            placeholder={CONTACT_PLACEHOLDERS[contactKind] ?? 'How people can find you'}
            className="h-8 min-w-0 flex-1 text-sm"
            aria-label="Contact details"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Goes on your slides{event ? ' and your card on the event shelf' : ''}, so people
          in the room can follow up. Leave it blank to share the build without it.
        </p>
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
            Add it to the <strong className="font-medium">{event.name}</strong> shelf
            in the Gallery — screenshot, one-liner, and links, for everyone at the event.
          </span>
        </label>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <Button
        onClick={publish}
        disabled={publishStep !== null || artifacts.length === 0 || chosen.size === 0}
        className="w-full gap-2"
      >
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
        Makes two unlisted links — what you're sharing and the slides — live for{' '}
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
      {linkRow('Live link — what the QR on the last slide opens', result.demoUrl)}

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
          Pinned to your event's shelf in the Gallery.
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
