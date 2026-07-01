import { useCloudStore } from '@/store/cloud-store';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';

/** Tiny sync indicator shown in the toolbar when a cloud project is open */
export function CloudStatus() {
  const currentProjectId = useCloudStore(s => s.currentProjectId);
  const currentProjectName = useCloudStore(s => s.currentProjectName);
  const syncStatus = useCloudStore(s => s.syncStatus);
  const syncError = useCloudStore(s => s.syncError);

  if (!currentProjectId) return null;

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
