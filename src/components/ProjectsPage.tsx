import { useEffect, useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useUIStore } from '@/store/ui-store';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Trash2, UserPlus, X, Loader2, Users } from 'lucide-react';
import {
  useLocalProjects,
  openLocalProject,
  deleteLocalProject,
  promoteWorkspaceToCloud,
} from '@/project/local-projects';
import { migrateShelfToCloud } from '@/cloud/sync';
import { YourPrompts } from '@/components/YourPrompts';
import { YourSites } from '@/components/YourSites';
import { listMyPrompts, type BuildPrompt } from '@/cloud/prompts';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';

/**
 * The nav affordance that opens the Projects page. Kept next to the page so
 * the cloud-enabled gate lives in one place.
 */
export function ProjectsButton({ mobile }: { mobile?: boolean }) {
  const active = useUIStore(s => s.view === 'projects');
  const setView = useUIStore(s => s.setView);
  // Not cloud-gated: the local shelf means everyone has projects to come
  // back to, signed in or not
  return (
    <button
      onClick={() => setView('projects')}
      className={
        buttonVariants({ variant: active && !mobile ? 'secondary' : mobile ? 'outline' : 'ghost', size: 'sm' }) +
        (mobile ? ' h-8 gap-1 text-xs' : ' h-7 gap-1 text-xs')
      }
    >
      <FolderOpen className="size-3.5" />
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
  const setView = useUIStore(s => s.setView);

  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const currentProjectName = useCloudStore(s => s.currentProjectName);
  const isOwner = useCloudStore(s => s.isOwner);
  const members = useCloudStore(s => s.members);
  const refreshProjects = useCloudStore(s => s.refreshProjects);
  const inviteMember = useCloudStore(s => s.inviteMember);
  const removeMember = useCloudStore(s => s.removeMember);

  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<BuildPrompt[]>([]);

  const refreshPrompts = () => listMyPrompts().then(setPrompts).catch(() => {});

  useEffect(() => {
    if (user) {
      refreshProjects();
      refreshPrompts();
      // Any device-shelf strays move onto the account — one library, no
      // "on this device" second class
      void migrateShelfToCloud();
    }
  }, [user, refreshProjects]);

  async function run(label: string, fn: () => Promise<{ error: string | null } | void>) {
    setBusy(label);
    setError(null);
    const result = await fn();
    if (result && result.error) setError(result.error);
    setBusy(null);
  }

  // Opening or building from a project lands you in the builder with it
  const backToBuilder = () => setView('builder');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-10">
        {/* Page header */}
        <div className="flex items-center gap-2.5">
          <FolderOpen className="size-6 text-primary shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Projects</h1>
        </div>

        {/* The shelf stays private until sign-in: projects (device-saved and
            cloud alike) are someone's work, not a public list on a shared
            computer. Nothing is deleted — signing back in shows them again. */}
        {(user || !cloudEnabled) && <MergedProjects onOpened={backToBuilder} />}

        {!user ? (
          <p className="text-sm text-muted-foreground">
            {cloudEnabled
              ? 'Sign in (top right) to see your projects — everything you built here is saved and waiting.'
              : 'Projects save on this device automatically as you build.'}
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

            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Live community-hosted sites — moved here from the home screen.
                YourSites carries its own heading and self-hides when empty. */}
            <YourSites />

            {/* Prompt library */}
            {prompts.length > 0 && (
              <section className="space-y-3">
                <YourPrompts
                  prompts={prompts}
                  onChanged={refreshPrompts}
                  onBuildFrom={backToBuilder}
                />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The builder's projects, newest first, no filing system to think about.
 * Signed in, this is the account's cloud library — one list, one home, no
 * "on this device" second class. Signed out (or with cloud off), it's the
 * device shelf. Opening any project keeps the one being replaced.
 */
function MergedProjects({ onOpened }: { onOpened: () => void }) {
  const user = useAuthStore(s => s.user);
  const shelf = useLocalProjects(s => s.shelf);
  const localCurrentId = useLocalProjects(s => s.currentId);
  const cloudProjects = useCloudStore(s => s.projects);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const openProject = useCloudStore(s => s.openProject);
  const deleteProject = useCloudStore(s => s.deleteProject);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entries = (user
    ? cloudProjects.map(p => ({
        key: `cloud-${p.id}`,
        id: p.id,
        kind: 'cloud' as const,
        name: p.name,
        updatedAt: Date.parse(p.updated_at),
        current: p.id === currentProjectId,
        canDelete: p.owner_id === user.id,
        shared: p.owner_id !== user.id,
      }))
    : shelf.map(m => ({
        key: `local-${m.id}`,
        id: m.id,
        kind: 'local' as const,
        name: m.name,
        updatedAt: m.updatedAt,
        current: m.id === localCurrentId,
        canDelete: true,
        shared: false,
      }))
  ).sort((a, b) => b.updatedAt - a.updatedAt);

  if (entries.length === 0) return null;

  async function open(entry: (typeof entries)[number]) {
    if (entry.kind === 'local') {
      if (openLocalProject(entry.id)) onOpened();
      return;
    }
    setBusy(entry.key);
    setError(null);
    // The work being replaced is kept automatically — opening is never
    // destructive. A workspace not yet on the account gets its own cloud
    // project first (same guarded path the autosaver uses).
    await promoteWorkspaceToCloud();
    const r = await openProject(entry.id);
    setBusy(null);
    if (r?.error) setError(r.error);
    else onOpened();
  }

  async function remove(entry: (typeof entries)[number]) {
    if (!window.confirm(`Delete "${entry.name}"? This can't be undone.`)) return;
    if (entry.kind === 'local') {
      deleteLocalProject(entry.id);
    } else {
      setBusy(entry.key);
      await deleteProject(entry.id);
      setBusy(null);
    }
    // Deleting the project that's open must also clear the workspace —
    // otherwise the autosaver immediately re-shelves the leftover files as a
    // "new" project with a guessed name, and the deleted thing keeps coming back
    if (entry.current) {
      useChatStore.getState().clearMessages();
      useProjectStore.getState().clearProject();
      useEnvStore.getState().clearAll();
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Your projects
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {entries.map(entry => (
          <div key={entry.key} className="flex items-center justify-between gap-2 border rounded-lg px-3.5 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium text-sm">
                {entry.name}
                {entry.current && (
                  <Badge variant="secondary" className="ml-2 text-xs">Open now</Badge>
                )}
                {entry.shared && (
                  <Badge variant="outline" className="ml-2 text-xs">shared with you</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Saved{' '}
                {new Date(entry.updatedAt).toLocaleString(undefined, {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={entry.current || busy === entry.key}
                onClick={() => open(entry)}
              >
                {busy === entry.key ? <Loader2 className="size-3 animate-spin" /> : <FolderOpen className="size-3" />}
                {entry.current ? 'Open now' : 'Open'}
              </Button>
              {entry.canDelete && (
                <button
                  onClick={() => remove(entry)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Delete project"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
