import { useCallback, useEffect, useMemo } from 'react';
import { ProviderSettings } from '@/components/ProviderSettings';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';
import { ResizableLayout } from '@/components/ResizableLayout';
import { PublishDialog } from '@/components/PublishDialog';
import { SharePreview } from '@/components/SharePreview';
import { GitHubSync } from '@/components/GitHubSync';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useKnowledgeStore } from '@/store/knowledge-store';

import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

function App() {
  const refreshModels = useProviderStore(s => s.refreshModels);

  const loadKnowledge = useKnowledgeStore(s => s.loadAll);

  useEffect(() => {
    refreshModels();
    loadKnowledge();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMessages = useChatStore(s => s.clearMessages);
  const clearProject = useProjectStore(s => s.clearProject);

  const handleNewProject = useCallback(() => {
    clearMessages();
    clearProject();
  }, [clearMessages, clearProject]);

  const panels = useMemo(() => [
    { content: <ChatPanel />, defaultSize: 45, minSize: 300 },
    { content: <RightPanel />, defaultSize: 55, minSize: 350 },
  ], []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">Relational Builder</h1>
          <Separator orientation="vertical" className="h-5" />
          <ModelSelector />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleNewProject}>
            <Plus className="size-3" />
            New Project
          </Button>
          <SharePreview />
          <PublishDialog />
          <GitHubSync />
          <Separator orientation="vertical" className="h-5" />
          <ProviderSettings />
        </div>
      </header>

      {/* Main content — resizable panel layout */}
      <main className="flex-1 min-h-0">
        <ResizableLayout panels={panels} />
      </main>
    </div>
  );
}

export default App;
