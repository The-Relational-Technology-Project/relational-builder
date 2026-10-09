import { useCloudStore, remoteBuilderOf } from '@/store/cloud-store';
import { Hammer } from 'lucide-react';

/**
 * Who else has this project open, beside its name. A team on four devices
 * needs to see that changes arriving "by themselves" are a teammate's, and
 * which teammate is mid-build — that is the moment to wait, not to send
 * the same prompt again. Nothing renders when it's just you.
 */
export function PresenceRow() {
  const peers = useCloudStore(s => s.peers);
  if (peers.length === 0) return null;
  const builder = remoteBuilderOf(peers);

  return (
    <div
      className="hidden sm:flex items-center gap-1 min-w-0"
      title={
        builder
          ? `${builder.name} is building: ${builder.building?.prompt || '…'}`
          : `Here now: ${peers.map(p => p.name).join(', ')}`
      }
    >
      {peers.slice(0, 4).map(p => {
        const building = builder?.userId === p.userId;
        return (
          <span
            key={p.userId}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              building
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/70 bg-background text-foreground/70'
            }`}
          >
            {building && <Hammer className="size-3 animate-pulse" />}
            <span className="max-w-[90px] truncate">{p.name}</span>
          </span>
        );
      })}
      {peers.length > 4 && (
        <span className="text-[11px] text-muted-foreground">+{peers.length - 4}</span>
      )}
    </div>
  );
}
