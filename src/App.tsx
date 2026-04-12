import { useEffect } from 'react';
import { ProviderSettings } from '@/components/ProviderSettings';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { PreviewPanel } from '@/components/PreviewPanel';
import { FilePanel } from '@/components/FilePanel';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { registry } from '@/providers/registry';
import { Separator } from '@/components/ui/separator';

function App() {
  const refreshModels = useProviderStore(s => s.refreshModels);
  const activeProviderId = useProviderStore(s => s.activeProviderId);
  const version = useProjectStore(s => s.version);
  const fileCount = useProjectStore(s => s.getFileCount());
  void version; // subscribe to FS changes

  useEffect(() => {
    refreshModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const providerEntry = registry.getEntry(activeProviderId);
  const hasFiles = fileCount > 0;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">Relational Builder</h1>
          <Separator orientation="vertical" className="h-5" />
          <ModelSelector />
          {providerEntry && (
            <span className="text-xs text-muted-foreground">
              via {providerEntry.provider.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ProviderSettings />
        </div>
      </header>

      {/* Main content — three-panel layout when files exist */}
      <main className="flex-1 min-h-0 flex">
        {/* Chat panel */}
        <div className={`${hasFiles ? 'w-[30%]' : 'w-full'} min-h-0 border-r shrink-0 transition-all`}>
          <ChatPanel />
        </div>

        {hasFiles && (
          <>
            {/* Preview panel */}
            <div className="flex-1 min-h-0 min-w-0 border-r">
              <PreviewPanel />
            </div>

            {/* File panel */}
            <div className="w-[25%] min-h-0 shrink-0">
              <FilePanel />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
