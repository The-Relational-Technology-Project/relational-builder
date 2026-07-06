import { useEffect, useState } from 'react';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Cloud, FolderOpen, Trash2, UserPlus, X, Loader2, Users } from 'lucide-react';
import { suggestProjectName } from '@/project/suggest-name';
import { YourPrompts } from '@/components/YourPrompts';
import { listMyPrompts, type BuildPrompt } from '@/cloud/prompts';

/**
 * The Projects page: save the current workspace, open saved projects,
 * invite collaborators by email — and the builder's prompt library,
 * the seeds distilled from what they've built.
 */
export function ProjectsDialog() {
  const user = useAuthStore(s => s.user);

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

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<BuildPrompt[]>([]);

  const refreshPrompts = () => listMyPrompts().then(setPrompts).catch(() => {});

  useEffect(() => {
    if (open && user) {
      refreshProjects();
      refreshPrompts();
    }
    // Offer a name drawn from the conversation instead of a blank field
    if (open) {
      setNewName(prev => prev || (suggestProjectName() ?? ''));
    }
  }, [open, user, refreshProjects]);

  if (!cloudEnabled) return null;

  async function run(label: string, fn: () => Promise<{ error: string | null } | void>) {
    setBusy(label);
    setError(null);
    const result = await fn();
    if (result && result.error) setError(result.error);
    setBusy(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 text-xs'}>
        <Cloud className="size-3.5" />
        Projects
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your projects</DialogTitle>
        </DialogHeader>

        {!user ? (
          <p className="text-sm text-muted-foreground">
            Sign in (top right) to save projects to the cloud and invite collaborators.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Current project + sharing */}
            {currentProjectId && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{currentProjectName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {isOwner ? 'Owner' : 'Editor'}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={closeProject}>
                    Detach
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Users className="size-3.5" />
                    Collaborators
                  </div>
                  {members.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Just you so far. Invite someone by email — when they sign in
                      with that address, this project appears in their list and
                      edits sync live.
                    </p>
                  )}
                  {members.map(m => (
                    <div key={m.email} className="flex items-center justify-between text-xs">
                      <span>
                        {m.email}
                        {!m.user_id && (
                          <span className="text-muted-foreground ml-1.5">(invited — hasn't signed in yet)</span>
                        )}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => run(`remove-${m.email}`, () => removeMember(m.email))}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {isOwner && (
                    <div className="flex gap-2">
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
                        className="h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
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
              </div>
            )}

            {/* Save current workspace as a new cloud project */}
            {!currentProjectId && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Save current workspace to the cloud</p>
                <div className="flex gap-2">
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Project name..."
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={!newName.trim() || busy === 'create'}
                    onClick={() =>
                      run('create', async () => {
                        const r = await createProject(newName.trim());
                        if (!r.error) setNewName('');
                        return r;
                      })
                    }
                  >
                    {busy === 'create' ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Project list */}
            <div className="space-y-2">
              <p className="text-xs font-medium">Your projects</p>
              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground">No cloud projects yet.</p>
              )}
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-xs">
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
                      onClick={() => run(`open-${p.id}`, () => openProject(p.id))}
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
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <p className="text-xs text-muted-foreground leading-relaxed">
              Opening a cloud project replaces your current workspace. Edits
              auto-save and sync to collaborators within a couple of seconds
              (last save wins per project).
            </p>

            {prompts.length > 0 && (
              <>
                <Separator />
                <YourPrompts
                  prompts={prompts}
                  onChanged={refreshPrompts}
                  onBuildFrom={() => setOpen(false)}
                />
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
