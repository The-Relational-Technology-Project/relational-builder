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
import { loadGalleryReferences } from '@/cloud/gallery-references';
import { detectFrames, framesFromSlugs } from '@/knowledge/frames';
import { buildMentionContext } from '@/knowledge/mentions';
import { runQualityReview, messageProducedFiles } from '@/knowledge/review-pass';
import { requestBuildNotifyPermission, notifyBuildReady } from '@/notify/build-ready';
import { recordBuildEvent, useBuildLogStore } from '@/report/build-log';
import { BuildReportCard } from './BuildReportCard';
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

/** How many automatic continuations a single build may chain. Long first
 *  builds (10+ pages) routinely need 2; the cap only exists so a pathological
 *  reply can't spend money forever. */
const MAX_CONTINUATIONS = 3;

/** Sent whenever a build reply was cut off — by the output cap or a dropped
 *  stream. Asks for the files, not a post-mortem: continuation replies used
 *  to open with paragraphs of diagnosis the person had to watch stream by. */
const CONTINUE_PROMPT =
  'Your previous reply was interrupted mid-stream, likely mid-file. Continue the build: first re-output the file that was cut off — complete, from its first line — then every file you had planned but not yet written. Do not repeat files that were already complete. Skip any explanation of the interruption: one short line saying you\'re continuing, then the files.';

/** Shown once per project when free community building steps down to the
 *  edit model — the model picker must never change behind anyone's back */
const EDIT_MODEL_NOTE =
  'Quick edits now run on **Claude Sonnet 5** — fast, sharp, and lighter on the shared community budget. Making a bigger change? Pick Claude Opus 4.8 in the model menu and it will stick for this project.';
