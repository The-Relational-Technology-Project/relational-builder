import { useEffect, useRef } from 'react';
import { FilePanel } from './FilePanel';
import { PreviewPanel } from './PreviewPanel';
import { EnvPanel } from './EnvPanel';
import { IntegrationsPanel } from './IntegrationsPanel';
import { CloudPanel } from './CloudPanel';
import { NotepadPanel } from './NotepadPanel';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useEnvStore } from '@/store/env-store';
import { useNotepadStore } from '@/store/notepad-store';
import { usePanelStore } from '@/store/panel-store';
import { getConnectedIntegrations, communityCloudConnected } from '@/integrations/catalog';
import { Eye, Code, KeyRound, NotebookPen, Plug, Cloud } from 'lucide-react';

/** The pane has introduced the Notepad on this device — never yank it again */
const NOTEPAD_INTRO_SEEN_KEY = 'rb-notepad-introduced';

/** Flip once a first build has clearly become a wait — the same beat the
 *  chat's "while this builds" pointer uses (see MessageList.WaitActivity) */
const NOTEPAD_INTRO_AFTER_S = 20;

/**
 * While a first build cooks, the Preview tab has nothing to show — so turn
 * the pane toward the Notepad once (per device, ever) and let its intro
 * invite a first note. When the build finishes and files land, the pane goes
 * back to the Preview on its own — the reveal is the moment that makes the
 * tool feel real, and it must never happen behind a tab the app itself
 * switched away. A person's own tab click cancels the give-back (they went
 * somewhere on purpose; see panel-store).
 */
function useNotepadIntro() {
  // The chat's cooking state IS "a first build is underway" — it spans the
  // whole chain (continuations, auto-fixes, the final bundle), so the pane
  // no longer flips back to a half-built preview between passes.
  const cookingSince = useChatStore(s => s.cookingSince);

  useEffect(() => {
    if (!cookingSince) return;
    if (localStorage.getItem(NOTEPAD_INTRO_SEEN_KEY)) return;
    const fire = () => {
      localStorage.setItem(NOTEPAD_INTRO_SEEN_KEY, new Date().toISOString());
      usePanelStore.getState().autoFlip('notepad');
    };
    const wait = Math.max(0, NOTEPAD_INTRO_AFTER_S * 1000 - (Date.now() - cookingSince));
    const t = setTimeout(fire, wait);
    return () => clearTimeout(t);
  }, [cookingSince]);

  // Generation ended with files in the project and nothing else queued → the
  // Preview gets the pane back (a no-op unless the app was the one who
  // flipped it away). This fires at the END of the chain, not between its
  // passes — a queued continuation or fix means the build isn't done, and a
  // half-built preview shouldn't flash up mid-chain. It also deliberately
  // fires while the chat may still be "cooking": the preview must be mounted
  // for the bundle to run — and to report the health signal that lets the
  // cooking end.
  const isGenerating = useChatStore(s => s.isGenerating);
  const wasGenerating = useRef(false);
  useEffect(() => {
    if (isGenerating) {
      wasGenerating.current = true;
      return;
    }
    if (!wasGenerating.current) return;
    const chat = useChatStore.getState();
    if (chat.queuedMessage || chat.pendingFixSend) return;
    wasGenerating.current = false;
    if (useProjectStore.getState().getFileCount() > 0) {
      usePanelStore.getState().autoRestore('preview');
    }
  }, [isGenerating]);
}

export function RightPanel() {
  const version = useProjectStore(s => s.version);
  const fileCount = useProjectStore(s => s.getFileCount());
  const noteCount = useNotepadStore(s => s.notes.length);
  const envVars = useEnvStore(s => s.vars);
  const envCount = envVars.length;
  const connectedCount = getConnectedIntegrations(envVars).length;
  const cloudOn = communityCloudConnected(envVars);
  void version;

  const activeTab = usePanelStore(s => s.rightTab);
  const setActiveTab = usePanelStore(s => s.setRightTab);
  useNotepadIntro();

  // A sharing-plan draft from the old in-chat wait card becomes a real note:
  // it was written mid-build to survive, and the Notepad is where it lives now
  useEffect(() => {
    const text = (localStorage.getItem('rb-sharing-plan-draft') ?? '').trim();
    if (!text) return;
    localStorage.removeItem('rb-sharing-plan-draft');
    useNotepadStore.getState().addNote(text);
  }, []);

  // Raw env vars are a power-user surface — Services is the friendly front
  // door that writes them. Only show the Env tab once something's in it.
  const showEnvTab = envCount > 0;
  // If the active tab disappears (env cleared on New Project), fall back.
  // Setting state during render is fine here — it converges immediately.
  if (activeTab === 'env' && !showEnvTab) {
    setActiveTab('preview');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b shrink-0 overflow-x-auto">
        <TabButton
          active={activeTab === 'preview'}
          onClick={() => setActiveTab('preview')}
          icon={<Eye className="size-3" />}
          label="Preview"
        />
        <TabButton
          active={activeTab === 'files'}
          onClick={() => setActiveTab('files')}
          icon={<Code className="size-3" />}
          label="Files"
          badge={fileCount > 0 ? fileCount : undefined}
        />
        <TabButton
          active={activeTab === 'cloud'}
          onClick={() => setActiveTab('cloud')}
          icon={<Cloud className="size-3" />}
          label="Cloud"
          dot={cloudOn}
        />
        <TabButton
          active={activeTab === 'services'}
          onClick={() => setActiveTab('services')}
          icon={<Plug className="size-3" />}
          label="Services"
          badge={connectedCount > 0 ? connectedCount : undefined}
        />
        <TabButton
          active={activeTab === 'notepad'}
          onClick={() => setActiveTab('notepad')}
          icon={<NotebookPen className="size-3" />}
          label="Notepad"
          badge={noteCount > 0 ? noteCount : undefined}
        />
        {showEnvTab && (
          <TabButton
            active={activeTab === 'env'}
            onClick={() => setActiveTab('env')}
            icon={<KeyRound className="size-3" />}
            label="Env"
            badge={envCount}
          />
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'preview' && <PreviewPanel />}
        {activeTab === 'files' && <FilePanel />}
        {activeTab === 'cloud' && <CloudPanel />}
        {activeTab === 'services' && <IntegrationsPanel />}
        {activeTab === 'notepad' && <NotepadPanel />}
        {activeTab === 'env' && <EnvPanel />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  /** Quiet "connected" indicator */
  dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-b-2 whitespace-nowrap ${
        active
          ? 'border-foreground text-foreground font-medium'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="bg-muted text-muted-foreground text-xs px-1 rounded">
          {badge}
        </span>
      )}
      {dot && <span className="size-1.5 rounded-full bg-green-600" />}
    </button>
  );
}
