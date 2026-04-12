/** Types and fetcher for the Relational Tech network activity feed */

export interface FeedRepo {
  name: string;
  full_name: string;
  url: string;
  neighborhood?: string | null;
  builder?: string | null;
  description?: string;
}

export interface FeedChange {
  type: string;
  title: string;
  url: string;
  significance: string;
}

export interface FeedEntry {
  id: string;
  timestamp: string;
  entry_type: 'welcome' | 'change';
  repo: FeedRepo;
  change?: FeedChange;
  summary: string;
  tags: string[];
  matches?: unknown[];
  contributor?: {
    login: string;
    url: string;
  };
}

const FEED_URL = 'https://updates.relationaltechproject.org/feed.json';

/** Fetch recent network activity from the watcher feed */
export async function fetchNetworkFeed(limit = 30): Promise<FeedEntry[]> {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Failed to fetch network feed: ${res.status}`);
  const entries: FeedEntry[] = await res.json();

  // Sort newest first and take the limit
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries.slice(0, limit);
}
