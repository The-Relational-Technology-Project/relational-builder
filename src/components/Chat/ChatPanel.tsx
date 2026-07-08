import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractOperations } from '@/project/code-extractor';
import { RotateCcw, X } from 'lucide-react';
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
import {
  useCommunityStore,
  resolveCommunityModelDefault,
  COMMUNITY_EDIT_MODEL,
} from '@/store/community-store';
import { useStudioStore } from '@/store/studio-store';
import { useAuthStore, cloudEnabled } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { searchCommons } from '@/knowledge/commons-search';
import { buildMentionContext } from '@/knowledge/mentions';
import { runQualityReview, messageProducedFiles } from '@/knowledge/review-pass';
import { requestBuildNotifyPermission, notifyBuildReady } from '@/notify/build-ready';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Button } from '@/components/ui/button';
import { HomeDashboard } from '@/components/HomeDashboard';
import { GitHubChangesBanner } from '@/components/GitHubChangesBanner';
import { CommunityBudgetBanner } from '@/components/CommunityBudgetBanner';

/** An unterminated fence means the reply was cut off mid-file */
function endsInsideCodeFence(content: string): boolean {
  return content.split('\n').filter(l => l.startsWith('```')).length % 2 === 1;
}

/** Shown once per project when free community building steps down to the
 *  edit model — the model picker must never change behind anyone's back */
const EDIT_MODEL_NOTE =
  'Quick edits now run on **Claude Sonnet 5** — fast, sharp, and lighter on the shared community budget. Making a bigger change? Pick Claude Opus 4.8 in the model menu and it will stick for this project.';

/**
 * A build reply whose files never reached the project — the tab reloaded or
 * the network dropped mid-generation, so the extraction in onComplete never
 * ran. The chat text survives (it persists per-token); the files don't. Offer
 * one tap to recover them instead of leaving a finished-looking reply next to
 * an empty preview.
 */
