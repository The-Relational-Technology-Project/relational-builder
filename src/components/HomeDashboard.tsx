import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useCommunityStore } from '@/store/community-store';
import { useConnectionsStore } from '@/store/connections-store';
import { useUIStore } from '@/store/ui-store';
import { promoteWorkspaceToCloud } from '@/project/local-projects';
import { StartFromOptions } from '@/components/StartFromMenu';
import { DesignSystemDialog } from '@/components/DesignSystemDialog';
import { FolderOpen, HeartHandshake, Loader2, Palette, Sparkles } from 'lucide-react';

interface HomeDashboardProps {
  /** The hero composer, rendered by ChatPanel so send logic stays in one place */
  composer?: ReactNode;
}

/**
 * Full-width home. Signed-in builders get a dashboard: greeting, the big
 * composer, their cloud projects and sites. Signed-out (or local-only)
 * builders get the welcome hero with the same composer.
 */
export function HomeDashboard({ composer }: HomeDashboardProps) {
  const user = useAuthStore(s => s.user);

  if (!cloudEnabled || !user) {
    return <WelcomeScreen composer={composer} />;
  }
  return <SignedInDashboard composer={composer} />;
}

function SignedInDashboard({ composer }: HomeDashboardProps) {
  const user = useAuthStore(s => s.user);
  const projects = useCloudStore(s => s.projects);
  const refreshProjects = useCloudStore(s => s.refreshProjects);
  const communityActive = useCommunityStore(s => s.active);

  // The full library lives on the Projects page; home shows just enough to
  // pick up where you left off (and the count feeds the style nudge below)
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const profile = useAuthStore(s => s.profile);
  const firstName = (user?.email ?? '').split('@')[0].split(/[._-]/)[0];
  const displayName =
    profile?.display_name?.trim() ||
    (firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'neighbor');

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Vertically centered like the welcome hero — the composer is the whole
          point of this screen, so it sits at the middle, not riding the top */}
      <div className="min-h-full flex items-center justify-center px-4 md:px-6 py-8">
        <div className="w-full max-w-3xl space-y-8 md:space-y-10">
          {/* Hero: greeting + the composer itself. Projects and prompts live on
              the Projects page; the Gallery is the place to browse the network. */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
                What are we building, {displayName}?
              </h2>
              {communityActive && (
                <div className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-600/10 border border-green-600/30 rounded-full px-3 py-1">
                  <Sparkles className="size-3" />
                  Community access active
                </div>
              )}
            </div>
            {composer}
            <StartFromOptions />
          </div>

          <ConnectionsWaiting />
          <RecentProjects />
          <StyleNudge projectCount={projects.length} />
        </div>
      </div>
    </div>
  );
}

/**
 * Neighbors waiting to connect — the account menu's warm dot, given a card
 * on home so it's standing where people actually land. Self-hides when the
 * inbox is empty.
 */
function ConnectionsWaiting() {
  const inbox = useConnectionsStore(s => s.inbox);
  const refreshInbox = useConnectionsStore(s => s.refreshInbox);
  const setView = useUIStore(s => s.setView);

  useEffect(() => {
    refreshInbox();
  }, [refreshInbox]);

  if (inbox.length === 0) return null;

  const names = inbox
    .map(r => r.from_name?.trim())
    .filter((n): n is string => !!n)
    .slice(0, 2);

  return (
    <button
      onClick={() => setView('connections')}
      className="w-full text-left border rounded-xl p-4 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-2 text-[15px] font-medium">
        <HeartHandshake className="size-4 text-primary shrink-0" />
        {inbox.length === 1 ? 'A neighbor wants' : `${inbox.length} neighbors want`} to connect
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {names.length > 0
          ? `${names.join(' and ')}${inbox.length > names.length ? ' and others are' : names.length > 1 ? ' are' : ' is'} waiting for you on the Connections page.`
          : 'Connection requests are waiting for you on the Connections page.'}
      </p>
    </button>
  );
}

/**
 * Pick up where you left off — the three freshest cloud projects, with the
 * open one first as the way back in. The full library (device shelf, sites,
 * prompts, collaborators) stays on the Projects page.
 */
function RecentProjects() {
  const user = useAuthStore(s => s.user);
  const projects = useCloudStore(s => s.projects);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const openProject = useCloudStore(s => s.openProject);
  const setView = useUIStore(s => s.setView);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recent = [...projects]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 3);

  if (!user || recent.length === 0) return null;

  async function open(id: string) {
    // The open project's card is a plain door back to the builder
    if (id === currentProjectId) {
      setView('builder');
      return;
    }
    setBusy(id);
    setError(null);
    // Same guarded path as the Projects page: the work being replaced is
    // kept — a workspace not yet on the account gets its own project first
    await promoteWorkspaceToCloud();
    const r = await openProject(id);
    setBusy(null);
    if (r?.error) setError(r.error);
    else setView('builder');
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Pick up where you left off
        </h3>
        <button
          onClick={() => setView('projects')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          All projects →
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {recent.map(p => (
          <button
            key={p.id}
            onClick={() => open(p.id)}
            disabled={busy !== null}
            className="text-left border rounded-xl px-3.5 py-3 hover:bg-accent/50 transition-colors disabled:opacity-60"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {busy === p.id ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate text-sm font-medium">{p.name}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {p.id === currentProjectId
                ? 'Open now — back to it'
                : `Saved ${new Date(Date.parse(p.updated_at)).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}`}
            </p>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * After ~5 built apps, a builder has a style — invite them to capture it as
 * their own mini design system so new builds start from their aesthetic.
 */
function StyleNudge({ projectCount }: { projectCount: number }) {
  const profile = useAuthStore(s => s.profile);
  const [open, setOpen] = useState(false);

  if (projectCount < 5 || profile?.design_system) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left border border-dashed border-primary/40 rounded-xl p-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-[15px] font-medium">
          <Palette className="size-4 text-primary shrink-0" />
          You've built {projectCount} tools — capture your style
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Describe your palette, type, and feel once, and every new build starts
          from your aesthetic — yours and your neighborhood's, not a template.
        </p>
      </button>
      {open && <DesignSystemDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

export function WelcomeScreen({ composer }: HomeDashboardProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              Let's build what you need.
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed max-w-md mx-auto">
              You co-create with your neighbors, AI helps implement your vision.
            </p>
          </div>
          {composer}
          <StartFromOptions />
        </div>
      </div>
    </div>
  );
}
