import { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Info,
  Loader2,
  Pencil,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCloudStore } from '@/store/cloud-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useDeployStore } from '@/store/deploy-store';
import { useUIStore } from '@/store/ui-store';
import { resolveStage } from '@/project/stage';
import {
  useLocalProjects,
  renameLocalProject,
  saveCurrentLocally,
  promoteWorkspaceToCloud,
} from '@/project/local-projects';

/**
 * The project's name in the header, and everything that is true about this
 * project behind it.
 *
 * In the builder the header carries exactly two things about the work: this
 * menu and Share. Where the project lives, who can see it, renaming it,
 * keeping it on your account — all of that is *about this project*, so it
 * belongs under its name rather than scattered across the toolbar as peers
 * of the actions.
 *
 * The stage answer ("Saved · Only you") used to stand permanently in the
 * header, on the reasoning that situational doubt shows up at unpredictable
 * moments and the answer should be standing in the room. It still is — one
 * click into the menu that carries the project's name, which is where anyone
 * looks when they wonder about the project. The two states worth interrupting
 * for (saving failed, unsaved) still reach the pill itself, because those are
 * the ones you must not have to go looking for.
 */
export function ProjectMenu() {
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeCheckpointId = useProjectStore(s => s.activeCheckpointId);

  const cloudProjectId = useCloudStore(s => s.currentProjectId);
  const cloudProjectName = useCloudStore(s => s.currentProjectName);
  const syncStatus = useCloudStore(s => s.syncStatus);
  const renameCloudProject = useCloudStore(s => s.renameProject);
  const members = useCloudStore(s => s.members);
  const publishNames = useDeployStore(s => s.publishNames);

  const localName = useLocalProjects(s => s.currentName);
  const user = useAuthStore(s => s.user);
  const setView = useUIStore(s => s.setView);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasProject = fileCount > 0 || messageCount > 0;
  const isCloud = cloudProjectId !== null;
  const displayName = isCloud ? cloudProjectName : localName;
  const syncFailed = isCloud && syncStatus === 'error';

  // Same stale-id guard as the project store: a checkpoint id that no longer
  // exists shouldn't silently remove the reassurance that undo is there
  const foundIdx = activeCheckpointId
    ? checkpoints.findIndex(c => c.id === activeCheckpointId)
    : -1;
  const currentIdx = foundIdx >= 0 ? foundIdx : checkpoints.length - 1;

  const stage = resolveStage({
    fileCount,
    signedIn: !!user,
    inCloud: isCloud,
    collaborators: Math.max(0, members.length - 1),
    publishedName: publishNames[cloudProjectId ?? 'local'] ?? null,
    canUndo: currentIdx > 0,
  });

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

  const canSaveToAccount = cloudEnabled && !isCloud && !!user && hasProject;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="group flex items-center gap-1.5 min-w-0 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-xs transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="This project — its name, where it lives, and who can see it"
        >
          {syncFailed ? (
            <CloudOff className="size-3 shrink-0 text-destructive" />
          ) : justSaved ? (
            <Check className="size-3 shrink-0 text-green-600" />
          ) : null}
          <span className="max-w-[180px] truncate">
            {displayName || (hasProject ? 'Untitled project' : 'New project')}
          </span>
          {justSaved && !syncFailed && <span className="text-green-700">saved</span>}
          {syncFailed && <span className="text-destructive">sync failed</span>}
          <ChevronDown className="size-3 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          {/* Where this project stands — the answer to "who can see this,
              where does it live, what happens if I break it" */}
          <div className="px-2 py-2 space-y-1 text-xs">
            <p className="font-medium text-sm flex items-center gap-1.5">
              <Info className="size-3.5 text-muted-foreground" />
              {stage.label} · {stage.visibility}
            </p>
            <p className="text-muted-foreground">{stage.home}.</p>
            <p className="text-muted-foreground">{stage.safety}</p>
            {cloudProjectId && syncStatus === 'saving' && (
              <p className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Saving…
              </p>
            )}
            {syncFailed && (
              <p className="inline-flex items-center gap-1 text-destructive">
                <CloudOff className="size-3" /> Not saved — check your connection
              </p>
            )}
          </div>
          <DropdownMenuSeparator />

          {/* onClick, not onSelect. These menus are Base UI, not Radix:
              `onSelect` is a real DOM prop (text selection), so it type-checks,
              never fires, and the menu item silently does nothing — which is
              exactly how the old wordmark menu's New Project / Projects /
              Gallery items came to be decorative. */}
          <DropdownMenuItem onClick={() => handleOpen(true)} className="gap-2 text-xs">
            <Pencil className="size-3.5 text-muted-foreground" />
            Rename project
          </DropdownMenuItem>
          {canSaveToAccount && (
            <DropdownMenuItem onClick={() => handleOpen(true)} className="gap-2 text-xs">
              <Cloud className="size-3.5 text-muted-foreground" />
              Save to your account
            </DropdownMenuItem>
          )}
          {/* Nothing else: this menu is only ever about *this project*. The
              ways out of it — Home, Projects, Gallery, a fresh start — live
              behind the wordmark, where the rest of the app always is. */}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={handleOpen}>
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
    </>
  );
}
