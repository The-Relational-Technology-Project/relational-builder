import { useState } from 'react';
import { FilePanel } from './FilePanel';
import { KBPanel } from './KnowledgeBase/KBPanel';
import { NetworkPanel } from './KnowledgeBase/NetworkPanel';
import { useProjectStore } from '@/store/project-store';
import { Code, BookOpen, Radio } from 'lucide-react';

type Tab = 'files' | 'knowledge' | 'network';

export function RightPanel() {
  const version = useProjectStore(s => s.version);
  const fileCount = useProjectStore(s => s.getFileCount());
  void version;

  // Default to knowledge base when no files, files when files exist
  const [activeTab, setActiveTab] = useState<Tab>(fileCount > 0 ? 'files' : 'knowledge');

  // Auto-switch to files tab when first file appears
  if (fileCount > 0 && activeTab === 'knowledge') {
    // Only auto-switch if user hasn't explicitly chosen KB
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b shrink-0">
        <TabButton
          active={activeTab === 'files'}
          onClick={() => setActiveTab('files')}
          icon={<Code className="size-3" />}
          label="Files"
          badge={fileCount > 0 ? fileCount : undefined}
        />
        <TabButton
          active={activeTab === 'knowledge'}
          onClick={() => setActiveTab('knowledge')}
          icon={<BookOpen className="size-3" />}
          label="Knowledge"
        />
        <TabButton
          active={activeTab === 'network'}
          onClick={() => setActiveTab('network')}
          icon={<Radio className="size-3" />}
          label="Network"
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'files' && <FilePanel />}
        {activeTab === 'knowledge' && <KBPanel />}
        {activeTab === 'network' && <NetworkPanel />}
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
