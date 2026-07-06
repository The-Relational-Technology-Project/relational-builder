import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProviderSettings } from '@/components/ProviderSettings';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';
import { ResizableLayout } from '@/components/ResizableLayout';
import { PublishDialog } from '@/components/PublishDialog';
import { PromptDialog } from '@/components/PromptDialog';
import { SharePreview } from '@/components/SharePreview';
import { GitHubSync } from '@/components/GitHubSync';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useEnvStore } from '@/store/env-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useCommunityStore } from '@/store/community-store';
import { useStudioStore } from '@/store/studio-store';
import { useUIStore } from '@/store/ui-store';
import { StudioSwitcher } from '@/components/StudioSwitcher';
import { BuilderOnboarding } from '@/components/BuilderOnboarding';
import { initCloudSync } from '@/cloud/sync';
import { AccountMenu } from '@/components/AccountMenu';
import { ProjectsDialog } from '@/components/ProjectsDialog';
import { CloudStatus } from '@/components/CloudStatus';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RBMark } from '@/components/RBMark';

import { StudioGallery } from '@/components/StudioGallery';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, PanelsTopLeft, Menu, X, Cloud, CloudOff, Loader2, LayoutGrid } from 'lucide-react';

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
    // Shared build prompts arrive by link, ready to send
    import('@/cloud/prompts').then(m => m.handlePromptDeepLink()).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMessages = useChatStore(s => s.clearMessages);
  const clearProject = useProjectStore(s => s.clearProject);
  const closeCloudProject = useCloudStore(s => s.closeProject);

  const handleNewProject = useCallback(() => {
    closeCloudProject();
    clearMessages();
    clearProject();
    // A fresh project starts with a fresh environment — service keys and
    // Community Cloud backends belong to the app they were connected for
    useEnvStore.getState().clearAll();
  }, [clearMessages, clearProject, closeCloudProject]);

  // Focused building mode: start-from actions live on the home state,
  // ship actions appear once there's a project to ship
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);
  const hasProject = fileCount > 0 || messageCount > 0;

  // First sign-in → the place-grounded builder onboarding
  const authUser = useAuthStore(s => s.user);
  // Theme + model/key settings live in the account menu once someone's signed
  // in. Only when they aren't (or cloud is off) do they need standalone icons.
  const showStandaloneSettings = !(cloudEnabled && authUser);
  const profile = useAuthStore(s => s.profile);
  const profileLoaded = useAuthStore(s => s.profileLoaded);
  const needsOnboarding = !!authUser && profileLoaded && !profile?.profile_completed;

  const panels = useMemo(() => [
    { content: <ChatPanel />, defaultSize: 45, minSize: 300 },
    { content: <RightPanel />, defaultSize: 55, minSize: 350 },
  ], []);

  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'chat' | 'workspace'>('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // The Studio Gallery is its own space next to Home; starting a build
  // (from the gallery or anywhere else) always lands back in the workspace
  const galleryOpen = useUIStore(s => s.galleryOpen);
  const setGalleryOpen = useUIStore(s => s.setGalleryOpen);
  useEffect(() => {
    if (hasProject) setGalleryOpen(false);
  }, [hasProject, setGalleryOpen]);

  const currentProjectName = useCloudStore(s => s.currentProjectName);
  const syncStatus = useCloudStore(s => s.syncStatus);

  return (
    <div className="h-dvh flex flex-col overflow-x-hidden bg-background text-foreground">
      {needsOnboarding && <BuilderOnboarding />}
      {/* Desktop toolbar */}
      <header className="hidden md:flex items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <RBMark className="size-5 shrink-0" />
            <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap">
              Relational Builder
            </h1>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <StudioSwitcher />
          <CloudStatus />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleNewProject}>
            <Plus className="size-3" />
            New Project
          </Button>
          {!hasProject && (
            <Button
              variant={galleryOpen ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setGalleryOpen(!galleryOpen)}
            >
              <LayoutGrid className="size-3" />
              Gallery
            </Button>
          )}
          <ProjectsDialog />
          {hasProject && <PromptDialog />}
          {hasProject && <SharePreview />}
          {hasProject && <PublishDialog />}
          <GitHubSync />
          <Separator orientation="vertical" className="h-5" />
          {showStandaloneSettings && <ThemeToggle />}
          <AccountMenu />
          {showStandaloneSettings && <ProviderSettings />}
        </div>
      </header>

      {/* Mobile toolbar: mark · centered project pill · menu (Lovable-calm).
          The action sheet stays mounted (hidden by class) so any dialog a
          row opens survives the sheet closing. */}
      <header className="flex md:hidden items-center gap-2 px-3 py-2 border-b shrink-0">
        <RBMark className="size-5 shrink-0" />
        <div className="flex-1 flex justify-center min-w-0">
          <div className="inline-flex items-center gap-1.5 max-w-full rounded-full border px-3 py-1 text-xs">
            {currentProjectName ? (
              <>
                {syncStatus === 'saving' ? (
                  <Loader2 className="size-3 animate-spin shrink-0 text-muted-foreground" />
                ) : syncStatus === 'error' ? (
                  <CloudOff className="size-3 shrink-0 text-destructive" />
                ) : (
                  <Cloud className="size-3 shrink-0 text-green-600" />
                )}
                <span className="truncate font-medium">{currentProjectName}</span>
              </>
            ) : (
              <span className="truncate font-medium">
                {hasProject ? 'New project' : 'Relational Builder'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(o => !o)}
          className="shrink-0 rounded-md p-2 -mr-1 text-muted-foreground hover:text-foreground"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
        </button>
      </header>
      <div className={mobileMenuOpen ? 'md:hidden relative z-30' : 'hidden'}>
        <div
          className="fixed inset-0 bg-black/30"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className="absolute left-0 right-0 border-b bg-background shadow-lg px-3 py-3 space-y-3"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <StudioSwitcher />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleNewProject}>
              <Plus className="size-3" />
              New Project
            </Button>
            {!hasProject && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => setGalleryOpen(!galleryOpen)}
              >
                <LayoutGrid className="size-3" />
                Gallery
              </Button>
            )}
            <ProjectsDialog />
            {hasProject && <PromptDialog />}
            {hasProject && <SharePreview />}
            {hasProject && <PublishDialog />}
            <GitHubSync />
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t">
            {showStandaloneSettings && <ThemeToggle />}
            <AccountMenu />
            {showStandaloneSettings && <ProviderSettings />}
          </div>
        </div>
      </div>

      {/* Main content — home gets the full width (nothing to preview yet);
          building gets split panels on desktop, a tab-switched stack on mobile */}
      <main className="flex-1 min-h-0">
        {!hasProject ? (
          galleryOpen ? <StudioGallery onClose={() => setGalleryOpen(false)} /> : <ChatPanel />
        ) : isMobile ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {mobileTab === 'chat' ? <ChatPanel /> : <RightPanel />}
            </div>
            <nav className="flex border-t shrink-0 pb-[env(safe-area-inset-bottom)]" aria-label="Mobile panels">
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
