import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractOperations } from '@/project/code-extractor';
import { RotateCcw, X, Undo2, Check } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { usePreviewHealthStore } from '@/store/preview-health-store';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { buildSystemPrompt } from '@/knowledge/context-builder';
import { registry } from '@/providers/registry';
import { CLAUDE_MODELS } from '@/providers/claude';
import { shortModelName } from '@/providers/model-label';
import { useEnvStore } from '@/store/env-store';
import {
  getConnectedIntegrations,
  communityCloudConnected,
  COMMUNITY_CLOUD_GUIDANCE,
  RESEND_CLOUD_GUIDANCE,
  AI_CLOUD_GUIDANCE,
} from '@/integrations/catalog';
import { reconcileCloudSchema } from '@/cloud/schema-sync';
import { applySupabaseChanges, supabaseManaged } from '@/cloud/supabase-admin';
import { SUPABASE_MANAGED_GUIDANCE } from '@/integrations/supabase-managed-guidance';
import {
  useCommunityStore,
  resolveCommunityModelDefault,
  COMMUNITY_EDIT_MODEL,
  COMMUNITY_FIRST_BUILD_MODEL,
  type CommunityModelStage,
} from '@/store/community-store';
import { useStudioStore } from '@/store/studio-store';
import { useAuthStore } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { retrieveCommonsContext, findMentionedResults } from '@/knowledge/retrieval';
import { loadGalleryReferences } from '@/cloud/gallery-references';
import { detectFrames, framesFromSlugs } from '@/knowledge/frames';
import { buildMentionContext } from '@/knowledge/mentions';
import { retrieveCivicDataContext } from '@/knowledge/civic-data';
import { runQualityReview, messageProducedFiles } from '@/knowledge/review-pass';
import { requestBuildNotifyPermission, notifyBuildReady } from '@/notify/build-ready';
import { recordBuildEvent, useBuildLogStore } from '@/report/build-log';
import { resetSubmitTracking } from '@/report/friction';
import { BuildReportCard } from './BuildReportCard';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useNeedsKey, NeedsKeyHint } from './composer-gate';
import { Button } from '@/components/ui/button';
import { HomeDashboard } from '@/components/HomeDashboard';
import { RemoteChangesBanner } from '@/components/RemoteChangesBanner';
import { CommunityBudgetBanner } from '@/components/CommunityBudgetBanner';

/** An unterminated fence means the reply was cut off mid-file */
function endsInsideCodeFence(content: string): boolean {
  return content.split('\n').filter(l => l.startsWith('```')).length % 2 === 1;
}

/** How many automatic continuations a single build may chain. Deliberately
 *  chunked builds (NEXT-FILES) trade longer chains for never dying mid-file —
 *  at ~350–400 lines per chunk a 24-file build legitimately needs 5+ passes;
 *  the cap only exists so a pathological reply can't spend money forever. */
const MAX_CONTINUATIONS = 6;

/** A stream that goes completely silent for this long is dead — abort it and
 *  route through the truncation machinery instead of leaving the builder
 *  staring at a stuck spinner (a real build once sat 12 minutes like that). */
const STALL_TIMEOUT_MS = 150_000;

/** Sent whenever a build reply was cut off — by the output cap or a dropped
 *  stream. Asks for the files, not a post-mortem: continuation replies used
 *  to open with paragraphs of diagnosis the person had to watch stream by.
 *  Grounded in the project's actual state: "which files are done" can't ride
 *  on the model's memory of its own truncated reply — a real build once
 *  skipped App.tsx that way and spent an extra fix pass recovering it. */
function continuePrompt(planned = false): string {
  const base = planned
    ? 'Continue the build with the remaining files you listed. Do not repeat files that are already complete. Skip any preamble: one short line saying you\'re continuing, then the files.'
    : 'Your previous reply was interrupted mid-stream, likely mid-file. Continue the build: first re-output the file that was cut off — complete, from its first line — then every file you had planned but not yet written. Do not repeat files that were already complete. Skip any explanation of the interruption: one short line saying you\'re continuing, then the files.';
  const applied = useProjectStore.getState().getAllFiles().map(f => f.path);
  if (applied.length === 0) return base;
  return `${base}\n\nThese files are already complete in the project (do not re-output them): ${applied.join(', ')}. Every other file your plan calls for${planned ? '' : ' — including the one that was cut off —'} is NOT in the project yet and must be written now.`;
}

/** A deliberately chunked build reply ends with this marker line (the system
 *  prompt teaches it). Streams through the community proxy get killed by a
 *  ~400s wall clock — two real builds died mid-file at exactly +6:42 — so
 *  large builds now stop cleanly between files and continue on purpose,
 *  instead of streaming into the wall and paying a mid-file recovery. */
