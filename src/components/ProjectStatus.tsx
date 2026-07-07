import { useState } from 'react';
import { Cloud, CloudOff, Loader2, Check, HardDrive } from 'lucide-react';
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
 * The header's save state — always visible once there's work, so a builder
 * never has to wonder whether their project is safe:
 *
 * - Cloud project open → the sync indicator (unchanged).
 * - Otherwise → "Saved on this device · name", opening a small dialog to
 *   rename or move it to the cloud.
 */
export function ProjectStatus() {
  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  if (cloudProjectId) return <CloudIndicator />;
  return <LocalIndicator />;
}

function CloudIndicator() {
  const currentProjectName = useCloudStore(s => s.currentProjectName);
  const syncStatus = useCloudStore(s => s.syncStatus);
  const syncError = useCloudStore(s => s.syncError);

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title={syncError ?? undefined}
    >
      {syncStatus === 'saving' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : syncStatus === 'error' ? (
        <CloudOff className="size-3 text-destructive" />
      ) : (
        <Cloud className="size-3 text-green-600" />
      )}
      <span className="max-w-[140px] truncate">{currentProjectName}</span>
      {syncStatus === 'error' && <span className="text-destructive">sync failed</span>}
    </div>
  );
}

function LocalIndicator() {
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);
  const currentId = useLocalProjects(s => s.currentId);
  const currentName = useLocalProjects(s => s.currentName);
  const savedAt = useLocalProjects(s => s.savedAt);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const user = useAuthStore(s => s.user);
  const createProject = useCloudStore(s => s.createProject);
  const setProjectsOpen = useUIStore(s => s.setProjectsOpen);

  if (fileCount === 0 && messageCount === 0) return null;

  const saved = savedAt !== null && currentId !== null;
  const label = saved ? currentName || 'Saved on this device' : 'Saving…';

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) {
      // Make sure the very latest state is on the shelf, then edit its name
      saveCurrentLocally();
      setName(useLocalProjects.getState().currentName);
      setCloudError(null);
    }
  }

  function commitRename() {
    const id = useLocalProjects.getState().currentId;
    if (id && name.trim()) renameLocalProject(id, name);
  }

  async function moveToCloud() {
    commitRename();
    setCloudBusy(true);
    setCloudError(null);
    const finalName = name.trim() || currentName || 'My project';
    const result = await createProject(finalName);
    setCloudBusy(false);
    if (result.error) {
      setCloudError(result.error);
      return;
    }
    // Graduated to the cloud — the local copy would only shadow it
    const id = useLocalProjects.getState().currentId;
    if (id) deleteLocalProject(id);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="Your work saves on this device automatically — click to rename or move it to the cloud"
      >
        {saved ? <Check className="size-3 text-green-600" /> : <Loader2 className="size-3 animate-spin" />}
        <HardDrive className="size-3" />
        <span className="max-w-[140px] truncate">{label}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>This project is saved</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your work saves on this device automatically as you build. Starting
            a new project keeps it — find it any time under{' '}
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
          {cloudEnabled && (
            user ? (
              <div className="space-y-2">
                <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={moveToCloud} disabled={cloudBusy}>
                  {cloudBusy ? <Loader2 className="size-3 animate-spin" /> : <Cloud className="size-3" />}
                  Save to the cloud
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Cloud projects follow you across devices and can be shared with collaborators.
                </p>
                {cloudError && <p className="text-xs text-destructive">{cloudError}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sign in (top right) to also save it to the cloud — across devices, with collaborators.
              </p>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
