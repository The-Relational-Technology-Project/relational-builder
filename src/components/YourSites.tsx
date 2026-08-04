import { useEffect, useState } from 'react';
import {
  listCommunitySites, deleteCommunitySite, listSiteVersions, restoreSiteVersion,
  type CommunitySite, type SiteVersion,
} from '@/project/community-sites';
import { Button } from '@/components/ui/button';
import { Globe, Eye, MessageCircle, Trash2, ExternalLink, Loader2, ChevronDown, ChevronUp, History, AlertTriangle } from 'lucide-react';

/**
 * Two weeks of daily views as a quiet inline sparkline — enough to answer
 * "is anyone using it?" at a glance, gap days included.
 */
function ViewSparkline({ daily }: { daily: { day: string; views: number }[] }) {
  const DAYS = 14;
  // Anchored once at mount: render must stay pure, and a dashboard open
  // across midnight shifting its window by a day mid-render helps nobody
  const [now] = useState(() => Date.now());
  // Fill missing days with zeros so gaps read as gaps
  const byDay = new Map(daily.map(d => [d.day, Number(d.views)]));
  const bars: number[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const day = new Date(now - i * 86400_000).toISOString().slice(0, 10);
    bars.push(byDay.get(day) ?? 0);
  }
  const max = Math.max(...bars);
  if (max === 0) return null;

  const W = 56;
  const H = 14;
  const bw = W / DAYS;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0 opacity-80"
      aria-label="Views over the last two weeks"
    >
      {bars.map((v, i) => {
        const h = v === 0 ? 1 : Math.max(2, Math.round((v / max) * H));
        return (
          <rect
            key={i}
            x={i * bw + 0.5}
            y={H - h}
            width={bw - 1}
            height={h}
            rx={0.5}
            className={v === 0 ? 'fill-muted-foreground/25' : 'fill-primary'}
          />
        );
      })}
    </svg>
  );
}

/**
 * A builder's live community-hosted sites: views (is it alive?), neighbor
 * notes (is it serving?), and take-down. The dashboard's evidence-of-value
 * surface — what a local relational technologist shows their neighborhood.
 */