const CHUNK_MARKER = /^NEXT-FILES:\s*(\S.*)$/m;

/** Shown whenever free community building changes the model automatically —
 *  the model picker must never change behind anyone's back. The copy has to
 *  match what actually happened: a first-build switch means the community
 *  default took over from an unpinned leftover model (so it names that model
 *  and the way back to it), while an edit switch is the step-down after a
 *  finished build. The "pick the bigger model" suggestion only appears when
 *  the two stage models actually differ — with both slots on Opus 5 it once
 *  told people "edits run on Opus 5 — making a bigger change? Pick Opus 5."
 *
 *  All model names are DERIVED, never written out here. This note previously
 *  hardcoded "Claude Opus 4.8" and went on claiming it long after the code had
 *  moved to Opus 5 — a sentence that only appears when a constant changes is
 *  exactly the sentence that will be stale when it finally shows up. */
function communityModelNote(stage: CommunityModelStage, movedOff: string): string {
  // Named the way the model menu names them — "Opus 5", not "Claude Opus 5"
  const name = (id: string) =>
    shortModelName(CLAUDE_MODELS.find(m => m.id === id)?.name ?? id);
  if (stage === 'first-build') {
    return `This build runs on **${name(COMMUNITY_FIRST_BUILD_MODEL)}** — the community default for first builds, chosen for the most complete first version. Rather build with ${name(movedOff)}? Pick it in the model menu and it will stick for this project.`;
  }
  const stepUp =
    COMMUNITY_FIRST_BUILD_MODEL === COMMUNITY_EDIT_MODEL
      ? ''
      : ` Making a bigger change? Pick ${name(COMMUNITY_FIRST_BUILD_MODEL)} in the model menu and it will stick for this project.`;
  return `Edits and fixes now run on **${name(COMMUNITY_EDIT_MODEL)}** — quick, dependable for day-to-day changes, and it keeps the shared community budget stretching further for everyone.${stepUp}`;
}
const MODEL_NOTE_LABEL = 'Model note · from Relational Builder';

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
      useChatStore.getState().queueContinuation(continuePrompt(), 'Finishing the build');
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

/**
 * A reply that ended in an error — a network drop, a provider hiccup — used
 * to just sit there as "**Error:** …" and quietly eat the person's ask (a
 * real build lost "add an app icon" that way). The errored reply never had
 * its files applied, so retrying loses nothing: remove the failed attempt
 * and resend the same ask. When the reply DID stream recoverable files,
 * BuildRecovery is the better offer, so this banner stands down.
 */
