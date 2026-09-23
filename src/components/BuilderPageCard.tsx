import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { deleteCommunitySite } from '@/project/community-sites';
import {
  fetchLiveBuilderPage,
  findBuilderProfileProject,
  startBuilderProfile,
  type LiveBuilderPage,
} from '@/project/builder-profile';
import { Globe, Loader2, Pencil, Sparkles, Trash2 } from 'lucide-react';

/**
 * The door to a builder's public page, at the top of their profile. Three
 * states: nothing yet (start building — free, from what's already here),
 * a project in progress (continue), and a live page (the address, edit,
 * unpublish). Publishing is the public opt-in and happens from the
 * project's own Publish button; unpublishing here releases the handle.
 */
export function BuilderPageCard() {
  const user = useAuthStore(s => s.user);
  const setView = useUIStore(s => s.setView);
  const [live, setLive] = useState<LiveBuilderPage | null | undefined>(undefined);
  const [project, setProject] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([fetchLiveBuilderPage().catch(() => null), findBuilderProfileProject().catch(() => null)])
      .then(([site, proj]) => {
        if (cancelled) return;
        setLive(site);
        setProject(proj);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  async function open() {
    setBusy(true);
    setError(null);
    const r = await startBuilderProfile();
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setView('builder');
  }

  async function unpublish() {
    if (!live) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCommunitySite(live.slug);
      setLive(null);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not take the page down');
    } finally {
      setBusy(false);
    }
  }

  const loading = live === undefined || project === undefined;

  return (
    <section className="rounded-lg border bg-muted/30 p-4 space-y-3 text-left">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <Globe className="size-3.5" />
        Your public builder page
      </h2>

      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="size-3 animate-spin" /> Checking…
        </p>
      ) : live ? (
        <div className="space-y-2">
          <a
            href={live.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline break-all"
          >
            {live.url.replace(/^https?:\/\//, '')}
          </a>
          <p className="text-xs text-muted-foreground">
            Live and public. {live.total_views} view{live.total_views === 1 ? '' : 's'} so far.
            Edit the page in the Builder and publish again to update it.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={open}>
              <Pencil className="size-3 mr-1" />
              Edit page
            </Button>
            {confirming ? (
              <>
                <span className="text-xs text-muted-foreground">Take it down and free the handle?</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={busy} onClick={unpublish}>
                  Yes, unpublish
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={busy} onClick={() => setConfirming(true)}>
                <Trash2 className="size-3 mr-1" />
                Unpublish
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            {project
              ? 'Your page is in progress. Publish it from the Builder when it feels like you.'
              : 'A public page for your relational tech work: your neighborhood, your projects, what you practiced, what you dream about. Nowhere else on the internet has a place for this.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Built with the Builder from what&apos;s already here, free (it doesn&apos;t count
            toward your weekly budget), and public only once you publish it.
          </p>
          <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={open}>
            {busy ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}
            {project ? 'Continue building' : 'Build your builder page'}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
