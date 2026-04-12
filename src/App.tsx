import { useEffect } from 'react';
import { ProviderSettings } from '@/components/ProviderSettings';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { useProviderStore } from '@/store/provider-store';
import { registry } from '@/providers/registry';
import { Separator } from '@/components/ui/separator';

function App() {
  const refreshModels = useProviderStore(s => s.refreshModels);
  const activeProviderId = useProviderStore(s => s.activeProviderId);

  useEffect(() => {
    refreshModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const providerEntry = registry.getEntry(activeProviderId);

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

      {/* Main content — chat panel (preview + knowledge base panels added later) */}
      <main className="flex-1 min-h-0">
        <ChatPanel />
      </main>
    </div>
  );
}

export default App;
