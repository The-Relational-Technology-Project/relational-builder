import { useEffect, useMemo, useState } from 'react';
import { ProviderSettings } from '@/components/ProviderSettings';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { RightPanel } from '@/components/RightPanel';
import { ResizableLayout } from '@/components/ResizableLayout';
import { ShareMenu } from '@/components/ShareMenu';
import { CodeSync } from '@/components/CodeSync';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCommunityStore } from '@/store/community-store';
import { useStudioStore } from '@/store/studio-store';
import { useUIStore, initRouting } from '@/store/ui-store';
import { BuilderOnboarding } from '@/components/BuilderOnboarding';
import { initCloudSync } from '@/cloud/sync';
import { AccountMenu, SignInDialogHost } from '@/components/AccountMenu';
import { HomePage } from '@/components/HomePage';
import { ProjectsPage } from '@/components/ProjectsPage';
import { ConnectionsPage } from '@/components/ConnectionsPage';
import { ProfilePage } from '@/components/ProfilePage';
import { StewardPage } from '@/components/StewardPage';
import { StudioAdminPage } from '@/components/StudioAdminPage';
import { initLocalAutosave } from '@/project/local-projects';
import { initAutoSync } from '@/project/auto-sync';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RBMark } from '@/components/RBMark';
import { MainNav } from '@/components/MainNav';
import { useCurrentProjectName } from '@/lib/use-project-name';
import { ProjectMenu } from '@/components/ProjectMenu';
import { InviteBanner } from '@/components/InviteBanner';

import { CommonsGallery } from '@/components/CommonsGallery';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Home, MessageSquare, PanelsTopLeft, Menu, X, ArrowLeft, FolderOpen, LayoutGrid } from 'lucide-react';

/** True below the md breakpoint — drives the stacked mobile layout */
/**
 * The landing footer's essentials, inside the app for signed-in builders —
 * Privacy & Terms and Contact stay one tap away (the #privacy / #contact
 * pages win over the app shell, signed in or not).
 */
function AppFooter() {
  return (
    <footer className="shrink-0 border-t px-4 py-2 text-center text-xs text-muted-foreground">
      Made with care for neighbors everywhere ·{' '}
      <a href="#privacy" className="underline underline-offset-2 hover:text-foreground">
        Privacy &amp; Terms
      </a>
      {' '}·{' '}
      <a href="#contact" className="underline underline-offset-2 hover:text-foreground">
        Contact
      </a>
    </footer>
  );
}

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
    initLocalAutosave();
    // A connected repo keeps itself up to date — no push to remember
    initAutoSync();
    // The address bar decides which page is showing, and back/forward work
    initRouting();
    // Shared build prompts arrive by link, ready to send
    import('@/cloud/prompts').then(m => m.handlePromptDeepLink()).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setView = useUIStore(s => s.setView);

  // Focused building mode: start-from actions live on the home state,
  // ship actions appear once there's a project to ship
  const fileCount = useProjectStore(s => s.getFileCount());
  const messageCount = useChatStore(s => s.messages.length);
  const hasProject = fileCount > 0 || messageCount > 0;

  // The initial plan stays a full-width, focused conversation — clarifying
  // questions and the plan deserve attention, not an empty preview pane.
  // The split appears the moment building starts (mode flips to build /
  // first files land); after that, later plan chats keep the two panes.
  const chatMode = useChatStore(s => s.mode);
  const planFocus = messageCount > 0 && fileCount === 0 && chatMode === 'plan';

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

  // Which view fills the main area — the builder itself or one of the
  // full-width pages. The header stays put; leaving a page happens through
  // it (project name / wordmark), not per-page close buttons.
  const view = useUIStore(s => s.view);

  // "Project view": a project is open and in front of you. Sync and Share
  // only make sense here.
  const inProject = view === 'builder' && hasProject;
  const projectName = useCurrentProjectName();

  return (
    <div className="h-dvh flex flex-col overflow-x-hidden bg-background text-foreground">
      {needsOnboarding && <BuilderOnboarding />}
      {/* One sign-in dialog for the whole app. Both headers are always
          mounted (one is CSS-hidden), and a portalled dialog inside each
          opened two stacked copies — so the close button appeared to do
          nothing. Every "Sign in" now just calls promptSignIn(). */}
      <SignInDialogHost />
      {/* An invite link that landed in the wrong account says so here — it
          used to be indistinguishable from a link that did nothing at all */}
      <InviteBanner />
      {/* Desktop toolbar */}
      <header className="hidden md:flex items-center justify-between gap-3 px-4 py-2 border-b shrink-0">
        {/* min-w-0 so a long project name compresses the left group instead of
            shoving the right one off the edge — the header used to be two
            shrink-0 groups inside an overflow-hidden parent, which clips
            rather than reflows. */}
        {/* In a project the left side is the project; on a page it's the way
            around. Both live in MainNav. */}
        <MainNav />
        <div className="flex items-center gap-2 shrink-0">
          {/* Sync and Share belong to the project in front of you — on the
              Gallery or your Projects there is nothing here to sync or
              share, so they step out of the way entirely. */}
          {inProject && <CodeSync />}
          {/* Publish, Prompt, preview links, and collaborators live behind
              one Share door — the header's single primary action.
              (Connections moved to the account menu.) */}
          {inProject && <ShareMenu />}
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
        {/* Same door as the desktop wordmark: the mark goes Home */}
        <button onClick={() => setView('home')} title="Home" className="shrink-0">
          <RBMark className="size-5" />
        </button>
        <div className="flex-1 flex justify-center min-w-0">
          {/* In the project, the pill is the project's own menu; from a page
              it's the way back to it. */}
          {inProject ? (
            <ProjectMenu />
          ) : projectName !== null ? (
            <button
              onClick={() => setView('builder')}
              className="inline-flex items-center gap-1.5 max-w-full rounded-full border px-3 py-1 text-xs"
            >
              <ArrowLeft className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{projectName}</span>
            </button>
          ) : (
            <span className="truncate text-xs font-medium">Relational Builder</span>
          )}
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
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Home is where new projects start now — its composer is the door */}
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setView('home')}>
              <Home className="size-3" />
              Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setView('projects')}
            >
              <FolderOpen className="size-3" />
              Your Projects
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setView('gallery')}
            >
              <LayoutGrid className="size-3" />
              Gallery
            </Button>
            {inProject && <ShareMenu mobile />}
            {inProject && <CodeSync />}
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
        {view === 'home' ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <HomePage />
            </div>
            <AppFooter />
          </div>
        ) : view === 'steward' ? (
          <StewardPage />
        ) : view === 'studio-admin' ? (
          <StudioAdminPage />
        ) : view === 'connections' ? (
          <ConnectionsPage />
        ) : view === 'profile' ? (
          <ProfilePage />
        ) : view === 'projects' ? (
          <ProjectsPage />
        ) : view === 'gallery' ? (
          <CommonsGallery />
        ) : !hasProject ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              <ChatPanel />
            </div>
            <AppFooter />
          </div>
        ) : planFocus ? (
          <div className="h-full w-full max-w-3xl mx-auto">
            <ChatPanel />
          </div>
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
