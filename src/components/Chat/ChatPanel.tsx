import { useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { buildSystemPrompt } from '@/knowledge/context-builder';
import { registry } from '@/providers/registry';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

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

  const provider = registry.getProvider(activeProviderId);
  const needsKey = registry.getEntry(activeProviderId)?.requiresApiKey && !apiKeys[activeProviderId];

  const handleSend = useCallback(async (content: string) => {
    if (!provider) return;

    // RAG: score KB items against the user's message and rebuild system prompt
    const relevant = getRelevantContext(content);
    const updatedPrompt = buildSystemPrompt({
      tools: relevant.tools,
      stories: relevant.stories,
      networkEntries: relevant.networkEntries,
    });
    setSystemPrompt(updatedPrompt);

    addUserMessage(content);

    // Build messages array including the new user message
    const chatMessages = [
      ...toChatMessages(),
      { role: 'user' as const, content },
    ];

    const msgId = startAssistantMessage();
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
            // Extract code blocks into the virtual file system
            const msg = useChatStore.getState().messages.find(m => m.id === msgId);
            if (msg) applyMessageFiles(msg.content);
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
        <WelcomeScreen onSelectIdea={handleSend} disabled={!!needsKey} />
      ) : (
        <MessageList messages={messages} />
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
      />
    </div>
  );
}

const STARTER_IDEAS = [
  { label: 'Neighborhood event calendar', prompt: 'Build me a neighborhood event calendar where community members can post and discover local events, with categories for block parties, meetings, cleanups, and gatherings.' },
  { label: 'Mutual aid request board', prompt: 'Build a mutual aid request board where neighbors can post needs and offers — things like rides, meals, childcare, tool lending — with a simple claim system.' },
  { label: 'Community resource directory', prompt: 'Build a community resource directory that maps local organizations, services, and mutual aid networks with search and category filters.' },
  { label: 'Local civic info hub', prompt: 'Build a local civic information hub where residents can find meeting schedules, elected officials, zoning updates, and community announcements.' },
];

function WelcomeScreen({ onSelectIdea, disabled }: { onSelectIdea: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Build relational technology
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Describe what you want to build and AI will generate working code,
          informed by principles and patterns from the Relational Tech community.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-2">
          {STARTER_IDEAS.map(idea => (
            <button
              key={idea.label}
              className="text-left text-xs border rounded-lg p-3 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onSelectIdea(idea.prompt)}
              disabled={disabled}
            >
              {idea.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
