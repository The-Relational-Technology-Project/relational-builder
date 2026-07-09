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

  let starter = await getCachedStarter(key);
  if (!starter) {
    const distilled = await distillStarterPrompt(tool);
    starter = { tool_key: key, title: distilled.title, body: distilled.body };
    cacheStarter(starter).catch(() => {}); // warm the shared cache, best-effort
  }

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
  useChatStore.getState().setDraftMessage(starter.body);
}
