import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProviderSettings } from '@/components/ProviderSettings';
import { ModelSelector } from '@/components/ModelSelector';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';
import { ResizableLayout } from '@/components/ResizableLayout';
import { PublishDialog } from '@/components/PublishDialog';
import { ImportPlanDialog } from '@/components/ImportPlanDialog';
import { RemixDialog } from '@/components/RemixDialog';
import { SharePreview } from '@/components/SharePreview';
import { GitHubSync } from '@/components/GitHubSync';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useAuthStore } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useCommunityStore } from '@/store/community-store';
import { useStudioStore } from '@/store/studio-store';
import { StudioSwitcher } from '@/components/StudioSwitcher';
import { BuilderOnboarding } from '@/components/BuilderOnboarding';
import { initCloudSync } from '@/cloud/sync';
import { AccountMenu } from '@/components/AccountMenu';
import { ProjectsDialog } from '@/components/ProjectsDialog';
import { CloudStatus } from '@/components/CloudStatus';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RBMark } from '@/components/PasscodeGate';

import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, PanelsTopLeft } from 'lucide-react';

/** True below the md breakpoint — drives the stacked mobile layout */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

function App() {
  const refreshModels = useProviderStore(s => s.refreshModels);

  const loadKnowledge = useKnowledgeStore(s => s.loadAll);
  const initAuth = useAuthStore(s => s.init);

  useEffect(() => {
    refreshModels();
    loadKnowledge();
    initAuth();
    initCloudSync();
    useCommunityStore.getState().init();
    useStudioStore.getState().init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMessages = useChatStore(s => s.clearMessages);
  const clearProject = useProjectStore(s => s.clearProject);
  const closeCloudProject = useCloudStore(s => s.closeProject);

  const handleNewProject = useCallback(() => {
    closeCloudProject();
    clearMessages();
    clearProject();
  }, [clearMessages, clearProject, closeCloudProject]);

  // Focused building mode: start-from actions live on the home state,
  // ship actions appear once there's a project to ship
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);
  const hasProject = fileCount > 0 || messageCount > 0;

  // First sign-in → the place-grounded builder onboarding
  const authUser = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const profileLoaded = useAuthStore(s => s.profileLoaded);
  const needsOnboarding = !!authUser && profileLoaded && !profile?.profile_completed;

  const panels = useMemo(() => [
    { content: <ChatPanel />, defaultSize: 45, minSize: 300 },
    { content: <RightPanel />, defaultSize: 55, minSize: 350 },
  ], []);

  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'chat' | 'workspace'>('chat');

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground">
      {needsOnboarding && <BuilderOnboarding />}
      {/* Toolbar — scrolls horizontally on small screens instead of wrapping */}
      <header className="flex items-center justify-between gap-2 px-3 md:px-4 py-2 border-b shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <RBMark className="size-5 shrink-0" />
            <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap hidden sm:block">
              Relational Builder
            </h1>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <ModelSelector />
          <StudioSwitcher />
          <CloudStatus />
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleNewProject}>
            <Plus className="size-3" />
            <span className="hidden sm:inline">New Project</span>
          </Button>
          {!hasProject && <ImportPlanDialog />}
          {!hasProject && <RemixDialog />}
          <ProjectsDialog />
          {hasProject && <SharePreview />}
          {hasProject && <PublishDialog />}
          <GitHubSync />
          <Separator orientation="vertical" className="h-5" />
          <ThemeToggle />
          <AccountMenu />
          <ProviderSettings />
        </div>
      </header>

      {/* Main content — split panels on desktop, tab-switched stack on mobile */}
      <main className="flex-1 min-h-0">
        {isMobile ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {mobileTab === 'chat' ? <ChatPanel /> : <RightPanel />}
            </div>
            <nav className="flex border-t shrink-0" aria-label="Mobile panels">
              <button
                onClick={() => setMobileTab('chat')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                  mobileTab === 'chat' ? 'text-foreground bg-muted/60' : 'text-muted-foreground'
                }`}
              >
                <MessageSquare className="size-3.5" />
                Chat
              </button>
              <button
                onClick={() => setMobileTab('workspace')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-l ${
                  mobileTab === 'workspace' ? 'text-foreground bg-muted/60' : 'text-muted-foreground'
                }`}
              >
                <PanelsTopLeft className="size-3.5" />
                Preview & Files
              </button>
            </nav>
          </div>
        ) : (
          <ResizableLayout panels={panels} />
        )}
      </main>
    </div>
  );
}

export default App;
