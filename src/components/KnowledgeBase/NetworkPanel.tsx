import { useKnowledgeStore } from '@/store/knowledge-store';
import type { FeedEntry } from '@/knowledge/network-feed';
import { ExternalLink, Radio } from 'lucide-react';

export function NetworkPanel() {
  const entries = useKnowledgeStore(s => s.networkEntries);
  const loading = useKnowledgeStore(s => s.loading);
  const loaded = useKnowledgeStore(s => s.loaded);
  const error = !loading && !loaded ? 'Failed to load' : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Loading network activity...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load network feed: {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No recent network activity
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">Network Activity</h3>
          <a
            href="https://updates.relationaltechproject.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Full feed <ExternalLink className="size-2.5" />
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Recent updates from relational tech builders
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.map(entry => (
          <FeedCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function FeedCard({ entry }: { entry: FeedEntry }) {
  const timeAgo = formatTimeAgo(entry.timestamp);
  const isWelcome = entry.entry_type === 'welcome';

  return (
    <div className="px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {isWelcome ? (
            <span className="text-xs">*</span>
          ) : (
            <Radio className="size-3 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <a
              href={entry.repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium hover:underline truncate"
            >
              {entry.repo.name}
            </a>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{entry.summary}</p>
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entry.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