const EDIT_MODEL_NOTE_LABEL = 'Model note · from Relational Builder';

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
      // The reply was also cut off mid-file — finish it through the
      // continuation channel (bounded by MAX_CONTINUATIONS, so it can't loop)
      useChatStore.getState().queueContinuation(CONTINUE_PROMPT, 'Finishing the build');
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
    const wasContinuation = useChatStore.getState().pendingContinuationSend;
    useChatStore.setState({
      pendingFixSend: false,
      pendingFixLabel: null,
      pendingContinuationSend: false,
    });
    // A fresh ask from the person starts a fresh chain
    if (!wasFix) {
      useChatStore.setState({ continuationCount: 0, chainFirstBuildAsk: null });
    }

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
          useChatStore.getState().addSyncMessage(EDIT_MODEL_NOTE, EDIT_MODEL_NOTE_LABEL);
        }
      }
    }

    // A project's initial build starts a fresh build log — the timeline that
    // becomes a shareable report if the builder opts in when it's done
    if (isFirstBuild && !wasFix) {
      useBuildLogStore.getState().reset();
      recordBuildEvent(
        'build_start',
        `${useProviderStore.getState().activeProviderId} · ${modelForSend}`,
      );
    }

    // Retrieval: hybrid semantic+text search against the RT Commons (the
    // canonical knowledge base), falling back to local TF-IDF scoring of the
    // Studio KB when the commons is unreachable.
    const [commonsResults, references, galleryReferences] = await Promise.all([
      searchCommons(content),
      buildMentionContext(content),
      // Connections between entries — cached for the session; lets the AI
      // say where else a surfaced tool or practice showed up
      loadGalleryReferences(),
    ]);
    const relevant = commonsResults.length > 0 ? null : getRelevantContext(content);
    const envVars = useEnvStore.getState().vars;
    const connectedServices = getConnectedIntegrations(envVars);
    const serviceGuidance = connectedServices.map(s => s.aiGuidance);
    if (communityCloudConnected(envVars)) serviceGuidance.unshift(COMMUNITY_CLOUD_GUIDANCE);
    const projectFiles = useProjectStore.getState().getAllFiles()
      .map(f => ({ path: f.path, content: f.content }));
    const activeStudio = useStudioStore.getState().activeStudio;
    // The active studio's approved shelf — RLS already scoped the loaded
    // library to what this builder may see; pending offers stay out of the
    // AI's context until an admin approves them
    const studioLibraryItems = activeStudio
      ? useStudioStore.getState().library.filter(
          i => i.studio_slug === activeStudio.slug && i.status === 'approved',
        )
      : [];
    const builderProfile = useAuthStore.getState().profile;

    // Domain frames: the project's own (stamped at remix or on a prior turn)
    // plus any sensed from what retrieval just surfaced — no mode switch,
    // the commons answering with civic media entries is the signal itself
    const lineageFrameSlugs = useProjectStore.getState().lineage?.frames ?? [];
    const sensedFrames = detectFrames(commonsResults);
    const frameSlugs = [...new Set([...lineageFrameSlugs, ...sensedFrames.map(f => f.slug)])];
    const frames = framesFromSlugs(frameSlugs);

    const updatedPrompt = buildSystemPrompt({
      commonsResults,
      tools: relevant?.tools,
      stories: relevant?.stories,
      networkEntries: relevant?.networkEntries,
      mode: currentMode,
      connectedServiceGuidance: serviceGuidance,
      projectFiles,
      studio: activeStudio,
      studioLibraryItems,
      frames,
      builderProfile,
      references,
      galleryReferences,
    });
    setSystemPrompt(updatedPrompt);

    // The studio frame travels with the project — record it in lineage,
    // along with any newly sensed domain frames so they persist across turns
    {
      const { lineage, setLineage } = useProjectStore.getState();
      const studioChanged = activeStudio && lineage?.studioSlug !== activeStudio.slug;
      const framesChanged = frameSlugs.length !== lineageFrameSlugs.length;
      if (studioChanged || framesChanged) {
        setLineage({
          ...(lineage ?? { source: null }),
          ...(activeStudio ? { studioSlug: activeStudio.slug, studioLabel: activeStudio.label } : {}),
          ...(frameSlugs.length > 0 ? { frames: frameSlugs } : {}),
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
            // Extract code blocks into the virtual file system (build mode only)
            if (currentMode === 'build') {
              const msg = useChatStore.getState().messages.find(m => m.id === msgId);
              if (msg) {
                // Cut off — by the output cap (finish_reason "length") or by a
                // stream that died mid-file (proxy wall-clock limit, network
                // drop). A killed stream never reports a finish reason at all,
                // so the unterminated code fence is the tell.
                const truncated =
                  finishReason === 'length' || endsInsideCodeFence(msg.content);
                if (truncated) {
                  recordBuildEvent(
                    'reply_cut_off',
                    finishReason === 'length'
                      ? 'output length cap'
                      : 'stream died mid-file (no finish signal)',
                  );
                }
                applyMessageFiles(msg.content, msgId);
                // A cut-off first build isn't "ready" — hold its notification
                // and quality review until the continuation chain lands
                if (truncated && isFirstBuild && messageProducedFiles(msg.content)) {
                  useChatStore.setState({ chainFirstBuildAsk: content });
                }
                // Surface edits that couldn't be applied cleanly
                const warnings = useProjectStore.getState().lastApplyWarnings;
                if (warnings.length > 0) {
                  appendToMessage(msgId, `\n\n> ⚠️ ${warnings.join(' ')}`);
                  recordBuildEvent('apply_warnings', warnings.join(' '));
                }
                if (truncated && useChatStore.getState().continuationCount < MAX_CONTINUATIONS) {
                  // Continue through the fix channel. Truncated continuations
                  // keep chaining (big builds routinely need more than one
                  // extra reply); MAX_CONTINUATIONS bounds the spend.
                  appendToMessage(msgId, '\n\n> ⚠️ That reply was cut off mid-file — asking for the rest automatically.');
                  useChatStore.getState().queueContinuation(CONTINUE_PROMPT, 'Finishing the build');
                  recordBuildEvent(
                    'auto_continuation',
                    `pass ${useChatStore.getState().continuationCount} of ${MAX_CONTINUATIONS}`,
                  );
                } else if (truncated) {
                  appendToMessage(msgId, '\n\n> ⚠️ Cut off again — this build is unusually large. Say "continue" to keep it going.');
                  recordBuildEvent('continuation_cap');
                } else {
                  // This reply finished clean — the build (or its chain) is done.
                  const chainAsk = useChatStore.getState().chainFirstBuildAsk;
                  // Arm exactly one automatic error→fix pass after normal
                  // builds and completed continuation chains — never after an
                  // error fix itself, so error→fix can't loop
                  useChatStore.setState({
                    autoFixArmed: !wasFix || wasContinuation,
                    continuationCount: 0,
                    chainFirstBuildAsk: null,
                  });
                  // The ask this reply completes, when it's a project's first
                  // build — directly, or via the chain that started as one
                  const firstBuildAsk =
                    !wasFix && isFirstBuild ? content : wasContinuation ? chainAsk : null;
                  if (firstBuildAsk && messageProducedFiles(msg.content)) {
                    recordBuildEvent('build_ready');
                    // The initial build is done — offer (once, per project) to
                    // share its story with the stewards. Consent-first: the
                    // report is only assembled if the builder says yes.
                    useBuildLogStore.getState().setOffer('pending');
                    // The one notification we ever send: first build ready, tab hidden
                    notifyBuildReady(useCloudStore.getState().currentProjectName ?? undefined);
                    // One background quality review, ONLY on the first build:
                    // that's where a whole-codebase review matches the request.
                    // Later builds are incremental, and reviewing everything
                    // against a small ask re-surfaces pre-existing issues.
                    // (Thrown errors win the race; fix sends are never
                    // reviewed, so neither can loop.)
                    runQualityReview(firstBuildAsk);
                    // First build landed on the community key: step the
                    // default down to Sonnet 5 for the edits ahead — visibly,
                    // with a note, so the model picker never changes behind
                    // anyone's back.
                    const autoModel = resolveCommunityModelDefault(
                      useProjectStore.getState().getFileCount(),
                    );
                    if (autoModel === COMMUNITY_EDIT_MODEL) {
                      useProviderStore.getState().setActiveModel(autoModel);
                      useChatStore.getState().addSyncMessage(EDIT_MODEL_NOTE, EDIT_MODEL_NOTE_LABEL);
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
      'Build the app described in the plan above. Generate complete, working files with filename annotations, following the plan\'s features, look & feel, pages, and data decisions.',
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
      {!isGenerating && <BuildReportCard />}
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
