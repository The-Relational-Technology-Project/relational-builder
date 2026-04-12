import { create } from 'zustand';
import type { Tool, Story } from '@/knowledge/types';
import type { FeedEntry } from '@/knowledge/network-feed';
import { fetchTools, fetchStories } from '@/knowledge/queries';
import { fetchNetworkFeed } from '@/knowledge/network-feed';
import { scoreRelevance } from '@/knowledge/relevance';

interface RelevantContext {
  tools: Tool[];
  stories: Story[];
  networkEntries: FeedEntry[];
}

interface KnowledgeState {
  tools: Tool[];
  stories: Story[];
  networkEntries: FeedEntry[];
  loaded: boolean;
  loading: boolean;

  /** Load all knowledge base data (call once on app mount) */
  loadAll: () => Promise<void>;

  /** Score and return the most relevant items for a user query */
  getRelevantContext: (query: string) => RelevantContext;
}

export const useKnowledgeStore = create<KnowledgeState>()((set, get) => ({
  tools: [],
  stories: [],
  networkEntries: [],
  loaded: false,
  loading: false,

  loadAll: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });

    try {
      const [tools, stories, networkEntries] = await Promise.all([
        fetchTools(),
        fetchStories(),
        fetchNetworkFeed(50).catch(() => [] as FeedEntry[]),
      ]);
      set({ tools, stories, networkEntries, loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  getRelevantContext: (query: string): RelevantContext => {
    const { tools, stories, networkEntries } = get();

    // Score tools
    const toolDocs = tools.map(t => ({
      item: t,
      text: [t.name, t.description, t.summary ?? '', t.tool_category].join(' '),
    }));
    const topTools = scoreRelevance(query, toolDocs, 5).map(s => s.item);

    // Score stories
    const storyDocs = stories.map(s => ({
      item: s,
      text: [s.title ?? '', s.story_text, s.attribution].join(' '),
    }));
    const topStories = scoreRelevance(query, storyDocs, 3).map(s => s.item);

    // Score network entries
    const feedDocs = networkEntries
      .filter(e => e.entry_type === 'change') // skip welcome entries
      .map(e => ({
        item: e,
        text: [
          e.repo.name,
          e.repo.description ?? '',
          e.summary,
          ...e.tags,
          e.change?.title ?? '',
        ].join(' '),
      }));
    const topNetwork = scoreRelevance(query, feedDocs, 3).map(s => s.item);

    return { tools: topTools, stories: topStories, networkEntries: topNetwork };
  },
}));