function BuildRecovery() {
  const messages = useChatStore(s => s.messages);
  const checkpoints = useProjectStore(s => s.checkpoints);
  const version = useProjectStore(s => s.version);
  const [dismissedId, setDismissedId] = useState<string | null>(
    () => localStorage.getItem('rb-recovery-dismissed'),
  );

  const last = messages[messages.length - 1];
  const candidate = useMemo(() => {
    if (!last || last.role !== 'assistant' || last.isStreaming || last.isPlan) return null;
    if (dismissedId === last.id) return null;
    // Applied builds leave a checkpoint stamped with the message id
    if (checkpoints.some(c => c.msgId === last.id)) return null;
    const { writes } = extractOperations(last.content);
    if (writes.length === 0) return null;
    // Cloud-synced projects carry files but not checkpoints — if every file
    // already matches the project, there is nothing to recover
    const fs = useProjectStore.getState().fs;
    const missing = writes.filter(w => fs.getFile(w.path)?.content !== w.content);
    if (missing.length === 0) return null;
    return { msgId: last.id, content: last.content, fileCount: writes.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, checkpoints, dismissedId, version]);

  if (!candidate) return null;

  const recover = () => {
    useProjectStore.getState().applyMessageFiles(candidate.content, candidate.msgId);
    if (endsInsideCodeFence(candidate.content)) {
      // The reply was also cut off mid-file — finish it through the fix
      // channel (fix sends never re-arm anything, so this can't loop)
      useChatStore.getState().queueFix(
        'Your previous reply was interrupted, likely mid-file. Re-output the file that was cut off — complete, from its first line — plus any files you had planned but not yet written. Do not repeat files that were already complete.',
        'Finishing the build',
      );
    }
  };

  const dismiss = () => {
    localStorage.setItem('rb-recovery-dismissed', candidate.msgId);
    setDismissedId(candidate.msgId);
  };

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
      <p className="text-sm flex-1">
        That build was interrupted before its files reached your project.
      </p>
      <Button size="sm" variant="outline" onClick={recover} className="shrink-0">
        <RotateCcw className="size-3.5 mr-1.5" />
        Recover {candidate.fileCount} {candidate.fileCount === 1 ? 'file' : 'files'}
      </Button>
      <button
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

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
    // Fix requests (auto or manual) never re-arm the automatic pass. They ride
    // as a user turn so the model acts on them, but render as a Builder note —
    // not the person's own chat bubble — via the captured label.
    const wasFix = useChatStore.getState().pendingFixSend;
    const fixLabel = useChatStore.getState().pendingFixLabel;
    useChatStore.setState({ pendingFixSend: false, pendingFixLabel: null });

    // First build of a project: ask (once) to notify when it's ready — long
    // builds shouldn't require babysitting a spinner
    const isFirstBuild =
      currentMode === 'build' && useProjectStore.getState().getFileCount() === 0;
    if (isFirstBuild) requestBuildNotifyPermission();

    // Free community building: Opus 4.8 does the first build, Sonnet 5 the
    // edits — unless the person picked a model themselves. Fix sends stay on
    // whatever model is active (a continuation must finish what it started).
    let modelForSend = activeModelId;
    if (!wasFix) {
      const autoModel = resolveCommunityModelDefault(
        useProjectStore.getState().getFileCount(),
      );
      if (autoModel) {
        modelForSend = autoModel;
        useProviderStore.getState().setActiveModel(autoModel);
        // Stepping down at send time only happens when the post-build switch
        // couldn't (e.g. a truncated first build finished via continuation) —
        // same transparency either way
        if (autoModel === COMMUNITY_EDIT_MODEL) {
          useChatStore.getState().addSyncMessage(EDIT_MODEL_NOTE);
        }
      }
    }

    // Retrieval: hybrid semantic+text search against the RT Commons (the
    // canonical knowledge base), falling back to local TF-IDF scoring of the
    // Studio KB when the commons is unreachable.
    const [commonsResults, references] = await Promise.all([
      searchCommons(content),
      buildMentionContext(content),
    ]);
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
      references,
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

    addUserMessage(content, attachments, wasFix ? { label: fixLabel ?? 'Automatic fix' } : undefined);

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
    useChatStore.getState().beginProgress();
    let finishReason: string | null = null;
    let sawToken = false;

    try {
      await provider.chat(
        chatMessages,
        modelForSend,
        {
          onToken: (token) => {
            if (!sawToken) {
              sawToken = true;
              useChatStore.getState().progressWriting();
            }
            appendToMessage(msgId, token);
          },
          onReasoning: (text) => useChatStore.getState().progressReasoning(text),
          onRetry: () =>
            useChatStore.getState().progressNotice(
              'Lots of building happening right now — retrying automatically, hang tight…',
            ),
          onFinishReason: (reason) => { finishReason = reason; },
          onComplete: () => {
            useChatStore.getState().endProgress();
            finalizeMessage(msgId);
            // The reply hit the output cap mid-file — ask for the rest once,
            // through the fix channel (fix sends never re-arm, so no loop)
            const truncated = finishReason === 'length';
            // Extract code blocks into the virtual file system (build mode only)
            if (currentMode === 'build') {
              const msg = useChatStore.getState().messages.find(m => m.id === msgId);
              if (msg) {
                applyMessageFiles(msg.content, msgId);
                // The one notification we ever send: first build ready, tab hidden
                if (isFirstBuild && messageProducedFiles(msg.content)) {
                  notifyBuildReady(useCloudStore.getState().currentProjectName ?? undefined);
                }
                // Surface edits that couldn't be applied cleanly
                const warnings = useProjectStore.getState().lastApplyWarnings;
                if (warnings.length > 0) {
                  appendToMessage(msgId, `\n\n> ⚠️ ${warnings.join(' ')}`);
                }
                if (truncated && !wasFix) {
                  appendToMessage(msgId, '\n\n> ⚠️ That reply hit the length limit — asking for the rest automatically.');
                  useChatStore.getState().queueFix(
                    'Your previous reply was cut off by the output limit, likely mid-file. Re-output the file that was cut off — complete, from its first line — plus any files you had planned but not yet written. Do not repeat files that were already complete.',
                    'Finishing the build',
                  );
                } else {
                  // Arm exactly one automatic error→fix pass after normal builds
                  useChatStore.setState({ autoFixArmed: !wasFix });
                  // …and one background quality review, but ONLY on the very
                  // first build of a project. Later builds are incremental: the
                  // reviewer reads the whole codebase against just the current
                  // (often small) ask, so it re-surfaces pre-existing issues
                  // from old files every time — reading as "reviewing stale code
                  // / re-raising things already addressed." First build is where
                  // the whole-codebase review actually matches the request.
                  // (Thrown errors win the race; fix sends are never reviewed,
                  // so neither can loop.)
                  if (!wasFix && isFirstBuild && messageProducedFiles(msg.content)) {
                    runQualityReview(content);
                  }
                  // First build landed on the community key: step the default
                  // down to Sonnet 5 for the edits ahead — visibly, with a
                  // note, so the model picker never changes behind anyone's
                  // back. (Truncated builds wait: their continuation must
                  // finish on the model that started it.)
                  if (isFirstBuild && messageProducedFiles(msg.content)) {
                    const autoModel = resolveCommunityModelDefault(
                      useProjectStore.getState().getFileCount(),
                    );
                    if (autoModel === COMMUNITY_EDIT_MODEL) {
                      useProviderStore.getState().setActiveModel(autoModel);
                      useChatStore.getState().addSyncMessage(EDIT_MODEL_NOTE);
                    }
                  }
                }
              }
            }
            setIsGenerating(false);
            setAbortController(null);
            // Keep the budget picture honest after every generation
            if (useCommunityStore.getState().active) void useCommunityStore.getState().check();
          },
          onError: (error) => {
            useChatStore.getState().endProgress();
            appendToMessage(msgId, `\n\n**Error:** ${error.message}`);
            finalizeMessage(msgId);
            setIsGenerating(false);
            setAbortController(null);
            if (useCommunityStore.getState().active) void useCommunityStore.getState().check();
          },
        },
        controller.signal,
      );
    } catch (err) {
      useChatStore.getState().endProgress();
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

  // Messages queued while the AI was busy: error fixes always run in build
  // mode; a person's queued follow-up keeps whatever mode they were in.
  const queuedMessage = useChatStore(s => s.queuedMessage);
  useEffect(() => {
    if (!queuedMessage || isGenerating) return;
    const wasFix = useChatStore.getState().pendingFixSend;
    useChatStore.getState().clearQueuedMessage();
    if (wasFix) setMode('build');
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
    useChatStore.getState().endProgress();
    setIsGenerating(false);
    setAbortController(null);
    // Finalize any streaming message
    const msgs = useChatStore.getState().messages;
    const streaming = msgs.find(m => m.isStreaming);
    if (streaming) finalizeMessage(streaming.id);
  }, [setIsGenerating, setAbortController, finalizeMessage]);

  const composerProps = {
    onSend: handleSend,
    onStop: handleStop,
    isGenerating,
    disabled: needsKey,
    mode,
    onModeChange: setMode,
  };

  // Home: the composer is the hero, embedded in the dashboard.
  // Building: it's the chat input, pinned below the conversation.
  // A project opened with files but no chat yet is still "building".
  const fileCount = useProjectStore(s => s.getFileCount());
  const authUser = useAuthStore(s => s.user);
  // Someone who just passed the invitation gate needs sign-in, not an API
  // key — signing in enrolls them in free community building automatically
  const signInIsTheDoor = !!needsKey && cloudEnabled && !authUser;

  const needsKeyHint = signInIsTheDoor ? (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={() => useAuthStore.getState().promptSignIn()}
        className="h-11 rounded-full px-8 text-sm font-semibold w-full sm:w-auto"
      >
        Sign in to start building
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        Free building is part of your invitation
      </p>
    </div>
  ) : needsKey ? (
    <p className="text-xs text-center text-muted-foreground">
      Add your API key in Settings to start building
    </p>
  ) : null;

  if (messages.length === 0 && fileCount === 0) {
    return (
      <div className="flex flex-col h-full">
        <HomeDashboard
          composer={
            <div className="space-y-2">
              <CommunityBudgetBanner />
              <MessageInput {...composerProps} variant="hero" />
              {needsKeyHint}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} onBuildPlan={handleBuildPlan} isGenerating={isGenerating} />
      {!isGenerating && <GitHubChangesBanner />}
      {!isGenerating && <BuildRecovery />}
      {!isGenerating && <CommunityBudgetBanner />}
      {needsKey && (
        <div className="px-4 py-2 text-xs text-center bg-muted/50 border-t">
          {needsKeyHint}
        </div>
      )}
      <MessageInput {...composerProps} />
    </div>
  );
}
