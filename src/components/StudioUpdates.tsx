import { useEffect, useState } from 'react';
import { useStudioStore, approvedMemberships } from '@/store/studio-store';
import { fetchStudioActivity, type StudioActivityEntry } from '@/cloud/studios';
import { Button } from '@/components/ui/button';
import { Users, Sparkles, Share2, UserPlus, Hourglass } from 'lucide-react';

/**
 * Network Updates — the network's life on a builder's home: recent shares,
 * publishes, and new joins across the studios they belong to, each item noting
 * which studio it happened in. Belonging comes first — a builder who's active
 * in a studio frame but hasn't joined gets a gentle invitation instead of a feed.
 */

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 3600) return `${Math.max(1, Math.floor(secs / 60))}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function entryLine(e: StudioActivityEntry): { icon: typeof Share2; text: string } {
  const who = e.actor_name || 'A builder';
  switch (e.kind) {
    case 'join':
      return { icon: UserPlus, text: `${who} joined` };
    case 'share':
      return { icon: Share2, text: `${who} shared a prompt${e.title ? `: ${e.title}` : ''}` };
    case 'publish':
      return { icon: Sparkles, text: `${who} offered a build to the commons${e.title ? `: ${e.title}` : ''}` };
  }
}

export function NetworkUpdates() {
  const activeStudio = useStudioStore(s => s.activeStudio);
  const memberships = useStudioStore(s => s.memberships);
  const membershipsLoaded = useStudioStore(s => s.membershipsLoaded);
  const accessMap = useStudioStore(s => s.accessMap);
  const joinStudio = useStudioStore(s => s.joinStudio);
  const [activity, setActivity] = useState<StudioActivityEntry[]>([]);
  const [joining, setJoining] = useState(false);

  // The feed follows real belonging; a pending request isn't in yet
  const approved = approvedMemberships(memberships);
  const memberSlugs = approved.map(m => m.studio_slug);
  const isMemberOfActive = !!activeStudio && memberSlugs.includes(activeStudio.slug);
  const isPendingActive =
    !!activeStudio &&
    memberships.some(m => m.studio_slug === activeStudio.slug && m.status === 'pending');
  const activeIsGated = !!activeStudio && accessMap.get(activeStudio.slug) === 'gated';
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
  }, [memberSlugs.join(',')]);

  if (!membershipsLoaded) return null;

  // Not part of any studio yet: one warm invitation to join the frame
  // they're already building in — belonging before feeds. A gated studio's
  // door asks first: joining files a request for its admins.
  if (approved.length === 0) {
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
            {isPendingActive
              ? 'Your request to join is with the studio admins — you\'ll be in once they approve it.'
              : activeIsGated
                ? 'This studio approves its members — ask to join and a Studio Admin will let you in.'
                : 'Join the studio to see what other members share and build — and so they can see you arrive.'}
          </p>
        </div>
        {isPendingActive ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Hourglass className="size-3.5" /> Request pending
          </span>
        ) : (
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
            {joining
              ? activeIsGated ? 'Asking…' : 'Joining…'
              : activeIsGated ? 'Ask to join' : 'Join studio'}
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Network Updates</h2>
        {activeStudio && !isMemberOfActive && (
          isPendingActive ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Hourglass className="size-3" /> {activeStudio.label} request pending
            </span>
          ) : (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => joinStudio(activeStudio)}
            >
              {activeIsGated ? `+ ask to join ${activeStudio.label}` : `+ join ${activeStudio.label}`}
            </button>
          )
        )}
      </div>
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">
          Quiet so far — shares and new members across your studios will show up here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {activity.map(e => {
            const { icon: Icon, text } = entryLine(e);
            return (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <Icon className="size-3.5 text-muted-foreground shrink-0" />
                {e.url ? (
                  <a href={e.url} className="truncate hover:underline">{text}</a>
                ) : (
                  <span className="truncate">{text}</span>
                )}
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {labelFor(e.studio_slug)}
                </span>
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
