import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useCommunityStore } from '@/store/community-store';
import { NetworkUpdates } from '@/components/StudioUpdates';
import { StartFromOptions } from '@/components/StartFromMenu';
import { DesignSystemDialog } from '@/components/DesignSystemDialog';
import { BuildersDirectory } from '@/components/BuildersDirectory';
import { Palette, Sparkles } from 'lucide-react';

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

  // Projects themselves live on the Projects page now; the count still
  // feeds the style nudge below
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
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-7 md:py-14 space-y-8 md:space-y-10">
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

        <NetworkUpdates />

        <StyleNudge projectCount={projects.length} />

        <BuildersDirectory />
      </div>
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
