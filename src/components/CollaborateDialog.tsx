import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useProjectStore } from '@/store/project-store';
import {
  useLocalProjects,
  saveCurrentLocally,
  deleteLocalProject,
} from '@/project/local-projects';
import { Users, UserPlus, X, Loader2, Cloud } from 'lucide-react';

/**
 * Invite collaborators to the current project, right from the Share menu.
 * The same membership model as the Projects page — invite by email, and when
 * that person signs in the project appears in their list with live-syncing
 * edits. Guides through the prerequisites (sign in, save to cloud) instead
 * of hiding when they aren't met — and a project saved on this device is
 * recognized as such: one click keeps it on the account (collaboration
 * syncs through the cloud) and the invite form appears.
 */
export function CollaborateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const user = useAuthStore(s => s.user);
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const currentProjectName = useCloudStore(s => s.currentProjectName);
  const isOwner = useCloudStore(s => s.isOwner);
  const members = useCloudStore(s => s.members);
  const inviteMember = useCloudStore(s => s.inviteMember);
  const removeMember = useCloudStore(s => s.removeMember);
  const createProject = useCloudStore(s => s.createProject);

  const localName = useLocalProjects(s => s.currentName);
  const fileCount = useProjectStore(s => s.getFileCount());

  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<{ error: string | null } | void>) {
    setBusy(label);
    setError(null);
    const result = await fn();
    if (result && result.error) setError(result.error);
    setBusy(null);
  }

  const invite = () =>
    run('invite', async () => {
      const r = await inviteMember(inviteEmail);
      if (!r.error) setInviteEmail('');
      return r;
    });

  // Promote the device-saved project to the account, then the invite form
  // takes over (currentProjectId flips). Mirrors the project pill's Save:
  // the shelf copy is retired so it can't shadow the cloud project.
  const saveToAccount = () =>
    run('save', async () => {
      saveCurrentLocally();
      const name = useLocalProjects.getState().currentName || 'My project';
      const r = await createProject(name);
      if (!r.error) {
        const localId = useLocalProjects.getState().currentId;
        if (localId) deleteLocalProject(localId);
      }
      return r;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Collaborate
          </DialogTitle>
        </DialogHeader>

        {!user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in to invite collaborators — a shared project appears in
              their list and edits sync live between you.
            </p>
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                useAuthStore.getState().promptSignIn();
              }}
            >
              Sign in
            </Button>
          </div>
        ) : !currentProjectId ? (
          fileCount > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>{localName || 'This project'}</strong> is saved on this
                device. Collaboration syncs edits live through your account —
                keep the project there and the invite form opens right up.
              </p>
              <Button size="sm" className="gap-1.5" onClick={saveToAccount} disabled={busy === 'save'}>
                {busy === 'save' ? <Loader2 className="size-3 animate-spin" /> : <Cloud className="size-3" />}
                Save to my account &amp; invite
              </Button>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Start building first — once there's a project here, you can
              invite neighbors to build it with you.
            </p>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Invite someone to <strong>{currentProjectName}</strong> by email.
              When they sign in with that address, the project appears in their
              list and edits sync live.
            </p>
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
            {isOwner ? (
              <div className="flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && inviteEmail.trim()) invite();
                  }}
                  placeholder="neighbor@example.org"
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs shrink-0"
                  disabled={!inviteEmail.trim() || busy === 'invite'}
                  onClick={invite}
                >
                  {busy === 'invite' ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
                  Invite
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                The project's owner manages who's invited.
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
