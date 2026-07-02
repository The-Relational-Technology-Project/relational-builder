import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useCommunityStore } from '@/store/community-store';
import { YourSites } from '@/components/YourSites';
import { StarterGallery } from '@/components/StarterGallery';
import { DesignSystemDialog } from '@/components/DesignSystemDialog';
import { BuildersDirectory } from '@/components/BuildersDirectory';
import { Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Loader2, Sparkles } from 'lucide-react';

const STARTER_IDEAS = [
  { label: 'Neighborhood event calendar', prompt: 'Build me a neighborhood event calendar where community members can post and discover local events, with categories for block parties, meetings, cleanups, and gatherings.' },
  { label: 'Mutual aid request board', prompt: 'Build a mutual aid request board where neighbors can post needs and offers — things like rides, meals, childcare, tool lending — with a simple claim system.' },
  { label: 'Community resource directory', prompt: 'Build a community resource directory that maps local organizations, services, and mutual aid networks with search and category filters.' },
  { label: 'Local civic info hub', prompt: 'Build a local civic information hub where residents can find meeting schedules, elected officials, zoning updates, and community announcements.' },
];

interface HomeDashboardProps {
  onSelectIdea: (prompt: string) => void;
  disabled: boolean;
  /** The hero composer, rendered by ChatPanel so send logic stays in one place */
  composer?: ReactNode;
}

/**
 * Full-width home. Signed-in builders get a dashboard: greeting, the big
 * composer, their cloud projects and sites. Signed-out (or local-only)
 * builders get the welcome hero with the same composer.
 */
export function HomeDashboard({ onSelectIdea, disabled, composer }: HomeDashboardProps) {
  const user = useAuthStore(s => s.user);

  if (!cloudEnabled || !user) {
    return <WelcomeScreen onSelectIdea={onSelectIdea} disabled={disabled} composer={composer} />;
  }
  return <SignedInDashboard onSelectIdea={onSelectIdea} disabled={disabled} composer={composer} />;
}

/** Small tappable prompts under the composer — a nudge, not a catalog */
function IdeaChips({ onSelectIdea, disabled }: { onSelectIdea: (p: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {STARTER_IDEAS.map(idea => (
        <button
          key={idea.label}
          className="text-sm border rounded-full px-3.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onSelectIdea(idea.prompt)}
          disabled={disabled}
        >
          {idea.label}
        </button>
      ))}
    </div>
  );
}

function SignedInDashboard({ onSelectIdea, disabled, composer }: HomeDashboardProps) {
  const user = useAuthStore(s => s.user);
  const projects = useCloudStore(s => s.projects);
  const refreshProjects = useCloudStore(s => s.refreshProjects);
  const openProject = useCloudStore(s => s.openProject);
  const communityActive = useCommunityStore(s => s.active);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const profile = useAuthStore(s => s.profile);
  const firstName = (user?.email ?? '').split('@')[0].split(/[._-]/)[0];
  const displayName =
    profile?.display_name?.trim() ||
    (firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'neighbor');

  async function handleOpen(id: string) {
    setOpeningId(id);
    await openProject(id);
    setOpeningId(null);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-10">
        {/* Hero: greeting + the composer itself */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              What are we building, {displayName}?
            </h2>
            {communityActive && (
              <div className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-600/10 border border-green-600/30 rounded-full px-3 py-1">
                <Sparkles className="size-3" />
                Community access active — building is on us
              </div>
            )}
          </div>
          {composer}
          <IdeaChips onSelectIdea={onSelectIdea} disabled={disabled} />
        </div>

        {projects.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your projects
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleOpen(p.id)}
                  disabled={disabled || openingId !== null}
                  className="text-left border rounded-xl p-4 hover:bg-muted hover:border-foreground/20 transition-colors disabled:opacity-50 group"
                >
                  <div className="flex items-center gap-2">
                    {openingId === p.id ? (
                      <Loader2 className="size-4 animate-spin shrink-0" />
                    ) : (
                      <FolderOpen className="size-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                    )}
                    <span className="text-[15px] font-medium truncate">{p.name}</span>
                    {p.owner_id !== user?.id && (
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-auto">shared</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Updated {formatRelative(p.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <YourSites />

        <StyleNudge projectCount={projects.length} />

        <StarterGallery disabled={disabled} />

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

export function WelcomeScreen({ onSelectIdea, disabled, composer }: HomeDashboardProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight">
              Build relational technology
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed max-w-md mx-auto">
              Describe what your neighborhood needs, and build it together with
              AI — informed by patterns from the Relational Tech community.
            </p>
          </div>
          {composer}
          <IdeaChips onSelectIdea={onSelectIdea} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
