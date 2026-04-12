import { useState } from 'react';
import { FilePanel } from './FilePanel';
import { PreviewPanel } from './PreviewPanel';
import { EnvPanel } from './EnvPanel';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { Eye, Code, KeyRound } from 'lucide-react';

type Tab = 'preview' | 'files' | 'env';

export function RightPanel() {
  const version = useProjectStore(s => s.version);
  const fileCount = useProjectStore(s => s.getFileCount());
  const envCount = useEnvStore(s => s.vars.length);
  void version;

  const [activeTab, setActiveTab] = useState<Tab>('preview');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b shrink-0">
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
          active={activeTab === 'env'}
          onClick={() => setActiveTab('env')}
          icon={<KeyRound className="size-3" />}
          label="Env"
          badge={envCount > 0 ? envCount : undefined}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'preview' && <PreviewPanel />}
        {activeTab === 'files' && <FilePanel />}
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-b-2 ${
        active
          ? 'border-foreground text-foreground font-medium'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="bg-muted text-muted-foreground text-[10px] px-1 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}
