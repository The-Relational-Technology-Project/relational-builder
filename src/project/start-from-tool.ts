import { getCachedStarter, cacheStarter } from '@/cloud/starter-prompts';
import { distillStarterPrompt } from '@/knowledge/prompt-distiller';
import { stashAndStartFresh } from '@/project/local-projects';
import { useCloudStore } from '@/store/cloud-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useEnvStore } from '@/store/env-store';
import type { Tool } from '@/knowledge/types';

/**
 * Prompt-level remixing, shared by every gallery surface: a Studio tool
 * becomes a place-adaptable build prompt (distilled once, cached for
 * everyone) seeded into a fresh workspace in Plan mode, with lineage
 * recorded. Throws on failure — callers own the error UI.
 */
export async function startFromStudioTool(tool: Tool): Promise<void> {
  const key = tool.github_url;
  if (!key) throw new Error('This tool has no source to start from yet');

  // v2 = question-list starters (a clean core prompt ending in bracketed
  // questions, instead of inline [placeholders]). Versioning the cache key
  // retires pre-v2 cached starters without touching the shared table.
  const cacheKey = `v2:${key}`;
  let starter = await getCachedStarter(cacheKey);
  if (!starter) {
    const distilled = await distillStarterPrompt(tool);
    starter = { tool_key: cacheKey, title: distilled.title, body: distilled.body };
    cacheStarter(starter).catch(() => {}); // warm the shared cache, best-effort
  }

  // The original's screenshots ride along as visible attachments: the model
  // sees what the reference tool actually looks like (fidelity for the parts
  // that transfer), and the person sees exactly what context travels — and
  // can add their own images beside them.
  const screenshots = [
    ...(tool.image_url ? [tool.image_url] : []),
    ...((tool.screenshot_urls ?? []).filter(u => u && u !== tool.image_url)),
  ].slice(0, 2);

  // Fresh workspace, Plan mode, the starter seeded as the opening draft.
  // Never destructive: the gallery is reachable mid-build, so any open work
  // goes to the local shelf first (cloud projects are already saved).
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useChatStore.getState().clearMessages();
  useEnvStore.getState().clearAll();
  useChatStore.getState().setMode('plan');
  useProjectStore.getState().setLineage({
    source: 'prompt',
    promptTitle: starter.title,
    sourceUrl: key,
    importedAt: new Date().toISOString(),
  });
  useChatStore.getState().setDraftMessage(
    screenshots.length > 0
      ? `${starter.body}\n\nThe attached screenshot${screenshots.length > 1 ? 's show' : ' shows'} the original tool. Use it as the visual reference: keep the parts that transfer close to the original, and adapt the look and details to my answers.`
      : starter.body,
  );
  useChatStore.getState().setDraftAttachments(screenshots.length > 0 ? screenshots : null);
}
