import { useEffect, useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useUIStore } from '@/store/ui-store';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Cloud, FolderOpen, Trash2, UserPlus, X, Loader2, Users } from 'lucide-react';
import { suggestProjectName } from '@/project/suggest-name';
import { YourPrompts } from '@/components/YourPrompts';
import { YourSites } from '@/components/YourSites';
import { listMyPrompts, type BuildPrompt } from '@/cloud/prompts';

/**
 * The nav affordance that opens the Projects page. Kept next to the page so
 * the cloud-enabled gate lives in one place.
 */
export function ProjectsButton({ mobile }: { mobile?: boolean }) {
  const projectsOpen = useUIStore(s => s.projectsOpen);
  const setProjectsOpen = useUIStore(s => s.setProjectsOpen);
  if (!cloudEnabled) return null;
  return (
    <button
      onClick={() => setProjectsOpen(!projectsOpen)}
      className={
        buttonVariants({ variant: projectsOpen && !mobile ? 'secondary' : mobile ? 'outline' : 'ghost', size: 'sm' }) +
        (mobile ? ' h-8 gap-1 text-xs' : ' h-7 gap-1 text-xs')
      }
    >
      <Cloud className="size-3.5" />
      Projects
    </button>
  );
}

/**
 * The Projects page — a full-width space (not a cramped dialog): the current
 * workspace and its collaborators, every saved cloud project, the builder's
 * live community-hosted sites, and their prompt library. Reachable any time
 * from the nav, whether or not a project is currently open.
 */
export function ProjectsPage() {
  const user = useAuthStore(s => s.user);
  const setProjectsOpen = useUIStore(s => s.setProjectsOpen);

  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const currentProjectName = useCloudStore(s => s.currentProjectName);
  const isOwner = useCloudStore(s => s.isOwner);
  const projects = useCloudStore(s => s.projects);
  const members = useCloudStore(s => s.members);
  const refreshProjects = useCloudStore(s => s.refreshProjects);
  const createProject = useCloudStore(s => s.createProject);
  const openProject = useCloudStore(s => s.openProject);
  const closeProject = useCloudStore(s => s.closeProject);
  const deleteProject = useCloudStore(s => s.deleteProject);
  const inviteMember = useCloudStore(s => s.inviteMember);
  const removeMember = useCloudStore(s => s.removeMember);

  // Seed once at mount (the page mounts when it opens) with a name drawn from
  // the conversation instead of a blank field.
  const [newName, setNewName] = useState(() => suggestProjectName() ?? '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<BuildPrompt[]>([]);

  const refreshPrompts = () => listMyPrompts().then(setPrompts).catch(() => {});

  useEffect(() => {
    if (user) {
      refreshProjects();
      refreshPrompts();
    }
  }, [user, refreshProjects]);

  async function run(label: string, fn: () => Promise<{ error: string | null } | void>) {
    setBusy(label);
    setError(null);
    const result = await fn();
    if (result && result.error) setError(result.error);
    setBusy(null);
  }

  const close = () => setProjectsOpen(false);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-10">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Cloud className="size-6 text-primary shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Projects</h1>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={close}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>

        {!user ? (
          <p className="text-sm text-muted-foreground">
            Sign in (top right) to save projects to the cloud and invite collaborators.
          </p>
        ) : (
          <>
            {/* Current project + sharing */}
            {currentProjectId && (
              <section className="rounded-xl border p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium">{currentProjectName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {isOwner ? 'Owner' : 'Editor'}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={closeProject}>
                    Detach
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Users className="size-4" />
                    Collaborators
                  </div>
                  {members.length === 0 && (
                    <p className="text-xs text-muted-foreground max-w-prose">
                      Just you so far. Invite someone by email — when they sign in
                      with that address, this project appears in their list and
                      edits sync live.
                    </p>
                  )}
                  {members.map(m => (
                    <div key={m.email} className="flex items-center justify-between text-sm">
                      <span>
                        {m.email}
                        {!m.user_id && (
                          <span className="text-muted-foreground ml-1.5 text-xs">(invited — hasn't signed in yet)</span>
                        )}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => run(`remove-${m.email}`, () => removeMember(m.email))}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isOwner && (
                    <div className="flex gap-2 max-w-md">
                      <Input
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && inviteEmail.trim()) {
                            run('invite', async () => {
                              const r = await inviteMember(inviteEmail);
                              if (!r.error) setInviteEmail('');
                              return r;
                            });
                          }
                        }}
                        placeholder="neighbor@example.org"
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs shrink-0"
                        disabled={!inviteEmail.trim() || busy === 'invite'}
                        onClick={() =>
                          run('invite', async () => {
                            const r = await inviteMember(inviteEmail);
                            if (!r.error) setInviteEmail('');
                            return r;
                          })
                        }
                      >
                        {busy === 'invite' ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
                        Invite
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Save current workspace as a new cloud project */}
            {!currentProjectId && (
              <section className="space-y-2">
                <p className="text-sm font-medium">Save current workspace to the cloud</p>
                <div className="flex gap-2 max-w-md">
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Project name..."
                    className="h-9 text-sm"
                  />
                  <Button
                    disabled={!newName.trim() || busy === 'create'}
                    onClick={() =>
                      run('create', async () => {
                        const r = await createProject(newName.trim());
                        if (!r.error) setNewName('');
                        return r;
                      })
                    }
                  >
                    {busy === 'create' ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </section>
            )}

            {/* Project list */}
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Your projects
              </h2>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cloud projects yet.</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {projects.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 border rounded-lg px-3.5 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm">
                          {p.name}
                          {p.owner_id !== user.id && (
                            <Badge variant="outline" className="ml-2 text-xs">shared with you</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated {new Date(p.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={p.id === currentProjectId || busy === `open-${p.id}`}
                          onClick={() =>
                            run(`open-${p.id}`, async () => {
                              const r = await openProject(p.id);
                              if (!r || !r.error) close();
                              return r;
                            })
                          }
                        >
                          {busy === `open-${p.id}` ? <Loader2 className="size-3 animate-spin" /> : <FolderOpen className="size-3" />}
                          {p.id === currentProjectId ? 'Open now' : 'Open'}
                        </Button>
                        {p.owner_id === user.id && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${p.name}" from the cloud? This can't be undone.`)) {
                                run(`delete-${p.id}`, () => deleteProject(p.id));
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive p-1"
                            title="Delete cloud project"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
                Opening a cloud project replaces your current workspace. Edits
                auto-save and sync to collaborators within a couple of seconds
                (last save wins per project).
              </p>
            </section>

            {/* Live community-hosted sites — moved here from the home screen.
                YourSites carries its own heading and self-hides when empty. */}
            <YourSites />

            {/* Prompt library */}
            {prompts.length > 0 && (
              <section className="space-y-3">
                <YourPrompts
                  prompts={prompts}
                  onChanged={refreshPrompts}
                  onBuildFrom={close}
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