function RetryBanner({ onRetry }: { onRetry: (content: string, attachments?: string[]) => void }) {
  const messages = useChatStore(s => s.messages);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const last = messages[messages.length - 1];
  const ask = messages[messages.length - 2];
  const candidate = useMemo(() => {
    if (!last || last.role !== 'assistant' || !last.errored || last.isStreaming) return null;
    if (dismissedId === last.id) return null;
    // Only retry a person's own ask — auto sends (fixes, continuations) have
    // their own machinery and shouldn't re-run as a plain chat bubble
    if (!ask || ask.role !== 'user' || ask.isAuto) return null;
    // Recoverable files streamed before the error → BuildRecovery's territory
    if (extractOperations(last.content).writes.length > 0) return null;
    return { failedId: last.id, askId: ask.id, content: ask.content, attachments: ask.attachments };
  }, [last, ask, dismissedId]);

  if (!candidate) return null;

  const retry = () => {
    // Drop the failed attempt AND its ask — resending restores the ask, so
    // history doesn't carry a duplicate user turn
    useChatStore.setState(state => ({
      messages: state.messages.filter(
        m => m.id !== candidate.failedId && m.id !== candidate.askId,
      ),
    }));
    onRetry(candidate.content, candidate.attachments);
  };

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
      <p className="text-sm flex-1">
        That reply didn't make it through — usually just a network hiccup.
      </p>
      <Button size="sm" variant="outline" onClick={retry} className="shrink-0">
        <RotateCcw className="size-3.5 mr-1.5" />
        Try again
      </Button>
      <button
        onClick={() => setDismissedId(candidate.failedId)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Undo, where the thing being undone is still on screen.
 *
 * This lived in the header strip, which made it ambient and context-free —
 * "undo last change" in the far corner, with no sight of what the last change
 * was. Sitting under the conversation it reads as what it actually does: put
 * the files back the way they were before that reply. The confirmation lands
 * where the eye already is, too, instead of in the opposite corner.
 *
 * Quiet by construction: one muted line, and only when there's something to
 * go back to.
 */
function UndoLastChange() {
  const checkpoints = useProjectStore(s => s.checkpoints);
  const activeCheckpointId = useProjectStore(s => s.activeCheckpointId);
  const undoLastChange = useProjectStore(s => s.undoLastChange);
  const [undone, setUndone] = useState<string | null>(null);

  useEffect(() => {
    if (!undone) return;
    const t = setTimeout(() => setUndone(null), 4000);
    return () => clearTimeout(t);
  }, [undone]);

  // A stale activeCheckpointId (checkpoints are trimmed past MAX_CHECKPOINTS,
  // and it also survives a reload) resolves to findIndex === -1, which would
  // silently remove the undo affordance — the reassurance vanishing exactly
  // when someone has made enough changes to want it. Fall back to the newest.
  const foundIdx = activeCheckpointId
    ? checkpoints.findIndex(c => c.id === activeCheckpointId)
    : -1;
  const currentIdx = foundIdx >= 0 ? foundIdx : checkpoints.length - 1;
  const canUndo = currentIdx > 0;

  if (undone) {
    return (
      <div className="px-4 pb-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Check className="size-3 text-green-600 shrink-0" />
          <span className="truncate">Put back {undone}</span>
        </span>
      </div>
    );
  }

  if (!canUndo) return null;

  return (
    <div className="px-4 pb-1.5">
      <button
        onClick={() => {
          const label = undoLastChange();
          if (label) setUndone(label);
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
        title="Put the files back the way they were before the last change"
      >
        <Undo2 className="size-3" />
        Undo last change
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

  const applyMessageFiles = useProjectStore(s => s.applyMessageFiles);
  const getRelevantContext = useKnowledgeStore(s => s.getRelevantContext);
  const setSystemPrompt = useChatStore(s => s.setSystemPrompt);
  const mode = useChatStore(s => s.mode);
  const setMode = useChatStore(s => s.setMode);

  const provider = registry.getProvider(activeProviderId);
  // One shared answer to "can this composer reach a model" — the home hero
  // asks the same question through the same hook (composer-gate.tsx)
  const needsKey = useNeedsKey();

  const handleSend = useCallback(async (content: string, attachments?: string[]) => {
    // Mode is read fresh from the store: "Build this plan" flips it right before sending
    const currentMode = useChatStore.getState().mode;
    // Message mode is human-to-human: the note joins the conversation (and
    // syncs to collaborators with it) but no model is called — ever. Before
    // the provider guard on purpose: a note needs no provider.
    if (currentMode === 'message') {
      const { profile, user } = useAuthStore.getState();
      const author = profile?.display_name?.trim() || user?.email || undefined;
      useChatStore.getState().addCollabNote(content, author, attachments);
      return;
    }

    if (!provider) return;
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
    // A fresh ask from the person starts a fresh chain — and a fresh
    // error-fix attempt count (their change resets the diagnosis)
    if (!wasFix) {
      useChatStore.setState({
        continuationCount: 0,
        chainFirstBuildAsk: null,
        lastFixSignature: null,
        fixAttempts: 0,
      });
    }

    // First build of a project: ask (once) to notify when it's ready — long
    // builds shouldn't require babysitting a spinner
    const isFirstBuild =
      currentMode === 'build' && useProjectStore.getState().getFileCount() === 0;
    if (isFirstBuild) requestBuildNotifyPermission();

    // A first build "cooks": the chat hides its churn (streaming files,
    // cut-off notes, continuation and fix sends) behind one calm status line
    // until the whole chain lands and the preview stands. A person's own
    // fresh ask mid-cook opts back into the normal live view — their reply
    // must not vanish into the pot.
    if (!wasFix) {
      if (isFirstBuild) useChatStore.getState().startCooking();
      else useChatStore.getState().endCooking();
    }

    // Free community building: Opus 5 does builds and edits — unless the
    // person picked a model themselves. Fix sends stay on whatever model is
    // active (a continuation must finish what it started).
    let modelForSend = activeModelId;
    if (!wasFix) {
      const autoDefault = resolveCommunityModelDefault(
        useProjectStore.getState().getFileCount(),
      );
      if (autoDefault) {
        modelForSend = autoDefault.model;
        useProviderStore.getState().setActiveModel(autoDefault.model);
        // Every automatic switch is announced, with copy that matches its
        // stage: first-build (the default taking over from an unpinned
        // leftover) or edit (a step-down landing at send time because the
        // post-build switch couldn't — e.g. a truncated first build that
        // finished via continuation)
        useChatStore
          .getState()
          .addSyncMessage(communityModelNote(autoDefault.stage, activeModelId), MODEL_NOTE_LABEL);
      }
    }

    // A project's initial build starts a fresh build log — the timeline that
    // becomes a shareable report if the builder opts in when it's done. The
    // knowledge already gathered while planning carries over: the commons
    // shapes the plan more than the build, so wiping it here would erase the
    // influence from the very report meant to show it.
    if (isFirstBuild && !wasFix) {
      // Fresh project: the previous one's last submit must not read as a
      // duplicate here.
      resetSubmitTracking();
      useBuildLogStore.getState().startFirstBuild();
      recordBuildEvent(
        'build_start',
        `${useProviderStore.getState().activeProviderId} · ${modelForSend}`,
      );
    }

    // The person's message renders NOW — before retrieval. The searches
    // below can take seconds, and a send that doesn't appear until they
    // finish looks dropped. History is snapshotted first so retrieval and
    // the provider payload both see the conversation as it was.
    const priorMessages = useChatStore.getState().messages;
    addUserMessage(content, attachments, wasFix ? { label: fixLabel ?? 'Automatic fix' } : undefined);
    setIsGenerating(true);
    useChatStore.getState().beginProgress();

    // Retrieval: hybrid semantic+text search against the RT Commons (the
    // canonical knowledge base), governed by the policy in
    // knowledge/retrieval.ts — fix sends and preview-machinery turns skip
    // it, follow-up turns search the project's topic blended with the
    // message, and a measured relevance floor keeps noise out of the prompt.
    // Context enriches the send; it must never break one. The person's
    // message is already on screen — a retrieval failure falls back to an
    // uninformed send instead of stranding the composer mid-generation.
    const [retrieval, references, galleryReferences, civicData] = await Promise.all([
      retrieveCommonsContext({
        message: content,
        mode: currentMode === 'plan' ? 'plan' : 'build',
        isFixSend: wasFix,
        messages: priorMessages,
      }).catch(() => ({ results: [], query: null, dropped: 0 })),
      buildMentionContext(content).catch(() => []),
      // Connections between entries — cached for the session; lets the AI
      // say where else a surfaced tool or practice showed up
      loadGalleryReferences(),
      // Live civic data endpoints (Responsive Cities Network): matched when
      // the build's city shows up in the conversation or the builder's place
      retrieveCivicDataContext([
        content,
        ...priorMessages.slice(-10).map(m => m.content.slice(0, 2000)),
        useAuthStore.getState().profile?.neighborhood,
        useAuthStore.getState().profile?.neighborhood_description,
      ]),
    ]);
    if (civicData.length > 0) {
      recordBuildEvent('civic-data', `live city data in context: ${civicData.map(e => e.city).join(', ')}`);
    }
    const commonsResults = retrieval.results;
    if (retrieval.query !== null) {
      // The eval trail: what was searched, what survived the floor. A
      // deliberate empty ("kept 0/8") is a finding, not a failure.
      // Every kept entry, not just the top few — the report's provenance
      // section can only credit what the log names.
      recordBuildEvent(
        'retrieval',
        `"${retrieval.query.replace(/\s+/g, ' ').slice(0, 60)}" · kept ${commonsResults.length}/${commonsResults.length + retrieval.dropped}` +
          (commonsResults.length > 0
            ? ` (${commonsResults.map(r => `${r.slug}${r.similarity ? ` ${r.similarity.toFixed(2)}` : ''}`).join(', ')})`
            : ''),
      );
    }
    // Local TF-IDF over the Studio KB is the fallback for an UNREACHABLE
    // commons (zero raw hits — the live search always returns candidates).
    // A reachable search whose hits all fell below the relevance floor is a
    // deliberate empty: injecting TF-IDF noise instead would undo the floor.
    const relevant =
      retrieval.query !== null && commonsResults.length === 0 && retrieval.dropped === 0
        ? getRelevantContext(content)
        : null;
    const envVars = useEnvStore.getState().vars;
    const connectedServices = getConnectedIntegrations(envVars);
    // Resend via the Community Cloud vault (COMMUNITY_EMAIL marker) swaps the
    // serverless-function guidance for the capability-endpoint pattern
    const emailViaCloud = envVars.some(v => v.key === 'COMMUNITY_EMAIL' && v.value.trim());
    // Managed Supabase swaps the paste-this-SQL guidance for the
    // migrations-directory convention the auto-apply flow understands
    const sbManaged = supabaseManaged().managed;
    const aiMarkers: Record<string, string> = {
      claude: 'COMMUNITY_AI_ANTHROPIC', gemini: 'COMMUNITY_AI_GEMINI', openai: 'COMMUNITY_AI_OPENAI',
    };
    const serviceGuidance = connectedServices.map(s =>
      s.id === 'resend' && emailViaCloud ? RESEND_CLOUD_GUIDANCE :
      s.id === 'supabase' && sbManaged ? SUPABASE_MANAGED_GUIDANCE :
      aiMarkers[s.id] && envVars.some(v => v.key === aiMarkers[s.id] && v.value.trim()) ? AI_CLOUD_GUIDANCE :
      s.aiGuidance,
    );
    if (communityCloudConnected(envVars)) serviceGuidance.unshift(COMMUNITY_CLOUD_GUIDANCE);
    // Least-recently-touched first, not alphabetical: the snapshot is a
    // prompt-cache segment and caching matches on prefix, so whatever changed
    // this turn must sort last (see getFilesForPrompt). updatedAt rides along
    // so the content budget can keep the file they're working on.
    const projectFiles = useProjectStore.getState().getFilesForPrompt()
      .map(f => ({ path: f.path, content: f.content, updatedAt: f.updatedAt }));
    const activeStudio = useStudioStore.getState().activeStudio;
    // The active studio's approved shelf — RLS already scoped the loaded
    // library to what this builder may see; pending offers stay out of the
    // AI's context until an admin approves them
    const studioLibraryItems = activeStudio
      ? useStudioStore.getState().library
          .filter(i => i.studio_slug === activeStudio.slug && i.status === 'approved')
          // Stable order: this section sits in the cached prompt prefix, and
          // load-sequence-dependent ordering would silently invalidate it
          .sort((a, b) => a.id.localeCompare(b.id))
      : [];
    const builderProfile = useAuthStore.getState().profile;

    // Domain frames: the project's own (stamped at remix or on a prior turn)
    // plus any sensed from what retrieval just surfaced — no mode switch,
    // the commons answering with civic media entries is the signal itself
    const lineageFrameSlugs = useProjectStore.getState().lineage?.frames ?? [];
    const sensedFrames = detectFrames(commonsResults, content);
    const frameSlugs = [...new Set([...lineageFrameSlugs, ...sensedFrames.map(f => f.slug)])];
    const frames = framesFromSlugs(frameSlugs);

    // Anthropic server-side web tools ride Claude chats only — the model can
    // read pages the person links and search for current info
    const webTools = useProviderStore.getState().activeProviderId === 'claude';

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
      webTools,
      civicData,
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

    // The provider payload: fresh system prompt plus the window of history —
    // which already ends with the user message (and attachments) added above
    const chatMessages = toChatMessages();

    const msgId = startAssistantMessage(currentMode === 'plan');
    const controller = new AbortController();
    setAbortController(controller);
    let finishReason: string | null = null;
    let sawToken = false;

    // Bracket every generation in the build log — kind · provider · model on
    // the way in, kind · duration · outcome on the way out — so cut-offs,
    // errors, and fixes in the timeline are attributable to a specific reply
    const genKind = wasContinuation
      ? 'continuation'
      : wasFix
        ? (fixLabel === 'Quality review' ? 'quality fix' : 'error fix')
        : currentMode === 'plan' ? 'plan' : 'build';
    const genStartAt = Date.now();
    let genEnded = false;
    const endGen = (outcome: string) => {
      if (genEnded) return;
      genEnded = true;
      recordBuildEvent(
        'gen_end',
        `${genKind} · ${Math.round((Date.now() - genStartAt) / 1000)}s · ${outcome}`,
      );
    };
    recordBuildEvent(
      'gen_start',
      `${genKind} · ${useProviderStore.getState().activeProviderId} · ${modelForSend}`,
    );

    // Stall watchdog: streams can die silently mid-file with no finish signal
    // and no error. If nothing arrives for STALL_TIMEOUT_MS, abort — the
    // post-stream handling below salvages what streamed and continues.
    let lastActivity = Date.now();
    let stalledAbort = false;
    const watchdog = setInterval(() => {
      if (Date.now() - lastActivity > STALL_TIMEOUT_MS) {
        stalledAbort = true;
        controller.abort();
      }
    }, 10_000);

    try {
      await provider.chat(
        chatMessages,
        modelForSend,
        {
          onToken: (token) => {
            lastActivity = Date.now();
            if (!sawToken) {
              sawToken = true;
              useChatStore.getState().progressWriting();
            }
            appendToMessage(msgId, token);
          },
          onReasoning: () => {
            lastActivity = Date.now();
            useChatStore.getState().progressReasoning();
          },
          onRetry: () => {
            lastActivity = Date.now();
            useChatStore.getState().progressNotice(
              'Lots of building happening right now — retrying automatically, hang tight…',
            );
          },
          onFinishReason: (reason) => { finishReason = reason; },
          onComplete: () => {
            useChatStore.getState().endProgress();
            finalizeMessage(msgId);
            const done = useChatStore.getState().messages.find(m => m.id === msgId);
            // A stream that "completes" with nothing (a reply that silently
            // never came through): say so instead of leaving an empty bubble
            // the person has to ask about.
            if (done && !done.content.trim()) {
              useChatStore.getState().endCooking();
              appendToMessage(
                msgId,
                "**The reply didn't come through** — the stream ended without content. This is usually a hiccup upstream; please send that message again.",
              );
              endGen('empty — stream ended without content');
              recordBuildEvent('reply_cut_off', 'empty reply (stream ended without content)');
              setIsGenerating(false);
              setAbortController(null);
              if (useCommunityStore.getState().active) void useCommunityStore.getState().check();
              return;
            }
            // Close the commons loop: which surfaced entries did this reply
            // actually draw on? Chips make it visible; the log makes it
            // measurable alongside the 'retrieval' event that offered them.
            if (done && commonsResults.length > 0) {
              const drawnOn = findMentionedResults(done.content, commonsResults);
              if (drawnOn.length > 0) {
                useChatStore.getState().setCommonsRefs(
                  msgId,
                  drawnOn.map(r => ({ slug: r.slug, title: r.title, kind: r.kind })),
                );
                recordBuildEvent('commons_mentions', drawnOn.map(r => r.slug).join(', '));
              }
            }
            // Extract code blocks into the virtual file system (build mode only)
            if (currentMode === 'build') {
              const msg = done;
              if (msg) {
                // Cut off — by the output cap (finish_reason "length") or by a
                // stream that died mid-file (proxy wall-clock limit, network
                // drop). A killed stream never reports a finish reason at all,
                // so the unterminated code fence is the tell.
                const truncated =
                  finishReason === 'length' || endsInsideCodeFence(msg.content);
                // A deliberate chunk boundary: the reply ended cleanly but
                // declared remaining files (NEXT-FILES: …) — continue the
                // chain on purpose instead of treating the build as done
                const chunked = !truncated && CHUNK_MARKER.test(msg.content);
                if (truncated) {
                  recordBuildEvent(
                    'reply_cut_off',
                    finishReason === 'length'
                      ? 'output length cap'
                      : 'stream died mid-file (no finish signal)',
                  );
                }
                endGen(
                  truncated
                    ? finishReason === 'length'
                      ? 'cut off — output length cap'
                      : 'cut off mid-file — stream died with no finish signal'
                    : chunked
                      ? 'clean chunk boundary — more files declared'
                      : 'clean',
                );
                // The person's own ask names the restore point. Auto sends
                // (fixes, continuations) carry Builder text, not theirs — pass
                // nothing and let it fall back to a version number rather than
                // labelling their history with our machinery.
                applyMessageFiles(msg.content, msgId, wasFix ? undefined : content);
                // An unfinished first build isn't "ready" — hold its
                // notification and quality review until the chain lands
                if ((truncated || chunked) && isFirstBuild && messageProducedFiles(msg.content)) {
                  useChatStore.setState({ chainFirstBuildAsk: content });
                }
                // Surface edits that couldn't be applied cleanly
                const warnings = useProjectStore.getState().lastApplyWarnings;
                if (warnings.length > 0) {
                  appendToMessage(msgId, `\n\n> ⚠️ ${warnings.join(' ')}`);
                  recordBuildEvent('apply_warnings', warnings.join(' '));
                }
                // A build that touched cloud-schema.json syncs the collection
                // schemas to Community Cloud (destructive changes confirm first)
                if (msg.content.includes('cloud-schema.json')) {
                  void reconcileCloudSchema().then(({ note }) => {
                    if (note) appendToMessage(msgId, `\n\n> ${note}`);
                  });
                }
                // Managed Supabase: builds that touch supabase/ get their
                // migrations linted + applied and functions deployed (with
                // the builder's confirmation) via the vaulted PAT
                if (/supabase\/(migrations|functions)\//.test(msg.content)) {
                  void applySupabaseChanges(msg.content).then(({ note }) => {
                    if (note) appendToMessage(msgId, `\n\n> ${note}`);
                  });
                }
                if ((truncated || chunked) && useChatStore.getState().continuationCount < MAX_CONTINUATIONS) {
                  // Continue through the fix channel. Truncated continuations
                  // keep chaining (big builds routinely need more than one
                  // extra reply); MAX_CONTINUATIONS bounds the spend.
                  if (truncated) {
                    appendToMessage(msgId, '\n\n> ⚠️ That reply was cut off mid-file — asking for the rest automatically.');
                  }
                  useChatStore.getState().queueContinuation(continuePrompt(chunked), 'Finishing the build');
                  recordBuildEvent(
                    'auto_continuation',
                    `${chunked ? 'planned chunk — ' : ''}pass ${useChatStore.getState().continuationCount} of ${MAX_CONTINUATIONS}`,
                  );
                } else if (truncated || chunked) {
                  appendToMessage(
                    msgId,
                    chunked
                      ? '\n\n> ⚠️ This build is unusually large — say "continue" for the remaining files.'
                      : '\n\n> ⚠️ Cut off again — this build is unusually large. Say "continue" to keep it going.',
                  );
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
                    // The initial build is done — arm the once-per-project
                    // offer to share its story with the stewards. The card
                    // itself waits for a calm moment (build settled, nothing
                    // fixing or reviewing) before it appears; consent-first
                    // either way — the report is only assembled on yes.
                    useBuildLogStore.getState().setOffer('armed');
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
                    // default down to the edit model for the changes ahead —
                    // visibly, with a note, so the model picker never changes
                    // behind anyone's back. (No-op while both stage models
                    // are the same, since there's nothing to step down to.)
                    const autoDefault = resolveCommunityModelDefault(
                      useProjectStore.getState().getFileCount(),
                    );
                    if (autoDefault?.stage === 'edit') {
                      const movedOff = useProviderStore.getState().activeModelId;
                      useProviderStore.getState().setActiveModel(autoDefault.model);
                      useChatStore
                        .getState()
                        .addSyncMessage(communityModelNote('edit', movedOff), MODEL_NOTE_LABEL);
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
            // An errored reply must surface right away — with its retry offer
            // — not sit hidden behind the cooking line
            useChatStore.getState().endCooking();
            endGen(`error — ${error.message.slice(0, 120)}`);
            appendToMessage(msgId, `\n\n**Error:** ${error.message}`);
            finalizeMessage(msgId);
            useChatStore.getState().markErrored(msgId);
            setIsGenerating(false);
            setAbortController(null);
            if (useCommunityStore.getState().active) void useCommunityStore.getState().check();
          },
        },
        controller.signal,
        { webTools },
      );
    } catch (err) {
      useChatStore.getState().endProgress();
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : String(err);
        useChatStore.getState().endCooking();
        endGen(`error — ${msg.slice(0, 120)}`);
        appendToMessage(msgId, `\n\n**Error:** ${msg}`);
        finalizeMessage(msgId);
        useChatStore.getState().markErrored(msgId);
        setIsGenerating(false);
        setAbortController(null);
      }
    } finally {
      clearInterval(watchdog);
    }

    // A watchdog abort fires no callbacks (aborted streams return silently) —
    // salvage whatever streamed and route through the truncation machinery.
    if (stalledAbort) {
      useChatStore.getState().endProgress();
      finalizeMessage(msgId);
      const stalledMsg = useChatStore.getState().messages.find(m => m.id === msgId);
      const got = stalledMsg?.content.trim() ?? '';
      endGen(`stalled — no data for ${Math.round(STALL_TIMEOUT_MS / 60_000)}+ minutes`);
      recordBuildEvent(
        'reply_cut_off',
        `stream stalled (no data for ${Math.round(STALL_TIMEOUT_MS / 60_000)}+ minutes)`,
      );
      if (currentMode === 'build' && got && stalledMsg) {
        applyMessageFiles(stalledMsg.content, msgId);
        if (isFirstBuild && messageProducedFiles(stalledMsg.content)) {
          useChatStore.setState({ chainFirstBuildAsk: content });
        }
        if (useChatStore.getState().continuationCount < MAX_CONTINUATIONS) {
          appendToMessage(msgId, '\n\n> ⚠️ The stream went quiet mid-reply — asking for the rest automatically.');
          useChatStore.getState().queueContinuation(continuePrompt(), 'Finishing the build');
          recordBuildEvent(
            'auto_continuation',
            `pass ${useChatStore.getState().continuationCount} of ${MAX_CONTINUATIONS}`,
          );
        } else {
          appendToMessage(msgId, '\n\n> ⚠️ The stream stalled again — say "continue" to keep the build going.');
          recordBuildEvent('continuation_cap');
        }
      } else if (!got) {
        appendToMessage(
          msgId,
          '**Nothing arrived from the model** — the connection stalled before the reply started. This is usually a hiccup upstream; please send that again.',
        );
      } else {
        appendToMessage(msgId, '\n\n> ⚠️ The reply stalled mid-stream and was cut off here.');
      }
      setIsGenerating(false);
      setAbortController(null);
      if (useCommunityStore.getState().active) void useCommunityStore.getState().check();
    }

    // A manual stop aborts with no callbacks at all — close the bracket so
    // every gen_start has its gen_end
    if (!genEnded && controller.signal.aborted) endGen('stopped by the builder');
  }, [
    provider, activeModelId, addUserMessage, toChatMessages,
    startAssistantMessage, appendToMessage, finalizeMessage,
    setIsGenerating, setAbortController, applyMessageFiles,
    getRelevantContext, setSystemPrompt,
  ]);

  // While a first build cooks, the chat shows one calm line instead of the
  // build's churn. This watcher ends the cooking — revealing the finished
  // result all at once — when everything has settled: nothing generating,
  // nothing queued, and the preview standing rather than mid-bundle. The
  // quiet must hold for a few seconds so the deferred machinery (the
  // FixBanner's 2.5s auto-fix, the bundler's debounce) gets its claim in
  // first — and so a standing error that nothing is going to fix reveals the
  // build anyway instead of cooking forever.
  const cooking = useChatStore(s => s.cookingSince !== null);
  useEffect(() => {
    if (!cooking) return;
    let quietFor = 0;
    const t = setInterval(() => {
      const chat = useChatStore.getState();
      const health = usePreviewHealthStore.getState().health;
      const quiet =
        !chat.isGenerating && !chat.queuedMessage && !chat.pendingFixSend && health !== 'building';
      quietFor = quiet ? quietFor + 1 : 0;
      if (quietFor >= 4) chat.endCooking();
    }, 1000);
    return () => clearInterval(t);
  }, [cooking]);

  // Messages queued while the AI was busy: error fixes always run in build
  // mode; a person's queued follow-up keeps whatever mode they were in.
  const queuedMessage = useChatStore(s => s.queuedMessage);
  useEffect(() => {
    if (!queuedMessage || isGenerating) return;
    // Claim the queue from the store, not the render closure: a mount-time
    // queue (home composer, prompt deep link) runs this effect twice under
    // StrictMode with the same stale `queuedMessage`, and the second run
    // must see that the first already took it — or the message sends twice.
    if (!useChatStore.getState().queuedMessage) return;
    const wasFix = useChatStore.getState().pendingFixSend;
    const attachments = useChatStore.getState().queuedAttachments;
    useChatStore.getState().clearQueuedMessage();
    if (wasFix) setMode('build');
    handleSend(queuedMessage, attachments.length > 0 ? attachments : undefined);
  }, [queuedMessage, isGenerating, setMode, handleSend]);

  const handleBuildPlan = useCallback(() => {
    setMode('build');
    // On an existing project the plan is a delta — build only it. From
    // scratch, the plan is the whole first build.
    const existing = useProjectStore.getState().getFileCount() > 0;
    handleSend(
      existing
        ? 'Make the changes agreed in the plan above — only those changes, keeping everything else in the app exactly as it is. Generate the complete added or edited files with filename annotations. End by naming, in one line, anything you deliberately left for a later pass.'
        : 'Build the first version of the app described in the plan above — the plan\'s First-build features, not its Later ones. Generate complete, working files with filename annotations, following the plan\'s look & feel and data decisions. End by naming, in one line, what you left for the next pass.',
    );
  }, [setMode, handleSend]);

  const handleStop = useCallback(() => {
    const controller = useChatStore.getState().abortController;
    controller?.abort();
    useChatStore.getState().endProgress();
    // Stopping is opting out of the wait — show whatever has landed
    useChatStore.getState().endCooking();
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
    // A note to collaborators involves no model — a missing API key must
    // not silence the humans on a shared project
    disabled: needsKey && mode !== 'message',
    mode,
    onModeChange: setMode,
  };

  // Home: the composer is the hero, embedded in the dashboard.
  // Building: it's the chat input, pinned below the conversation.
  // A project opened with files but no chat yet is still "building".
  const fileCount = useProjectStore(s => s.getFileCount());

  if (messages.length === 0 && fileCount === 0) {
    return (
      <div className="flex flex-col h-full">
        <HomeDashboard
          composer={
            <div className="space-y-2">
              <CommunityBudgetBanner />
              <MessageInput {...composerProps} variant="hero" />
              <NeedsKeyHint needsKey={needsKey} />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} onBuildPlan={handleBuildPlan} isGenerating={isGenerating} />
      {/* While a first build cooks, the quiet gaps between its passes must
          not flash banners — the cooking line is the only thing happening */}
      {!isGenerating && !cooking && <RemoteChangesBanner />}
      {!isGenerating && !cooking && <BuildRecovery />}
      {!isGenerating && !cooking && <RetryBanner onRetry={handleSend} />}
      {/* Always mounted: the card itself picks its calm moment to appear
          (and retires the ask if the person builds on past it) */}
      <BuildReportCard />
      {!isGenerating && !cooking && <CommunityBudgetBanner />}
      {!isGenerating && !cooking && <UndoLastChange />}
      {needsKey && (
        <div className="px-4 py-2 text-xs text-center bg-muted/50 border-t">
          <NeedsKeyHint needsKey={needsKey} />
        </div>
      )}
      <MessageInput {...composerProps} />
    </div>
  );
}
