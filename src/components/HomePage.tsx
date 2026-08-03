import { useCallback } from 'react';
import { HomeDashboard } from '@/components/HomeDashboard';
import { MessageInput } from '@/components/Chat/MessageInput';
import { useNeedsKey, NeedsKeyHint } from '@/components/Chat/composer-gate';
import { CommunityBudgetBanner } from '@/components/CommunityBudgetBanner';
import { useChatStore } from '@/store/chat-store';
import { useUIStore } from '@/store/ui-store';
import { startNewProject } from '@/project/new-project';

/**
 * Home as a place you can go — not just the state the builder happens to be
 * in when it's empty. The wordmark points here from anywhere, and an open
 * project stays warm at `/` behind the nav's back pill while you stand in
 * the lobby.
 *
 * The composer always starts fresh: whatever is open is already saved (the
 * shelf and cloud autosavers see to that) and reachable from the recent row
 * or the back pill, so typing here is the "new project" door. The message is
 * queued rather than sent — ChatPanel owns the send pipeline, and it picks
 * the queue up the moment the builder mounts. Same dashboard component as
 * the empty builder at `/`, so the two doors open onto one room.
 */
export function HomePage() {
  const setView = useUIStore(s => s.setView);
  const mode = useChatStore(s => s.mode);
  const setMode = useChatStore(s => s.setMode);
  const needsKey = useNeedsKey();

  const handleSend = useCallback((content: string, attachments?: string[]) => {
    const chosenMode = useChatStore.getState().mode;
    startNewProject();
    // clearMessages resets mode to 'plan' — the person's choice survives
    useChatStore.getState().setMode(chosenMode);
    useChatStore.getState().queueMessage(content, attachments);
    setView('builder');
  }, [setView]);

  return (
    // Same shell as the empty builder's dashboard: a full-height column the
    // dashboard's own flex-1 scroll area can fill
    <div className="flex flex-col h-full">
      <HomeDashboard
        composer={
          <div className="space-y-2">
            <CommunityBudgetBanner />
            <MessageInput
              onSend={handleSend}
              onStop={() => {}}
              isGenerating={false}
              disabled={needsKey}
              mode={mode}
              onModeChange={setMode}
              variant="hero"
              startsNewProject
            />
            <NeedsKeyHint needsKey={needsKey} />
          </div>
        }
      />
    </div>
  );
}
