import { useState } from 'react';
import { FilePanel } from './FilePanel';
import { PreviewPanel } from './PreviewPanel';
import { EnvPanel } from './EnvPanel';
import { IntegrationsPanel } from './IntegrationsPanel';
import { CloudPanel } from './CloudPanel';
import { NotepadPanel } from './NotepadPanel';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { useNotepadStore } from '@/store/notepad-store';
import { getConnectedIntegrations, communityCloudConnected } from '@/integrations/catalog';
import { Eye, Code, KeyRound, NotebookPen, Plug, Cloud } from 'lucide-react';

type Tab = 'preview' | 'files' | 'cloud' | 'services' | 'notepad' | 'env';

export function RightPanel() {
  const version = useProjectStore(s => s.version);
  const fileCount = useProjectStore(s => s.getFileCount());
  const noteCount = useNotepadStore(s => s.notes.length);
  const envVars = useEnvStore(s => s.vars);
  const envCount = envVars.length;
  const connectedCount = getConnectedIntegrations(envVars).length;
  const cloudOn = communityCloudConnected(envVars);
  void version;

  const [activeTab, setActiveTab] = useState<Tab>('preview');

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