export function YourSites() {
  const [sites, setSites] = useState<CommunitySite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Site health: which site's error list is open
  const [errorsFor, setErrorsFor] = useState<string | null>(null);
  // Version history: which site's is open, its snapshots, restore-in-flight
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, SiteVersion[]>>({});
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoredNote, setRestoredNote] = useState<string | null>(null);

  useEffect(() => {
    listCommunitySites()
      .then(setSites)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function toggleVersions(slug: string) {
    if (versionsFor === slug) {
      setVersionsFor(null);
      return;
    }
    setVersionsFor(slug);
    setRestoredNote(null);
    if (!versions[slug]) {
      try {
        const list = await listSiteVersions(slug);
        setVersions(v => ({ ...v, [slug]: list }));
      } catch {
        setVersions(v => ({ ...v, [slug]: [] }));
      }
    }
  }

  async function handleRestore(slug: string, version: SiteVersion) {
    const when = new Date(version.taken_at).toLocaleString();
    if (!window.confirm(
      `Put the live site back to how it was on ${when}? ` +
      `Today's version is saved as a snapshot first, so you can change your mind.`,
    )) return;
    setRestoring(version.id);
    try {
      await restoreSiteVersion(slug, version.id);
      const list = await listSiteVersions(slug).catch(() => null);
      if (list) setVersions(v => ({ ...v, [slug]: list }));
      setRestoredNote(`The site is back to its ${when} version — same address, live now.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed — the live site is unchanged');
    } finally {
      setRestoring(null);
    }
  }

  async function handleDelete(slug: string) {
    setDeleting(slug);
    try {
      await deleteCommunitySite(slug);
      setSites(s => (s ?? []).filter(site => site.slug !== slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not take the site down');
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  if (error && !sites?.length) return null; // quiet when backend unreachable
  if (!sites || sites.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Your live sites
      </p>
      <div className="space-y-2">
        {sites.map(site => {
          const isExpanded = expanded === site.slug;
          return (
            <div key={site.slug} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="size-3.5 text-muted-foreground shrink-0" />
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium truncate hover:underline inline-flex items-center gap-1"
                >
                  {site.name}
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {site.daily && site.daily.length > 0 && <ViewSparkline daily={site.daily} />}
                  <span className="inline-flex items-center gap-1" title={`${site.week_views} this week`}>
                    <Eye className="size-3" />
                    {site.total_views}
                    {site.week_views > 0 && <span className="text-green-600 dark:text-green-400">+{site.week_views}/wk</span>}
                  </span>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-40"
                    onClick={() => setExpanded(isExpanded ? null : site.slug)}
                    disabled={site.feedback.length === 0}
                    title={site.feedback.length ? 'Notes from neighbors' : 'No notes yet'}
                  >
                    <MessageCircle className="size-3" />
                    {site.feedback.length}
                    {site.feedback.length > 0 && (isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
                  </button>
                  {(site.week_errors ?? 0) > 0 && (
                    <button
                      className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500 hover:text-amber-700"
                      onClick={() => setErrorsFor(errorsFor === site.slug ? null : site.slug)}
                      title="Neighbors hit errors on this site this week"
                    >
                      <AlertTriangle className="size-3" />
                      {site.week_errors}
                    </button>
                  )}
                  <button
                    className="hover:text-foreground"
                    onClick={() => toggleVersions(site.slug)}
                    title="Earlier versions of this site"
                  >
                    <History className="size-3" />
                  </button>
                  {confirming === site.slug ? (
                    <span className="inline-flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-5 px-1.5 text-xs"
                        onClick={() => handleDelete(site.slug)}
                        disabled={deleting !== null}
                      >
                        {deleting === site.slug ? <Loader2 className="size-3 animate-spin" /> : 'Take down'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs"
                        onClick={() => setConfirming(null)}
                        disabled={deleting !== null}
                      >
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <button
                      className="hover:text-destructive"
                      onClick={() => setConfirming(site.slug)}
                      title="Take this site down"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && site.feedback.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t">
                  {site.feedback.map(note => (
                    <div key={note.id} className="text-xs">
                      <span className="text-muted-foreground">
                        {note.name || 'A neighbor'} · {new Date(note.created_at).toLocaleDateString()}:
                      </span>{' '}
                      {note.message}
                    </div>
                  ))}
                </div>
              )}
              {errorsFor === site.slug && (site.errors?.length ?? 0) > 0 && (
                <div className="space-y-1.5 pt-1 border-t">
                  <p className="text-xs text-amber-700 dark:text-amber-500 font-medium">
                    Errors neighbors hit this week — open the project and ask
                    the Builder to fix one, or restore an earlier version below.
                  </p>
                  {site.errors!.map((err, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      <span className="font-mono break-all">{err.message}</span>
                      {' · '}{err.count}×, last {new Date(err.last_seen).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  ))}
                </div>
              )}
              {versionsFor === site.slug && (
                <div className="space-y-1.5 pt-1 border-t">
                  {restoredNote && <p className="text-xs text-primary">{restoredNote}</p>}
                  {!versions[site.slug] ? (
                    <p className="text-xs text-muted-foreground">Loading versions…</p>
                  ) : versions[site.slug].length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No earlier versions yet — one is kept automatically every
                      time you republish.
                    </p>
                  ) : (
                    versions[site.slug].map(v => (
                      <div key={v.id} className="flex items-center gap-2 text-xs">
                        <History className="size-2.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">
                          {new Date(v.taken_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {' · '}{v.file_count} files
                          {v.label === 'before restore' ? ' · saved before a restore' : ''}
                        </span>
                        <button
                          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground underline decoration-dotted disabled:opacity-40"
                          onClick={() => handleRestore(site.slug, v)}
                          disabled={restoring !== null}
                        >
                          {restoring === v.id ? <Loader2 className="size-3 animate-spin" /> : 'Restore'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Neighbors can leave notes right on your site — they land here.
      </p>
    </div>
  );
}
