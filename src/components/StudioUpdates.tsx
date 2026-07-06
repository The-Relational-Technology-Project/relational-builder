import { useEffect, useState } from 'react';
import { useStudioStore } from '@/store/studio-store';
import { fetchStudioActivity, type StudioActivityEntry } from '@/cloud/studios';
import { Button } from '@/components/ui/button';
import { Users, Sparkles, Share2, UserPlus } from 'lucide-react';

/**
 * The studio's life on a builder's home: recent shares, publishes, and new
 * joins across the studios they belong to. Belonging comes first — a builder
 * who's active in a studio frame but hasn't joined gets a gentle invitation
 * instead of a feed.
 */

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 3600) return `${Math.max(1, Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function entryLine(e: StudioActivityEntry, studioLabel: string): { icon: typeof Share2; text: string } {
  const who = e.actor_name || 'A builder';
  switch (e.kind) {
    case 'join':
      return { icon: UserPlus, text: `${who} joined ${studioLabel}` };
    case 'share':
      return { icon: Share2, text: `${who} shared a prompt${e.title ? `: ${e.title}` : ''}` };
    case 'publish':
      return { icon: Sparkles, text: `${who} offered a build to the commons${e.title ? `: ${e.title}` : ''}` };
  }
}

export function StudioUpdates() {
  const activeStudio = useStudioStore(s => s.activeStudio);
  const memberships = useStudioStore(s => s.memberships);
  const membershipsLoaded = useStudioStore(s => s.membershipsLoaded);
  const joinStudio = useStudioStore(s => s.joinStudio);
  const [activity, setActivity] = useState<StudioActivityEntry[]>([]);
  const [joining, setJoining] = useState(false);

  const memberSlugs = memberships.map(m => m.studio_slug);
  const isMemberOfActive = !!activeStudio && memberSlugs.includes(activeStudio.slug);
  const labelFor = (slug: string) =>
    memberships.find(m => m.studio_slug === slug)?.studio_label ??
    (activeStudio?.slug === slug ? activeStudio.label : slug);

  useEffect(() => {
    if (memberSlugs.length === 0) { setActivity([]); return; }
    let cancelled = false;
    fetchStudioActivity(memberSlugs).then(entries => {
      if (!cancelled) setActivity(entries);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships.map(m => m.studio_slug).join(',')]);

  if (!membershipsLoaded) return null;

  // Not part of any studio yet: one warm invitation to join the frame
  // they're already building in — belonging before feeds.
  if (memberships.length === 0) {
    if (!activeStudio) return null;
    return (
      <section className="rounded-xl border border-dashed px-4 py-3 flex items-center gap-3">
        <span
          className="size-2.5 rounded-full shrink-0"
          style={{ background: activeStudio.color ?? 'hsl(var(--muted-foreground))' }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">You're building in {activeStudio.label}</p>
          <p className="text-xs text-muted-foreground">
            Join the studio to see what other members share and build — and so they can see you arrive.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={joining}
          onClick={async () => {
            setJoining(true);
            await joinStudio(activeStudio);
            setJoining(false);
          }}
        >
          <Users className="size-3.5 mr-1.5" />
          {joining ? 'Joining…' : 'Join studio'}
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {memberships.length === 1 ? labelFor(memberships[0].studio_slug) : 'Your studios'}
        </h2>
        {activeStudio && !isMemberOfActive && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => joinStudio(activeStudio)}
          >
            + join {activeStudio.label}
          </button>
        )}
      </div>
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">
          Quiet so far — shares and new members will show up here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {activity.map(e => {
            const { icon: Icon, text } = entryLine(e, labelFor(e.studio_slug));
            return (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <Icon className="size-3.5 text-muted-foreground shrink-0" />
                {e.url ? (
                  <a href={e.url} className="truncate hover:underline">{text}</a>
                ) : (
                  <span className="truncate">{text}</span>
                )}
                <span className="text-xs text-muted-foreground/60 shrink-0 tabular-nums">
                  {timeAgo(e.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
