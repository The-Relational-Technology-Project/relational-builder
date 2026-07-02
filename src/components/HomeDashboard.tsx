import { useEffect, useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useCommunityStore } from '@/store/community-store';
import { YourSites } from '@/components/YourSites';
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
}

/**
 * Empty-state home. Signed-in builders get a dashboard: greeting, their
 * cloud projects, and starter ideas. Signed-out (or local-only) builders
 * get the original welcome.
 */
export function HomeDashboard({ onSelectIdea, disabled }: HomeDashboardProps) {
  const user = useAuthStore(s => s.user);

  if (!cloudEnabled || !user) {
    return <WelcomeScreen onSelectIdea={onSelectIdea} disabled={disabled} />;
  }
  return <SignedInDashboard onSelectIdea={onSelectIdea} disabled={disabled} />;
}

function SignedInDashboard({ onSelectIdea, disabled }: HomeDashboardProps) {
  const user = useAuthStore(s => s.user);
  const projects = useCloudStore(s => s.projects);
  const refreshProjects = useCloudStore(s => s.refreshProjects);
  const openProject = useCloudStore(s => s.openProject);
  const communityActive = useCommunityStore(s => s.active);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const firstName = (user?.email ?? '').split('@')[0].split(/[._-]/)[0];
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'neighbor';

  async function handleOpen(id: string) {
    setOpeningId(id);
    await openProject(id);
    setOpeningId(null);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Ready to build, {displayName}?
          </h2>
          <p className="text-muted-foreground text-sm">
            Describe what your neighborhood needs, or pick up where you left off.
          </p>
          {communityActive && (
            <div className="inline-flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400 bg-green-600/10 border border-green-600/30 rounded-full px-2.5 py-1">
              <Sparkles className="size-3" />
              Community access active — free building on Claude Sonnet 5
            </div>
          )}
        </div>

        {projects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your projects
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {projects.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleOpen(p.id)}
                  disabled={disabled || openingId !== null}
                  className="text-left border rounded-lg p-3 hover:bg-muted transition-colors disabled:opacity-50 group"
                >
                  <div className="flex items-center gap-1.5">
                    {openingId === p.id ? (
                      <Loader2 className="size-3.5 animate-spin shrink-0" />
                    ) : (
                      <FolderOpen className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    {p.owner_id !== user?.id && (
                      <Badge variant="outline" className="text-[9px] shrink-0 ml-auto">shared</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Updated {formatRelative(p.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <YourSites />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Start something new
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STARTER_IDEAS.map(idea => (
              <button
                key={idea.label}
                className="text-left text-xs border rounded-lg p-3 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onSelectIdea(idea.prompt)}
                disabled={disabled}
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WelcomeScreen({ onSelectIdea, disabled }: HomeDashboardProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Build relational technology
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Describe what you want to build and AI will generate working code,
          informed by principles and patterns from the Relational Tech community.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {STARTER_IDEAS.map(idea => (
            <button
              key={idea.label}
              className="text-left text-xs border rounded-lg p-3 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onSelectIdea(idea.prompt)}
              disabled={disabled}
            >
              {idea.label}
            </button>
          ))}
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
