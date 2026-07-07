import { useState } from 'react';
import { Cloud, CloudOff, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCloudStore } from '@/store/cloud-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useUIStore } from '@/store/ui-store';
import {
  useLocalProjects,
  renameLocalProject,
  saveCurrentLocally,
  deleteLocalProject,
} from '@/project/local-projects';

/**
 * The project's name + saved state in the header. One quiet model: work
 * saves automatically (no spinners — saving isn't an event, it's the
 * baseline), and clicking opens a small dialog to rename or, when signed
 * in, keep the project on the builder's account so it follows them across
 * devices. The only state that ever shouts is a sync failure.
 */
export function ProjectStatus() {
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);

  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  const cloudProjectName = useCloudStore(s => s.currentProjectName);
  const syncStatus = useCloudStore(s => s.syncStatus);
  const renameCloudProject = useCloudStore(s => s.renameProject);
  const createProject = useCloudStore(s => s.createProject);

  const localName = useLocalProjects(s => s.currentName);
  const user = useAuthStore(s => s.user);
  const setProjectsOpen = useUIStore(s => s.setProjectsOpen);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (fileCount === 0 && messageCount === 0) return null;

  const isCloud = cloudProjectId !== null;
  const displayName = isCloud ? cloudProjectName : localName;
  const syncFailed = isCloud && syncStatus === 'error';

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) {
      // The freshest state goes on the shelf before its name is edited
      if (!isCloud) saveCurrentLocally();
      setName(isCloud ? cloudProjectName : useLocalProjects.getState().currentName);
      setError(null);
    }
  }

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === displayName) return;
    if (isCloud) {
      void renameCloudProject(trimmed);
    } else {
      const id = useLocalProjects.getState().currentId;
      if (id) renameLocalProject(id, trimmed);
    }
  }

  async function saveToAccount() {
    setSaving(true);
    setError(null);
    const finalName = name.trim() || displayName || 'My project';
    const result = await createProject(finalName);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // The project lives on the account now — the shelf copy would only shadow it
    const id = useLocalProjects.getState().currentId;
    if (id) deleteLocalProject(id);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="Your work saves automatically — click to rename"
      >
        {syncFailed ? (
          <CloudOff className="size-3 text-destructive" />
        ) : (
          <Check className="size-3 text-green-600" />
        )}
        <span className="max-w-[160px] truncate">{displayName || 'Saved'}</span>
        {syncFailed && <span className="text-destructive">sync failed</span>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your work saves automatically. Starting a new project keeps this
            one — find it any time in{' '}
            <button
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => { setOpen(false); setProjectsOpen(true); }}
            >
              Projects
            </button>.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') { commitRename(); setOpen(false); } }}
              className="h-8 text-sm"
            />
          </div>
          {cloudEnabled && !isCloud && (
            user ? (
              <div className="space-y-2">
                <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={saveToAccount} disabled={saving}>
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Cloud className="size-3" />}
                  Save
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Keeps this project on your account — it follows you across
                  devices and can be shared with collaborators.
                </p>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sign in (top right) to keep projects across devices and share
                them with collaborators.
              </p>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
