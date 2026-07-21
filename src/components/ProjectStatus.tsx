import { useRef, useState } from 'react';
import { ArrowLeft, Check, Cloud, CloudOff, Loader2, Pencil } from 'lucide-react';
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
  promoteWorkspaceToCloud,
} from '@/project/local-projects';

/**
 * The project's name in the header — styled as a button, because it is one:
 * from any other page it's the way back to the work in progress, and on the
 * builder it opens rename. Saving is the quiet baseline, so there's no
 * always-on saved indicator; a checkmark appears only briefly after naming,
 * and the only state that ever shouts is a sync failure.
 */
export function ProjectStatus() {
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);

  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  const cloudProjectName = useCloudStore(s => s.currentProjectName);
  const syncStatus = useCloudStore(s => s.syncStatus);
  const renameCloudProject = useCloudStore(s => s.renameProject);

  const localName = useLocalProjects(s => s.currentName);
  const user = useAuthStore(s => s.user);
  const view = useUIStore(s => s.view);
  const setView = useUIStore(s => s.setView);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (fileCount === 0 && messageCount === 0) return null;

  const isCloud = cloudProjectId !== null;
  const displayName = isCloud ? cloudProjectName : localName;
  const syncFailed = isCloud && syncStatus === 'error';

  function flashSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setJustSaved(true);
    savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
  }

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
    flashSaved();
  }

  async function saveToAccount() {
    setSaving(true);
    setError(null);
    const finalName = name.trim() || displayName || 'My project';
    // The one guarded promotion path — retires the shelf copy itself and
    // can't race the autosaver into creating the project twice
    const result = await promoteWorkspaceToCloud(finalName);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    flashSaved();
  }

  const pillClass =
    'group flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-xs transition-colors hover:bg-accent hover:text-foreground';
  const pill = (
    <>
      {syncFailed ? (
        <CloudOff className="size-3 text-destructive" />
      ) : justSaved ? (
        <Check className="size-3 text-green-600" />
      ) : view !== 'builder' ? (
        <ArrowLeft className="size-3 text-muted-foreground group-hover:text-foreground" />
      ) : null}
      <span className="max-w-[160px] truncate">{displayName || 'Untitled project'}</span>
      {justSaved && !syncFailed && <span className="text-green-700">saved</span>}
      {syncFailed && <span className="text-destructive">sync failed</span>}
      {view === 'builder' && !justSaved && !syncFailed && (
        <Pencil className="size-2.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
      )}
    </>
  );

  // From any page, the project name is the way back to the work in
  // progress; only on the builder itself does clicking it open rename.
  if (view !== 'builder') {
    return (
      <button className={pillClass} title="Back to this project" onClick={() => setView('builder')}>
        {pill}
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        className={pillClass}
        title="Your work saves automatically — click to rename"
      >
        {pill}
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
              onClick={() => { setOpen(false); setView('projects'); }}
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
