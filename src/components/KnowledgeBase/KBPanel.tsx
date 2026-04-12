import { useState, useMemo } from 'react';
import { searchItems } from '@/knowledge/queries';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { ToolCard } from './ToolCard';
import { StoryCard } from './StoryCard';
import { Search, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

type TabId = 'tools' | 'stories';

export function KBPanel() {
  const tools = useKnowledgeStore(s => s.tools);
  const stories = useKnowledgeStore(s => s.stories);
  const loading = useKnowledgeStore(s => s.loading);
  const error = useKnowledgeStore(s => s.error);
  const loadAll = useKnowledgeStore(s => s.loadAll);
  const [activeTab, setActiveTab] = useState<TabId>('tools');
  const [search, setSearch] = useState('');

  const filteredTools = useMemo(
    () => searchItems(tools, search),
    [tools, search],
  );

  const filteredStories = useMemo(
    () => searchItems(stories, search),
    [stories, search],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b shrink-0">
        <div className="text-xs font-medium mb-2">RTP Knowledge Base</div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full text-xs border rounded pl-7 pr-2 py-1 bg-transparent outline-none focus:border-ring"
          />
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          <TabButton
            active={activeTab === 'tools'}
            onClick={() => setActiveTab('tools')}
            label={`Tools (${filteredTools.length})`}
          />
          <TabButton
            active={activeTab === 'stories'}
            onClick={() => setActiveTab('stories')}
            label={`Stories (${filteredStories.length})`}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
            <AlertTriangle className="size-4 text-amber-500" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              onClick={() => {
                // Reset loaded state so loadAll can retry
                useKnowledgeStore.setState({ loaded: false, error: null });
                loadAll();
              }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              <RefreshCw className="size-3" />
              Retry
            </button>
          </div>
        )}
        {!loading && !error && activeTab === 'tools' && (
          filteredTools.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No tools found</p>
          ) : (
            filteredTools.map(tool => <ToolCard key={tool.id} tool={tool} />)
          )
        )}
        {!loading && !error && activeTab === 'stories' && (
          filteredStories.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No stories found</p>
          ) : (
            filteredStories.map(story => <StoryCard key={story.id} story={story} />)
          )
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
        active
          ? 'bg-foreground text-background font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}
