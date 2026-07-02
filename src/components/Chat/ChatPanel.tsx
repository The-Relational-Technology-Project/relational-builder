import { useCallback, useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { buildSystemPrompt } from '@/knowledge/context-builder';
import { registry } from '@/providers/registry';
import { useEnvStore } from '@/store/env-store';
import {
  getConnectedIntegrations,
  communityCloudConnected,
  COMMUNITY_CLOUD_GUIDANCE,
} from '@/integrations/catalog';
import { useCommunityStore } from '@/store/community-store';
import { useStudioStore } from '@/store/studio-store';
import { useAuthStore } from '@/store/auth-store';
import { searchCommons } from '@/knowledge/commons-search';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { HomeDashboard } from '@/components/HomeDashboard';

export function ChatPanel() {
  const messages = useChatStore(s => s.messages);
  const isGenerating = useChatStore(s => s.isGenerating);
  const addUserMessage = useChatStore(s => s.addUserMessage);
  const startAssistantMessage = useChatStore(s => s.startAssistantMessage);
  const appendToMessage = useChatStore(s => s.appendToMessage);
  const finalizeMessage = useChatStore(s => s.finalizeMessage);
  const setIsGenerating = useChatStore(s => s.setIsGenerating);
  const setAbortController = useChatStore(s => s.setAbortController);
  const toChatMessages = useChatStore(s => s.toChatMessages);

  const activeProviderId = useProviderStore(s => s.activeProviderId);
  const activeModelId = useProviderStore(s => s.activeModelId);
  const apiKeys = useProviderStore(s => s.apiKeys);

  const applyMessageFiles = useProjectStore(s => s.applyMessageFiles);
  const getRelevantContext = useKnowledgeStore(s => s.getRelevantContext);
  const setSystemPrompt = useChatStore(s => s.setSystemPrompt);
  const mode = useChatStore(s => s.mode);
  const setMode = useChatStore(s => s.setMode);

  const communityActive = useCommunityStore(s => s.active);

  const provider = registry.getProvider(activeProviderId);
  const needsKey =
    registry.getEntry(activeProviderId)?.requiresApiKey &&
    !apiKeys[activeProviderId] &&
    !(activeProviderId === 'claude' && communityActive);

  const handleSend = useCallback(async (content: string, attachments?: string[]) => {
    if (!provider) return;

    // Mode is read fresh from the store: "Build this plan" flips it right before sending
    const currentMode = useChatStore.getState().mode;

    // Retrieval: hybrid semantic+text search against the RT Commons (the
    // canonical knowledge base), falling back to local TF-IDF scoring of the
    // Studio KB when the commons is unreachable.
    const commonsResults = await searchCommons(content);
    const relevant = commonsResults.length > 0 ? null : getRelevantContext(content);
    const envVars = useEnvStore.getState().vars;
    const connectedServices = getConnectedIntegrations(envVars);
    const serviceGuidance = connectedServices.map(s => s.aiGuidance);
    if (communityCloudConnected(envVars)) serviceGuidance.unshift(COMMUNITY_CLOUD_GUIDANCE);
    const projectFiles = useProjectStore.getState().getAllFiles()
      .map(f => ({ path: f.path, content: f.content }));
    const activeStudio = useStudioStore.getState().activeStudio;
    const builderProfile = useAuthStore.getState().profile;
    const updatedPrompt = buildSystemPrompt({
      commonsResults,
      tools: relevant?.tools,
      stories: relevant?.stories,
      networkEntries: relevant?.networkEntries,
      mode: currentMode,
      connectedServiceGuidance: serviceGuidance,
      projectFiles,
      studio: activeStudio,
      builderProfile,
    });
    setSystemPrompt(updatedPrompt);

    // The studio frame travels with the project — record it in lineage
    if (activeStudio) {
      const { lineage, setLineage } = useProjectStore.getState();
      if (lineage?.studioSlug !== activeStudio.slug) {
        setLineage({
          ...(lineage ?? { source: null }),
          studioSlug: activeStudio.slug,
          studioLabel: activeStudio.label,
        });
      }
    }

    addUserMessage(content, attachments);

    // Build messages array including the new user message (with any images)
    const newUserContent = attachments?.length
      ? [
          { type: 'text' as const, text: content },
          ...attachments.map(url => ({ type: 'image_url' as const, image_url: { url } })),
        ]
      : content;
    const chatMessages = [
      ...toChatMessages(),
      { role: 'user' as const, content: newUserContent },
    ];

    const msgId = startAssistantMessage(currentMode === 'plan');
    const controller = new AbortController();
    setAbortController(controller);
    setIsGenerating(true);

    try {
      await provider.chat(
        chatMessages,
        activeModelId,
        {
          onToken: (token) => appendToMessage(msgId, token),
          onComplete: () => {
            finalizeMessage(msgId);
            // Extract code blocks into the virtual file system (build mode only)
            if (currentMode === 'build') {
              const msg = useChatStore.getState().messages.find(m => m.id === msgId);
              if (msg) {
                applyMessageFiles(msg.content, msgId);
                // Surface edits that couldn't be applied cleanly
                const warnings = useProjectStore.getState().lastApplyWarnings;
                if (warnings.length > 0) {
                  appendToMessage(msgId, `\n\n> ⚠️ ${warnings.join(' ')}`);
                }
              }
            }
            setIsGenerating(false);
            setAbortController(null);
          },
          onError: (error) => {
            appendToMessage(msgId, `\n\n**Error:** ${error.message}`);
            finalizeMessage(msgId);
            setIsGenerating(false);
            setAbortController(null);
          },
        },
        controller.signal,
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : String(err);
        appendToMessage(msgId, `\n\n**Error:** ${msg}`);
        finalizeMessage(msgId);
        setIsGenerating(false);
        setAbortController(null);
      }
    }
  }, [
    provider, activeModelId, addUserMessage, toChatMessages,
    startAssistantMessage, appendToMessage, finalizeMessage,
    setIsGenerating, setAbortController, applyMessageFiles,
    getRelevantContext, setSystemPrompt,
  ]);

  // Messages queued from elsewhere in the app (e.g. the preview's
  // "Ask AI to fix it" button) — always run as build-mode requests.
  const queuedMessage = useChatStore(s => s.queuedMessage);
  useEffect(() => {
    if (!queuedMessage || isGenerating) return;
    useChatStore.getState().clearQueuedMessage();
    setMode('build');
    handleSend(queuedMessage);
  }, [queuedMessage, isGenerating, setMode, handleSend]);

  const handleBuildPlan = useCallback(() => {
    setMode('build');
    handleSend(
      'Build the app described in the plan above. Generate complete, working files with filename annotations, following the plan\'s features, pages, and data decisions.',
    );
  }, [setMode, handleSend]);

  const handleStop = useCallback(() => {
    const controller = useChatStore.getState().abortController;
    controller?.abort();
    setIsGenerating(false);
    setAbortController(null);
    // Finalize any streaming message
    const msgs = useChatStore.getState().messages;
    const streaming = msgs.find(m => m.isStreaming);
    if (streaming) finalizeMessage(streaming.id);
  }, [setIsGenerating, setAbortController, finalizeMessage]);

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <HomeDashboard onSelectIdea={handleSend} disabled={!!needsKey} />
      ) : (
        <MessageList messages={messages} onBuildPlan={handleBuildPlan} isGenerating={isGenerating} />
      )}
      {needsKey && (
        <div className="px-4 py-2 text-xs text-center text-muted-foreground bg-muted/50 border-t">
          Add your API key in Settings to start building
        </div>
      )}
      <MessageInput
        onSend={handleSend}
        onStop={handleStop}
        isGenerating={isGenerating}
        disabled={needsKey}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
}
